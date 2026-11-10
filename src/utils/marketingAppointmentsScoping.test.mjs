// src/utils/marketingAppointmentsScoping.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getVisibleStaffIds,
  filterAppointmentsByScope,
  getAppointmentCreatorId,
} from './appointmentScoping.ts';

// Marketing team users
const marketingDirector = { id: 'usr-dir', role: 'marketing_director', firstName: 'Elizabeth', lastName: 'Serwaa' };
const marketingStaff1 = { id: 'usr-mkt-1', role: 'marketing_staff', firstName: 'Cecilia', lastName: 'Donkor' };
const marketingStaff2 = { id: 'usr-mkt-2', role: 'marketing_staff', firstName: 'Daniel', lastName: 'Appiah' };
const csStaff = { id: 'usr-cs', role: 'customer_service', firstName: 'Akua', lastName: 'Boateng' };
const adminUser = { id: 'usr-admin', role: 'admin', firstName: 'Super', lastName: 'Admin' };

const secretaryStaff = { id: 'usr-sec', role: 'secretary', firstName: 'Dorothy', lastName: 'Fosuaa' };
const branchManager = { id: 'usr-mgr', role: 'branch_manager', firstName: 'Kofi', lastName: 'Manager' };

const allUsers = [
  marketingDirector,
  marketingStaff1,
  marketingStaff2,
  csStaff,
  secretaryStaff,
  branchManager,
  adminUser,
];

// Marketing prospects
const prospect1 = {
  id: 'pros-1',
  firstName: 'Kofi',
  lastName: 'Mensah',
  assignedUserId: 'usr-mkt-1',
  createdByUserId: 'usr-dir',
  source: 'marketing',
};

const prospect2 = {
  id: 'pros-2',
  firstName: 'Ama',
  lastName: 'Osei',
  assignedUserId: 'usr-dir',
  createdByUserId: 'usr-dir',
  source: 'marketing',
  status: 'meeting_scheduled',
  notes: 'Site inspection booked for Friday at 10 AM',
};

const allProspects = [prospect1, prospect2];

// Interacted booking
const interactions = [
  {
    id: 'int-1',
    appointmentId: 'appt-server-1',
    loggedByUserId: 'usr-mkt-1',
    loggedByUserName: 'Cecilia Donkor',
  },
];

// Lightweight test synthesis mirroring synthesizeAllAppointments
function testSynthesizeAppointments(baseAppointments, allInteractions = [], prospects = []) {
  return baseAppointments.map((appt) => {
    let resolvedCreatorId = appt.createdBy || appt.createdByUserId;

    // A. Match linked interaction
    if (!resolvedCreatorId && appt.id) {
      const matched = allInteractions.find((i) => i.appointmentId === appt.id || i.id === appt.id);
      if (matched) resolvedCreatorId = matched.loggedByUserId;
    }

    // B. Direct staff assignment
    if (!resolvedCreatorId) {
      resolvedCreatorId = appt.assignedUserId || appt.staffId;
    }

    // C. Linked prospect
    if (!resolvedCreatorId && appt.prospectId) {
      const p = prospects.find((item) => item.id === appt.prospectId);
      if (p) resolvedCreatorId = p.assignedUserId || p.createdByUserId;
    }

    return {
      ...appt,
      createdBy: resolvedCreatorId,
      createdByUserId: resolvedCreatorId,
      source: appt.source || 'staff',
    };
  });
}

