// src/api/settings.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient, { unwrapData } from '@/api/client';
import type { ApiResponse } from '@/types';

import { rehydrateAvatarsFromSettings, setPhotoSettingsHandlers, initPhotoStorage } from '@/utils/userPhotoStorage';

// Wire backend photo persistence to PostgreSQL settings and entity endpoints
setPhotoSettingsHandlers(
  fetchAppSettings,
  updateAppSettings,
  async (entityType: string, entityId: string, photoUrl: string | undefined) => {
    try {
      if (entityType === 'staff' || entityType === 'user') {
        await apiClient.patch(`/users/${entityId}`, {
          avatarUrl: photoUrl || null,
          photoUrl: photoUrl || null,
          profilePictureUrl: photoUrl || null,
        }).catch((err) => {
          console.warn('[userPhotoStorage] /users/:id patch notice:', err?.response?.status || err?.message);
        });
      } else if (entityType === 'customer') {
        await apiClient.patch(`/customers/${entityId}`, {
          avatarUrl: photoUrl || null,
          photoUrl: photoUrl || null,
        }).catch(async (err) => {
          if (err?.response?.status === 405) {
            await apiClient.put(`/customers/${entityId}`, {
              avatarUrl: photoUrl || null,
              photoUrl: photoUrl || null,
            }).catch(() => {});
          }
        });
      }
    } catch {}
  }
);

if (typeof window !== 'undefined') {
  initPhotoStorage().catch(() => {});
}

export interface AppSettings {
  marketingCampaigns?: any[];
  marketingTasks?: any[];
  paymentPlans?: any[];
  paymentPlanOverrides?: Record<string, any>;
  customerPlans?: Record<string, any>;
  customerPortalCache?: Record<string, any>;
  expensesStore?: any[];
  deletedExpenseIds?: string[];
  customerAvatars?: Record<string, string>;
  userAvatars?: Record<string, string>;
  entityAvatars?: Record<string, string>;
  [key: string]: any;
}

export const settingsKeys = {
  all: ['settings'] as const,
};

export async function fetchAppSettings(): Promise<AppSettings> {
  try {
    const res = await apiClient.get<ApiResponse<AppSettings>>('/settings');
    const data = unwrapData(res) || (res.data as any)?.data || res.data || {};
    if (data && typeof data === 'object') {
      rehydrateAvatarsFromSettings(data);
    }
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
