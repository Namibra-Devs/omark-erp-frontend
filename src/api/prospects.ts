// src/api/prospects.ts
import { useQuery, useMutation, useQueryClient, UseQueryOptions } from '@tanstack/react-query';
import apiClient from './client';
import type { Prospect, Interaction, ApiResponse } from '@/types';

export interface ProspectsFilter {
  source?: 'marketing' | 'customer_service';
  assignedUserId?: string;
  status?: string;
  q?: string;
  page?: number;
  pageSize?: number;
}

export const useProspects = (filter: ProspectsFilter) => {
  return useQuery({
    queryKey: ['prospects', filter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filter.source) params.append('source', filter.source);
      if (filter.assignedUserId) params.append('assignedUserId', filter.assignedUserId);
      if (filter.status) params.append('status', filter.status);
      if (filter.q) params.append('q', filter.q);
      if (filter.page) params.append('page', String(filter.page));
      if (filter.pageSize) params.append('pageSize', String(filter.pageSize));
      
      const response = await apiClient.get<ApiResponse<Prospect[]>>(`/prospects?${params}`);
      return response;
    },
  });
};

export const useProspect = (id: string) => {
  return useQuery({
    queryKey: ['prospect', id],
    queryFn: async () => {
      const response = await apiClient.get<ApiResponse<Prospect>>(`/prospects/${id}`);
      return response.data;
    },
    enabled: !!id,
  });
};

export const useCreateProspect = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<Prospect>) => {
      const response = await apiClient.post<ApiResponse<Prospect>>('/prospects', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prospects'] });
    },
  });
};

export const useUpdateProspect = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Prospect> }) => {
      const response = await apiClient.patch<ApiResponse<Prospect>>(`/prospects/${id}`, data);
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['prospects'] });
      queryClient.invalidateQueries({ queryKey: ['prospect', variables.id] });
    },
  });
};

export const useConvertProspect = (id: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => {
      const response = await apiClient.post<ApiResponse<any>>(`/prospects/${id}/convert`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prospects'] });
      queryClient.invalidateQueries({ queryKey: ['prospect', id] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
  });
};

export const useInteractions = (prospectId: string) => {
  return useQuery({
    queryKey: ['interactions', prospectId],
    queryFn: async () => {
      const response = await apiClient.get<ApiResponse<Interaction[]>>(`/prospects/${prospectId}/interactions`);
      return response.data;
    },
    enabled: !!prospectId,
  });
};

export const useLogInteraction = (prospectId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<Interaction>) => {
      const response = await apiClient.post<ApiResponse<Interaction>>(`/prospects/${prospectId}/interactions`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['interactions', prospectId] });
    },
  });
};