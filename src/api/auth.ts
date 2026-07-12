// src/api/auth.ts
import { useMutation, useQuery } from '@tanstack/react-query';
import apiClient, { unwrapData, getRefreshToken } from './client';
import type { ApiResponse, User } from '@/types';

export const useMeQuery = (enabled = true) => {
  return useQuery({
    queryKey: ['auth', 'me'],
    queryFn: async () => {
      const response = await apiClient.get<ApiResponse<User>>('/auth/me');
      return unwrapData(response);
    },
    enabled,
  });
};

/**
 * POST /auth/logout — revokes the refresh token server-side.
 * Best-effort: the caller should clear local tokens and navigate away
 * regardless of whether this call succeeds (e.g. token already expired).
 */
export const useLogoutMutation = () => {
  return useMutation({
    mutationFn: async () => {
      const refreshToken = getRefreshToken();
      await apiClient.post('/auth/logout', refreshToken ? { refreshToken } : {});
    },
  });
};
