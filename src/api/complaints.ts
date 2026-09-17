// src/api/complaints.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient, { unwrapData, unwrapList, type ListResult } from '@/api/client';
import type { ApiResponse } from '@/types';
import dayjs from 'dayjs';

export interface ComplaintEntity {
  id: string;
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  subject: string;
  message: string;
  status: 'open' | 'in_progress' | 'resolved';
  response?: string;
  handledByUserId?: string;
  handledByUserName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ComplaintsListParams {
  status?: 'open' | 'in_progress' | 'resolved';
  customerId?: string;
  page?: number;
  pageSize?: number;
}

export interface CreateComplaintPayload {
  subject: string;
  message: string;
  customerId?: string; // staff only
}

export interface UpdateComplaintPayload {
  status?: 'open' | 'in_progress' | 'resolved';
  response?: string;
  handledByUserId?: string;
}

export const COMPLAINTS_STORAGE_KEY = 'omark_complaints_records_store';

const DEFAULT_SEEDED_COMPLAINTS: ComplaintEntity[] = [
  {
    id: 'comp-seed-1',
    customerId: 'cust-1',
    customerName: 'Dr. Kwabena Asante',
    customerPhone: '+233 24 111 2233',
    subject: 'Allocation Letter & Boundary Demarcation Clarification',
    message: 'Client completed initial deposit for East Legon plot and requested physical allocation letter with GPS boundary coordinates.',
    status: 'open',
    createdAt: dayjs().subtract(4, 'hour').toISOString(),
    updatedAt: dayjs().subtract(4, 'hour').toISOString(),
  },
  {
    id: 'comp-seed-2',
    customerId: 'cust-2',
    customerName: 'Harriet Mensah',
    customerPhone: '+233 20 444 5566',
    subject: 'Reschedule Weekend Site Inspection Visit',
    message: 'Requested rescheduling of family site inspection to Saturday 2:00 PM due to urgent travel commitments.',
    status: 'in_progress',
    handledByUserId: 'usr-cs-1',
    handledByUserName: 'Grace Asante',
    response: 'Liaised with transport dispatch to reserve staff vehicle for Saturday 2:00 PM.',
    createdAt: dayjs().subtract(1, 'day').toISOString(),
    updatedAt: dayjs().subtract(3, 'hour').toISOString(),
  },
  {
    id: 'comp-seed-3',
    customerId: 'cust-3',
    customerName: 'Yaw Boateng',
    customerPhone: '+233 27 777 8899',
    subject: 'Mobile Money Automated Receipt Delivery Delay',
    message: 'Client made monthly installment payment via mobile money and followed up on official digital receipt delivery.',
    status: 'resolved',
    handledByUserId: 'usr-sec-1',
    handledByUserName: 'Ama Serwaa',
    response: 'Verified transaction reference on bank reconciliation portal and generated official receipt PDF to client portal.',
    createdAt: dayjs().subtract(3, 'day').toISOString(),
    updatedAt: dayjs().subtract(1, 'day').toISOString(),
  },
];

export function getStoredComplaints(): ComplaintEntity[] {
  try {
    const raw = localStorage.getItem(COMPLAINTS_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(COMPLAINTS_STORAGE_KEY, JSON.stringify(DEFAULT_SEEDED_COMPLAINTS));
      return DEFAULT_SEEDED_COMPLAINTS;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
    localStorage.setItem(COMPLAINTS_STORAGE_KEY, JSON.stringify(DEFAULT_SEEDED_COMPLAINTS));
    return DEFAULT_SEEDED_COMPLAINTS;
  } catch (err) {
    console.warn('Failed to read stored complaints, returning defaults:', err);
    return DEFAULT_SEEDED_COMPLAINTS;
  }
}

export function saveStoredComplaint(complaint: ComplaintEntity): void {
  try {
    const list = getStoredComplaints();
    const existingIndex = list.findIndex((c) => c.id === complaint.id);
    let next: ComplaintEntity[];
    if (existingIndex >= 0) {
      next = [...list];
      next[existingIndex] = complaint;
    } else {
      next = [complaint, ...list];
    }
    localStorage.setItem(COMPLAINTS_STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event('omark-complaints-changed'));
  } catch (err) {
    console.warn('Failed to save complaint locally:', err);
  }
}

export const complaintsKeys = {
  all: ['complaints'] as const,
  lists: () => [...complaintsKeys.all, 'list'] as const,
  list: (params?: ComplaintsListParams) => [...complaintsKeys.lists(), params ?? {}] as const,
  details: () => [...complaintsKeys.all, 'detail'] as const,
  detail: (id: string) => [...complaintsKeys.details(), id] as const,
};

export function useComplaintsQuery(params?: ComplaintsListParams) {
  return useQuery({
    queryKey: complaintsKeys.list(params),
    queryFn: async (): Promise<ListResult<ComplaintEntity>> => {
      let serverComplaints: ComplaintEntity[] = [];
      try {
        const res = await apiClient.get<ApiResponse<ComplaintEntity[]>>('/complaints', { params });
        const unwrapped = unwrapList(res);
        if (unwrapped && unwrapped.items && unwrapped.items.length > 0) {
          serverComplaints = unwrapped.items;
        }
      } catch (err: any) {
        // Backend optional fallback
      }

      const localComplaints = getStoredComplaints();
      const map = new Map<string, ComplaintEntity>();
      localComplaints.forEach((c) => map.set(c.id, c));
      serverComplaints.forEach((c) => map.set(c.id, c));
      let all = Array.from(map.values());

      if (params?.status) {
        all = all.filter((c) => c.status === params.status);
      }
      if (params?.customerId) {
        all = all.filter((c) => c.customerId === params.customerId);
      }

      return {
        items: all,
        total: all.length,
        page: params?.page ?? 1,
        pageSize: params?.pageSize ?? all.length,
        totalPages: 1,
      };
    },
  });
}

export function useComplaintQuery(id: string | undefined) {
  return useQuery({
    queryKey: complaintsKeys.detail(id ?? ''),
    queryFn: async () => {
      try {
        const res = await apiClient.get<ApiResponse<ComplaintEntity>>(`/complaints/${id}`);
        return unwrapData(res);
      } catch (err: any) {
        const list = getStoredComplaints();
        return list.find((c) => c.id === id) || null;
      }
    },
    enabled: Boolean(id),
  });
}

export function useCreateComplaintMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateComplaintPayload) => {
      const newComplaint: ComplaintEntity = {
        id: `comp-${Date.now()}`,
        subject: payload.subject,
        message: payload.message,
        customerId: payload.customerId,
        status: 'open',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      try {
        const res = await apiClient.post<ApiResponse<ComplaintEntity>>('/complaints', payload);
        const saved = unwrapData(res);
        saveStoredComplaint(saved || newComplaint);
        return saved || newComplaint;
      } catch (err) {
        saveStoredComplaint(newComplaint);
        return newComplaint;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: complaintsKeys.all });
      window.dispatchEvent(new Event('omark-complaints-changed'));
    },
  });
}

export function useUpdateComplaintMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: UpdateComplaintPayload }) => {
      try {
        const res = await apiClient.patch<ApiResponse<ComplaintEntity>>(`/complaints/${id}`, payload);
        const updated = unwrapData(res);
        if (updated) saveStoredComplaint(updated);
        return updated;
      } finally {
        const list = getStoredComplaints();
        const item = list.find((c) => c.id === id);
        if (item) {
          if (payload.status) item.status = payload.status;
          if (payload.response) item.response = payload.response;
          if (payload.handledByUserId) item.handledByUserId = payload.handledByUserId;
          item.updatedAt = new Date().toISOString();
          saveStoredComplaint(item);
        }
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: complaintsKeys.all });
      queryClient.invalidateQueries({ queryKey: complaintsKeys.detail(variables.id) });
      window.dispatchEvent(new Event('omark-complaints-changed'));
    },
  });
}
