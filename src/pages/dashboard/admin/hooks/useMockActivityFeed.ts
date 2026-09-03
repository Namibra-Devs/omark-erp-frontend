// src/pages/dashboard/admin/hooks/useMockActivityFeed.ts
//
// Cross-system visibility for the Admin Dashboard: everything happening in
// the prototype features built without a backend yet (Accounts & Finance —
// expenses, payroll/bonuses — plus complaints and branch approval
// decisions) is local to whichever mock store owns it. Admin oversees
// everything, so this merges all of them into one feed + a set of summary
// stats, live-updating whenever any of those stores change (even from a
// different tab/page), not just on next page load.
import { useEffect, useState } from 'react';
import { getAllExpenses } from '@/mock/expenses';
import { loadStoredPayroll } from '@/api/payroll';
import { getAllComplaints } from '@/mock/complaints';
import { getAllApprovalOverrides } from '@/mock/approvalStore';
import { mockBranches, getBranchDocuments, getBranchExpenseEntries } from '@/mock/branches';
import type { ActivityLog } from '../types';

const MOCK_EVENTS = [
  'omark-expenses-changed',
  'omark-payroll-changed',
  'omark-complaints-changed',
  'omark-approval-overrides-changed',
];

const asTimestamp = (iso: string | undefined) => {
  if (!iso) return '1970-01-01 00:00:00';
  return iso.length === 10 ? `${iso} 00:00:00` : iso.replace('T', ' ').slice(0, 19);
};

// "Every branch is a unit on its own" — when a branchId is passed, this
// feed only shows that branch's own expenses/payroll/approvals, never
// another branch's. Complaints have no branch attribution anywhere in the
// data model (Customer carries no branchId), so they're left out of a
// branch-scoped view entirely rather than guessed at or shown unscoped.
const buildMockActivityLogs = (branchId?: string): ActivityLog[] => {
  const logs: ActivityLog[] = [];
  const branchesInScope = branchId ? mockBranches.filter((b) => b.id === branchId) : mockBranches;

  getAllExpenses()
    .filter((e) => !branchId || e.branchId === branchId)
    .forEach((e) => {
    logs.push({
      id: `mock-expense-${e.id}`,
      user: e.recordedBy,
      action: `${e.type === 'internal' ? 'Internal' : 'External'} expense recorded`,
      details: `${e.category} — GHS ${(e.amountMinor / 100).toLocaleString()} (${e.code}) · Preview, local only`,
      timestamp: asTimestamp(e.recordedAt),
      type: 'info',
    });
  });

  loadStoredPayroll()
    .filter((p) => !branchId || p.branchId === branchId)
    .forEach((p) => {
    const branch = mockBranches.find((b) => b.id === p.branchId);
    const bonusNote = (p.bonusMinor || 0) > 0 ? ` incl. GHS ${((p.bonusMinor || 0) / 100).toLocaleString()} bonus` : '';
    const netGHS = ((p.netSalaryMinor || (p as any).netPayMinor || 0) / 100).toLocaleString();
    logs.push({
      id: `mock-payroll-${p.id}-${p.status}`,
      user: 'Accounts',
      action: p.status === 'paid' ? 'Payroll paid' : p.status === 'approved' ? 'Payroll approved' : 'Payroll awaiting approval',
      details: `${p.staffName || 'Staff Member'} (${branch?.name ?? p.branchId ?? 'Head Office'}) — GHS ${netGHS} net${bonusNote} (${p.code || 'PAYR'}) · Preview, local only`,
      timestamp: asTimestamp(p.updatedAt || p.createdAt),
      type: p.status === 'paid' ? 'success' : p.status === 'approved' ? 'info' : 'warning',
    });
  });

  // Complaints have no branch attribution — only show them in the
  // unscoped (company-wide) feed, never in a single branch's view.
  if (!branchId) {
    getAllComplaints().forEach((c) => {
      logs.push({
        id: `mock-complaint-${c.id}`,
        user: c.customerName,
        action: c.status === 'resolved' ? 'Complaint resolved' : c.status === 'in_progress' ? 'Complaint in progress' : 'Complaint logged',
        details: `${c.subject} (${c.code}) · Preview, local only`,
        timestamp: asTimestamp(c.updatedAt),
        type: c.status === 'resolved' ? 'success' : c.status === 'open' ? 'warning' : 'info',
      });
    });
  }

  const overrides = getAllApprovalOverrides();
  Object.entries(overrides).forEach(([recordId, override]) => {
    for (const branch of branchesInScope) {
      const doc = getBranchDocuments(branch.id).find((d) => d.id === recordId);
      const exp = !doc ? getBranchExpenseEntries(branch.id).find((e) => e.id === recordId) : undefined;
      const label = doc?.title ?? exp?.category;
      if (!label) continue;
      logs.push({
        id: `mock-approval-${recordId}`,
        user: override.decidedBy === 'head_office' ? 'Head Office' : `${branch.managerName} (Branch Manager)`,
        action: override.decision === 'approved' ? 'Approval granted' : 'Approval rejected',
        details: `${label} — ${branch.name} · Preview, local only`,
        timestamp: asTimestamp(override.decidedAt),
        type: override.decision === 'approved' ? 'success' : 'error',
      });
      break;
    }
  });

  return logs;
};

