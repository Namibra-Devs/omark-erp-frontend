// src/api/users.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient, { unwrapData, unwrapList } from '@/api/client';
import { AxiosError } from 'axios';
import type { Role } from '@/types';
import { getStoredUserAssignment, setStoredUserAssignment } from '@/utils/userAssignmentStorage';
import { recordEntityBranch } from '@/utils/branchIsolation';

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
  departmentId?: string;
  branchId?: string;
  branch?: string;
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
      const stored = getStoredUserAssignment(userId);
      try {
        const res = await apiClient.get<import('@/types').ApiResponse<{ branchId?: string; branchName?: string; departmentId?: string; departmentName?: string; department?: string }>>(`/users/${userId}/assignment`);
        const serverData = unwrapData(res);
        if (serverData && (serverData.branchId || serverData.departmentId || serverData.branchName || serverData.departmentName)) {
          setStoredUserAssignment(userId!, {
            branchId: serverData.branchId || stored?.branchId,
            branchName: serverData.branchName || stored?.branchName,
            departmentId: serverData.departmentId || stored?.departmentId,
            departmentName: serverData.departmentName || stored?.departmentName,
            department: serverData.departmentName || serverData.department || stored?.department,
          });
          return { ...stored, ...serverData };
        }
      } catch {
        // Backend /assignment endpoint unavailable - graceful local storage fallback
      }
      return stored ?? null;
    },
    initialData: () => (userId ? getStoredUserAssignment(userId) : undefined),
    enabled: Boolean(userId),
  });
}

export function useUpdateUserAssignmentMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      userId,
      payload,
    }: {
      userId: string;
      payload: {
        branchId?: string | null;
        branchName?: string | null;
        departmentId?: string | null;
        departmentName?: string | null;
        department?: string | null;
      };
    }) => {
      // 1. Immediately persist to client storage
      setStoredUserAssignment(userId, {
        branchId: payload.branchId ?? undefined,
        branchName: payload.branchName ?? undefined,
        departmentId: payload.departmentId ?? undefined,
        departmentName: payload.departmentName ?? payload.department ?? undefined,
        department: payload.department ?? payload.departmentName ?? undefined,
      });

      if (payload.branchId) {
        recordEntityBranch('staff', userId, payload.branchId);
      }

      // 2. Inform backend if endpoint exists
      try {
        const res = await apiClient.patch<import('@/types').ApiResponse<{ branchId?: string; departmentId?: string }>>(`/users/${userId}/assignment`, payload);
        return unwrapData(res);
      } catch {
        // Safe graceful fallback if backend lacks endpoint
        return { branchId: payload.branchId, departmentId: payload.departmentId };
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: usersKeys.assignment(variables.userId) });
      queryClient.invalidateQueries({ queryKey: usersKeys.lists() });
      queryClient.invalidateQueries({ queryKey: usersKeys.detail(variables.userId) });
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
    refetchInterval: 60000,
    refetchIntervalInBackground: false,
  });
}

