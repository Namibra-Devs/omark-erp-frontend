// src/utils/prospectScoping.ts
import type { Prospect, Role, ProspectSource } from '../types/index.ts';

export type ProspectScope = 'all' | 'personal' | 'marketing' | 'customer_service';

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
 * Checks if a prospect is assigned to or created by a given staff member.
 */
export function isProspectAssignedOrCreatedByStaff(
  prospect: Partial<Prospect> | Record<string, any> | null | undefined,
  staffUser: any
): boolean {
  if (!prospect || !staffUser) return false;
  const staffId = typeof staffUser === 'string' ? staffUser : staffUser.id;
  const staffName =
    typeof staffUser === 'object'
      ? (staffUser.name || `${staffUser.firstName || ''} ${staffUser.lastName || ''}`.trim())
      : typeof staffUser === 'string'
      ? staffUser.trim()
      : '';

  // ID matching
  if (staffId) {
    if (
      areIdsEqual(prospect.createdByUserId, staffId) ||
      areIdsEqual((prospect as any).creatorId, staffId) ||
      areIdsEqual((prospect as any).created_by_user_id, staffId) ||
      areIdsEqual((prospect as any).recordedByUserId, staffId) ||
      areIdsEqual((prospect as any).registeredByUserId, staffId) ||
      areIdsEqual(prospect.assignedUserId, staffId) ||
      areIdsEqual((prospect as any).assignedStaffId, staffId)
    ) {
      return true;
    }
  }

  // Name matching
  if (staffName && staffName.length > 0) {
    const sNorm = staffName.toLowerCase();
    const candidateNames = [
      prospect.createdByName,
      (prospect as any).creatorName,
      (prospect as any).assignedStaffName,
      (prospect as any).assignedUserName,
      (prospect as any).recordedByName,
      (prospect as any).registeredByName,
    ];
    for (const cName of candidateNames) {
      if (cName && String(cName).trim().toLowerCase() === sNorm) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Checks if a user has write permission for prospects (POST /prospects and PATCH /prospects/:id).
 *
 * Scope rule:
 * - admin, super_admin, marketing_director, marketing_staff, customer_service -> true
 * - secretary, branch_manager, accounts, unknown roles -> false
 *
 * Note: Marketing Director manages the marketing pipeline, so write access mirrors read access
 * and they are added to canWriteProspects.
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
  branches: any[] = []
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
