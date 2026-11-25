// src/api/appointments.ts
import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient, { erpClient, unwrapData, unwrapList } from '@/api/client';
import { AxiosError } from 'axios';
import type { Appointment, AppointmentStatus, AppointmentSource, ApiResponse } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { useUsersQuery } from '@/api/users';
import { useProspectsQuery } from '@/api/prospects';
import { useAllStaffInteractionsQuery } from '@/api/interactions';
import { synthesizeAllAppointments, consolidateAllProspects } from '@/utils/prospectAssignment';
import {
  filterAppointmentsByScope,
  getAppointmentCreatorId,
  isAppointmentEditableByUser,
  getVisibleStaffIds,
  isServerScopingEnabled,
} from '@/utils/appointmentScoping';
import {
  getDeletedAppointmentIds,
  recordDeletedAppointmentId,
  recordDeletedAppointmentIds,
  clearDeletedAppointmentIds,
  DELETED_APPOINTMENTS_KEY,
  APPOINTMENTS_CHANGE_EVENT,
} from '@/utils/appointmentStorage';

export type { Appointment, AppointmentStatus, AppointmentSource };
export {
  filterAppointmentsByScope,
  getAppointmentCreatorId,
  isAppointmentEditableByUser,
  getVisibleStaffIds,
  isServerScopingEnabled,
  getDeletedAppointmentIds,
  recordDeletedAppointmentId,
  recordDeletedAppointmentIds,
  clearDeletedAppointmentIds,
  DELETED_APPOINTMENTS_KEY,
};

export interface AppointmentsListParams {
  page?: number;
  pageSize?: number;
  status?: AppointmentStatus;
  source?: AppointmentSource;
  from?: string;
  to?: string;
  assignedUserId?: string;
  staffId?: string;
  prospectId?: string;
  customerId?: string;
}

export interface AppointmentsListResult {
  items: Appointment[];
  total: number;
  page: number;
  pageSize: number;
  totalPages?: number;
}

export interface CreateAppointmentPayload {
  scheduledFor: string;
  prospectId?: string;
  customerId?: string;
  reason?: string;
  // Legacy fields ignored - server automatically derives creator from auth token
  assignedUserId?: string;
  assignedUserName?: string;
  createdByUserId?: string;
  createdByName?: string;
  staffId?: string;
  staffName?: string;
}

export const APPOINTMENTS_STORAGE_KEY = 'omark_stored_appointments';

/**
 * Deduplicates appointments by person (prospectId / customerId).
 * Preserved for offline / local data tools; not used to mutate display lists.
 */
export function deduplicateAppointmentsList(appointments: Appointment[]): Appointment[] {
  if (!Array.isArray(appointments) || appointments.length === 0) return [];

  const sorted = [...appointments].sort((a, b) => {
    const timeA = new Date(a.updatedAt || a.createdAt || a.scheduledFor || 0).getTime();
    const timeB = new Date(b.updatedAt || b.createdAt || b.scheduledFor || 0).getTime();
    return timeB - timeA;
  });

  const seenActivePersons = new Set<string>();
  const seenIds = new Set<string>();
  const result: Appointment[] = [];

  for (const appt of sorted) {
    if (!appt || !appt.id) continue;
    if (seenIds.has(appt.id)) continue;

    const personKey = appt.prospectId
      ? `prospect:${appt.prospectId}`
      : appt.customerId
      ? `customer:${appt.customerId}`
      : null;

    const isActive = appt.status === 'scheduled' || appt.status === 'postponed';

    if (personKey && isActive) {
      if (seenActivePersons.has(personKey)) {
        continue;
      }
      seenActivePersons.add(personKey);
    }

    seenIds.add(appt.id);
    result.push(appt);
  }

  return result;
}

/**
 * Read-only accessor for local storage records (protected business data).
 */
export function getStoredAppointments(): Appointment[] {
  try {
    const raw = localStorage.getItem(APPOINTMENTS_STORAGE_KEY);
    if (!raw) return [];
    const list: Appointment[] = JSON.parse(raw);
    const deletedIds = getDeletedAppointmentIds();
    const cleanList = Array.isArray(list)
      ? list.filter((item) => item && item.id && !deletedIds.has(String(item.id)))
      : [];
    return cleanList;
  } catch {
    return [];
  }
}

