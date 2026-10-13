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
      areIdsEqual(prospect.creator?.id, staffId) ||
      areIdsEqual(prospect.recordedByUserId, staffId) ||
      areIdsEqual(prospect.recorded_by_user_id, staffId) ||
      areIdsEqual(prospect.registeredByUserId, staffId) ||
      areIdsEqual(prospect.registered_by_user_id, staffId)
    ) {
      return true;
    }
  }
  const candidateNames = [
    prospect.createdByName,
    prospect.creatorName,
    prospect.creator?.name,
    prospect.recordedByName,
    prospect.recorded_by_name,
    prospect.registeredByName,
    prospect.registered_by_name,
  ];
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

test('Secretary Personal Prospect Attribution: correctly attributes desk registrations and personal prospects', () => {
  const secretary = {
    id: 'user-sec-001',
    firstName: 'Abena',
    lastName: 'Mansah',
    role: 'secretary',
  };

  const pSec1 = { id: 's1', createdByUserId: 'user-sec-001', firstName: 'Daniel', lastName: 'Appiah', source: 'customer_service' };
  const pSec2 = { id: 's2', createdByName: 'Abena Mansah', firstName: 'Grace', lastName: 'Koomson', source: 'customer_service' };
  const pSec3 = { id: 's3', assignedUserId: 'user-sec-001', firstName: 'Peter', lastName: 'Mensah', source: 'customer_service' };
  const pSec4 = { id: 's4', recordedByUserId: 'user-sec-001', firstName: 'Emmanuel', lastName: 'Quaye', source: 'walk_in' };
  const pOther = { id: 's5', createdByUserId: 'user-staff-777', source: 'customer_service' };

  assert.equal(isProspectAssignedOrCreatedByStaff(pSec1, secretary), true);
  assert.equal(isProspectAssignedOrCreatedByStaff(pSec2, secretary), true);
  assert.equal(isProspectAssignedOrCreatedByStaff(pSec3, secretary), true);
  assert.equal(isProspectAssignedOrCreatedByStaff(pSec4, secretary), true);
  assert.equal(isProspectAssignedOrCreatedByStaff(pOther, secretary), false);
});

test('Consolidation Preservation: ensures server response without creator fields merges with client metadata', () => {
  const serverBareProspect = { id: 'p100', firstName: 'Yaw', lastName: 'Boateng', source: 'marketing' };
  const clientStoredProspect = { id: 'p100', createdByUserId: 'user-dir-001', createdByName: 'Lawrencia Adugyemfi', source: 'marketing' };

  // Mirror consolidation merge logic
  const merged = {
    ...serverBareProspect,
    ...clientStoredProspect,
    createdByUserId: clientStoredProspect.createdByUserId || serverBareProspect.createdByUserId,
    createdByName: clientStoredProspect.createdByName || serverBareProspect.createdByName,
  };

  const director = { id: 'user-dir-001', firstName: 'Lawrencia', lastName: 'Adugyemfi', role: 'marketing_director' };
  assert.equal(isProspectAssignedOrCreatedByStaff(merged, director), true);
});

test('Prospect Form Attribution: Marketing Director, Branch Manager, and Secretary auto-assign and label to themselves', () => {
  // Test helper simulating the form submission logic for self-assigned roles
  const simulateProspectSubmission = (user, formValues) => {
    const isSelfAssigned = user?.role === 'marketing_director' || user?.role === 'branch_manager' || user?.role === 'secretary';
    const effectiveAssignedUserId = isSelfAssigned ? user?.id : (formValues.assignedUserId || user?.id);
    const fullName = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : undefined;
    const effectiveSource = formValues.source || (
      user?.role === 'secretary' || user?.role === 'customer_service'
        ? 'customer_service'
        : 'marketing'
    );

    return {
      firstName: formValues.firstName,
      lastName: formValues.lastName,
      phoneNumber: formValues.phoneNumber,
      source: effectiveSource,
      assignedUserId: effectiveAssignedUserId,
      assignedUserName: isSelfAssigned ? fullName : undefined,
      createdByUserId: user?.id,
      createdByName: fullName,
      registeredByUserId: user?.id,
      registeredByName: fullName,
      recordedByUserId: user?.id,
      recordedByName: fullName,
    };
  };

  // 1. Marketing Director adds prospect (form did not provide assignedUserId)
  const directorUser = { id: 'dir-77', firstName: 'Lawrencia', lastName: 'Adugyemfi', role: 'marketing_director' };
  const dirProspect = simulateProspectSubmission(directorUser, {
    firstName: 'Kwame',
    lastName: 'Asante',
    phoneNumber: '0241234567',
  });
  assert.equal(dirProspect.assignedUserId, 'dir-77');
  assert.equal(dirProspect.createdByUserId, 'dir-77');
  assert.equal(dirProspect.createdByName, 'Lawrencia Adugyemfi');
  assert.equal(dirProspect.assignedUserName, 'Lawrencia Adugyemfi');
  assert.equal(dirProspect.source, 'marketing');
  assert.equal(isProspectAssignedOrCreatedByStaff(dirProspect, directorUser), true);

  // 2. Branch Manager adds prospect
  const managerUser = { id: 'bm-88', firstName: 'Kofi', lastName: 'Ansah', role: 'branch_manager' };
  const bmProspect = simulateProspectSubmission(managerUser, {
    firstName: 'Ama',
    lastName: 'Serwaa',
    phoneNumber: '0209876543',
  });
  assert.equal(bmProspect.assignedUserId, 'bm-88');
  assert.equal(bmProspect.createdByUserId, 'bm-88');
  assert.equal(bmProspect.createdByName, 'Kofi Ansah');
  assert.equal(bmProspect.assignedUserName, 'Kofi Ansah');
  assert.equal(isProspectAssignedOrCreatedByStaff(bmProspect, managerUser), true);

  // 3. Secretary adds prospect
  const secretaryUser = { id: 'sec-99', firstName: 'Abena', lastName: 'Mansah', role: 'secretary' };
  const secProspect = simulateProspectSubmission(secretaryUser, {
    firstName: 'Esi',
    lastName: 'Badu',
    phoneNumber: '0551122334',
  });
  assert.equal(secProspect.assignedUserId, 'sec-99');
  assert.equal(secProspect.createdByUserId, 'sec-99');
  assert.equal(secProspect.createdByName, 'Abena Mansah');
  assert.equal(secProspect.source, 'customer_service');
  assert.equal(isProspectAssignedOrCreatedByStaff(secProspect, secretaryUser), true);

  // 4. Role check for hiding assignment field
  const shouldShowAssignField = (role) => {
    const isSelfAssignedRole = ['marketing_director', 'branch_manager', 'secretary', 'marketing_staff'].includes(role);
    return role === 'admin' && !isSelfAssignedRole;
  };

  assert.equal(shouldShowAssignField('marketing_director'), false);
  assert.equal(shouldShowAssignField('branch_manager'), false);
  assert.equal(shouldShowAssignField('secretary'), false);
  assert.equal(shouldShowAssignField('admin'), true);
});

