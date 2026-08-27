// src/api/complaints.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient, { unwrapData, unwrapList, type ListResult } from '@/api/client';
import type { ApiResponse } from '@/types';

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
      try {
        const res = await apiClient.get<ApiResponse<ComplaintEntity[]>>('/complaints', { params });
        return unwrapList(res);
      } catch (err: any) {
        console.warn('Could not fetch complaints:', err?.message || err);
        return { items: [], total: 0, page: 1, pageSize: 20, totalPages: 1 };
      }
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
        console.warn(`Could not fetch complaint ${id}:`, err?.message || err);
        return null;
      }
    },
    enabled: Boolean(id),
  });
}

export function useCreateComplaintMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateComplaintPayload) => {
      const res = await apiClient.post<ApiResponse<ComplaintEntity>>('/complaints', payload);
      return unwrapData(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: complaintsKeys.all });
    },
  });
}

export function useUpdateComplaintMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: UpdateComplaintPayload }) => {
      const res = await apiClient.patch<ApiResponse<ComplaintEntity>>(`/complaints/${id}`, payload);
      return unwrapData(res);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: complaintsKeys.all });
      queryClient.invalidateQueries({ queryKey: complaintsKeys.detail(variables.id) });
    },
  });
}