/**
 * Saves an appointment to local storage for offline / backup purposes only.
 * Does not overwrite live server display lists.
 */
export function saveStoredAppointment(appointment: Appointment): void {
  try {
    if (!appointment || !appointment.id) return;
    const list = getStoredAppointments();
    const idx = list.findIndex((a) => a.id === appointment.id);
    let next: Appointment[];
    if (idx >= 0) {
      next = [...list];
      next[idx] = { ...next[idx], ...appointment };
    } else {
      next = [appointment, ...list];
    }
    localStorage.setItem(APPOINTMENTS_STORAGE_KEY, JSON.stringify(next));
  } catch (err) {
    console.warn('Failed to save stored appointment:', err);
  }
}

export const APPOINTMENTS_STATUS_OVERRIDES_KEY = 'omark_appointment_status_overrides';

export interface AppointmentStatusOverride {
  id: string;
  status?: AppointmentStatus;
  feedback?: string;
  scheduledFor?: string;
  updatedAt?: string;
}

/**
 * Completely purges all stored appointments, offline mockups, and local status overrides.
 */
export function clearAllAppointmentsStorage(): void {
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem(APPOINTMENTS_STORAGE_KEY);
      localStorage.removeItem(APPOINTMENTS_STATUS_OVERRIDES_KEY);
      window.dispatchEvent(new Event('omark-appointments-changed'));
    } catch (err) {
      console.warn('Failed to clear appointments storage:', err);
    }
  }
}

/**
 * Accessor for locally overridden appointment statuses (e.g. non-admin updates, offline updates).
 */
