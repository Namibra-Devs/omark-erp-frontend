// src/utils/departmentExpenses.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import dayjs from 'dayjs';
import {
  normalizeDepartmentName,
  calculateDepartmentSummaries,
  calculateGrandTotals,
  STANDARD_CORPORATE_DEPARTMENTS,
} from './departmentExpenses.ts';

test('Department Normalization: accurately resolves department from name and role', () => {
  // Test direct strings
  assert.equal(normalizeDepartmentName('Marketing & Sales'), 'Marketing & Sales');
  assert.equal(normalizeDepartmentName('Marketing'), 'Marketing & Sales');
  assert.equal(normalizeDepartmentName('Sales & Promotion'), 'Marketing & Sales');
  assert.equal(normalizeDepartmentName('Customer Service'), 'Customer Service');
  assert.equal(normalizeDepartmentName('Finance & Accounts'), 'Finance & Accounts');
  assert.equal(normalizeDepartmentName('Accounts'), 'Finance & Accounts');
  assert.equal(normalizeDepartmentName('Operations'), 'Operations');
  assert.equal(normalizeDepartmentName('Branch Operations'), 'Operations');
  assert.equal(normalizeDepartmentName('Executive Administration'), 'Executive Administration');
  assert.equal(normalizeDepartmentName('Administration'), 'Administration');

  // Test role fallbacks
  assert.equal(normalizeDepartmentName(undefined, 'marketing_director'), 'Marketing & Sales');
  assert.equal(normalizeDepartmentName(undefined, 'marketing_staff'), 'Marketing & Sales');
  assert.equal(normalizeDepartmentName(undefined, 'secretary'), 'Administration');
  assert.equal(normalizeDepartmentName(undefined, 'branch_manager'), 'Operations');
  assert.equal(normalizeDepartmentName(undefined, 'accounts'), 'Finance & Accounts');
  assert.equal(normalizeDepartmentName(undefined, 'admin'), 'Executive Administration');
  assert.equal(normalizeDepartmentName(undefined, 'customer_service'), 'Customer Service');
});

test('Department Coverage: covers all standard corporate departments', () => {
  const stdDeptNames = STANDARD_CORPORATE_DEPARTMENTS.map((d) => d.name);
  assert.equal(stdDeptNames.length, 6);
  assert.ok(stdDeptNames.includes('Marketing & Sales'));
  assert.ok(stdDeptNames.includes('Customer Service'));
  assert.ok(stdDeptNames.includes('Finance & Accounts'));
  assert.ok(stdDeptNames.includes('Operations'));
  assert.ok(stdDeptNames.includes('Executive Administration'));
  assert.ok(stdDeptNames.includes('Administration'));
});

test('Dynamic Totals: calculates department sub-totals and overall grand total accurately', () => {
  const sampleExpenses = [
    {
      id: 'exp-1',
      department: 'Marketing & Sales',
      amountMinor: 250000, // GHS 2,500.00
      status: 'approved',
      incurredOn: '2026-10-15',
    },
    {
      id: 'exp-2',
      department: 'Marketing & Sales',
      amountMinor: 150000, // GHS 1,500.00
      status: 'pending',
      incurredOn: '2026-10-15',
    },
    {
      id: 'exp-3',
      department: 'Operations',
      amountMinor: 120000, // GHS 1,200.00
      status: 'approved',
      incurredOn: '2026-10-15',
    },
    {
      id: 'exp-4',
      department: 'Finance & Accounts',
      amountMinor: 80000, // GHS 800.00
      status: 'rejected',
      incurredOn: '2026-10-15',
    },
    {
      id: 'exp-5',
      department: 'Administration',
      amountMinor: 50000, // GHS 500.00
      status: 'approved',
      incurredOn: '2026-10-14', // Different day!
    },
  ];

  // 1. All items (All-Time mode)
  const allTimeSummaries = calculateDepartmentSummaries(sampleExpenses);
  const mkt = allTimeSummaries.find((d) => d.name === 'Marketing & Sales');
  assert.ok(mkt);
  assert.equal(mkt.count, 2);
  assert.equal(mkt.totalMinor, 400000); // GHS 4,000.00
  assert.equal(mkt.approvedMinor, 250000);
  assert.equal(mkt.pendingMinor, 150000);

  const grandAll = calculateGrandTotals(sampleExpenses);
  assert.equal(grandAll.grandCount, 5);
  assert.equal(grandAll.grandTotalMinor, 650000); // GHS 6,500.00
  assert.equal(grandAll.grandTotalGHS, 6500.0);
  assert.equal(grandAll.grandApprovedMinor, 420000);
  assert.equal(grandAll.grandApprovedGHS, 4200.0);
  assert.equal(grandAll.grandPendingMinor, 150000);
  assert.equal(grandAll.grandPendingGHS, 1500.0);
  assert.equal(grandAll.grandRejectedMinor, 80000);
  assert.equal(grandAll.grandRejectedGHS, 800.0);

  // 2. Daily mode: strictly 2026-10-15
  const dailyFiltered = sampleExpenses.filter((e) => e.incurredOn === '2026-10-15');
  const dailySummaries = calculateDepartmentSummaries(dailyFiltered);
  const dailyGrand = calculateGrandTotals(dailyFiltered);

  assert.equal(dailyFiltered.length, 4);
  assert.equal(dailyGrand.grandTotalMinor, 600000); // exp-5 on 2026-10-14 excluded
  assert.equal(dailyGrand.grandTotalGHS, 6000.0);

  const dailyMkt = dailySummaries.find((d) => d.name === 'Marketing & Sales');
  assert.equal(dailyMkt.totalMinor, 400000);

  const dailyOps = dailySummaries.find((d) => d.name === 'Operations');
  assert.equal(dailyOps.totalMinor, 120000);

  const dailyFin = dailySummaries.find((d) => d.name === 'Finance & Accounts');
  assert.equal(dailyFin.totalMinor, 80000);

  const dailyAdmin = dailySummaries.find((d) => d.name === 'Administration');
  assert.equal(dailyAdmin.count, 0);
  assert.equal(dailyAdmin.totalMinor, 0);
});

