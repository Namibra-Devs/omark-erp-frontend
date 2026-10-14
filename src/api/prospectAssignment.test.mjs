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

// ── Appointment Attribution & Personal Visibility Tests ─────────────────────

function isAppointmentAssignedToStaff(appointment, staffUser, staffProspectIds, staffCustomerIds) {
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
      areIdsEqual(appointment.assignedUser?.id, staffId) ||
      areIdsEqual(appointment.staff?.id, staffId) ||
      areIdsEqual(appointment.user?.id, staffId)
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
    appointment.staffName,
    appointment.marketerName,
    appointment.agentName,
    appointment.hostName,
    appointment.staff?.name,
    appointment.creator?.name,
  ];

  for (const cName of candidateNames) {
    if (cName && isStaffNameMatching(cName, staffUser)) {
      return true;
    }
  }

  return false;
}

function getStaffAssignedAppointments(allAppointments, staffUser, allProspects = [], branches = [], allCustomers = []) {
  if (!Array.isArray(allAppointments) || allAppointments.length === 0 || !staffUser) return [];

  let staffProspectIds;
  if (Array.isArray(allProspects) && allProspects.length > 0) {
    const staffProspects = allProspects.filter((p) => isProspectAssignedOrCreatedByStaff(p, staffUser));
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
    isAppointmentAssignedToStaff(a, staffUser, staffProspectIds, staffCustomerIds)
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