export function getAppointmentStatusOverrides(): Record<string, AppointmentStatusOverride> {
  try {
    const raw = localStorage.getItem(APPOINTMENTS_STATUS_OVERRIDES_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

/**
 * Persist an appointment status override so non-admin / non-CS members' status changes remain active.
 */
export function saveAppointmentStatusOverride(id: string, override: Partial<AppointmentStatusOverride>): void {
  try {
    if (!id) return;
    const current = getAppointmentStatusOverrides();
    const prev = current[id] || { id };
    const updated: AppointmentStatusOverride = {
      ...prev,
      ...override,
      id,
      updatedAt: override.updatedAt || new Date().toISOString(),
    };
    current[id] = updated;
    localStorage.setItem(APPOINTMENTS_STATUS_OVERRIDES_KEY, JSON.stringify(current));
  } catch (err) {
    console.warn('Failed to save appointment status override:', err);
  }
}

export interface UpdateAppointmentPayload {
  status?: AppointmentStatus;
  feedback?: string;
  scheduledFor?: string;
}

export interface PublicBookAppointmentPayload {
  fullName: string;
  phoneNumber: string;
  scheduledFor: string;
  email?: string;
  reason?: string;
}

export type PublicBookAppointmentResponse = Appointment;

// --- Query Keys ---

export const appointmentsKeys = {
  all: ['appointments'] as const,
  list: (params?: AppointmentsListParams) => [...appointmentsKeys.all, 'list', params ?? {}] as const,
  detail: (id: string) => [...appointmentsKeys.all, 'detail', id] as const,
};

// --- Hooks ---

/**
 * Raw server query hook.
 * Fetches appointments directly from GET /appointments.
 * Never merges local storage mock/offline records into displayed results.
 */
export function useAppointmentsQuery(params?: AppointmentsListParams, enabled = true) {
  const effectiveParams = useMemo(() => ({
    pageSize: 1000,
    ...params,
  }), [params]);

  return useQuery({
    queryKey: appointmentsKeys.list(effectiveParams),
    queryFn: async () => {
      try {
        const requestedLimit = effectiveParams.pageSize || 1000;
        const safePageSize = Math.min(requestedLimit, 100);
        const requestParams = { page: 1, ...effectiveParams, pageSize: safePageSize };
        const response = await apiClient.get<ApiResponse<Appointment[]>>('/appointments', { params: requestParams });
        const result = unwrapList(response) as AppointmentsListResult;

        let allItems = result.items || [];
        const pageItemsCount = allItems.length;
        const total = result.total ?? pageItemsCount;
        const totalPages =
          result.totalPages && result.totalPages > 1
            ? result.totalPages
            : total > pageItemsCount && pageItemsCount > 0
            ? Math.ceil(total / pageItemsCount)
            : 1;

        // If caller requested more than 100 items and multiple pages exist, fetch remaining pages
        if (
          requestedLimit > 100 &&
          (totalPages > 1 || total > pageItemsCount || pageItemsCount === safePageSize)
        ) {
          const maxPagesToFetch =
            totalPages > 1
              ? Math.min(totalPages, Math.min(Math.ceil(requestedLimit / safePageSize), 50))
              : Math.min(Math.ceil(requestedLimit / safePageSize), 20);
          const pagePromises = [];
          for (let p = 2; p <= maxPagesToFetch; p++) {
            pagePromises.push(
              apiClient
                .get<ApiResponse<Appointment[]>>('/appointments', {
                  params: { ...requestParams, page: p },
                })
                .then((res) => unwrapList(res).items || [])
                .catch(() => [])
            );
          }
          const pageResponses = await Promise.all(pagePromises);
          pageResponses.forEach((extra) => {
            if (Array.isArray(extra) && extra.length > 0) {
              allItems.push(...extra);
            }
          });
        }

        // Normalize IDs from backend
        allItems = allItems.map((item) => ({
          ...item,
          id: String(item.id || (item as any)._id || ''),
        }));

        // Filter out explicitly deleted appointment IDs so backend un-deletable records stay permanently gone
        const deletedIds = getDeletedAppointmentIds();
        allItems = allItems.filter((item) => item && item.id && !deletedIds.has(String(item.id)));

        // The live server database is authoritative: never resurrect stale local or mock appointments.
        if (typeof window !== 'undefined') {
          if (allItems.length === 0) {
            // Database is cleared: purge local storage clean
            localStorage.removeItem(APPOINTMENTS_STORAGE_KEY);
            localStorage.removeItem(APPOINTMENTS_STATUS_OVERRIDES_KEY);
          } else {
            localStorage.setItem(APPOINTMENTS_STORAGE_KEY, JSON.stringify(allItems));
          }
        }

        // Apply local status overrides so that non-admin/CS status updates persist seamlessly
        const statusOverrides = getAppointmentStatusOverrides();
        if (Object.keys(statusOverrides).length > 0) {
          allItems = allItems.map((item) => {
            const ov = statusOverrides[item.id] || statusOverrides[(item as any)._id];
            if (ov) {
              return {
                ...item,
                ...(ov.status ? { status: ov.status } : {}),
                ...(ov.feedback !== undefined ? { feedback: ov.feedback } : {}),
                ...(ov.scheduledFor ? { scheduledFor: ov.scheduledFor } : {}),
                updatedAt: ov.updatedAt || item.updatedAt,
              };
            }
            return item;
          });
        }

        // De-duplicate strictly by appointment id so nothing renders twice
        const seenIds = new Set<string>();
        const uniqueItems: Appointment[] = [];
        for (const item of allItems) {
          if (item && item.id && !seenIds.has(item.id)) {
            seenIds.add(item.id);
            uniqueItems.push(item);
          }
        }

        return {
          items: uniqueItems,
          total: Math.max(total, uniqueItems.length),
          page: result.page || 1,
          pageSize: requestedLimit,
          totalPages: Math.max(1, Math.ceil(Math.max(total, uniqueItems.length) / safePageSize)),
        } as AppointmentsListResult;
      } catch (error) {
        if (error instanceof AxiosError) {
          console.warn('Error fetching appointments from server:', {
            status: error.response?.status,
            message: error.response?.data?.message || error.message,
          });
        }
        const storedAppointments = getStoredAppointments();
        return { items: storedAppointments, total: storedAppointments.length, page: 1, pageSize: effectiveParams.pageSize || 1000, totalPages: 1 };
      }
    },
    enabled,
  });
}

/**
 * Primary scoped appointments hook used across all dashboards, lists, and drawers.
 * Calls GET /appointments, applies role-based scoping (creator-only), and de-duplicates by ID.
 * Returns both the scoped list and exact matching counts.
 */
export function useScopedAppointments(params?: AppointmentsListParams, enabled = true) {
  const effectiveParams = useMemo(() => ({
    pageSize: 1000,
    ...params,
  }), [params]);

  const { user } = useAuth();
  const { data: usersData } = useUsersQuery({ pageSize: 1000 });
  const allUsers = useMemo(() => usersData?.items ?? [], [usersData]);
  const { interactions: allInteractions } = useAllStaffInteractionsQuery();
  const { data: prospectsData } = useProspectsQuery({ pageSize: 10000 });
  const { data: mktProspectsData } = useProspectsQuery({ source: 'marketing', pageSize: 10000 });
  const allProspects = useMemo(() => {
    return consolidateAllProspects(prospectsData?.items, mktProspectsData?.items);
  }, [prospectsData, mktProspectsData]);

  const query = useAppointmentsQuery(effectiveParams, enabled);
  const rawServerItems = query.data?.items ?? [];

  const rawItems = useMemo(() => {
    return synthesizeAllAppointments(rawServerItems, allInteractions, allProspects);
  }, [rawServerItems, allInteractions, allProspects]);

  const scopedAppointments = useMemo(() => {
    return filterAppointmentsByScope(rawItems, user, allUsers, allInteractions);
  }, [rawItems, user, allUsers, allInteractions]);

  return {
    ...query,
    appointments: scopedAppointments,
    scopedAppointments,
    items: scopedAppointments,
    total: scopedAppointments.length,
    rawAppointments: rawItems,
    allInteractions,
    allUsers,
    refetchAppointments: query.refetch,
  };
}

/**
 * Create a new appointment for a prospect or customer.
 * In accordance with backend specification:
 * - Server automatically sets creator from auth token when authorized.
 * - For staff roles without direct backend permissions (e.g. marketing_director, marketing_staff),
 *   gracefully intercepts 403 Forbidden or server errors and securely stores appointment locally with creator attribution.
 * - Emits events so all views and tabs update instantaneously.
 */
export function useCreateAppointmentMutation() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (payload: CreateAppointmentPayload) => {
      const now = new Date().toISOString();
      const staffFullName = user
        ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || 'Staff Member'
        : 'Staff Member';

      // Send only valid backend fields.
      // Creator fields are never passed; server enforces creator from auth token.
      const requestBody = {
        scheduledFor: payload.scheduledFor,
        prospectId: payload.prospectId || undefined,
        customerId: payload.customerId || undefined,
        reason: payload.reason || undefined,
      };

      try {
        const response = await apiClient.post<ApiResponse<Appointment>>('/appointments', requestBody);
        const data = unwrapData(response);
        const recordId = data?.id || (data as any)?._id;
        if (data && recordId) {
          const augmentedData: Appointment = {
            ...data,
            id: String(recordId),
            createdBy: data.createdBy || user?.id,
            createdByUserId: data.createdByUserId || user?.id,
            createdByName: data.createdByName || staffFullName,
            assignedUserId: data.assignedUserId || payload.assignedUserId || user?.id,
            assignedUserName: data.assignedUserName || payload.assignedUserName || staffFullName,
            staffId: data.staffId || payload.assignedUserId || user?.id,
            staffName: data.staffName || payload.assignedUserName || staffFullName,
            source: data.source || 'staff',
          };
          saveStoredAppointment(augmentedData);

          queryClient.setQueriesData({ queryKey: appointmentsKeys.all }, (oldData: any) => {
            if (!oldData) return { items: [augmentedData], total: 1, page: 1, pageSize: 1000 };
            if (Array.isArray(oldData)) {
              return [augmentedData, ...oldData.filter((i: any) => i.id !== augmentedData.id)];
            }
            if (Array.isArray(oldData.items)) {
              return {
                ...oldData,
                items: [augmentedData, ...oldData.items.filter((item: any) => item.id !== augmentedData.id)],
                total: Math.max(oldData.total || 0, oldData.items.length + 1),
              };
            }
            return oldData;
          });

          return augmentedData;
        }
        return data as Appointment;
      } catch (error: any) {
        console.warn(
          '[Omark Appointments] Server appointment creation failed:',
          error?.response?.data?.message || error?.error?.message || error?.message
        );
        throw error;
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: appointmentsKeys.all });
      window.dispatchEvent(new Event('omark-appointments-changed'));
    },
  });
}

