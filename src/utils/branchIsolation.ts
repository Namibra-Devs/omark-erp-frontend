// src/utils/branchIsolation.ts
import { roleLabels } from '@/constants/enums';

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
 * Resolves the branch ID for a user based on direct user attributes.
 */
export const getUserBranchId = (user: any): string | undefined => {
  if (!user?.id) return undefined;
  return user.branchId || user.branch || user.branchCode;
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

const ENTITY_BRANCH_STORAGE_KEY = 'omark_entity_branch_map';

interface StoredBranchRecord {
  branchId: string;
  userId?: string;
  entityType?: string;
  timestamp: string;
}

/**
 * Persists an entity's branch affiliation in local client storage.
 * Ensures entities created by branch staff are remembered even if the backend
 * table lacks an explicit branchId column.
 */
export const recordEntityBranch = (
  entityType: string,
  entityId: string,
  branchId: string,
  userId?: string
) => {
  if (!entityId || !branchId) return;
  try {
    const raw = localStorage.getItem(ENTITY_BRANCH_STORAGE_KEY);
    const map: Record<string, StoredBranchRecord> = raw ? JSON.parse(raw) : {};
    map[entityId] = {
      branchId,
      userId,
      entityType,
      timestamp: new Date().toISOString(),
    };
    localStorage.setItem(ENTITY_BRANCH_STORAGE_KEY, JSON.stringify(map));
  } catch (err) {
    console.warn('Failed to save entity branch to storage:', err);
  }
};

/**
 * Looks up any recorded branch affiliation for an entity ID.
 */
export const getStoredEntityBranch = (entityId: string): string | undefined => {
  if (!entityId) return undefined;
  try {
    const raw = localStorage.getItem(ENTITY_BRANCH_STORAGE_KEY);
    if (!raw) return undefined;
    const map: Record<string, StoredBranchRecord> = JSON.parse(raw);
    return map[entityId]?.branchId;
  } catch {
    return undefined;
  }
};

/**
 * Deterministically maps any untagged item ID to one of the canonical branches.
 * Note: Used only for legacy mock simulation if explicitly required.
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
 * Head office staff or users without an explicit branch assignment see all records.
 * Non-admins strictly get records matching their branch canonical key or records in the general shared pool.
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
  
  // If user has no branch constraint (e.g. accounts, general management, unassigned), show all items
  if (!targetBranch && !overrideBranchId) {
    return items;
  }

  const userCanonical = getBranchCanonicalKey(targetBranch);

  return items.filter((item) => {
    // 1. Direct branch ID or name on item, or stored branch mapping
    const itemBranch = 
      item.branchId || 
      item.branch || 
      item.branchName || 
      item.location || 
      getStoredEntityBranch(item.id);

    if (itemBranch) {
      const itemCanonical = getBranchCanonicalKey(itemBranch);
      return itemCanonical === userCanonical;
    }

    // 2. User assignment match on item creator / assigned staff
    const assignedId = item.assignedUserId || item.recordedByUserId || item.generatedByUserId;
    if (assignedId) {
      // If the current user created or was assigned to this item, it is visible to them
      if (user?.id && assignedId === user.id) {
        return true;
      }
      const creatorBranch = getStoredEntityBranch(assignedId) || getUserBranchId({ id: assignedId });
      if (creatorBranch && getBranchCanonicalKey(creatorBranch) === userCanonical) {
        return true;
      }
    }

    // 3. If item has no explicit branch metadata at all (e.g. customer table in backend without branchId),
    // treat it as part of the accessible shared entity pool rather than discarding it via hash partitioning
    return true;
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
  const tagged = {
    ...payload,
    branchId,
    assignedUserId: user?.id || payload.assignedUserId,
  };
  if (payload.id) {
    recordEntityBranch('entity', payload.id, branchId, user?.id);
  }
  return tagged;
};
