// src/api/prospects.ts
import { useQuery, useMutation, useQueryClient, UseQueryOptions } from '@tanstack/react-query';
import apiClient from './client';
import { AxiosError } from 'axios';
import type { Prospect, Interaction, ApiResponse } from '@/types';

// --- Types ---

export type ProspectStatus = 
  | 'new' 
  | 'meeting_scheduled' 
  | 'meeting_completed' 
  | 'suspended' 
  | 'postponed' 
  | 'canceled' 
  | 'purchased';

export type ProspectSource = 
  | 'website' 
  | 'referral' 
  | 'social_media' 
  | 'call' 
  | 'email' 
  | 'walk_in' 
  | 'other';

export type InteractionChannel = 
  | 'call' 
  | 'email' 
  | 'whatsapp' 
  | 'sms' 
  | 'in_person' 
  | 'social_media' 
  | 'other';

export interface ProspectsFilter {
  source?: 'marketing' | 'customer_service';
  assignedUserId?: string;
  status?: ProspectStatus | string;
  q?: string;
  page?: number;
  pageSize?: number;
}

export interface ConvertProspectPayload {
  type: 'fully_paid' | 'payment_plan';
  propertyId: string;
  plan?: {
    totalAmountMinor: number;
    downPaymentMinor: number;
    numMonths: number;
    startDate: string;
  };
}

export interface ConvertProspectResponse {
  id: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  email?: string;
  address: string;
  type: 'fully_paid' | 'payment_plan';
  propertyId: string;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateProspectPayload {
  firstName?: string;
  lastName?: string;
  address?: string;
  phoneNumber?: string;
  email?: string;
  status?: ProspectStatus;
  reasonForContact?: string;
  notes?: string;
  source?: ProspectSource;
  assignedUserId?: string;
}

// --- Query Keys ---

export const prospectKeys = {
  all: ['prospects'] as const,
  lists: () => [...prospectKeys.all, 'list'] as const,
  list: (filter?: ProspectsFilter) => [...prospectKeys.lists(), filter ?? {}] as const,
  details: () => [...prospectKeys.all, 'detail'] as const,
  detail: (id: string) => [...prospectKeys.details(), id] as const,
  interactions: (id: string) => [...prospectKeys.detail(id), 'interactions'] as const,
};

// --- Prospect Queries ---

export const useProspectsQuery = (filter?: ProspectsFilter) => {
  return useQuery({
    queryKey: prospectKeys.list(filter),
    queryFn: async () => {
      try {
        const params = new URLSearchParams();
        if (filter?.source) params.append('source', filter.source);
        if (filter?.assignedUserId) params.append('assignedUserId', filter.assignedUserId);
        if (filter?.status) params.append('status', filter.status);
        if (filter?.q) params.append('q', filter.q);
        if (filter?.page) params.append('page', String(filter.page));
        if (filter?.pageSize) params.append('pageSize', String(filter.pageSize));
        
        const response = await apiClient.get<ApiResponse<Prospect[]>>(`/prospects?${params}`);
        
        // Handle both wrapped and unwrapped responses
        const data = response.data;
        
        if (data && typeof data === 'object' && 'data' in data) {
          return (data as any).data as Prospect[];
        }
        
        if (Array.isArray(data)) {
          return data as Prospect[];
        }
        
        console.warn('Unexpected prospects response format:', data);
        return [];
      } catch (error) {
        if (error instanceof AxiosError) {
          console.error('Error fetching prospects:', {
            status: error.response?.status,
            message: error.response?.data?.message || error.message,
          });
        }
        throw error;
      }
    },
  });
};

export const useProspectQuery = (id: string) => {
  return useQuery({
    queryKey: prospectKeys.detail(id),
    queryFn: async () => {
      try {
        const response = await apiClient.get<ApiResponse<Prospect>>(`/prospects/${id}`);
        
        const data = response.data;
        
        if (data && typeof data === 'object' && 'data' in data) {
          return (data as any).data as Prospect;
        }
        
        return data as Prospect;
      } catch (error) {
        if (error instanceof AxiosError) {
          console.error(`Error fetching prospect ${id}:`, {
            status: error.response?.status,
            message: error.response?.data?.message || error.message,
          });
        }
        throw error;
      }
    },
    enabled: !!id,
  });
};

// --- Interaction Queries ---

export const useInteractionsQuery = (prospectId: string) => {
  return useQuery({
    queryKey: prospectKeys.interactions(prospectId),
    queryFn: async () => {
      try {
        const response = await apiClient.get<ApiResponse<Interaction[]>>(`/prospects/${prospectId}/interactions`);
        
        const data = response.data;
        
        if (data && typeof data === 'object' && 'data' in data) {
          return (data as any).data as Interaction[];
        }
        
        if (Array.isArray(data)) {
          return data as Interaction[];
        }
        
        console.warn('Unexpected interactions response format:', data);
        return [];
      } catch (error) {
        if (error instanceof AxiosError) {
          console.error(`Error fetching interactions for prospect ${prospectId}:`, {
            status: error.response?.status,
            message: error.response?.data?.message || error.message,
          });
        }
        throw error;
      }
    },
    enabled: !!prospectId,
  });
};

// --- Prospect Mutations ---

export const useCreateProspectMutation = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: Partial<Prospect>) => {
      try {
        const response = await apiClient.post<ApiResponse<Prospect>>('/prospects', data);
        
        const result = response.data;
        
        if (result && typeof result === 'object' && 'data' in result) {
          return (result as any).data as Prospect;
        }
        
        return result as Prospect;
      } catch (error) {
        if (error instanceof AxiosError) {
          console.error('Error creating prospect:', {
            status: error.response?.status,
            message: error.response?.data?.message || error.message,
          });
        }
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: prospectKeys.lists() });
    },
  });
};

