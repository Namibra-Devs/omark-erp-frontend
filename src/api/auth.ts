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
  return useMutation({
    mutationFn: async (data: RegisterDto) => {
      const response = await erpClient.post<RegisterResponseEntity>('/api/auth/register', data);
      // Depending on whether it is wrapped:
      return (response as any).data || response;
    },
  });
};

export const useForgotPasswordMutation = () => {
  return useMutation({
    mutationFn: async (data: ForgotPasswordDto) => {
      const response = await erpClient.post<{ success: boolean; message: string }>('/api/auth/forgot-password', data);
      return (response as any).data || response;
    },
  });
};

export const useResetPasswordMutation = () => {
  return useMutation({
    mutationFn: async (data: ResetPasswordDto) => {
      const response = await erpClient.post<{ success: boolean; message: string }>('/api/auth/reset-password', data);
      return (response as any).data || response;
    },
  });
};

export const useMeQuery = (enabled = true) => {
  return useQuery({
    queryKey: ['auth', 'me'],
    queryFn: async () => {
      const response = await erpClient.get<{ success: boolean; data: UserEntity }>('/api/auth/me');
      return (response as any).data || response;
    },
    enabled,
  });
};

export const useUpdateMeMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: UpdateProfileDto) => {
      const response = await erpClient.put<{ success: boolean; data: UserEntity }>('/api/auth/me', data);
      return (response as any).data || response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
    },
  });
};
