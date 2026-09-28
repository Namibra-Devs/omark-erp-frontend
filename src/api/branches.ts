// src/api/branches.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient, { unwrapData, unwrapList } from '@/api/client';
import type { ApiResponse } from '@/types';
import { getBranchCanonicalKey } from '@/utils/branchIsolation';

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

export type Branch = BranchEntity;
export type BranchDepartment = DepartmentEntity;

export const STANDARD_DEPARTMENTS: DepartmentEntity[] = [
  { id: 'dept-mkt', name: 'Marketing & Sales', description: 'Lead generation, client conversion, and property sales' },
  { id: 'dept-cs', name: 'Customer Service', description: 'Front-desk check-in, customer inquiries, and support' },
  { id: 'dept-fin', name: 'Finance & Accounts', description: 'Payments, bank reconciliation, expense audits, and payroll' },
  { id: 'dept-ops', name: 'Operations', description: 'Operations, site mapping, legal documentation, and deed registry' },
  { id: 'dept-exec', name: 'Executive Administration', description: 'Branch management and strategic leadership' },
  { id: 'dept-admin', name: 'Administration', description: 'General administration and secretarial support' },
];

export const mockBranchDepartments = STANDARD_DEPARTMENTS;

export const DEFAULT_SYSTEM_BRANCHES: BranchEntity[] = [
  {
    id: 'b1',
    name: 'Kumasi Main',
    branchCode: 'KMA',
    location: 'Central Market, Kumasi',
    phone: '+233 32 201 1234',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 'b2',
    name: 'Accra Central',
    branchCode: 'ACC',
    location: 'Airport Residential Area, Accra',
    phone: '+233 30 201 5678',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 'b3',
    name: 'Takoradi Branch',
    branchCode: 'TKD',
    location: 'Market Circle, Takoradi',
    phone: '+233 31 201 9012',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 'b4',
    name: 'Tamale Branch',
    branchCode: 'TML',
    location: 'Central Business District, Tamale',
    phone: '+233 37 201 3456',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  },
];

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
        const raw = res?.data as any;
        const data = unwrapData(res);
        const list = unwrapList(res);

        let liveBranches: BranchEntity[] = [];
        if (Array.isArray(list?.items) && list.items.length > 0) {
          liveBranches = list.items;
        } else if (Array.isArray(data) && data.length > 0) {
          liveBranches = data;
        } else if (Array.isArray((data as any)?.items) && (data as any).items.length > 0) {
          liveBranches = (data as any).items;
        } else if (Array.isArray(raw)) {
          liveBranches = raw;
        } else if (Array.isArray(raw?.items) && raw.items.length > 0) {
          liveBranches = raw.items;
        } else if (Array.isArray(raw?.data) && raw.data.length > 0) {
          liveBranches = raw.data;
        }

        if (liveBranches.length > 0) {
          const seenCanon = new Set(liveBranches.map((b) => getBranchCanonicalKey(b.name || b.branchCode || b.id)));
          const extraDefaults = DEFAULT_SYSTEM_BRANCHES.filter(
            (def) => !seenCanon.has(getBranchCanonicalKey(def.name || def.branchCode || def.id))
          );
          return [...liveBranches, ...extraDefaults];
        }
        return DEFAULT_SYSTEM_BRANCHES;
      } catch (err: any) {
        console.warn('Could not fetch branches, using system defaults:', err?.message || err);
        return DEFAULT_SYSTEM_BRANCHES;
      }
    },
    initialData: DEFAULT_SYSTEM_BRANCHES,
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
        if (Array.isArray(data) && data.length > 0) return data;
        return STANDARD_DEPARTMENTS;
      } catch (err: any) {
        console.warn('Could not fetch departments, using standard departments:', err?.message || err);
        return STANDARD_DEPARTMENTS;
      }
    },
    initialData: STANDARD_DEPARTMENTS,
  });
}