test('Dynamic Totals: Monthly date filtering recalculates sub-totals and grand total', () => {
  const monthlyExpenses = [
    { id: '1', department: 'Marketing & Sales', amountMinor: 100000, incurredOn: '2026-10-02', status: 'approved' },
    { id: '2', department: 'Marketing & Sales', amountMinor: 200000, incurredOn: '2026-10-20', status: 'pending' },
    { id: '3', department: 'Operations', amountMinor: 150000, incurredOn: '2026-10-10', status: 'approved' },
    { id: '4', department: 'Operations', amountMinor: 300000, incurredOn: '2026-09-28', status: 'approved' }, // September!
  ];

  // Filter to October 2026
  const targetMonth = dayjs('2026-10-01');
  const octExpenses = monthlyExpenses.filter((e) => {
    const d = dayjs(e.incurredOn);
    return d.isSame(targetMonth, 'month') && d.isSame(targetMonth, 'year');
  });

  assert.equal(octExpenses.length, 3);
  const octGrand = calculateGrandTotals(octExpenses);
  assert.equal(octGrand.grandTotalMinor, 450000); // 4,500.00 GHS (excludes 3,000.00 from Sep)
  assert.equal(octGrand.grandTotalGHS, 4500.0);

  // Sub-totals for October
  const octSummaries = calculateDepartmentSummaries(octExpenses);
  const mktOct = octSummaries.find((d) => d.name === 'Marketing & Sales');
  assert.equal(mktOct.totalMinor, 300000); // 3,000.00 GHS

  const opsOct = octSummaries.find((d) => d.name === 'Operations');
  assert.equal(opsOct.totalMinor, 150000); // 1,500.00 GHS
});

test('Administrative Actions: direct decision updating payload schema', () => {
  const expense = {
    id: 'exp-dept-action-01',
    department: 'Marketing & Sales',
    amountMinor: 350000,
    status: 'pending',
    incurredOn: '2026-10-15',
  };

  // Simulating approval decision
  const approvedExpense = {
    ...expense,
    status: 'approved',
    decisionNote: 'Authorized by Executive & Accounts Admin',
    decidedAt: new Date().toISOString(),
  };

  assert.equal(approvedExpense.status, 'approved');
  assert.ok(approvedExpense.decisionNote.includes('Authorized'));
  assert.ok(approvedExpense.decidedAt);

  // Simulating rejection decision
  const rejectedExpense = {
    ...expense,
    status: 'rejected',
    decisionNote: 'Rejected: Over budget for marketing roadshow',
    decidedAt: new Date().toISOString(),
  };

  assert.equal(rejectedExpense.status, 'rejected');
  assert.ok(rejectedExpense.decisionNote.includes('Over budget'));
});

