// src/api/deeds.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/api/client';
import { AxiosError } from 'axios';

// --- Types ---

export type DeedStatus = 'draft' | 'generated' | 'signed' | 'registered';

export interface DeedEntity {
  id: string;
  customerId: string;
  customerName?: string;
  propertyId: string;
  planId?: string;
  status: DeedStatus;
  documentUrl?: string;
  generatedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Deed {
  id: string;
  customerId: string;
  propertyId: string;
  deedNumber?: string;
  witnesses?: Array<{ name: string; contact: string }>;
  businessContacts?: string;
  documentUrl?: string;
  generatedByUserId?: string;
  generatedBy?: string;
  generatedAt: string;
  status: DeedStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DeedsListParams {
  page?: number;
  limit?: number;
  status?: DeedStatus;
  customerId?: string;
  search?: string;
}

export interface DeedsListResponse {
  items: DeedEntity[];
  total: number;
  page: number;
  limit: number;
}

export interface GenerateDeedPayload {
  customerId: string;
  propertyId: string;
  planId?: string;
  witnesses?: Array<{ name: string; contact: string }>;
  businessContacts?: string;
  deedType?: string;
  notes?: string;
}

export interface DeedDocumentResponse {
  id: string;
  documentUrl: string;
  mimeType: string;
}

// --- Query Keys ---

export const deedsKeys = {
  all: ['deeds'] as const,
  lists: () => [...deedsKeys.all, 'list'] as const,
  list: (params?: DeedsListParams) => [...deedsKeys.lists(), params ?? {}] as const,
  details: () => [...deedsKeys.all, 'detail'] as const,
  detail: (id: string) => [...deedsKeys.details(), id] as const,
  document: (id: string) => [...deedsKeys.all, 'document', id] as const,
};

// --- Hooks ---

export function useDeedsQuery(params?: DeedsListParams) {
  return useQuery({
    queryKey: deedsKeys.list(params),
    queryFn: async () => {
      try {
        const res = await apiClient.get<DeedsListResponse>('/deeds', { params });
        
        const data = res.data;
        
        if (data && typeof data === 'object' && 'data' in data) {
          return (data as any).data as DeedsListResponse;
        }
        
        if (data && 'items' in data && 'total' in data) {
          return data as DeedsListResponse;
        }
        
        console.warn('Unexpected deeds response format:', data);
        return {
          items: [],
          total: 0,
          page: params?.page || 1,
          limit: params?.limit || 10,
        } as DeedsListResponse;
      } catch (error) {
        if (error instanceof AxiosError) {
          console.error('Error fetching deeds:', {
            status: error.response?.status,
            message: error.response?.data?.message || error.message,
          });
        }
        throw error;
      }
    },
  });
}

export function useDeedQuery(id: string | undefined) {
  return useQuery({
    queryKey: deedsKeys.detail(id ?? ''),
    queryFn: async () => {
      try {
        const res = await apiClient.get<Deed>(`/deeds/${id}`);
        
        const data = res.data;
        
        if (data && typeof data === 'object' && 'data' in data) {
          return (data as any).data as Deed;
        }
        
        return data as Deed;
      } catch (error) {
        if (error instanceof AxiosError) {
          console.error(`Error fetching deed ${id}:`, {
            status: error.response?.status,
            message: error.response?.data?.message || error.message,
          });
        }
        throw error;
      }
    },
    enabled: Boolean(id),
  });
}

export function useGenerateDeedMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: GenerateDeedPayload) => {
      try {
        const res = await apiClient.post<Deed>('/deeds', payload);
        
        const data = res.data;
        
        if (data && typeof data === 'object' && 'data' in data) {
          return (data as any).data as Deed;
        }
        
        return data as Deed;
      } catch (error) {
        if (error instanceof AxiosError) {
          console.error('Error generating deed:', {
            status: error.response?.status,
            message: error.response?.data?.message || error.message,
          });
        }
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: deedsKeys.lists() });
    },
  });
}

export function useDeleteDeedMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      try {
        await apiClient.delete(`/deeds/${id}`);
        return id;
      } catch (error) {
        if (error instanceof AxiosError) {
          console.error('Error deleting deed:', {
            status: error.response?.status,
            message: error.response?.data?.message || error.message,
          });
        }
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: deedsKeys.lists() });
    },
  });
}

export function useDeedDocumentQuery(id: string | undefined) {
  return useQuery({
    queryKey: deedsKeys.document(id ?? ''),
    queryFn: async () => {
      try {
        const res = await apiClient.get<DeedDocumentResponse>(`/deeds/${id}/document`);
        
        const data = res.data;
        
        if (data && typeof data === 'object' && 'data' in data) {
          return (data as any).data as DeedDocumentResponse;
        }
        
        return data as DeedDocumentResponse;
      } catch (error) {
        if (error instanceof AxiosError) {
          console.error(`Error fetching deed document ${id}:`, {
            status: error.response?.status,
            message: error.response?.data?.message || error.message,
          });
        }
        throw error;
      }
    },
    enabled: Boolean(id),
  });
}

// --- Utility Functions ---

/**
 * Download a deed PDF document
 * @param deedId - The ID of the deed to download
 * @param filename - Optional filename (defaults to deed-{deedId}.pdf)
 * @returns Promise that resolves when download is complete
 */
export async function downloadDeedPDF(deedId: string, filename?: string): Promise<Blob> {
  try {
    const response = await apiClient.get(`/deeds/${deedId}/document`, {
      responseType: 'blob',
    });
    
    return response.data as Blob;
  } catch (error) {
    if (error instanceof AxiosError) {
      console.error('Error downloading deed PDF:', {
        status: error.response?.status,
        message: error.response?.data?.message || error.message,
      });
    }
    throw error;
  }
}

/**
 * Download a deed PDF and trigger browser download
 * @param deedId - The ID of the deed to download
 * @param filename - Optional filename (defaults to deed-{deedId}.pdf)
 */
export async function downloadAndSaveDeedPDF(deedId: string, filename?: string): Promise<void> {
  try {
    const blob = await downloadDeedPDF(deedId);
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename || `deed-${deedId}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Error downloading and saving deed PDF:', error);
    throw error;
  }
}

/**
 * Get deed status configuration for UI display
 */
export const getDeedStatusConfig = (status: DeedStatus) => {
  const configs: Record<DeedStatus, { color: string; label: string; icon?: string }> = {
    draft: { color: 'default', label: 'Draft' },
    generated: { color: 'blue', label: 'Generated' },
    signed: { color: 'green', label: 'Signed' },
    registered: { color: 'purple', label: 'Registered' },
  };
  return configs[status] || configs.draft;
};

/**
 * Format deed number for display
 */
export const formatDeedNumber = (deedNumber?: string): string => {
  if (!deedNumber) return 'N/A';
  return deedNumber;
};

// --- Backward Compatibility (Deprecated) ---

/**
 * @deprecated Use useDeedsQuery instead
 */
export const useDeeds = useDeedsQuery;

/**
 * @deprecated Use useDeedQuery instead
 */
export const useDeed = useDeedQuery;

/**
 * @deprecated Use useGenerateDeedMutation instead
 */
export const useGenerateDeed = useGenerateDeedMutation;

/**
 * @deprecated Use useDeleteDeedMutation instead
 */
export const useDeleteDeed = useDeleteDeedMutation;

/**
 * @deprecated Use useDeedDocumentQuery instead
 */
export const useDeedDocument = useDeedDocumentQuery;