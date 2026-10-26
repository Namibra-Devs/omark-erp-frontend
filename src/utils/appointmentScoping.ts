// src/utils/appointmentScoping.ts
/**
 * ============================================================================
 * INTERIM APPOINTMENT SCOPING ADAPTER
 * ============================================================================
 * NOTE: This client-side scoping module acts as an interim adapter aligning
 * frontend views with the backend specification documented in
 * docs/MISSING_ENDPOINTS.md.
 *
 * Once the backend release enforcing role-based scoping is live, this adapter
 * becomes a harmless no-op when VITE_APPOINTMENTS_SERVER_SCOPED=true.
 * The backend remains the single source of truth for authorization.
 * ============================================================================
 */

import type { Appointment, Role, User, Interaction } from '../types/index.ts';

export type VisibleStaffScope = 'all' | string[];

/**
 * Checks whether the backend is already server-scoping appointments.
 * When enabled via VITE_APPOINTMENTS_SERVER_SCOPED='true', client-side filtering
 * is skipped and server results are used directly (deduplicated by ID).
 */
export const isServerScopingEnabled = (): boolean => {
  try {
    // In Vite browser environments
    if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_APPOINTMENTS_SERVER_SCOPED) {
      return import.meta.env.VITE_APPOINTMENTS_SERVER_SCOPED === 'true';
    }
  } catch (_) {}
  try {
    // In Node test / script environments
    const gProcess = (globalThis as any).process;
    if (typeof gProcess !== 'undefined' && gProcess?.env?.VITE_APPOINTMENTS_SERVER_SCOPED) {
      return gProcess.env.VITE_APPOINTMENTS_SERVER_SCOPED === 'true';
    }
  } catch (_) {}
  return false;
};

/**
 * Returns the creator user ID for an appointment.
 * Reads createdByUserId / createdBy first.
 * Then (strong tier only) checks the linked interaction's loggedByUserId.
 * 
 * NEVER falls back to prospect owner, customer owner, staffId, or assignedUserId.
 */
export function getAppointmentCreatorId(
  appointment: Partial<Appointment> | Record<string, any> | null | undefined,
  allInteractions?: Array<Partial<Interaction> | Record<string, any>> | null
): string | undefined {
  if (!appointment) return undefined;

  // 1. Direct creator property on appointment record
  const directId =
    (appointment as any).createdBy ||
    appointment.createdByUserId ||
    (appointment as any).created_by ||
    (appointment as any).created_by_user_id ||
    (appointment as any).creatorUserId ||
    (appointment as any).creatorId;

  if (directId && typeof directId === 'string' && directId.trim().length > 0) {
    return directId.trim();
  }

  // 2. Strong tier: Linked interaction's loggedByUserId
  if (Array.isArray(allInteractions) && allInteractions.length > 0 && appointment.id) {
    const apptIdStr = String(appointment.id);
    const matchedInteraction = allInteractions.find((i) => {
      if (!i) return false;
      const iApptId = i.appointmentId ? String(i.appointmentId) : undefined;
      const iId = i.id ? String(i.id) : undefined;
      return iApptId === apptIdStr || iId === apptIdStr;
    });

    if (matchedInteraction) {
      const loggedById =
        matchedInteraction.loggedByUserId ||
        (matchedInteraction as any).logged_by_user_id ||
        (matchedInteraction as any).userId;
      if (loggedById && typeof loggedById === 'string' && loggedById.trim().length > 0) {
        return loggedById.trim();
      }
    }
  }

  // If appointment contains an embedded interaction object
  if ((appointment as any).interaction) {
    const embeddedLoggedBy =
      (appointment as any).interaction.loggedByUserId ||
      (appointment as any).interaction.logged_by_user_id;
    if (embeddedLoggedBy && typeof embeddedLoggedBy === 'string' && embeddedLoggedBy.trim().length > 0) {
      return embeddedLoggedBy.trim();
    }
  }

  // Never fall back to prospect owner, customer owner, staffId, or assignedUserId.
  return undefined;
}

/**
 * Determines which staff IDs' appointments the given user is permitted to see.
 * - Admin and Secretary (`role IN ('admin', 'super_admin', 'secretary')`) → 'all' (unrestricted)
 * - Marketing Director (`role === 'marketing_director'`) → [self, ...marketing_staff IDs]
 * - Everyone else (branch_manager, customer_service, accounts, marketing_staff, unknown role) → [self]
 * - Unknown or missing role defaults to own-only, NEVER to all.
 */
export function getVisibleStaffIds(
  user: { id?: string; role?: Role | string } | null | undefined,
  allUsers: Array<{ id: string; role?: Role | string }> = []
): VisibleStaffScope {
  if (!user || !user.id) return [];

  const role = user.role;

  // Admin and Secretary run the office with unrestricted access across all staff and website bookings
  if (role === 'admin' || role === 'super_admin' || role === 'secretary') {
    return 'all';
  }

  // Marketing Director sees own appointments + appointments created by every user with role === 'marketing_staff'
  if (role === 'marketing_director') {
    const marketingStaffIds = allUsers
      .filter((u) => u && u.id && u.role === 'marketing_staff')
      .map((u) => String(u.id));
    const uniqueIds = new Set<string>([String(user.id), ...marketingStaffIds]);
    return Array.from(uniqueIds);
  }

  // Everyone else: strictly own-only
  return [String(user.id)];
}

