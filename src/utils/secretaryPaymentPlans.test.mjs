import test from 'node:test';
import assert from 'node:assert/strict';

// Helper matching SecretaryDashboardPage plan active check
export const isPlanActive = (p) => {
  if (!p) return false;
  const s = String(p.status || '').toLowerCase().trim();
  if (s === 'completed' || s === 'cancelled') return false;
  if (s === 'active') return true;
  return p.balanceMinor === undefined || p.balanceMinor > 0;
};

// Replicate deduplicated plan aggregation
export function buildSecretaryRawPaymentPlans(rawPaymentPlans, rawCustomers, propertyMap, customerMap) {
  const plansMap = new Map();
  const seenCustomerIds = new Set();

  rawPaymentPlans.forEach((p) => {
    const custIdKey = (
      p.customerId ||
      p.customer_id ||
      (typeof p.customer === 'string' ? p.customer : p.customer?.id) ||
      ''
    ).toString().trim().toLowerCase();

    const cust = custIdKey ? customerMap[custIdKey] : undefined;
    const prop = p.propertyId ? propertyMap[p.propertyId] : undefined;
    const branchId = p.branchId || cust?.branchId || cust?.branch || prop?.branchId;

    const updatedPlan = {
      ...p,
      branchId: branchId || p.branchId,
    };

    // Canonical key per plan is its unique plan ID to avoid duplicate map entries
    const planKey = (p.id || `plan-${custIdKey}`).toString().toLowerCase();
    plansMap.set(planKey, updatedPlan);

    if (custIdKey) {
      seenCustomerIds.add(custIdKey);
    }
  });

  rawCustomers.forEach((c) => {
    const cleanCId = (c.id || '').trim().toLowerCase();
    if (cleanCId && seenCustomerIds.has(cleanCId)) return;
    const directMatch = rawPaymentPlans.find((p) => {
      const pCustId = (
        p.customerId ||
        p.customer_id ||
        (typeof p.customer === 'string' ? p.customer : p.customer?.id) ||
        ''
      ).toString().trim().toLowerCase();
      return pCustId && pCustId === cleanCId;
    });
    if (directMatch) return;

    if (c.type !== 'payment_plan' && !c.plan) return;

    const prop = propertyMap[c.propertyId];
    const embeddedPlan = c.plan;
    const planId = embeddedPlan?.id || `plan-${c.id}`;

    const syntheticPlan = {
      id: planId,
      customerId: c.id,
      propertyId: c.propertyId || '',
      branchId: c.branchId || c.branch || prop?.branchId,
      status: 'active',
      balanceMinor: 20000000,
    };

    plansMap.set(planId.toString().toLowerCase(), syntheticPlan);
    seenCustomerIds.add(cleanCId);
  });

  return Array.from(plansMap.values());
}

test('Secretary Dashboard: deduplicates payment plans so each plan appears exactly once', () => {
  const rawPlans = [
    { id: 'plan-001', customerId: 'cust-001', status: 'active', balanceMinor: 1000000, monthlyAmountMinor: 100000 },
    { id: 'plan-002', customerId: 'cust-002', status: 'active', balanceMinor: 2000000, monthlyAmountMinor: 200000 },
    { id: 'plan-003', customerId: 'cust-003', status: 'completed', balanceMinor: 0, monthlyAmountMinor: 150000 },
  ];
  const rawCustomers = [
    { id: 'cust-001', firstName: 'Kofi', type: 'payment_plan' },
    { id: 'cust-002', firstName: 'Ama', type: 'payment_plan' },
    { id: 'cust-003', firstName: 'Kwame', type: 'payment_plan' },
    { id: 'cust-004', firstName: 'Yaw', type: 'fully_paid' },
  ];

  const aggregated = buildSecretaryRawPaymentPlans(rawPlans, rawCustomers, {}, {});

  assert.equal(aggregated.length, 3, 'There should be exactly 3 plans, with no 2x duplication');
  assert.equal(aggregated.filter((p) => p.id === 'plan-001').length, 1);
  assert.equal(aggregated.filter((p) => p.id === 'plan-002').length, 1);
  assert.equal(aggregated.filter((p) => p.id === 'plan-003').length, 1);
});

test('Secretary Dashboard: accurately filters Active Payment Plans and excludes completed/cancelled plans', () => {
  const plans = [
    { id: 'plan-1', status: 'active', balanceMinor: 500000 },
    { id: 'plan-2', status: 'active', balanceMinor: 1200000 },
    { id: 'plan-3', status: 'completed', balanceMinor: 0 },
    { id: 'plan-4', status: 'cancelled', balanceMinor: 800000 },
    { id: 'plan-5', status: undefined, balanceMinor: 0 }, // paid off without explicit status
    { id: 'plan-6', status: undefined, balanceMinor: 750000 }, // active balance without explicit status
  ];

  const activePlans = plans.filter(isPlanActive);

  assert.equal(activePlans.length, 3, 'Only plan-1, plan-2, and plan-6 should be counted as active');
  assert.deepEqual(activePlans.map((p) => p.id), ['plan-1', 'plan-2', 'plan-6']);
});

test('Secretary Dashboard: calculates monthly revenue strictly from active payment plans', () => {
  const plans = [
    { id: 'plan-1', status: 'active', balanceMinor: 500000, monthlyAmountMinor: 50000 },
    { id: 'plan-2', status: 'active', balanceMinor: 1200000, monthlyAmountMinor: 120000 },
    { id: 'plan-3', status: 'completed', balanceMinor: 0, monthlyAmountMinor: 80000 }, // completed should NOT contribute
  ];

  const activePlans = plans.filter(isPlanActive);
  const activeMonthlyRevenue = activePlans.reduce((sum, p) => sum + (p.monthlyAmountMinor || 0), 0);

  assert.equal(activeMonthlyRevenue, 170000, 'Monthly revenue should only be sum of active plans (50k + 120k = 170k)');
});
