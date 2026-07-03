// src/api/events.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { erpClient } from './client';
import type { 
  EventEntity, 
  RegistrationEntity, 
  RegisterEventDto, 
  PaginationMeta 
} from '@/types/api';

export interface EventsFilter {
  page?: number;
  limit?: number;
  search?: string;
  featured?: boolean;
  status?: string;
  category?: string;
}

export const useEventsQuery = (filter?: EventsFilter) => {
  return useQuery({
    queryKey: ['events', filter],
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
        data: { data: EventEntity[]; meta: PaginationMeta };
      }>(`/api/events?${params}`);
      
      const resData = (response as any).data || response;
      return resData.data;
    },
  });
};

export const useUpcomingEventsQuery = () => {
  return useQuery({
    queryKey: ['events', 'upcoming'],
    queryFn: async () => {
      const response = await erpClient.get<{ success: boolean; data: EventEntity[] }>('/api/events/upcoming');
      const resData = (response as any).data || response;
      return resData.data;
    },
  });
};

export const useEventQuery = (id: number) => {
  return useQuery({
    queryKey: ['events', id],
    queryFn: async () => {
      const response = await erpClient.get<{ success: boolean; data: EventEntity }>(`/api/events/${id}`);
      const resData = (response as any).data || response;
      return resData.data;
    },
    enabled: !!id,
  });
};

export const useCreateEventMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Omit<EventEntity, 'id' | 'currentRegistrations' | 'createdAt' | 'updatedAt'>) => {
      const response = await erpClient.post<{ success: boolean; data: EventEntity }>('/api/events', data);
      const resData = (response as any).data || response;
      return resData.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
    },
  });
};

export const useUpdateEventMutation = (id: number) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<Omit<EventEntity, 'id' | 'currentRegistrations' | 'createdAt' | 'updatedAt'>>) => {
      const response = await erpClient.put<{ success: boolean; data: EventEntity }>(`/api/events/${id}`, data);
      const resData = (response as any).data || response;
      return resData.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['events', id] });
    },
  });
};

export const useDeleteEventMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const response = await erpClient.delete<{ success: boolean }>(`/api/events/${id}`);
      return (response as any).data || response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
    },
  });
};

export const useRegisterForEventMutation = (eventId: number) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: RegisterEventDto) => {
      const response = await erpClient.post<{ success: boolean; data: RegistrationEntity }>(`/api/events/${eventId}/register`, data);
      const resData = (response as any).data || response;
      return resData.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events', eventId] });
      queryClient.invalidateQueries({ queryKey: ['events', eventId, 'registrations'] });
    },
  });
};

export const useDeleteRegistrationMutation = (eventId?: number) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (registrationId: number) => {
      const response = await erpClient.delete<{ success: boolean }>(`/api/events/registrations/${registrationId}`);
      return (response as any).data || response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      if (eventId) {
        queryClient.invalidateQueries({ queryKey: ['events', eventId] });
        queryClient.invalidateQueries({ queryKey: ['events', eventId, 'registrations'] });
      }
    },
  });
};

export const useEventRegistrationsQuery = (eventId: number) => {
  return useQuery({
    queryKey: ['events', eventId, 'registrations'],
    queryFn: async () => {
      const response = await erpClient.get<{ success: boolean; data: RegistrationEntity[] }>(`/api/events/${eventId}/registrations`);
      const resData = (response as any).data || response;
      return resData.data;
    },
    enabled: !!eventId,
  });
};

// Hook that returns a trigger to download the CSV registrations file
export const useExportEventRegistrations = (eventId: number) => {
  return async () => {
    const response = await erpClient.get(`/api/events/${eventId}/registrations/export`, {
      responseType: 'blob',
    });
    // Triggers file download in browser
    const blob = new Blob([(response as any).data || response], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `event_${eventId}_registrations.csv`);
    document.body.appendChild(link);
    link.click();
    link.parentNode?.removeChild(link);
  };
};