test('Marketing Director Appointment Scoping & Synthesis', async (t) => {
  await t.test('Marketing Director visible staff IDs includes self and marketing staff', () => {
    const visible = getVisibleStaffIds(marketingDirector, allUsers);
    assert.ok(Array.isArray(visible));
    assert.ok(visible.includes('usr-dir'), 'Must include director self');
    assert.ok(visible.includes('usr-mkt-1'), 'Must include marketing staff 1');
    assert.ok(visible.includes('usr-mkt-2'), 'Must include marketing staff 2');
    assert.ok(!visible.includes('usr-cs'), 'Must NOT include CS');
  });

  await t.test('testSynthesizeAppointments backfills createdBy from linked interactions', () => {
    const rawServerAppts = [{ id: 'appt-server-1', scheduledFor: '2026-10-25T10:00:00Z', status: 'scheduled' }];
    const synthesized = testSynthesizeAppointments(rawServerAppts, interactions, allProspects);
    const matched = synthesized.find((a) => a.id === 'appt-server-1');
    assert.ok(matched, 'Appointment must be in synthesized list');
    assert.equal(matched.createdByUserId, 'usr-mkt-1');
    assert.equal(matched.createdBy, 'usr-mkt-1');
  });

  await t.test('testSynthesizeAppointments backfills createdBy from direct staff assignment', () => {
    const rawServerAppts = [{ id: 'appt-server-2', assignedUserId: 'usr-dir', scheduledFor: '2026-10-25T11:00:00Z', status: 'scheduled' }];
    const synthesized = testSynthesizeAppointments(rawServerAppts, interactions, allProspects);
    const matched = synthesized.find((a) => a.id === 'appt-server-2');
    assert.ok(matched, 'Appointment must be in synthesized list');
    assert.equal(matched.createdByUserId, 'usr-dir');
    assert.equal(matched.createdBy, 'usr-dir');
  });

  await t.test('testSynthesizeAppointments backfills createdBy from linked marketing prospect', () => {
    const rawServerAppts = [{ id: 'appt-server-3', prospectId: 'pros-1', scheduledFor: '2026-10-25T14:00:00Z', status: 'scheduled' }];
    const synthesized = testSynthesizeAppointments(rawServerAppts, interactions, allProspects);
    const matched = synthesized.find((a) => a.id === 'appt-server-3');
    assert.ok(matched, 'Appointment must be in synthesized list');
    assert.equal(matched.createdByUserId, 'usr-mkt-1');
    assert.equal(matched.createdBy, 'usr-mkt-1');
  });

  await t.test('Marketing Director sees ONLY marketing staff under her and self in filterAppointmentsByScope', () => {
    const rawServerAppts = [
      { id: 'appt-1', assignedUserId: 'usr-dir', scheduledFor: '2026-10-25T10:00:00Z' },
      { id: 'appt-2', prospectId: 'pros-1', scheduledFor: '2026-10-25T11:00:00Z' },
      { id: 'appt-3', assignedUserId: 'usr-cs', scheduledFor: '2026-10-25T12:00:00Z' }, // CS appointment
      { id: 'appt-4', assignedUserId: 'usr-sec', scheduledFor: '2026-10-25T13:00:00Z' }, // Secretary appointment
      { id: 'appt-5', assignedUserId: 'usr-mgr', scheduledFor: '2026-10-25T14:00:00Z' }, // Branch Manager appointment
      { id: 'appt-6', assignedUserId: 'usr-admin', scheduledFor: '2026-10-25T15:00:00Z' }, // Admin appointment
    ];

    const synthesized = testSynthesizeAppointments(rawServerAppts, interactions, allProspects);
    const scopedForDirector = filterAppointmentsByScope(synthesized, marketingDirector, allUsers, interactions);
    const ids = scopedForDirector.map((a) => a.id);

    // Director sees appt-1 (self) and appt-2 (mkt staff 1)
    assert.ok(ids.includes('appt-1'), 'Director sees self-assigned appointment');
    assert.ok(ids.includes('appt-2'), 'Director sees marketing staff prospect appointment');

    // Director strictly does NOT see other departments
    assert.ok(!ids.includes('appt-3'), 'Director must NOT see CS appointment');
    assert.ok(!ids.includes('appt-4'), 'Director must NOT see Secretary appointment');
    assert.ok(!ids.includes('appt-5'), 'Director must NOT see Branch Manager appointment');
    assert.ok(!ids.includes('appt-6'), 'Director must NOT see Admin appointment');
    assert.equal(scopedForDirector.length, 2);
  });
});
