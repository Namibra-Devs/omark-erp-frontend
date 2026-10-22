import test from 'node:test';
import assert from 'node:assert/strict';

// Mirror core normalization and conflict logic from src/utils/duplicateValidation.ts
function extractPhoneDigits(phone) {
  if (!phone) return '';
  return String(phone).replace(/\D/g, '');
}

function normalizePhone(phone) {
  const digits = extractPhoneDigits(phone);
  if (!digits) return '';
  if (digits.startsWith('00233') && digits.length === 14) return '233' + digits.slice(5);
  if (digits.startsWith('233') && digits.length === 12) return digits;
  if (digits.startsWith('0') && digits.length === 10) return '233' + digits.slice(1);
  if (digits.length === 9) return '233' + digits;
  return digits;
}

function arePhonesDuplicate(phone1, phone2) {
  if (!phone1 || !phone2) return false;
  const d1 = extractPhoneDigits(phone1);
  const d2 = extractPhoneDigits(phone2);
  if (d1.length < 7 || d2.length < 7) return false;
  const n1 = normalizePhone(phone1);
  const n2 = normalizePhone(phone2);
  if (n1 && n2 && n1 === n2) return true;
  if (d1.length >= 9 && d2.length >= 9) {
    if (d1.slice(-9) === d2.slice(-9)) return true;
  }
  return false;
}

function areNamesDuplicate(first1, last1, first2, last2) {
  const f1 = (first1 || '').trim().toLowerCase();
  const l1 = (last1 || '').trim().toLowerCase();
  const f2 = (first2 || '').trim().toLowerCase();
  const l2 = (last2 || '').trim().toLowerCase();
  if ((!f1 && !l1) || (!f2 && !l2)) return false;
  const full1 = `${f1} ${l1}`.trim();
  const full2 = `${f2} ${l2}`.trim();
  if (full1 && full2 && full1 === full2) return true;
  const inv1 = `${l1} ${f1}`.trim();
  if (inv1 && full2 && inv1 === full2) return true;
  return false;
}

function checkCustomerConflicts(input, options) {
  const conflicts = [];
  const { firstName, lastName, phoneNumber, email, excludeId } = input;
  const prospectIdToExclude = input.excludeProspectId || input.prospectId;
  const customers = options.existingCustomers || [];
  const prospects = options.existingProspects || [];

  for (const c of customers) {
    if (excludeId && c.id === excludeId) continue;
    if (
      prospectIdToExclude &&
      c.prospectId &&
      (c.prospectId === prospectIdToExclude || c._id === prospectIdToExclude)
    ) {
      continue;
    }
    const cFullName = `${c.firstName || ''} ${c.lastName || ''}`.trim() || 'Unnamed Customer';

    if (phoneNumber && c.phoneNumber && arePhonesDuplicate(phoneNumber, c.phoneNumber)) {
      conflicts.push({
        field: 'phoneNumber',
        target: 'customer',
        matchedRecord: { id: c.id, fullName: cFullName, phoneNumber: c.phoneNumber },
        message: `A customer already exists with this phone number: ${cFullName} (${c.phoneNumber})`,
      });
    }
    if (firstName && lastName && c.firstName && c.lastName && areNamesDuplicate(firstName, lastName, c.firstName, c.lastName)) {
      conflicts.push({
        field: 'name',
        target: 'customer',
        matchedRecord: { id: c.id, fullName: cFullName, phoneNumber: c.phoneNumber },
        message: `A customer already exists with the name "${cFullName}" (${c.phoneNumber || 'No phone'})`,
      });
    }
  }

  for (const p of prospects) {
    if (prospectIdToExclude && (p.id === prospectIdToExclude || p._id === prospectIdToExclude)) {
      continue;
    }
    const pFullName = `${p.firstName || ''} ${p.lastName || ''}`.trim() || 'Unnamed Prospect';

    if (phoneNumber && p.phoneNumber && arePhonesDuplicate(phoneNumber, p.phoneNumber)) {
      conflicts.push({
        field: 'phoneNumber',
        target: 'prospect',
        matchedRecord: { id: p.id, fullName: pFullName, phoneNumber: p.phoneNumber },
        message: `This phone number belongs to an existing prospect: ${pFullName} (${p.phoneNumber}). Use "Convert Prospect" instead of adding a duplicate.`,
      });
    }
  }

  return conflicts;
}

// Resilient conversion function mirrored from useConvertProspectMutation
async function simulateConvertProspect(params, mockContext) {
  const { prospectId, customerType, propertyId, createPlan, firstName, lastName, phoneNumber, address } = params;
  const { existingCustomers = [], existingProspects = [], serverConvertFails = false } = mockContext;

  const isUuid = (id) =>
    typeof id === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

  const prospectObj = existingProspects.find((p) => p.id === prospectId) || {
    id: prospectId,
    firstName: firstName || 'Prospect',
    lastName: lastName || 'User',
    phoneNumber: phoneNumber || '0240000000',
    address: address || 'Accra',
  };

  // 1. Check if customer already exists for this prospect
  const matchedCustomer = existingCustomers.find(
    (c) =>
      (c.prospectId && c.prospectId === prospectId) ||
      (c.phoneNumber && prospectObj.phoneNumber && arePhonesDuplicate(c.phoneNumber, prospectObj.phoneNumber))
  );

  if (matchedCustomer) {
    return {
      success: true,
      result: {
        id: matchedCustomer.id,
        firstName: matchedCustomer.firstName,
        lastName: matchedCustomer.lastName,
        phoneNumber: matchedCustomer.phoneNumber,
        type: matchedCustomer.type || customerType,
        alreadyExisted: true,
      },
    };
  }

  // 2. Dedicated endpoint vs fallback
  let converted = null;
  if (isUuid(prospectId) && !serverConvertFails) {
    converted = {
      id: `server-converted-${prospectId}`,
      firstName: prospectObj.firstName,
      lastName: prospectObj.lastName,
      phoneNumber: prospectObj.phoneNumber,
      type: customerType,
      propertyId,
    };
  } else {
    // Fallback: direct customer creation
    converted = {
      id: isUuid(prospectId) ? `customer-via-fallback-${prospectId}` : `cust-${Date.now()}`,
      prospectId,
      firstName: prospectObj.firstName,
      lastName: prospectObj.lastName,
      phoneNumber: prospectObj.phoneNumber,
      address: prospectObj.address,
      type: customerType,
      propertyId,
      viaFallback: true,
    };
  }

  prospectObj.status = 'purchased';

  return {
    success: true,
    result: converted,
  };
}

