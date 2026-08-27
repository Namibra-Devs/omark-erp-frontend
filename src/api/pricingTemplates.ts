// src/api/pricingTemplates.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient, { unwrapData } from '@/api/client';
import type { ApiResponse } from '@/types';

export interface PricingTemplate {
  id: string;
  name: string;
  priceMinor: number;
  currency?: string;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreatePricingTemplatePayload {
  name: string;
  priceMinor: number;
  description?: string;
  currency?: string;
}

export interface UpdatePricingTemplatePayload {
  name?: string;
  priceMinor?: number;
  description?: string;
  currency?: string;
}

export const pricingTemplatesKeys = {
  all: ['pricing-templates'] as const,
  lists: () => [...pricingTemplatesKeys.all, 'list'] as const,
};

export function usePricingTemplatesQuery() {
  return useQuery({
    queryKey: pricingTemplatesKeys.lists(),
    queryFn: async (): Promise<PricingTemplate[]> => {
      try {
        const res = await apiClient.get<ApiResponse<PricingTemplate[]>>('/pricing-templates');
        const data = unwrapData(res);
        if (Array.isArray(data)) return data;
        return [];
      } catch (err: any) {
        console.warn('Could not fetch pricing templates:', err?.message || err);
        return [];
      }
    },
  });
}

export function useCreatePricingTemplateMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreatePricingTemplatePayload) => {
      const res = await apiClient.post<ApiResponse<PricingTemplate>>('/pricing-templates', payload);
      return unwrapData(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pricingTemplatesKeys.all });
    },
  });
}

export function useUpdatePricingTemplateMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: UpdatePricingTemplatePayload }) => {
      const res = await apiClient.patch<ApiResponse<PricingTemplate>>(`/pricing-templates/${id}`, payload);
      return unwrapData(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pricingTemplatesKeys.all });
    },
  });
}
