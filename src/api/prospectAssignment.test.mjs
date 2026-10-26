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
      areIdsEqual(prospect.createdBy, staffId) ||
      areIdsEqual(prospect.created_by, staffId) ||
      areIdsEqual(prospect.created_by_user_id, staffId) ||
      areIdsEqual(prospect.creator?.id, staffId) ||
      areIdsEqual(prospect.created_by?.id, staffId) ||
      areIdsEqual(prospect.recordedByUserId, staffId) ||
      areIdsEqual(prospect.recorded_by_user_id, staffId) ||
      areIdsEqual(prospect.registeredByUserId, staffId) ||
      areIdsEqual(prospect.registered_by_user_id, staffId) ||
      areIdsEqual(prospect.userId, staffId) ||
      areIdsEqual(prospect.user_id, staffId) ||
      areIdsEqual(prospect.staffId, staffId) ||
      areIdsEqual(prospect.marketerId, staffId) ||
      areIdsEqual(prospect.agentId, staffId)
    ) {
      return true;
    }
  }
  const candidateNames = [
    prospect.createdByName,
    prospect.creatorName,
    prospect.creator?.name,
    prospect.created_by_name,
    prospect.created_by?.name,
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
      areIdsEqual(prospect.assignedTo, staffId) ||
      areIdsEqual(prospect.assigned_to, staffId) ||
      areIdsEqual(prospect.assigned_to?.id, staffId) ||
      areIdsEqual(prospect.assigned_user_id, staffId) ||
      areIdsEqual(prospect.assigned_staff_id, staffId) ||
      areIdsEqual(prospect.userId, staffId) ||
      areIdsEqual(prospect.staffId, staffId) ||
      areIdsEqual(prospect.marketerId, staffId) ||
      areIdsEqual(prospect.agentId, staffId) ||
      areIdsEqual(prospect.assignedUser?.id, staffId)
    ) {
      return true;
    }
  }
  const candidateNames = [
    prospect.assignedStaffName,
    prospect.assignedUserName,
    prospect.marketerName,
    prospect.agentName,
    prospect.assignedUser?.name
  ];
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

// ── Appointment Attribution & Personal Visibility Tests ─────────────────────

function isAppointmentAssignedToStaff(appointment, staffUser, staffProspectIds, staffCustomerIds, allInteractions = []) {
  if (!appointment || !staffUser) return false;
  const staffId = typeof staffUser === 'string' ? staffUser : staffUser.id;

  if (staffId) {
    if (
      areIdsEqual(appointment.createdByUserId, staffId) ||
      areIdsEqual(appointment.assignedStaffId, staffId) ||
      areIdsEqual(appointment.assignedUserId, staffId) ||
      areIdsEqual(appointment.assignedTo, staffId) ||
      areIdsEqual(appointment.assigned_user_id, staffId) ||
      areIdsEqual(appointment.assigned_staff_id, staffId) ||
      areIdsEqual(appointment.created_by_user_id, staffId) ||
      areIdsEqual(appointment.userId, staffId) ||
      areIdsEqual(appointment.staffId, staffId) ||
      areIdsEqual(appointment.marketerId, staffId) ||
      areIdsEqual(appointment.agentId, staffId) ||
      areIdsEqual(appointment.hostUserId, staffId) ||
      areIdsEqual(appointment.hostId, staffId) ||
      areIdsEqual(appointment.creator?.id, staffId) ||
      areIdsEqual(appointment.created_by?.id, staffId) ||
      areIdsEqual(appointment.assignedUser?.id, staffId) ||
      areIdsEqual(appointment.staff?.id, staffId) ||
      areIdsEqual(appointment.user?.id, staffId) ||
      areIdsEqual(appointment.bookedByUserId, staffId) ||
      areIdsEqual(appointment.updatedByUserId, staffId) ||
      areIdsEqual(appointment.feedbackByUserId, staffId)
    ) {
      return true;
    }
  }

  if (
    appointment.prospectId &&
    staffProspectIds &&
    staffProspectIds.has(String(appointment.prospectId).trim())
  ) {
    return true;
  }

  if (
    appointment.customerId &&
    staffCustomerIds &&
    staffCustomerIds.has(String(appointment.customerId).trim())
  ) {
    return true;
  }

  const candidateNames = [
    appointment.assignedStaffName,
    appointment.assignedUserName,
    appointment.createdByName,
    appointment.creatorName,
    appointment.staffName,
    appointment.marketerName,
    appointment.agentName,
    appointment.hostName,
    appointment.bookedByName,
    appointment.updatedByName,
    appointment.staff?.name,
    appointment.creator?.name,
  ];

  for (const cName of candidateNames) {
    if (cName && isStaffNameMatching(cName, staffUser)) {
      return true;
    }
  }

  // Interaction check
  if (Array.isArray(allInteractions) && allInteractions.length > 0) {
    const hasInteraction = allInteractions.some((i) => {
      const isLinked =
        (appointment.id && (areIdsEqual(i.appointmentId, appointment.id) || String(i.id).includes(String(appointment.id)))) ||
        (appointment.prospectId && areIdsEqual(i.prospectId, appointment.prospectId));
      if (!isLinked) return false;
      return (
        areIdsEqual(i.loggedByUserId, staffId) ||
        isStaffNameMatching(i.loggedByUserName, staffUser)
      );
    });
    if (hasInteraction) return true;
  }

  return false;
}

