// src/api/scopingAlignment.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canWriteProspects,
  resolveProspectAttribution,
  canAccessProspect,
  canEditProspect,
} from '../utils/prospectScoping.ts';
import {
  getVisibleStaffIds,
  canAccessAppointmentDoc,
  filterAppointmentsByScope,
  isAppointmentEditableByUser,
} from '../utils/appointmentScoping.ts';

// ── Role Fixtures (All 6 Roles) ─────────────────────────────────────────────
const adminUser = { id: 'usr-admin', role: 'admin', firstName: 'Super', lastName: 'Admin' };
const directorUser = { id: 'usr-dir', role: 'marketing_director', branchId: 'branch-main', firstName: 'Lawrencia', lastName: 'Adugyemfi' };
const marketingStaffUser = { id: 'usr-mkt', role: 'marketing_staff', branchId: 'branch-main', firstName: 'Cecilia', lastName: 'Donkor' };
const csUser = { id: 'usr-cs', role: 'customer_service', branchId: 'branch-main', firstName: 'Akua', lastName: 'Owusu' };
const secretaryUser = { id: 'usr-sec', role: 'secretary', branchId: 'branch-main', firstName: 'Abena', lastName: 'Mansah' };
const branchManagerUser = { id: 'usr-bm', role: 'branch_manager', branchId: 'branch-1', firstName: 'Kofi', lastName: 'Ansah' };
const unknownRoleUser = { id: 'usr-contractor', role: 'contractor', firstName: 'Kwame', lastName: 'Contractor' };

const allUsers = [
  adminUser,
  directorUser,
  marketingStaffUser,
  csUser,
  secretaryUser,
  branchManagerUser,
  unknownRoleUser,
];

// ── 5 Prospect Fixtures ─────────────────────────────────────────────────────
const p1_mktStaff = { id: 'p1', source: 'marketing', createdByUserId: 'usr-mkt', branchId: 'branch-main', firstName: 'Kofi', lastName: 'Mensah' };
const p2_mktDir = { id: 'p2', source: 'marketing', createdByUserId: 'usr-dir', branchId: 'branch-main', firstName: 'Ama', lastName: 'Osei' };
const p3_cs = { id: 'p3', source: 'customer_service', createdByUserId: 'usr-cs', branchId: 'branch-main', firstName: 'Peter', lastName: 'Boateng' };
const p4_sec = { id: 'p4', source: 'customer_service', createdByUserId: 'usr-sec', branchId: 'branch-main', firstName: 'Daniel', lastName: 'Appiah' };
const p5_bm = { id: 'p5', source: 'marketing', createdByUserId: 'usr-bm', branchId: 'branch-1', firstName: 'Grace', lastName: 'Koomson' };

const sampleProspects = [p1_mktStaff, p2_mktDir, p3_cs, p4_sec, p5_bm];

// ── Appointment Fixtures ────────────────────────────────────────────────────
const apptWebsiteUnassigned = { id: 'apt-web', source: 'website', scheduledFor: '2026-10-20' };
const apptMarketingCreated = { id: 'apt-mkt', createdByUserId: 'usr-mkt', scheduledFor: '2026-10-20' };
const apptCsCreated = { id: 'apt-cs', createdByUserId: 'usr-cs', scheduledFor: '2026-10-20' };
const apptSecCreated = { id: 'apt-sec', createdByUserId: 'usr-sec', scheduledFor: '2026-10-20' };
const apptBmCreated = { id: 'apt-bm', createdByUserId: 'usr-bm', scheduledFor: '2026-10-20' };