test('4 Main Department Resolution: accurately maps expenses to Secretary, BM, Marketing, and Admin', async () => {
  const { resolveFourMainDepartment, calculateFourDepartmentSummaries, FOUR_MAIN_DEPARTMENTS } = await import('./departmentExpenses.ts');

  // Verify 4 departments config
  assert.equal(FOUR_MAIN_DEPARTMENTS.length, 4);
  const keys = FOUR_MAIN_DEPARTMENTS.map((d) => d.key);
  assert.deepEqual(keys, ['secretary', 'bm', 'marketing', 'admin']);

  // Secretary
  assert.equal(resolveFourMainDepartment({ recordedByUserRole: 'secretary' }), 'secretary');
  assert.equal(resolveFourMainDepartment({ department: 'Administration' }), 'secretary');
  assert.equal(resolveFourMainDepartment({ department: 'Customer Service' }), 'secretary');
  assert.equal(resolveFourMainDepartment({ category: 'Client Hospitality' }), 'secretary');
  assert.equal(resolveFourMainDepartment({ category: 'Office Supplies' }), 'secretary');
  assert.equal(resolveFourMainDepartment({ category: 'Courier & Dispatch' }), 'secretary');

  // BM (Branch Manager)
  assert.equal(resolveFourMainDepartment({ recordedByUserRole: 'branch_manager' }), 'bm');
  assert.equal(resolveFourMainDepartment({ department: 'Operations' }), 'bm');
  assert.equal(resolveFourMainDepartment({ department: 'Branch Operations' }), 'bm');
  assert.equal(resolveFourMainDepartment({ category: 'Power & Fuel' }), 'bm');
  assert.equal(resolveFourMainDepartment({ category: 'Premises Repairs' }), 'bm');

  // Marketing
  assert.equal(resolveFourMainDepartment({ recordedByUserRole: 'marketing_director' }), 'marketing');
  assert.equal(resolveFourMainDepartment({ recordedByUserRole: 'marketing_staff' }), 'marketing');
  assert.equal(resolveFourMainDepartment({ department: 'Marketing & Sales' }), 'marketing');
  assert.equal(resolveFourMainDepartment({ category: 'Digital Media Ads' }), 'marketing');
  assert.equal(resolveFourMainDepartment({ category: 'Property Expo & Roadshow' }), 'marketing');

  // Admin
  assert.equal(resolveFourMainDepartment({ recordedByUserRole: 'admin' }), 'admin');
  assert.equal(resolveFourMainDepartment({ recordedByUserRole: 'accounts' }), 'admin');
  assert.equal(resolveFourMainDepartment({ department: 'Executive Administration' }), 'admin');
  assert.equal(resolveFourMainDepartment({ department: 'Finance & Accounts' }), 'admin');
  assert.equal(resolveFourMainDepartment({ category: 'Executive IT & Cloud Hosting' }), 'admin');
  assert.equal(resolveFourMainDepartment({ category: 'Audit & Compliance' }), 'admin');
});

test('4 Main Department Summaries & Periodic Totals: calculates subtotals and grand totals reflecting period', async () => {
  const { calculateFourDepartmentSummaries, calculateGrandTotals } = await import('./departmentExpenses.ts');

  const periodicExpenses = [
    { id: 'e1', recordedByUserRole: 'secretary', amountMinor: 50000, status: 'approved', incurredOn: '2026-10-10' },
    { id: 'e2', recordedByUserRole: 'branch_manager', amountMinor: 120000, status: 'pending', incurredOn: '2026-10-12' },
    { id: 'e3', recordedByUserRole: 'marketing_director', amountMinor: 250000, status: 'approved', incurredOn: '2026-10-14' },
    { id: 'e4', recordedByUserRole: 'admin', amountMinor: 80000, status: 'approved', incurredOn: '2026-10-15' },
    { id: 'e5', recordedByUserRole: 'admin', amountMinor: 40000, status: 'rejected', incurredOn: '2026-10-15' },
  ];

  const summaries = calculateFourDepartmentSummaries(periodicExpenses);
  assert.equal(summaries.length, 4);

  const sec = summaries.find((s) => s.key === 'secretary');
  assert.equal(sec.count, 1);
  assert.equal(sec.totalMinor, 50000); // 500.00 GHS
  assert.equal(sec.approvedMinor, 50000);

  const bm = summaries.find((s) => s.key === 'bm');
  assert.equal(bm.count, 1);
  assert.equal(bm.totalMinor, 120000); // 1,200.00 GHS
  assert.equal(bm.pendingMinor, 120000);

  const mkt = summaries.find((s) => s.key === 'marketing');
  assert.equal(mkt.count, 1);
  assert.equal(mkt.totalMinor, 250000); // 2,500.00 GHS
  assert.equal(mkt.approvedMinor, 250000);

  const adm = summaries.find((s) => s.key === 'admin');
  assert.equal(adm.count, 2);
  assert.equal(adm.totalMinor, 120000); // 1,200.00 GHS
  assert.equal(adm.approvedMinor, 80000);
  assert.equal(adm.rejectedMinor, 40000);

  // Overall grand totals reflecting this period
  const grand = calculateGrandTotals(periodicExpenses);
  assert.equal(grand.grandCount, 5);
  assert.equal(grand.grandTotalMinor, 540000); // 5,400.00 GHS
  assert.equal(grand.grandTotalGHS, 5400.0);
  assert.equal(grand.grandApprovedMinor, 380000); // 3,800.00 GHS
  assert.equal(grand.grandPendingMinor, 120000); // 1,200.00 GHS
  assert.equal(grand.grandRejectedMinor, 40000); // 400.00 GHS
});
