// src/utils/expenseRecorderDefaults.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveExpenseRecorderDefaults,
  resolveExpenseUserBranch,
  resolveExpenseUserName,
  formatExpenseRoleLabel,
} from './expenseRecorderDefaults.ts';

const BRANCHES = [
  { id: 'b1', name: 'Kumasi Main', branchCode: 'KMA' },
  { id: 'b2', name: 'Accra Central', branchCode: 'ACC' },
  { id: 'b3', name: 'Takoradi Branch', branchCode: 'TKD' },
];

test('Expense Defaults: matches Marketing Director branch, name, role, and department', () => {
  const user = {
    id: 'usr-dir-1',
    firstName: 'Elizabeth',
    lastName: 'Serwaa',
    email: 'elizabeth.s@omarkrealestate.com',
    role: 'marketing_director',
    branchId: 'b1',
  };

  const defaults = resolveExpenseRecorderDefaults({ user, branches: BRANCHES });

  assert.equal(defaults.userId, 'usr-dir-1');
  assert.equal(defaults.userName, 'Elizabeth Serwaa');
  assert.equal(defaults.role, 'marketing_director');
  assert.equal(defaults.roleLabel, 'Marketing Director');
  assert.equal(defaults.branchId, 'b1');
  assert.equal(defaults.branchName, 'Kumasi Main');
  assert.equal(defaults.department, 'Marketing & Sales');
});

test('Expense Defaults: matches Secretary branch by canonical/branch string when branchId is absent', () => {
  const user = {
    id: 'usr-sec-1',
    firstName: 'Dorothy',
    lastName: 'Fosuaa',
    role: 'secretary',
    branch: 'Accra',
  };

  const defaults = resolveExpenseRecorderDefaults({ user, branches: BRANCHES });

  assert.equal(defaults.userName, 'Dorothy Fosuaa');
  assert.equal(defaults.role, 'secretary');
  assert.equal(defaults.roleLabel, 'Secretary');
  assert.equal(defaults.branchId, 'b2');
  assert.equal(defaults.branchName, 'Accra Central');
  assert.equal(defaults.department, 'Administration');
});

test('Expense Defaults: resolves Admin without assigned branch cleanly to Head Office', () => {
  const adminUser = {
    id: 'usr-admin-1',
    name: 'Samuel Osei',
    role: 'admin',
  };

  const defaults = resolveExpenseRecorderDefaults({ user: adminUser, branches: BRANCHES });

  assert.equal(defaults.userId, 'usr-admin-1');
  assert.equal(defaults.userName, 'Samuel Osei');
  assert.equal(defaults.role, 'admin');
  assert.equal(defaults.roleLabel, 'Administrator');
  assert.equal(defaults.branchId, undefined);
  assert.equal(defaults.branchName, 'Head Office');
  assert.equal(defaults.department, 'Executive Administration');
});

test('Expense Defaults: handles hex ObjectId branchId with matching branch record or storedAssignment name', () => {
  const hexBranchId = '69abc123def4567890123456';
  const liveBranches = [{ id: hexBranchId, name: 'Kumasi Main', branchCode: 'KMA' }];

  const matched = resolveExpenseUserBranch(
    { id: 'u1', branchId: hexBranchId, role: 'branch_manager' },
    liveBranches
  );
  assert.equal(matched.branchId, hexBranchId);
  assert.equal(matched.branchName, 'Kumasi Main');

  // If live branch table hasn't returned hex ID yet, storedAssignment branchName should resolve cleanly (never raw hex)
  const fallback = resolveExpenseUserBranch(
    { id: 'u1', branchId: hexBranchId, role: 'branch_manager' },
    BRANCHES,
    { branchId: hexBranchId, branchName: 'Accra Central' }
  );
  assert.equal(fallback.branchName, 'Accra Central');
});

test('Expense Defaults: resolves branch from roster/manager assignment when user has no branchId property', () => {
  const branchesWithRoster = [
    { id: 'b1', name: 'Kumasi Main', branchCode: 'KMA', staffUserIds: [] },
    { id: 'b3', name: 'Takoradi Branch', branchCode: 'TKD', managerUserId: 'usr-bm-tkd' },
  ];

  const defaults = resolveExpenseRecorderDefaults({
    user: { id: 'usr-bm-tkd', firstName: 'Kwesi', role: 'branch_manager' },
    branches: branchesWithRoster,
  });

  assert.equal(defaults.branchId, 'b3');
  assert.equal(defaults.branchName, 'Takoradi Branch');
  assert.equal(defaults.userName, 'Kwesi');
  assert.equal(defaults.role, 'branch_manager');
  assert.equal(defaults.roleLabel, 'Branch Manager');
  assert.equal(defaults.department, 'Operations');
});

test('Expense Defaults: never produces undefined in userName and formats unknown roles gracefully', () => {
  assert.equal(resolveExpenseUserName({ firstName: 'Abena', lastName: undefined }), 'Abena');
  assert.equal(resolveExpenseUserName({ email: 'staff@omark.com' }), 'staff@omark.com');
  assert.equal(resolveExpenseUserName(null), 'Authorized Staff');
  assert.equal(formatExpenseRoleLabel('accounts'), 'Accounts');
  assert.equal(formatExpenseRoleLabel('custom_auditor'), 'Custom Auditor');
});

