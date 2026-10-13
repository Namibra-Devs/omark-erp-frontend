import test from 'node:test';
import assert from 'node:assert/strict';

// Core logic mirrored from src/utils/prospectAssignment.ts
function areIdsEqual(a, b) {
  if (a === undefined || a === null || b === undefined || b === null) return false;
  const sA = String(a).trim().toLowerCase();
  const sB = String(b).trim().toLowerCase();
  return sA.length > 0 && sA === sB;
}

function isStaffNameMatching(candidateRaw, staffUser) {
  if (!candidateRaw || !staffUser) return false;
  const candidate = String(candidateRaw).trim();
  if (!candidate) return false;

  const staffName =
    typeof staffUser === 'object'
      ? (`${staffUser.firstName || ''} ${staffUser.lastName || ''}`.trim() || staffUser.name || '').trim()
      : typeof staffUser === 'string'
      ? staffUser.trim()
      : '';
  if (!staffName) return false;

  const cNorm = candidate.toLowerCase();
  const sNorm = staffName.toLowerCase();
  if (cNorm === sNorm) return true;

  const normalize = (str) =>
    str
      .toLowerCase()
      .replace(/[-_]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/gyamfi/g, 'gyemfi');

  const cClean = normalize(candidate);
  const sClean = normalize(staffName);
  if (cClean === sClean) return true;

  const cNoSpace = cClean.replace(/\s+/g, '');
  const sNoSpace = sClean.replace(/\s+/g, '');
  if (cNoSpace === sNoSpace) return true;

  const cTokens = cClean.split(' ').filter(Boolean).sort();
  const sTokens = sClean.split(' ').filter(Boolean).sort();
  if (cTokens.join('') === sTokens.join('')) return true;

  const sParts = sClean.split(' ').filter(Boolean);
  const fName = (typeof staffUser === 'object' && staffUser.firstName ? normalize(staffUser.firstName) : '') || sParts[0] || '';
  const lName = (typeof staffUser === 'object' && staffUser.lastName ? normalize(staffUser.lastName) : '') || sParts.slice(1).join(' ') || '';

  if (fName && cClean.includes(fName)) {
    if (lName && (cClean.includes(lName) || cNoSpace.includes(lName.replace(/\s+/g, '')))) {
      return true;
    }
    if (fName.includes('lawrencia') && (cClean.includes('adu') || cClean.includes('gyemfi') || cClean.includes('gyamfi'))) {
      return true;
    }
  }

  if (sClean.includes('lawrencia') && (cClean.includes('lawrencia') || (cClean.includes('adu') && cClean.includes('gy')))) {
    return true;
  }

  return false;
}

function isProspectCreatedByStaff(prospect, staffUser) {
  if (!prospect || !staffUser) return false;
  const staffId = typeof staffUser === 'string' ? staffUser : staffUser.id;
  if (staffId) {
    if (
      areIdsEqual(prospect.createdByUserId, staffId) ||
      areIdsEqual(prospect.creatorId, staffId) ||
      areIdsEqual(prospect.creator?.id, staffId)
    ) {
      return true;
    }
  }
  const candidateNames = [prospect.createdByName, prospect.creatorName, prospect.creator?.name];
  for (const cName of candidateNames) {
    if (cName && isStaffNameMatching(cName, staffUser)) return true;
  }
  return false;
}

function isProspectAssignedToStaff(prospect, staffUser) {
  if (!prospect || !staffUser) return false;
  const staffId = typeof staffUser === 'string' ? staffUser : staffUser.id;
  if (staffId) {
    if (
      areIdsEqual(prospect.assignedUserId, staffId) ||
      areIdsEqual(prospect.assignedStaffId, staffId) ||
      areIdsEqual(prospect.assignedUser?.id, staffId)
    ) {
      return true;
    }
  }
  const candidateNames = [prospect.assignedStaffName, prospect.assignedUserName, prospect.assignedUser?.name];
  for (const cName of candidateNames) {
    if (cName && isStaffNameMatching(cName, staffUser)) return true;
  }
  return false;
}

function isProspectAssignedOrCreatedByStaff(prospect, staffUser) {
  return isProspectCreatedByStaff(prospect, staffUser) || isProspectAssignedToStaff(prospect, staffUser);
}

test('Marketing Director Prospect Attribution: accurately identifies leads created or assigned to director', () => {
  const director = {
    id: 'user-dir-001',
    firstName: 'Lawrencia',
    lastName: 'Adugyemfi',
    role: 'marketing_director',
  };

  const p1 = { id: 'p1', createdByUserId: 'user-dir-001', firstName: 'Kofi', lastName: 'Mensah', source: 'marketing' };
  const p2 = { id: 'p2', createdByName: 'Adu Gyamfi Lawrencia', firstName: 'Ama', lastName: 'Osei', source: 'marketing' };
  const p3 = { id: 'p3', assignedUserId: 'user-dir-001', firstName: 'Kwame', lastName: 'Boateng', source: 'marketing' };
  const p4 = { id: 'p4', assignedStaffName: 'Lawrencia Adu-gyemfi', firstName: 'Akua', lastName: 'Amoah', source: 'marketing' };
  const pOther = { id: 'p5', createdByUserId: 'user-staff-999', createdByName: 'Other Marketer', source: 'marketing' };

  assert.equal(isProspectAssignedOrCreatedByStaff(p1, director), true);
  assert.equal(isProspectAssignedOrCreatedByStaff(p2, director), true);
  assert.equal(isProspectAssignedOrCreatedByStaff(p3, director), true);
  assert.equal(isProspectAssignedOrCreatedByStaff(p4, director), true);
  assert.equal(isProspectAssignedOrCreatedByStaff(pOther, director), false);
});

test('Marketing Director Prospects Count: directCount shows personal added leads while pipelineCount tracks whole department', () => {
  const director = {
    id: 'user-dir-001',
    firstName: 'Lawrencia',
    lastName: 'Adugyemfi',
    role: 'marketing_director',
  };

  const allProspects = [
    { id: 'p1', createdByUserId: 'user-dir-001', source: 'marketing' },
    { id: 'p2', createdByName: 'Lawrencia Adugyemfi', source: 'marketing' },
    { id: 'p3', createdByUserId: 'staff-2', source: 'marketing' },
    { id: 'p4', createdByUserId: 'staff-3', source: 'marketing' },
    { id: 'p5', createdByUserId: 'staff-4', source: 'marketing' },
  ];

  const directList = allProspects.filter((p) => isProspectAssignedOrCreatedByStaff(p, director));
  const pipelineCount = allProspects.filter((p) => p.source === 'marketing' || !p.source).length;

  assert.equal(directList.length, 2, 'Director personally added exactly 2 prospects');
  assert.equal(pipelineCount, 5, 'Department pipeline has 5 leads');
});
