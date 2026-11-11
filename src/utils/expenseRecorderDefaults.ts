// src/utils/expenseRecorderDefaults.ts
import { normalizeDepartmentName } from './departmentExpenses.ts';

export const EXPENSE_ROLE_LABELS: Record<string, string> = {
  admin: 'Administrator',
  branch_manager: 'Branch Manager',
  marketing_staff: 'Marketing Staff',
  marketing_director: 'Marketing Director',
  customer_service: 'Customer Service',
  secretary: 'Secretary',
  accounts: 'Accounts',
};

export interface ExpenseBranchLike {
  id: string;
  name: string;
  branchCode?: string;
  managerUserId?: string;
  managerInfo?: { id?: string };
  staffUserIds?: string[];
}

export interface ExpenseUserLike {
  id?: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  email?: string;
  role?: string;
  branchId?: string;
  branch?: string;
  branchName?: string;
  department?: string;
  departmentId?: string;
}

export interface StoredAssignmentLike {
  branchId?: string;
  branchName?: string;
  departmentId?: string;
  departmentName?: string;
  department?: string;
  role?: string;
  firstName?: string;
  lastName?: string;
  name?: string;
}

export interface ExpenseRecorderDefaults {
  userId?: string;
  userName: string;
  role: string;
  roleLabel: string;
  department: string;
  branchId?: string;
  branchName: string;
}

const HEX_OBJECT_ID_RE = /^[0-9a-fA-F]{20,32}$/;

