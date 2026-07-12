// src/api/prospects.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient, { unwrapData, unwrapList } from './client';
import { AxiosError } from 'axios';
import type { Prospect, Interaction, ApiResponse, ProspectSource, ProspectStatus, InteractionChannel, CustomerType } from '@/types';

export type { ProspectSource, ProspectStatus, InteractionChannel };

export interface ProspectsFilter {
  source?: ProspectSource;
  assignedUserId?: string;
  status?: ProspectStatus;
  q?: string;
  includeConverted?: boolean;
  page?: number;
  pageSize?: number;
  sortBy?: 'firstName' | 'lastName' | 'createdAt' | 'status';
  sortOrder?: 'asc' | 'desc';
}

export interface ProspectsListResult {
  items: Prospect[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CreateProspectPayload {
  firstName: string;
  lastName: string;
  address: string;
  phoneNumber: string;
  source: ProspectSource;
  assignedUserId?: string;
  reasonForContact?: string;
  notes?: string;
}

export interface CreatePlanPayload {
  totalAmountMinor: number;
  downPaymentMinor: number;
  planBasis: 'months' | 'monthly_amount';
  numMonths?: number;
  monthlyAmountMinor?: number;
  startDate: string;
}

export interface ConvertProspectPayload {
  customerType: CustomerType;
  propertyId: string;
  createPlan?: CreatePlanPayload;
}

export interface ConvertProspectResponse {
  id: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  address: string;
  type: CustomerType;
  propertyId: string;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateProspectPayload {
  firstName?: string;
  lastName?: string;
  address?: string;
  phoneNumber?: string;
  status?: ProspectStatus;
  reasonForContact?: string;
  notes?: string;
}

export interface LogInteractionPayload {
  channel: InteractionChannel;
  occurredAt: string;
  response: string;
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
        const response = await apiClient.get<ApiResponse<Prospect[]>>('/prospects', { params: filter });
        return unwrapList(response) as ProspectsListResult;
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
        const response = await apiClient.get<ApiResponse<Prospect & { interactions?: Interaction[] }>>(`/prospects/${id}`);
        return unwrapData(response);
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
        return unwrapList(response).items;
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
    mutationFn: async (data: CreateProspectPayload) => {
      try {
        const response = await apiClient.post<ApiResponse<Prospect>>('/prospects', data);
        return unwrapData(response);
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
        if (!id || id.trim() === '') {
          throw new Error('Prospect ID is required');
        }
        const response = await apiClient.patch<ApiResponse<Prospect>>(`/prospects/${id}`, data);
        return unwrapData(response);
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
        return unwrapData(response);
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
    }: { prospectId: string } & LogInteractionPayload) => {
      try {
        const response = await apiClient.post<ApiResponse<Interaction>>(
          `/prospects/${prospectId}/interactions`,
          data
        );
        return unwrapData(response);
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
      queryClient.invalidateQueries({ queryKey: prospectKeys.interactions(variables.prospectId) });
      queryClient.invalidateQueries({ queryKey: prospectKeys.detail(variables.prospectId) });
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
    marketing: { color: 'blue', label: 'Marketing' },
    customer_service: { color: 'cyan', label: 'Customer Service' },
  };
  return configs[source] || configs.marketing;
};

export const getInteractionChannelConfig = (channel: InteractionChannel) => {
  const configs: Record<InteractionChannel, { color: string; label: string }> = {
    call: { color: 'blue', label: 'Call' },
    sms: { color: 'purple', label: 'SMS' },
    whatsapp: { color: 'green', label: 'WhatsApp' },
    in_person: { color: 'gold', label: 'In Person' },
    email: { color: 'orange', label: 'Email' },
    social_media: { color: 'cyan', label: 'Social Media' },
    other: { color: 'default', label: 'Other' },
  };
  return configs[channel] || configs.other;
};

// --- Backward Compatibility (Deprecated) ---

/** @deprecated Use useProspectsQuery instead */
export const useProspects = useProspectsQuery;
/** @deprecated Use useProspectQuery instead */
export const useProspect = useProspectQuery;
/** @deprecated Use useCreateProspectMutation instead */
export const useCreateProspect = useCreateProspectMutation;
/** @deprecated Use useUpdateProspectMutation instead */
export const useUpdateProspect = useUpdateProspectMutation;
/** @deprecated Use useInteractionsQuery instead */
export const useInteractions = useInteractionsQuery;