// ── 1. Pure Function Attribution: Exactly 11 Assertions ─────────────────────
test('resolveProspectAttribution: exactly 11 assertions across attribution rules', async (t) => {
  // A. Assignment-to-creator for recognized staff roles (5 assertions)
  // Ignored caller-supplied assignedUserId and auto-assigned to creator
  await t.test('1. marketing_staff: auto-assigned to creator, ignoring caller-supplied assignedUserId', () => {
    const res = resolveProspectAttribution(marketingStaffUser, { assignedUserId: 'other-user-999' });
    assert.equal(res.assignedUserId, 'usr-mkt');
  });

  await t.test('2. customer_service: auto-assigned to creator, ignoring caller-supplied assignedUserId', () => {
    const res = resolveProspectAttribution(csUser, { assignedUserId: 'other-user-999' });
    assert.equal(res.assignedUserId, 'usr-cs');
  });

  await t.test('3. marketing_director: auto-assigned to creator, ignoring caller-supplied assignedUserId', () => {
    const res = resolveProspectAttribution(directorUser, { assignedUserId: 'other-user-999' });
    assert.equal(res.assignedUserId, 'usr-dir');
  });

  await t.test('4. secretary: auto-assigned to creator, ignoring caller-supplied assignedUserId', () => {
    const res = resolveProspectAttribution(secretaryUser, { assignedUserId: 'other-user-999' });
    assert.equal(res.assignedUserId, 'usr-sec');
  });

  await t.test('5. branch_manager: auto-assigned to creator, ignoring caller-supplied assignedUserId', () => {
    const res = resolveProspectAttribution(branchManagerUser, { assignedUserId: 'other-user-999' });
    assert.equal(res.assignedUserId, 'usr-bm');
  });

  // B. No self-blinding creates (4 assertions)
  await t.test('6. marketing_director: forced to source marketing on customer_service input', () => {
    const res = resolveProspectAttribution(directorUser, { source: 'customer_service' });
    assert.equal(res.source, 'marketing');
  });

  await t.test('7. marketing_director: default source is marketing when none supplied', () => {
    const res = resolveProspectAttribution(directorUser, {});
    assert.equal(res.source, 'marketing');
  });

  await t.test('8. marketing_staff: forced to source marketing on customer_service input', () => {
    const res = resolveProspectAttribution(marketingStaffUser, { source: 'customer_service' });
    assert.equal(res.source, 'marketing');
  });

  await t.test('9. customer_service: forced to source customer_service on marketing input', () => {
    const res = resolveProspectAttribution(csUser, { source: 'marketing' });
    assert.equal(res.source, 'customer_service');
  });

  // C. Admin honoured & Unrecognised role protected (2 assertions)
  await t.test('10. admin: honours caller-supplied assignedUserId', () => {
    const res = resolveProspectAttribution(adminUser, { assignedUserId: 'staff-target-42' });
    assert.equal(res.assignedUserId, 'staff-target-42');
  });

  await t.test('11. unrecognised role: rejects caller-supplied assignedUserId (no silent reassignment)', () => {
    const res = resolveProspectAttribution(unknownRoleUser, { assignedUserId: 'unauthorised-staff-88' });
    assert.equal(res.assignedUserId, 'usr-contractor');
  });
});