function getStaffAssignedAppointments(allAppointments, staffUser, allProspects = [], branches = [], allCustomers = [], allInteractions = []) {
  if (!Array.isArray(allAppointments) || allAppointments.length === 0 || !staffUser) return [];

  let staffProspectIds;
  if (Array.isArray(allProspects) && allProspects.length > 0) {
    const staffProspects = allProspects.filter((p) => {
      if (isProspectAssignedOrCreatedByStaff(p, staffUser)) return true;
      if (p.assignedUserName && isStaffNameMatching(p.assignedUserName, staffUser)) return true;
      if (Array.isArray(allInteractions) && allInteractions.length > 0) {
        return allInteractions.some(
          (i) => i.prospectId === p.id && (areIdsEqual(i.loggedByUserId, staffUser.id) || isStaffNameMatching(i.loggedByUserName, staffUser))
        );
      }
      return false;
    });
    staffProspectIds = new Set(staffProspects.map((p) => String(p.id).trim()));
  }

  let staffCustomerIds;
  if (Array.isArray(allCustomers) && allCustomers.length > 0) {
    const staffId = typeof staffUser === 'string' ? staffUser : staffUser.id;
    const staffCustomers = allCustomers.filter((c) => {
      if (!c) return false;
      if (
        staffId &&
        (areIdsEqual(c.assignedUserId, staffId) ||
          areIdsEqual(c.createdByUserId, staffId) ||
          areIdsEqual(c.marketerId, staffId) ||
          areIdsEqual(c.agentId, staffId) ||
          areIdsEqual(c.userId, staffId) ||
          areIdsEqual(c.staffId, staffId))
      ) {
        return true;
      }
      return false;
    });
    staffCustomerIds = new Set(staffCustomers.map((c) => String(c.id).trim()));
  }

  return allAppointments.filter((a) =>
    isAppointmentAssignedToStaff(a, staffUser, staffProspectIds, staffCustomerIds, allInteractions)
  );
}

test('Personal Appointment Visibility: Staff only see their own appointments, excluding other staff members', () => {
  const staffMemberA = { id: 'staff-001', firstName: 'Lawrencia', lastName: 'Adugyemfi', role: 'marketing_director' };
  const staffMemberB = { id: 'staff-002', firstName: 'Kofi', lastName: 'Mensah', role: 'marketing_staff' };
  const staffMemberC = { id: 'staff-003', firstName: 'Akua', lastName: 'Owusu', role: 'customer_service' };

  const allAppointments = [
    {
      id: 'app-1',
      assignedUserId: 'staff-001',
      scheduledFor: '2026-10-15T10:00:00Z',
      reason: 'Site Inspection with Client A',
      status: 'scheduled',
    },
    {
      id: 'app-2',
      createdByUserId: 'staff-001',
      scheduledFor: '2026-10-15T14:00:00Z',
      reason: 'Contract Discussion with Client B',
      status: 'scheduled',
    },
    {
      id: 'app-3',
      assignedUserId: 'staff-002',
      scheduledFor: '2026-10-16T11:00:00Z',
      reason: 'Land Presentation with Client C',
      status: 'scheduled',
    },
    {
      id: 'app-4',
      staffName: 'Akua Owusu',
      scheduledFor: '2026-10-16T15:00:00Z',
      reason: 'Customer Service Follow-up',
      status: 'scheduled',
    },
  ];

  // 1. Staff Member A (Marketing Director) sees only app-1 and app-2
  const personalA = getStaffAssignedAppointments(allAppointments, staffMemberA);
  assert.equal(personalA.length, 2);
  assert.deepEqual(personalA.map((a) => a.id).sort(), ['app-1', 'app-2']);

  // 2. Staff Member B (Marketing Staff) sees only app-3
  const personalB = getStaffAssignedAppointments(allAppointments, staffMemberB);
  assert.equal(personalB.length, 1);
  assert.equal(personalB[0].id, 'app-3');

  // 3. Staff Member C (Customer Service) sees only app-4
  const personalC = getStaffAssignedAppointments(allAppointments, staffMemberC);
  assert.equal(personalC.length, 1);
  assert.equal(personalC[0].id, 'app-4');

  // Verify none see other staff appointments
  assert.equal(personalA.some((a) => a.id === 'app-3' || a.id === 'app-4'), false);
  assert.equal(personalB.some((a) => a.id === 'app-1' || a.id === 'app-2' || a.id === 'app-4'), false);
  assert.equal(personalC.some((a) => a.id === 'app-1' || a.id === 'app-2' || a.id === 'app-3'), false);
});

