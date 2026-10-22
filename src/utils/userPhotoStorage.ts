// src/utils/userPhotoStorage.ts

export const AVATAR_STORAGE_PREFIX = 'omark_avatar_';
export const AVATAR_DB_NAME = 'omark_erp_avatars_db';
export const AVATAR_STORE_NAME = 'avatars';

// In-memory cache for ultra-fast 0ms lookups across render cycles
const memoryAvatarCache = new Map<string, string>();

// Pluggable sync handlers for backend persistence and testing
export type DirectPhotoSyncHandler = (entityType: string, entityId: string, photoUrl: string | undefined) => Promise<any>;
export type FetchSettingsHandler = () => Promise<any>;
export type UpdateSettingsHandler = (payload: any) => Promise<any>;

let customDirectSyncHandler: DirectPhotoSyncHandler | null = null;
let customFetchSettingsHandler: FetchSettingsHandler | null = null;
let customUpdateSettingsHandler: UpdateSettingsHandler | null = null;

export function setPhotoSettingsHandlers(
  fetchFn: FetchSettingsHandler | null,
  updateFn: UpdateSettingsHandler | null,
  directSyncFn?: DirectPhotoSyncHandler | null
) {
  customFetchSettingsHandler = fetchFn;
  customUpdateSettingsHandler = updateFn;
  if (directSyncFn !== undefined) {
    customDirectSyncHandler = directSyncFn;
  }
}

export function setPhotoApiHandlers(
  syncHandler: DirectPhotoSyncHandler | null,
  fetchFn?: FetchSettingsHandler | null,
  updateFn?: UpdateSettingsHandler | null
) {
  customDirectSyncHandler = syncHandler;
  if (fetchFn !== undefined) customFetchSettingsHandler = fetchFn;
  if (updateFn !== undefined) customUpdateSettingsHandler = updateFn;
}

// ── IndexedDB Durable Persistence Layer ─────────────────────────────────────
function openAvatarDB(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    try {
      const request = window.indexedDB.open(AVATAR_DB_NAME, 1);
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(AVATAR_STORE_NAME)) {
          db.createObjectStore(AVATAR_STORE_NAME, { keyPath: 'id' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        console.warn('[Avatar IDB] Error opening database:', request.error);
        resolve(null);
      };
    } catch {
      resolve(null);
    }
  });
}

