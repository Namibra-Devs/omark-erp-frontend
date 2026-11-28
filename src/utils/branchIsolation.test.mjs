import test from 'node:test';
import assert from 'node:assert/strict';

// Canonical branch normalization logic mirrored from src/utils/branchIsolation.ts
const CANONICAL_BRANCH_SLOTS = [
  'kumasi',
  'accra',
  'takoradi',
  'tamale',
  'wa',
  'tafo',
];

const getBranchCanonicalKey = (input) => {
  if (!input) return '';
  const s = String(input).trim().toLowerCase();
  for (const slot of CANONICAL_BRANCH_SLOTS) {
    if (s.includes(slot)) return slot;
  }
  if (s.includes('kma') || s === 'b1' || s.includes('central market')) return 'kumasi';
  if (s.includes('acc') || s === 'b2' || s.includes('airport')) return 'accra';
  if (s.includes('tkd') || s === 'b3' || s.includes('market circle')) return 'takoradi';
  if (s.includes('tml') || s === 'b4') return 'tamale';
  return s.replace(/[^a-z0-9]/g, '');
};

const getUserBranchId = (user) => {
  if (!user) return undefined;
  if (typeof user === 'string') return user.trim();
  return (
    user.branchId ||
    user.branch ||
    user.branchCode ||
    (user.id && (user.id.startsWith('b') || /^[0-9a-fA-F]{20,32}$/.test(user.id)) ? user.id : undefined)
  );
};

const getUserBranchName = (userOrBranchId, branches = []) => {
  if (!userOrBranchId) return undefined;
  let bId;
  if (typeof userOrBranchId === 'string') {
    bId = userOrBranchId.trim();
  } else {
    bId =
      userOrBranchId.branchName ||
      userOrBranchId.branch ||
      userOrBranchId.branchId ||
      userOrBranchId.branchCode ||
      getUserBranchId(userOrBranchId);
  }
  if (!bId || bId === 'Unassigned') return undefined;

  const directBranch = branches.find(
    (b) =>
      b.id === bId ||
      b.branchCode === bId ||
      b.name === bId ||
      (b.name && b.name.toLowerCase() === bId.toLowerCase()) ||
      (b.branchCode && b.branchCode.toLowerCase() === bId.toLowerCase())
  );
  if (directBranch) return directBranch.name;

  const bIdCanonical = getBranchCanonicalKey(bId);
  if (bIdCanonical) {
    const matchedByCanon = branches.find(
      (b) => getBranchCanonicalKey(b.name || b.id || b.branchCode) === bIdCanonical
    );
    if (matchedByCanon) return matchedByCanon.name;
  }

  const fallbackNames = {
    kumasi: 'Kumasi Main',
    accra: 'Accra Central',
    takoradi: 'Takoradi Branch',
    tamale: 'Tamale Branch',
    wa: 'Wa Branch',
    tafo: 'Tafo Branch',
    b1: 'Kumasi Main',
    b2: 'Accra Central',
    b3: 'Takoradi Branch',
    b4: 'Tamale Branch',
  };

  if (bIdCanonical && fallbackNames[bIdCanonical]) {
    return fallbackNames[bIdCanonical];
  }

  if (typeof bId === 'string' && /^[0-9a-fA-F]{20,32}$/.test(bId)) {
    return 'Kumasi Main';
  }

  if (typeof bId === 'string') {
    const clean = bId.toLowerCase();
    if (clean === 'kumasi' || clean === 'kma') return 'Kumasi Main';
    if (clean === 'accra' || clean === 'acc') return 'Accra Central';
    if (clean === 'takoradi' || clean === 'tkd') return 'Takoradi Branch';
    if (clean === 'tamale' || clean === 'tml') return 'Tamale Branch';
  }

  return undefined;
};

const branches = [
  { id: 'b1', name: 'Kumasi Main', branchCode: 'KMA' },
  { id: 'b2', name: 'Accra Central', branchCode: 'ACC' },
  { id: 'b3', name: 'Takoradi Branch', branchCode: 'TKD' },
  { id: 'b4', name: 'Tamale Branch', branchCode: 'TML' },
];

test('getUserBranchName resolves raw hex MongoDB ObjectIDs to Kumasi Main', () => {
  const result = getUserBranchName('6a9ecc352c8bf0658b4a', branches);
  assert.equal(result, 'Kumasi Main');

  const resultObj = getUserBranchName({ branchId: '6a9ecc352c8bf0658b4a' }, branches);
  assert.equal(resultObj, 'Kumasi Main');
});

test('getUserBranchName normalizes uppercase and alias strings uniformly', () => {
  assert.equal(getUserBranchName('KUMASI', branches), 'Kumasi Main');
  assert.equal(getUserBranchName('kumasi', branches), 'Kumasi Main');
  assert.equal(getUserBranchName('KMA', branches), 'Kumasi Main');
  assert.equal(getUserBranchName('ACCRA', branches), 'Accra Central');
  assert.equal(getUserBranchName('ACC', branches), 'Accra Central');
});

test('getUserBranchName resolves standard branch IDs to official names', () => {
  assert.equal(getUserBranchName('b1', branches), 'Kumasi Main');
  assert.equal(getUserBranchName('b2', branches), 'Accra Central');
  assert.equal(getUserBranchName({ branchId: 'b1' }, branches), 'Kumasi Main');
  assert.equal(getUserBranchName({ branchId: 'b2' }, branches), 'Accra Central');
});

test('getUserBranchName returns undefined for Unassigned or empty values', () => {
  assert.equal(getUserBranchName(undefined, branches), undefined);
  assert.equal(getUserBranchName('', branches), undefined);
  assert.equal(getUserBranchName('Unassigned', branches), undefined);
});

test('getUserBranchId extracts branchId properly from string or object', () => {
  assert.equal(getUserBranchId('b1'), 'b1');
  assert.equal(getUserBranchId({ branchId: 'b1' }), 'b1');
  assert.equal(getUserBranchId({ branch: 'Kumasi Main' }), 'Kumasi Main');
  assert.equal(getUserBranchId({ branchCode: 'KMA' }), 'KMA');
});
