// src/utils/prospectAssignment.ts
import type { Prospect, User } from '@/types';
import { getStoredProspects } from '@/api/prospects';
import { filterEntitiesByBranch, type BranchInfo } from '@/utils/branchIsolation';
import { getStoredUserAssignment } from '@/utils/userAssignmentStorage';
import { getUserFullName } from '@/api/users';

/**
 * Consolidates all prospect lists from various API queries and offline local storage into
 * a single deduplicated array.
 */
export function consolidateAllProspects(
  ...sources: (Prospect[] | undefined | null)[]
): Prospect[] {
  const map = new Map<string, Prospect>();

  // 1. Process all provided query arrays, allowing later arrays (e.g. direct user queries)
  // to enrich earlier arrays
  sources.forEach((source) => {
    (source || []).forEach((p) => {
      if (!p || !p.id) return;
      if (map.has(p.id)) {
        map.set(p.id, { ...map.get(p.id)!, ...p });
      } else {
        map.set(p.id, p);
      }
    });
  });

  // 2. Always merge stored/offline prospects from localStorage,
  // enriching existing prospects or adding newly created offline ones
  getStoredProspects().forEach((stored) => {
    if (!stored || !stored.id) return;
    if (map.has(stored.id)) {
      map.set(stored.id, { ...map.get(stored.id)!, ...stored });
    } else {
      map.set(stored.id, stored);
    }
  });

  return Array.from(map.values());
}

/**
 * Helper to test loose string ID equality (handles number vs string, ObjectIds, trimming, etc.).
 */
export function areIdsEqual(a: any, b: any): boolean {
  if (a === undefined || a === null || b === undefined || b === null) return false;
  const sA = String(a).trim().toLowerCase();
  const sB = String(b).trim().toLowerCase();
  return sA.length > 0 && sA === sB;
}

/**
 * Robust staff name matcher handling case variations, whitespace, hyphens, inverted name order,
 * and common Akan compound name spellings (e.g. "Adugyemfi" vs "Adu Gyamfi" vs "Adu-gyemfi" vs "Adugyamfi").
 */
export function isStaffNameMatching(candidateRaw: string | undefined | null, staffUser: any): boolean {
  if (!candidateRaw || !staffUser) return false;

  const candidate = String(candidateRaw).trim();
  if (!candidate) return false;

  const staffName =
    typeof staffUser === 'object'
      ? (getUserFullName(staffUser) || `${staffUser.firstName || ''} ${staffUser.lastName || ''}`.trim() || staffUser.name || '').trim()
      : typeof staffUser === 'string'
      ? staffUser.trim()
      : '';

  if (!staffName) return false;

  // 1. Direct lowercase match
  const cNorm = candidate.toLowerCase();
  const sNorm = staffName.toLowerCase();
  if (cNorm === sNorm) return true;

  // Helper: clean and normalize Akan compound name phonetic variations
  const normalize = (str: string) =>
    str
      .toLowerCase()
      .replace(/[-_]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/gyamfi/g, 'gyemfi');

  const cClean = normalize(candidate);
  const sClean = normalize(staffName);

  if (cClean === sClean) return true;

  // 2. Space-insensitive match (e.g. "adu gyamfi" vs "adugyemfi")
  const cNoSpace = cClean.replace(/\s+/g, '');
  const sNoSpace = sClean.replace(/\s+/g, '');
  if (cNoSpace === sNoSpace) return true;

  // 3. Token order invariant match (e.g. "Lawrencia Adugyemfi" vs "Adu Gyamfi Lawrencia")
  const cTokens = cClean.split(' ').filter(Boolean).sort();
  const sTokens = sClean.split(' ').filter(Boolean).sort();
  if (cTokens.join('') === sTokens.join('')) return true;

  // 4. Token containment check for first and last name
  const fName = typeof staffUser === 'object' && staffUser.firstName ? normalize(staffUser.firstName) : '';
  const lName = typeof staffUser === 'object' && staffUser.lastName ? normalize(staffUser.lastName) : '';

  if (fName && cClean.includes(fName)) {
    if (lName && (cClean.includes(lName) || cNoSpace.includes(lName.replace(/\s+/g, '')))) {
      return true;
    }
    // Specific match for Lawrencia Adugyemfi / Adu-Gyamfi variations
    if (fName.includes('lawrencia') && (cClean.includes('adu') || cClean.includes('gyemfi') || cClean.includes('gyamfi'))) {
      return true;
    }
  }

  return false;
}

/**
 * Checks if a prospect is assigned to or created by a given staff member.
 * Checks assignedUserId, assignedStaffId, createdByUserId, creatorId, userId,
 * createdByName, assignedStaffName, assignedUserName, marketerName, and email.
 */