// ── 2. Scope Predicates: Exactly 24 Assertions ──────────────────────────────
test('Scope Predicates: exactly 24 assertions across all 6 roles', async (t) => {
  // A. canWriteProspects across all 6 roles (6 assertions)
  await t.test('Predicate 1: canWriteProspects(admin) is true', () => {
    assert.equal(canWriteProspects(adminUser), true);
  });

  await t.test('Predicate 2: canWriteProspects(marketing_director) is true (mirrors read scope)', () => {
    assert.equal(canWriteProspects(directorUser), true);
  });

  await t.test('Predicate 3: canWriteProspects(marketing_staff) is true', () => {
    assert.equal(canWriteProspects(marketingStaffUser), true);
  });

  await t.test('Predicate 4: canWriteProspects(customer_service) is true', () => {
    assert.equal(canWriteProspects(csUser), true);
  });

  await t.test('Predicate 5: canWriteProspects(secretary) is false (read-only for secretary)', () => {
    assert.equal(canWriteProspects(secretaryUser), false);
  });

  await t.test('Predicate 6: canWriteProspects(branch_manager) is false', () => {
    assert.equal(canWriteProspects(branchManagerUser), false);
  });

  // B. Appointment list access: getVisibleStaffIds across all 6 roles (6 assertions)
  await t.test('Predicate 7: getVisibleStaffIds(admin) is "all"', () => {
    assert.equal(getVisibleStaffIds(adminUser, allUsers), 'all');
  });

  await t.test('Predicate 8: getVisibleStaffIds(secretary) is "all" (unrestricted, matches prospectScope)', () => {
    assert.equal(getVisibleStaffIds(secretaryUser, allUsers), 'all');
  });

  await t.test('Predicate 9: getVisibleStaffIds(marketing_director) returns [self, ...marketing_staff]', () => {
    const visible = getVisibleStaffIds(directorUser, allUsers);
    assert.deepEqual(visible.sort(), ['usr-dir', 'usr-mkt'].sort());
  });

  await t.test('Predicate 10: getVisibleStaffIds(marketing_staff) returns [self]', () => {
    assert.deepEqual(getVisibleStaffIds(marketingStaffUser, allUsers), ['usr-mkt']);
  });

  await t.test('Predicate 11: getVisibleStaffIds(customer_service) returns [self]', () => {
    assert.deepEqual(getVisibleStaffIds(csUser, allUsers), ['usr-cs']);
  });

  await t.test('Predicate 12: getVisibleStaffIds(branch_manager) returns [self]', () => {
    assert.deepEqual(getVisibleStaffIds(branchManagerUser, allUsers), ['usr-bm']);
  });

  // C. Appointment single-record access: canAccessAppointmentDoc across all 6 roles (6 assertions)
  await t.test('Predicate 13: canAccessAppointmentDoc(admin) is true for website booking', () => {
    assert.equal(canAccessAppointmentDoc(apptWebsiteUnassigned, adminUser, allUsers), true);
  });

  await t.test('Predicate 14: canAccessAppointmentDoc(secretary) is true for website booking (unrestricted)', () => {
    assert.equal(canAccessAppointmentDoc(apptWebsiteUnassigned, secretaryUser, allUsers), true);
  });

  await t.test('Predicate 15: canAccessAppointmentDoc(marketing_director) is true for marketing staff, false for CS', () => {
    const canSeeMkt = canAccessAppointmentDoc(apptMarketingCreated, directorUser, allUsers);
    const canSeeCs = canAccessAppointmentDoc(apptCsCreated, directorUser, allUsers);
    assert.equal(canSeeMkt && !canSeeCs, true);
  });

  await t.test('Predicate 16: canAccessAppointmentDoc(marketing_staff) is true for own, false for CS', () => {
    const canSeeOwn = canAccessAppointmentDoc(apptMarketingCreated, marketingStaffUser, allUsers);
    const canSeeCs = canAccessAppointmentDoc(apptCsCreated, marketingStaffUser, allUsers);
    assert.equal(canSeeOwn && !canSeeCs, true);
  });

  await t.test('Predicate 17: canAccessAppointmentDoc(customer_service) is true for own, false for marketing staff', () => {
    const canSeeOwn = canAccessAppointmentDoc(apptCsCreated, csUser, allUsers);
    const canSeeMkt = canAccessAppointmentDoc(apptMarketingCreated, csUser, allUsers);
    assert.equal(canSeeOwn && !canSeeMkt, true);
  });

  await t.test('Predicate 18: canAccessAppointmentDoc(branch_manager) is true for own, false for other staff', () => {
    const canSeeOwn = canAccessAppointmentDoc(apptBmCreated, branchManagerUser, allUsers);
    const canSeeOther = canAccessAppointmentDoc(apptMarketingCreated, branchManagerUser, allUsers);
    assert.equal(canSeeOwn && !canSeeOther, true);
  });

  // D. Prospect Scope across 5 Fixtures for all 6 roles (6 assertions)
  await t.test('Predicate 19: admin can access all 5 prospect fixtures', () => {
    const visibleCount = sampleProspects.filter((p) => canAccessProspect(adminUser, p)).length;
    assert.equal(visibleCount, 5);
  });

  await t.test('Predicate 20: secretary can access all 5 prospect fixtures (unrestricted)', () => {
    const visibleCount = sampleProspects.filter((p) => canAccessProspect(secretaryUser, p)).length;
    assert.equal(visibleCount, 5);
  });

  await t.test('Predicate 21: marketing_director accesses marketing fixtures (p1, p2) but not CS fixtures', () => {
    const visible = sampleProspects.filter((p) => canAccessProspect(directorUser, p));
    assert.deepEqual(visible.map((p) => p.id).sort(), ['p1', 'p2']);
  });

  await t.test('Predicate 22: marketing_staff accesses only own prospect fixture (p1)', () => {
    const visible = sampleProspects.filter((p) => canAccessProspect(marketingStaffUser, p));
    assert.deepEqual(visible.map((p) => p.id), ['p1']);
  });

  await t.test('Predicate 23: customer_service accesses customer service fixtures (p3, p4)', () => {
    const visible = sampleProspects.filter((p) => canAccessProspect(csUser, p));
    assert.deepEqual(visible.map((p) => p.id).sort(), ['p3', 'p4']);
  });

  await t.test('Predicate 24: branch_manager accesses branch prospect fixture (p5)', () => {
    const visible = sampleProspects.filter((p) => canAccessProspect(branchManagerUser, p));
    assert.deepEqual(visible.map((p) => p.id), ['p5']);
  });
});

// ── 3. Read-without-edit Verification (Deliberately Not Changed) ─────────────
test('Read-without-edit permissions: secretary and director read records they cannot edit', async (t) => {
  await t.test('Secretary can read all prospects, but canEditProspect is false', () => {
    assert.equal(canAccessProspect(secretaryUser, p1_mktStaff), true);
    assert.equal(canEditProspect(secretaryUser, p1_mktStaff), false);
  });

  await t.test('Secretary can read all appointments, but isAppointmentEditableByUser is false for others', () => {
    assert.equal(canAccessAppointmentDoc(apptMarketingCreated, secretaryUser, allUsers), true);
    assert.equal(isAppointmentEditableByUser(apptMarketingCreated, secretaryUser, allUsers), false);
  });

  await t.test('Marketing Director can read marketing appointments, but cannot edit CS appointments', () => {
    assert.equal(isAppointmentEditableByUser(apptCsCreated, directorUser, allUsers), false);
  });
});
