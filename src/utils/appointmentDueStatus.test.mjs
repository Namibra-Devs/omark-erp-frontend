// src/utils/appointmentDueStatus.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import dayjs from 'dayjs';

// Mock localStorage and window for node:test environment
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

const APPOINTMENTS_STORAGE_KEY = 'omark_stored_appointments';
const APPOINTMENTS_STATUS_OVERRIDES_KEY = 'omark_appointment_status_overrides';

// Mirrored from src/utils/prospectAssignment.ts
const getAppointmentDueStatus = (appointment) => {
  if (!appointment) return 'none';
  const status = String(appointment.status || '').toLowerCase().trim();
  const feedbackLower = String(appointment.feedback || '').toLowerCase();

  // Completed, attended, canceled or no_show appointments NEVER create due/overdue flags
  if (
    status === 'completed' ||
    status === 'attended' ||
    status === 'canceled' ||
    status === 'cancelled' ||
    status === 'no_show' ||
    status === 'no-show' ||
    status === 'noshow' ||
    status === 'closed' ||
    status === 'done' ||
    status === 'fulfilled' ||
    appointment.attended === true ||
    appointment.isAttended === true ||
    Boolean(appointment.attendedByUserId) ||
    Boolean(appointment.attendedByName) ||
    feedbackLower.includes('attended') ||
    feedbackLower.includes('completed')
  ) {
    return 'none';
  }

  const schedTime = appointment.scheduledFor
    ? dayjs(appointment.scheduledFor)
    : (appointment.date && appointment.time ? dayjs(`${appointment.date}T${appointment.time}`) : null);

  if (!schedTime || !schedTime.isValid()) {
    return 'none';
  }

  const now = dayjs();
  const startOfToday = now.startOf('day');

  // If scheduled before today: OVERDUE
  if (schedTime.isBefore(startOfToday)) {
    return 'overdue';
  }

  // If scheduled for today (start of day to end of day): DUE TODAY
  const endOfToday = now.endOf('day');
  if (schedTime.isAfter(startOfToday) && schedTime.isBefore(endOfToday)) {
    return 'due_today';
  }

  // Future / upcoming
  return 'upcoming';
};

// Mirrored from src/api/appointments.ts
function clearAllAppointmentsStorage() {
  try {
    localStorage.removeItem(APPOINTMENTS_STORAGE_KEY);
    localStorage.removeItem(APPOINTMENTS_STATUS_OVERRIDES_KEY);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('omark-appointments-changed'));
    }
  } catch (err) {
    console.warn('Failed to clear appointments storage:', err);
  }
}

function getAppointmentStatusOverrides() {
  try {
    const raw = localStorage.getItem(APPOINTMENTS_STATUS_OVERRIDES_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch (err) {
    return {};
  }
}

function saveAppointmentStatusOverride(id, override) {
  try {
    if (!id) return;
    const current = getAppointmentStatusOverrides();
    const prev = current[id] || { id };
    const updated = {
      ...prev,
      ...override,
      id,
      updatedAt: override.updatedAt || new Date().toISOString(),
    };
    current[id] = updated;
    localStorage.setItem(APPOINTMENTS_STATUS_OVERRIDES_KEY, JSON.stringify(current));
  } catch (err) {
    console.warn('Failed to save appointment status override:', err);
  }
}

test('Appointment Due Status: Attended and Completed appointments NEVER flag as overdue', async (t) => {
  const pastDate = '2026-09-01T10:00:00Z';

  await t.test('status: "attended" returns "none" even with past date', () => {
    const res = getAppointmentDueStatus({
      status: 'attended',
      scheduledFor: pastDate,
    });
    assert.equal(res, 'none', 'status: attended must return none');
  });

  await t.test('status: "completed" returns "none" even with past date', () => {
    const res = getAppointmentDueStatus({
      status: 'completed',
      scheduledFor: pastDate,
    });
    assert.equal(res, 'none', 'status: completed must return none');
  });

  await t.test('attended: true boolean returns "none" regardless of scheduled date', () => {
    const res = getAppointmentDueStatus({
      status: 'scheduled',
      scheduledFor: pastDate,
      attended: true,
    });
    assert.equal(res, 'none', 'attended: true must clear overdue status');
  });

  await t.test('isAttended: true returns "none"', () => {
    const res = getAppointmentDueStatus({
      status: 'scheduled',
      scheduledFor: pastDate,
      isAttended: true,
    });
    assert.equal(res, 'none', 'isAttended: true must clear overdue status');
  });

  await t.test('attendedByUserId or attendedByName returns "none"', () => {
    const res1 = getAppointmentDueStatus({
      status: 'scheduled',
      scheduledFor: pastDate,
      attendedByUserId: 'usr-staff-1',
    });
    assert.equal(res1, 'none');

    const res2 = getAppointmentDueStatus({
      status: 'scheduled',
      scheduledFor: pastDate,
      attendedByName: 'Elizabeth Serwaa',
    });
    assert.equal(res2, 'none');
  });

  await t.test('feedback mentioning attended or completed returns "none"', () => {
    const res = getAppointmentDueStatus({
      status: 'scheduled',
      scheduledFor: pastDate,
      feedback: 'Attended and completed by Elizabeth on Sep 10, 2026',
    });
    assert.equal(res, 'none', 'Feedback mentioning attended must return none');
  });

  await t.test('Unattended past appointment flags as overdue', () => {
    const res = getAppointmentDueStatus({
      status: 'scheduled',
      scheduledFor: pastDate,
    });
    assert.equal(res, 'overdue', 'Past scheduled appointment without attended flag must be overdue');
  });

  await t.test('canceled, cancelled, no_show return "none"', () => {
    assert.equal(getAppointmentDueStatus({ status: 'canceled', scheduledFor: pastDate }), 'none');
    assert.equal(getAppointmentDueStatus({ status: 'cancelled', scheduledFor: pastDate }), 'none');
    assert.equal(getAppointmentDueStatus({ status: 'no_show', scheduledFor: pastDate }), 'none');
  });
});

test('Appointment Storage: clearAllAppointmentsStorage completely wipes stored mockups and cache overrides', () => {
  localStorage.clear();

  // Populate mockups and overrides
  localStorage.setItem(APPOINTMENTS_STORAGE_KEY, JSON.stringify([
    { id: 'appt_mock_1', clientName: 'Ghost Client', scheduledFor: '2026-09-01T10:00:00Z', status: 'scheduled' },
    { id: 'appt_mock_2', clientName: 'Mystery Client', scheduledFor: '2026-09-02T10:00:00Z', status: 'scheduled' },
  ]));
  saveAppointmentStatusOverride('appt_123', { status: 'completed' });

  assert.ok(localStorage.getItem(APPOINTMENTS_STORAGE_KEY) !== null);
  assert.ok(Object.keys(getAppointmentStatusOverrides()).length > 0);

  // Clear all
  clearAllAppointmentsStorage();

  // Both should be completely wiped
  assert.equal(localStorage.getItem(APPOINTMENTS_STORAGE_KEY), null, 'Stored appointments must be purged');
  assert.equal(localStorage.getItem(APPOINTMENTS_STATUS_OVERRIDES_KEY), null, 'Status overrides must be purged');
  assert.deepEqual(getAppointmentStatusOverrides(), {}, 'Status overrides accessor must return empty object');
});