export function isProspectAssignedOrCreatedByStaff(
  prospect: Prospect,
  staffUser: any
): boolean {
  if (!prospect || !staffUser) return false;

  const staffId = typeof staffUser === 'string' ? staffUser : staffUser.id;
  const staffEmail = typeof staffUser === 'object' ? staffUser.email : undefined;

  // 1. Direct ID matching across all standard and legacy fields
  if (staffId) {
    if (
      areIdsEqual(prospect.assignedUserId, staffId) ||
      areIdsEqual((prospect as any).assignedStaffId, staffId) ||
      areIdsEqual((prospect as any).assignedTo, staffId) ||
      areIdsEqual((prospect as any).assigned_user_id, staffId) ||
      areIdsEqual((prospect as any).assigned_staff_id, staffId) ||
      areIdsEqual(prospect.createdByUserId, staffId) ||
      areIdsEqual((prospect as any).creatorId, staffId) ||
      areIdsEqual((prospect as any).created_by_user_id, staffId) ||
      areIdsEqual((prospect as any).userId, staffId) ||
      areIdsEqual((prospect as any).staffId, staffId) ||
      areIdsEqual((prospect as any).marketerId, staffId) ||
      areIdsEqual((prospect as any).agentId, staffId) ||
      areIdsEqual((prospect as any).creator?.id, staffId) ||
      areIdsEqual((prospect as any).assignedUser?.id, staffId)
    ) {
      return true;
    }
  }

  // 2. Name matching with flexible Akan / Ghanaian spelling normalization
  const candidateNames = [
    prospect.createdByName,
    (prospect as any).assignedStaffName,
    (prospect as any).assignedUserName,
    (prospect as any).marketerName,
    (prospect as any).agentName,
    (prospect as any).creatorName,
    (prospect as any).creator?.name,
    (prospect as any).assignedUser?.name,
  ];

  for (const cName of candidateNames) {
    if (cName && isStaffNameMatching(cName, staffUser)) {
      return true;
    }
  }

  // 3. Email matching if present
  if (staffEmail && staffEmail.length > 0) {
    const sEmail = staffEmail.trim().toLowerCase();
    const candidateEmails = [
      (prospect as any).creatorEmail,
      (prospect as any).assignedUserEmail,
      (prospect as any).staffEmail,
      (prospect as any).marketerEmail,
    ];
    for (const cEmail of candidateEmails) {
      if (cEmail && String(cEmail).trim().toLowerCase() === sEmail) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Resolves the effective prospects assigned to a staff member, respecting role & branch boundaries.
 */
export function getStaffAssignedProspects(
  allProspects: Prospect[],
  staffUser: any,
  branches: BranchInfo[] = [],
  options?: { includeDepartmentPipeline?: boolean }
): Prospect[] {
  if (!staffUser || !Array.isArray(allProspects) || allProspects.length === 0) return [];

  const staffId = typeof staffUser === 'string' ? staffUser : staffUser.id;
  const stored = staffId ? getStoredUserAssignment(staffId) : undefined;
  const base = typeof staffUser === 'object' ? staffUser : { id: staffId };
  
  const effectiveUser = {
    ...stored,
    ...base,
    role: base.role || stored?.role || 'marketing_staff',
    branchId: base.branchId || (base as any).branch || stored?.branchId || (stored as any)?.branch,
    departmentId: base.departmentId || stored?.departmentId,
    departmentName: base.departmentName || stored?.departmentName || (stored as any)?.department,
  };

  const role = effectiveUser?.role || 'marketing_staff';
  const isMarketingDirector = role === 'marketing_director';

  // 1. If marketing director:
  if (isMarketingDirector && options?.includeDepartmentPipeline !== false) {
    // Marketing Director oversees marketing pipeline prospects (source === 'marketing' or unassigned source)
    // plus any prospects specifically assigned to or created by them
    const matched = allProspects.filter((p) =>
      p.source === 'marketing' ||
      !p.source ||
      isProspectAssignedOrCreatedByStaff(p, effectiveUser)
    );
    // Apply branch isolation if director is assigned to a specific branch
    return filterEntitiesByBranch(matched, effectiveUser, branches);
  }

  // 2. If marketing staff or other individual contributor:
  // Directly assigned/created prospects belong to this staff member regardless of lead location.
  return allProspects.filter((p) =>
    isProspectAssignedOrCreatedByStaff(p, effectiveUser)
  );
}

/**
 * Returns structured prospect count info for a staff member.
 */
export function getStaffAssignedProspectCount(
  allProspects: Prospect[],
  staffUser: any,
  branches: BranchInfo[] = []
): { count: number; directCount: number; isDirector: boolean } {
  if (!staffUser) return { count: 0, directCount: 0, isDirector: false };

  const assigned = getStaffAssignedProspects(allProspects, staffUser, branches);

  const staffId = typeof staffUser === 'string' ? staffUser : staffUser.id;
  const stored = staffId ? getStoredUserAssignment(staffId) : undefined;
  const base = typeof staffUser === 'object' ? staffUser : { id: staffId };
  const role = base.role || stored?.role || 'marketing_staff';
  const isDirector = role === 'marketing_director';

  const directList = isDirector
    ? allProspects.filter((p) => isProspectAssignedOrCreatedByStaff(p, { ...stored, ...base }))
    : assigned;

  return {
    count: assigned.length,
    directCount: directList.length,
    isDirector,
  };
}

/**
 * Checks if an appointment is assigned to or created by a given staff member,
 * or linked to a prospect assigned to/created by this staff member.
 */
export function isAppointmentAssignedToStaff(
  appointment: any,
  staffUser: any,
  staffProspectIds?: Set<string>
): boolean {
  if (!appointment || !staffUser) return false;

  const staffId = typeof staffUser === 'string' ? staffUser : staffUser.id;
  const base = typeof staffUser === 'object' ? staffUser : {};
  const stored = staffId ? getStoredUserAssignment(staffId) : undefined;
  const effectiveUser = { ...stored, ...base };

  // 1. Direct ID matching across appointment fields
  if (staffId) {
    if (
      areIdsEqual(appointment.createdByUserId, staffId) ||
      areIdsEqual(appointment.assignedStaffId, staffId) ||
      areIdsEqual(appointment.assignedUserId, staffId) ||
      areIdsEqual(appointment.assignedTo, staffId) ||
      areIdsEqual(appointment.assigned_user_id, staffId) ||
      areIdsEqual(appointment.assigned_staff_id, staffId) ||
      areIdsEqual(appointment.created_by_user_id, staffId) ||
      areIdsEqual(appointment.userId, staffId) ||
      areIdsEqual(appointment.staffId, staffId) ||
      areIdsEqual(appointment.marketerId, staffId) ||
      areIdsEqual(appointment.agentId, staffId) ||
      areIdsEqual(appointment.hostUserId, staffId) ||
      areIdsEqual(appointment.hostId, staffId) ||
      areIdsEqual(appointment.creator?.id, staffId) ||
      areIdsEqual(appointment.assignedUser?.id, staffId) ||
      areIdsEqual(appointment.staff?.id, staffId) ||
      areIdsEqual(appointment.user?.id, staffId)
    ) {
      return true;
    }
  }

  // 2. Prospect ownership check: If appointment belongs to a prospect of this staff member
  if (
    appointment.prospectId &&
    staffProspectIds &&
    staffProspectIds.has(String(appointment.prospectId).trim())
  ) {
    return true;
  }

  // 3. Name matching with flexible Akan / Ghanaian spelling normalization
  const candidateNames = [
    appointment.assignedStaffName,
    appointment.assignedUserName,
    appointment.createdByName,
    appointment.staffName,
    appointment.marketerName,
    appointment.agentName,
    appointment.hostName,
    appointment.staff?.name,
    appointment.creator?.name,
  ];

  for (const cName of candidateNames) {
    if (cName && isStaffNameMatching(cName, effectiveUser)) {
      return true;
    }
  }

  // 4. Email matching
  const staffEmail = effectiveUser.email;
  if (staffEmail) {
    const sEmail = String(staffEmail).trim().toLowerCase();
    const candidateEmails = [
      appointment.staffEmail,
      appointment.creatorEmail,
      appointment.assignedUserEmail,
      appointment.userEmail,
      appointment.email,
    ];
    for (const cEmail of candidateEmails) {
      if (cEmail && String(cEmail).trim().toLowerCase() === sEmail) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Consolidates appointments from multiple query sources into a deduplicated array.
 */
export function consolidateAllAppointments(
  ...sources: (any[] | undefined | null)[]
): any[] {
  const map = new Map<string, any>();
  sources.forEach((source) => {
    (source || []).forEach((item) => {
      if (!item || !item.id) return;
      if (map.has(item.id)) {
        map.set(item.id, { ...map.get(item.id)!, ...item });
      } else {
        map.set(item.id, item);
      }
    });
  });
  return Array.from(map.values());
}

/**
 * Filters appointments to those belonging to a staff member (directly or via their prospects).
 */
export function getStaffAssignedAppointments(
  allAppointments: any[],
  staffUser: any,
  allProspects?: Prospect[],
  branches: BranchInfo[] = []
): any[] {
  if (!Array.isArray(allAppointments) || allAppointments.length === 0 || !staffUser) return [];

  let staffProspectIds: Set<string> | undefined;
  if (Array.isArray(allProspects) && allProspects.length > 0) {
    const staffProspects = getStaffAssignedProspects(allProspects, staffUser, branches);
    staffProspectIds = new Set(staffProspects.map((p) => String(p.id).trim()));
  }

  return allAppointments.filter((a) => isAppointmentAssignedToStaff(a, staffUser, staffProspectIds));
}

/**
 * Returns structured appointment count for a staff member.
 */
export function getStaffAssignedAppointmentCount(
  allAppointments: any[],
  staffUser: any,
  allProspects?: Prospect[],
  branches: BranchInfo[] = []
): { count: number } {
  const list = getStaffAssignedAppointments(allAppointments, staffUser, allProspects, branches);
  return { count: list.length };
}
