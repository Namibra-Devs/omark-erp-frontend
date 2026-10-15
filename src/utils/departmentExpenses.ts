// src/utils/departmentExpenses.ts
export interface DepartmentSummary {
  name: string;
  count: number;
  totalMinor: number;
  approvedMinor: number;
  pendingMinor: number;
  rejectedMinor: number;
  items: any[];
}

export interface DynamicGrandTotals {
  grandTotalMinor: number;
  grandApprovedMinor: number;
  grandPendingMinor: number;
  grandRejectedMinor: number;
  grandCount: number;
  grandTotalGHS: number;
  grandApprovedGHS: number;
  grandPendingGHS: number;
  grandRejectedGHS: number;
}

export const ROLE_DEFAULT_DEPARTMENTS: Record<string, string> = {
  admin: 'Executive Administration',
  branch_manager: 'Operations',
  marketing_director: 'Marketing & Sales',
  marketing_staff: 'Marketing & Sales',
  customer_service: 'Customer Service',
  secretary: 'Administration',
  accounts: 'Finance & Accounts',
  finance: 'Finance & Accounts',
};

export const STANDARD_CORPORATE_DEPARTMENTS = [
  { id: 'dept-mkt', name: 'Marketing & Sales', description: 'Lead generation, client conversion, and property sales' },
  { id: 'dept-cs', name: 'Customer Service', description: 'Front-desk check-in, customer inquiries, and support' },
  { id: 'dept-fin', name: 'Finance & Accounts', description: 'Payments, bank reconciliation, expense audits, and payroll' },
  { id: 'dept-ops', name: 'Operations', description: 'Operations, site mapping, legal documentation, and deed registry' },
  { id: 'dept-exec', name: 'Executive Administration', description: 'Branch management and strategic leadership' },
  { id: 'dept-admin', name: 'Administration', description: 'General administration and secretarial support' },
];

/**
 * Normalizes any department or user role into one of the official 6 corporate departments.
 */
export function normalizeDepartmentName(dept?: string, role?: string): string {
  if (dept) {
    const d = dept.trim().toLowerCase();
    if (d.includes('market') || d.includes('sales')) return 'Marketing & Sales';
    if (d.includes('customer') || d.includes('client service')) return 'Customer Service';
    if (d.includes('finance') || d.includes('account')) return 'Finance & Accounts';
    if (d.includes('operat') || d.includes('branch')) return 'Operations';
    if (d.includes('exec') || d.includes('director') || d.includes('management')) return 'Executive Administration';
    if (d.includes('secretar') || d.includes('admin')) return 'Administration';
    return dept.trim();
  }
  if (role) {
    return ROLE_DEFAULT_DEPARTMENTS[role] || 'Administration';
  }
  return 'Administration';
}

/**
 * Calculates sub-totals for each department across a filtered set of expenses.
 */
export function calculateDepartmentSummaries(expenses: any[]): DepartmentSummary[] {
  const map = new Map<string, DepartmentSummary>();

  // Initialize with standard departments in consistent order
  STANDARD_CORPORATE_DEPARTMENTS.forEach((dept) => {
    map.set(dept.name, {
      name: dept.name,
      count: 0,
      totalMinor: 0,
      approvedMinor: 0,
      pendingMinor: 0,
      rejectedMinor: 0,
      items: [],
    });
  });

  expenses.forEach((exp) => {
    const deptName = normalizeDepartmentName(exp.department, exp.recordedByUserRole);
    let entry = map.get(deptName);
    if (!entry) {
      entry = {
        name: deptName,
        count: 0,
        totalMinor: 0,
        approvedMinor: 0,
        pendingMinor: 0,
        rejectedMinor: 0,
        items: [],
      };
      map.set(deptName, entry);
    }
    const amt = exp.amountMinor || 0;
    entry.count += 1;
    entry.totalMinor += amt;
    entry.items.push(exp);

    if (exp.status === 'approved') entry.approvedMinor += amt;
    else if (exp.status === 'pending') entry.pendingMinor += amt;
    else if (exp.status === 'rejected') entry.rejectedMinor += amt;
  });

  return Array.from(map.values());
}

