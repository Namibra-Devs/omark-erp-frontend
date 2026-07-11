// src/api/auth.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { erpClient } from './client';
import type { 
  RegisterDto, 
  RegisterResponseEntity, 
  ForgotPasswordDto, 
  ResetPasswordDto, 
  UpdateProfileDto, 
  UserEntity 
} from '@/types/api';

export const useRegisterMutation = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: RegisterDto) => {
      // Updated endpoint path to resolve the 404 route error
      const response = await erpClient.post<RegisterResponseEntity>('/api/v1/users', data);
      // Depending on whether it is wrapped:
      return (response as any).data || response;
    },
    onSuccess: () => {
      // Force recursive invalidation across all user sub-lists (filters, search, pagination)
      queryClient.invalidateQueries({
        queryKey: ['users'],
        exact: false,
      });
      queryClient.invalidateQueries({
        queryKey: ['staff'],
        exact: false,
      });
    },
  });
};

export const useForgotPasswordMutation = () => {
  return useMutation({
    mutationFn: async (data: ForgotPasswordDto) => {
      const response = await erpClient.post<{ success: boolean; message: string }>('/api/v1/auth/forgot-password', data);
      return (response as any).data || response;
    },
  });
};

export const useResetPasswordMutation = () => {
  return useMutation({
    mutationFn: async (data: ResetPasswordDto) => {
      const response = await erpClient.post<{ success: boolean; message: string }>('/api/v1/auth/reset-password', data);
      return (response as any).data || response;
    },
  });
};

export const useMeQuery = (enabled = true) => {
  return useQuery({
    queryKey: ['auth', 'me'],
    queryFn: async () => {
      const response = await erpClient.get<{ success: boolean; data: UserEntity }>('/api/v1/auth/me');
      return (response as any).data || response;
    },
    enabled,
  });
};

export const useUpdateMeMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: UpdateProfileDto) => {
      const response = await erpClient.put<{ success: boolean; data: UserEntity }>('/api/v1/auth/me', data);
      return (response as any).data || response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
    },
  });
};