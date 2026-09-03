// src/utils/userPhotoStorage.ts

const AVATAR_STORAGE_PREFIX = 'omark_avatar_';

/**
 * Retrieves the stored persistent avatar photo URL for a given entity (staff, customer, user, etc.).
 */
export function getEntityPhoto(entityType: string, entityId: string | undefined): string | undefined {
  if (!entityId) return undefined;
  try {
    const directKey = `${AVATAR_STORAGE_PREFIX}${entityType}_${entityId}`;
    const stored = localStorage.getItem(directKey);
    if (stored) return stored;

    // Fallback cross-matching for user and staff types
    if (entityType === 'staff' || entityType === 'user') {
      const userKey = `${AVATAR_STORAGE_PREFIX}user_${entityId}`;
      const staffKey = `${AVATAR_STORAGE_PREFIX}staff_${entityId}`;
      return localStorage.getItem(userKey) || localStorage.getItem(staffKey) || undefined;
    }
  } catch (err) {
    console.error('Failed to get entity photo from storage:', err);
  }
  return undefined;
}

/**
 * Saves and broadcasts a persistent avatar photo URL for a given entity.
 */
export function setEntityPhoto(entityType: string, entityId: string | undefined, photoUrl: string): void {
  if (!entityId || !photoUrl) return;
  try {
    const directKey = `${AVATAR_STORAGE_PREFIX}${entityType}_${entityId}`;
    localStorage.setItem(directKey, photoUrl);

    if (entityType === 'staff' || entityType === 'user') {
      localStorage.setItem(`${AVATAR_STORAGE_PREFIX}user_${entityId}`, photoUrl);
      localStorage.setItem(`${AVATAR_STORAGE_PREFIX}staff_${entityId}`, photoUrl);
    }

    // Broadcast globally to trigger instant re-rendering across Header, Nav, Profile, Attendance, etc.
    window.dispatchEvent(
      new CustomEvent('omark-avatar-changed', {
        detail: { entityType, entityId, photoUrl },
      })
    );
  } catch (err) {
    console.error('Failed to persist entity photo:', err);
  }
}

/**
 * Deletes the stored persistent avatar photo URL for a given entity.
 */
export function removeEntityPhoto(entityType: string, entityId: string | undefined): void {
  if (!entityId) return;
  try {
    const directKey = `${AVATAR_STORAGE_PREFIX}${entityType}_${entityId}`;
    localStorage.removeItem(directKey);

    if (entityType === 'staff' || entityType === 'user') {
      localStorage.removeItem(`${AVATAR_STORAGE_PREFIX}user_${entityId}`);
      localStorage.removeItem(`${AVATAR_STORAGE_PREFIX}staff_${entityId}`);
    }

    // Broadcast removal event
    window.dispatchEvent(
      new CustomEvent('omark-avatar-changed', {
        detail: { entityType, entityId, photoUrl: undefined },
      })
    );
  } catch (err) {
    console.error('Failed to remove entity photo from storage:', err);
  }
}