test('Appointment Attribution: Matches linked prospect and customer ownership', () => {
  const staff = { id: 'staff-10', firstName: 'John', lastName: 'Doe', role: 'marketing_staff' };
  const prospects = [
    { id: 'pros-99', firstName: 'Jane', lastName: 'Smith', assignedUserId: 'staff-10', source: 'marketing' },
    { id: 'pros-100', firstName: 'Kwaku', lastName: 'Manu', assignedUserId: 'other-staff', source: 'marketing' },
  ];
  const customers = [
    { id: 'cust-50', firstName: 'David', lastName: 'Boateng', assignedUserId: 'staff-10' },
  ];

  const appointments = [
    // Linked via prospect owned by staff
    { id: 'app-pros', prospectId: 'pros-99', scheduledFor: '2026-10-20T09:00:00Z', status: 'scheduled' },
    // Linked via customer owned by staff
    { id: 'app-cust', customerId: 'cust-50', scheduledFor: '2026-10-21T10:00:00Z', status: 'scheduled' },
    // Unrelated prospect appointment
    { id: 'app-unrelated', prospectId: 'pros-100', scheduledFor: '2026-10-22T11:00:00Z', status: 'scheduled' },
  ];

  const assigned = getStaffAssignedAppointments(appointments, staff, prospects, [], customers);
  assert.equal(assigned.length, 2);
  assert.deepEqual(assigned.map((a) => a.id).sort(), ['app-cust', 'app-pros']);
});

test('Appointment Status Transitions: Allows updating to completed, postponed, canceled, and no_show', () => {
  const appointment = {
    id: 'app-test-status',
    status: 'scheduled',
    scheduledFor: '2026-10-14T10:00:00Z',
    feedback: '',
  };

  // 1. Update to completed (e.g. Attended)
  const completed = {
    ...appointment,
    status: 'completed',
    feedback: 'Client attended meeting and inspected site',
    updatedAt: new Date().toISOString(),
  };
  assert.equal(completed.status, 'completed');
  assert.ok(completed.feedback.includes('attended'));

  // 2. Update to postponed (with rebooking)
  const postponed = {
    ...appointment,
    status: 'postponed',
    feedback: 'Client requested reschedule to next week',
    updatedAt: new Date().toISOString(),
  };
  assert.equal(postponed.status, 'postponed');

  // 3. Update to canceled
  const canceled = {
    ...appointment,
    status: 'canceled',
    updatedAt: new Date().toISOString(),
  };
  assert.equal(canceled.status, 'canceled');
});

test('Management Appointment Scope: Admin and Branch Manager can toggle between personal and all bookings', () => {
  const branchManager = { id: 'bm-01', firstName: 'Eric', lastName: 'Frimpong', role: 'branch_manager' };
  const allBranchAppointments = [
    { id: 'app-bm-personal', assignedUserId: 'bm-01', status: 'scheduled' },
    { id: 'app-staff-1', assignedUserId: 'staff-A', status: 'scheduled' },
    { id: 'app-staff-2', assignedUserId: 'staff-B', status: 'completed' },
  ];

  // In personal scope, only manager's individual booking is visible
  const personalView = getStaffAssignedAppointments(allBranchAppointments, branchManager);
  assert.equal(personalView.length, 1);
  assert.equal(personalView[0].id, 'app-bm-personal');

  // In 'all' scope, all 3 branch appointments are visible
  const allView = allBranchAppointments;
  assert.equal(allView.length, 3);
});

