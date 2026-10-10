import test from 'node:test';
import assert from 'node:assert/strict';

// Test isValidServerId logic
function isValidServerId(id) {
  if (!id || typeof id !== 'string') return false;
  const trimmed = id.trim();
  if (
    trimmed.startsWith('plan-') ||
    trimmed.startsWith('synth-') ||
    trimmed.startsWith('mock-') ||
    trimmed.startsWith('temp-') ||
    trimmed.startsWith('local-')
  ) {
    return false;
  }
  // MongoDB 24-character hex ObjectId
  if (/^[0-9a-f]{24}$/i.test(trimmed)) return true;
  // Standard UUID format (hyphenated)
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed)) return true;
  // General server alphanumeric ID of 8+ characters
  if (/^[a-zA-Z0-9_-]{8,}$/.test(trimmed)) return true;
  return false;
}

function extractPlanCustomerId(p) {
  if (!p) return '';
  const raw =
    p.customerId ||
    p.customer_id ||
    (typeof p.customer === 'string' ? p.customer : (p.customer?.id || p.customer?._id)) ||
    p.clientId ||
    p.client_id ||
    (typeof p.client === 'string' ? p.client : (p.client?.id || p.client?._id)) ||
    '';
  return String(raw).trim();
}

function extractPlanPropertyId(p) {
  if (!p) return '';
  const raw =
    p.propertyId ||
    p.property_id ||
    (typeof p.property === 'string' ? p.property : (p.property?.id || p.property?._id)) ||
    '';
  return String(raw).trim();
}

function extractPlanId(p) {
  if (!p) return '';
  return (p.id || p._id || '').toString().trim();
}

// Replicate findBackendPlanForCustomer matcher logic
function evaluatePlanCandidate(p, cleanCustId) {
  if (!p) return false;
  const candidatePlanId = extractPlanId(p);
  const candidateCustId = extractPlanCustomerId(p);
  const hasValidServerPlanId = isValidServerId(candidatePlanId);

  // Mandatory: customerId must strictly match. Property alone is NEVER accepted.
  const matchesCustomer = Boolean(
    candidateCustId && candidateCustId.toLowerCase() === cleanCustId.toLowerCase()
  );

  return matchesCustomer && hasValidServerPlanId;
}

function pickBestPlan(items, cleanCustId, cleanPropId) {
  const validCustomerPlans = items.filter((p) => evaluatePlanCandidate(p, cleanCustId));
  if (validCustomerPlans.length === 0) return null;

  if (cleanPropId) {
    const propMatch = validCustomerPlans.find((item) => {
      const pId = extractPlanPropertyId(item);
      return pId && pId.toLowerCase() === cleanPropId.toLowerCase();
    });
    if (propMatch) {
      const realId = extractPlanId(propMatch);
      return { ...propMatch, id: realId, customerId: cleanCustId };
    }
  }

  const first = validCustomerPlans[0];
  const realId = extractPlanId(first);
  return { ...first, id: realId, customerId: cleanCustId };
}

// Pre-payment ownership verification simulation
function verifyPlanOwnershipBeforePayment(expectedCustomerId, serverPlanDetail) {
  if (!expectedCustomerId || !expectedCustomerId.trim()) {
    throw new Error('Cannot record payment: Customer identity is missing. Please select a valid customer.');
  }

  if (!serverPlanDetail) {
    throw new Error('Cannot record payment: Payment plan was not found on server.');
  }

  const serverPlanCustomerId = extractPlanCustomerId(serverPlanDetail);
  if (!serverPlanCustomerId) {
    throw new Error('Cannot record payment: Server plan does not have an associated customer ID on record.');
  }

  if (serverPlanCustomerId.toLowerCase() !== expectedCustomerId.trim().toLowerCase()) {
    throw new Error(
      `Cannot record payment: Customer mismatch! Server plan is owned by customer "${serverPlanCustomerId}", but payment is being recorded for customer "${expectedCustomerId.trim()}". Payment aborted.`
    );
  }
}

// ── Test Suites ─────────────────────────────────────────────────────────────

