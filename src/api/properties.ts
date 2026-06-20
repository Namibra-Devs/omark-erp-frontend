// src/api/properties.ts
import { useQuery } from '@tanstack/react-query';
import apiClient from './client';
import type { Property, ApiResponse } from '@/types';

export const useProperties = () => {
  return useQuery({
    queryKey: ['properties'],
    queryFn: async () => {
      const response = await apiClient.get<ApiResponse<Property[]>>('/properties');
      return response.data;
    },
  });
};