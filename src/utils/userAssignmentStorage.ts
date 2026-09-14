// src/utils/userAssignmentStorage.ts
import { useState, useEffect } from 'react';
import { recordEntityBranch, getStoredEntityBranch, getBranchCanonicalKey, getUserBranchName } from '@/utils/branchIsolation';

const USER_ASSIGNMENT_STORAGE_KEY = 'omark_user_assignments';
const BRANCH_STAFF_STORAGE_KEY = 'omark_branch_staff_roster';
const BRANCH_OVERRIDES_STORAGE_KEY = 'omark_branch_overrides';

export interface StoredUserAssignment {
  userId: string;
  branchId?: string;
  branchName?: string;
  departmentId?: string;
  departmentName?: string;
  department?: string;
  role?: string;
  updatedAt?: string;
}

/**
 * Standard department mapping by role for clean fallbacks across the system.
 */
export const ROLE_DEFAULT_DEPARTMENTS: Record<string, string> = {
  admin: 'Executive Administration',
  branch_manager: 'Branch Operations',
  marketing_director: 'Marketing & Sales',
  marketing_staff: 'Marketing & Sales',
  customer_service: 'Customer Service',
  secretary: 'Administration',
  accounts: 'Finance & Accounts',
};

export const resolveDefaultDepartment = (role?: string): string => {
  if (!role) return 'General Operations';
  return ROLE_DEFAULT_DEPARTMENTS[role] || 'General Operations';
};

/**
 * Returns all stored user assignments from localStorage.
 */
export const getAllStoredUserAssignments = (): Record<string, StoredUserAssignment> => {
  try {
    const raw = localStorage.getItem(USER_ASSIGNMENT_STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch (err) {
    console.warn('Failed to parse user assignments from storage:', err);
    return {};
  }
};

/**
 * Retrieves the stored assignment for a specific user ID.
 */
export const getStoredUserAssignment = (userId: string | undefined): StoredUserAssignment | undefined => {
  if (!userId) return undefined;
  try {
    const map = getAllStoredUserAssignments();
    const stored = map[userId];
    
    // Check if there is an entity branch record stored via branchIsolation as fallback
    const fallbackBranchId = getStoredEntityBranch(userId);
    if (!stored && fallbackBranchId) {
      return {
        userId,
        branchId: fallbackBranchId,
        updatedAt: new Date().toISOString(),
      };
    }

    if (stored && !stored.branchId && fallbackBranchId) {
      return {
        ...stored,
        branchId: fallbackBranchId,
      };
    }

    return stored;
  } catch {
    return undefined;
  }
};

/**
 * Persists an assignment (branch and/or department) for a user in local client storage.
 * Also synchronizes with entity branch isolation and dispatches a change event.
 */
export const setStoredUserAssignment = (
  userId: string,
  assignment: Partial<StoredUserAssignment>
): void => {
  if (!userId) return;
  try {
    const map = getAllStoredUserAssignments();
    const existing = map[userId] || { userId };

    const updated: StoredUserAssignment = {
      ...existing,
      ...assignment,
      userId,
      updatedAt: new Date().toISOString(),
    };

    // If departmentName or department is set, keep them in sync
    if (updated.department && !updated.departmentName) {
      updated.departmentName = updated.department;
    } else if (updated.departmentName && !updated.department) {
      updated.department = updated.departmentName;
    }

    map[userId] = updated;
    localStorage.setItem(USER_ASSIGNMENT_STORAGE_KEY, JSON.stringify(map));

    // Also link with branchIsolation so branch-level filtering recognizes this staff member
    if (updated.branchId) {
      recordEntityBranch('staff', userId, updated.branchId);
    }

    // Broadcast change for instant UI reactivity
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('omark-assignment-changed', {
          detail: { userId, assignment: updated },
        })
      );
    }
  } catch (err) {
    console.warn('Failed to save user assignment to storage:', err);
  }
};

/**
 * Removes a user's assignment record.
 */
export const removeStoredUserAssignment = (userId: string): void => {
  if (!userId) return;
  try {
    const map = getAllStoredUserAssignments();
    delete map[userId];
    localStorage.setItem(USER_ASSIGNMENT_STORAGE_KEY, JSON.stringify(map));
  } catch (err) {
    console.warn('Failed to remove user assignment from storage:', err);
  }
};

// ── Branch Staff Roster Storage ─────────────────────────────────────────────

/**
 * Returns map of branchId/canonicalKey -> array of user IDs
 */
