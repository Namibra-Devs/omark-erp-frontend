// src/api/faq.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { erpClient } from './client';
import type { FaqEntity, CreateFaqDto } from '@/types/api';

export interface FaqFilter {
  category?: string;
  activeOnly?: boolean;
}

export const useFaqsQuery = (filter?: FaqFilter) => {
  return useQuery({
    queryKey: ['faq', filter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filter) {
        if (filter.category !== undefined) params.append('category', filter.category);
        if (filter.activeOnly !== undefined) params.append('activeOnly', String(filter.activeOnly));
      }
      
      const response = await erpClient.get<{ success: boolean; data: FaqEntity[] }>(`/api/faq?${params}`);
      const resData = (response as any).data || response;
      return resData.data;
    },
  });
};

export const useAllFaqsQuery = () => {
  return useQuery({
    queryKey: ['faq', 'all'],
    queryFn: async () => {
      const response = await erpClient.get<{ success: boolean; data: FaqEntity[] }>('/api/faq/all');
      const resData = (response as any).data || response;
      return resData.data;
    },
  });
};

export const useFaqCategoriesQuery = () => {
  return useQuery({
    queryKey: ['faq', 'categories'],
    queryFn: async () => {
      const response = await erpClient.get<{ success: boolean; data: string[] }>('/api/faq/categories');
      const resData = (response as any).data || response;
      return resData.data;
    },
  });
};

export const useFaqQuery = (id: number) => {
  return useQuery({
    queryKey: ['faq', id],
    queryFn: async () => {
      const response = await erpClient.get<{ success: boolean; data: FaqEntity }>(`/api/faq/${id}`);
      const resData = (response as any).data || response;
      return resData.data;
    },
    enabled: !!id,
  });
};

export const useCreateFaqMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateFaqDto) => {
      const response = await erpClient.post<{ success: boolean; data: FaqEntity }>('/api/faq', data);
      const resData = (response as any).data || response;
      return resData.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['faq'] });
    },
  });
};

export const useUpdateFaqMutation = (id: number) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<CreateFaqDto>) => {
      const response = await erpClient.put<{ success: boolean; data: FaqEntity }>(`/api/faq/${id}`, data);
      const resData = (response as any).data || response;
      return resData.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['faq'] });
      queryClient.invalidateQueries({ queryKey: ['faq', id] });
    },
  });
};

export const useDeleteFaqMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const response = await erpClient.delete<{ success: boolean }>(`/api/faq/${id}`);
      return (response as any).data || response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['faq'] });
    },
  });
};