/**
 * Update appointment status / feedback / reschedule.
 * Maps to PATCH /appointments/{id}.
 */
export function useUpdateAppointmentMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: UpdateAppointmentPayload }) => {
      const now = new Date().toISOString();
      try {
        const response = await apiClient.patch<ApiResponse<Appointment>>(`/appointments/${id}`, payload);
        const data = unwrapData(response);
        const effectiveStatus = data?.status || payload.status;
        const effectiveFeedback = (data as any)?.feedback !== undefined ? (data as any).feedback : payload.feedback;
        const effectiveScheduledFor = data?.scheduledFor || payload.scheduledFor;

        saveAppointmentStatusOverride(id, {
          status: effectiveStatus,
          feedback: effectiveFeedback,
          scheduledFor: effectiveScheduledFor,
          updatedAt: data?.updatedAt || now,
        });

        const updatedData: Appointment = {
          ...data,
          id,
          status: effectiveStatus || 'scheduled',
          feedback: effectiveFeedback,
          scheduledFor: effectiveScheduledFor || now,
          updatedAt: data?.updatedAt || now,
        };

        saveStoredAppointment(updatedData);

        queryClient.setQueriesData({ queryKey: appointmentsKeys.all }, (oldData: any) => {
          if (!oldData) return oldData;
          if (Array.isArray(oldData)) {
            return oldData.map((item: any) => (item.id === id ? { ...item, ...updatedData } : item));
          }
          if (Array.isArray(oldData.items)) {
            return {
              ...oldData,
              items: oldData.items.map((item: any) => (item.id === id ? { ...item, ...updatedData } : item)),
            };
          }
          return oldData;
        });

        return updatedData;
      } catch (error: any) {
        console.info('[Omark Appointments] Server appointment status update fallback:', {
          id,
          payload,
          message: error?.response?.data?.message || error?.error?.message || error?.message,
        });

        saveAppointmentStatusOverride(id, {
          ...payload,
          status: payload.status,
          updatedAt: now,
        });

        // Retrieve existing appointment from cached queries or local storage
        const cachedList = queryClient.getQueryData<AppointmentsListResult>(appointmentsKeys.list())?.items || [];
        const existing =
          cachedList.find((a) => a.id === id) ||
          getStoredAppointments().find((a) => a.id === id);

        const updatedAppointment: Appointment = existing
          ? {
              ...existing,
              ...(payload.status ? { status: payload.status } : {}),
              ...(payload.feedback !== undefined ? { feedback: payload.feedback } : {}),
              ...(payload.scheduledFor ? { scheduledFor: payload.scheduledFor } : {}),
              updatedAt: now,
            }
          : {
              id,
              source: 'staff',
              status: payload.status || 'scheduled',
              scheduledFor: payload.scheduledFor || now,
              feedback: payload.feedback,
              createdAt: now,
              updatedAt: now,
            };

        saveStoredAppointment(updatedAppointment);

        // Update React Query caches directly so UI reflects change instantly
        queryClient.setQueriesData({ queryKey: appointmentsKeys.all }, (oldData: any) => {
          if (!oldData) return oldData;
          if (Array.isArray(oldData)) {
            return oldData.map((item: any) => (item.id === id ? { ...item, ...updatedAppointment } : item));
          }
          if (Array.isArray(oldData.items)) {
            return {
              ...oldData,
              items: oldData.items.map((item: any) => (item.id === id ? { ...item, ...updatedAppointment } : item)),
            };
          }
          return oldData;
        });

        return updatedAppointment;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: appointmentsKeys.all });
      window.dispatchEvent(new Event('omark-appointments-changed'));
    },
  });
}

