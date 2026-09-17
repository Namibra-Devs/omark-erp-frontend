// src/pages/dashboard/admin/hooks/useMockActivityFeed.ts
//
// Live activity feed and operational summary stats for the Admin Dashboard.
import { useEffect, useState } from 'react';
import { getStoredActivities } from '@/utils/activityNotificationEngine';
import { getStoredApprovals } from '@/api/approvals';
import { getStoredExpenses } from '@/api/expenses';
import { getStoredStaffBonuses } from '@/api/bonuses';
import { getStoredComplaints } from '@/api/complaints';
import { getStoredPayrollRecords } from '@/api/payroll';
import { getStoredInteractions } from '@/utils/interactionStorage';
import type { ActivityLog } from '../types';

export interface MockActivityStats {
  totalExpensesMinor: number;
  internalExpensesMinor: number;
  externalExpensesMinor: number;
  totalBonusesMinor: number;
  pendingPayrollCount: number;
  openComplaintsCount: number;
  pendingApprovalsCount: number;
}

export const buildActivityLogs = (branchId?: string): ActivityLog[] => {
  const formatTs = (iso: string) => (iso ? iso.replace('T', ' ').slice(0, 19) : '');

  // 1. Stored system notification events
  const systemActivities: ActivityLog[] = getStoredActivities().map((a) => ({
    id: a.id,
    user: a.user || 'System',
    action: a.action,
    details: a.details,
    timestamp: formatTs(a.timestamp),
    type: a.type || 'info',
  }));

  // 2. Live Expenses
  const expenses = getStoredExpenses()
    .filter((e) => !branchId || !e.branchId || e.branchId === branchId)
    .map((e): ActivityLog => ({
      id: `exp-${e.id}`,
      user: e.recordedByUserName || 'Accounts Dept',
      action: 'Expense Recorded',
      details: `${e.category}: GHS ${(e.amountMinor / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })} (${e.type === 'internal' ? 'Internal Ops' : 'External Project'}) — ${e.description || e.status}`,
      timestamp: formatTs(e.incurredOn || e.createdAt),
      type: e.status === 'approved' ? 'info' : 'warning',
    }));

  // 3. Live Staff Bonuses & Commissions
  const bonuses = getStoredStaffBonuses()
    .filter((b) => !branchId || !b.branchId || b.branchId === branchId)
    .map((b): ActivityLog => ({
      id: `bonus-${b.id}`,
      user: b.staffName || 'Staff Member',
      action: 'Bonus Awarded',
      details: `${b.ruleName || b.bonusType}: GHS ${((b.amountMinor || b.amountGHS * 100) / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })} awarded (${b.status}) — ${b.reason || ''}`,
      timestamp: formatTs(b.earnedAt),
      type: 'success',
    }));

  // 4. Live Customer Complaints & Service Tickets
  const complaints = getStoredComplaints().map((c): ActivityLog => ({
    id: `comp-${c.id}`,
    user: c.customerName || 'Client Ticket',
    action: 'Customer Complaint',
    details: `${c.subject} — Status: ${c.status.replace('_', ' ').toUpperCase()}`,
    timestamp: formatTs(c.createdAt),
    type: c.status === 'resolved' ? 'success' : 'warning',
  }));

  // 5. Live Branch Governance Approvals
  const approvals = getStoredApprovals()
    .filter((a) => !branchId || !a.branchId || a.branchId === branchId)
    .map((a): ActivityLog => ({
      id: `appr-${a.id}`,
      user: a.requestedBy || 'Branch Ops',
      action: 'Approval Request',
      details: `${a.title} ${a.amountMinor ? `(GHS ${(a.amountMinor / 100).toLocaleString()}) ` : ''}[${String(a.status).toUpperCase()}]`,
      timestamp: formatTs(a.createdAt),
      type: a.status === 'approved' ? 'success' : 'warning',
    }));

  // 6. Live Staff Prospect Interactions
  const interactions = getStoredInteractions().map((i): ActivityLog => ({
    id: `inter-${i.id}`,
    user: i.loggedByUserName || 'Staff Member',
    action: 'Prospect Contacted',
    details: `${i.prospectName || 'Prospect'} reached via ${i.channel.toUpperCase()}: "${(i.response || '').slice(0, 65)}${(i.response || '').length > 65 ? '...' : ''}"`,
    timestamp: formatTs(i.occurredAt || i.createdAt),
    type: 'info',
  }));

  return [
    ...systemActivities,
    ...expenses,
    ...bonuses,
    ...complaints,
    ...approvals,
    ...interactions,
  ]
    .filter((log) => Boolean(log.timestamp))
    .sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1))
    .slice(0, 50);
};