/**
 * Calculates overall grand totals across all departments in the current active filter set.
 */
export function calculateGrandTotals(expenses: any[]): DynamicGrandTotals {
  let grandTotalMinor = 0;
  let grandApprovedMinor = 0;
  let grandPendingMinor = 0;
  let grandRejectedMinor = 0;
  let grandCount = 0;

  expenses.forEach((exp) => {
    const amt = exp.amountMinor || 0;
    grandTotalMinor += amt;
    grandCount += 1;
    if (exp.status === 'approved') grandApprovedMinor += amt;
    else if (exp.status === 'pending') grandPendingMinor += amt;
    else if (exp.status === 'rejected') grandRejectedMinor += amt;
  });

  return {
    grandTotalMinor,
    grandApprovedMinor,
    grandPendingMinor,
    grandRejectedMinor,
    grandCount,
    grandTotalGHS: grandTotalMinor / 100,
    grandApprovedGHS: grandApprovedMinor / 100,
    grandPendingGHS: grandPendingMinor / 100,
    grandRejectedGHS: grandRejectedMinor / 100,
  };
}

// ── 4 Main Department Hub (Secretary, BM, Marketing, Admin) ─────────────────
export type FourMainDepartmentKey = 'secretary' | 'bm' | 'marketing' | 'admin';

export interface FourDepartmentConfig {
  key: FourMainDepartmentKey;
  name: string;
  label: string;
  color: string;
  accentColor: string;
  borderColor: string;
  badgeBg: string;
  gradientBg: string;
  description: string;
}

export const FOUR_MAIN_DEPARTMENTS: FourDepartmentConfig[] = [
  {
    key: 'secretary',
    name: 'Secretary',
    label: 'Secretary',
    color: '#13c2c2',
    accentColor: '#006d75',
    borderColor: '#87e8de',
    badgeBg: '#e6fffb',
    gradientBg: 'linear-gradient(135deg, #e6fffb 0%, #ffffff 100%)',
    description: 'Front desk, office stationery, client refreshments & courier dispatch',
  },
  {
    key: 'bm',
    name: 'BM',
    label: 'BM (Branch Manager)',
    color: '#1890ff',
    accentColor: '#096dd9',
    borderColor: '#91d5ff',
    badgeBg: '#e6f7ff',
    gradientBg: 'linear-gradient(135deg, #e6f7ff 0%, #ffffff 100%)',
    description: 'Generator diesel, vehicle transit, premises repairs & branch utilities',
  },
  {
    key: 'marketing',
    name: 'Marketing',
    label: 'Marketing',
    color: '#fa8c16',
    accentColor: '#d46b08',
    borderColor: '#ffd591',
    badgeBg: '#fff7e6',
    gradientBg: 'linear-gradient(135deg, #fff7e6 0%, #ffffff 100%)',
    description: 'Mega-billboards, property expos, digital ads & campaign outreach',
  },
  {
    key: 'admin',
    name: 'Admin',
    label: 'Admin',
    color: '#722ed1',
    accentColor: '#531dab',
    borderColor: '#d3adf7',
    badgeBg: '#f9f0ff',
    gradientBg: 'linear-gradient(135deg, #f9f0ff 0%, #ffffff 100%)',
    description: 'Executive IT hosting, audit compliance, legal fees & corporate filing',
  },
];

export interface FourDepartmentSummary {
  key: FourMainDepartmentKey;
  name: string;
  label: string;
  count: number;
  totalMinor: number;
  approvedMinor: number;
  pendingMinor: number;
  rejectedMinor: number;
  items: any[];
}

/**
 * Resolves any expense into one of the 4 primary departments: Secretary, BM, Marketing, Admin
 */