export const useUpdateProspectMutation = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateProspectPayload }) => {
      try {
        // Validate ID
        if (!id || id.trim() === '') {
          throw new Error('Prospect ID is required');
        }

        console.log('📤 Updating prospect with ID:', id);
        console.log('📤 Update data:', data);

        // The ID should only be in the URL path, not in the body
        const response = await apiClient.patch<ApiResponse<Prospect>>(`/prospects/${id}`, data);
        
        const result = response.data;
        
        if (result && typeof result === 'object' && 'data' in result) {
          return (result as any).data as Prospect;
        }
        
        return result as Prospect;
      } catch (error) {
        if (error instanceof AxiosError) {
          console.error('Error updating prospect:', {
            status: error.response?.status,
            message: error.response?.data?.message || error.message,
            data: error.response?.data,
          });
        }
        throw error;
      }
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: prospectKeys.lists() });
      queryClient.invalidateQueries({ queryKey: prospectKeys.detail(variables.id) });
    },
  });
};

export const useDeleteProspectMutation = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      try {
        await apiClient.delete(`/prospects/${id}`);
        return id;
      } catch (error) {
        if (error instanceof AxiosError) {
          console.error('Error deleting prospect:', {
            status: error.response?.status,
            message: error.response?.data?.message || error.message,
          });
        }
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: prospectKeys.lists() });
    },
  });
};

// --- Convert Prospect Mutation ---

export const useConvertProspectMutation = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      prospectId, 
      ...data 
    }: { prospectId: string } & ConvertProspectPayload) => {
      try {
        const response = await apiClient.post<ApiResponse<ConvertProspectResponse>>(
          `/prospects/${prospectId}/convert`,
          data
        );
        
        const result = response.data;
        
        if (result && typeof result === 'object' && 'data' in result) {
          return (result as any).data as ConvertProspectResponse;
        }
        
        return result as ConvertProspectResponse;
      } catch (error) {
        if (error instanceof AxiosError) {
          console.error('Error converting prospect:', {
            status: error.response?.status,
            message: error.response?.data?.message || error.message,
          });
        }
        throw error;
      }
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: prospectKeys.lists() });
      queryClient.invalidateQueries({ queryKey: prospectKeys.detail(variables.prospectId) });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['customers', 'list'] });
    },
  });
};

// --- Interaction Mutations ---

export const useLogInteractionMutation = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      prospectId, 
      ...data 
    }: { prospectId: string; channel: InteractionChannel; occurredAt: string; response: string; loggedByUserId: string }) => {
      try {
        const response = await apiClient.post<ApiResponse<Interaction>>(
          `/prospects/${prospectId}/interactions`,
          data
        );
        
        const result = response.data;
        
        if (result && typeof result === 'object' && 'data' in result) {
          return (result as any).data as Interaction;
        }
        
        return result as Interaction;
      } catch (error) {
        if (error instanceof AxiosError) {
          console.error('Error logging interaction:', {
            status: error.response?.status,
            message: error.response?.data?.message || error.message,
          });
        }
        throw error;
      }
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ 
        queryKey: prospectKeys.interactions(variables.prospectId) 
      });
      queryClient.invalidateQueries({ 
        queryKey: prospectKeys.detail(variables.prospectId) 
      });
    },
  });
};

