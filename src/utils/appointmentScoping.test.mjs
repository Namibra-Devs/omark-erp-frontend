// src/utils/appointmentScoping.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getVisibleStaffIds,
  getAppointmentCreatorId,
  filterAppointmentsByScope,
  isAppointmentEditableByUser,
} from './appointmentScoping.ts';

// Mock staff users
const adminUser = { id: 'usr-admin', role: 'admin', firstName: 'Super', lastName: 'Admin' };
const directorUser = { id: 'usr-dir', role: 'marketing_director', firstName: 'Lawrencia', lastName: 'Director' };
const marketingStaff1 = { id: 'usr-mkt-1', role: 'marketing_staff', firstName: 'Cecilia', lastName: 'Marketer' };
const marketingStaff2 = { id: 'usr-mkt-2', role: 'marketing_staff', firstName: 'Daniel', lastName: 'Marketer' };
const csUser = { id: 'usr-cs', role: 'customer_service', firstName: 'Akua', lastName: 'CS' };
const secretaryUser = { id: 'usr-sec', role: 'secretary', firstName: 'Abena', lastName: 'Secretary' };
const managerUser = { id: 'usr-mgr', role: 'branch_manager', firstName: 'Kofi', lastName: 'Manager' };
const unknownRoleUser = { id: 'usr-unknown', role: 'contractor', firstName: 'Kwame', lastName: 'Contractor' };
const noRoleUser = { id: 'usr-norole', firstName: 'NoRole', lastName: 'User' };

const allUsers = [
  adminUser,
  directorUser,
  marketingStaff1,
  marketingStaff2,
  csUser,
  secretaryUser,
  managerUser,
  unknownRoleUser,
  noRoleUser,
];

// Test appointments
const apptAdminCreated = {
  id: 'apt-1',
  createdByUserId: 'usr-admin',
  assignedUserId: 'usr-cs', // Assigned to CS, but created by Admin
  scheduledFor: '2026-10-20T10:00:00Z',
  status: 'scheduled',
};

const apptDirectorCreated = {
  id: 'apt-2',
  createdByUserId: 'usr-dir',
  assignedUserId: 'usr-mkt-1',
  scheduledFor: '2026-10-20T11:00:00Z',
  status: 'scheduled',
};

const apptMarketing1Created = {
  id: 'apt-3',
  createdByUserId: 'usr-mkt-1',
  assignedUserId: 'usr-dir',
  scheduledFor: '2026-10-20T12:00:00Z',
  status: 'scheduled',
};

const apptMarketing2Created = {
  id: 'apt-4',
  createdByUserId: 'usr-mkt-2',
  assignedUserId: 'usr-mkt-2',
  scheduledFor: '2026-10-20T13:00:00Z',
  status: 'scheduled',
};

const apptCsCreated = {
  id: 'apt-5',
  createdByUserId: 'usr-cs',
  assignedUserId: 'usr-admin', // Assigned to Admin, created by CS
  scheduledFor: '2026-10-20T14:00:00Z',
  status: 'scheduled',
};

const apptSecretaryCreated = {
  id: 'apt-6',
  createdByUserId: 'usr-sec',
  assignedUserId: 'usr-sec',
  scheduledFor: '2026-10-20T15:00:00Z',
  status: 'scheduled',
};

// Appointment with no creator field on record, but linked interaction has loggedByUserId (strong tier)
const apptWithInteractionCreator = {
  id: 'apt-7',
  assignedUserId: 'usr-mgr',
  scheduledFor: '2026-10-20T16:00:00Z',
  status: 'scheduled',
};
const mockInteractions = [
  {
    id: 'int-1',
    appointmentId: 'apt-7',
    loggedByUserId: 'usr-cs',
  },
];

// Orphan / Website booking with no creator anywhere
const apptWebsiteBooking = {
  id: 'apt-8',
  assignedUserId: 'usr-dir', // Host assigned, but NO creator
  scheduledFor: '2026-10-20T17:00:00Z',
  status: 'scheduled',
};

// Duplicate ID appointment
const apptDuplicateId = {
  id: 'apt-3', // Same ID as apptMarketing1Created
  createdByUserId: 'usr-mkt-1',
  scheduledFor: '2026-10-20T12:00:00Z',
  status: 'scheduled',
};

const sampleAppointments = [
  apptAdminCreated,
  apptDirectorCreated,
  apptMarketing1Created,
  apptMarketing2Created,
  apptCsCreated,
  apptSecretaryCreated,
  apptWithInteractionCreator,
  apptWebsiteBooking,
  apptDuplicateId,
];