test('isValidServerId: accepts valid server IDs and rejects synthetic prefixes', () => {
  // MongoDB 24-character hex ObjectIds
  assert.equal(isValidServerId('6aabca0c7e2c7cb97492669f'), true);
  assert.equal(isValidServerId('507f1f77bcf86cd799439011'), true);

  // RFC 4122 standard UUIDs
  assert.equal(isValidServerId('123e4567-e89b-12d3-a456-426614174000'), true);

  // Rejects synthetic / client-generated IDs
  assert.equal(isValidServerId('plan-6aabca0c7e2c7cb97492669f'), false);
  assert.equal(isValidServerId('synth-1234567890'), false);
  assert.equal(isValidServerId('mock-plan-1'), false);
  assert.equal(isValidServerId('temp-abc-123'), false);
  assert.equal(isValidServerId('local-999999'), false);
  assert.equal(isValidServerId(''), false);
  assert.equal(isValidServerId(null), false);
  assert.equal(isValidServerId(undefined), false);
});

test('Matcher: strictly requires customerId equality and NEVER matches on propertyId alone', () => {
  const customerA = '6aabca0c7e2c7cb97492669f';
  const customerB = '7bbdca0c7e2c7cb97492669e';
  const sharedPropertyId = 'prop-shared-development-100';

  // Plan belonging to customer B on shared property
  const planOfCustomerB = {
    id: '67072c4e8832a89012345678',
    customerId: customerB,
    propertyId: sharedPropertyId,
  };

  // When looking up plan for customer A:
  assert.equal(
    evaluatePlanCandidate(planOfCustomerB, customerA),
    false,
    'Plan belonging to Customer B must NOT match Customer A, even if property is identical'
  );

  const picked = pickBestPlan([planOfCustomerB], customerA, sharedPropertyId);
  assert.equal(
    picked,
    null,
    'pickBestPlan must return null when no plan matches customerId, regardless of propertyId'
  );
});

test('Matcher: correctly finds candidate with matching customerId and prioritizes propertyId when present', () => {
  const targetCust = '6aabca0c7e2c7cb97492669f';
  const targetProp = 'prop-plot-42';

  const planPlot1 = {
    id: '67072c4e8832a89012345601',
    customer: { id: targetCust },
    propertyId: 'prop-plot-01',
  };
  const planPlot42 = {
    id: '67072c4e8832a89012345642',
    customer_id: targetCust,
    propertyId: targetProp,
  };

  // Evaluate candidate matching
  assert.equal(evaluatePlanCandidate(planPlot1, targetCust), true);
  assert.equal(evaluatePlanCandidate(planPlot42, targetCust), true);

  // When looking for targetProp, must pick planPlot42
  const picked = pickBestPlan([planPlot1, planPlot42], targetCust, targetProp);
  assert.equal(picked?.id, '67072c4e8832a89012345642');

  // When no property specified, must still pick valid customer plan
  const pickedAny = pickBestPlan([planPlot1, planPlot42], targetCust);
  assert.equal(pickedAny?.id, '67072c4e8832a89012345601');
});

test('Pre-Payment Verification: verifies customerId matches before posting and throws otherwise', () => {
  const modalCust = '6aabca0c7e2c7cb97492669f';
  const otherCust = '7bbdca0c7e2c7cb97492669e';

  // 1. Success case: server plan customer matches modal customer
  const validServerPlan = {
    id: '67072c4e8832a89012345678',
    customerId: modalCust,
    balanceMinor: 100000,
  };
  assert.doesNotThrow(() => {
    verifyPlanOwnershipBeforePayment(modalCust, validServerPlan);
  });

  // 2. Mismatch case: server plan belongs to different customer -> MUST THROW
  const mismatchedServerPlan = {
    id: '67072c4e8832a89012345678',
    customerId: otherCust,
    balanceMinor: 100000,
  };
  assert.throws(
    () => {
      verifyPlanOwnershipBeforePayment(modalCust, mismatchedServerPlan);
    },
    /Customer mismatch!/
  );

  // 3. Missing customer in modal -> MUST THROW
  assert.throws(
    () => {
      verifyPlanOwnershipBeforePayment('', validServerPlan);
    },
    /Customer identity is missing/
  );

  // 4. Missing customer on server plan -> MUST THROW
  const orphanedPlan = {
    id: '67072c4e8832a89012345678',
    balanceMinor: 100000,
  };
  assert.throws(
    () => {
      verifyPlanOwnershipBeforePayment(modalCust, orphanedPlan);
    },
    /does not have an associated customer ID/
  );
});