export const getAllStoredBranchStaffRosters = (): Record<string, string[]> => {
  try {
    const raw = localStorage.getItem(BRANCH_STAFF_STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch (err) {
    console.warn('Failed to parse branch staff rosters from storage:', err);
    return {};
  }
};

/**
 * Retrieves the staff member user IDs attached to a given branch.
 */
export const getStoredBranchStaff = (branchIdOrKey: string): string[] => {
  if (!branchIdOrKey) return [];
  try {
    const all = getAllStoredBranchStaffRosters();
    const direct = all[branchIdOrKey];
    if (Array.isArray(direct) && direct.length > 0) return direct;

    const canonical = getBranchCanonicalKey(branchIdOrKey);
    if (canonical && Array.isArray(all[canonical])) {
      return all[canonical];
    }
    return direct || [];
  } catch {
    return [];
  }
};

/**
 * Sets the full staff member user IDs attached to a branch.
 */
export const setStoredBranchStaff = (
  branchIdOrKey: string,
  userIds: string[],
  branchName?: string
): void => {
  if (!branchIdOrKey) return;
  try {
    const all = getAllStoredBranchStaffRosters();
    const canonical = getBranchCanonicalKey(branchIdOrKey);
    const cleanUserIds = Array.from(new Set(userIds.filter(Boolean)));

    all[branchIdOrKey] = cleanUserIds;
    if (canonical) {
      all[canonical] = cleanUserIds;
    }
    localStorage.setItem(BRANCH_STAFF_STORAGE_KEY, JSON.stringify(all));

    // Update assignment for every user in this list
    cleanUserIds.forEach((uid) => {
      setStoredUserAssignment(uid, {
        branchId: branchIdOrKey,
        branchName: branchName || (canonical === 'accra' ? 'Accra Central' : undefined),
      });
      recordEntityBranch('staff', uid, branchIdOrKey);
    });

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('omark-branch-roster-changed', {
          detail: { branchId: branchIdOrKey, canonical, userIds: cleanUserIds },
        })
      );
    }
  } catch (err) {
    console.warn('Failed to save branch staff roster:', err);
  }
};

/**
 * Adds a staff member to a branch roster and persists their user assignment.
 */
export const addStaffToBranchRoster = (
  branchIdOrKey: string,
  userId: string,
  branchName?: string
): void => {
  if (!branchIdOrKey || !userId) return;
  const current = getStoredBranchStaff(branchIdOrKey);
  if (!current.includes(userId)) {
    setStoredBranchStaff(branchIdOrKey, [...current, userId], branchName);
  }
};

/**
 * Removes a staff member from a branch roster.
 */
export const removeStaffFromBranchRoster = (
  branchIdOrKey: string,
  userId: string
): void => {
  if (!branchIdOrKey || !userId) return;
  const current = getStoredBranchStaff(branchIdOrKey);
  const next = current.filter((id) => id !== userId);
  setStoredBranchStaff(branchIdOrKey, next);
};

// ── Branch Overrides Storage ────────────────────────────────────────────────

export interface StoredBranchOverride {
  managerUserId?: string;
  staffUserIds?: string[];
  name?: string;
  location?: string;
  phone?: string;
  targetRevenueMinor?: number;
  approvalLimitMinor?: number;
  updatedAt?: string;
}

export const getStoredBranchOverrides = (): Record<string, StoredBranchOverride> => {
  try {
    const raw = localStorage.getItem(BRANCH_OVERRIDES_STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
};

export const setStoredBranchOverride = (
  branchId: string,
  override: Partial<StoredBranchOverride>
): void => {
  if (!branchId) return;
  try {
    const map = getStoredBranchOverrides();
    const canonical = getBranchCanonicalKey(branchId);
    const existing = map[branchId] || (canonical ? map[canonical] : undefined) || {};

    const updated: StoredBranchOverride = {
      ...existing,
      ...override,
      updatedAt: new Date().toISOString(),
    };

    map[branchId] = updated;
    if (canonical) {
      map[canonical] = updated;
    }
    localStorage.setItem(BRANCH_OVERRIDES_STORAGE_KEY, JSON.stringify(map));

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('omark-branch-override-changed', {
          detail: { branchId, canonical, override: updated },
        })
      );
    }
  } catch (err) {
    console.warn('Failed to save branch override:', err);
  }
};

// ── Matching & Normalization Helpers ────────────────────────────────────────

/**
 * Checks whether a user belongs to a branch using exhaustive multi-tier verification:
 * - Direct managerUserId match or managerInfo match
 * - Branch roster user list match
 * - Direct branchId / branch / branchCode match
 * - Canonical branch key matching (kumasi, accra, takoradi, etc.)
 */
