// src/api/deeds.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient, { unwrapData, unwrapList } from '@/api/client';
import { AxiosError } from 'axios';
import type { Deed, ApiResponse } from '@/types';

export type { Deed };

export interface DeedsListParams {
  page?: number;
  pageSize?: number;
  customerId?: string;
}

export interface DeedsListResult {
  items: Deed[];
  total: number;
  page: number;
  pageSize: number;
}

export interface GenerateDeedPayload {
  customerId: string;
  propertyId: string;
  witnesses: Array<{ name: string; contact: string }>;
  businessContacts: string;
}

// --- Query Keys ---

export const deedsKeys = {
  all: ['deeds'] as const,
  lists: () => [...deedsKeys.all, 'list'] as const,
  list: (params?: DeedsListParams) => [...deedsKeys.lists(), params ?? {}] as const,
  document: (id: string) => [...deedsKeys.all, 'document', id] as const,
};

// --- Hooks ---

export function useDeedsQuery(params?: DeedsListParams) {
  return useQuery({
    queryKey: deedsKeys.list(params),
    queryFn: async () => {
      try {
        const res = await apiClient.get<ApiResponse<Deed[]>>('/deeds', { params });
        return unwrapList(res) as DeedsListResult;
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

export function useGenerateDeedMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: GenerateDeedPayload) => {
      try {
        const res = await apiClient.post<ApiResponse<Deed>>('/deeds', payload);
        return unwrapData(res);
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

export function useDeedDocumentQuery(id: string | undefined) {
  return useQuery({
    queryKey: deedsKeys.document(id ?? ''),
    queryFn: async () => {
      try {
        const res = await apiClient.get<ApiResponse<{ id: string; documentUrl: string; mimeType?: string }>>(
          `/deeds/${id}/document`
        );
        return unwrapData(res);
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
 * Deed documents are hosted at an external documentUrl (e.g. S3) rather than
 * streamed through this API, so "download" just opens that URL.
 */
export async function downloadDeedPDF(deedId: string): Promise<string> {
  const res = await apiClient.get<ApiResponse<{ id: string; documentUrl: string }>>(`/deeds/${deedId}/document`);
  const data = unwrapData(res);
  if (!data?.documentUrl) {
    throw new Error('Deed document is not ready yet');
  }
  return data.documentUrl;
}

export async function downloadAndSaveDeedPDF(deedId: string): Promise<void> {
  const documentUrl = await downloadDeedPDF(deedId);
  window.open(documentUrl, '_blank', 'noopener,noreferrer');
}

export const formatDeedNumber = (deed: Deed): string => `#${deed.id.slice(0, 8).toUpperCase()}`;

// --- Backward Compatibility (Deprecated) ---

/** @deprecated Use useDeedsQuery instead */
export const useDeeds = useDeedsQuery;
/** @deprecated Use useGenerateDeedMutation instead */
export const useGenerateDeed = useGenerateDeedMutation;
/** @deprecated Use useDeedDocumentQuery instead */
export const useDeedDocument = useDeedDocumentQuery;