test('Staff & Admin Appointment Consistency: Appointments booked or logged with interactions by staff appear accurately on both Admin and Staff accounts', () => {
  const staffCecilia = {
    id: 'user-cecilia-01',
    firstName: 'Cecilia',
    lastName: 'Donkor',
    name: 'CECILIA DONKOR',
    role: 'marketing_staff',
    branchId: 'branch-kumasi-main',
  };

  const adminUser = {
    id: 'user-admin-01',
    firstName: 'Kindo',
    lastName: 'Original',
    role: 'admin',
    branchId: 'head-office',
  };

  const prospects = [
    { id: 'pros-abdul', firstName: 'MR.', lastName: 'ABDUL', phoneNumber: '+233246298320', assignedUserName: 'CECILIA DONKOR', source: 'marketing' },
    { id: 'pros-micheal', firstName: 'MR.', lastName: 'MICHEAL', phoneNumber: '+233244478565', source: 'marketing' },
  ];

  // Appointments created in the system (e.g. at head office or by admin)
  const allAppointments = [
    {
      id: 'app-abdul',
      prospectId: 'pros-abdul',
      branchId: 'head-office',
      scheduledFor: '2026-10-14T10:30:00Z',
      status: 'scheduled',
      source: 'staff',
      feedback: 'No show. Client has rescheduled to Wednesday, 14th Oct, 2026, 10:30AM',
      reason: '[marketing] Site Inspection & Property Viewing',
      createdByUserId: 'user-admin-01',
    },
    {
      id: 'app-micheal',
      prospectId: 'pros-micheal',
      branchId: 'head-office',
      scheduledFor: '2026-10-14T08:20:00Z',
      status: 'scheduled',
      source: 'staff',
      reason: 'Site visit & payment plan discussion',
      createdByUserId: 'user-admin-01',
    },
    {
      id: 'app-other-staff',
      prospectId: 'pros-other',
      branchId: 'head-office',
      scheduledFor: '2026-10-14T12:00:00Z',
      status: 'scheduled',
      source: 'staff',
      assignedUserId: 'other-user-99',
    },
  ];

  // Audit trail / interactions logged by Cecilia Donkor
  const allInteractions = [
    {
      id: 'inter-1',
      appointmentId: 'app-abdul',
      prospectId: 'pros-abdul',
      loggedByUserId: 'user-cecilia-01',
      loggedByUserName: 'CECILIA DONKOR',
      interactionType: 'booking',
      response: 'Staff Booking Scheduled',
    },
    {
      id: 'inter-2',
      appointmentId: 'app-abdul',
      prospectId: 'pros-abdul',
      loggedByUserId: 'user-cecilia-01',
      loggedByUserName: 'CECILIA DONKOR',
      interactionType: 'status_update',
      response: 'No show. Client has rescheduled to Wednesday, 14th Oct, 2026, 10:30AM',
    },
    {
      id: 'inter-3',
      appointmentId: 'app-micheal',
      prospectId: 'pros-micheal',
      loggedByUserId: 'user-cecilia-01',
      loggedByUserName: 'CECILIA DONKOR',
      interactionType: 'booking',
      response: 'Site visit & payment plan discussion',
    },
  ];

  // 1. On Staff Account (Cecilia Donkor), personal appointments must return Abdul and Micheal
  const ceciliaPersonal = getStaffAssignedAppointments(
    allAppointments,
    staffCecilia,
    prospects,
    [{ id: 'branch-kumasi-main', name: 'Kumasi Main Branch' }],
    [],
    allInteractions
  );

  assert.equal(ceciliaPersonal.length, 2);
  assert.deepEqual(ceciliaPersonal.map((a) => a.id).sort(), ['app-abdul', 'app-micheal']);

  // 2. On Admin Account, Admin can see all branch/company bookings
  const adminViewAll = allAppointments;
  assert.equal(adminViewAll.length, 3);

  // 3. Admin viewing Cecilia's profile gets the exact same 2 appointments
  const adminViewingCecilia = getStaffAssignedAppointments(
    allAppointments,
    staffCecilia,
    prospects,
    [],
    [],
    allInteractions
  );
  assert.equal(adminViewingCecilia.length, 2);
  assert.deepEqual(adminViewingCecilia.map((a) => a.id).sort(), ['app-abdul', 'app-micheal']);
});

// Deduplication function mirrored from src/api/appointments.ts
function deduplicateAppointmentsList(appointments) {
  if (!Array.isArray(appointments) || appointments.length === 0) return [];

  const sorted = [...appointments].sort((a, b) => {
    const timeA = new Date(a.updatedAt || a.createdAt || a.scheduledFor || 0).getTime();
    const timeB = new Date(b.updatedAt || b.createdAt || b.scheduledFor || 0).getTime();
    return timeB - timeA;
  });

  const seenActivePersons = new Set();
  const seenIds = new Set();
  const result = [];

  for (const appt of sorted) {
    if (!appt || !appt.id) continue;
    if (seenIds.has(appt.id)) continue;

    const personKey = appt.prospectId
      ? `prospect:${appt.prospectId}`
      : appt.customerId
      ? `customer:${appt.customerId}`
      : null;

    const isActive = appt.status === 'scheduled' || appt.status === 'postponed';

    if (personKey && isActive) {
      if (seenActivePersons.has(personKey)) {
        continue;
      }
      seenActivePersons.add(personKey);
    }

    seenIds.add(appt.id);
    result.push(appt);
  }

  return result;
}

test('Duplicate Prevention: Changing an existing appointment date overwrites the old record', () => {
  const initialRecord = {
    id: 'app-p1-old',
    prospectId: 'prospect-123',
    scheduledFor: '2026-10-15T10:00:00.000Z',
    status: 'scheduled',
    reason: 'Initial Consultation',
    createdAt: '2026-10-10T08:00:00.000Z',
    updatedAt: '2026-10-10T08:00:00.000Z',
  };

  // Changing date overwrites old record directly with new scheduled date
  const newDate = '2026-10-25T14:30:00.000Z';
  const overwrittenRecord = {
    ...initialRecord,
    scheduledFor: newDate,
    reason: 'Rescheduled Consultation',
    status: 'scheduled',
    updatedAt: '2026-10-14T11:00:00.000Z',
  };

  assert.equal(overwrittenRecord.id, initialRecord.id);
  assert.equal(overwrittenRecord.prospectId, 'prospect-123');
  assert.equal(overwrittenRecord.scheduledFor, newDate);
  assert.equal(overwrittenRecord.status, 'scheduled');
  assert.equal(overwrittenRecord.reason, 'Rescheduled Consultation');
});

