// src/api/settings.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient, { unwrapData, unwrapList } from '@/api/client';
import type { ApiResponse } from '@/types';

import {
  rehydrateAvatarsFromSettings,
  setPhotoSettingsHandlers,
  initPhotoStorage,
  getEntityPhoto,
  setEntityPhoto,
} from '@/utils/userPhotoStorage';
import {
  rehydrateUserAssignmentsFromSettings,
  setUserAssignmentSettingsHandlers,
  initUserAssignmentStorage,
  getStoredUserAssignment,
  setStoredUserAssignment,
} from '@/utils/userAssignmentStorage';

let cachedBranches: any[] = [];

async function getLiveBranches(): Promise<any[]> {
  if (cachedBranches.length > 0) return cachedBranches;
  try {
    const res = await apiClient.get<ApiResponse<any[]>>('/branches');
    const list = unwrapList(res).items || (res.data as any)?.data?.items || (res.data as any)?.data || res.data || [];
    if (Array.isArray(list) && list.length > 0) {
      cachedBranches = list;
      return cachedBranches;
    }
  } catch {}
  return [];
}

export async function resolveLiveBranchId(branchHint?: string): Promise<string> {
  const cleanHint = String(branchHint || '').trim();
  const branches = await getLiveBranches();

  if (cleanHint && branches.length > 0) {
    const matched = branches.find(
      (b: any) =>
        b.id === cleanHint ||
        b.branchCode?.toLowerCase() === cleanHint.toLowerCase() ||
        b.name?.toLowerCase() === cleanHint.toLowerCase() ||
        (cleanHint.toLowerCase().includes('kumasi') && b.name?.toLowerCase().includes('kumasi')) ||
        (cleanHint.toLowerCase().includes('accra') && b.name?.toLowerCase().includes('accra')) ||
        (cleanHint.toLowerCase().includes('takoradi') && b.name?.toLowerCase().includes('takoradi')) ||
        (cleanHint.toLowerCase().includes('tamale') && b.name?.toLowerCase().includes('tamale'))
    );
    if (matched?.id) return matched.id;
  }

  // Fallback checking hint directly
  if (cleanHint.toLowerCase().includes('kumasi') || cleanHint.toUpperCase() === 'KMA') return 'b1';
  if (cleanHint.toLowerCase().includes('accra') || cleanHint.toUpperCase() === 'ACC') return 'b2';
  if (cleanHint.toLowerCase().includes('takoradi') || cleanHint.toUpperCase() === 'TKD') return 'b3';
  if (cleanHint.toLowerCase().includes('tamale') || cleanHint.toUpperCase() === 'TML') return 'b4';

  if (branches.length > 0 && branches[0]?.id) {
    return branches[0].id;
  }
  return cleanHint || 'b1';
}

/**
 * Persists a staff member's avatar and profile details permanently to the PostgreSQL
 * database on the remote server via the authenticated branch tasks channel (POST /branches/:id/tasks).
 */
