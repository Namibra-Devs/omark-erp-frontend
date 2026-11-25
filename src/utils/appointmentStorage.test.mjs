import test from 'node:test';
import assert from 'node:assert/strict';

// Mock localStorage for Node test environment
const mockStorage = new Map();
globalThis.localStorage = {
  getItem: (key) => mockStorage.get(key) || null,
  setItem: (key, val) => mockStorage.set(key, String(val)),
  removeItem: (key) => mockStorage.delete(key),
  clear: () => mockStorage.clear(),
};
globalThis.window = {
  dispatchEvent: () => true,
};
globalThis.Event = class Event {};

test('getDeletedAppointmentIds returns empty set when storage empty', async () => {
  mockStorage.clear();
  const { getDeletedAppointmentIds } = await import('./appointmentStorage.ts');
  const set = getDeletedAppointmentIds();
  assert.equal(set.size, 0);
});

test('recordDeletedAppointmentId adds id and persists to localStorage', async () => {
  mockStorage.clear();
  const { getDeletedAppointmentIds, recordDeletedAppointmentId } = await import('./appointmentStorage.ts');
  recordDeletedAppointmentId('appt-123');
  const set = getDeletedAppointmentIds();
  assert.equal(set.has('appt-123'), true);
  assert.equal(set.size, 1);
});

test('recordDeletedAppointmentIds adds batch of ids', async () => {
  mockStorage.clear();
  const { getDeletedAppointmentIds, recordDeletedAppointmentIds } = await import('./appointmentStorage.ts');
  recordDeletedAppointmentIds(['appt-1', 'appt-2', 'appt-3']);
  const set = getDeletedAppointmentIds();
  assert.equal(set.has('appt-1'), true);
  assert.equal(set.has('appt-2'), true);
  assert.equal(set.has('appt-3'), true);
  assert.equal(set.size, 3);
});

test('rehydrateDeletedAppointmentIdsFromSettings synchronizes from settings payload', async () => {
  mockStorage.clear();
  const { getDeletedAppointmentIds, rehydrateDeletedAppointmentIdsFromSettings } = await import('./appointmentStorage.ts');
  rehydrateDeletedAppointmentIdsFromSettings({
    deletedAppointmentIds: ['server-appt-a', 'server-appt-b'],
  });
  const set = getDeletedAppointmentIds();
  assert.equal(set.has('server-appt-a'), true);
  assert.equal(set.has('server-appt-b'), true);
  assert.equal(set.size, 2);
});

test('clearDeletedAppointmentIds removes all tracked deleted ids', async () => {
  mockStorage.clear();
  const { getDeletedAppointmentIds, recordDeletedAppointmentId, clearDeletedAppointmentIds } = await import('./appointmentStorage.ts');
  recordDeletedAppointmentId('temp-1');
  assert.equal(getDeletedAppointmentIds().size, 1);
  clearDeletedAppointmentIds();
  assert.equal(getDeletedAppointmentIds().size, 0);
});