export function resolveFourMainDepartment(expense: {
  department?: string;
  recordedByUserRole?: string;
  category?: string;
}): FourMainDepartmentKey {
  const d = (expense.department || '').trim().toLowerCase();
  const role = (expense.recordedByUserRole || '').trim().toLowerCase();
  const cat = (expense.category || '').trim().toLowerCase();

  // 1. Admin / Executive / Accounts / Finance
  if (
    role === 'admin' ||
    role === 'accounts' ||
    role === 'finance' ||
    d.includes('executive') ||
    d.includes('finance') ||
    cat.includes('hosting') ||
    cat.includes('audit') ||
    cat.includes('legal') ||
    cat.includes('compliance') ||
    cat.includes('retainer') ||
    cat.includes('statutory') ||
    cat.includes('lands commission')
  ) {
    return 'admin';
  }

  // 2. Secretary (Desk, Hospitality, Supplies, Courier, Admin/Office Support)
  if (
    role === 'secretary' ||
    d.includes('secretar') ||
    d === 'administration' ||
    d === 'customer service' ||
    cat.includes('hospitality') ||
    cat.includes('refreshment') ||
    cat.includes('courier') ||
    cat.includes('stationery') ||
    cat.includes('supplies') ||
    cat.includes('front desk') ||
    cat.includes('sanitation') ||
    cat.includes('cleaning')
  ) {
    return 'secretary';
  }

  // 3. Marketing (Marketing Director, Marketing Staff, Ads, Campaigns, Expos)
  if (
    role === 'marketing_director' ||
    role === 'marketing_staff' ||
    d.includes('market') ||
    d.includes('sales') ||
    cat.includes('billboard') ||
    cat.includes('expo') ||
    cat.includes('digital media') ||
    cat.includes('ad') ||
    cat.includes('campaign') ||
    cat.includes('flyer') ||
    cat.includes('branding') ||
    cat.includes('sponsorship')
  ) {
    return 'marketing';
  }

  // 4. BM (Branch Manager, Operations, Fuel, Site Works, Maintenance, Transit)
  if (
    role === 'branch_manager' ||
    d.includes('operat') ||
    d.includes('branch') ||
    cat.includes('fuel') ||
    cat.includes('power') ||
    cat.includes('diesel') ||
    cat.includes('generator') ||
    cat.includes('transit') ||
    cat.includes('repairs') ||
    cat.includes('servicing') ||
    cat.includes('maintenance') ||
    cat.includes('utilities')
  ) {
    return 'bm';
  }

  return 'admin';
}

/**
 * Calculates sub-totals for the 4 primary departments (Secretary, BM, Marketing, Admin)
 * based on the active filtered expenses.
 */
export function calculateFourDepartmentSummaries(expenses: any[]): FourDepartmentSummary[] {
  const map: Record<FourMainDepartmentKey, FourDepartmentSummary> = {
    secretary: { key: 'secretary', name: 'Secretary', label: 'Secretary', count: 0, totalMinor: 0, approvedMinor: 0, pendingMinor: 0, rejectedMinor: 0, items: [] },
    bm: { key: 'bm', name: 'BM', label: 'BM (Branch Manager)', count: 0, totalMinor: 0, approvedMinor: 0, pendingMinor: 0, rejectedMinor: 0, items: [] },
    marketing: { key: 'marketing', name: 'Marketing', label: 'Marketing', count: 0, totalMinor: 0, approvedMinor: 0, pendingMinor: 0, rejectedMinor: 0, items: [] },
    admin: { key: 'admin', name: 'Admin', label: 'Admin', count: 0, totalMinor: 0, approvedMinor: 0, pendingMinor: 0, rejectedMinor: 0, items: [] },
  };

  expenses.forEach((exp) => {
    const key = resolveFourMainDepartment(exp);
    const entry = map[key];
    const amt = exp.amountMinor || 0;
    entry.count += 1;
    entry.totalMinor += amt;
    entry.items.push(exp);

    if (exp.status === 'approved') entry.approvedMinor += amt;
    else if (exp.status === 'pending') entry.pendingMinor += amt;
    else if (exp.status === 'rejected') entry.rejectedMinor += amt;
  });

  return [map.secretary, map.bm, map.marketing, map.admin];
}

