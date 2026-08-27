// src/api/activityLog.ts
import { useQuery } from '@tanstack/react-query';
import apiClient, { unwrapData } from '@/api/client';
import type { ApiResponse } from '@/types';

// --- Types ---

export interface ActivityLogFeedItem {
  type: string;
  at: string;
  summary: string;
  refId?: string;
  performedBy?: string;
}

// --- Query Keys ---

export const activityLogKeys = {
  all: ['activity-log'] as const,
  list: (limit?: number) => [...activityLogKeys.all, limit ?? 20] as const,
};

// --- Hooks ---

export function useActivityLogQuery(limit = 20, enabled = true) {
  return useQuery({
    queryKey: activityLogKeys.list(limit),
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<ActivityLogFeedItem[]>>('/activity-log', {
        params: { limit },
      });
      return unwrapData(res) ?? [];
    },
    enabled,
    refetchInterval: 30000,
  });
}