test('A. Single Scoping Module: getVisibleStaffIds', async (t) => {
  await t.test('Admin returns "all"', () => {
    assert.equal(getVisibleStaffIds(adminUser, allUsers), 'all');
  });

  await t.test('Marketing Director returns self plus all marketing_staff IDs', () => {
    const visible = getVisibleStaffIds(directorUser, allUsers);
    assert.ok(Array.isArray(visible));
    assert.deepEqual(visible.sort(), ['usr-dir', 'usr-mkt-1', 'usr-mkt-2'].sort());
    // Must NOT include other departments
    assert.ok(!visible.includes('usr-cs'));
    assert.ok(!visible.includes('usr-sec'));
    assert.ok(!visible.includes('usr-mgr'));
    assert.ok(!visible.includes('usr-admin'));
  });

  await t.test('Marketing Staff returns only self', () => {
    assert.deepEqual(getVisibleStaffIds(marketingStaff1, allUsers), ['usr-mkt-1']);
    assert.deepEqual(getVisibleStaffIds(marketingStaff2, allUsers), ['usr-mkt-2']);
  });

  await t.test('Other staff roles return only self', () => {
    assert.deepEqual(getVisibleStaffIds(csUser, allUsers), ['usr-cs']);
    assert.deepEqual(getVisibleStaffIds(secretaryUser, allUsers), ['usr-sec']);
    assert.deepEqual(getVisibleStaffIds(managerUser, allUsers), ['usr-mgr']);
  });

  await t.test('Unknown or missing role defaults to own-only, never to all', () => {
    assert.deepEqual(getVisibleStaffIds(unknownRoleUser, allUsers), ['usr-unknown']);
    assert.deepEqual(getVisibleStaffIds(noRoleUser, allUsers), ['usr-norole']);
    assert.deepEqual(getVisibleStaffIds(null, allUsers), []);
  });
});

test('A. Single Scoping Module: getAppointmentCreatorId', async (t) => {
  await t.test('reads createdByUserId / createdBy directly', () => {
    assert.equal(getAppointmentCreatorId({ createdByUserId: 'usr-1' }), 'usr-1');
    assert.equal(getAppointmentCreatorId({ createdBy: 'usr-2' }), 'usr-2');
  });

  await t.test('reads linked interaction loggedByUserId as strong fallback', () => {
    const creatorId = getAppointmentCreatorId(apptWithInteractionCreator, mockInteractions);
    assert.equal(creatorId, 'usr-cs');
  });

  await t.test('never falls back to assignedUserId, staffId, prospect owner, or customer owner', () => {
    const apptWithOtherFields = {
      id: 'apt-test',
      assignedUserId: 'usr-host',
      staffId: 'usr-staff',
      prospectOwnerId: 'usr-prospect-owner',
      customerOwnerId: 'usr-customer-owner',
    };
    assert.equal(getAppointmentCreatorId(apptWithOtherFields), undefined);
  });
});

