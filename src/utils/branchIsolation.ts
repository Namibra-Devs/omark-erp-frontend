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
 * Resolves the branch ID for a user based on direct user attributes or string ID.
 */
export const getUserBranchId = (user: any): string | undefined => {
  if (!user) return undefined;
  if (typeof user === 'string') return user.trim();
  return (
    user.branchId ||
    user.branch ||
    user.branchCode ||
    (user.id && (user.id.startsWith('b') || /^[0-9a-fA-F]{20,32}$/.test(user.id)) ? user.id : undefined)
  );
};

/**
 * Resolves the official uniform branch name for a user or branch identifier.
 * Ensures raw hex IDs (e.g. MongoDB ObjectIDs) and unnormalized variants
 * always resolve cleanly to human-readable branch names (e.g. "Kumasi Main").
 */
export const getUserBranchName = (userOrBranchId: any, branches: BranchInfo[] = []): string | undefined => {
  if (!userOrBranchId) return undefined;
  let bId: string | undefined;
  if (typeof userOrBranchId === 'string') {
    bId = userOrBranchId.trim();
  } else {
    bId =
      userOrBranchId.branchName ||
      userOrBranchId.branch ||
      userOrBranchId.branchId ||
      userOrBranchId.branchCode ||
      getUserBranchId(userOrBranchId);
  }
  if (!bId || bId === 'Unassigned') return undefined;

  // 1. Direct branch lookup in provided branches list
  const directBranch = branches.find(
    (b) =>
      b.id === bId ||
      b.branchCode === bId ||
      b.name === bId ||
      (b.name && b.name.toLowerCase() === bId!.toLowerCase()) ||
      (b.branchCode && b.branchCode.toLowerCase() === bId!.toLowerCase())
  );
  if (directBranch) return directBranch.name;

  // 2. Canonical key matching
  const bIdCanonical = getBranchCanonicalKey(bId);
  if (bIdCanonical) {
    const matchedByCanon = branches.find(
      (b) => getBranchCanonicalKey(b.name || b.id || b.branchCode) === bIdCanonical
    );
    if (matchedByCanon) return matchedByCanon.name;
  }

  // 3. Fallback standard uniform branch names
  const fallbackNames: Record<string, string> = {
    kumasi: 'Kumasi Main',
    accra: 'Accra Central',
    takoradi: 'Takoradi Branch',
    tamale: 'Tamale Branch',
    wa: 'Wa Branch',
    tafo: 'Tafo Branch',
    b1: 'Kumasi Main',
    b2: 'Accra Central',
    b3: 'Takoradi Branch',
    b4: 'Tamale Branch',
  };

  if (bIdCanonical && fallbackNames[bIdCanonical]) {
    return fallbackNames[bIdCanonical];
  }

  // 4. Raw MongoDB ObjectIDs or hex IDs (e.g. 6a9ecc352c8bf0658b4a...)
  if (typeof bId === 'string' && /^[0-9a-fA-F]{20,32}$/.test(bId)) {
    return 'Kumasi Main';
  }

  // 5. Normalization for common aliases / uppercase strings ("KUMASI", "KMA", "ACCRA")
  if (typeof bId === 'string') {
    const clean = bId.toLowerCase();
    if (clean === 'kumasi' || clean === 'kma') return 'Kumasi Main';
    if (clean === 'accra' || clean === 'acc') return 'Accra Central';
    if (clean === 'takoradi' || clean === 'tkd') return 'Takoradi Branch';
    if (clean === 'tamale' || clean === 'tml') return 'Tamale Branch';
  }

  return undefined;
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

  let branchName = getUserBranchName(user, branches);
  if (branchName && /^[0-9a-fA-F]{20,32}$/.test(branchName)) {
    branchName = 'Kumasi Main';
  }

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
 * Admins, Accounts, and Marketing Director get all items unless a specific branch filter is passed.
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

  // Admins and company-wide executive / financial oversight roles see all data across all branches
  // unless an explicit override branch filter is applied
  const normalizedRole = String(user?.role || '').toLowerCase().trim().replace(/[\s-]+/g, '_');
  const isGlobalOversightRole =
    normalizedRole === 'admin' ||
    normalizedRole === 'accounts' ||
    normalizedRole === 'marketing_director' ||
    normalizedRole.includes('director') ||
    normalizedRole.includes('admin') ||
    normalizedRole.includes('account');

  if (isGlobalOversightRole && !overrideBranchId) {
    return items;
  }

  const targetBranch = overrideBranchId || getUserBranchId(user);
  
  // If user has no branch constraint (e.g. unassigned), show all items
  if (!targetBranch && !overrideBranchId) {
    return items;
  }

  const resolveCanonical = (val?: string) => {
    if (!val) return '';
    if (branches && branches.length > 0) {
      const found = branches.find(
        (b) => b.id === val || b.branchCode === val || b.name === val
      );
      if (found) {
        return getBranchCanonicalKey(found.name || found.branchCode || found.id);
      }
    }
    return getBranchCanonicalKey(val);
  };

  const userCanonical = resolveCanonical(targetBranch);

  return items.filter((item) => {
    // 0. If current user created or was assigned to this item, it is ALWAYS visible to them!
    const assignedId =
      item.assignedUserId ||
      item.assignedStaffId ||
      item.assignedTo ||
      item.createdByUserId ||
      item.creatorId ||
      item.recordedByUserId ||
      item.generatedByUserId ||
      item.userId ||
      item.staffId ||
      item.hostUserId ||
      item.hostId ||
      item.marketerId ||
      item.agentId ||
      item.bookedByUserId ||
      item.updatedByUserId ||
      item.feedbackByUserId ||
      item.attendedByUserId;
    if (user?.id && assignedId && String(assignedId).toLowerCase() === String(user.id).toLowerCase()) {
      return true;
    }

    // Name-based match on assigned/created fields
    const candidateNames = [
      item.assignedUserName,
      item.assignedStaffName,
      item.createdByName,
      item.creatorName,
      item.staffName,
      item.marketerName,
      item.agentName,
      item.hostName,
      item.bookedByName,
      item.updatedByName,
      item.attendedByName,
    ];
    const userFullName = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim().toLowerCase() : '';
    const userSimpleName = String(user?.name || '').trim().toLowerCase();
    for (const cName of candidateNames) {
      if (cName) {
        const cn = String(cName).trim().toLowerCase();
        if ((userFullName && cn === userFullName) || (userSimpleName && cn === userSimpleName)) {
          return true;
        }
      }
    }

    // 1. Direct branch ID or name on item, or stored branch mapping
    const itemBranch = 
      item.branchId || 
      item.branch || 
      item.branchName || 
      item.location || 
      getStoredEntityBranch(item.id);

    if (itemBranch) {
      if (itemBranch === targetBranch) {
        return true;
      }
      const itemCanonical = resolveCanonical(itemBranch);
      if (itemCanonical && userCanonical && itemCanonical === userCanonical) {
        return true;
      }
      return false;
    }

    // 2. User assignment match on item creator / assigned staff
    if (assignedId) {
      const creatorBranch = getStoredEntityBranch(assignedId) || getUserBranchId({ id: assignedId });
      if (creatorBranch) {
        if (creatorBranch === targetBranch) return true;
        const creatorCanon = resolveCanonical(creatorBranch);
        if (creatorCanon && userCanonical && creatorCanon === userCanonical) {
          return true;
        }
      }
    }

    // 3. If item has no explicit branch metadata at all, treat it as part of shared pool
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
    assignedUserId: payload.assignedUserId || user?.id,
  };
  if (payload.id) {
    recordEntityBranch('entity', payload.id, branchId, user?.id);
  }
  return tagged;
};
