// src/utils/appointmentStorage.ts

export const APPOINTMENTS_STORAGE_KEY = 'omark_stored_appointments';
export const APPOINTMENTS_STATUS_OVERRIDES_KEY = 'omark_appointment_status_overrides';
export const DELETED_APPOINTMENTS_KEY = 'omark_deleted_appointment_ids';
export const APPOINTMENTS_CHANGE_EVENT = 'omark-appointments-changed';

let updateSettingsFn: ((payload: any) => Promise<any>) | null = null;

/**
 * Pluggable handler allowing settings API to receive updates without circular dependencies.
 */
export function setAppointmentSettingsHandlers(handler: (payload: any) => Promise<any>): void {
  updateSettingsFn = handler;
}

/**
 * Retrieves the set of appointment IDs that have been explicitly deleted.
 */
export function getDeletedAppointmentIds(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(DELETED_APPOINTMENTS_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed.map(String) : []);
  } catch {
    return new Set();
  }
}

/**
 * Permanently records an appointment ID as deleted across local storage and remote server settings.
 */
export function recordDeletedAppointmentId(id: string): void {
  if (!id || typeof window === 'undefined') return;
  try {
    const set = getDeletedAppointmentIds();
    set.add(String(id));
    const arr = Array.from(set);
    localStorage.setItem(DELETED_APPOINTMENTS_KEY, JSON.stringify(arr));
    window.dispatchEvent(new Event(APPOINTMENTS_CHANGE_EVENT));

    if (updateSettingsFn) {
      updateSettingsFn({ deletedAppointmentIds: arr }).catch(() => {});
    }
  } catch (err) {
    console.warn('Failed to record deleted appointment id:', err);
  }
}

/**
 * Permanently records a batch of appointment IDs as deleted across local storage and remote server settings.
 */
export function recordDeletedAppointmentIds(ids: string[]): void {
  if (!Array.isArray(ids) || ids.length === 0 || typeof window === 'undefined') return;
  try {
    const set = getDeletedAppointmentIds();
    ids.forEach((id) => {
      if (id) set.add(String(id));
    });
    const arr = Array.from(set);
    localStorage.setItem(DELETED_APPOINTMENTS_KEY, JSON.stringify(arr));
    window.dispatchEvent(new Event(APPOINTMENTS_CHANGE_EVENT));

    if (updateSettingsFn) {
      updateSettingsFn({ deletedAppointmentIds: arr }).catch(() => {});
    }
  } catch (err) {
    console.warn('Failed to record deleted appointment ids batch:', err);
  }
}

/**
 * Clears the deleted appointment IDs set (for testing or reset purposes).
 */
export function clearDeletedAppointmentIds(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(DELETED_APPOINTMENTS_KEY);
    window.dispatchEvent(new Event(APPOINTMENTS_CHANGE_EVENT));
  } catch (err) {
    console.warn('Failed to clear deleted appointment ids:', err);
  }
}

/**
 * Rehydrates deleted appointment IDs from the backend settings store.
 */
export function rehydrateDeletedAppointmentIdsFromSettings(settings: any): void {
  if (!settings || typeof settings !== 'object') return;
  const ids = settings.deletedAppointmentIds;
  if (Array.isArray(ids) && ids.length > 0) {
    try {
      const set = getDeletedAppointmentIds();
      let changed = false;
      ids.forEach((id) => {
        const strId = String(id);
        if (!set.has(strId)) {
          set.add(strId);
          changed = true;
        }
      });
      if (changed && typeof window !== 'undefined') {
        localStorage.setItem(DELETED_APPOINTMENTS_KEY, JSON.stringify(Array.from(set)));
        window.dispatchEvent(new Event(APPOINTMENTS_CHANGE_EVENT));
      }
    } catch (err) {
      console.warn('Failed to rehydrate deleted appointment ids from settings:', err);
    }
  }
}
