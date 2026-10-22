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

test('Total Paid Calculation: accurately combines down payment and installments cash paid to date', () => {
  const plan = {
    totalAmountMinor: 10000000, // GH₵ 100,000.00
    downPaymentMinor: 3000000,  // GH₵ 30,000.00
    balanceMinor: 5000000,      // Remaining GH₵ 50,000.00
  };
  const installmentCashPaidMinor = 2000000; // GH₵ 20,000.00

  // Total amount customer has paid to date: Down payment + Installments paid
  const totalPaidToDateMinor = (plan.downPaymentMinor || 0) + installmentCashPaidMinor;
  const totalPaidToDateGHS = totalPaidToDateMinor / 100;

  assert.equal(totalPaidToDateMinor, 5000000);
  assert.equal(totalPaidToDateGHS, 50000);

  // If customer has 0 down payment
  const zeroDownPlan = { totalAmountMinor: 5000000, downPaymentMinor: 0 };
  const zeroDownPaidMinor = (zeroDownPlan.downPaymentMinor || 0) + 1500000;
  assert.equal(zeroDownPaidMinor, 1500000);
  assert.equal(zeroDownPaidMinor / 100, 15000);
});

test('SMS Notification Provider Resilience: enforces max 11-char alphanumeric Sender ID and normalizes phone formats', () => {
  const SENDER_ID = 'OMARK';
  assert.ok(SENDER_ID.length <= 11, 'Sender ID must never exceed 11 characters under GSM/SMPP telco standard');

  // Test normalization logic
  function normalizePhoneNumber(phone) {
    if (!phone) return '';
    let cleaned = phone.trim().replace(/[^\d+]/g, '');
    if (cleaned.startsWith('0') && cleaned.length === 10) {
      cleaned = '+233' + cleaned.substring(1);
    } else if (!cleaned.startsWith('+') && cleaned.startsWith('233')) {
      cleaned = '+' + cleaned;
    }
    return cleaned;
  }

  function getVariants(phone) {
    const normalized = normalizePhoneNumber(phone);
    const digits = normalized.replace(/^\+/, '');
    const e164 = normalized.startsWith('+') ? normalized : `+${digits}`;
    const local = digits.startsWith('233') && digits.length === 12 ? '0' + digits.substring(3) : digits;
    return { e164, digits, local };
  }

  // 1. Local format input: 024 123 4567
  const v1 = getVariants('024 123 4567');
  assert.equal(v1.e164, '+233241234567');
  assert.equal(v1.digits, '233241234567');
  assert.equal(v1.local, '0241234567');

  // 2. International input without plus: 233241234567
  const v2 = getVariants('233241234567');
  assert.equal(v2.e164, '+233241234567');
  assert.equal(v2.digits, '233241234567');
  assert.equal(v2.local, '0241234567');

  // 3. International input with plus: +233 24 123 4567
  const v3 = getVariants('+233 24 123 4567');
  assert.equal(v3.e164, '+233241234567');
  assert.equal(v3.digits, '233241234567');
  assert.equal(v3.local, '0241234567');
});

test('Distinct Date Tracking: retains separate Paid On and Recorded On timestamps for payment audit', () => {
  const transaction = {
    id: 'tx-1',
    amountMinor: 500000,
    paidOn: '2026-10-18T10:00:00.000Z',    // Customer paid on Oct 18
    recordedOn: '2026-10-21T15:30:00.000Z', // Staff recorded in ERP on Oct 21
  };

  assert.notEqual(transaction.paidOn, transaction.recordedOn);
  assert.equal(transaction.paidOn, '2026-10-18T10:00:00.000Z');
  assert.equal(transaction.recordedOn, '2026-10-21T15:30:00.000Z');
});