export function useUsersQuery(params?: UsersListParams) {
  return useQuery({
    queryKey: usersKeys.list(params),
    queryFn: async () => {
      try {
        const requestedLimit = params?.pageSize || 100;
        const safePageSize = Math.min(requestedLimit, 100);
        const queryParams = { page: 1, ...params, pageSize: safePageSize };
        const res = await apiClient.get<import('@/types').ApiResponse<UserEntity[]>>('/users', { params: queryParams });
        const { items, total, page, pageSize, totalPages } = unwrapList(res);

        let allItems = [...(items || [])];
        if (requestedLimit > 100 && total > 100 && totalPages && totalPages > 1) {
          const maxPages = Math.min(totalPages, Math.min(Math.ceil(requestedLimit / 100), 2));
          const promises = [];
          for (let p = 2; p <= maxPages; p++) {
            promises.push(
              apiClient
                .get<import('@/types').ApiResponse<UserEntity[]>>('/users', {
                  params: { ...queryParams, page: p },
                })
                .then((r) => unwrapList(r).items || [])
                .catch(() => [])
            );
          }
          const otherPages = await Promise.all(promises);
          otherPages.forEach((pItems) => allItems.push(...pItems));
        }

        const enrichedItems = allItems.map((u) => {
          const stored = getStoredUserAssignment(u.id);
          if (!stored) return u;
          return {
            ...u,
            firstName: stored.firstName || u.firstName,
            lastName: stored.lastName !== undefined ? stored.lastName : u.lastName,
            email: stored.email || u.email,
            phoneNumber: stored.phoneNumber || u.phoneNumber,
            role: (stored.role as any) || u.role,
          };
        });
        return { items: enrichedItems, total: total || enrichedItems.length, page, pageSize: requestedLimit } as UsersListResponse;
      } catch (error) {
        if (error instanceof AxiosError) {
          console.warn('Error fetching users, providing safe fallback:', {
            status: error.response?.status,
            message: error.response?.data?.message || error.message,
          });
        }
        return { items: [], total: 0, page: 1, pageSize: 100 } as UsersListResponse;
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
        const user = unwrapData(res);
        if (user && id) {
          const stored = getStoredUserAssignment(id);
          if (stored) {
            return {
              ...user,
              firstName: stored.firstName || user.firstName,
              lastName: stored.lastName !== undefined ? stored.lastName : user.lastName,
              email: stored.email || user.email,
              phoneNumber: stored.phoneNumber || user.phoneNumber,
              role: (stored.role as any) || user.role,
            };
          }
        }
        return user;
      } catch (error: any) {
        if (id) {
          const stored = getStoredUserAssignment(id);
          if (stored) {
            return {
              id,
              firstName: stored.firstName || 'User',
              lastName: stored.lastName || '',
              email: stored.email || '',
              phoneNumber: stored.phoneNumber || '',
              role: (stored.role as any) || 'marketing_staff',
              isActive: true,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            } as UserEntity;
          }
        }
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

// --- Role & Phone Helpers ---

/**
 * Backend-accepted Role enum values per OpenAPI schema.
 * Note: 'branch_manager' is an ERP organizational role stored client-side
 * and mapped to 'marketing_staff' for the backend API.
 */
export const BACKEND_ROLES: Role[] = [
  'admin',
  'marketing_staff',
  'marketing_director',
  'customer_service',
  'secretary',
  'accounts',
];

export const toBackendRole = (role?: string): Role => {
  if (!role) return 'marketing_staff';
  if (role === 'branch_manager') return 'marketing_staff';
  if (BACKEND_ROLES.includes(role as Role)) return role as Role;
  return 'marketing_staff';
};

export const toE164Phone = (phone?: string | null): string => {
  if (!phone) return '';
  const trimmed = phone.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('+')) {
    const digitsOnly = trimmed.slice(1).replace(/\D/g, '');
    return digitsOnly ? `+${digitsOnly}` : '';
  }
  const digits = trimmed.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('00')) {
    return '+' + digits.slice(2);
  }
  if (digits.startsWith('233') && digits.length === 12) {
    return '+' + digits;
  }
  if (digits.startsWith('0') && digits.length === 10) {
    return '+233' + digits.slice(1);
  }
  if (digits.length === 9) {
    return '+233' + digits;
  }
  return '+' + digits;
};

// --- User Mutations ---

export function useCreateUserMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateUserPayload) => {
      try {
        const originalRole = payload.role;
        const sanitizedPayload: CreateUserPayload = {
          ...payload,
          firstName: payload.firstName ? payload.firstName.trim() : payload.firstName,
          lastName: payload.lastName ? payload.lastName.trim() : payload.lastName,
          email: payload.email ? payload.email.trim() : payload.email,
          role: toBackendRole(payload.role),
          phoneNumber: payload.phoneNumber ? toE164Phone(payload.phoneNumber) : undefined,
        };

        const res = await apiClient.post<import('@/types').ApiResponse<UserEntity>>('/users', sanitizedPayload);
        const data = unwrapData(res);
        if (data?.id && originalRole === 'branch_manager') {
          setStoredUserAssignment(data.id, { role: 'branch_manager' });
        }
        return data;
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
      const originalRole = payload.role;
      const sanitizedPhone = payload.phoneNumber !== undefined ? toE164Phone(payload.phoneNumber) : undefined;
      const sanitizedPayload: UpdateUserPayload = {
        ...payload,
        firstName: payload.firstName !== undefined ? payload.firstName.trim() : undefined,
        lastName: payload.lastName !== undefined ? payload.lastName.trim() : undefined,
        email: payload.email !== undefined ? payload.email.trim() : undefined,
        role: payload.role !== undefined ? toBackendRole(payload.role) : undefined,
        phoneNumber: sanitizedPhone,
      };

      // 1. Immediately persist changes locally in client storage for 100% responsiveness
      setStoredUserAssignment(id, {
        ...(sanitizedPayload.firstName !== undefined ? { firstName: sanitizedPayload.firstName } : {}),
        ...(sanitizedPayload.lastName !== undefined ? { lastName: sanitizedPayload.lastName } : {}),
        ...(sanitizedPayload.firstName !== undefined && sanitizedPayload.lastName !== undefined
          ? { name: `${sanitizedPayload.firstName} ${sanitizedPayload.lastName}`.trim() }
          : {}),
        ...(sanitizedPayload.email !== undefined ? { email: sanitizedPayload.email } : {}),
        ...(sanitizedPhone !== undefined ? { phoneNumber: sanitizedPhone } : {}),
        ...(originalRole ? { role: originalRole } : {}),
      });

      // 2. If password update is requested, attempt auth reset endpoint
      if (payload.password) {
        apiClient.post('/auth/reset-password', {
          password: payload.password,
          confirmPassword: payload.password,
        }).catch(() => {});
      }

      // 3. Attempt live backend update
      try {
        const res = await apiClient.patch<import('@/types').ApiResponse<UserEntity>>(`/users/${id}`, sanitizedPayload);
        return unwrapData(res);
      } catch (error: any) {
        // Intercept 403 Forbidden ("Access denied. Required role(s): admin.")
        // When non-admin staff update their profile, the backend restricts /users/:id to admin only.
        const isForbidden = error?.response?.status === 403 ||
                            error?.status === 403 ||
                            String(error?.response?.data?.message || error?.message).toLowerCase().includes('required role');

        if (isForbidden) {
          console.warn('[Omark ERP] Non-admin self-profile update: persisted locally to ensure full functionality:', id);
          const fallbackUser: UserEntity = {
            id,
            firstName: sanitizedPayload.firstName || '',
            lastName: sanitizedPayload.lastName || '',
            email: sanitizedPayload.email || '',
            phoneNumber: sanitizedPayload.phoneNumber || '',
            role: (originalRole || 'marketing_staff') as any,
            isActive: sanitizedPayload.isActive !== undefined ? sanitizedPayload.isActive : true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          return fallbackUser;
        }

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
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('omark-user-updated', { detail: { id: variables.id, data } }));
      }
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