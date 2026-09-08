// src/pages/dashboard/admin/hooks/useMockActivityFeed.ts
//
// Activity feed and live summary stats for the Admin Dashboard.
import { useEffect, useState } from 'react';
import { getStoredActivities } from '@/utils/activityNotificationEngine';
import { getStoredApprovals } from '@/api/approvals';
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

const buildActivityLogs = (_branchId?: string): ActivityLog[] => {
  return getStoredActivities().map((a) => ({
    id: a.id,
    user: a.user || 'System',
    action: a.action,
    details: a.details,
    timestamp: a.timestamp.replace('T', ' ').slice(0, 19),
    type: a.type || 'info',
  }));
};

const buildStats = (branchId?: string): MockActivityStats => {
  const approvals = getStoredApprovals();
  const pendingApprovals = (Array.isArray(approvals) ? approvals : []).filter((a) => {
    const isPending = String(a?.status || '').trim().toLowerCase() === 'pending';
    if (!isPending) return false;
    if (branchId && a.branchId && a.branchId !== branchId) return false;
    return true;
  });

  return {
    totalExpensesMinor: 0,
    internalExpensesMinor: 0,
    externalExpensesMinor: 0,
    totalBonusesMinor: 0,
    pendingPayrollCount: 0,
    openComplaintsCount: 0,
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
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('omark-activity-changed', refresh);
      window.removeEventListener('omark-approvals-changed', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, [branchId]);

  return { logs, stats };
};
