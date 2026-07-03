// src/api/projects.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { erpClient } from './client';
import type { 
  ProjectEntity, 
  ProjectGalleryImageEntity, 
  ProjectWithGalleryEntity, 
  PaginationMeta 
} from '@/types/api';

export interface ProjectsFilter {
  page?: number;
  limit?: number;
  search?: string;
  featured?: boolean;
  status?: 'Completed' | 'Ongoing' | 'Coming Soon';
  category?: 'Residential' | 'Commercial';
}

export const useProjectsQuery = (filter?: ProjectsFilter) => {
  return useQuery({
    queryKey: ['projects', filter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filter) {
        if (filter.page !== undefined) params.append('page', String(filter.page));
        if (filter.limit !== undefined) params.append('limit', String(filter.limit));
        if (filter.search !== undefined) params.append('search', filter.search);
        if (filter.featured !== undefined) params.append('featured', String(filter.featured));
        if (filter.status !== undefined) params.append('status', filter.status);
        if (filter.category !== undefined) params.append('category', filter.category);
      }
      
      const response = await erpClient.get<{
        success: boolean;
        data: { data: ProjectEntity[]; meta: PaginationMeta };
      }>(`/api/projects?${params}`);
      
      const resData = (response as any).data || response;
      return resData.data; // returns { data: ProjectEntity[], meta: PaginationMeta }
    },
  });
};

export const useProjectQuery = (id: number) => {
  return useQuery({
    queryKey: ['projects', id],
    queryFn: async () => {
      const response = await erpClient.get<{ success: boolean; data: ProjectWithGalleryEntity }>(`/api/projects/${id}`);
      const resData = (response as any).data || response;
      return resData.data;
    },
    enabled: !!id,
  });
};

export const useCreateProjectMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Omit<ProjectEntity, 'id' | 'createdAt' | 'updatedAt'>) => {
      const response = await erpClient.post<{ success: boolean; data: ProjectEntity }>('/api/projects', data);
      const resData = (response as any).data || response;
      return resData.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });
};

export const useUpdateProjectMutation = (id: number) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<Omit<ProjectEntity, 'id' | 'createdAt' | 'updatedAt'>>) => {
      const response = await erpClient.put<{ success: boolean; data: ProjectEntity }>(`/api/projects/${id}`, data);
      const resData = (response as any).data || response;
      return resData.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['projects', id] });
    },
  });
};

export const useDeleteProjectMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const response = await erpClient.delete<{ success: boolean }>(`/api/projects/${id}`);
      return (response as any).data || response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });
};

export const useProjectGalleryQuery = (id: number) => {
  return useQuery({
    queryKey: ['projects', id, 'gallery'],
    queryFn: async () => {
      const response = await erpClient.get<{ success: boolean; data: ProjectGalleryImageEntity[] }>(`/api/projects/${id}/gallery`);
      const resData = (response as any).data || response;
      return resData.data;
    },
    enabled: !!id,
  });
};

export const useAddProjectGalleryImageMutation = (projectId: number) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Omit<ProjectGalleryImageEntity, 'id' | 'projectId'>) => {
      const response = await erpClient.post<{ success: boolean; data: ProjectGalleryImageEntity }>(`/api/projects/${projectId}/gallery`, data);
      const resData = (response as any).data || response;
      return resData.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', projectId] });
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'gallery'] });
    },
  });
};

export const useDeleteProjectGalleryImageMutation = (projectId: number) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (imageId: number) => {
      const response = await erpClient.delete<{ success: boolean }>(`/api/projects/${projectId}/gallery/${imageId}`);
      return (response as any).data || response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', projectId] });
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'gallery'] });
    },
  });
};