export interface MockActivityStats {
  totalExpensesMinor: number;
  internalExpensesMinor: number;
  externalExpensesMinor: number;
  totalBonusesMinor: number;
  pendingPayrollCount: number;
  openComplaintsCount: number;
  pendingApprovalsCount: number;
}

const buildMockStats = (branchId?: string): MockActivityStats => {
  const expenses = getAllExpenses().filter((e) => !branchId || e.branchId === branchId);
  const payroll = loadStoredPayroll().filter((p) => !branchId || p.branchId === branchId);
  // No branch attribution on complaints — only counted in the unscoped view.
  const complaints = branchId ? [] : getAllComplaints();
  const branchesInScope = branchId ? mockBranches.filter((b) => b.id === branchId) : mockBranches;

  // Only documents carry a real pending-approval concept in the mock data
  // (status: 'pending'); branch expense entries have no status field.
  const overrides = getAllApprovalOverrides();
  let pendingApprovalsCount = 0;
  branchesInScope.forEach((branch) => {
    getBranchDocuments(branch.id).forEach((doc) => {
      if (doc.status === 'pending' && !overrides[doc.id]) pendingApprovalsCount += 1;
    });
  });

  return {
    totalExpensesMinor: expenses.reduce((sum, e) => sum + e.amountMinor, 0),
    internalExpensesMinor: expenses.filter((e) => e.type === 'internal').reduce((sum, e) => sum + e.amountMinor, 0),
    externalExpensesMinor: expenses.filter((e) => e.type === 'external').reduce((sum, e) => sum + e.amountMinor, 0),
    totalBonusesMinor: payroll.reduce((sum, p) => sum + (p.bonusMinor || 0), 0),
    pendingPayrollCount: payroll.filter((p) => p.status === 'pending').length,
    openComplaintsCount: complaints.filter((c) => c.status !== 'resolved').length,
    pendingApprovalsCount,
  };
};

/**
 * Re-reads whenever any prototype mock store changes, even from another
 * tab/page. Pass `branchId` to scope everything to a single branch — "every
 * branch is a unit on its own" — omit it for the company-wide (Head
 * Office / unassigned-admin) view.
 */
export const useMockActivityFeed = (branchId?: string) => {
  const [logs, setLogs] = useState<ActivityLog[]>(() => buildMockActivityLogs(branchId));
  const [stats, setStats] = useState<MockActivityStats>(() => buildMockStats(branchId));

  useEffect(() => {
    const refresh = () => {
      setLogs(buildMockActivityLogs(branchId));
      setStats(buildMockStats(branchId));
    };
    refresh();
    MOCK_EVENTS.forEach((evt) => window.addEventListener(evt, refresh));
    window.addEventListener('storage', refresh);
    return () => {
      MOCK_EVENTS.forEach((evt) => window.removeEventListener(evt, refresh));
      window.removeEventListener('storage', refresh);
    };
  }, [branchId]);

  return { logs, stats };
};