export const isUserInBranch = (user: any, branch: any): boolean => {
  if (!user || !branch) return false;
  const uId = user.id || user.userId;
  if (!uId) return false;

  // 1. Branch Manager match
  const branchOverrides = getStoredBranchOverrides();
  const storedOverride = branchOverrides[branch.id] || branchOverrides[getBranchCanonicalKey(branch.id || branch.name)];
  const managerId = branch.managerUserId || branch.managerInfo?.id || storedOverride?.managerUserId;
  if (managerId && managerId === uId) {
    return true;
  }

  // 2. Explicit branch roster match
  const rosterStaff = getStoredBranchStaff(branch.id);
  const rosterByCanon = getStoredBranchStaff(getBranchCanonicalKey(branch.id || branch.name));
  const rosterByName = getStoredBranchStaff(branch.name);
  if (
    rosterStaff.includes(uId) ||
    rosterByCanon.includes(uId) ||
    rosterByName.includes(uId) ||
    (Array.isArray(branch.staffUserIds) && branch.staffUserIds.includes(uId)) ||
    (Array.isArray(storedOverride?.staffUserIds) && storedOverride.staffUserIds.includes(uId))
  ) {
    return true;
  }

  // 3. User's stored assignment and entity branch tags
  const storedAssignment = getStoredUserAssignment(uId);
  const entityBranch = getStoredEntityBranch(uId);
  const uBranchId =
    storedAssignment?.branchId ||
    user.branchId ||
    user.branch ||
    entityBranch;

  if (uBranchId) {
    // Direct ID or name match
    if (
      uBranchId === branch.id ||
      uBranchId === branch.name ||
      uBranchId === branch.branchCode
    ) {
      return true;
    }

    // Canonical key match
    const userCanon = getBranchCanonicalKey(uBranchId || storedAssignment?.branchName || user.branchName);
    const branchCanon = getBranchCanonicalKey(branch.id || branch.name || branch.branchCode || branch.location);
    if (userCanon && branchCanon && userCanon === branchCanon) {
      return true;
    }
  }

  // 4. If target branch is Accra, check for canonical Accra indicators
  const branchCanon = getBranchCanonicalKey(branch.id || branch.name || branch.branchCode || branch.location);
  if (branchCanon === 'accra') {
    if (
      uBranchId === 'b2' ||
      uBranchId === 'branch-accra-hq' ||
      uBranchId === 'accra' ||
      uBranchId === 'ACC'
    ) {
      return true;
    }
  }

  return false;
};

/**
 * Enriches any user entity with persistent assignments, department names,
 * and canonical branch metadata.
 */
export const enrichUserWithAssignment = (user: any, branches: any[] = []): any => {
  if (!user?.id) return user;
  const stored = getStoredUserAssignment(user.id);
  const entityBranch = getStoredEntityBranch(user.id);

  // Look for branch where user is designated manager or roster member
  const branchWhereManager = branches.find((b) => b.managerUserId === user.id || b.managerInfo?.id === user.id);
  const branchWhereStaff = branches.find((b) => isUserInBranch(user, b));
  const activeBranch = branchWhereManager || branchWhereStaff;

  const defaultDept = resolveDefaultDepartment(user.role);
  const branchId =
    activeBranch?.id ||
    stored?.branchId ||
    user.branchId ||
    user.branch ||
    entityBranch;

  const branchName =
    activeBranch?.name ||
    stored?.branchName ||
    (branchId ? getUserBranchName({ branchId }, branches) : undefined);

  const department =
    stored?.departmentName ||
    stored?.department ||
    user.department ||
    defaultDept;

  const departmentId = stored?.departmentId || user.departmentId;

  return {
    ...user,
    branchId,
    branch: branchName || branchId,
    branchName,
    departmentId,
    department,
  };
};

/**
 * React hook that triggers a re-render whenever assignments, rosters, or overrides change.
 */
export const useAssignmentListener = (): number => {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const handleUpdate = () => setTick((t) => t + 1);
    window.addEventListener('omark-assignment-changed', handleUpdate);
    window.addEventListener('omark-branch-roster-changed', handleUpdate);
    window.addEventListener('omark-branch-override-changed', handleUpdate);

    return () => {
      window.removeEventListener('omark-assignment-changed', handleUpdate);
      window.removeEventListener('omark-branch-roster-changed', handleUpdate);
      window.removeEventListener('omark-branch-override-changed', handleUpdate);
    };
  }, []);

  return tick;
};
