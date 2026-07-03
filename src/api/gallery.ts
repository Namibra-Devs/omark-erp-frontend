// src/api/gallery.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { erpClient } from './client';
import type { 
  GalleryItemEntity, 
  GalleryItemWithUrlDto, 
  BulkCreateGalleryDto, 
  PaginationMeta 
} from '@/types/api';

export interface GalleryFilter {
  page?: number;
  limit?: number;
  category?: string;
  tag?: string;
}

export const useGalleryQuery = (filter?: GalleryFilter) => {
  return useQuery({
    queryKey: ['gallery', filter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filter) {
        if (filter.page !== undefined) params.append('page', String(filter.page));
        if (filter.limit !== undefined) params.append('limit', String(filter.limit));
        if (filter.category !== undefined) params.append('category', filter.category);
        if (filter.tag !== undefined) params.append('tag', filter.tag);
      }
      
      const response = await erpClient.get<{
        success: boolean;
        data: { data: GalleryItemEntity[]; meta: PaginationMeta };
      }>(`/api/gallery?${params}`);
      
      const resData = (response as any).data || response;
      return resData.data;
    },
  });
};

export const useGalleryCategoriesQuery = () => {
  return useQuery({
    queryKey: ['gallery', 'categories'],
    queryFn: async () => {
      const response = await erpClient.get<{ success: boolean; data: string[] }>('/api/gallery/categories');
      const resData = (response as any).data || response;
      return resData.data;
    },
  });
};

export const useCreateGalleryItemMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: GalleryItemWithUrlDto) => {
      const response = await erpClient.post<{ success: boolean; data: GalleryItemEntity }>('/api/gallery', data);
      const resData = (response as any).data || response;
      return resData.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gallery'] });
    },
  });
};

export const useBulkCreateGalleryMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: BulkCreateGalleryDto) => {
      const response = await erpClient.post<{ success: boolean; data: GalleryItemEntity[] }>('/api/gallery/bulk', data);
      const resData = (response as any).data || response;
      return resData.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gallery'] });
    },
  });
};

export const useUpdateGalleryItemMutation = (id: number) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<GalleryItemWithUrlDto>) => {
      const response = await erpClient.put<{ success: boolean; data: GalleryItemEntity }>(`/api/gallery/${id}`, data);
      const resData = (response as any).data || response;
      return resData.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gallery'] });
    },
  });
};

export const useDeleteGalleryItemMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const response = await erpClient.delete<{ success: boolean }>(`/api/gallery/${id}`);
      return (response as any).data || response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gallery'] });
    },
  });
};