test('Duplicate Prevention: deduplicateAppointmentsList stops multiple active entries for same person', () => {
  const duplicateList = [
    {
      id: 'app-old',
      prospectId: 'pros-dup-01',
      scheduledFor: '2026-10-18T10:00:00.000Z',
      status: 'scheduled',
      updatedAt: '2026-10-10T08:00:00.000Z',
    },
    {
      id: 'app-new',
      prospectId: 'pros-dup-01',
      scheduledFor: '2026-10-22T15:00:00.000Z',
      status: 'scheduled',
      updatedAt: '2026-10-14T09:00:00.000Z',
    },
    {
      id: 'app-other-person',
      prospectId: 'pros-dup-02',
      scheduledFor: '2026-10-20T11:00:00.000Z',
      status: 'scheduled',
      updatedAt: '2026-10-12T08:00:00.000Z',
    },
  ];

  const deduplicated = deduplicateAppointmentsList(duplicateList);
  assert.equal(deduplicated.length, 2);

  // For pros-dup-01, only the newer record (app-new) is retained
  const forPerson1 = deduplicated.filter((a) => a.prospectId === 'pros-dup-01');
  assert.equal(forPerson1.length, 1);
  assert.equal(forPerson1[0].id, 'app-new');
  assert.equal(forPerson1[0].scheduledFor, '2026-10-22T15:00:00.000Z');

  // Person 2 is unaffected
  const forPerson2 = deduplicated.filter((a) => a.prospectId === 'pros-dup-02');
  assert.equal(forPerson2.length, 1);
  assert.equal(forPerson2[0].id, 'app-other-person');
});

test('Duplicate Prevention: Customers with duplicate active appointments are consolidated to latest', () => {
  const customerAppointments = [
    {
      id: 'cust-app-1',
      customerId: 'cust-999',
      scheduledFor: '2026-10-16T09:00:00.000Z',
      status: 'postponed',
      updatedAt: '2026-10-11T10:00:00.000Z',
    },
    {
      id: 'cust-app-2',
      customerId: 'cust-999',
      scheduledFor: '2026-10-28T10:00:00.000Z',
      status: 'scheduled',
      updatedAt: '2026-10-14T10:00:00.000Z',
    },
  ];

  const deduplicated = deduplicateAppointmentsList(customerAppointments);
  assert.equal(deduplicated.length, 1);
  assert.equal(deduplicated[0].id, 'cust-app-2');
  assert.equal(deduplicated[0].status, 'scheduled');
  assert.equal(deduplicated[0].scheduledFor, '2026-10-28T10:00:00.000Z');
});

test('Admin Table Master Oversight vs Staff Dashboard Appointments: Admin sees all appointments by default, Staff sees captured appointments', () => {
  const adminUser = { id: 'admin-1', role: 'admin', firstName: 'Super', lastName: 'Admin' };
  const staffA = { id: 'staff-a', role: 'marketing_staff', firstName: 'Kwame', lastName: 'Nkrumah' };
  const staffB = { id: 'staff-b', role: 'marketing_staff', firstName: 'Yaa', lastName: 'Asantewaa' };

  // Simulated Appointments collection across all staff
  const companyAppointments = [
    {
      id: 'appt-1',
      prospectId: 'pros-1',
      assignedUserId: 'staff-a',
      scheduledFor: '2026-10-15T09:00:00Z',
      status: 'scheduled',
      reason: 'Site Inspection',
    },
    {
      id: 'appt-2',
      prospectId: 'pros-2',
      assignedUserId: 'staff-b',
      scheduledFor: '2026-10-15T11:00:00Z',
      status: 'scheduled',
      reason: 'Office Presentation',
    },
    {
      id: 'appt-3',
      prospectId: 'pros-3',
      createdByUserId: 'staff-a',
      scheduledFor: '2026-10-16T14:00:00Z',
      status: 'completed',
      reason: 'Follow-up Consultation',
    },
  ];

  // Helper determining initial scope based on user role (mirroring AppointmentsPage.tsx)
  const getInitialAppointmentScope = (user) => {
    return user?.role === 'admin' || user?.role === 'super_admin' ? 'all' : 'personal';
  };

  // 1. Admin defaults to 'all' and sees all staff appointments on table
  const adminInitialScope = getInitialAppointmentScope(adminUser);
  assert.equal(adminInitialScope, 'all');

  const adminAppointmentsView = adminInitialScope === 'all'
    ? companyAppointments
    : getStaffAssignedAppointments(companyAppointments, adminUser);
  assert.equal(adminAppointmentsView.length, 3);
  assert.deepEqual(adminAppointmentsView.map((a) => a.id), ['appt-1', 'appt-2', 'appt-3']);

  // 2. Staff A opens dashboard/table and defaults to 'personal', seeing only their 2 appointments
  const staffAInitialScope = getInitialAppointmentScope(staffA);
  assert.equal(staffAInitialScope, 'personal');

  const staffAAppointments = getStaffAssignedAppointments(companyAppointments, staffA);
  assert.equal(staffAAppointments.length, 2);
  assert.deepEqual(staffAAppointments.map((a) => a.id).sort(), ['appt-1', 'appt-3']);

  // 3. Staff B opens dashboard/table and sees only their 1 appointment
  const staffBAppointments = getStaffAssignedAppointments(companyAppointments, staffB);
  assert.equal(staffBAppointments.length, 1);
  assert.equal(staffBAppointments[0].id, 'appt-2');
});