// --- Utility Functions ---

export const getProspectStatusConfig = (status: ProspectStatus) => {
  const configs: Record<ProspectStatus, { color: string; label: string }> = {
    new: { color: 'processing', label: 'New' },
    meeting_scheduled: { color: 'warning', label: 'Meeting Scheduled' },
    meeting_completed: { color: 'success', label: 'Meeting Completed' },
    suspended: { color: 'error', label: 'Suspended' },
    postponed: { color: 'warning', label: 'Postponed' },
    canceled: { color: 'error', label: 'Canceled' },
    purchased: { color: 'success', label: 'Purchased' },
  };
  return configs[status] || configs.new;
};

export const getProspectSourceConfig = (source: ProspectSource) => {
  const configs: Record<ProspectSource, { color: string; label: string }> = {
    website: { color: 'blue', label: 'Website' },
    referral: { color: 'green', label: 'Referral' },
    social_media: { color: 'purple', label: 'Social Media' },
    call: { color: 'cyan', label: 'Call' },
    email: { color: 'orange', label: 'Email' },
    walk_in: { color: 'gold', label: 'Walk-in' },
    other: { color: 'default', label: 'Other' },
  };
  return configs[source] || configs.other;
};

export const getInteractionChannelConfig = (channel: InteractionChannel) => {
  const configs: Record<InteractionChannel, { color: string; label: string }> = {
    call: { color: 'blue', label: 'Call' },
    email: { color: 'orange', label: 'Email' },
    whatsapp: { color: 'green', label: 'WhatsApp' },
    sms: { color: 'purple', label: 'SMS' },
    in_person: { color: 'gold', label: 'In Person' },
    social_media: { color: 'cyan', label: 'Social Media' },
    other: { color: 'default', label: 'Other' },
  };
  return configs[channel] || configs.other;
};

// --- Backward Compatibility (Deprecated) ---

/**
 * @deprecated Use useProspectsQuery instead
 */
export const useProspects = useProspectsQuery;

/**
 * @deprecated Use useProspectQuery instead
 */
export const useProspect = useProspectQuery;

/**
 * @deprecated Use useCreateProspectMutation instead
 */
export const useCreateProspect = useCreateProspectMutation;

/**
 * @deprecated Use useUpdateProspectMutation instead
 */
export const useUpdateProspect = useUpdateProspectMutation;

/**
 * @deprecated Use useConvertProspectMutation instead
 */
export const useConvertProspect = (prospectId: string) => {
  const mutation = useConvertProspectMutation();
  
  return {
    mutateAsync: async (data: ConvertProspectPayload) => {
      return mutation.mutateAsync({ prospectId, ...data });
    },
    mutate: (data: ConvertProspectPayload, options?: any) => {
      return mutation.mutate({ prospectId, ...data }, options);
    },
    isPending: mutation.isPending,
    isError: mutation.isError,
    isSuccess: mutation.isSuccess,
    error: mutation.error,
    data: mutation.data,
    reset: mutation.reset,
  };
};

/**
 * @deprecated Use useInteractionsQuery instead
 */
export const useInteractions = useInteractionsQuery;

/**
 * @deprecated Use useLogInteractionMutation instead
 */
export const useLogInteraction = (prospectId: string) => {
  const mutation = useLogInteractionMutation();
  
  return {
    mutateAsync: async (data: Omit<Parameters<typeof mutation.mutateAsync>[0], 'prospectId'>) => {
      return mutation.mutateAsync({ prospectId, ...data });
    },
    mutate: (data: Omit<Parameters<typeof mutation.mutate>[0], 'prospectId'>, options?: any) => {
      return mutation.mutate({ prospectId, ...data }, options);
    },
    isPending: mutation.isPending,
    isError: mutation.isError,
    isSuccess: mutation.isSuccess,
    error: mutation.error,
    data: mutation.data,
    reset: mutation.reset,
  };
};