// src/api/users.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient, { unwrapData, unwrapList } from '@/api/client';
import { AxiosError } from 'axios';
import type { Role } from '@/types';

// --- Types ---
// Matches the `User` schema from GET/POST/PATCH /api/v1/users in the API docs.

export interface UserEntity {
  id: string;
  firstName: string;
  lastName: string;
  // Kept for backward compatibility with UI code that expects a combined name —
  // the backend never returns this field, use getUserFullName() instead.
  name?: string;
  email: string;
  phone?: string | { number?: string; value?: string };
  phoneNumber?: string;
  role: Role;
  department?: string;
  isActive: boolean;
  avatarUrl?: string;
  photoUrl?: string;
  profilePictureUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UsersListParams {
  page?: number;
  pageSize?: number;
  role?: Role;
  q?: string;
}

export interface UsersListResponse {
  items: UserEntity[];
  total: number;
  page: number;
  pageSize: number;
}

export interface UpdateUserPayload {
  firstName?: string;
  lastName?: string;
  email?: string;
  phoneNumber?: string;
  role?: Role;
  isActive?: boolean;
  password?: string;
  avatarUrl?: string;
  photoUrl?: string;
  profilePictureUrl?: string;
}

export interface CreateUserPayload {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber?: string;
  password: string;
  role: Role;
}

export interface RegisterResponse {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber?: string;
  role: Role;
  isActive: boolean;
  createdAt: string;
}

// --- Query Keys ---

export const usersKeys = {
  all: ['users'] as const,
  lists: () => [...usersKeys.all, 'list'] as const,
  list: (params?: UsersListParams) => [...usersKeys.lists(), params ?? {}] as const,
  details: () => [...usersKeys.all, 'detail'] as const,
  detail: (id: string) => [...usersKeys.details(), id] as const,
  unseenCounts: (id: string) => [...usersKeys.all, 'unseen-counts', id] as const,
  assignment: (id: string) => [...usersKeys.all, 'assignment', id] as const,
  bonuses: (id: string) => [...usersKeys.all, 'bonuses', id] as const,
  activity: (id: string) => [...usersKeys.all, 'activity', id] as const,
};

// --- Hooks ---

export function useUserAssignmentQuery(userId: string | undefined) {
  return useQuery({
    queryKey: usersKeys.assignment(userId ?? ''),
    queryFn: async () => {
      const res = await apiClient.get<import('@/types').ApiResponse<{ branchId?: string; branchName?: string; departmentId?: string; departmentName?: string }>>(`/users/${userId}/assignment`);
      return unwrapData(res);
    },
    enabled: Boolean(userId),
  });
}

export function useUpdateUserAssignmentMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, payload }: { userId: string; payload: { branchId?: string | null; departmentId?: string | null } }) => {
      const res = await apiClient.patch<import('@/types').ApiResponse<{ branchId?: string; departmentId?: string }>>(`/users/${userId}/assignment`, payload);
      return unwrapData(res);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: usersKeys.assignment(variables.userId) });
    },
  });
}

export function useUserBonusesQuery(userId: string | undefined) {
  return useQuery({
    queryKey: usersKeys.bonuses(userId ?? ''),
    queryFn: async () => {
      try {
        const res = await apiClient.get<import('@/types').ApiResponse<Array<{ id: string; amountMinor: number; reason: string; createdAt: string }>>>(`/users/${userId}/bonuses`);
        const data = unwrapData(res);
        if (Array.isArray(data)) return data;
        if (data && Array.isArray((data as any).items)) return (data as any).items;
        return [];
      } catch {
        return [];
      }
    },
    enabled: Boolean(userId),
  });
}

export function useUserActivityQuery(userId: string | undefined) {
  return useQuery({
    queryKey: usersKeys.activity(userId ?? ''),
    queryFn: async () => {
      try {
        const res = await apiClient.get<import('@/types').ApiResponse<Array<{ id: string; type: string; title: string; description?: string; createdAt: string }>>>(`/users/${userId}/activity`);
        const data = unwrapData(res);
        if (Array.isArray(data)) return data;
        if (data && Array.isArray((data as any).items)) return (data as any).items;
        return [];
      } catch {
        return [];
      }
    },
    enabled: Boolean(userId),
  });
}

export function useUnseenCountsQuery(userId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: usersKeys.unseenCounts(userId ?? ''),
    queryFn: async () => {
      const res = await apiClient.get<import('@/types').ApiResponse<import('@/types').UnseenCounts>>(`/users/${userId}/unseen-counts`);
      return unwrapData(res);
    },
    enabled: Boolean(userId) && enabled,
    refetchInterval: 30000,
  });
}