/**
 * Checks whether a single appointment record can be read/accessed by the given user.
 * - Admin and Secretary: unrestricted (returns true for any appointment doc, including unassigned website bookings).
 * - Marketing Director: can access own appointments and appointments created by marketing_staff.
 * - Everyone else: only appointments they created.
 */
export function canAccessAppointmentDoc(
  appointment: Partial<Appointment> | Record<string, any> | null | undefined,
  user: { id?: string; role?: Role | string } | null | undefined,
  allUsers: Array<{ id: string; role?: Role | string }> = [],
  allInteractions?: Array<Partial<Interaction> | Record<string, any>> | null
): boolean {
  if (!user || !user.id || !appointment) return false;
  const role = user.role;

  // Admin and Secretary run the office with unrestricted access
  if (role === 'admin' || role === 'super_admin' || role === 'secretary') {
    return true;
  }

  const creatorId = getAppointmentCreatorId(appointment, allInteractions);
  if (!creatorId) {
    // Unassigned appointments (e.g. website bookings) are accessible only by unrestricted roles (admin/secretary)
    return false;
  }

  const visibleScope = getVisibleStaffIds(user, allUsers);
  if (visibleScope === 'all') return true;
  return visibleScope.includes(creatorId);
}

/**
 * Checks if an appointment is editable / cancelable / reschedulable by the given user.
 * Note: Secretary and Marketing Director can read records they cannot edit:
 * - PATCH /appointments/:id is on admin and customer_service only.
 * - Admin can edit any appointment.
 * - Creator can edit own appointment.
 * - Marketing Director can edit marketing staff appointments.
 * - Secretary cannot edit other staff's appointments.
 */
export function isAppointmentEditableByUser(
  appointment: Partial<Appointment> | Record<string, any> | null | undefined,
  user: { id?: string; role?: Role | string } | null | undefined,
  allUsers: Array<{ id: string; role?: Role | string }> = [],
  allInteractions?: Array<Partial<Interaction> | Record<string, any>> | null
): boolean {
  if (!user || !user.id || !appointment) return false;
  if (user.role === 'admin' || user.role === 'super_admin') return true;

  const creatorId = getAppointmentCreatorId(appointment, allInteractions);
  if (!creatorId) return false;

  // Creator can edit their own appointment
  if (creatorId === user.id) return true;

  // Marketing Director can edit marketing staff appointments
  if (user.role === 'marketing_director') {
    const marketingStaffIds = allUsers
      .filter((u) => u && u.id && u.role === 'marketing_staff')
      .map((u) => String(u.id));
    return marketingStaffIds.includes(creatorId);
  }

  // Secretary and other staff cannot edit other staff's appointments
  return false;
}

/**
 * Filters a list of appointments according to the user's role scope.
 * 
 * Rules:
 * 1. Visibility is by creator only, never by assigned host.
 * 2. Admin and Secretary see all appointments (including unassigned/website).
 * 3. Marketing Director sees own + marketing_staff's appointments.
 * 4. Other staff see only their own appointments.
 * 5. Appointments with NO creator (website bookings / orphans) appear ONLY for Admin and Secretary.
 * 6. De-duplicates strictly by appointment `id` so nothing renders twice.
 */
export function filterAppointmentsByScope<T extends { id: string }>(
  appointments: T[] | null | undefined,
  user: { id?: string; role?: Role | string } | null | undefined,
  allUsers: Array<{ id: string; role?: Role | string }> = [],
  allInteractions?: Array<Partial<Interaction> | Record<string, any>> | null
): T[] {
  if (!Array.isArray(appointments) || appointments.length === 0) {
    return [];
  }

  // Deduplicate input list by id first
  const seenIds = new Set<string>();
  const uniqueAppointments: T[] = [];
  for (const appt of appointments) {
    if (!appt || !appt.id) continue;
    const idStr = String(appt.id);
    if (!seenIds.has(idStr)) {
      seenIds.add(idStr);
      uniqueAppointments.push(appt);
    }
  }

  // If server scoping is enabled and active, return deduplicated appointments directly
  if (isServerScopingEnabled()) {
    return uniqueAppointments;
  }

  if (!user || !user.id) {
    return [];
  }

  const visibleScope = getVisibleStaffIds(user, allUsers);

  // Admin and Secretary see all appointments, including unassigned website bookings
  if (visibleScope === 'all') {
    return uniqueAppointments;
  }

  // Scoped view for Marketing Director and other staff:
  // Must match creatorId against allowed visible staff IDs.
  // Appointments without a creator (e.g. unassigned website bookings) are excluded.
  const allowedSet = new Set(visibleScope);

  return uniqueAppointments.filter((appt) => {
    const creatorId = getAppointmentCreatorId(appt, allInteractions);
    if (!creatorId) {
      // Unassigned appointments are visible only to Admin
      return false;
    }
    return allowedSet.has(creatorId);
  });
}
