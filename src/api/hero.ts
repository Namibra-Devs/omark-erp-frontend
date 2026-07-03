// src/api/hero.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { erpClient } from './client';
import type { HeroSlideEntity } from '@/types/api';

export const useHeroSlidesQuery = (includeInactive = false) => {
  return useQuery({
    queryKey: ['hero', { includeInactive }],
    queryFn: async () => {
      const response = await erpClient.get<{ success: boolean; data: HeroSlideEntity[] }>(
        `/api/hero?inactive=${includeInactive}`
      );
      const resData = (response as any).data || response;
      return resData.data;
    },
  });
};

export const useCreateHeroSlideMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Omit<HeroSlideEntity, 'id' | 'createdAt' | 'updatedAt'>) => {
      const response = await erpClient.post<{ success: boolean; data: HeroSlideEntity }>('/api/hero', data);
      const resData = (response as any).data || response;
      return resData.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hero'] });
    },
  });
};

export const useUpdateHeroSlideMutation = (id: number) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<Omit<HeroSlideEntity, 'id' | 'createdAt' | 'updatedAt'>>) => {
      const response = await erpClient.put<{ success: boolean; data: HeroSlideEntity }>(`/api/hero/${id}`, data);
      const resData = (response as any).data || response;
      return resData.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hero'] });
    },
  });
};

export const useDeleteHeroSlideMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const response = await erpClient.delete<{ success: boolean }>(`/api/hero/${id}`);
      return (response as any).data || response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hero'] });
    },
  });
};