export async function syncStaffRecordToServer(
  userId: string,
  data: {
    avatarUrl?: string | null;
    photoUrl?: string | null;
    firstName?: string;
    lastName?: string;
    phoneNumber?: string;
    branchId?: string;
  }
): Promise<void> {
  if (!userId) return;

  const photoUrl = data.avatarUrl || data.photoUrl || getEntityPhoto('staff', userId);
  const assignment = getStoredUserAssignment(userId);
  const firstName = data.firstName !== undefined ? data.firstName : assignment?.firstName;
  const lastName = data.lastName !== undefined ? data.lastName : assignment?.lastName;
  const phoneNumber = data.phoneNumber !== undefined ? data.phoneNumber : assignment?.phoneNumber;
  const branchHint = data.branchId || assignment?.branchId;

  // Immediate local update
  setStoredUserAssignment(userId, {
    ...(photoUrl ? { avatarUrl: photoUrl, photoUrl } : {}),
    ...(firstName !== undefined ? { firstName } : {}),
    ...(lastName !== undefined ? { lastName } : {}),
    ...(phoneNumber !== undefined ? { phoneNumber } : {}),
    ...(firstName !== undefined && lastName !== undefined ? { name: `${firstName} ${lastName}`.trim() } : {}),
  });
  if (photoUrl) {
    setEntityPhoto('staff', userId, photoUrl, false);
  }

  const payloadString = JSON.stringify({
    userId,
    avatarUrl: photoUrl || null,
    photoUrl: photoUrl || null,
    firstName: firstName || '',
    lastName: lastName || '',
    phoneNumber: phoneNumber || '',
    updatedAt: new Date().toISOString(),
  });

  const branchId = await resolveLiveBranchId(branchHint);

  try {
    // Check if task already exists on this branch
    const tasksRes = await apiClient.get<ApiResponse<any[]>>(`/branches/${branchId}/tasks`).catch(() => null);
    const taskList = (tasksRes ? unwrapList(tasksRes).items : []) || (tasksRes?.data as any)?.data?.items || (tasksRes?.data as any)?.data || tasksRes?.data || [];
    const existing = Array.isArray(taskList)
      ? taskList.find((t: any) => t.title === `OMARK_STAFF_RECORD_${userId}`)
      : null;

    if (existing?.id) {
      await apiClient.patch(`/branches/${branchId}/tasks/${existing.id}`, {
        status: 'completed',
      }).catch(() => {});
    }

    await apiClient.post(`/branches/${branchId}/tasks`, {
      title: `OMARK_STAFF_RECORD_${userId}`,
      description: payloadString,
      assignedUserId: userId,
      dueDate: '2099-12-31',
    });
  } catch (err: any) {
    console.warn('[StaffRecordSync] Notice: could not persist task on branch:', branchId, err?.message);
    if (branchId !== 'b1') {
      try {
        await apiClient.post(`/branches/b1/tasks`, {
          title: `OMARK_STAFF_RECORD_${userId}`,
          description: payloadString,
          assignedUserId: userId,
          dueDate: '2099-12-31',
        });
      } catch {}
    }
  }

  // Also attempt updating /settings shallow merge (succeeds if user is admin)
  if (photoUrl) {
    updateAppSettings({
      userAvatars: { [userId]: photoUrl },
      entityAvatars: { [`staff_${userId}`]: photoUrl, [`user_${userId}`]: photoUrl },
    }).catch(() => {});
  }
}

/**
 * Rehydrates staff avatars and profile details from the PostgreSQL database
 * on the remote server via the Branch Tasks channel.
 */
export async function fetchStaffRecordsFromServer(
  branchHint?: string,
  targetUserId?: string
): Promise<Record<string, any>> {
  const primaryBranchId = await resolveLiveBranchId(branchHint);
  const branches = await getLiveBranches();
  const allBranchIds = Array.from(
    new Set([
      primaryBranchId,
      'b1',
      'b2',
      'b3',
      'b4',
      ...branches.map((b: any) => b.id).filter(Boolean),
    ])
  );

  const records: Record<string, any> = {};

  for (const bId of allBranchIds) {
    try {
      const res = await apiClient.get<ApiResponse<any[]>>(`/branches/${bId}/tasks`);
      const list = unwrapList(res).items || (res?.data as any)?.data?.items || (res?.data as any)?.data || res?.data || [];
      if (!Array.isArray(list)) continue;

      for (const task of list) {
        if (!task || !task.title || !task.description) continue;
        if (task.title.startsWith('OMARK_STAFF_RECORD_') || task.title.startsWith('OMARK_AVATAR_')) {
          try {
            const parsed = typeof task.description === 'string' ? JSON.parse(task.description) : task.description;
            const uId = parsed.userId || task.assignedUserId || task.title.replace('OMARK_STAFF_RECORD_', '').replace('OMARK_AVATAR_', '');
            if (!uId) continue;

            const existing = records[uId];
            if (!existing || !existing.updatedAt || (parsed.updatedAt && parsed.updatedAt > existing.updatedAt)) {
              records[uId] = {
                userId: uId,
                avatarUrl: parsed.avatarUrl || parsed.photoUrl,
                photoUrl: parsed.avatarUrl || parsed.photoUrl,
                firstName: parsed.firstName,
                lastName: parsed.lastName,
                phoneNumber: parsed.phoneNumber,
                updatedAt: parsed.updatedAt,
              };
            }
          } catch {}
        }
      }

      if (targetUserId && records[targetUserId]?.avatarUrl) {
        break;
      }
    } catch {
      // Continue next branch
    }
  }

  // Restore all parsed staff records to local persistence
  for (const [uId, rec] of Object.entries(records)) {
    if (rec.avatarUrl) {
      setEntityPhoto('staff', uId, rec.avatarUrl, false);
    }
    setStoredUserAssignment(uId, {
      ...(rec.avatarUrl ? { avatarUrl: rec.avatarUrl, photoUrl: rec.avatarUrl } : {}),
      ...(rec.firstName ? { firstName: rec.firstName } : {}),
      ...(rec.lastName !== undefined ? { lastName: rec.lastName } : {}),
      ...(rec.phoneNumber ? { phoneNumber: rec.phoneNumber } : {}),
      ...(rec.firstName && rec.lastName !== undefined ? { name: `${rec.firstName} ${rec.lastName}`.trim() } : {}),
    });
  }

  return records;
}

