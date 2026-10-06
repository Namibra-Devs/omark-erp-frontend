// src/utils/expenseRoleIsolation.ts
import type { ExpenseEntity } from '@/api/expenses';
import type { Role, User } from '@/types';
import { getBranchCanonicalKey } from '@/utils/branchIsolation';

export type ExpenseRoleView = 'all' | 'admin' | 'branch_manager' | 'secretary' | 'marketing_director' | 'accounts';

export interface RoleDashboardConfig {
  role: ExpenseRoleView;
  title: string;
  subtitle: string;
  badgeLabel: string;
  badgeColor: string;
  badgeBg: string;
  privacyNotice: string;
  defaultCategories: string[];
  allowedTypes: ('internal' | 'external')[];
  canAuthorize: boolean;
}

// ── Categories by Role ────────────────────────────────────────────────────────
export const SECRETARY_CATEGORIES = [
  'Office Supplies',
  'Client Hospitality',
  'Courier & Dispatch',
  'Stationery & Printing',
  'Cleaning & Sanitation',
  'Office Maintenance',
  'Front Desk Operations',
  'Staff Refreshments',
];

export const MARKETING_DIRECTOR_CATEGORIES = [
  'Mega Billboard & Out-Of-Home',
  'Property Expo & Roadshow',
  'Digital Media Ads',
  'Advertising & Promotion',
  'Brochures & Print Media',
  'Marketing Campaigns',
  'Event Sponsorship',
  'Signage & Branding',
  'Field Marketing Allowances',
  'Prospect Transit & Site Tours',
];

export const BRANCH_MANAGER_CATEGORIES = [
  'Power & Fuel',
  'Logistics & Transit',
  'Premises Repairs',
  'Utilities & Water',
  'Branch Office Equipment',
  'Security & Compound Maintenance',
  'Inspection Vehicle Servicing',
  'Branch Emergency Contingency',
];

export const ACCOUNTS_ADMIN_CATEGORIES = [
  ...SECRETARY_CATEGORIES,
  ...MARKETING_DIRECTOR_CATEGORIES,
  ...BRANCH_MANAGER_CATEGORIES,
  'Legal & Regulatory',
  'Audit & Compliance',
  'Executive IT & Cloud Hosting',
  'Statutory Retainers & Levies',
  'Lands Commission Searches',
  'Corporate Overhead',
];

/**
 * Returns configuration metadata for a given role dashboard.
 */
export function getRoleDashboardConfig(
  role: ExpenseRoleView,
  user: User | null,
  branchName?: string
): RoleDashboardConfig {
  switch (role) {
    case 'secretary':
      return {
        role: 'secretary',
        title: 'Secretary & Administration Expense Hub',
        subtitle: 'Petty cash ledger, office supplies requisition, courier dispatch, and front-desk hospitality.',
        badgeLabel: 'Secretary / Administration View',
        badgeColor: '#13c2c2',
        badgeBg: '#e6fffb',
        privacyNotice: '🔒 Private Role View: Showing secretarial & front-office administrative expenditures. Other departmental finances are strictly confidential.',
        defaultCategories: SECRETARY_CATEGORIES,
        allowedTypes: ['internal'],
        canAuthorize: false,
      };

    case 'marketing_director':
      return {
        role: 'marketing_director',
        title: 'Marketing Director Expenditure Command',
        subtitle: 'Campaign budget tracking, digital media advertising, highway mega-billboards, and property expo expenditures.',
        badgeLabel: 'Marketing Director View',
        badgeColor: '#fa8c16',
        badgeBg: '#fff7e6',
        privacyNotice: '🔒 Private Role View: Showing promotional, advertising, and marketing campaign budgets. Internal branch overhead and administration ledgers are kept private.',
        defaultCategories: MARKETING_DIRECTOR_CATEGORIES,
        allowedTypes: ['external', 'internal'],
        canAuthorize: false,
      };

    case 'branch_manager': {
      const bName = branchName || user?.branch || 'Branch Showroom';
      return {
        role: 'branch_manager',
        title: `${bName} Operations Expense Dashboard`,
        subtitle: `Dedicated branch operational expenditures: generator diesel, client inspection transit, AC servicing, and compound maintenance.`,
        badgeLabel: `Manager View • ${bName}`,
        badgeColor: '#1890ff',
        badgeBg: '#e6f7ff',
        privacyNotice: `🔒 Private Branch View: Isolated strictly to ${bName} operations. Expenditures from other branches and executive management remain confidential.`,
        defaultCategories: BRANCH_MANAGER_CATEGORIES,
        allowedTypes: ['internal', 'external'],
        canAuthorize: false,
      };
    }

    case 'accounts':
    case 'admin':
    case 'all':
    default:
      return {
        role: 'admin',
        title: 'Executive Corporate Expense Intelligence',
        subtitle: 'Comprehensive financial oversight, cross-branch audit trail, multi-role reconciliation, and expenditure authorization.',
        badgeLabel: 'Executive Oversight • All Branches & Roles',
        badgeColor: '#722ed1',
        badgeBg: '#f9f0ff',
        privacyNotice: '🌐 Global Corporate Oversight: Full visibility across all staff roles, branches, and departments with executive approval authority.',
        defaultCategories: ACCOUNTS_ADMIN_CATEGORIES,
        allowedTypes: ['internal', 'external'],
        canAuthorize: true,
      };
  }
}