export const buildStats = (branchId?: string): MockActivityStats => {
  // 1. Live Expenses
  const expenses = getStoredExpenses().filter(
    (e) => !branchId || !e.branchId || e.branchId === branchId
  );
  const totalExpensesMinor = expenses.reduce((sum, e) => sum + (e.amountMinor || 0), 0);
  const internalExpensesMinor = expenses
    .filter((e) => e.type === 'internal')
    .reduce((sum, e) => sum + (e.amountMinor || 0), 0);
  const externalExpensesMinor = expenses
    .filter((e) => e.type === 'external')
    .reduce((sum, e) => sum + (e.amountMinor || 0), 0);

  // 2. Live Bonuses
  const bonuses = getStoredStaffBonuses().filter(
    (b) => !branchId || !b.branchId || b.branchId === branchId
  );
  const totalBonusesMinor = bonuses.reduce(
    (sum, b) => sum + (b.amountMinor || Math.round((b.amountGHS || 0) * 100)),
    0
  );

  // 3. Live Complaints
  const complaints = getStoredComplaints();
  const openComplaintsCount = complaints.filter(
    (c) => c.status === 'open' || c.status === 'in_progress'
  ).length;

  // 4. Live Approvals
  const approvals = getStoredApprovals();
  const pendingApprovals = (Array.isArray(approvals) ? approvals : []).filter((a) => {
    const isPending = String(a?.status || '').trim().toLowerCase() === 'pending';
    if (!isPending) return false;
    if (branchId && a.branchId && a.branchId !== branchId) return false;
    return true;
  });

  // 5. Live Payroll
  const payroll = getStoredPayrollRecords().filter(
    (p) => !branchId || !p.branchId || p.branchId === branchId
  );
  const pendingPayrollCount = payroll.filter((p) => p.status === 'pending').length;

  return {
    totalExpensesMinor,
    internalExpensesMinor,
    externalExpensesMinor,
    totalBonusesMinor,
    pendingPayrollCount,
    openComplaintsCount,
    pendingApprovalsCount: pendingApprovals.length,
  };
};

export const useMockActivityFeed = (branchId?: string) => {
  const [logs, setLogs] = useState<ActivityLog[]>(() => buildActivityLogs(branchId));
  const [stats, setStats] = useState<MockActivityStats>(() => buildStats(branchId));

  useEffect(() => {
    const refresh = () => {
      setLogs(buildActivityLogs(branchId));
      setStats(buildStats(branchId));
    };
    refresh();

    window.addEventListener('omark-activity-changed', refresh);
    window.addEventListener('omark-approvals-changed', refresh);
    window.addEventListener('omark-expenses-changed', refresh);
    window.addEventListener('omark-bonuses-changed', refresh);
    window.addEventListener('omark-complaints-changed', refresh);
    window.addEventListener('omark-interactions-changed', refresh);
    window.addEventListener('omark-payroll-changed', refresh);
    window.addEventListener('storage', refresh);

    return () => {
      window.removeEventListener('omark-activity-changed', refresh);
      window.removeEventListener('omark-approvals-changed', refresh);
      window.removeEventListener('omark-expenses-changed', refresh);
      window.removeEventListener('omark-bonuses-changed', refresh);
      window.removeEventListener('omark-complaints-changed', refresh);
      window.removeEventListener('omark-interactions-changed', refresh);
      window.removeEventListener('omark-payroll-changed', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, [branchId]);

  return { logs, stats };
};