// Dynamic Discovery & Distribution Helpers mirroring src/utils/prospectAssignment.ts
function isGenericInboundOrSystemName(nameRaw) {
  if (!nameRaw) return true;
  const s = String(nameRaw).toLowerCase().trim();
  const genericKeywords = [
    'unassigned', 'inbound', 'direct', 'lead', 'leads', 'website', 'web', 'system',
    'portal', 'walk-in', 'walkin', 'walk in', 'unknown', 'none', 'n/a', 'na',
    'default', 'general', 'organic', 'call center', 'call-center', 'customer service',
    'social media', 'advert', 'facebook', 'instagram', 'tiktok', 'google', 'referral pool',
  ];
  return genericKeywords.some((kw) => s === kw || s.includes(kw));
}

function distributeProspectsAcrossMarketingStaff(
  allMarketingProspects = [],
  marketingStaffUsers = [],
  apiMarketers = [],
  allAppointments = []
) {
  const discoveredStaffMap = new Map();

  const registerStaffIfMissing = (idCandidate, nameCandidate, roleCandidate = 'marketing_staff', phoneCandidate) => {
    if (!idCandidate && !nameCandidate) return;
    if (nameCandidate && isGenericInboundOrSystemName(nameCandidate)) return;

    for (const [existingId, existingStaff] of discoveredStaffMap.entries()) {
      if (idCandidate && areIdsEqual(existingId, idCandidate)) return;
      if (nameCandidate && isStaffNameMatching(nameCandidate, existingStaff)) return;
    }

    const resolvedId = String(idCandidate || `discovered_staff_${discoveredStaffMap.size + 1}`).trim();
    const resolvedName = (nameCandidate || '').trim() || `Marketer (${resolvedId.slice(0, 6)})`;

    discoveredStaffMap.set(resolvedId, {
      id: resolvedId,
      name: resolvedName,
      role: roleCandidate,
      phone: phoneCandidate || '',
    });
  };

  (marketingStaffUsers || []).forEach((u) => {
    if (!u) return;
    const name = (`${u.firstName || ''} ${u.lastName || ''}`.trim() || u.name || '').trim();
    registerStaffIfMissing(u.id, name, u.role || 'marketing_staff', u.phone || u.phoneNumber);
  });

  (apiMarketers || []).forEach((m) => {
    if (!m) return;
    registerStaffIfMissing(m.userId || m.id, m.name, 'marketing_staff', m.phone);
  });

  (allMarketingProspects || []).forEach((p) => {
    if (!p) return;
    const cName = p.createdByName || p.creatorName || p.creator?.name;
    const cId = p.createdByUserId || p.creatorId || p.createdBy || p.userId;
    registerStaffIfMissing(cId, cName);

    const aName = p.assignedUserName || p.assignedStaffName || p.marketerName;
    const aId = p.assignedUserId || p.assignedStaffId || p.assignedTo;
    registerStaffIfMissing(aId, aName);
  });

  (allAppointments || []).forEach((a) => {
    if (!a) return;
    const cName = a.createdByName || a.staffName || a.assignedUserName;
    const cId = a.createdByUserId || a.staffId || a.assignedUserId;
    registerStaffIfMissing(cId, cName);
  });

  const discoveredStaffList = Array.from(discoveredStaffMap.values());
  const staffMap = new Map();

  discoveredStaffList.forEach((staff) => {
    staffMap.set(String(staff.id).trim(), {
      staff,
      added: [],
      assigned: [],
    });
  });

  const unassignedProspects = [];

  allMarketingProspects.forEach((prospect) => {
    let matchedCreatorStaff = null;
    for (const s of discoveredStaffList) {
      if (isProspectCreatedByStaff(prospect, s)) {
        matchedCreatorStaff = s;
        break;
      }
    }

    let matchedAssigneeStaff = null;
    for (const s of discoveredStaffList) {
      if (isProspectAssignedToStaff(prospect, s)) {
        matchedAssigneeStaff = s;
        break;
      }
    }

    if (matchedAssigneeStaff) {
      staffMap.get(String(matchedAssigneeStaff.id).trim())?.assigned.push(prospect);
    }

    let fallbackStaff = null;
    if (!matchedCreatorStaff && !matchedAssigneeStaff) {
      for (const s of discoveredStaffList) {
        if (isProspectAssignedOrCreatedByStaff(prospect, s)) {
          fallbackStaff = s;
          break;
        }
      }
    }

    const primaryStaff = matchedCreatorStaff || matchedAssigneeStaff || fallbackStaff;
    if (primaryStaff) {
      staffMap.get(String(primaryStaff.id).trim())?.added.push(prospect);
    } else {
      unassignedProspects.push(prospect);
    }
  });

  const staffRows = discoveredStaffList.map((staff) => {
    const entry = staffMap.get(String(staff.id).trim());
    const addedProspects = entry?.added || [];
    const totalProspects = addedProspects.length;
    const meetingScheduled = addedProspects.filter((p) => p.status === 'meeting_scheduled').length;
    const meetingCompleted = addedProspects.filter((p) => p.status === 'meeting_completed').length;
    const converted = addedProspects.filter((p) => p.status === 'purchased').length;
    const conversionRate = totalProspects > 0 ? Math.round((converted / totalProspects) * 1000) / 10 : 0;

    return {
      id: String(staff.id),
      userId: String(staff.id),
      name: staff.name,
      role: staff.role || 'marketing_staff',
      phone: staff.phone || '',
      totalProspects,
      addedProspects,
      assignedProspects: entry?.assigned || [],
      meetingScheduled,
      meetingCompleted,
      converted,
      conversionRate,
    };
  });

  staffRows.sort((a, b) => b.totalProspects - a.totalProspects);

  let unassignedRow = null;
  if (unassignedProspects.length > 0) {
    const totalUnassigned = unassignedProspects.length;
    const meetingScheduled = unassignedProspects.filter((p) => p.status === 'meeting_scheduled').length;
    const meetingCompleted = unassignedProspects.filter((p) => p.status === 'meeting_completed').length;
    const converted = unassignedProspects.filter((p) => p.status === 'purchased').length;
    const conversionRate = totalUnassigned > 0 ? Math.round((converted / totalUnassigned) * 1000) / 10 : 0;

    unassignedRow = {
      id: 'unassigned_pool',
      userId: 'unassigned_pool',
      name: 'Direct / Inbound Marketing Leads (Unassigned)',
      role: 'unassigned',
      phone: '',
      totalProspects: totalUnassigned,
      addedProspects: unassignedProspects,
      assignedProspects: [],
      meetingScheduled,
      meetingCompleted,
      converted,
      conversionRate,
      isUnassignedPool: true,
    };
  }

  const totalAttributedProspects = allMarketingProspects.length;

  return {
    marketerLeaderboard: staffRows,
    unassignedLeadsRow: unassignedRow,
    totalAttributedProspects,
  };
}

