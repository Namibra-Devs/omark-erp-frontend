// src/api/dashboard.ts
import { useQuery } from '@tanstack/react-query';
import { erpClient } from './client';

export interface ActivityLog {
  id: number;
  action: string;
  description: string;
  user: string;
  timestamp: string;
}

export const useDashboardStatsQuery = () => {
  return useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: async () => {
      const response = await erpClient.get<{ success: boolean; data: Record<string, any> }>('/api/dashboard/stats');
      const resData = (response as any).data || response;
      return resData.data;
    },
  });
};

export const useDashboardActivityQuery = () => {
  return useQuery({
    queryKey: ['dashboard', 'activity'],
    queryFn: async () => {
      const response = await erpClient.get<{ success: boolean; data: ActivityLog[] }>('/api/dashboard/activity');
      const resData = (response as any).data || response;
      return resData.data;
    },
  });
};

export const useProjectsStatsQuery = () => {
  return useQuery({
    queryKey: ['dashboard', 'projects', 'stats'],
    queryFn: async () => {
      const response = await erpClient.get<{ success: boolean; data: Record<string, any> }>('/api/dashboard/projects/stats');
      const resData = (response as any).data || response;
      return resData.data;
    },
  });
};

export const useEventsStatsQuery = () => {
  return useQuery({
    queryKey: ['dashboard', 'events', 'stats'],
    queryFn: async () => {
      const response = await erpClient.get<{ success: boolean; data: Record<string, any> }>('/api/dashboard/events/stats');
      const resData = (response as any).data || response;
      return resData.data;
    },
  });
};
