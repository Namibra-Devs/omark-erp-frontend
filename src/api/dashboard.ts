// src/api/dashboard.ts
import { useQuery } from '@tanstack/react-query';
import apiClient, { unwrapData } from '@/api/client';
import type { ApiResponse } from '@/types';

// --- Types ---
// The API docs don't publish response schemas for the dashboard endpoints
// (NestJS controllers without @ApiResponse DTOs) — these shapes are inferred
// from how the consuming pages use the data and adjusted defensively.

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

export interface AnalyticsMonthPoint {
  month: string;
  revenue: number;
  newProspects: number;
  newCustomers: number;
}

export interface AnalyticsData {
  timeSeries: AnalyticsMonthPoint[];
  conversionRate: number;
  paymentMethods: Array<{ method: string; count: number; totalMinor: number }>;
  topMarketers: Array<{ userId: string; name: string; dealsClosed: number; revenueGenerated: number }>;
}

// --- Query Keys ---

export const dashboardKeys = {
  all: ['dashboard'] as const,
  adminOverview: () => [...dashboardKeys.all, 'admin-overview'] as const,
  secretary: () => [...dashboardKeys.all, 'secretary'] as const,
  marketing: () => [...dashboardKeys.all, 'marketing'] as const,
  staff: () => [...dashboardKeys.all, 'staff'] as const,
  analytics: () => [...dashboardKeys.all, 'analytics'] as const,
};

// --- Hooks ---

export function useAdminDashboardOverviewQuery() {
  return useQuery({
    queryKey: dashboardKeys.adminOverview(),
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<AdminDashboardOverview>>('/dashboard/overview');
      return unwrapData(res);
    },
  });
}

export function useSecretaryDashboardQuery() {
  return useQuery({
    queryKey: dashboardKeys.secretary(),
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<SecretaryDashboardData>>('/dashboard/secretary');
      return unwrapData(res);
    },
  });
}

export function useMarketingDashboardQuery() {
  return useQuery({
    queryKey: dashboardKeys.marketing(),
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<MarketingDashboardData>>('/dashboard/marketing');
      return unwrapData(res);
    },
  });
}

export function useStaffDashboardQuery() {
  return useQuery({
    queryKey: dashboardKeys.staff(),
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<StaffDashboardData>>('/dashboard/staff');
      return unwrapData(res);
    },
  });
}

/**
 * GET /dashboard/analytics — 12-month revenue/prospect/customer time series,
 * conversion rate, payment method breakdown, and top marketers.
 * Restricted to admin / accounts / marketing_director on the backend.
 */
export function useAnalyticsDashboardQuery(enabled = true) {
  return useQuery({
    queryKey: dashboardKeys.analytics(),
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<AnalyticsData>>('/dashboard/analytics');
      return unwrapData(res);
    },
    enabled,
  });
}
