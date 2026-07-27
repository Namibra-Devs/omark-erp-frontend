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
import { getAllBranchPayroll } from '@/mock/payroll';
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

const buildMockActivityLogs = (): ActivityLog[] => {
  const logs: ActivityLog[] = [];

  getAllExpenses().forEach((e) => {
    logs.push({
      id: `mock-expense-${e.id}`,
      user: e.recordedBy,
      action: `${e.type === 'internal' ? 'Internal' : 'External'} expense recorded`,
      details: `${e.category} — GHS ${(e.amountMinor / 100).toLocaleString()} (${e.code}) · Preview, local only`,
      timestamp: asTimestamp(e.recordedAt),
      type: 'info',
    });
  });

  getAllBranchPayroll().forEach((p) => {
    const branch = mockBranches.find((b) => b.id === p.branchId);
    const bonusNote = p.bonusMinor > 0 ? ` incl. GHS ${(p.bonusMinor / 100).toLocaleString()} bonus` : '';
    logs.push({
      id: `mock-payroll-${p.id}-${p.status}`,
      user: 'Accounts',
      action: p.status === 'paid' ? 'Payroll paid' : p.status === 'processed' ? 'Payroll processed' : 'Payroll entry added',
      details: `${p.staffName} (${branch?.name ?? p.branchId}) — GHS ${(p.netPayMinor / 100).toLocaleString()} net${bonusNote} (${p.code}) · Preview, local only`,
      timestamp: asTimestamp(p.updatedAt),
      type: p.status === 'paid' ? 'success' : 'info',
    });
  });

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

  const overrides = getAllApprovalOverrides();
  Object.entries(overrides).forEach(([recordId, override]) => {
    for (const branch of mockBranches) {
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

const buildMockStats = (): MockActivityStats => {
  const expenses = getAllExpenses();
  const payroll = getAllBranchPayroll();
  const complaints = getAllComplaints();

  // Only documents carry a real pending-approval concept in the mock data
  // (status: 'pending'); branch expense entries have no status field.
  const overrides = getAllApprovalOverrides();
  let pendingApprovalsCount = 0;
  mockBranches.forEach((branch) => {
    getBranchDocuments(branch.id).forEach((doc) => {
      if (doc.status === 'pending' && !overrides[doc.id]) pendingApprovalsCount += 1;
    });
  });

  return {
    totalExpensesMinor: expenses.reduce((sum, e) => sum + e.amountMinor, 0),
    internalExpensesMinor: expenses.filter((e) => e.type === 'internal').reduce((sum, e) => sum + e.amountMinor, 0),
    externalExpensesMinor: expenses.filter((e) => e.type === 'external').reduce((sum, e) => sum + e.amountMinor, 0),
    totalBonusesMinor: payroll.reduce((sum, p) => sum + p.bonusMinor, 0),
    pendingPayrollCount: payroll.filter((p) => p.status === 'pending').length,
    openComplaintsCount: complaints.filter((c) => c.status !== 'resolved').length,
    pendingApprovalsCount,
  };
};

/** Re-reads whenever any prototype mock store changes, even from another tab/page. */
export const useMockActivityFeed = () => {
  const [logs, setLogs] = useState<ActivityLog[]>(() => buildMockActivityLogs());
  const [stats, setStats] = useState<MockActivityStats>(() => buildMockStats());

  useEffect(() => {
    const refresh = () => {
      setLogs(buildMockActivityLogs());
      setStats(buildMockStats());
    };
    MOCK_EVENTS.forEach((evt) => window.addEventListener(evt, refresh));
    window.addEventListener('storage', refresh);
    return () => {
      MOCK_EVENTS.forEach((evt) => window.removeEventListener(evt, refresh));
      window.removeEventListener('storage', refresh);
    };
  }, []);

  return { logs, stats };
};
