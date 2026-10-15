// src/api/appointments.ts
import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient, { erpClient, unwrapData, unwrapList } from '@/api/client';
import { AxiosError } from 'axios';
import type { Appointment, AppointmentStatus, AppointmentSource, ApiResponse } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { useUsersQuery } from '@/api/users';
import { useAllStaffInteractionsQuery } from '@/api/interactions';
import {
  filterAppointmentsByScope,
  getAppointmentCreatorId,
  isAppointmentEditableByUser,
  getVisibleStaffIds,
  isServerScopingEnabled,
} from '@/utils/appointmentScoping';

export type { Appointment, AppointmentStatus, AppointmentSource };
export {
  filterAppointmentsByScope,
  getAppointmentCreatorId,
  isAppointmentEditableByUser,
  getVisibleStaffIds,
  isServerScopingEnabled,
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
    return Array.isArray(list) ? list : [];
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
  return useQuery({
    queryKey: appointmentsKeys.list(params),
    queryFn: async () => {
      try {
        const requestedLimit = params?.pageSize || 100;
        const safePageSize = Math.min(requestedLimit, 100);
        const requestParams = { page: 1, ...params, pageSize: safePageSize };
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
        return { items: [], total: 0, page: 1, pageSize: params?.pageSize || 100, totalPages: 1 };
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
  const { user } = useAuth();
  const { data: usersData } = useUsersQuery({ pageSize: 1000 });
  const allUsers = useMemo(() => usersData?.items ?? [], [usersData]);
  const { interactions: allInteractions } = useAllStaffInteractionsQuery();

  const query = useAppointmentsQuery(params, enabled);
  const rawItems = query.data?.items ?? [];

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
 * - Does NOT send creator in the POST body (server sets createdBy = req.user.id).
 * - Never overwrites another staff member's appointment.
 * - On failure, throws the server's real error without saving fake local records.
 */
export function useCreateAppointmentMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateAppointmentPayload) => {
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
        return unwrapData(response);
      } catch (error) {
        if (error instanceof AxiosError) {
          console.error('Error creating appointment on server:', {
            status: error.response?.status,
            message: error.response?.data?.message || error.message,
            errors: error.response?.data?.errors,
          });
        }
        // Do NOT save fake synthesized appointment locally
        throw error;
      }
    },
    onSuccess: () => {
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
      try {
        const response = await apiClient.patch<ApiResponse<Appointment>>(`/appointments/${id}`, payload);
        return unwrapData(response);
      } catch (error) {
        if (error instanceof AxiosError) {
          console.error('Error updating appointment on server:', {
            status: error.response?.status,
            message: error.response?.data?.message || error.message,
          });
        }
        throw error;
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
    completed: { color: '#722ed1', icon: '✔️', label: 'Completed' },
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
