import type { Prospect, User, Role, ProspectSource } from '@/types';
import { getStoredProspects } from '@/api/prospects';
import { filterEntitiesByBranch, type BranchInfo } from '@/utils/branchIsolation';
import { getStoredUserAssignment } from '@/utils/userAssignmentStorage';
import { getUserFullName } from '@/api/users';
import { getStoredInteractions } from '@/utils/interactionStorage';
import { normalizePhone } from '@/utils/duplicateValidation';
import dayjs from 'dayjs';

/**
 * Consolidates all prospect lists from various API queries and offline local storage into
 * a single deduplicated array.
 */
export function consolidateAllProspects(
  ...sources: (Prospect[] | undefined | null)[]
): Prospect[] {
  const map = new Map<string, Prospect>();

  // 1. Process all provided query arrays, allowing later arrays (e.g. direct user queries)
  // to enrich earlier arrays while preserving attribution metadata
  sources.forEach((source) => {
    (source || []).forEach((p) => {
      if (!p || !p.id) return;
      if (map.has(p.id)) {
        const prev = map.get(p.id)!;
        map.set(p.id, {
          ...prev,
          ...p,
          createdByUserId: p.createdByUserId || prev.createdByUserId,
          createdByName: p.createdByName || prev.createdByName,
          assignedUserId: p.assignedUserId || prev.assignedUserId,
          assignedUserName: (p as any).assignedUserName || (prev as any).assignedUserName,
          registeredByUserId: (p as any).registeredByUserId || (prev as any).registeredByUserId,
          registeredByName: (p as any).registeredByName || (prev as any).registeredByName,
          recordedByUserId: (p as any).recordedByUserId || (prev as any).recordedByUserId,
          recordedByName: (p as any).recordedByName || (prev as any).recordedByName,
        });
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
      const current = map.get(stored.id)!;
      map.set(stored.id, {
        ...current,
        ...stored,
        createdByUserId: stored.createdByUserId || current.createdByUserId,
        createdByName: stored.createdByName || current.createdByName,
        assignedUserId: stored.assignedUserId || current.assignedUserId,
        assignedUserName: (stored as any).assignedUserName || (current as any).assignedUserName,
        registeredByUserId: (stored as any).registeredByUserId || (current as any).registeredByUserId,
        registeredByName: (stored as any).registeredByName || (current as any).registeredByName,
        recordedByUserId: (stored as any).recordedByUserId || (current as any).recordedByUserId,
        recordedByName: (stored as any).recordedByName || (current as any).recordedByName,
      });
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
  const sParts = sClean.split(' ').filter(Boolean);
  const fName = (typeof staffUser === 'object' && staffUser.firstName ? normalize(staffUser.firstName) : '') || sParts[0] || '';
  const lName = (typeof staffUser === 'object' && staffUser.lastName ? normalize(staffUser.lastName) : '') || sParts.slice(1).join(' ') || '';

  if (fName && cClean.includes(fName)) {
    if (lName && (cClean.includes(lName) || cNoSpace.includes(lName.replace(/\s+/g, '')))) {
      return true;
    }
    // Specific match for Lawrencia Adugyemfi / Adu-Gyamfi variations
    if (fName.includes('lawrencia') && (cClean.includes('adu') || cClean.includes('gyemfi') || cClean.includes('gyamfi'))) {
      return true;
    }
  }

  // Token subset match: if all parts of candidate are in staffName or vice-versa
  if (cTokens.length >= 2 && cTokens.every((t) => sClean.includes(t))) return true;
  if (sTokens.length >= 2 && sTokens.every((t) => cClean.includes(t))) return true;

  // Dedicated Lawrencia Adugyemfi / Adu-Gyamfi / Director variation match
  if (sClean.includes('lawrencia') && (cClean.includes('lawrencia') || (cClean.includes('adu') && cClean.includes('gy')))) {
    return true;
  }

  return false;
}

/**
 * Checks if a prospect was created/added by a given staff member.
 */
export function isProspectCreatedByStaff(
  prospect: Prospect,
  staffUser: any
): boolean {
  if (!prospect || !staffUser) return false;

  const staffId = typeof staffUser === 'string' ? staffUser : staffUser.id;
  const staffEmail = typeof staffUser === 'object' ? staffUser.email : undefined;

  // 1. Direct ID matching on creation fields
  if (staffId) {
    if (
      areIdsEqual(prospect.createdByUserId, staffId) ||
      areIdsEqual((prospect as any).creatorId, staffId) ||
      areIdsEqual((prospect as any).created_by_user_id, staffId) ||
      areIdsEqual((prospect as any).creator?.id, staffId) ||
      areIdsEqual((prospect as any).created_by?.id, staffId) ||
      areIdsEqual((prospect as any).recordedByUserId, staffId) ||
      areIdsEqual((prospect as any).recorded_by_user_id, staffId) ||
      areIdsEqual((prospect as any).registeredByUserId, staffId) ||
      areIdsEqual((prospect as any).registered_by_user_id, staffId)
    ) {
      return true;
    }
  }

  // 2. Name matching on creator name
  const candidateNames = [
    prospect.createdByName,
    (prospect as any).creatorName,
    (prospect as any).creator?.name,
    (prospect as any).created_by_name,
    (prospect as any).created_by?.name,
    (prospect as any).recordedByName,
    (prospect as any).recorded_by_name,
    (prospect as any).registeredByName,
    (prospect as any).registered_by_name,
  ];

  for (const cName of candidateNames) {
    if (cName && isStaffNameMatching(cName, staffUser)) {
      return true;
    }
  }

  // 3. Email matching
  if (staffEmail && staffEmail.length > 0) {
    const sEmail = staffEmail.trim().toLowerCase();
    const candidateEmails = [
      (prospect as any).creatorEmail,
      (prospect as any).creator?.email,
      (prospect as any).created_by_email,
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
 * Checks if a prospect is assigned to a given staff member.
 */
export function isProspectAssignedToStaff(
  prospect: Prospect,
  staffUser: any
): boolean {
  if (!prospect || !staffUser) return false;

  const staffId = typeof staffUser === 'string' ? staffUser : staffUser.id;
  const staffEmail = typeof staffUser === 'object' ? staffUser.email : undefined;

  // 1. Direct ID matching on assignment fields
  if (staffId) {
    if (
      areIdsEqual(prospect.assignedUserId, staffId) ||
      areIdsEqual((prospect as any).assignedStaffId, staffId) ||
      areIdsEqual((prospect as any).assignedTo, staffId) ||
      areIdsEqual((prospect as any).assigned_user_id, staffId) ||
      areIdsEqual((prospect as any).assigned_staff_id, staffId) ||
      areIdsEqual((prospect as any).userId, staffId) ||
      areIdsEqual((prospect as any).staffId, staffId) ||
      areIdsEqual((prospect as any).marketerId, staffId) ||
      areIdsEqual((prospect as any).agentId, staffId) ||
      areIdsEqual((prospect as any).assignedUser?.id, staffId)
    ) {
      return true;
    }
  }

  // 2. Name matching on assigned staff name
  const candidateNames = [
    (prospect as any).assignedStaffName,
    (prospect as any).assignedUserName,
    (prospect as any).marketerName,
    (prospect as any).agentName,
    (prospect as any).assignedUser?.name,
  ];

  for (const cName of candidateNames) {
    if (cName && isStaffNameMatching(cName, staffUser)) {
      return true;
    }
  }

  // 3. Email matching
  if (staffEmail && staffEmail.length > 0) {
    const sEmail = staffEmail.trim().toLowerCase();
    const candidateEmails = [
      (prospect as any).assignedUserEmail,
      (prospect as any).assignedUser?.email,
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
 * Checks if a prospect is assigned to or created by a given staff member.
 * Checks assignedUserId, assignedStaffId, createdByUserId, creatorId, userId,
 * createdByName, assignedStaffName, assignedUserName, marketerName, and email.
 */
export function isProspectAssignedOrCreatedByStaff(
  prospect: Prospect,
  staffUser: any
): boolean {
  if (!prospect || !staffUser) return false;
  return isProspectCreatedByStaff(prospect, staffUser) || isProspectAssignedToStaff(prospect, staffUser);
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

  // 1. If marketing director AND explicitly requested to include whole department pipeline:
  if (isMarketingDirector && options?.includeDepartmentPipeline === true) {
    // Marketing Director oversees marketing pipeline prospects ONLY when explicitly requested
    const matched = allProspects.filter((p) =>
      p.source === 'marketing' ||
      !p.source ||
      isProspectAssignedOrCreatedByStaff(p, effectiveUser)
    );
    // Apply branch isolation if director is assigned to a specific branch
    return filterEntitiesByBranch(matched, effectiveUser, branches);
  }

  // 2. Direct prospects added by or assigned to this staff member (including marketing director's own portfolio)
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
): { count: number; directCount: number; isDirector: boolean; pipelineCount: number } {
  if (!staffUser) return { count: 0, directCount: 0, isDirector: false, pipelineCount: 0 };

  const staffId = typeof staffUser === 'string' ? staffUser : staffUser.id;
  const stored = staffId ? getStoredUserAssignment(staffId) : undefined;
  const base = typeof staffUser === 'object' ? staffUser : { id: staffId };
  const role = base.role || stored?.role || 'marketing_staff';
  const isDirector = role === 'marketing_director';

  const directList = allProspects.filter((p) =>
    isProspectAssignedOrCreatedByStaff(p, { ...stored, ...base })
  );

  const pipelineCount = allProspects.filter(
    (p) => p.source === 'marketing' || !p.source
  ).length;

  return {
    count: directList.length,
    directCount: directList.length,
    isDirector,
    pipelineCount,
  };
}

export interface StaffProspectDistribution {
  id: string;
  userId?: string;
  name: string;
  email?: string;
  phone?: string;
  role: string;
  department?: string;
  userObj?: any;
  addedProspects: Prospect[];
  assignedProspects: Prospect[];
  totalProspects: number;
  meetingScheduled: number;
  meetingCompleted: number;
  converted: number;
  conversionRate: number;
  revenueGeneratedMinor: number;
  isUnassignedPool?: boolean;
}

/**
 * Cleanly partitions all marketing prospects across all marketing staff (including director)
 * and unassigned leads so that the sum of prospects across the table amounts to the exact
 * total marketing prospects (e.g. 364), without double-counting or inflating the director's row.
 */
export function distributeProspectsAcrossMarketingStaff(
  allMarketingProspects: Prospect[],
  marketingStaffUsers: any[],
  apiMarketers: any[] = [],
  allAppointments: any[] = []
): {
  staffRows: StaffProspectDistribution[];
  unassignedRow: StaffProspectDistribution | null;
  totalAttributedProspects: number;
} {
  const staffMap = new Map<string, {
    staff: any;
    added: Prospect[];
    assigned: Prospect[];
  }>();

  marketingStaffUsers.forEach((staff) => {
    staffMap.set(String(staff.id).trim(), {
      staff,
      added: [],
      assigned: [],
    });
  });

  const unassignedProspects: Prospect[] = [];

  allMarketingProspects.forEach((prospect) => {
    // 1. Check if created by a marketing staff member
    let matchedCreatorStaff: any = null;
    for (const s of marketingStaffUsers) {
      if (isProspectCreatedByStaff(prospect, s)) {
        matchedCreatorStaff = s;
        break;
      }
    }

    // 2. Check if assigned to a marketing staff member
    let matchedAssigneeStaff: any = null;
    for (const s of marketingStaffUsers) {
      if (isProspectAssignedToStaff(prospect, s)) {
        matchedAssigneeStaff = s;
        break;
      }
    }

    if (matchedAssigneeStaff) {
      staffMap.get(String(matchedAssigneeStaff.id).trim())?.assigned.push(prospect);
    }

    // 3. Fallback: if not matched specifically as creator or assignee, check general isProspectAssignedOrCreatedByStaff
    let fallbackStaff: any = null;
    if (!matchedCreatorStaff && !matchedAssigneeStaff) {
      for (const s of marketingStaffUsers) {
        if (isProspectAssignedOrCreatedByStaff(prospect, s)) {
          fallbackStaff = s;
          break;
        }
      }
    }

    // Primary attribution for the staff table: who added / brought in the lead
    const primaryStaff = matchedCreatorStaff || matchedAssigneeStaff || fallbackStaff;
    if (primaryStaff) {
      staffMap.get(String(primaryStaff.id).trim())?.added.push(prospect);
    } else {
      unassignedProspects.push(prospect);
    }
  });

  const staffRows: StaffProspectDistribution[] = marketingStaffUsers.map((staff) => {
    const entry = staffMap.get(String(staff.id).trim());
    const addedProspects = entry?.added || [];
    const assignedProspects = entry?.assigned || [];
    const staffName = getUserFullName(staff);

    const apiRecord = apiMarketers.find(
      (m) => m.userId === staff.id || m.id === staff.id || m.name?.toLowerCase() === staffName.toLowerCase()
    );

    // Count is strictly based on the prospects added/attributed to this staff member
    const totalProspects = addedProspects.length;
    const staffAppts = Array.isArray(allAppointments) && allAppointments.length > 0
      ? getStaffAssignedAppointments(allAppointments, staff, allMarketingProspects)
      : [];
    const scheduledFromAppts = staffAppts.filter((a) => a.status === 'scheduled' || a.status === 'postponed').length;
    const completedFromAppts = staffAppts.filter((a) => a.status === 'completed').length;

    const meetingScheduled = Math.max(
      addedProspects.filter((p) => p.status === 'meeting_scheduled').length,
      scheduledFromAppts
    );
    const meetingCompleted = Math.max(
      addedProspects.filter((p) => p.status === 'meeting_completed').length,
      completedFromAppts
    );
    const converted = Math.max(
      addedProspects.filter((p) => p.status === 'purchased').length,
      (staff.role !== 'marketing_director' ? Math.min(apiRecord?.converted ?? 0, totalProspects) : 0)
    );
    const conversionRate = totalProspects > 0 ? Math.round((converted / totalProspects) * 1000) / 10 : 0;

    return {
      id: staff.id,
      userId: staff.id,
      name: staffName,
      email: staff.email,
      phone: staff.phoneNumber || (typeof staff.phone === 'string' ? staff.phone : staff.phone?.number) || '',
      role: staff.role,
      department: staff.department,
      userObj: staff,
      addedProspects,
      assignedProspects,
      totalProspects,
      meetingScheduled,
      meetingCompleted,
      converted,
      conversionRate,
      revenueGeneratedMinor: converted * 4500000,
      isUnassignedPool: false,
    };
  }).sort((a, b) => b.totalProspects - a.totalProspects || b.converted - a.converted);

  let unassignedRow: StaffProspectDistribution | null = null;
  if (unassignedProspects.length > 0) {
    const scheduled = unassignedProspects.filter((p) => p.status === 'meeting_scheduled').length;
    const completed = unassignedProspects.filter((p) => p.status === 'meeting_completed').length;
    const conv = unassignedProspects.filter((p) => p.status === 'purchased').length;
    unassignedRow = {
      id: 'unassigned-inbound-leads',
      userId: undefined,
      name: '🌐 Direct / Inbound Marketing Leads (Unassigned)',
      email: 'General Pipeline',
      phone: 'Unassigned',
      role: 'inbound_pool',
      department: 'Marketing',
      userObj: null,
      addedProspects: unassignedProspects,
      assignedProspects: [],
      totalProspects: unassignedProspects.length,
      meetingScheduled: scheduled,
      meetingCompleted: completed,
      converted: conv,
      conversionRate: unassignedProspects.length > 0 ? Math.round((conv / unassignedProspects.length) * 1000) / 10 : 0,
      revenueGeneratedMinor: conv * 4500000,
      isUnassignedPool: true,
    };
  }

  const totalAttributedProspects =
    staffRows.reduce((acc, r) => acc + r.totalProspects, 0) + (unassignedRow?.totalProspects ?? 0);

  return {
    staffRows,
    unassignedRow,
    totalAttributedProspects,
  };
}

/**
 * Checks if an appointment is assigned to or created by a given staff member,
 * or linked to a prospect assigned to/created by this staff member.
 */
export function isAppointmentAssignedToStaff(
  appointment: any,
  staffUser: any,
  staffProspectIds?: Set<string>,
  staffCustomerIds?: Set<string>,
  allInteractions?: any[],
  allProspects?: Prospect[],
  allCustomers?: any[]
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
      areIdsEqual(appointment.bookedByUserId, staffId) ||
      areIdsEqual(appointment.booked_by_user_id, staffId) ||
      areIdsEqual(appointment.updatedByUserId, staffId) ||
      areIdsEqual(appointment.updated_by_user_id, staffId) ||
      areIdsEqual(appointment.feedbackByUserId, staffId) ||
      areIdsEqual(appointment.feedback_by_user_id, staffId) ||
      areIdsEqual(appointment.attendedByUserId, staffId) ||
      areIdsEqual(appointment.attended_by_user_id, staffId) ||
      areIdsEqual(appointment.creator?.id, staffId) ||
      areIdsEqual(appointment.created_by?.id, staffId) ||
      areIdsEqual(appointment.assignedUser?.id, staffId) ||
      areIdsEqual(appointment.assigned_user?.id, staffId) ||
      areIdsEqual(appointment.staff?.id, staffId) ||
      areIdsEqual(appointment.user?.id, staffId) ||
      areIdsEqual(appointment.host?.id, staffId) ||
      areIdsEqual(appointment.marketer?.id, staffId)
    ) {
      return true;
    }
  }

  // 2. Direct Name matching with flexible Akan / Ghanaian spelling normalization
  const candidateNames = [
    appointment.assignedStaffName,
    appointment.assignedUserName,
    appointment.createdByName,
    appointment.creatorName,
    appointment.staffName,
    appointment.marketerName,
    appointment.agentName,
    appointment.hostName,
    appointment.bookedByName,
    appointment.updatedByName,
    appointment.attendedByName,
    appointment.staff?.name,
    appointment.creator?.name,
    appointment.assignedUser?.name,
    appointment.user?.name,
    appointment.host?.name,
  ];

  for (const cName of candidateNames) {
    if (cName && isStaffNameMatching(cName, effectiveUser)) {
      return true;
    }
  }

  // 3. Direct Email matching
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

  // 4. Prospect ownership check: If appointment belongs to a prospect of this staff member
  if (
    appointment.prospectId &&
    staffProspectIds &&
    staffProspectIds.has(String(appointment.prospectId).trim())
  ) {
    return true;
  }

  // 5. Customer ownership check: If appointment belongs to a customer of this staff member
  if (
    appointment.customerId &&
    staffCustomerIds &&
    staffCustomerIds.has(String(appointment.customerId).trim())
  ) {
    return true;
  }

  // 6. Interaction / Communication Trail Attribution:
  // If this staff member logged any booking interaction, status update note, or feedback
  // for this appointment (or for its linked prospect/customer), the appointment is theirs!
  const interactionsPool = Array.isArray(allInteractions) && allInteractions.length > 0
    ? allInteractions
    : getStoredInteractions();

  if (interactionsPool && interactionsPool.length > 0) {
    const hasStaffInteraction = interactionsPool.some((i) => {
      if (!i) return false;
      const isLinked =
        (appointment.id && (areIdsEqual(i.appointmentId, appointment.id) || String(i.id).includes(String(appointment.id)))) ||
        (appointment.prospectId && areIdsEqual(i.prospectId, appointment.prospectId)) ||
        (appointment.customerId && areIdsEqual(i.customerId, appointment.customerId));

      if (!isLinked) return false;

      if (staffId && areIdsEqual(i.loggedByUserId, staffId)) return true;
      if (i.loggedByUserName && isStaffNameMatching(i.loggedByUserName, effectiveUser)) return true;
      if (staffEmail && i.loggedByUserEmail && String(i.loggedByUserEmail).toLowerCase() === staffEmail.toLowerCase()) return true;
      return false;
    });

    if (hasStaffInteraction) {
      return true;
    }
  }

  // 7. Prospect Deep Resolution:
  // If full prospects list is provided, inspect the linked prospect entity directly
  if (appointment.prospectId && Array.isArray(allProspects) && allProspects.length > 0) {
    const matchedProspect = allProspects.find(
      (p) => p && (areIdsEqual(p.id, appointment.prospectId) ||
        (appointment.phone && normalizePhone(p.phoneNumber) === normalizePhone(appointment.phone)) ||
        (appointment.phoneNumber && normalizePhone(p.phoneNumber) === normalizePhone(appointment.phoneNumber)))
    );
    if (matchedProspect) {
      if (isProspectAssignedOrCreatedByStaff(matchedProspect, effectiveUser)) return true;
      if (isStaffNameMatching(matchedProspect.assignedUserName || (matchedProspect as any).assignedStaffName, effectiveUser)) return true;
      if (staffId && areIdsEqual(matchedProspect.assignedUserId || (matchedProspect as any).assignedStaffId, staffId)) return true;
    }
  }

  // 8. Customer Deep Resolution:
  if (appointment.customerId && Array.isArray(allCustomers) && allCustomers.length > 0) {
    const matchedCust = allCustomers.find(
      (c) => c && (areIdsEqual(c.id, appointment.customerId) ||
        (appointment.phone && normalizePhone(c.phoneNumber) === normalizePhone(appointment.phone)) ||
        (appointment.phoneNumber && normalizePhone(c.phoneNumber) === normalizePhone(appointment.phoneNumber)))
    );
    if (matchedCust) {
      if (staffId && (
        areIdsEqual(matchedCust.assignedUserId, staffId) ||
        areIdsEqual(matchedCust.createdByUserId, staffId) ||
        areIdsEqual(matchedCust.marketerId, staffId) ||
        areIdsEqual(matchedCust.agentId, staffId) ||
        areIdsEqual(matchedCust.userId, staffId) ||
        areIdsEqual(matchedCust.staffId, staffId)
      )) return true;
      if (isStaffNameMatching(matchedCust.assignedUserName || (matchedCust as any).assignedStaffName || (matchedCust as any).marketerName, effectiveUser)) return true;
    }
  }

  // 9. Feedback / Reason text attribution (e.g. "Attended and completed by Cecilia Donkor")
  const fullStaffName = getUserFullName(effectiveUser);
  if (fullStaffName && fullStaffName.length >= 3) {
    const textToCheck = `${appointment.feedback || ''} ${appointment.reason || ''}`.toLowerCase();
    if (textToCheck.includes(fullStaffName.toLowerCase())) {
      return true;
    }
  }

  return false;
}

/**
 * Consolidates appointments from multiple query sources into a deduplicated array.
 * Ensures that a person only has at most ONE active appointment, with any updated
 * date overwriting older records to prevent duplicate entries.
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

  const all = Array.from(map.values());
  const sorted = [...all].sort((a, b) => {
    const timeA = new Date(a.updatedAt || a.createdAt || a.scheduledFor || 0).getTime();
    const timeB = new Date(b.updatedAt || b.createdAt || b.scheduledFor || 0).getTime();
    return timeB - timeA;
  });

  const seenActivePersons = new Set<string>();
  const seenIds = new Set<string>();
  const result: any[] = [];

  for (const appt of sorted) {
    if (!appt || !appt.id) continue;
    if (seenIds.has(appt.id)) continue;

    const personKey = appt.prospectId
      ? `prospect:${appt.prospectId}`
      : appt.customerId
      ? `customer:${appt.customerId}`
      : null;

    const isActive = appt.status === 'scheduled' || appt.status === 'postponed';

    if (personKey && isActive) {
      if (seenActivePersons.has(personKey)) {
        // Drop duplicate active appointment for the same person
        continue;
      }
      seenActivePersons.add(personKey);
    }

    seenIds.add(appt.id);
    result.push(appt);
  }

  return result;
}

/**
 * Synthesizes appointments from all possible sources:
 * 1. API & stored appointment arrays
 * 2. Booking records tracked in staff interactions (where inter.appointmentId exists or booking interaction)
 * 3. Prospects whose current status is meeting_scheduled or meeting_completed
 * 
 * Ensures all staff and admin dashboards share an identical, complete appointment dataset.
 */
export function synthesizeAllAppointments(
  appointmentSources: (any[] | undefined | null)[],
  allInteractions: any[] = [],
  allProspects: Prospect[] = []
): any[] {
  const baseAppointments = consolidateAllAppointments(...appointmentSources);
  const seenIds = new Set<string>(baseAppointments.map((a) => String(a.id)));
  const seenProspects = new Set<string>(baseAppointments.filter((a) => a.prospectId).map((a) => String(a.prospectId)));
  const list = [...baseAppointments];

  // 1. Incorporate booking records from interactions
  const interactionsPool = Array.isArray(allInteractions) && allInteractions.length > 0
    ? allInteractions
    : getStoredInteractions();

  interactionsPool.forEach((inter) => {
    if (!inter) return;
    const apptId = inter.appointmentId;
    if (apptId && !seenIds.has(String(apptId))) {
      seenIds.add(String(apptId));
      if (inter.prospectId) seenProspects.add(String(inter.prospectId));
      list.push({
        id: String(apptId),
        prospectId: inter.prospectId,
        customerId: inter.customerId,
        source: 'staff',
        scheduledFor: inter.occurredAt || inter.createdAt,
        status: 'scheduled',
        reason: inter.response || 'Staff Booking Scheduled',
        createdByUserId: inter.loggedByUserId,
        createdByName: inter.loggedByUserName,
        assignedUserId: inter.loggedByUserId,
        assignedUserName: inter.loggedByUserName,
        staffId: inter.loggedByUserId,
        staffName: inter.loggedByUserName,
        createdAt: inter.createdAt || inter.occurredAt,
        updatedAt: inter.createdAt || inter.occurredAt,
      });
    }
  });

  // 2. Incorporate prospects whose status is meeting_scheduled or meeting_completed
  (allProspects || []).forEach((p) => {
    if (!p || !p.id) return;
    const isMeetingStatus =
      p.status === 'meeting_scheduled' ||
      p.status === 'meeting_completed' ||
      (p.status === 'postponed' &&
        (p.notes?.toLowerCase().includes('meet') ||
          p.notes?.toLowerCase().includes('appoint') ||
          p.reasonForContact?.toLowerCase().includes('meet')));

    if (isMeetingStatus && !seenProspects.has(String(p.id))) {
      seenProspects.add(String(p.id));
      const meetingId = `prospect_meeting_${p.id}`;
      if (!seenIds.has(meetingId)) {
        seenIds.add(meetingId);
        const mappedStatus =
          p.status === 'meeting_completed'
            ? 'completed'
            : p.status === 'postponed'
            ? 'postponed'
            : 'scheduled';

        list.push({
          id: meetingId,
          prospectId: p.id,
          source: 'staff',
          scheduledFor: p.updatedAt || p.createdAt,
          status: mappedStatus,
          reason: p.notes || p.reasonForContact || 'Consultation Meeting Scheduled',
          createdByUserId: p.assignedUserId || p.createdByUserId,
          createdByName: (p as any).assignedUserName || (p as any).createdByName,
          assignedUserId: p.assignedUserId || p.createdByUserId,
          assignedUserName: (p as any).assignedUserName || (p as any).createdByName,
          staffId: p.assignedUserId || p.createdByUserId,
          staffName: (p as any).assignedUserName || (p as any).createdByName,
          createdAt: p.createdAt,
          updatedAt: p.updatedAt,
        });
      }
    }
  });

  return consolidateAllAppointments(list);
}

/**
 * Filters appointments to those belonging to a staff member (directly, via their interactions, or via their prospects/customers).
 */
export function getStaffAssignedAppointments(
  allAppointments: any[],
  staffUser: any,
  allProspects?: Prospect[],
  branches: BranchInfo[] = [],
  allCustomers?: any[],
  allInteractions?: any[]
): any[] {
  if (!Array.isArray(allAppointments) || allAppointments.length === 0 || !staffUser) return [];

  const interactionsPool = Array.isArray(allInteractions) && allInteractions.length > 0
    ? allInteractions
    : getStoredInteractions();

  let staffProspectIds: Set<string> | undefined;
  if (Array.isArray(allProspects) && allProspects.length > 0) {
    const staffProspects = allProspects.filter((p) => {
      if (isProspectAssignedOrCreatedByStaff(p, staffUser)) return true;
      if (p.assignedUserName && isStaffNameMatching(p.assignedUserName, staffUser)) return true;
      if (interactionsPool && interactionsPool.length > 0) {
        return interactionsPool.some(
          (i) =>
            i.prospectId === p.id &&
            (areIdsEqual(i.loggedByUserId, typeof staffUser === 'string' ? staffUser : staffUser.id) ||
              isStaffNameMatching(i.loggedByUserName, staffUser))
        );
      }
      return false;
    });
    staffProspectIds = new Set(staffProspects.map((p) => String(p.id).trim()));
  }

  let staffCustomerIds: Set<string> | undefined;
  if (Array.isArray(allCustomers) && allCustomers.length > 0) {
    const staffId = typeof staffUser === 'string' ? staffUser : staffUser.id;
    const staffCustomers = allCustomers.filter((c) => {
      if (!c) return false;
      if (
        staffId &&
        (areIdsEqual(c.assignedUserId, staffId) ||
          areIdsEqual(c.createdByUserId, staffId) ||
          areIdsEqual(c.marketerId, staffId) ||
          areIdsEqual(c.agentId, staffId) ||
          areIdsEqual(c.userId, staffId) ||
          areIdsEqual(c.staffId, staffId))
      ) {
        return true;
      }
      if (c.assignedUserName && isStaffNameMatching(c.assignedUserName, staffUser)) return true;
      return false;
    });
    staffCustomerIds = new Set(staffCustomers.map((c) => String(c.id).trim()));
  }

  return allAppointments.filter((a) =>
    isAppointmentAssignedToStaff(
      a,
      staffUser,
      staffProspectIds,
      staffCustomerIds,
      interactionsPool,
      allProspects,
      allCustomers
    )
  );
}

/**
 * Returns structured appointment count for a staff member.
 */
export function getStaffAssignedAppointmentCount(
  allAppointments: any[],
  staffUser: any,
  allProspects?: Prospect[],
  branches: BranchInfo[] = [],
  allCustomers?: any[],
  allInteractions?: any[]
): { count: number } {
  const list = getStaffAssignedAppointments(
    allAppointments,
    staffUser,
    allProspects,
    branches,
    allCustomers,
    allInteractions
  );
  return { count: list.length };
}

export type AppointmentDueStatus = 'overdue' | 'due_today' | 'upcoming' | 'none';

/**
 * Determines whether an appointment is overdue, due today, upcoming, or none.
 * IMPORTANT: Completed, attended, canceled or no_show appointments NEVER create due/overdue flags.
 */
export const getAppointmentDueStatus = (appointment: {
  status?: string;
  scheduledFor?: string;
  date?: string;
  time?: string;
}): AppointmentDueStatus => {
  const status = String(appointment.status || '').toLowerCase();
  // Completed, attended, canceled or no_show appointments must NEVER show due/overdue flags
  if (status === 'completed' || status === 'canceled' || status === 'no_show') {
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

  // If scheduled for today:
  if (schedTime.isSame(now, 'day')) {
    // If appointment time has already passed today:
    if (schedTime.isBefore(now)) {
      return 'overdue';
    }
    // Upcoming today:
    return 'due_today';
  }

  return 'upcoming';
};

/**
 * Checks if a user has write permission for prospects (POST /prospects and PATCH /prospects/:id).
 *
 * Scope rule:
 * - admin, super_admin, marketing_director, marketing_staff, customer_service -> true
 * - secretary, branch_manager, accounts, unknown roles -> false
 *
 * Note: Marketing Director manages the marketing pipeline, so write access mirrors read access.
 * Secretary can read all prospects but cannot edit them (PATCH is gated on canWriteProspects).
 */
export function canWriteProspects(
  userOrRole: { role?: Role | string } | Role | string | null | undefined
): boolean {
  if (!userOrRole) return false;
  const role = typeof userOrRole === 'string' ? userOrRole : userOrRole.role;
  if (!role) return false;
  return (
    role === 'admin' ||
    role === 'super_admin' ||
    role === 'marketing_director' ||
    role === 'marketing_staff' ||
    role === 'customer_service'
  );
}

export interface ResolvedProspectAttribution {
  source: ProspectSource | string;
  assignedUserId?: string;
  assignedUserName?: string;
  createdByUserId?: string;
  createdByName?: string;
  registeredByUserId?: string;
  registeredByName?: string;
  recordedByUserId?: string;
  recordedByName?: string;
}

/**
 * Pure function resolving prospect source and assignee attribution on creation.
 *
 * Enforces:
 * 1. Assignment-to-creator for staff roles (marketing_director, marketing_staff,
 *    customer_service, secretary, branch_manager) - ignores caller-supplied assignedUserId.
 * 2. No self-blinding creates:
 *    - marketing_director and marketing_staff are forced to source: 'marketing'.
 *      (Their read scope is marketing-only; entering customer_service would make it immediately invisible).
 *    - customer_service is forced to source: 'customer_service'.
 *    - secretary defaults to 'customer_service' unless explicitly specified.
 *    - admin/super_admin honours payload.source || 'marketing'.
 * 3. No silent reassignment for unrecognised roles:
 *    - Only admin/super_admin can honour a caller-supplied assignedUserId.
 *    - Any unrecognised or unknown role rejects caller-supplied assignedUserId and falls back to creator's own ID.
 */
export function resolveProspectAttribution(
  user: { id?: string; role?: Role | string; firstName?: string; lastName?: string; name?: string } | null | undefined,
  payload?: { source?: ProspectSource | string; assignedUserId?: string; [key: string]: any }
): ResolvedProspectAttribution {
  const role = user?.role;
  const userId = user?.id ? String(user.id).trim() : undefined;
  const fullName = user
    ? (user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim() || undefined)
    : undefined;

  // 1. Source resolution (prevents self-blinding creates)
  let source: ProspectSource | string;
  if (role === 'marketing_director' || role === 'marketing_staff') {
    source = 'marketing';
  } else if (role === 'customer_service') {
    source = 'customer_service';
  } else if (role === 'secretary') {
    source = payload?.source || 'customer_service';
  } else {
    source = payload?.source || 'marketing';
  }

  // 2. Assignee resolution (assignment-to-creator, no silent reassignment for unrecognised roles)
  let assignedUserId: string | undefined;
  let assignedUserName: string | undefined;

  const isAdminRole = role === 'admin' || role === 'super_admin';

  if (isAdminRole) {
    // Admin can assign to any caller-supplied staff member
    assignedUserId = payload?.assignedUserId ? String(payload.assignedUserId).trim() : userId;
    assignedUserName = assignedUserId === userId ? fullName : undefined;
  } else {
    // Recognised staff (director, staff, CS, sec, BM) AND unrecognised roles:
    // MUST NOT honour caller-supplied assignedUserId.
    // Auto-assigned to creator (assignment-to-creator, prevents silent reassignment bug).
    assignedUserId = userId;
    assignedUserName = fullName;
  }

  return {
    source,
    assignedUserId,
    assignedUserName,
    createdByUserId: userId,
    createdByName: fullName,
    registeredByUserId: userId,
    registeredByName: fullName,
    recordedByUserId: userId,
    recordedByName: fullName,
  };
}

/**
 * Checks whether a single prospect record is visible/accessible to the given user based on role and branch scoping.
 * - Admin and Secretary: unrestricted (can see all prospects across all sources and branches).
 * - Marketing Director: can see all marketing prospects (source === 'marketing' || !source) or prospects they created/assigned to.
 * - Customer Service: can see customer_service prospects (source === 'customer_service') or prospects they created/assigned to.
 * - Marketing Staff: can see prospects they created or that are assigned to them.
 * - Branch Manager: can see prospects in their branch or created/assigned to them.
 * - Other / unrecognised: can see only prospects they created or that are assigned to them.
 */
export function canAccessProspect(
  user: { id?: string; role?: Role | string; branchId?: string; branch?: string } | null | undefined,
  prospect: Partial<Prospect> | Record<string, any> | null | undefined,
  branches: BranchInfo[] = []
): boolean {
  if (!user || !user.id || !prospect) return false;
  const role = user.role;

  // Admin and Secretary have unrestricted visibility across all prospects
  if (role === 'admin' || role === 'super_admin' || role === 'secretary') {
    return true;
  }

  // Creator or assignee always has access
  if (isProspectAssignedOrCreatedByStaff(prospect as Prospect, user)) {
    return true;
  }

  // Marketing Director sees all marketing pipeline prospects
  if (role === 'marketing_director') {
    const isMarketingSource = prospect.source === 'marketing' || !prospect.source;
    if (!isMarketingSource) {
      // Director cannot see customer_service prospects unless created by / assigned to them
      return false;
    }
    const directorBranch = user.branchId || user.branch;
    const prospectBranchId = (prospect as any).branchId;
    if (directorBranch && prospectBranchId) {
      return areIdsEqual(directorBranch, prospectBranchId);
    }
    return true;
  }

  // Customer Service sees all CS prospects
  if (role === 'customer_service') {
    return prospect.source === 'customer_service';
  }

  // Branch Manager sees prospects within their branch
  if (role === 'branch_manager') {
    const userBranch = user.branchId || user.branch;
    const prospectBranchId = (prospect as any).branchId;
    if (userBranch && prospectBranchId) {
      return areIdsEqual(userBranch, prospectBranchId);
    }
  }

  // Marketing Staff and other roles: strictly own-only
  return false;
}

/**
 * Checks whether a prospect is editable / amendable by the given user.
 * PATCH /prospects/:id is gated on canWriteProspects:
 * - Secretary, Branch Manager, and other roles CANNOT edit prospects (canWriteProspects returns false).
 * - Admin and Super Admin can edit any prospect.
 * - Marketing Director can edit marketing prospects (or their own).
 * - Marketing Staff and Customer Service can edit their own prospects.
 */
export function canEditProspect(
  user: { id?: string; role?: Role | string } | null | undefined,
  prospect: Partial<Prospect> | Record<string, any> | null | undefined
): boolean {
  if (!user || !user.id || !prospect) return false;
  if (!canWriteProspects(user)) return false;

  if (user.role === 'admin' || user.role === 'super_admin') return true;

  if (user.role === 'marketing_director') {
    return prospect.source === 'marketing' || !prospect.source || isProspectAssignedOrCreatedByStaff(prospect as Prospect, user);
  }

  return isProspectAssignedOrCreatedByStaff(prospect as Prospect, user);
}

