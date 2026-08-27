// src/api/deedPolicy.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient, { unwrapData } from '@/api/client';
import type { ApiResponse } from '@/types';

export interface DeedPolicy {
  businessContacts?: string;
  defaultWitnessCount?: number;
  notes?: string;
  updatedAt?: string;
}

export interface UpdateDeedPolicyPayload {
  businessContacts?: string;
  defaultWitnessCount?: number;
  notes?: string;
}

export const deedPolicyKeys = {
  all: ['deed-policy'] as const,
};

export function useDeedPolicyQuery() {
  return useQuery({
    queryKey: deedPolicyKeys.all,
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<DeedPolicy>>('/deed-policy');
      return unwrapData(res);
    },
  });
}

export function useUpdateDeedPolicyMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: UpdateDeedPolicyPayload) => {
      const res = await apiClient.patch<ApiResponse<DeedPolicy>>('/deed-policy', payload);
      return unwrapData(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: deedPolicyKeys.all });
    },
  });
}
