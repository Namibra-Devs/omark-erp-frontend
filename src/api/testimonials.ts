// src/api/testimonials.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { erpClient } from './client';
import type { TestimonialEntity } from '@/types/api';

export interface TestimonialsFilter {
  approvedOnly?: boolean;
  featuredOnly?: boolean;
}

export const useTestimonialsQuery = (filter?: TestimonialsFilter) => {
  return useQuery({
    queryKey: ['testimonials', filter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filter) {
        if (filter.approvedOnly !== undefined) params.append('approvedOnly', String(filter.approvedOnly));
        if (filter.featuredOnly !== undefined) params.append('featuredOnly', String(filter.featuredOnly));
      }
      
      const response = await erpClient.get<{ success: boolean; data: TestimonialEntity[] }>(`/api/testimonials?${params}`);
      const resData = (response as any).data || response;
      return resData.data;
    },
  });
};

export const useTestimonialQuery = (id: number) => {
  return useQuery({
    queryKey: ['testimonials', id],
    queryFn: async () => {
      const response = await erpClient.get<{ success: boolean; data: TestimonialEntity }>(`/api/testimonials/${id}`);
      const resData = (response as any).data || response;
      return resData.data;
    },
    enabled: !!id,
  });
};

export const useCreateTestimonialMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Omit<TestimonialEntity, 'id' | 'createdAt' | 'updatedAt'>) => {
      const response = await erpClient.post<{ success: boolean; data: TestimonialEntity }>('/api/testimonials', data);
      const resData = (response as any).data || response;
      return resData.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['testimonials'] });
    },
  });
};

export const useUpdateTestimonialMutation = (id: number) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<Omit<TestimonialEntity, 'id' | 'createdAt' | 'updatedAt'>>) => {
      const response = await erpClient.put<{ success: boolean; data: TestimonialEntity }>(`/api/testimonials/${id}`, data);
      const resData = (response as any).data || response;
      return resData.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['testimonials'] });
      queryClient.invalidateQueries({ queryKey: ['testimonials', id] });
    },
  });
};

export const useDeleteTestimonialMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const response = await erpClient.delete<{ success: boolean }>(`/api/testimonials/${id}`);
      return (response as any).data || response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['testimonials'] });
    },
  });
};
