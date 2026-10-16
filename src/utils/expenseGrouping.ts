// src/utils/expenseGrouping.ts
import dayjs from 'dayjs';

export interface ExpenseItemLike {
  id: string;
  code?: string;
  category: string;
  type: 'internal' | 'external';
  amountMinor: number;
  incurredOn: string;
  branchId?: string;
  branchName?: string;
  department?: string;
  description?: string;
  status: 'pending' | 'approved' | 'rejected';
  recordedByUserId?: string;
  recordedByUserName?: string;
  recordedByUserRole?: string;
  decisionNote?: string;
  decidedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserLike {
  id: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  email?: string;
  role?: string;
}

function resolveUserFullName(user: UserLike): string {
  if (user.name) return user.name;
  return [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email || '';
}

export type GroupByLevel2 = 'staff' | 'role';

export interface GroupedDay<T extends ExpenseItemLike = ExpenseItemLike> {
  dateKey: string; // 'YYYY-MM-DD'
  dateLabel: string; // 'Fri, 16 Oct 2026'
  dayOfMonth: number; // 1 to 31
  totalMinor: number;
  count: number;
  items: T[];
}

export interface GroupedStaffOrRole<T extends ExpenseItemLike = ExpenseItemLike> {
  key: string; // userId or roleKey or 'unassigned'
  id?: string; // userId if staff
  name: string; // Display name
  role?: string; // e.g. 'secretary', 'branch_manager'
  roleLabel?: string; // Formatted label e.g. 'Secretary'
  isCurrentUser?: boolean;
  totalMinor: number;
  percentageOfMonth: number; // 0 - 100
  count: number;
  days: GroupedDay<T>[]; // sorted newest day first
  earliestDayOfMonth: number; // for sorting 1st to 31st
  distinctDatesCount: number;
}

export interface GroupedMonth<T extends ExpenseItemLike = ExpenseItemLike> {
  monthKey: string; // 'YYYY-MM'
  monthLabel: string; // 'October 2026'
  year: number;
  month: number; // 1 - 12
  isCurrentMonth: boolean;
  totalMinor: number;
  count: number;
  staffCount: number;
  groups: GroupedStaffOrRole<T>[]; // sorted by dates (1st to 31st)
}

export interface ExpenseGroupingResult<T extends ExpenseItemLike = ExpenseItemLike> {
  months: GroupedMonth<T>[]; // sorted newest month first
  overallTotalMinor: number;
  overallCount: number;
  overallStaffCount: number;
}

export interface GroupingOptions<U extends UserLike = UserLike> {
  groupBy: GroupByLevel2; // 'staff' | 'role'
  currentUserId?: string;
  usersById?: Map<string, U>;
  usersByName?: Map<string, U>;
}

export const ROLE_DISPLAY_NAMES: Record<string, string> = {
  admin: 'Administrator',
  accounts: 'Finance & Accounts',
  finance: 'Finance & Accounts',
  secretary: 'Secretary',
  branch_manager: 'Branch Manager',
  marketing_director: 'Marketing Director',
  marketing_staff: 'Marketing Staff',
  customer_service: 'Customer Service',
};

/**
 * Format an integer minor amount to currency string.
 * Uses '₵' symbol as established on the Expenses page.
 */
export function formatExpenseCurrency(amountMinor: number): string {
  const ghs = (amountMinor || 0) / 100;
  return `₵ ${ghs.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Robust date parser for expense records.
 * Extracts [YYYY, MM, DD] directly from string to avoid browser timezone date boundary shifts.
 */
export function parseExpenseDate(dateStr?: string): {
  dateKey: string; // 'YYYY-MM-DD'
  monthKey: string; // 'YYYY-MM'
  year: number;
  month: number; // 1 - 12
  day: number; // 1 - 31
  dateLabel: string;
  monthLabel: string;
} {
  const fallback = dayjs();
  if (!dateStr || typeof dateStr !== 'string') {
    const dKey = fallback.format('YYYY-MM-DD');
    return {
      dateKey: dKey,
      monthKey: fallback.format('YYYY-MM'),
      year: fallback.year(),
      month: fallback.month() + 1,
      day: fallback.date(),
      dateLabel: fallback.format('ddd, D MMM YYYY'),
      monthLabel: fallback.format('MMMM YYYY'),
    };
  }

  // If dateStr starts with YYYY-MM-DD
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const year = parseInt(match[1], 10);
    const month = parseInt(match[2], 10);
    const day = parseInt(match[3], 10);
    const d = dayjs(`${match[1]}-${match[2]}-${match[3]}`);
    return {
      dateKey: `${match[1]}-${match[2]}-${match[3]}`,
      monthKey: `${match[1]}-${match[2]}`,
      year,
      month,
      day,
      dateLabel: d.isValid() ? d.format('ddd, D MMM YYYY') : `${match[1]}-${match[2]}-${match[3]}`,
      monthLabel: d.isValid() ? d.format('MMMM YYYY') : `${match[1]}-${match[2]}`,
    };
  }

  const parsed = dayjs(dateStr);
  if (parsed.isValid()) {
    const dKey = parsed.format('YYYY-MM-DD');
    return {
      dateKey: dKey,
      monthKey: parsed.format('YYYY-MM'),
      year: parsed.year(),
      month: parsed.month() + 1,
      day: parsed.date(),
      dateLabel: parsed.format('ddd, D MMM YYYY'),
      monthLabel: parsed.format('MMMM YYYY'),
    };
  }

  const dKey = fallback.format('YYYY-MM-DD');
  return {
    dateKey: dKey,
    monthKey: fallback.format('YYYY-MM'),
    year: fallback.year(),
    month: fallback.month() + 1,
    day: fallback.date(),
    dateLabel: fallback.format('ddd, D MMM YYYY'),
    monthLabel: fallback.format('MMMM YYYY'),
  };
}

/**
 * Pure function: Groups a list of expenses into:
 * Month (L1) -> Staff or Role (L2) -> Day (L3) -> Items (L4)
 *
 * Guarantees integer-level arithmetic reconciliation:
 * - sum(day.totalMinor) === staff.totalMinor
 * - sum(staff.totalMinor) === month.totalMinor
 * - sum(month.totalMinor) === overallTotalMinor
 */
export function groupExpenses<
  T extends ExpenseItemLike = ExpenseItemLike,
  U extends UserLike = UserLike
>(
  expenses: T[],
  options: GroupingOptions<U>
): ExpenseGroupingResult<T> {
  const { groupBy, currentUserId, usersById, usersByName } = options;
  const currentMonthKey = dayjs().format('YYYY-MM');

  // Overall totals
  let overallTotalMinor = 0;
  const overallDistinctStaff = new Set<string>();

  // Map: monthKey -> Map: groupKey -> Map: dateKey -> items
  interface InternalStaffBucket {
    key: string;
    id?: string;
    name: string;
    role?: string;
    roleLabel?: string;
    isCurrentUser: boolean;
    daysMap: Map<string, { dateKey: string; dateLabel: string; dayOfMonth: number; items: T[] }>;
  }

  interface InternalMonthBucket {
    monthKey: string;
    monthLabel: string;
    year: number;
    month: number;
    isCurrentMonth: boolean;
    groupsMap: Map<string, InternalStaffBucket>;
  }

  const monthsMap = new Map<string, InternalMonthBucket>();

  for (const exp of expenses) {
    const amt = Math.round(Number(exp.amountMinor) || 0);
    overallTotalMinor += amt;

    const parsedDate = parseExpenseDate(exp.incurredOn || exp.createdAt);
    const { monthKey, dateKey, dateLabel, monthLabel, year, month, day } = parsedDate;

    // Resolve user & role
    let staffId: string | undefined = exp.recordedByUserId;
    let staffName = exp.recordedByUserName?.trim() || '';
    let staffRole = exp.recordedByUserRole?.trim() || '';

    // Match against user catalogue if provided
    let matchedUser: U | undefined;
    if (staffId && usersById) {
      matchedUser = usersById.get(staffId);
    }
    if (!matchedUser && staffName && usersByName) {
      matchedUser = usersByName.get(staffName.toLowerCase());
    }

    if (matchedUser) {
      staffId = matchedUser.id;
      staffName = resolveUserFullName(matchedUser) || staffName;
      staffRole = matchedUser.role || staffRole;
    }

    // Determine Level 2 key
    let groupKey: string;
    let groupDisplayName: string;
    let groupRole: string | undefined;
    let groupRoleLabel: string | undefined;

    if (groupBy === 'role') {
      const normalizedRole = (staffRole || 'unassigned').toLowerCase().replace(/\s+/g, '_');
      groupKey = normalizedRole;
      groupDisplayName = ROLE_DISPLAY_NAMES[normalizedRole] || (normalizedRole === 'unassigned' ? 'Unassigned' : normalizedRole.replace(/_/g, ' '));
      groupRole = normalizedRole;
      groupRoleLabel = groupDisplayName;
    } else {
      // Group by Staff (user ID based)
      if (staffId) {
        groupKey = `user-${staffId}`;
        groupDisplayName = staffName || `Staff (${staffId.slice(-4)})`;
      } else if (staffName && staffName.toLowerCase() !== 'staff member' && staffName.toLowerCase() !== 'unassigned') {
        groupKey = `name-${staffName.toLowerCase()}`;
        groupDisplayName = staffName;
      } else {
        groupKey = 'unassigned';
        groupDisplayName = 'Unassigned';
      }
      groupRole = staffRole || undefined;
      groupRoleLabel = staffRole ? (ROLE_DISPLAY_NAMES[staffRole.toLowerCase()] || staffRole.replace(/_/g, ' ')) : undefined;
    }

    if (staffId) {
      overallDistinctStaff.add(staffId);
    } else {
      overallDistinctStaff.add(groupKey);
    }

    // Month Bucket
    let monthBucket = monthsMap.get(monthKey);
    if (!monthBucket) {
      monthBucket = {
        monthKey,
        monthLabel,
        year,
        month,
        isCurrentMonth: monthKey === currentMonthKey,
        groupsMap: new Map(),
      };
      monthsMap.set(monthKey, monthBucket);
    }

    // Group Bucket (Staff or Role)
    let groupBucket = monthBucket.groupsMap.get(groupKey);
    if (!groupBucket) {
      const isCurrentUser = Boolean(
        currentUserId && (staffId === currentUserId || (matchedUser && matchedUser.id === currentUserId))
      );
      groupBucket = {
        key: groupKey,
        id: staffId,
        name: groupDisplayName,
        role: groupRole,
        roleLabel: groupRoleLabel,
        isCurrentUser,
        daysMap: new Map(),
      };
      monthBucket.groupsMap.set(groupKey, groupBucket);
    }

    // Day Bucket
    let dayBucket = groupBucket.daysMap.get(dateKey);
    if (!dayBucket) {
      dayBucket = {
        dateKey,
        dateLabel,
        dayOfMonth: day,
        items: [],
      };
      groupBucket.daysMap.set(dateKey, dayBucket);
    }

    dayBucket.items.push(exp);
  }

  // Build sorted hierarchy with exact sums
  const sortedMonthBuckets = Array.from(monthsMap.values()).sort((a, b) => {
    return b.monthKey.localeCompare(a.monthKey); // newest month first
  });

  const finalMonths: GroupedMonth<T>[] = sortedMonthBuckets.map((m) => {
    let monthTotalMinor = 0;
    let monthExpenseCount = 0;
    const monthStaffSet = new Set<string>();

    const rawGroups = Array.from(m.groupsMap.values());

    // First pass on groups: calculate day sums and staff totals
    const processedGroups: (GroupedStaffOrRole<T> & { earliestDayOfMonth: number; distinctDatesCount: number })[] = rawGroups.map((g) => {
      let groupTotalMinor = 0;
      let groupCount = 0;
      let earliestDayOfMonth = 32;

      // Sort days newest first
      const sortedDays: GroupedDay<T>[] = Array.from(g.daysMap.values())
        .sort((a, b) => b.dateKey.localeCompare(a.dateKey))
        .map((d) => {
          let dayTotalMinor = 0;
          for (const item of d.items) {
            dayTotalMinor += Math.round(Number(item.amountMinor) || 0);
          }
          if (d.dayOfMonth < earliestDayOfMonth) {
            earliestDayOfMonth = d.dayOfMonth;
          }
          groupTotalMinor += dayTotalMinor;
          groupCount += d.items.length;

          return {
            dateKey: d.dateKey,
            dateLabel: d.dateLabel,
            dayOfMonth: d.dayOfMonth,
            totalMinor: dayTotalMinor,
            count: d.items.length,
            items: d.items,
          };
        });

      monthTotalMinor += groupTotalMinor;
      monthExpenseCount += groupCount;
      monthStaffSet.add(g.key);

      return {
        key: g.key,
        id: g.id,
        name: g.name,
        role: g.role,
        roleLabel: g.roleLabel,
        isCurrentUser: g.isCurrentUser,
        totalMinor: groupTotalMinor,
        percentageOfMonth: 0, // computed below after monthTotalMinor is finalized
        count: groupCount,
        days: sortedDays,
        earliestDayOfMonth: earliestDayOfMonth === 32 ? 1 : earliestDayOfMonth,
        distinctDatesCount: sortedDays.length,
      };
    });

    // Second pass on groups: compute percentage of month and sort
    // Requirement 8: "Within a month, sort staff by total dates, from 1st to 31st."
    const finalGroups = processedGroups.map((g) => ({
      ...g,
      percentageOfMonth: monthTotalMinor > 0
        ? Math.round((g.totalMinor / monthTotalMinor) * 1000) / 10
        : 0,
    })).sort((a, b) => {
      // 1st to 31st by earliest day of month
      if (a.earliestDayOfMonth !== b.earliestDayOfMonth) {
        return a.earliestDayOfMonth - b.earliestDayOfMonth;
      }
      // If same earliest day, sort by distinct dates count descending then name
      if (b.distinctDatesCount !== a.distinctDatesCount) {
        return b.distinctDatesCount - a.distinctDatesCount;
      }
      return a.name.localeCompare(b.name);
    });

    return {
      monthKey: m.monthKey,
      monthLabel: m.monthLabel,
      year: m.year,
      month: m.month,
      isCurrentMonth: m.isCurrentMonth,
      totalMinor: monthTotalMinor,
      count: monthExpenseCount,
      staffCount: monthStaffSet.size,
      groups: finalGroups,
    };
  });

  return {
    months: finalMonths,
    overallTotalMinor,
    overallCount: expenses.length,
    overallStaffCount: overallDistinctStaff.size,
  };
}