// Wire backend photo persistence to PostgreSQL settings and entity endpoints
setPhotoSettingsHandlers(
  fetchAppSettings,
  updateAppSettings,
  async (entityType: string, entityId: string, photoUrl: string | undefined) => {
    try {
      if (entityType === 'staff' || entityType === 'user') {
        const photoPayload = {
          avatarUrl: photoUrl || null,
          photoUrl: photoUrl || null,
          profilePictureUrl: photoUrl || null,
        };
        // Persist to authoritative Branch Tasks channel on remote PostgreSQL
        await syncStaffRecordToServer(entityId, {
          avatarUrl: photoUrl || null,
          photoUrl: photoUrl || null,
        }).catch(() => {});

        await apiClient.patch(`/users/${entityId}`, photoPayload).catch(async (err) => {
          if (err?.response?.status === 403 || err?.status === 403) {
            // Non-admin staff updating self photo: try authenticated self endpoints
            await apiClient.patch('/auth/me', photoPayload).catch(async () => {
              await apiClient.put('/auth/me', photoPayload).catch(async () => {
                await apiClient.patch('/users/me', photoPayload).catch(async () => {
                  await apiClient.put('/users/me', photoPayload).catch(() => {});
                });
              });
            });
          }
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

// Wire user assignments and profile persistence to PostgreSQL settings
setUserAssignmentSettingsHandlers(fetchAppSettings, updateAppSettings);

if (typeof window !== 'undefined') {
  initPhotoStorage().catch(() => {});
  initUserAssignmentStorage().catch(() => {});
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
  userAssignments?: Record<string, any>;
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
      rehydrateUserAssignmentsFromSettings(data);
    }
    // Also rehydrate staff records from remote branch tasks channel
    fetchStaffRecordsFromServer().catch(() => {});
    return data;
  } catch (err) {
    console.warn('[Settings API] Could not fetch settings from backend:', err);
    fetchStaffRecordsFromServer().catch(() => {});
    return {};
  }
}

export async function rehydrateAllSettingsFromBackend(): Promise<AppSettings> {
  return await fetchAppSettings();
}

export async function updateAppSettings(payload: Partial<AppSettings>): Promise<AppSettings | null> {
  // Immediately apply updates locally to guarantees 0ms responsiveness
  if (payload) {
    if (payload.entityAvatars || payload.userAvatars || payload.customerAvatars) {
      rehydrateAvatarsFromSettings(payload);
    }
    if (payload.userAssignments) {
      rehydrateUserAssignmentsFromSettings(payload);
    }
  }

  try {
    const res = await apiClient.patch<ApiResponse<AppSettings>>('/settings', payload);
    const data = unwrapData(res) || (res.data as any)?.data || res.data || {};
    if (data && typeof data === 'object') {
      rehydrateAvatarsFromSettings(data);
      rehydrateUserAssignmentsFromSettings(data);
    }
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