export async function getIndexedDBAvatars(): Promise<Array<{ id: string; entityType: string; entityId: string; photoUrl: string }> | null> {
  try {
    const db = await openAvatarDB();
    if (!db) return null;
    return new Promise((resolve) => {
      const tx = db.transaction(AVATAR_STORE_NAME, 'readonly');
      const store = tx.objectStore(AVATAR_STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => resolve(Array.isArray(req.result) ? req.result : []);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

async function setIndexedDBAvatar(entityType: string, entityId: string, photoUrl: string): Promise<void> {
  try {
    const db = await openAvatarDB();
    if (!db) return;
    return new Promise((resolve) => {
      const tx = db.transaction(AVATAR_STORE_NAME, 'readwrite');
      const store = tx.objectStore(AVATAR_STORE_NAME);
      store.put({
        id: `${entityType}_${entityId}`,
        entityType,
        entityId,
        photoUrl,
        updatedAt: new Date().toISOString(),
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {}
}

async function deleteIndexedDBAvatar(entityType: string, entityId: string): Promise<void> {
  try {
    const db = await openAvatarDB();
    if (!db) return;
    return new Promise((resolve) => {
      const tx = db.transaction(AVATAR_STORE_NAME, 'readwrite');
      const store = tx.objectStore(AVATAR_STORE_NAME);
      store.delete(`${entityType}_${entityId}`);
      if (entityType === 'staff' || entityType === 'user') {
        store.delete(`user_${entityId}`);
        store.delete(`staff_${entityId}`);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {}
}

// ── Remote Settings Synchronization ─────────────────────────────────────────
let settingsSyncTimer: any = null;
const pendingSettingsUpdates = new Map<string, string | null>();

function scheduleSettingsAvatarSync(entityType: string, entityId: string, photoUrl: string | undefined): void {
  const compositeKey = `${entityType}_${entityId}`;
  pendingSettingsUpdates.set(compositeKey, photoUrl || null);

  if (entityType === 'staff' || entityType === 'user') {
    pendingSettingsUpdates.set(`staff_${entityId}`, photoUrl || null);
    pendingSettingsUpdates.set(`user_${entityId}`, photoUrl || null);
  }

  if (settingsSyncTimer) clearTimeout(settingsSyncTimer);
  settingsSyncTimer = setTimeout(async () => {
    try {
      const updateFn = customUpdateSettingsHandler;
      const fetchFn = customFetchSettingsHandler;

      if (!updateFn) return;

      let currentSettings: any = {};
      if (fetchFn) {
        currentSettings = (await fetchFn().catch(() => ({}))) || {};
      }

      const currentEntityAvatars: Record<string, string> = { ...(currentSettings?.entityAvatars || {}) };
      const currentCustomerAvatars: Record<string, string> = { ...(currentSettings?.customerAvatars || {}) };
      const currentUserAvatars: Record<string, string> = { ...(currentSettings?.userAvatars || {}) };

      for (const [key, url] of pendingSettingsUpdates.entries()) {
        const [type, id] = key.split('_');
        if (!id) continue;

        if (url) {
          currentEntityAvatars[key] = url;
          if (type === 'customer') {
            currentCustomerAvatars[id] = url;
          } else if (type === 'staff' || type === 'user') {
            currentUserAvatars[id] = url;
          }
        } else {
          delete currentEntityAvatars[key];
          if (type === 'customer') {
            delete currentCustomerAvatars[id];
          } else if (type === 'staff' || type === 'user') {
            delete currentUserAvatars[id];
          }
        }
      }
      pendingSettingsUpdates.clear();

      await updateFn({
        entityAvatars: currentEntityAvatars,
        customerAvatars: currentCustomerAvatars,
        userAvatars: currentUserAvatars,
      });
    } catch (err) {
      console.warn('[userPhotoStorage] Backend settings avatar sync error:', err);
    }
  }, 250);
}

/**
 * Persists an entity avatar to both direct entity endpoints (PATCH /users, PATCH /customers)
 * and the authoritative PostgreSQL database key-value store (/settings).
 */
export async function syncPhotoToBackend(entityType: string, entityId: string, photoUrl: string | undefined): Promise<void> {
  if (!entityId) return;

  if (customDirectSyncHandler) {
    try {
      await customDirectSyncHandler(entityType, entityId, photoUrl);
    } catch (err) {
      console.warn('[userPhotoStorage] Custom direct sync handler notice:', err);
    }
  }

  // Server PostgreSQL Settings Store (/settings)
  scheduleSettingsAvatarSync(entityType, entityId, photoUrl);
}

// ── Core Retrieval & Storage APIs ───────────────────────────────────────────

/**
 * Retrieves the stored persistent avatar photo URL for a given entity (staff, customer, user, etc.).
 */
export function getEntityPhoto(entityType: string, entityId: string | undefined): string | undefined {
  if (!entityId) return undefined;

  const directKey = `${AVATAR_STORAGE_PREFIX}${entityType}_${entityId}`;
  const mem = memoryAvatarCache.get(directKey);
  if (mem) return mem;

  try {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem(directKey);
      if (stored) {
        memoryAvatarCache.set(directKey, stored);
        return stored;
      }

      // Fallback cross-matching for user and staff types
      if (entityType === 'staff' || entityType === 'user') {
        const userKey = `${AVATAR_STORAGE_PREFIX}user_${entityId}`;
        const staffKey = `${AVATAR_STORAGE_PREFIX}staff_${entityId}`;
        const crossStored = localStorage.getItem(userKey) || localStorage.getItem(staffKey) || undefined;
        if (crossStored) {
          memoryAvatarCache.set(directKey, crossStored);
          return crossStored;
        }
      }
    }
  } catch (err) {
    console.error('Failed to get entity photo from storage:', err);
  }

  // Memory fallback for staff/user cross-matching
  if (entityType === 'staff' || entityType === 'user') {
    const userMem = memoryAvatarCache.get(`${AVATAR_STORAGE_PREFIX}user_${entityId}`);
    const staffMem = memoryAvatarCache.get(`${AVATAR_STORAGE_PREFIX}staff_${entityId}`);
    return userMem || staffMem || undefined;
  }

  return undefined;
}

/**
 * Saves, broadcasts, and syncs a persistent avatar photo URL for a given entity.
 */
export function setEntityPhoto(
  entityType: string,
  entityId: string | undefined,
  photoUrl: string,
  syncRemote: boolean = true
): void {
  if (!entityId || !photoUrl) return;

  const directKey = `${AVATAR_STORAGE_PREFIX}${entityType}_${entityId}`;
  memoryAvatarCache.set(directKey, photoUrl);

  if (entityType === 'staff' || entityType === 'user') {
    memoryAvatarCache.set(`${AVATAR_STORAGE_PREFIX}user_${entityId}`, photoUrl);
    memoryAvatarCache.set(`${AVATAR_STORAGE_PREFIX}staff_${entityId}`, photoUrl);
  }

  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(directKey, photoUrl);
      if (entityType === 'staff' || entityType === 'user') {
        localStorage.setItem(`${AVATAR_STORAGE_PREFIX}user_${entityId}`, photoUrl);
        localStorage.setItem(`${AVATAR_STORAGE_PREFIX}staff_${entityId}`, photoUrl);
      }
    }

    // Persist to client-side IndexedDB for resilient offline availability
    setIndexedDBAvatar(entityType, entityId, photoUrl).catch(() => {});

    // Broadcast globally to trigger instant re-rendering across Header, Nav, Profile, Attendance, Tables, etc.
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(
        new CustomEvent('omark-avatar-changed', {
          detail: { entityType, entityId, photoUrl },
        })
      );
    }

    // Persist to backend database so clearing cookies/cache never loses photos
    if (syncRemote) {
      syncPhotoToBackend(entityType, entityId, photoUrl).catch(() => {});
    }
  } catch (err) {
    console.error('Failed to persist entity photo:', err);
  }
}

/**
 * Deletes the stored persistent avatar photo URL for a given entity.
 */
export function removeEntityPhoto(
  entityType: string,
  entityId: string | undefined,
  syncRemote: boolean = true
): void {
  if (!entityId) return;

  const directKey = `${AVATAR_STORAGE_PREFIX}${entityType}_${entityId}`;
  memoryAvatarCache.delete(directKey);

  if (entityType === 'staff' || entityType === 'user') {
    memoryAvatarCache.delete(`${AVATAR_STORAGE_PREFIX}user_${entityId}`);
    memoryAvatarCache.delete(`${AVATAR_STORAGE_PREFIX}staff_${entityId}`);
  }

  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(directKey);
      if (entityType === 'staff' || entityType === 'user') {
        localStorage.removeItem(`${AVATAR_STORAGE_PREFIX}user_${entityId}`);
        localStorage.removeItem(`${AVATAR_STORAGE_PREFIX}staff_${entityId}`);
      }
    }

    // Remove from IndexedDB
    deleteIndexedDBAvatar(entityType, entityId).catch(() => {});

    // Broadcast removal event
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(
        new CustomEvent('omark-avatar-changed', {
          detail: { entityType, entityId, photoUrl: undefined },
        })
      );
    }

    // Remove from backend database
    if (syncRemote) {
      syncPhotoToBackend(entityType, entityId, undefined).catch(() => {});
    }
  } catch (err) {
    console.error('Failed to remove entity photo from storage:', err);
  }
}

// ── Rehydration Engines ─────────────────────────────────────────────────────

/**
 * Restores avatars from backend /settings (PostgreSQL database) into memory and local storage.
 * Called automatically when settings query finishes or after a cookie/cache wipe.
 */
export function rehydrateAvatarsFromSettings(settings: any): number {
  if (!settings || typeof settings !== 'object') return 0;
  let rehydratedCount = 0;

  // 1. entityAvatars map: { "customer_123": "https://...", "staff_456": "https://..." }
  if (settings.entityAvatars && typeof settings.entityAvatars === 'object') {
    for (const [compositeKey, url] of Object.entries(settings.entityAvatars)) {
      if (typeof url === 'string' && url) {
        const parts = compositeKey.split('_');
        const entityType = parts[0];
        const entityId = parts.slice(1).join('_');
        if (entityType && entityId) {
          setEntityPhoto(entityType, entityId, url, false);
          rehydratedCount++;
        }
      }
    }
  }

  // 2. customerAvatars map: { "123": "https://..." }
  if (settings.customerAvatars && typeof settings.customerAvatars === 'object') {
    for (const [customerId, url] of Object.entries(settings.customerAvatars)) {
      if (typeof url === 'string' && url) {
        setEntityPhoto('customer', customerId, url, false);
        rehydratedCount++;
      }
    }
  }

  // 3. userAvatars map: { "456": "https://..." }
  if (settings.userAvatars && typeof settings.userAvatars === 'object') {
    for (const [userId, url] of Object.entries(settings.userAvatars)) {
      if (typeof url === 'string' && url) {
        setEntityPhoto('staff', userId, url, false);
        setEntityPhoto('user', userId, url, false);
        rehydratedCount++;
      }
    }
  }

  return rehydratedCount;
}

/**
 * Rehydrates avatars from an array of backend entities (e.g. users from /users or customers from /customers).
 */
export function rehydrateEntityPhotos(entityType: string, entities: Array<any>): number {
  if (!Array.isArray(entities) || entities.length === 0) return 0;
  let count = 0;
  for (const item of entities) {
    if (!item || !item.id) continue;
    const url = item.avatarUrl || item.photoUrl || item.profilePictureUrl;
    if (typeof url === 'string' && url.trim().length > 0) {
      setEntityPhoto(entityType, item.id, url.trim(), false);
      count++;
    }
  }
  return count;
}

/**
 * Bootstraps and restores photo storage on startup or after cache wipe.
 */
export async function initPhotoStorage(): Promise<void> {
  if (typeof window === 'undefined') return;

  // 1. Check if localStorage has any avatar keys
  let hasLocalAvatars = false;
  try {
    if (typeof localStorage !== 'undefined') {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(AVATAR_STORAGE_PREFIX)) {
          hasLocalAvatars = true;
          break;
        }
      }
    }
  } catch {}

  // 2. If localStorage was cleared (e.g., user cleared cookies/cached data),
  // recover immediately from IndexedDB
  if (!hasLocalAvatars) {
    try {
      const idbAvatars = await getIndexedDBAvatars();
      if (idbAvatars && idbAvatars.length > 0) {
        for (const item of idbAvatars) {
          if (item && item.entityType && item.entityId && item.photoUrl) {
            setEntityPhoto(item.entityType, item.entityId, item.photoUrl, false);
          }
        }
      }
    } catch (idbErr) {
      console.warn('[userPhotoStorage] IDB recovery notice:', idbErr);
    }
  }

  // 3. Asynchronously load remote avatars from authoritative PostgreSQL /settings
  try {
    const fetchFn = customFetchSettingsHandler;
    if (fetchFn) {
      const settings = await fetchFn();
      if (settings) {
        rehydrateAvatarsFromSettings(settings);
      }
    }
  } catch (err) {
    // Graceful offline fallback
  }
}

export const getPhoto = getEntityPhoto;
export const setPhoto = setEntityPhoto;
export const removePhoto = removeEntityPhoto;
