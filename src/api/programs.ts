// src/api/programs.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { erpClient } from './client';
import type { 
  ProgramEntity, 
  ProgramRegistrationEntity, 
  RegisterProgramDto 
} from '@/types/api';

export interface ProgramsFilter {
  category?: string;
  status?: string;
  featured?: boolean;
}

export const useProgramsQuery = (filter?: ProgramsFilter) => {
  return useQuery({
    queryKey: ['programs', filter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filter) {
        if (filter.category !== undefined) params.append('category', filter.category);
        if (filter.status !== undefined) params.append('status', filter.status);
        if (filter.featured !== undefined) params.append('featured', String(filter.featured));
      }
      
      const response = await erpClient.get<{ success: boolean; data: ProgramEntity[] }>(`/api/programs?${params}`);
      const resData = (response as any).data || response;
      return resData.data;
    },
  });
};

export const useProgramQuery = (id: number) => {
  return useQuery({
    queryKey: ['programs', id],
    queryFn: async () => {
      const response = await erpClient.get<{ success: boolean; data: ProgramEntity }>(`/api/programs/${id}`);
      const resData = (response as any).data || response;
      return resData.data;
    },
    enabled: !!id,
  });
};

export const useCreateProgramMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Omit<ProgramEntity, 'id' | 'currentRegistrations' | 'createdAt' | 'updatedAt'>) => {
      const response = await erpClient.post<{ success: boolean; data: ProgramEntity }>('/api/programs', data);
      const resData = (response as any).data || response;
      return resData.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['programs'] });
    },
  });
};

export const useUpdateProgramMutation = (id: number) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<Omit<ProgramEntity, 'id' | 'currentRegistrations' | 'createdAt' | 'updatedAt'>>) => {
      const response = await erpClient.put<{ success: boolean; data: ProgramEntity }>(`/api/programs/${id}`, data);
      const resData = (response as any).data || response;
      return resData.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['programs'] });
      queryClient.invalidateQueries({ queryKey: ['programs', id] });
    },
  });
};

export const useDeleteProgramMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const response = await erpClient.delete<{ success: boolean }>(`/api/programs/${id}`);
      return (response as any).data || response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['programs'] });
    },
  });
};

export const useRegisterForProgramMutation = (programId: number) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: RegisterProgramDto) => {
      const response = await erpClient.post<{ success: boolean; data: ProgramRegistrationEntity }>(`/api/programs/${programId}/register`, data);
      const resData = (response as any).data || response;
      return resData.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['programs', programId] });
      queryClient.invalidateQueries({ queryKey: ['programs', programId, 'registrations'] });
    },
  });
};

export const useProgramRegistrationsQuery = (programId: number) => {
  return useQuery({
    queryKey: ['programs', programId, 'registrations'],
    queryFn: async () => {
      const response = await erpClient.get<{ success: boolean; data: ProgramRegistrationEntity[] }>(`/api/programs/${programId}/registrations`);
      const resData = (response as any).data || response;
      return resData.data;
    },
    enabled: !!programId,
  });
};