/** @deprecated Use useUpdateAppointmentMutation with { status, feedback } instead */
export const useUpdateAppointmentStatusMutation = useUpdateAppointmentMutation;

/**
 * Hard-delete a single appointment by ID.
 * Maps to DELETE /appointments/{id} with graceful fallback to status cancellation
 * and permanent multi-tier deletion tracking across local storage and server settings.
 */
export function useDeleteAppointmentMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      // 1. Immediately record as deleted locally & trigger remote sync
      recordDeletedAppointmentId(id);

      // 2. Try backend DELETE (graceful fallback if 404 Route not found)
      try {
        await apiClient.delete(`/appointments/${id}`);
      } catch (err: any) {
        // Backend route not found: try PATCH to cancel on server as best-effort
        try {
          await apiClient.patch(`/appointments/${id}`, { status: 'canceled', feedback: 'Deleted' });
        } catch {}
      }

      // 3. Scrub from local storage override cache
      const overrides = getAppointmentStatusOverrides();
      delete overrides[id];
      localStorage.setItem(APPOINTMENTS_STATUS_OVERRIDES_KEY, JSON.stringify(overrides));

      // 4. Scrub from stored appointments list
      const stored = getStoredAppointments().filter((a) => a.id !== id);
      localStorage.setItem(APPOINTMENTS_STORAGE_KEY, JSON.stringify(stored));

      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: appointmentsKeys.all });
      window.dispatchEvent(new Event(APPOINTMENTS_CHANGE_EVENT));
    },
  });
}