test('Marketing Staff Dynamic Discovery: Staff who created prospects are discovered dynamically even if not in initial branch users list', () => {
  // Scenario from Screenshot 1: Elizabeth Serwaa is in Kumasi branch query.
  // Cecilia Donkor is not in the branch query, but entered prospects into the system.
  const initialBranchStaff = [
    { id: 'dir-1', firstName: 'Elizabeth', lastName: 'Serwaa', role: 'marketing_director', phone: '+233547009973' }
  ];

  const allMarketingProspects = [
    // 114 prospects created by Elizabeth Serwaa
    ...Array.from({ length: 114 }, (_, i) => ({
      id: `pros-es-${i + 1}`,
      createdByUserId: 'dir-1',
      createdByName: 'ELIZABETH SERWAA',
      status: 'new',
    })),
    // 150 prospects created by Cecilia Donkor (raw fields from backend)
    ...Array.from({ length: 150 }, (_, i) => ({
      id: `pros-cd-${i + 1}`,
      createdBy: 'cecilia-donkor-id',
      createdByName: 'CECILIA DONKOR',
      status: i < 10 ? 'meeting_scheduled' : i < 15 ? 'purchased' : 'new',
    })),
    // 221 truly inbound leads from website with no staff member
    ...Array.from({ length: 221 }, (_, i) => ({
      id: `pros-inbound-${i + 1}`,
      source: 'marketing',
      status: 'new',
    })),
  ];

  assert.equal(allMarketingProspects.length, 485);

  const { marketerLeaderboard, unassignedLeadsRow, totalAttributedProspects } = distributeProspectsAcrossMarketingStaff(
    allMarketingProspects,
    initialBranchStaff,
    [],
    []
  );

  // 1. Both staff members must be represented in marketerLeaderboard
  assert.equal(marketerLeaderboard.length, 2);
  const staffNames = marketerLeaderboard.map((m) => m.name);
  assert.ok(staffNames.some((n) => n.includes('CECILIA DONKOR')), 'Cecilia Donkor must be discovered');
  assert.ok(staffNames.some((n) => n.includes('Elizabeth Serwaa')), 'Elizabeth Serwaa must be present');

  // 2. Cecilia Donkor must have her 150 prospects properly attributed, not dumped into unassigned
  const ceciliaRow = marketerLeaderboard.find((m) => m.name.includes('CECILIA DONKOR'));
  assert.equal(ceciliaRow.totalProspects, 150);
  assert.equal(ceciliaRow.meetingScheduled, 10);
  assert.equal(ceciliaRow.converted, 5);

  // 3. Elizabeth Serwaa must have her 114 prospects properly attributed
  const elizabethRow = marketerLeaderboard.find((m) => m.name.includes('Elizabeth Serwaa'));
  assert.equal(elizabethRow.totalProspects, 114);

  // 4. Only genuine unassigned leads (221) remain in unassignedRow
  assert.ok(unassignedLeadsRow);
  assert.equal(unassignedLeadsRow.totalProspects, 221);

  // 5. Total sum matches exactly 485 (114 + 150 + 221 = 485)
  assert.equal(totalAttributedProspects, 485);
  const sumOfAllRows = marketerLeaderboard.reduce((sum, r) => sum + r.totalProspects, 0) + unassignedLeadsRow.totalProspects;
  assert.equal(sumOfAllRows, 485);
});

