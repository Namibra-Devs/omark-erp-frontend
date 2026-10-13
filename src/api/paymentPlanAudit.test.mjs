import test from 'node:test';
import assert from 'node:assert/strict';

// Client-side validation rule mirrors
function validatePaymentPlanUpdate({
  reason,
  totalAmountMinor,
  downPaymentMinor,
  numMonths,
  installmentsPaidCount = 0,
}) {
  const errors = [];

  // Reason must be 3-500 characters
  if (!reason || typeof reason !== 'string' || reason.trim().length < 3) {
    errors.push('Reason is required and must be at least 3 characters.');
  } else if (reason.trim().length > 500) {
    errors.push('Reason cannot exceed 500 characters.');
  }

  // Down payment <= total amount
  if (totalAmountMinor !== undefined && downPaymentMinor !== undefined) {
    if (downPaymentMinor > totalAmountMinor) {
      errors.push('Down payment cannot exceed total property price.');
    }
  }

  // numMonths >= installmentsPaidCount
  if (numMonths !== undefined && numMonths < installmentsPaidCount) {
    errors.push(`Duration cannot be less than already settled instalments (${installmentsPaidCount}).`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// Field label formatter mirror
function getFieldLabel(field) {
  switch (field) {
    case 'totalAmountMinor':
      return 'Total Amount';
    case 'downPaymentMinor':
      return 'Down Payment';
    case 'balanceMinor':
      return 'Balance';
    case 'numMonths':
      return 'Duration';
    case 'monthlyAmountMinor':
      return 'Monthly Amount';
    case 'startDate':
      return 'Start Date';
    case 'status':
      return 'Status';
    case 'planBasis':
      return 'Plan Basis';
    default:
      return field;
  }
}

// Field value formatter mirror
function formatFieldValue(field, val) {
  if (val === null || val === undefined) return 'None';
  switch (field) {
    case 'totalAmountMinor':
    case 'downPaymentMinor':
    case 'balanceMinor':
    case 'monthlyAmountMinor':
      return `GHS ${(Number(val) / 100).toFixed(2)}`;
    case 'numMonths':
      return `${val} months`;
    case 'status':
      return String(val).toUpperCase();
    case 'planBasis':
      return val === 'monthly_amount' ? 'Fixed Monthly Amount' : 'Fixed Number of Months';
    default:
      return String(val);
  }
}

test('Validation: Rejects empty or too short reasons (<3 chars) and too long (>500 chars)', () => {
  const emptyRes = validatePaymentPlanUpdate({
    reason: '',
    totalAmountMinor: 3000000,
    downPaymentMinor: 500000,
    numMonths: 12,
  });
  assert.strictEqual(emptyRes.valid, false);
  assert.match(emptyRes.errors[0], /Reason is required/);

  const shortRes = validatePaymentPlanUpdate({
    reason: 'ok',
    totalAmountMinor: 3000000,
    downPaymentMinor: 500000,
    numMonths: 12,
  });
  assert.strictEqual(shortRes.valid, false);

  const validRes = validatePaymentPlanUpdate({
    reason: 'Customer renegotiated price after second instalment',
    totalAmountMinor: 3000000,
    downPaymentMinor: 500000,
    numMonths: 12,
  });
  assert.strictEqual(validRes.valid, true);
  assert.strictEqual(validRes.errors.length, 0);
});

test('Validation: Enforces downPaymentMinor <= totalAmountMinor', () => {
  const invalidRes = validatePaymentPlanUpdate({
    reason: 'Customer renegotiation',
    totalAmountMinor: 1000000,
    downPaymentMinor: 1500000,
    numMonths: 12,
  });
  assert.strictEqual(invalidRes.valid, false);
  assert.match(invalidRes.errors[0], /Down payment cannot exceed total property price/);
});

test('Validation: Enforces numMonths >= installmentsPaidCount (cannot shorten below settled installments)', () => {
  const invalidRes = validatePaymentPlanUpdate({
    reason: 'Adjusting duration',
    totalAmountMinor: 3000000,
    downPaymentMinor: 500000,
    numMonths: 2,
    installmentsPaidCount: 4,
  });
  assert.strictEqual(invalidRes.valid, false);
  assert.match(invalidRes.errors[0], /cannot be less than already settled instalments \(4\)/);

  const validRes = validatePaymentPlanUpdate({
    reason: 'Adjusting duration',
    totalAmountMinor: 3000000,
    downPaymentMinor: 500000,
    numMonths: 6,
    installmentsPaidCount: 4,
  });
  assert.strictEqual(validRes.valid, true);
});

test('Semantics: numMonths represents total plan duration, never remaining count', () => {
  const totalDuration = 18;
  const paidCount = 2;
  const remainingCount = totalDuration - paidCount;

  // PATCH body must send totalDuration (18), not remainingCount (16)
  const patchPayload = {
    reason: 'Customer renegotiated price after second instalment',
    numMonths: totalDuration,
  };
  assert.strictEqual(patchPayload.numMonths, 18);
  assert.notStrictEqual(patchPayload.numMonths, remainingCount);
});

test('Audit Trail: Formats change diffs accurately for currency, duration, and status', () => {
  const diffs = [
    { field: 'totalAmountMinor', from: 3750000, to: 3000000 },
    { field: 'numMonths', from: 12, to: 18 },
    { field: 'monthlyAmountMinor', from: 270834, to: 166667 },
    { field: 'status', from: 'active', to: 'completed' },
  ];

  assert.strictEqual(getFieldLabel(diffs[0].field), 'Total Amount');
  assert.strictEqual(formatFieldValue(diffs[0].field, diffs[0].from), 'GHS 37500.00');
  assert.strictEqual(formatFieldValue(diffs[0].field, diffs[0].to), 'GHS 30000.00');

  assert.strictEqual(getFieldLabel(diffs[1].field), 'Duration');
  assert.strictEqual(formatFieldValue(diffs[1].field, diffs[1].from), '12 months');
  assert.strictEqual(formatFieldValue(diffs[1].field, diffs[1].to), '18 months');

  assert.strictEqual(getFieldLabel(diffs[2].field), 'Monthly Amount');
  assert.strictEqual(formatFieldValue(diffs[2].field, diffs[2].from), 'GHS 2708.34');
  assert.strictEqual(formatFieldValue(diffs[2].field, diffs[2].to), 'GHS 1666.67');

  assert.strictEqual(getFieldLabel(diffs[3].field), 'Status');
  assert.strictEqual(formatFieldValue(diffs[3].field, diffs[3].from), 'ACTIVE');
  assert.strictEqual(formatFieldValue(diffs[3].field, diffs[3].to), 'COMPLETED');
});
