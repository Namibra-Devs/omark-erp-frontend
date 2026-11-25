// src/utils/expensesStorage.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';

// Mock localStorage for node:test environment
const store = new Map();
globalThis.localStorage = {
  getItem: (key) => store.get(key) || null,
  setItem: (key, val) => store.set(key, String(val)),
  removeItem: (key) => store.delete(key),
  clear: () => store.clear(),
};
globalThis.window = {
  dispatchEvent: () => {},
};

const {
  getStoredExpenses,
  saveStoredExpense,
  deleteStoredExpense,
  mergeExpenses,
  DEFAULT_ROLE_OPERATIONAL_EXPENSES,
  EXPENSES_STORAGE_KEY,
  isDummyFuelExpense,
  normalizeExpenseEntity,
} = await import('./expensesStorage.ts');

test('Zero Mock Data: empty localStorage remains empty without injecting synthetic baseline expenses', () => {
  localStorage.clear();
  assert.equal(localStorage.getItem(EXPENSES_STORAGE_KEY), null);

  const expenses = getStoredExpenses();
  assert.ok(Array.isArray(expenses));
  assert.equal(expenses.length, 0, 'No mock expenses should be injected into empty storage');
});

test('Zero Mock Data: DEFAULT_ROLE_OPERATIONAL_EXPENSES contains no synthetic mock expenses', () => {
  assert.equal(DEFAULT_ROLE_OPERATIONAL_EXPENSES.length, 0);
});

test('User Expense Persistence: newly created expense is stored and survives', () => {
  localStorage.clear();
  const newExp = {
    id: 'user-exp-101',
    code: 'EXP-USR-001',
    category: 'Client Hospitality',
    type: 'internal',
    amountMinor: 45000,
    incurredOn: '2026-10-17',
    recordedByUserName: 'Rita Secretary',
    recordedByUserRole: 'secretary',
    status: 'pending',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  saveStoredExpense(newExp);
  const list = getStoredExpenses();
  const found = list.find((e) => e.id === 'user-exp-101');
  assert.ok(found, 'Created expense must be found in stored list');
  assert.equal(found.amountMinor, 45000);
});

test('Deduplication & Merging: mergeExpenses combines server and local items cleanly', () => {
  const localList = [
    {
      id: 'exp-local-1',
      category: 'Office Supplies',
      type: 'internal',
      amountMinor: 5000,
      incurredOn: '2026-10-16',
      status: 'pending',
    },
  ];
  const serverList = [
    {
      id: 'exp-local-1',
      category: 'Office Supplies',
      type: 'internal',
      amountMinor: 5000,
      incurredOn: '2026-10-16',
      status: 'approved', // Updated on server
    },
    {
      id: 'exp-server-2',
      category: 'Power & Fuel',
      type: 'internal',
      amountMinor: 80000,
      incurredOn: '2026-10-17',
      status: 'approved',
    },
  ];

  const merged = mergeExpenses(serverList, localList);
  const ids = merged.map((m) => m.id);
  // Verify no duplicate IDs
  assert.equal(new Set(ids).size, ids.length);
  // Verify server version with approved status took priority
  const updatedItem = merged.find((m) => m.id === 'exp-local-1');
  assert.equal(updatedItem.status, 'approved');
  // Verify server item is included
  assert.ok(ids.includes('exp-server-2'));
});

test('Deletion Persistence: deleted expense does not resurrect from baseline', () => {
  localStorage.clear();
  const testExp = {
    id: 'exp-to-delete-1',
    category: 'Client Hospitality',
    type: 'internal',
    amountMinor: 25000,
    incurredOn: '2026-10-17',
    status: 'pending',
  };
  saveStoredExpense(testExp);
  const initial = getStoredExpenses();
  assert.equal(initial.length, 1);
  const target = initial[0];
  assert.equal(target.id, 'exp-to-delete-1');

  deleteStoredExpense(target.id);
  const afterDelete = getStoredExpenses();
  const found = afterDelete.find((e) => e.id === target.id);
  assert.equal(found, undefined, 'Deleted expense should not appear in stored list');
});