export function useUsersQuery(params?: UsersListParams) {
  return useQuery({
    queryKey: usersKeys.list(params),
    queryFn: async () => {
      try {
        const res = await apiClient.get<import('@/types').ApiResponse<UserEntity[]>>('/users', { params });
        const { items, total, page, pageSize } = unwrapList(res);
        return { items, total, page, pageSize } as UsersListResponse;
      } catch (error) {
        if (error instanceof AxiosError) {
          console.error('Error fetching users:', {
            status: error.response?.status,
            message: error.response?.data?.message || error.message,
          });
        }
        throw error;
      }
    },
  });
}

export function useUserQuery(id: string | undefined) {
  return useQuery({
    queryKey: usersKeys.detail(id ?? ''),
    queryFn: async () => {
      try {
        const res = await apiClient.get<import('@/types').ApiResponse<UserEntity>>(`/users/${id}`);
        return unwrapData(res);
      } catch (error) {
        if (error instanceof AxiosError) {
          console.error(`Error fetching user ${id}:`, {
            status: error.response?.status,
            message: error.response?.data?.message || error.message,
          });
        }
        throw error;
      }
    },
    enabled: Boolean(id),
  });
}

// --- User Mutations ---

export function useCreateUserMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateUserPayload) => {
      try {
        const res = await apiClient.post<import('@/types').ApiResponse<UserEntity>>('/users', payload);
        return unwrapData(res);
      } catch (error) {
        if (error instanceof AxiosError) {
          console.error('Error creating user:', {
            status: error.response?.status,
            message: error.response?.data?.message || error.message,
            errors: error.response?.data?.errors,
          });
        }
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: usersKeys.lists() });
    },
  });
}

export function useUpdateUserMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: UpdateUserPayload }) => {
      try {
        const res = await apiClient.patch<import('@/types').ApiResponse<UserEntity>>(`/users/${id}`, payload);
        return unwrapData(res);
      } catch (error) {
        if (error instanceof AxiosError) {
          console.error('Error updating user:', {
            status: error.response?.status,
            message: error.response?.data?.message || error.message,
          });
        }
        throw error;
      }
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: usersKeys.lists() });
      queryClient.invalidateQueries({ queryKey: usersKeys.detail(variables.id) });
    },
  });
}

export function useDeleteUserMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      try {
        const res = await apiClient.delete(`/users/${id}`);
        return res.data;
      } catch (error) {
        if (error instanceof AxiosError) {
          console.error('Error deleting user:', {
            status: error.response?.status,
            message: error.response?.data?.message || error.message,
          });
        }
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: usersKeys.lists() });
    },
  });
}

// --- Utility Functions ---

export const getUserFullName = (user: UserEntity): string => {
  if (user.name) return user.name;
  return [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email;
};

export const getUserPhone = (user: UserEntity): string => {
  if (typeof user.phone === 'string') return user.phone;
  if (user.phoneNumber) return user.phoneNumber;
  if (user.phone && typeof user.phone === 'object') {
    return user.phone.number || user.phone.value || '';
  }
  return '';
};

export const getRoleLabel = (role: Role): string => {
  const labels: Record<Role, string> = {
    admin: 'Administrator',
    branch_manager: 'Branch Manager',
    marketing_director: 'Marketing Director',
    marketing_staff: 'Marketing Staff',
    customer_service: 'Customer Service',
    secretary: 'Secretary',
    accounts: 'Accounts',
  };
  return labels[role] || role;
};

export const getRoleColor = (role: Role): string => {
  const colors: Record<Role, string> = {
    admin: '#f5222d',
    branch_manager: '#08979c',
    marketing_director: '#722ed1',
    marketing_staff: '#1890ff',
    customer_service: '#13c2c2',
    secretary: '#fa8c16',
    accounts: '#52c41a',
  };
  return colors[role] || '#d9d9d9';
};

export const getRoleIcon = (role: Role): string => {
  const icons: Record<Role, string> = {
    admin: '👑',
    branch_manager: '🏛️',
    marketing_director: '📊',
    marketing_staff: '📝',
    customer_service: '💬',
    secretary: '📋',
    accounts: '💰',
  };
  return icons[role] || '👤';
};

// --- Backward Compatibility (Deprecated) ---

/**
 * @deprecated Use useCreateUserMutation instead
 */
export const useCreateUser = useCreateUserMutation;

/**
 * @deprecated Use useUpdateUserMutation instead
 */
export const useUpdateUser = useUpdateUserMutation;

/**
 * @deprecated Use useDeleteUserMutation instead
 */
export const useDeleteUser = useDeleteUserMutation;

/**
 * @deprecated Use useUsersQuery instead
 */
export const useUsers = useUsersQuery;

/**
 * @deprecated Use useUserQuery instead
 */
export const useUser = useUserQuery;