/**
 * Filter an array of expenses strictly according to the role's privacy rules.
 * Admin/Accounts gets full visibility (or can adopt a lens).
 * Manager, Secretary, and Marketing Director get strictly isolated views.
 */
export function filterExpensesByRole(
  expenses: ExpenseEntity[],
  user: User | null,
  roleLens?: ExpenseRoleView
): ExpenseEntity[] {
  if (!expenses || expenses.length === 0) return [];
  if (!user) return [];

  const userRole = (user.role || '').toLowerCase() as Role;
  const isAdminOrAccounts = userRole === 'admin' || userRole === 'accounts';

  // Effective view mode: Admin/Accounts can choose a lens; individual roles are locked to their own role.
  const activeView: ExpenseRoleView = isAdminOrAccounts
    ? (roleLens || 'all')
    : (userRole as ExpenseRoleView);

  return expenses.filter((expense) => {
    return isExpenseVisibleInRoleView(expense, activeView, user, isAdminOrAccounts);
  });
}

/**
 * Determines whether a single expense is visible within a specific role's view.
 */
export function isExpenseVisibleInRoleView(
  expense: ExpenseEntity,
  view: ExpenseRoleView,
  user: User | null,
  isAdminOrAccounts: boolean
): boolean {
  // If global view is requested and user is an Admin/Accounts, all records are visible
  if (view === 'all' && isAdminOrAccounts) {
    return true;
  }

  const expRole = (expense.recordedByUserRole || '').toLowerCase();
  const expUserId = expense.recordedByUserId;
  const expCategory = (expense.category || '').trim();

  switch (view) {
    case 'secretary': {
      // Secretary view includes:
      // 1. Explicitly recorded by secretary role
      if (expRole === 'secretary') return true;
      // 2. Recorded by current secretary user
      if (user && expUserId === user.id) return true;
      // 3. Any office admin / hospitality / supplies category
      const secCats = SECRETARY_CATEGORIES.map((c) => c.toLowerCase());
      if (secCats.some((sc) => expCategory.toLowerCase().includes(sc) || sc.includes(expCategory.toLowerCase()))) {
        return true;
      }
      return false;
    }

    case 'marketing_director': {
      // Marketing Director view includes:
      // 1. Recorded by marketing director or marketing staff
      if (expRole === 'marketing_director' || expRole === 'marketing_staff') return true;
      // 2. Recorded by current marketing user
      if (user && expUserId === user.id) return true;
      // 3. Any marketing/advertising/expo category
      const mktCats = MARKETING_DIRECTOR_CATEGORIES.map((c) => c.toLowerCase());
      if (mktCats.some((mc) => expCategory.toLowerCase().includes(mc) || mc.includes(expCategory.toLowerCase()))) {
        return true;
      }
      return false;
    }

    case 'branch_manager': {
      // Branch Manager view is isolated strictly to the manager's branch:
      const userBranchId = user?.branchId || (user as any)?.branch;
      const userBranchCanon = getBranchCanonicalKey(userBranchId);

      const expBranchId = expense.branchId;
      const expBranchCanon = getBranchCanonicalKey(expense.branchName || expense.branchId);

      // If viewing through admin lens without specific branch constraint, show all branch manager items
      if (isAdminOrAccounts && !userBranchCanon) {
        if (expRole === 'branch_manager') return true;
        const bmCats = BRANCH_MANAGER_CATEGORIES.map((c) => c.toLowerCase());
        return bmCats.some((bc) => expCategory.toLowerCase().includes(bc) || bc.includes(expCategory.toLowerCase()));
      }

      // Must match the branch
      const matchesBranch = Boolean(
        (userBranchId && expBranchId && userBranchId === expBranchId) ||
        (userBranchCanon && expBranchCanon && userBranchCanon === expBranchCanon)
      );

      // Also allow if explicitly recorded by this manager
      const isMySubmission = Boolean(user && expUserId === user.id);

      if (matchesBranch || isMySubmission) {
        // Exclude executive IT or legal retainers from other departments
        const isSecretarial = expRole === 'secretary';
        const isMarketing = expRole === 'marketing_director';
        // Branch manager sees branch operations and submissions for their branch
        return !isSecretarial && !isMarketing;
      }

      return false;
    }

    case 'accounts':
    case 'admin':
    default:
      return true;
  }
}