test('B. Role-Based Visibility Rules: filterAppointmentsByScope', async (t) => {
  await t.test('Admin sees all appointments including unassigned and orphans', () => {
    const visible = filterAppointmentsByScope(sampleAppointments, adminUser, allUsers, mockInteractions);
    // Should include all unique IDs: apt-1, apt-2, apt-3, apt-4, apt-5, apt-6, apt-7, apt-8
    const visibleIds = visible.map((a) => a.id);
    assert.equal(visible.length, 8);
    assert.ok(visibleIds.includes('apt-1'));
    assert.ok(visibleIds.includes('apt-2'));
    assert.ok(visibleIds.includes('apt-3'));
    assert.ok(visibleIds.includes('apt-4'));
    assert.ok(visibleIds.includes('apt-5'));
    assert.ok(visibleIds.includes('apt-6'));
    assert.ok(visibleIds.includes('apt-7'));
    assert.ok(visibleIds.includes('apt-8'));
  });

  await t.test('Marketing Director sees self + marketing staff, and NOT other departments or unassigned', () => {
    const visible = filterAppointmentsByScope(sampleAppointments, directorUser, allUsers, mockInteractions);
    const visibleIds = visible.map((a) => a.id);
    assert.deepEqual(visibleIds.sort(), ['apt-2', 'apt-3', 'apt-4'].sort());
    // Director created apt-2, mkt-1 created apt-3, mkt-2 created apt-4
    // Must NOT see apt-1 (Admin), apt-5 (CS), apt-6 (Secretary), apt-7 (CS via interaction), apt-8 (unassigned)
    assert.ok(!visibleIds.includes('apt-1'));
    assert.ok(!visibleIds.includes('apt-5'));
    assert.ok(!visibleIds.includes('apt-6'));
    assert.ok(!visibleIds.includes('apt-7'));
    assert.ok(!visibleIds.includes('apt-8'));
  });

  await t.test('Marketing staff sees ONLY own created appointments', () => {
    const visibleMkt1 = filterAppointmentsByScope(sampleAppointments, marketingStaff1, allUsers, mockInteractions);
    assert.deepEqual(visibleMkt1.map((a) => a.id), ['apt-3']);

    const visibleMkt2 = filterAppointmentsByScope(sampleAppointments, marketingStaff2, allUsers, mockInteractions);
    assert.deepEqual(visibleMkt2.map((a) => a.id), ['apt-4']);
  });

  await t.test('Customer Service sees ONLY own created appointments', () => {
    const visibleCs = filterAppointmentsByScope(sampleAppointments, csUser, allUsers, mockInteractions);
    // apt-5 (createdByUserId = usr-cs) and apt-7 (interaction loggedByUserId = usr-cs)
    const visibleIds = visibleCs.map((a) => a.id);
    assert.deepEqual(visibleIds.sort(), ['apt-5', 'apt-7'].sort());
  });

  await t.test('Assigned-but-not-created appointment is NOT visible to non-admin/non-director', () => {
    // apt-1 has assignedUserId: 'usr-cs', but was created by 'usr-admin'
    const visibleCs = filterAppointmentsByScope(sampleAppointments, csUser, allUsers, mockInteractions);
    assert.ok(!visibleCs.map((a) => a.id).includes('apt-1'), 'Assigned appointment must NOT appear for non-creator');

    // apt-5 has assignedUserId: 'usr-admin', but was created by 'usr-cs'.
    // Secretary should not see it even though someone else created it
    const visibleSec = filterAppointmentsByScope(sampleAppointments, secretaryUser, allUsers, mockInteractions);
    assert.deepEqual(visibleSec.map((a) => a.id), ['apt-6']);
  });

  await t.test('Missing creator is Admin-only (unassigned/website booking)', () => {
    const visibleAdmin = filterAppointmentsByScope([apptWebsiteBooking], adminUser, allUsers, mockInteractions);
    assert.equal(visibleAdmin.length, 1);
    assert.equal(visibleAdmin[0].id, 'apt-8');

    const visibleDir = filterAppointmentsByScope([apptWebsiteBooking], directorUser, allUsers, mockInteractions);
    assert.equal(visibleDir.length, 0);

    const visibleMkt = filterAppointmentsByScope([apptWebsiteBooking], marketingStaff1, allUsers, mockInteractions);
    assert.equal(visibleMkt.length, 0);

    const visibleCs = filterAppointmentsByScope([apptWebsiteBooking], csUser, allUsers, mockInteractions);
    assert.equal(visibleCs.length, 0);
  });

  await t.test('Unknown role sees only own-created appointments', () => {
    const apptUnknownCreated = { id: 'apt-9', createdByUserId: 'usr-unknown', scheduledFor: '2026-10-20' };
    const list = [...sampleAppointments, apptUnknownCreated];
    const visible = filterAppointmentsByScope(list, unknownRoleUser, allUsers, mockInteractions);
    assert.deepEqual(visible.map((a) => a.id), ['apt-9']);
  });

  await t.test('Duplicate IDs render once (deduplicated strictly by appointment id)', () => {
    const visible = filterAppointmentsByScope(sampleAppointments, adminUser, allUsers, mockInteractions);
    const countApt3 = visible.filter((a) => a.id === 'apt-3').length;
    assert.equal(countApt3, 1, 'apt-3 appears twice in sample input but must only appear once in output');
  });
});

test('C. Permissions: isAppointmentEditableByUser', async (t) => {
  await t.test('Admin can edit any appointment', () => {
    assert.ok(isAppointmentEditableByUser(apptDirectorCreated, adminUser, allUsers));
    assert.ok(isAppointmentEditableByUser(apptWebsiteBooking, adminUser, allUsers));
  });

  await t.test('Creator can edit own appointment', () => {
    assert.ok(isAppointmentEditableByUser(apptMarketing1Created, marketingStaff1, allUsers));
    assert.ok(isAppointmentEditableByUser(apptCsCreated, csUser, allUsers));
  });

  await t.test('Marketing Director can edit marketing staff appointments', () => {
    assert.ok(isAppointmentEditableByUser(apptMarketing1Created, directorUser, allUsers));
    assert.ok(isAppointmentEditableByUser(apptMarketing2Created, directorUser, allUsers));
  });

  await t.test('Marketing Director CANNOT edit other departments appointments', () => {
    assert.ok(!isAppointmentEditableByUser(apptCsCreated, directorUser, allUsers));
    assert.ok(!isAppointmentEditableByUser(apptSecretaryCreated, directorUser, allUsers));
  });

  await t.test('Non-creator CANNOT edit another staff appointment', () => {
    assert.ok(!isAppointmentEditableByUser(apptAdminCreated, csUser, allUsers)); // cs is host, but not creator
    assert.ok(!isAppointmentEditableByUser(apptMarketing1Created, marketingStaff2, allUsers));
  });
});
