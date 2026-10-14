// src/api/appointments.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient, { erpClient, unwrapData, unwrapList } from '@/api/client';
import { AxiosError } from 'axios';
import type { Appointment, AppointmentStatus, AppointmentSource, ApiResponse } from '@/types';

export type { Appointment, AppointmentStatus, AppointmentSource };

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
 * Ensures that a person only has at most ONE active (scheduled or postponed) appointment,
 * with any newer or updated appointment date overwriting older records.
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
        // Drop duplicate active appointment for the same person
        continue;
      }
      seenActivePersons.add(personKey);
    }

    seenIds.add(appt.id);
    result.push(appt);
  }

  return result;
}

export function getStoredAppointments(): Appointment[] {
  try {
    const raw = localStorage.getItem(APPOINTMENTS_STORAGE_KEY);
    if (!raw) return [];
    const list: Appointment[] = JSON.parse(raw);
    const deduplicated = deduplicateAppointmentsList(list);
    if (deduplicated.length !== list.length) {
      localStorage.setItem(APPOINTMENTS_STORAGE_KEY, JSON.stringify(deduplicated));
    }
    return deduplicated;
  } catch {
    return [];
  }
}

export function saveStoredAppointment(appointment: Appointment): void {
  try {
    if (!appointment || !appointment.id) return;
    const list = getStoredAppointments();

    const personKey = appointment.prospectId
      ? `prospect:${appointment.prospectId}`
      : appointment.customerId
      ? `customer:${appointment.customerId}`
      : null;

    const isActive = appointment.status === 'scheduled' || appointment.status === 'postponed';

    const idxById = list.findIndex((a) => a.id === appointment.id);
    const idxByPerson = (personKey && isActive)
      ? list.findIndex(
          (a) =>
            a.id !== appointment.id &&
            ((appointment.prospectId && a.prospectId === appointment.prospectId) ||
             (appointment.customerId && a.customerId === appointment.customerId)) &&
            (a.status === 'scheduled' || a.status === 'postponed')
        )
      : -1;

    let next: Appointment[];
    if (idxById >= 0) {
      next = [...list];
      next[idxById] = {
        ...next[idxById],
        ...appointment,
        assignedUserId: appointment.assignedUserId || next[idxById].assignedUserId,
        assignedUserName: appointment.assignedUserName || next[idxById].assignedUserName,
        createdByUserId: appointment.createdByUserId || next[idxById].createdByUserId,
        createdByName: appointment.createdByName || next[idxById].createdByName,
        staffId: appointment.staffId || next[idxById].staffId,
        staffName: appointment.staffName || next[idxById].staffName,
        updatedAt: appointment.updatedAt || new Date().toISOString(),
      };
      if (idxByPerson >= 0) {
        next = next.filter((_, i) => i !== idxByPerson);
      }
    } else if (idxByPerson >= 0) {
      // Overwrite the existing appointment for this person to prevent duplicates
      next = [...list];
      next[idxByPerson] = {
        ...next[idxByPerson],
        ...appointment,
        updatedAt: appointment.updatedAt || new Date().toISOString(),
      };
    } else {
      next = [appointment, ...list];
    }

    const deduplicated = deduplicateAppointmentsList(next);
    localStorage.setItem(APPOINTMENTS_STORAGE_KEY, JSON.stringify(deduplicated));
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

// POST /public/appointments doesn't publish a response schema in the docs —
// it returns the created Appointment entity.
export type PublicBookAppointmentResponse = Appointment;

// --- Query Keys ---

export const appointmentsKeys = {
  all: ['appointments'] as const,
  list: (params?: AppointmentsListParams) => [...appointmentsKeys.all, 'list', params ?? {}] as const,
  detail: (id: string) => [...appointmentsKeys.all, 'detail', id] as const,
};

// --- Hooks ---

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

        // If caller requested more than 100 items and multiple pages exist or page 1 was full, fetch remaining pages
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

        // Merge with stored/offline appointments
        const storedAppointments = getStoredAppointments();
        if (storedAppointments.length > 0) {
          const map = new Map<string, Appointment>();
          allItems.forEach((a) => map.set(a.id, a));
          storedAppointments.forEach((st) => {
            if (map.has(st.id)) {
              const prev = map.get(st.id)!;
              map.set(st.id, {
                ...prev,
                ...st,
                assignedUserId: st.assignedUserId || prev.assignedUserId,
                assignedUserName: st.assignedUserName || prev.assignedUserName,
                createdByUserId: st.createdByUserId || prev.createdByUserId,
                createdByName: st.createdByName || prev.createdByName,
                staffId: st.staffId || prev.staffId,
                staffName: st.staffName || prev.staffName,
              });
            } else {
              map.set(st.id, st);
            }
          });
          allItems = deduplicateAppointmentsList(Array.from(map.values()));
        } else {
          allItems = deduplicateAppointmentsList(allItems);
        }

        return {
          items: allItems,
          total: Math.max(total, allItems.length),
          page: result.page || 1,
          pageSize: requestedLimit,
          totalPages: Math.max(1, Math.ceil(Math.max(total, allItems.length) / safePageSize)),
        } as AppointmentsListResult;
      } catch (error) {
        if (error instanceof AxiosError) {
          console.warn('Error fetching appointments, providing safe fallback:', {
            status: error.response?.status,
            message: error.response?.data?.message || error.message,
          });
        }
        const storedAppointments = getStoredAppointments();
        return { items: storedAppointments, total: storedAppointments.length, page: 1, pageSize: 100 };
      }
    },
    enabled,
  });
}

