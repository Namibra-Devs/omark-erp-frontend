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
  setPhotoSettingsHandlers,
  syncPhotoToBackendImmediate,
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

test('Staff Dashboard Persistence: avatar in userAssignments persists across localStorage wipe', () => {
  localStorage.clear();

  // Staff updates avatar on dashboard
  setEntityPhoto('staff', 'staff-999', 'https://example.com/staff999.png', false);

  assert.equal(getEntityPhoto('staff', 'staff-999'), 'https://example.com/staff999.png');

  // Verify it synced into user assignments
  const rawAssign = localStorage.getItem('omark_user_assignments');
  assert.ok(rawAssign);
  const parsed = JSON.parse(rawAssign);
  assert.equal(parsed['staff-999']?.avatarUrl, 'https://example.com/staff999.png');

  // Clear cache / localStorage (simulating user clearing cached data)
  localStorage.clear();
  assert.equal(localStorage.getItem('omark_avatar_staff_staff-999'), null);

  // Settings from backend (or recovered store) with userAssignments
  const remoteSettings = {
    userAssignments: {
      'staff-999': {
        userId: 'staff-999',
        firstName: 'Staff',
        lastName: 'Member',
        avatarUrl: 'https://example.com/staff999.png',
      },
    },
  };

  rehydrateAvatarsFromSettings(remoteSettings);

  // Avatar must be restored!
  assert.equal(getEntityPhoto('staff', 'staff-999'), 'https://example.com/staff999.png');
});

test('Immediate Remote Avatar Sync: synchronizes immediately without debounce delay', async () => {
  let updatedSettings = null;
  setPhotoSettingsHandlers(
    async () => ({}),
    async (payload) => {
      updatedSettings = payload;
      return payload;
    }
  );

  await syncPhotoToBackendImmediate('staff', 'staff-imm-1', 'https://example.com/imm.png');
  assert.ok(updatedSettings);
  assert.equal(updatedSettings.userAvatars['staff-imm-1'], 'https://example.com/imm.png');

  setPhotoSettingsHandlers(null, null);
});

test('Staff Dashboard Remote Record Persistence: restores staff avatar and profile across full client storage wipe', async () => {
  localStorage.clear();

  // Simulate a remote staff record stored in PostgreSQL on api.erp.omarkrealestate.com
  const staffUserId = '6aa3f78b-elizabeth';
  const remoteAvatarUrl = 'https://api.erp.omarkrealestate.com/uploads/1762543-elizabeth.png';

  // Initially storage is empty
  assert.equal(getEntityPhoto('staff', staffUserId), undefined);

  // Directly set photo simulating staff update
  setEntityPhoto('staff', staffUserId, remoteAvatarUrl, false);
  assert.equal(getEntityPhoto('staff', staffUserId), remoteAvatarUrl);

  // Simulate user clearing browsing cache & site data (wipes localStorage completely)
  localStorage.clear();
  assert.equal(localStorage.getItem(`${AVATAR_STORAGE_PREFIX}staff_${staffUserId}`), null);

  // Simulate rehydrating from remote server record
  const mockServerRecord = {
    userAvatars: {
      [staffUserId]: remoteAvatarUrl,
    },
    userAssignments: {
      [staffUserId]: {
        userId: staffUserId,
        avatarUrl: remoteAvatarUrl,
        firstName: 'Elizabeth',
        lastName: 'Serwaa',
        phoneNumber: '+233547009973',
      },
    },
  };

  rehydrateAvatarsFromSettings(mockServerRecord);

  // Verify that after cache wipe, the avatar is restored permanently
  assert.equal(getEntityPhoto('staff', staffUserId), remoteAvatarUrl);
  assert.equal(getEntityPhoto('user', staffUserId), remoteAvatarUrl);
});
