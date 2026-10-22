// src/utils/userPhotoStorage.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';

// Mock browser storage and globals
const store = new Map();
globalThis.localStorage = {
  getItem: (key) => store.get(key) || null,
  setItem: (key, val) => store.set(key, String(val)),
  removeItem: (key) => store.delete(key),
  clear: () => store.clear(),
  get length() {
    return store.size;
  },
  key: (index) => Array.from(store.keys())[index] || null,
};

globalThis.window = {
  dispatchEvent: () => {},
  addEventListener: () => {},
  removeEventListener: () => {},
};

const {
  getEntityPhoto,
  setEntityPhoto,
  removeEntityPhoto,
  rehydrateAvatarsFromSettings,
  rehydrateEntityPhotos,
  setPhotoApiHandlers,
  AVATAR_STORAGE_PREFIX,
} = await import('./userPhotoStorage.ts');

test('Avatar Storage: sets and retrieves staff and customer photos', () => {
  localStorage.clear();

  setEntityPhoto('customer', 'cust-101', 'https://example.com/cust101.jpg', false);
  setEntityPhoto('staff', 'staff-202', 'https://example.com/staff202.jpg', false);

  assert.equal(getEntityPhoto('customer', 'cust-101'), 'https://example.com/cust101.jpg');
  assert.equal(getEntityPhoto('staff', 'staff-202'), 'https://example.com/staff202.jpg');
  // staff and user are cross-matched interchangeably
  assert.equal(getEntityPhoto('user', 'staff-202'), 'https://example.com/staff202.jpg');
});

test('Cookie & Cache Wipe Resilience: photo is rehydrated from backend settings after clearing localStorage', () => {
  localStorage.clear();

  // Simulate remote settings payload stored on server PostgreSQL database
  const remoteSettings = {
    customerAvatars: {
      'cust-900': 'https://api.erp.omarkrealestate.com/uploads/customer-900.webp',
      'cust-901': 'https://api.erp.omarkrealestate.com/uploads/customer-901.webp',
    },
    userAvatars: {
      'user-500': 'https://api.erp.omarkrealestate.com/uploads/staff-500.webp',
    },
    entityAvatars: {
      'customer_cust-900': 'https://api.erp.omarkrealestate.com/uploads/customer-900.webp',
      'staff_user-500': 'https://api.erp.omarkrealestate.com/uploads/staff-500.webp',
    },
  };

  // Verify that prior to rehydration, localStorage is empty
  assert.equal(localStorage.getItem(`${AVATAR_STORAGE_PREFIX}customer_cust-900`), null);

  // Rehydrate from backend settings
  const count = rehydrateAvatarsFromSettings(remoteSettings);
  assert.ok(count >= 3);

  // Verify that customer and staff avatars are fully restored
  assert.equal(
    getEntityPhoto('customer', 'cust-900'),
    'https://api.erp.omarkrealestate.com/uploads/customer-900.webp'
  );
  assert.equal(
    getEntityPhoto('customer', 'cust-901'),
    'https://api.erp.omarkrealestate.com/uploads/customer-901.webp'
  );
  assert.equal(
    getEntityPhoto('staff', 'user-500'),
    'https://api.erp.omarkrealestate.com/uploads/staff-500.webp'
  );
  assert.equal(
    getEntityPhoto('user', 'user-500'),
    'https://api.erp.omarkrealestate.com/uploads/staff-500.webp'
  );
});

test('Entity Query Rehydration: rehydrates customer and user avatars from backend list queries', () => {
  localStorage.clear();

  const backendCustomers = [
    {
      id: 'cust-abc',
      firstName: 'Kwame',
      lastName: 'Mensah',
      avatarUrl: 'https://cdn.omark.com/kwame.png',
    },
    {
      id: 'cust-def',
      firstName: 'Akua',
      lastName: 'Agyemang',
      photoUrl: 'https://cdn.omark.com/akua.png',
    },
  ];

  rehydrateEntityPhotos('customer', backendCustomers);

  assert.equal(getEntityPhoto('customer', 'cust-abc'), 'https://cdn.omark.com/kwame.png');
  assert.equal(getEntityPhoto('customer', 'cust-def'), 'https://cdn.omark.com/akua.png');

  const backendStaff = [
    {
      id: 'staff-xyz',
      firstName: 'Cecilia',
      lastName: 'Donkor',
      profilePictureUrl: 'https://cdn.omark.com/cecilia.png',
    },
  ];

  rehydrateEntityPhotos('staff', backendStaff);

  assert.equal(getEntityPhoto('staff', 'staff-xyz'), 'https://cdn.omark.com/cecilia.png');
  assert.equal(getEntityPhoto('user', 'staff-xyz'), 'https://cdn.omark.com/cecilia.png');
});

test('Removal: removes entity photo and updates local storage and backend', () => {
  setEntityPhoto('customer', 'cust-remove-me', 'https://cdn.omark.com/temp.png', false);
  assert.equal(getEntityPhoto('customer', 'cust-remove-me'), 'https://cdn.omark.com/temp.png');

  removeEntityPhoto('customer', 'cust-remove-me', false);
  assert.equal(getEntityPhoto('customer', 'cust-remove-me'), undefined);
});

test('Backend Sync Handler: triggers pluggable persistence callback on photo update', async () => {
  let syncedEntityType = '';
  let syncedEntityId = '';
  let syncedUrl = '';

  setPhotoApiHandlers(async (type, id, url) => {
    syncedEntityType = type;
    syncedEntityId = id;
    syncedUrl = url;
  });

  setEntityPhoto('customer', 'cust-sync-test', 'https://example.com/sync.jpg', true);

  // Give short tick for sync
  await new Promise((resolve) => setTimeout(resolve, 50));

  assert.equal(syncedEntityType, 'customer');
  assert.equal(syncedEntityId, 'cust-sync-test');
  assert.equal(syncedUrl, 'https://example.com/sync.jpg');

  // Reset handler
  setPhotoApiHandlers(null);
});