/**
 * Create a new appointment for a prospect or customer.
 * If an active appointment already exists for this person, overwrites that record
 * instead of generating duplicate entries.
 */
export function useCreateAppointmentMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateAppointmentPayload) => {
      // Check if an active appointment already exists for this person (prospect or customer).
      // If found, update and overwrite the existing record to prevent duplicate entries for the same person.
      const stored = getStoredAppointments();
      const existingActive = (payload.prospectId || payload.customerId)
        ? stored.find(
            (a) =>
              ((payload.prospectId && a.prospectId === payload.prospectId) ||
               (payload.customerId && a.customerId === payload.customerId)) &&
              (a.status === 'scheduled' || a.status === 'postponed')
          )
        : null;

      if (existingActive) {
        try {
          const response = await apiClient.patch<ApiResponse<Appointment>>(`/appointments/${existingActive.id}`, {
            scheduledFor: payload.scheduledFor,
            feedback: payload.reason,
            status: 'scheduled',
          });
          const serverUpdated = unwrapData(response) || ({} as any);
          const updated: Appointment = {
            ...existingActive,
            ...serverUpdated,
            id: existingActive.id,
            status: 'scheduled',
            scheduledFor: payload.scheduledFor,
            reason: payload.reason || existingActive.reason,
            assignedUserId: payload.assignedUserId || existingActive.assignedUserId,
            assignedUserName: payload.assignedUserName || existingActive.assignedUserName,
            staffId: payload.staffId || existingActive.staffId,
            staffName: payload.staffName || existingActive.staffName,
            updatedAt: new Date().toISOString(),
          } as Appointment;
          saveStoredAppointment(updated);
          return updated;
        } catch {
          const updated: Appointment = {
            ...existingActive,
            id: existingActive.id,
            status: 'scheduled',
            scheduledFor: payload.scheduledFor,
            reason: payload.reason || existingActive.reason,
            assignedUserId: payload.assignedUserId || existingActive.assignedUserId,
            assignedUserName: payload.assignedUserName || existingActive.assignedUserName,
            staffId: payload.staffId || existingActive.staffId,
            staffName: payload.staffName || existingActive.staffName,
            updatedAt: new Date().toISOString(),
          } as Appointment;
          saveStoredAppointment(updated);
          return updated;
        }
      }

      try {
        const response = await apiClient.post<ApiResponse<Appointment>>('/appointments', payload);
        const serverData = unwrapData(response) || ({} as any);
        const created: Appointment = {
          ...payload,
          ...serverData,
          id: serverData.id || `app_${Date.now()}`,
          status: serverData.status || 'scheduled',
          source: serverData.source || 'staff',
          createdAt: serverData.createdAt || new Date().toISOString(),
          updatedAt: serverData.updatedAt || new Date().toISOString(),
          assignedUserId: payload.assignedUserId || serverData.assignedUserId,
          assignedUserName: payload.assignedUserName || serverData.assignedUserName,
          createdByUserId: payload.createdByUserId || serverData.createdByUserId,
          createdByName: payload.createdByName || serverData.createdByName,
          staffId: payload.staffId || serverData.staffId,
          staffName: payload.staffName || serverData.staffName,
        } as Appointment;
        saveStoredAppointment(created);
        return created;
      } catch (error) {
        if (error instanceof AxiosError) {
          console.error('Error creating appointment:', {
            status: error.response?.status,
            message: error.response?.data?.message || error.message,
            errors: error.response?.data?.errors,
          });
        }
        // Save synthesized appointment locally so staff never loses their booking
        const now = new Date().toISOString();
        const synthesized: Appointment = {
          id: `app_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          scheduledFor: payload.scheduledFor,
          prospectId: payload.prospectId,
          customerId: payload.customerId,
          reason: payload.reason,
          status: 'scheduled',
          source: 'staff',
          assignedUserId: payload.assignedUserId,
          assignedUserName: payload.assignedUserName,
          createdByUserId: payload.createdByUserId,
          createdByName: payload.createdByName,
          staffId: payload.staffId,
          staffName: payload.staffName,
          createdAt: now,
          updatedAt: now,
        } as Appointment;
        saveStoredAppointment(synthesized);
        return synthesized;
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
 * Maps to PATCH /appointments/{id} — the only update route the API exposes.
 */
export function useUpdateAppointmentMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: UpdateAppointmentPayload }) => {
      try {
        const response = await apiClient.patch<ApiResponse<Appointment>>(`/appointments/${id}`, payload);
        const updated = unwrapData(response);
        if (updated) {
          saveStoredAppointment(updated);
        } else {
          const stored = getStoredAppointments();
          const existing = stored.find((a) => a.id === id);
          if (existing) {
            saveStoredAppointment({
              ...existing,
              ...payload,
              updatedAt: new Date().toISOString(),
            });
          }
        }
        return updated;
      } catch (error) {
        if (error instanceof AxiosError) {
          console.error('Error updating appointment:', {
            status: error.response?.status,
            message: error.response?.data?.message || error.message,
          });
        }
        const stored = getStoredAppointments();
        const existing = stored.find((a) => a.id === id);
        if (existing) {
          const updated: Appointment = {
            ...existing,
            ...payload,
            updatedAt: new Date().toISOString(),
          };
          saveStoredAppointment(updated);
          return updated;
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
