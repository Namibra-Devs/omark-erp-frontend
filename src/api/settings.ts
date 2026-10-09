// src/api/settings.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient, { unwrapData } from '@/api/client';
import type { ApiResponse } from '@/types';

export interface AppSettings {
  marketingCampaigns?: any[];
  marketingTasks?: any[];
  [key: string]: any;
}

export const settingsKeys = {
  all: ['settings'] as const,
};

export async function fetchAppSettings(): Promise<AppSettings> {
  try {
    const res = await apiClient.get<ApiResponse<AppSettings>>('/settings');
    const data = unwrapData(res) || (res.data as any)?.data || res.data || {};
    return data;
  } catch (err) {
    console.warn('[Settings API] Could not fetch settings from backend:', err);
    return {};
  }
}

export async function updateAppSettings(payload: Partial<AppSettings>): Promise<AppSettings | null> {
  try {
    const res = await apiClient.patch<ApiResponse<AppSettings>>('/settings', payload);
    const data = unwrapData(res) || (res.data as any)?.data || res.data || {};
    return data;
  } catch (err) {
    console.warn('[Settings API] Could not update settings on backend:', err);
    return null;
  }
}

export function useSettingsQuery() {
  return useQuery({
    queryKey: settingsKeys.all,
    queryFn: fetchAppSettings,
    staleTime: 60000,
  });
}

export function useUpdateSettingsMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateAppSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: settingsKeys.all });
    },
  });
}