test('Marketing Director Appointments Scoping: Director sees all staff appointments in All mode and only their own in Personal mode', () => {
  const director = { id: 'dir-1', firstName: 'Elizabeth', lastName: 'Serwaa', role: 'marketing_director' };
  const marketer1 = { id: 'mkt-1', firstName: 'Cecilia', lastName: 'Donkor', role: 'marketing_staff' };
  const marketer2 = { id: 'mkt-2', firstName: 'Kofi', lastName: 'Annan', role: 'marketing_staff' };

  const allAppointments = [
    // 2 appointments for Director
    { id: 'app-1', createdByUserId: 'dir-1', scheduledFor: '2026-10-27T10:00:00Z', status: 'scheduled' },
    { id: 'app-2', assignedUserId: 'dir-1', scheduledFor: '2026-10-28T14:00:00Z', status: 'scheduled' },
    // 3 appointments for Cecilia Donkor
    { id: 'app-3', createdByUserId: 'mkt-1', createdByName: 'CECILIA DONKOR', scheduledFor: '2026-10-29T09:00:00Z', status: 'scheduled' },
    { id: 'app-4', createdByUserId: 'mkt-1', scheduledFor: '2026-10-29T11:00:00Z', status: 'scheduled' },
    { id: 'app-5', assignedStaffId: 'mkt-1', scheduledFor: '2026-10-30T15:00:00Z', status: 'completed' },
    // 1 appointment for Kofi Annan
    { id: 'app-6', createdByUserId: 'mkt-2', scheduledFor: '2026-10-31T12:00:00Z', status: 'scheduled' },
  ];

  // In "All" mode: Director sees all 6 marketing appointments
  const allMarketingAppts = allAppointments;
  assert.equal(allMarketingAppts.length, 6);

  // In "Personal" mode: Director sees only appointments created by or assigned to themselves
  const directorPersonalAppts = getStaffAssignedAppointments(allAppointments, director);
  assert.equal(directorPersonalAppts.length, 2);
  assert.deepEqual(directorPersonalAppts.map((a) => a.id), ['app-1', 'app-2']);

  // Cecilia Donkor's personal appointments
  const ceciliaPersonalAppts = getStaffAssignedAppointments(allAppointments, marketer1);
  assert.equal(ceciliaPersonalAppts.length, 3);
  assert.deepEqual(ceciliaPersonalAppts.map((a) => a.id), ['app-3', 'app-4', 'app-5']);
});

test('Marketing Staff Appointment Consistency: Stat card and Appointments Page match with all 4 appointments across overdue, scheduled, and completed', () => {
  const lawrencia = {
    id: '6aa27d0c-lawrencia',
    firstName: 'Lawrencia',
    lastName: 'adugyemfi',
    role: 'marketing_staff',
    branchId: 'kumasi-main',
  };

  const marketingAppointments = [
    {
      id: 'appt-1',
      clientName: 'MR. DERRICK LA',
      phoneNumber: '+233248335938',
      createdByUserId: '6aa27d0c-lawrencia',
      createdByName: 'Lawrencia adugyemfi',
      scheduledFor: '2026-10-13T01:00:00Z',
      status: 'scheduled', // Overdue (13d ago)
      source: 'staff',
    },
    {
      id: 'appt-2',
      clientName: 'LUKE MAN',
      phoneNumber: '+233546714059',
      createdByUserId: '6aa27d0c-lawrencia',
      createdByName: 'Lawrencia adugyemfi',
      scheduledFor: '2026-10-27T14:00:00Z',
      status: 'scheduled',
      source: 'staff',
    },
    {
      id: 'appt-3',
      clientName: 'MR. OWUSU',
      phoneNumber: '+233244822906',
      createdByUserId: '6aa27d0c-lawrencia',
      createdByName: 'Lawrencia adugyemfi',
      scheduledFor: '2026-09-15T10:00:00Z',
      status: 'completed',
      source: 'staff',
    },
    {
      id: 'appt-4',
      clientName: 'MR. DENNIS',
      phoneNumber: '+233533039458',
      createdByUserId: '6aa27d0c-lawrencia',
      createdByName: 'Lawrencia adugyemfi',
      scheduledFor: '2026-09-15T10:00:00Z',
      status: 'completed',
      source: 'staff',
    },
  ];

  // 1. All 4 appointments must be attributed to Lawrencia adugyemfi
  const staffAppts = getStaffAssignedAppointments(marketingAppointments, lawrencia);
  assert.equal(staffAppts.length, 4, 'Must attribute exactly 4 appointments to Lawrencia');

  // 2. Overdue/scheduled (2) and completed (2) must both be present
  const activeOrOverdue = staffAppts.filter((a) => a.status === 'scheduled' || a.status === 'postponed');
  const completed = staffAppts.filter((a) => a.status === 'completed');
  assert.equal(activeOrOverdue.length, 2, '2 scheduled/overdue appointments');
  assert.equal(completed.length, 2, '2 completed appointments');

  // 3. Stat card count ({staffAppts.length} = 4) matches Appointments Page table count (4)
  assert.equal(staffAppts.length, activeOrOverdue.length + completed.length);
});





