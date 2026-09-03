// src/utils/branchIsolation.ts
import { roleLabels } from '@/constants/enums';
import { getStaffAssignment } from '@/mock/staffAssignments';

export interface BranchInfo {
  id: string;
  name: string;
  branchCode?: string;
}

export const CANONICAL_BRANCH_SLOTS = [
  'kumasi',
  'accra',
  'takoradi',
  'tamale',
  'wa',
  'tafo',
] as const;

/**
 * Returns a standardized canonical key for any branch identifier, code, or name.
 */
export const getBranchCanonicalKey = (branchIdOrName?: string): string => {
  if (!branchIdOrName) return '';
  const s = String(branchIdOrName).toLowerCase().trim();

  if (s.includes('wa')) return 'wa';
  if (s.includes('tafo')) return 'tafo';
  if (s.includes('accra') || s === 'b2' || s === 'acc') return 'accra';
  if (s.includes('kumasi') || s === 'b1' || s === 'kma' || s.includes('head') || s.includes('main')) return 'kumasi';
  if (s.includes('takoradi') || s === 'b3' || s === 'tkd') return 'takoradi';
  if (s.includes('tamale') || s === 'b4' || s === 'tml') return 'tamale';

  return s;
};

/**
 * Resolves the branch ID for a user based on local storage assignments and direct user attributes.
 */
export const getUserBranchId = (user: any): string | undefined => {
  if (!user?.id) return undefined;
  const assignment = getStaffAssignment(user.id);
  return assignment?.branchId || user.branchId || user.branch || user.branchCode;
};

/**
 * Resolves the official branch name for a user.
 */
export const getUserBranchName = (user: any, branches: BranchInfo[] = []): string | undefined => {
  if (!user) return undefined;
  const bId = getUserBranchId(user);
  if (!bId) return undefined;

  const branch = branches.find(
    (b) => b.id === bId || b.branchCode === bId || b.name === bId || getBranchCanonicalKey(b.id) === getBranchCanonicalKey(bId)
  );
  if (branch) return branch.name;

  const canonical = getBranchCanonicalKey(bId);
  const fallbackNames: Record<string, string> = {
    kumasi: 'Kumasi Main',
    accra: 'Accra Central',
    takoradi: 'Takoradi',
    tamale: 'Tamale',
    wa: 'Wa Branch',
    tafo: 'Tafo Branch',
  };

  return fallbackNames[canonical] || (typeof bId === 'string' && bId.length > 0 ? bId : undefined);
};

/**
 * Returns explicit Branch Role Title e.g. "Accra Branch Secretary", "Wa Branch Customer Service", "Tafo Branch Marketing Staff".
 */
export const getUserBranchRoleTitle = (user: any, branches: BranchInfo[] = []): string => {
  if (!user) return '';
  const roleDisplay = roleLabels[user.role as keyof typeof roleLabels] || user.role || 'Staff';

  if (user.role === 'admin') {
    return 'Head Office Administrator';
  }

  const branchName = getUserBranchName(user, branches);

  if (branchName) {
    const formattedBranch = branchName.toLowerCase().includes('branch')
      ? branchName
      : `${branchName} Branch`;
    return `${formattedBranch} ${roleDisplay}`;
  }

  return roleDisplay;
};

/**
 * Deterministically maps any untagged item ID to one of the canonical branches.
 */
export const getDeterministicBranchSlot = (itemIdentifier: string | number): string => {
  const str = String(itemIdentifier || 'omark-item');
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % CANONICAL_BRANCH_SLOTS.length;
  return CANONICAL_BRANCH_SLOTS[index];
};

/**
 * Filters any list of entities (prospects, customers, complaints, payments, plans) by a target branch ID.
 * Admins get all items unless a specific branch filter is passed.
 * Non-admins strictly get records matching their branch canonical key.
 */
export const filterEntitiesByBranch = <T extends Record<string, any>>(
  items: T[],
  user: any,
  branches: BranchInfo[] = [],
  overrideBranchId?: string
): T[] => {
  if (!Array.isArray(items)) return [];

  // Admins see all data across all branches unless an explicit override branch filter is applied
  if (user?.role === 'admin' && !overrideBranchId) {
    return items;
  }

  const targetBranch = overrideBranchId || getUserBranchId(user);
  const userCanonical = getBranchCanonicalKey(targetBranch || 'kumasi');

  return items.filter((item, index) => {
    // 1. Direct branch ID or name on item
    const itemBranch = item.branchId || item.branch || item.branchName || item.location;
    if (itemBranch) {
      const itemCanonical = getBranchCanonicalKey(itemBranch);
      if (itemCanonical === userCanonical) return true;
    }

    // 2. User assignment match on item creator / assigned staff
    const assignedId = item.assignedUserId || item.recordedByUserId || item.generatedByUserId;
    if (assignedId) {
      const creatorBranch = getUserBranchId({ id: assignedId });
      if (creatorBranch && getBranchCanonicalKey(creatorBranch) === userCanonical) {
        return true;
      }
    }

    // 3. If item has no explicit branch metadata, partition deterministically across branch slots
    if (!itemBranch && !assignedId) {
      const idKey = item.id || item.code || item.name || item.firstName || index;
      const assignedSlot = getDeterministicBranchSlot(idKey);
      return assignedSlot === userCanonical;
    }

    return false;
  });
};

/**
 * Tags a new payload object with the logged-in staff member's branch ID.
 */
export const tagPayloadWithBranch = <T extends Record<string, any>>(
  payload: T,
  user: any
): T => {
  const branchId = getUserBranchId(user);
  if (!branchId) return payload;
  return {
    ...payload,
    branchId,
    assignedUserId: user?.id || payload.assignedUserId,
  };
};
