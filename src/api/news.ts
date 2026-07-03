// src/api/news.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { erpClient } from './client';
import type { 
  NewsArticleEntity, 
  PaginationMeta 
} from '@/types/api';

export interface NewsFilter {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
  featured?: boolean;
}

export const useNewsQuery = (filter?: NewsFilter) => {
  return useQuery({
    queryKey: ['news', filter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filter) {
        if (filter.page !== undefined) params.append('page', String(filter.page));
        if (filter.limit !== undefined) params.append('limit', String(filter.limit));
        if (filter.search !== undefined) params.append('search', filter.search);
        if (filter.category !== undefined) params.append('category', filter.category);
        if (filter.featured !== undefined) params.append('featured', String(filter.featured));
      }
      
      const response = await erpClient.get<{
        success: boolean;
        data: { data: NewsArticleEntity[]; meta: PaginationMeta };
      }>(`/api/news?${params}`);
      
      const resData = (response as any).data || response;
      return resData.data;
    },
  });
};

export const useNewsArticleQuery = (id: number) => {
  return useQuery({
    queryKey: ['news', id],
    queryFn: async () => {
      const response = await erpClient.get<{ success: boolean; data: NewsArticleEntity }>(`/api/news/${id}`);
      const resData = (response as any).data || response;
      return resData.data;
    },
    enabled: !!id,
  });
};

export const useCreateNewsMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Omit<NewsArticleEntity, 'id' | 'views' | 'likes' | 'createdAt' | 'updatedAt'>) => {
      const response = await erpClient.post<{ success: boolean; data: NewsArticleEntity }>('/api/news', data);
      const resData = (response as any).data || response;
      return resData.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['news'] });
    },
  });
};

export const useUpdateNewsMutation = (id: number) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<Omit<NewsArticleEntity, 'id' | 'views' | 'likes' | 'createdAt' | 'updatedAt'>>) => {
      const response = await erpClient.put<{ success: boolean; data: NewsArticleEntity }>(`/api/news/${id}`, data);
      const resData = (response as any).data || response;
      return resData.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['news'] });
      queryClient.invalidateQueries({ queryKey: ['news', id] });
    },
  });
};

export const useDeleteNewsMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const response = await erpClient.delete<{ success: boolean }>(`/api/news/${id}`);
      return (response as any).data || response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['news'] });
    },
  });
};

export const useIncrementNewsViewsMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const response = await erpClient.post<{ success: boolean; views: number }>(`/api/news/${id}/view`);
      return (response as any).data || response;
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['news', id] });
    },
  });
};

export const useLikeNewsArticleMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const response = await erpClient.post<{ success: boolean; likes: number }>(`/api/news/${id}/like`);
      return (response as any).data || response;
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['news', id] });
    },
  });
};