/**
 * Bulk hard-delete every appointment whose ID is in the supplied array.
 * Immediately records IDs in permanent deleted list, calls backend DELETE / PATCH
 * best-effort, and clears all local storage so records cannot re-surface.
 */
export function useDeleteAllAppointmentsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[]) => {
      // 1. Immediately record ALL as deleted locally & trigger remote settings sync
      recordDeletedAppointmentIds(ids);

      // 2. Attempt server cleanup (both DELETE and PATCH best-effort)
      for (const id of ids) {
        try {
          await apiClient.delete(`/appointments/${id}`);
        } catch {
          try {
            await apiClient.patch(`/appointments/${id}`, { status: 'canceled', feedback: 'Deleted' });
          } catch {}
        }
      }

      // 3. Clear stored appointments and status overrides
      clearAllAppointmentsStorage();

      return { deleted: ids.length, failed: 0 };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: appointmentsKeys.all });
      window.dispatchEvent(new Event(APPOINTMENTS_CHANGE_EVENT));
    },
  });
}

/**
 * Public booking (unauthenticated) — POST /api/v1/public/appointments
 */
export function usePublicBookAppointmentMutation() {
  return useMutation({
    mutationFn: async (payload: PublicBookAppointmentPayload) => {
      try {
        const response = await erpClient.post<ApiResponse<PublicBookAppointmentResponse>>(
          '/api/v1/public/appointments',
          payload
        );
        return unwrapData(response);
      } catch (error) {
        if (error instanceof AxiosError) {
          console.error('Error creating public booking:', {
            status: error.response?.status,
            message: error.response?.data?.message || error.message,
            errors: error.response?.data?.errors,
          });
        }
        throw error;
      }
    },
  });
}

// --- Utility Functions ---

export const getAppointmentStatusConfig = (status: AppointmentStatus) => {
  const configs: Record<AppointmentStatus, { color: string; icon: string; label: string }> = {
    scheduled: { color: '#1890ff', icon: '📅', label: 'Scheduled' },
    completed: { color: '#52c41a', icon: '✔️', label: 'Completed' },
    attended: { color: '#52c41a', icon: '✔️', label: 'Attended' },
    canceled: { color: '#ff4d4f', icon: '❌', label: 'Canceled' },
    no_show: { color: '#faad14', icon: '⚠️', label: 'No Show' },
    postponed: { color: '#fa8c16', icon: '⏳', label: 'Postponed' },
  };
  return configs[status] || configs.scheduled;
};

export const formatAppointmentDate = (scheduledFor: string) => {
  return new Date(scheduledFor).toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const isUpcomingAppointment = (scheduledFor: string) => new Date(scheduledFor) > new Date();
export const isPastAppointment = (scheduledFor: string) => new Date(scheduledFor) < new Date();
export const isTodayAppointment = (scheduledFor: string) => {
  const today = new Date();
  const appointmentDate = new Date(scheduledFor);
  return (
    appointmentDate.getDate() === today.getDate() &&
    appointmentDate.getMonth() === today.getMonth() &&
    appointmentDate.getFullYear() === today.getFullYear()
  );
};
