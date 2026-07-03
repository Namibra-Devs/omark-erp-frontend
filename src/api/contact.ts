// src/api/contact.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { erpClient } from './client';
import type { 
  ContactMessageEntity, 
  CreateContactDto, 
  UpdateContactStatusDto 
} from '@/types/api';

export const useCreateContactMessageMutation = () => {
  return useMutation({
    mutationFn: async (data: CreateContactDto) => {
      const response = await erpClient.post<{ success: boolean; data: ContactMessageEntity }>('/api/contact', data);
      const resData = (response as any).data || response;
      return resData.data;
    },
  });
};

export const useContactMessagesQuery = (status?: string) => {
  return useQuery({
    queryKey: ['contacts', { status }],
    queryFn: async () => {
      const url = status ? `/api/contacts?status=${status}` : '/api/contacts';
      const response = await erpClient.get<{ success: boolean; data: ContactMessageEntity[] }>(url);
      const resData = (response as any).data || response;
      return resData.data;
    },
  });
};

export const useUpdateContactMessageStatusMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: UpdateContactStatusDto }) => {
      const response = await erpClient.put<{ success: boolean; data: ContactMessageEntity }>(
        `/api/contacts/${id}/status`,
        data
      );
      const resData = (response as any).data || response;
      return resData.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
    },
  });
};

export const useDeleteContactMessageMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const response = await erpClient.delete<{ success: boolean }>(`/api/contacts/${id}`);
      return (response as any).data || response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
    },
  });
};
