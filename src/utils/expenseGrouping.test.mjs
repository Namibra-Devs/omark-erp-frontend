// src/utils/expenseGrouping.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  groupExpenses,
  formatExpenseCurrency,
  parseExpenseDate,
} from './expenseGrouping.ts';

const sampleExpenses = [
  {
    id: 'e1',
    code: 'EXP-001',
    category: 'Office Supplies',
    type: 'internal',
    amountMinor: 15000, // ₵150.00
    incurredOn: '2026-10-02',
    status: 'approved',
    recordedByUserId: 'u1',
    recordedByUserName: 'Alice Secretary',
    recordedByUserRole: 'secretary',
    createdAt: '2026-10-02T10:00:00Z',
    updatedAt: '2026-10-02T10:00:00Z',
  },
  {
    id: 'e2',
    code: 'EXP-002',
    category: 'Client Hospitality',
    type: 'internal',
    amountMinor: 25050, // ₵250.50
    incurredOn: '2026-10-02',
    status: 'approved',
    recordedByUserId: 'u1',
    recordedByUserName: 'Alice Secretary',
    recordedByUserRole: 'secretary',
    createdAt: '2026-10-02T14:00:00Z',
    updatedAt: '2026-10-02T14:00:00Z',
  },
  {
    id: 'e3',
    code: 'EXP-003',
    category: 'Power & Fuel',
    type: 'internal',
    amountMinor: 60000, // ₵600.00
    incurredOn: '2026-10-15',
    status: 'pending',
    recordedByUserId: 'u2',
    recordedByUserName: 'Bob Manager',
    recordedByUserRole: 'branch_manager',
    createdAt: '2026-10-15T09:00:00Z',
    updatedAt: '2026-10-15T09:00:00Z',
  },
  {
    id: 'e4',
    code: 'EXP-004',
    category: 'Digital Ads',
    type: 'external',
    amountMinor: 120000, // ₵1200.00
    incurredOn: '2026-09-28',
    status: 'approved',
    recordedByUserId: 'u3',
    recordedByUserName: 'Charlie Director',
    recordedByUserRole: 'marketing_director',
    createdAt: '2026-09-28T11:00:00Z',
    updatedAt: '2026-09-28T11:00:00Z',
  },
  {
    id: 'e5',
    code: 'EXP-005',
    category: 'General Maintenance',
    type: 'internal',
    amountMinor: 35000, // ₵350.00
    incurredOn: '2026-09-30',
    status: 'approved',
    // No recordedByUserId - tests unassigned handling
    recordedByUserName: 'Unassigned',
    createdAt: '2026-09-30T17:00:00Z',
    updatedAt: '2026-09-30T17:00:00Z',
  },
];

test('Reconciliation: sum of day totals = staff total, sum of staff totals = month total, and sum of month totals = overall total', () => {
  const result = groupExpenses(sampleExpenses, {
    groupBy: 'staff',
    currentUserId: 'u1',
  });

  const expectedGrandTotal = 15000 + 25050 + 60000 + 120000 + 35000;
  assert.equal(result.overallTotalMinor, expectedGrandTotal);
  assert.equal(result.overallCount, 5);

  // Sum of month totals === overall total
  const sumOfMonths = result.months.reduce((acc, m) => acc + m.totalMinor, 0);
  assert.equal(sumOfMonths, result.overallTotalMinor);

  // For each month:
  for (const month of result.months) {
    // sum of staff totals === month total
    const sumOfStaff = month.groups.reduce((acc, g) => acc + g.totalMinor, 0);
    assert.equal(sumOfStaff, month.totalMinor);

    // sum of staff percentages is ~100%
    const sumOfPercentages = month.groups.reduce((acc, g) => acc + g.percentageOfMonth, 0);
    assert.ok(sumOfPercentages >= 99.8 && sumOfPercentages <= 100.2);

    // For each staff group:
    for (const group of month.groups) {
      // sum of day totals === staff total
      const sumOfDays = group.days.reduce((acc, d) => acc + d.totalMinor, 0);
      assert.equal(sumOfDays, group.totalMinor);

      // For each day: sum of item amounts === day total
      for (const day of group.days) {
        const sumOfItems = day.items.reduce((acc, item) => acc + item.amountMinor, 0);
        assert.equal(sumOfItems, day.totalMinor);
      }
    }
  }
});

test('Group by Role: groups Level 2 by role while month stays at Level 1', () => {
  const result = groupExpenses(sampleExpenses, {
    groupBy: 'role',
  });

  assert.equal(result.overallTotalMinor, 255050);

  const octMonth = result.months.find((m) => m.monthKey === '2026-10');
  assert.ok(octMonth);

  const roleKeys = octMonth.groups.map((g) => g.key);
  assert.ok(roleKeys.includes('secretary'));
  assert.ok(roleKeys.includes('branch_manager'));

  const secGroup = octMonth.groups.find((g) => g.key === 'secretary');
  assert.equal(secGroup.totalMinor, 15000 + 25050);
  assert.equal(secGroup.count, 2);
});

test('Sorting: staff within a month are sorted by dates from 1st to 31st', () => {
  const result = groupExpenses(sampleExpenses, {
    groupBy: 'staff',
  });

  const octMonth = result.months.find((m) => m.monthKey === '2026-10');
  // Alice had expenses on Oct 2nd, Bob had expenses on Oct 15th
  assert.equal(octMonth.groups[0].name, 'Alice Secretary');
  assert.equal(octMonth.groups[1].name, 'Bob Manager');
  assert.equal(octMonth.groups[0].earliestDayOfMonth, 2);
  assert.equal(octMonth.groups[1].earliestDayOfMonth, 15);
});

test('Current User: correctly flags isCurrentUser on logged in staff group', () => {
  const result = groupExpenses(sampleExpenses, {
    groupBy: 'staff',
    currentUserId: 'u1',
  });

  const octMonth = result.months.find((m) => m.monthKey === '2026-10');
  const alice = octMonth.groups.find((g) => g.id === 'u1');
  const bob = octMonth.groups.find((g) => g.id === 'u2');

  assert.equal(alice.isCurrentUser, true);
  assert.equal(bob.isCurrentUser, false);
});

test('Unassigned Expenses: groups expenses lacking staff into Unassigned bucket', () => {
  const result = groupExpenses(sampleExpenses, {
    groupBy: 'staff',
  });

  const sepMonth = result.months.find((m) => m.monthKey === '2026-09');
  const unassignedGroup = sepMonth.groups.find((g) => g.key === 'unassigned');

  assert.ok(unassignedGroup);
  assert.equal(unassignedGroup.name, 'Unassigned');
  assert.equal(unassignedGroup.totalMinor, 35000);
});

test('Currency Formatter: uses Ghanaian Cedis symbol ₵ and exact decimals', () => {
  assert.equal(formatExpenseCurrency(15000), '₵ 150.00');
  assert.equal(formatExpenseCurrency(25050), '₵ 250.50');
  assert.equal(formatExpenseCurrency(0), '₵ 0.00');
});

test('Date Parsing: preserves date boundaries in YYYY-MM-DD deterministically', () => {
  const parsed = parseExpenseDate('2026-10-31');
  assert.equal(parsed.dateKey, '2026-10-31');
  assert.equal(parsed.monthKey, '2026-10');
  assert.equal(parsed.year, 2026);
  assert.equal(parsed.month, 10);
  assert.equal(parsed.day, 31);
  assert.equal(parsed.monthLabel, 'October 2026');
});