/**
 * Calculates tailored metrics for a role's expense dashboard.
 */
export function calculateRoleMetrics(expenses: ExpenseEntity[], role: ExpenseRoleView) {
  const totalMinor = expenses.reduce((sum, e) => sum + (e.amountMinor || 0), 0);
  const approvedMinor = expenses.filter((e) => e.status === 'approved').reduce((sum, e) => sum + (e.amountMinor || 0), 0);
  const pendingMinor = expenses.filter((e) => e.status === 'pending').reduce((sum, e) => sum + (e.amountMinor || 0), 0);
  const rejectedMinor = expenses.filter((e) => e.status === 'rejected').reduce((sum, e) => sum + (e.amountMinor || 0), 0);

  const pendingCount = expenses.filter((e) => e.status === 'pending').length;
  const approvedCount = expenses.filter((e) => e.status === 'approved').length;
  const totalCount = expenses.length;

  // Domain-specific breakdown
  let stat1 = { label: 'Approved & Disbursed', valueGHS: approvedMinor / 100, count: approvedCount, color: '#52c41a' };
  let stat2 = { label: 'Pending Authorization', valueGHS: pendingMinor / 100, count: pendingCount, color: '#fa8c16' };
  let stat3 = { label: 'Internal Operations', valueGHS: 0, count: 0, color: '#1890ff' };
  let stat4 = { label: 'External Vendor Payouts', valueGHS: 0, count: 0, color: '#722ed1' };

  if (role === 'secretary') {
    const hospitalityMinor = expenses
      .filter((e) => (e.category || '').toLowerCase().includes('hospitality') || (e.category || '').toLowerCase().includes('refreshment'))
      .reduce((sum, e) => sum + (e.amountMinor || 0), 0);
    const suppliesMinor = expenses
      .filter((e) => (e.category || '').toLowerCase().includes('supplies') || (e.category || '').toLowerCase().includes('stationery'))
      .reduce((sum, e) => sum + (e.amountMinor || 0), 0);
    const courierMinor = expenses
      .filter((e) => (e.category || '').toLowerCase().includes('courier') || (e.category || '').toLowerCase().includes('dispatch'))
      .reduce((sum, e) => sum + (e.amountMinor || 0), 0);

    stat1 = { label: 'Office Supplies & Stationery', valueGHS: suppliesMinor / 100, count: 0, color: '#13c2c2' };
    stat2 = { label: 'Client Hospitality Lounge', valueGHS: hospitalityMinor / 100, count: 0, color: '#eb2f96' };
    stat3 = { label: 'Courier & Deed Dispatch', valueGHS: courierMinor / 100, count: 0, color: '#fa8c16' };
    stat4 = { label: 'Pending Authorizations', valueGHS: pendingMinor / 100, count: pendingCount, color: '#faad14' };
  } else if (role === 'marketing_director') {
    const billboardMinor = expenses
      .filter((e) => (e.category || '').toLowerCase().includes('billboard') || (e.category || '').toLowerCase().includes('signage'))
      .reduce((sum, e) => sum + (e.amountMinor || 0), 0);
    const digitalMinor = expenses
      .filter((e) => (e.category || '').toLowerCase().includes('digital') || (e.category || '').toLowerCase().includes('media'))
      .reduce((sum, e) => sum + (e.amountMinor || 0), 0);
    const expoMinor = expenses
      .filter((e) => (e.category || '').toLowerCase().includes('expo') || (e.category || '').toLowerCase().includes('event') || (e.category || '').toLowerCase().includes('roadshow'))
      .reduce((sum, e) => sum + (e.amountMinor || 0), 0);

    stat1 = { label: 'Billboards & Outdoor Media', valueGHS: billboardMinor / 100, count: 0, color: '#fa8c16' };
    stat2 = { label: 'Digital Ads & Online Reach', valueGHS: digitalMinor / 100, count: 0, color: '#1890ff' };
    stat3 = { label: 'Expos, Events & Roadshows', valueGHS: expoMinor / 100, count: 0, color: '#722ed1' };
    stat4 = { label: 'Pending Campaign Authorizations', valueGHS: pendingMinor / 100, count: pendingCount, color: '#faad14' };
  } else if (role === 'branch_manager') {
    const powerMinor = expenses
      .filter((e) => (e.category || '').toLowerCase().includes('power') || (e.category || '').toLowerCase().includes('fuel') || (e.category || '').toLowerCase().includes('diesel'))
      .reduce((sum, e) => sum + (e.amountMinor || 0), 0);
    const logisticsMinor = expenses
      .filter((e) => (e.category || '').toLowerCase().includes('transit') || (e.category || '').toLowerCase().includes('inspection') || (e.category || '').toLowerCase().includes('logistics'))
      .reduce((sum, e) => sum + (e.amountMinor || 0), 0);
    const repairsMinor = expenses
      .filter((e) => (e.category || '').toLowerCase().includes('repair') || (e.category || '').toLowerCase().includes('maintenance'))
      .reduce((sum, e) => sum + (e.amountMinor || 0), 0);

    stat1 = { label: 'Generator Diesel & Power', valueGHS: powerMinor / 100, count: 0, color: '#ff4d4f' };
    stat2 = { label: 'Client Transit & Inspection Vehicles', valueGHS: logisticsMinor / 100, count: 0, color: '#1890ff' };
    stat3 = { label: 'Premises & AC Repairs', valueGHS: repairsMinor / 100, count: 0, color: '#52c41a' };
    stat4 = { label: 'Pending Branch Authorizations', valueGHS: pendingMinor / 100, count: pendingCount, color: '#faad14' };
  } else {
    // Admin / Executive overview
    const internalMinor = expenses.filter((e) => e.type === 'internal').reduce((sum, e) => sum + (e.amountMinor || 0), 0);
    const externalMinor = expenses.filter((e) => e.type === 'external').reduce((sum, e) => sum + (e.amountMinor || 0), 0);

    stat1 = { label: 'Approved Corporate Ledger', valueGHS: approvedMinor / 100, count: approvedCount, color: '#52c41a' };
    stat2 = { label: 'Pending Executive Review', valueGHS: pendingMinor / 100, count: pendingCount, color: '#fa8c16' };
    stat3 = { label: 'Internal Operations Overhead', valueGHS: internalMinor / 100, count: 0, color: '#1890ff' };
    stat4 = { label: 'External Vendor & Media Payouts', valueGHS: externalMinor / 100, count: 0, color: '#722ed1' };
  }

  return {
    totalGHS: totalMinor / 100,
    approvedGHS: approvedMinor / 100,
    pendingGHS: pendingMinor / 100,
    rejectedGHS: rejectedMinor / 100,
    totalCount,
    pendingCount,
    approvedCount,
    stat1,
    stat2,
    stat3,
    stat4,
  };
}
