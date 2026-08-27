// src/api/branches.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient, { unwrapData } from '@/api/client';
import type { ApiResponse } from '@/types';

// --- Types ---

export interface BranchEntity {
  id: string;
  name: string;
  branchCode: string;
  location: string;
  phone?: string;
  managerUserId?: string;
  managerInfo?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
  };
  staffCount?: number;
  targetRevenueMinor?: number;
  approvalLimitMinor?: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBranchPayload {
  name: string;
  branchCode: string;
  location: string;
  phone?: string;
  managerUserId?: string;
  targetRevenueMinor?: number;
  approvalLimitMinor?: number;
}

export interface UpdateBranchPayload {
  name?: string;
  location?: string;
  phone?: string;
  managerUserId?: string;
  targetRevenueMinor?: number;
  approvalLimitMinor?: number;
}

export interface BranchPricingOverride {
  propertyId: string;
  priceMinor: number;
}

export interface UpdateBranchPricingPayload {
  propertyPricingOverrides: BranchPricingOverride[];
}

export interface DepartmentEntity {
  id: string;
  name: string;
  description?: string;
}

// --- Query Keys ---

export const branchesKeys = {
  all: ['branches'] as const,
  lists: () => [...branchesKeys.all, 'list'] as const,
  details: () => [...branchesKeys.all, 'detail'] as const,
  detail: (id: string) => [...branchesKeys.details(), id] as const,
  pricing: (id: string) => [...branchesKeys.detail(id), 'pricing'] as const,
  departments: ['departments'] as const,
};

// --- Hooks ---

export function useBranchesQuery() {
  return useQuery({
    queryKey: branchesKeys.lists(),
    queryFn: async () => {
      try {
        const res = await apiClient.get<ApiResponse<BranchEntity[]>>('/branches');
        const data = unwrapData(res);
        if (Array.isArray(data)) return data;
        if (Array.isArray((data as any)?.items)) return (data as any).items;
        return [];
      } catch (err: any) {
        console.warn('Could not fetch branches:', err?.message || err);
        return [];
      }
    },
  });
}

export function useBranchQuery(id: string | undefined) {
  return useQuery({
    queryKey: branchesKeys.detail(id ?? ''),
    queryFn: async () => {
      try {
        const res = await apiClient.get<ApiResponse<BranchEntity>>(`/branches/${id}`);
        return unwrapData(res);
      } catch (err: any) {
        console.warn(`Could not fetch branch ${id}:`, err?.message || err);
        return null;
      }
    },
    enabled: Boolean(id),
  });
}

export function useCreateBranchMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateBranchPayload) => {
      const res = await apiClient.post<ApiResponse<BranchEntity>>('/branches', payload);
      return unwrapData(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: branchesKeys.all });
    },
  });
}

export function useUpdateBranchMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: UpdateBranchPayload }) => {
      const res = await apiClient.patch<ApiResponse<BranchEntity>>(`/branches/${id}`, payload);
      return unwrapData(res);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: branchesKeys.all });
      queryClient.invalidateQueries({ queryKey: branchesKeys.detail(variables.id) });
    },
  });
}

export function useDeleteBranchMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.delete<ApiResponse<{ deleted: boolean; deactivated: boolean }>>(`/branches/${id}`);
      return unwrapData(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: branchesKeys.all });
    },
  });
}

export function useBranchPricingQuery(id: string | undefined) {
  return useQuery({
    queryKey: branchesKeys.pricing(id ?? ''),
    queryFn: async () => {
      try {
        const res = await apiClient.get<ApiResponse<{ propertyPricingOverrides: BranchPricingOverride[] }>>(`/branches/${id}/pricing`);
        return unwrapData(res);
      } catch (err: any) {
        console.warn(`Could not fetch pricing for branch ${id}:`, err?.message || err);
        return { propertyPricingOverrides: [] };
      }
    },
    enabled: Boolean(id),
  });
}

export function useUpdateBranchPricingMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: UpdateBranchPricingPayload }) => {
      const res = await apiClient.patch<ApiResponse<{ propertyPricingOverrides: BranchPricingOverride[] }>>(`/branches/${id}/pricing`, payload);
      return unwrapData(res);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: branchesKeys.pricing(variables.id) });
    },
  });
}

export function useDepartmentsQuery() {
  return useQuery({
    queryKey: branchesKeys.departments,
    queryFn: async () => {
      try {
        const res = await apiClient.get<ApiResponse<DepartmentEntity[]>>('/departments');
        const data = unwrapData(res);
        if (Array.isArray(data)) return data;
        return [];
      } catch (err: any) {
        console.warn('Could not fetch departments:', err?.message || err);
        return [];
      }
    },
  });
}