const CANONICAL_FALLBACK_NAMES: Record<string, string> = {
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

export function getExpenseCanonicalBranchKey(branchIdOrName?: string): string {
  if (!branchIdOrName) return '';
  const s = String(branchIdOrName).toLowerCase().trim();

  if (s.includes('wa')) return 'wa';
  if (s.includes('tafo')) return 'tafo';
  if (s.includes('accra') || s === 'b2' || s === 'acc') return 'accra';
  if (s.includes('kumasi') || s === 'b1' || s === 'kma' || s.includes('head') || s.includes('main')) return 'kumasi';
  if (s.includes('takoradi') || s === 'b3' || s === 'tkd') return 'takoradi';
  if (s.includes('tamale') || s === 'b4' || s === 'tml') return 'tamale';

  return s;
}

export function formatExpenseRoleLabel(role?: string): string {
  if (!role) return 'Staff';
  const normalized = String(role).toLowerCase().trim();
  if (EXPENSE_ROLE_LABELS[normalized]) {
    return EXPENSE_ROLE_LABELS[normalized];
  }
  return normalized
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
}

export function resolveExpenseUserName(
  user?: ExpenseUserLike | null,
  storedAssignment?: StoredAssignmentLike | null
): string {
  const fullFromParts = [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim();
  const storedParts = [storedAssignment?.firstName, storedAssignment?.lastName].filter(Boolean).join(' ').trim();

  const resolved =
    storedAssignment?.name?.trim() ||
    storedParts ||
    user?.name?.trim() ||
    fullFromParts ||
    user?.email?.trim();

  return resolved || 'Authorized Staff';
}

export function resolveExpenseUserBranch(
  user?: ExpenseUserLike | null,
  branches: ExpenseBranchLike[] = [],
  storedAssignment?: StoredAssignmentLike | null,
  fallbackBranch?: { id?: string; name?: string } | null
): { branchId?: string; branchName: string } {
  const candidateRefs = [
    storedAssignment?.branchId,
    user?.branchId,
    user?.branch,
    storedAssignment?.branchName,
    user?.branchName,
  ].filter((v): v is string => typeof v === 'string' && v.trim().length > 0);

  // Check if user is explicitly assigned on a branch object's roster/manager field
  const rosterBranch = user?.id
    ? branches.find(
        (b) =>
          b.managerUserId === user.id ||
          b.managerInfo?.id === user.id ||
          (Array.isArray(b.staffUserIds) && b.staffUserIds.includes(user.id!))
      )
    : undefined;

  if (rosterBranch && candidateRefs.length === 0) {
    return {
      branchId: rosterBranch.id,
      branchName: rosterBranch.name,
    };
  }

  // 1. Exact ID / name / code match across all branch references
  for (const ref of candidateRefs) {
    const trimmed = ref.trim();
    const exactMatch = branches.find(
      (b) =>
        b.id === trimmed ||
        b.branchCode === trimmed ||
        b.name.toLowerCase() === trimmed.toLowerCase()
    );
    if (exactMatch) {
      return {
        branchId: exactMatch.id,
        branchName: exactMatch.name,
      };
    }
  }

  // 2. Canonical branch name match (skips raw hex ObjectIds that didn't match an ID)
  for (const ref of candidateRefs) {
    const trimmed = ref.trim();
    if (HEX_OBJECT_ID_RE.test(trimmed)) continue;
    const canon = getExpenseCanonicalBranchKey(trimmed);
    if (canon) {
      const canonMatch = branches.find(
        (b) => getExpenseCanonicalBranchKey(b.name || b.branchCode || b.id) === canon
      );
      if (canonMatch) {
        return {
          branchId: user?.branchId || storedAssignment?.branchId || canonMatch.id,
          branchName: canonMatch.name,
        };
      }
      if (CANONICAL_FALLBACK_NAMES[canon]) {
        return {
          branchId: user?.branchId || storedAssignment?.branchId || trimmed,
          branchName: CANONICAL_FALLBACK_NAMES[canon],
        };
      }
    }
  }

  // 3. Roster fallback if user had an unresolvable raw ref
  if (rosterBranch) {
    return {
      branchId: user?.branchId || rosterBranch.id,
      branchName: rosterBranch.name,
    };
  }

  // 4. Readable non-hex ref
  const readableRef = candidateRefs.find((r) => !HEX_OBJECT_ID_RE.test(r.trim()));
  if (readableRef) {
    return {
      branchId: storedAssignment?.branchId || user?.branchId || readableRef,
      branchName: readableRef.trim(),
    };
  }

  // 5. Raw hex ObjectId without local branch table match -> map safely to Kumasi Main unless admin Head Office
  const rawHexRef = candidateRefs.find((r) => HEX_OBJECT_ID_RE.test(r.trim()));
  if (rawHexRef) {
    return {
      branchId: rawHexRef.trim(),
      branchName: CANONICAL_FALLBACK_NAMES.kumasi,
    };
  }

  // 6. Explicit contextual fallback (e.g., visiting a specific BranchDashboard page)
  if (fallbackBranch?.id || fallbackBranch?.name) {
    return {
      branchId: fallbackBranch.id,
      branchName: fallbackBranch.name || 'Kumasi Main',
    };
  }

  // 7. Unassigned corporate / head office user
  return {
    branchId: undefined,
    branchName: 'Head Office',
  };
}

export function resolveExpenseRecorderDefaults(params: {
  user?: ExpenseUserLike | null;
  branches?: ExpenseBranchLike[];
  storedAssignment?: StoredAssignmentLike | null;
  fallbackRole?: string;
  fallbackBranch?: { id?: string; name?: string } | null;
}): ExpenseRecorderDefaults {
  const { user, branches = [], storedAssignment, fallbackRole = 'secretary', fallbackBranch } = params;

  const role = String(user?.role || storedAssignment?.role || fallbackRole).toLowerCase().trim();
  const roleLabel = formatExpenseRoleLabel(role);
  const userName = resolveExpenseUserName(user, storedAssignment);
  const { branchId, branchName } = resolveExpenseUserBranch(user, branches, storedAssignment, fallbackBranch);
  const department = normalizeDepartmentName(
    storedAssignment?.departmentName || storedAssignment?.department || user?.department,
    role
  );

  return {
    userId: user?.id,
    userName,
    role,
    roleLabel,
    department,
    branchId,
    branchName,
  };
}

