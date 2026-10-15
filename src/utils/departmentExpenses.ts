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
