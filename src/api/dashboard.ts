// src/api/dashboard.ts
import { useQuery } from '@tanstack/react-query';
import apiClient from '@/api/client';

// --- Types ---
// NOTE: adjust these to match your actual backend response shapes / @/types/api definitions.

// Flattened to match SystemStats field usage in
// src/pages/dashboard/admin/hooks/useAdminDashboard.ts
export interface AdminDashboardOverview {
  totalUsers: number;
  activeUsers: number;
  totalProspects: number;
  totalCustomers: number;
  totalPaymentPlans: number;
  activePaymentPlans: number;
  totalDeeds: number;
  totalNotifications: number;
  pendingNotifications: number;
  monthlyRevenue: number;
  growthRate: number;
  conversionRate: number;
}

// Shaped to match actual field usage in
// src/pages/dashboard/SecretaryDashboardPage.tsx (amounts are in minor units, e.g. pesewas).
export interface SecretaryDashboardData {
  totalCustomers: number;
  activePlans: number;
  totalDeeds: number;
  monthlyRevenue: number;
  byBand: {
    red: number;
    yellow: number;
    light_green: number;
    green: number;
  };
  defaulters: Array<{
    customerId: string;
    name: string;
    overdueAmountMinor: number;
    daysOverdue: number;
  }>;
  dueSoon: Array<{
    customerId: string;
    name: string;
    dueDate: string;
    amountMinor: number;
  }>;
}

// Shaped to match per-marketer field usage in
// src/pages/marketing/DirectorOverviewPage.tsx. Pipeline/summary totals are
// intentionally NOT part of this payload — the page derives them client-side
// via reduce() over `marketers`, so the API only needs to supply the raw list.
export interface MarketerPerformance {
  id: string;
  name: string;
  avatar?: string;
  email: string;
  phone: string;
  department: string;
  totalProspects: number;
  new: number;
  meetingScheduled: number;
  meetingCompleted: number;
  postponed: number;
  suspended: number;
  converted: number;
  lastActivity: string;
  conversionRate: number;
  trend: 'up' | 'down' | 'flat';
  revenueGenerated: number;
  dealsClosed: number;
  avgResponseTime: number;
  customerSatisfaction: number;
  weeklyGrowth: number;
  monthlyTarget: number;
  targetAchieved: number;
}

export interface MarketingDashboardData {
  marketers: MarketerPerformance[];
}

export interface StaffDashboardData {
  assignedTasks: Array<{
    id: string;
    title: string;
    dueDate: string;
    status: string;
  }>;
  [key: string]: unknown;
}

// --- Query Keys ---

export const dashboardKeys = {
  all: ['dashboard'] as const,
  adminOverview: () => [...dashboardKeys.all, 'admin-overview'] as const,
  secretary: () => [...dashboardKeys.all, 'secretary'] as const,
  marketing: () => [...dashboardKeys.all, 'marketing'] as const,
  staff: () => [...dashboardKeys.all, 'staff'] as const,
};

// --- Hooks ---

export function useAdminDashboardOverviewQuery() {
  return useQuery({
    queryKey: dashboardKeys.adminOverview(),
    queryFn: async () => {
      const res = await apiClient.get<AdminDashboardOverview>('/dashboard/overview');
      return res as unknown as AdminDashboardOverview;
    },
  });
}

export function useSecretaryDashboardQuery() {
  return useQuery({
    queryKey: dashboardKeys.secretary(),
    queryFn: async () => {
      const res = await apiClient.get<SecretaryDashboardData>('/dashboard/secretary');
      return res as unknown as SecretaryDashboardData;
    },
  });
}

export function useMarketingDashboardQuery() {
  return useQuery({
    queryKey: dashboardKeys.marketing(),
    queryFn: async () => {
      const res = await apiClient.get<MarketingDashboardData>('/dashboard/marketing');
      return res as unknown as MarketingDashboardData;
    },
  });
}

export function useStaffDashboardQuery() {
  return useQuery({
    queryKey: dashboardKeys.staff(),
    queryFn: async () => {
      const res = await apiClient.get<StaffDashboardData>('/dashboard/staff');
      return res as unknown as StaffDashboardData;
    },
  });
}