test('Duplicate check: does NOT flag conflict against the prospect being converted', () => {
  const existingProspect = {
    id: 'pr_1729123456',
    firstName: 'Ama',
    lastName: 'Kofi',
    phoneNumber: '0241234567',
  };

  // Without excludeProspectId, it would flag conflict
  const conflictsWithoutExclude = checkCustomerConflicts(
    {
      firstName: 'Ama',
      lastName: 'Kofi',
      phoneNumber: '0241234567',
    },
    { existingProspects: [existingProspect], existingCustomers: [] }
  );
  assert.equal(conflictsWithoutExclude.length, 1);
  assert.equal(conflictsWithoutExclude[0].target, 'prospect');

  // With excludeProspectId, it ignores the prospect being converted!
  const conflictsWithExclude = checkCustomerConflicts(
    {
      firstName: 'Ama',
      lastName: 'Kofi',
      phoneNumber: '0241234567',
      excludeProspectId: 'pr_1729123456',
    },
    { existingProspects: [existingProspect], existingCustomers: [] }
  );
  assert.equal(conflictsWithExclude.length, 0, 'Should not have conflicts when excluding prospectId');
});

test('Duplicate check: flags conflict if phone belongs to another prospect not being converted', () => {
  const targetProspect = { id: 'pr_target', firstName: 'Kojo', lastName: 'Mensah', phoneNumber: '0249999999' };
  const anotherProspect = { id: 'pr_other', firstName: 'Esi', lastName: 'Ampofo', phoneNumber: '0241112222' };

  const conflicts = checkCustomerConflicts(
    {
      firstName: 'Kojo',
      lastName: 'Mensah',
      phoneNumber: '0241112222', // belongs to anotherProspect
      excludeProspectId: 'pr_target',
    },
    { existingProspects: [targetProspect, anotherProspect], existingCustomers: [] }
  );
  assert.equal(conflicts.length, 1);
  assert.equal(conflicts[0].target, 'prospect');
  assert.match(conflicts[0].message, /Esi Ampofo/);
});

test('Conversion resilience: converts synthetic ID prospects (pr_...) without error', async () => {
  const syntheticProspect = {
    id: 'pr_1729000111',
    firstName: 'Kwesi',
    lastName: 'Arthur',
    phoneNumber: '0551234567',
    address: 'East Legon, Accra',
    status: 'new',
  };

  const response = await simulateConvertProspect(
    {
      prospectId: syntheticProspect.id,
      customerType: 'payment_plan',
      propertyId: 'prop-101',
      firstName: syntheticProspect.firstName,
      lastName: syntheticProspect.lastName,
      phoneNumber: syntheticProspect.phoneNumber,
      address: syntheticProspect.address,
    },
    {
      existingProspects: [syntheticProspect],
      existingCustomers: [],
      serverConvertFails: false,
    }
  );

  assert.equal(response.success, true);
  assert.equal(response.result.viaFallback, true);
  assert.equal(syntheticProspect.status, 'purchased');
  assert.equal(response.result.prospectId, 'pr_1729000111');
});

test('Conversion resilience: gracefully navigates when customer already exists without throwing error', async () => {
  const prospect = {
    id: 'c8d8e8f8-1234-4567-89ab-cdef01234567',
    firstName: 'Akosua',
    lastName: 'Manu',
    phoneNumber: '0207654321',
  };

  const alreadyExistingCustomer = {
    id: 'cust-already-there-99',
    prospectId: prospect.id,
    firstName: 'Akosua',
    lastName: 'Manu',
    phoneNumber: '0207654321',
    type: 'payment_plan',
  };

  const response = await simulateConvertProspect(
    {
      prospectId: prospect.id,
      customerType: 'payment_plan',
      propertyId: 'prop-202',
    },
    {
      existingProspects: [prospect],
      existingCustomers: [alreadyExistingCustomer],
    }
  );

  assert.equal(response.success, true);
  assert.equal(response.result.alreadyExisted, true);
  assert.equal(response.result.id, 'cust-already-there-99');
});

test('Conversion resilience: falls back to direct customer creation if POST /prospects/{id}/convert fails', async () => {
  const validUuidProspect = {
    id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    firstName: 'Yaw',
    lastName: 'Boateng',
    phoneNumber: '0245556667',
    address: 'Airport Hills, Accra',
    status: 'meeting_scheduled',
  };

  const response = await simulateConvertProspect(
    {
      prospectId: validUuidProspect.id,
      customerType: 'fully_paid',
      propertyId: 'prop-303',
    },
    {
      existingProspects: [validUuidProspect],
      existingCustomers: [],
      serverConvertFails: true, // Server endpoint 500s or 404s
    }
  );

  assert.equal(response.success, true);
  assert.equal(response.result.viaFallback, true);
  assert.equal(validUuidProspect.status, 'purchased');
});
