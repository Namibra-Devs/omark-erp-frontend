// src/api/properties.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient, { unwrapData, unwrapList } from '@/api/client';
import { AxiosError } from 'axios';
import type { Property, ApiResponse } from '@/types';

export type { Property };

export interface PropertiesListParams {
  page?: number;
  pageSize?: number;
  q?: string;
}

export interface PropertiesListResult {
  items: Property[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CreatePropertyPayload {
  houseNumber: string;
  offerNumber: string;
  priceMinor: number;
  currency?: string;
  description?: string;
}

export interface UpdatePropertyPayload {
  houseNumber?: string;
  offerNumber?: string;
  priceMinor?: number;
  description?: string;
}

// --- Query Keys ---

export const propertyKeys = {
  all: ['properties'] as const,
  lists: () => [...propertyKeys.all, 'list'] as const,
  list: (params?: PropertiesListParams) => [...propertyKeys.lists(), params ?? {}] as const,
  details: () => [...propertyKeys.all, 'detail'] as const,
  detail: (id: string) => [...propertyKeys.details(), id] as const,
};

// --- Hooks ---

export const usePropertiesQuery = (params?: PropertiesListParams) => {
  return useQuery({
    queryKey: propertyKeys.list(params),
    queryFn: async () => {
      try {
        const response = await apiClient.get<ApiResponse<Property[]>>('/properties', { params });
        return unwrapList(response) as PropertiesListResult;
      } catch (error) {
        if (error instanceof AxiosError) {
          console.error('Error fetching properties:', {
            status: error.response?.status,
            message: error.response?.data?.message || error.message,
          });
        }
        throw error;
      }
    },
  });
};

export const usePropertyQuery = (id: string) => {
  return useQuery({
    queryKey: propertyKeys.detail(id),
    queryFn: async () => {
      try {
        const response = await apiClient.get<ApiResponse<Property & { customers?: unknown[] }>>(`/properties/${id}`);
        return unwrapData(response);
      } catch (error) {
        if (error instanceof AxiosError) {
          console.error(`Error fetching property ${id}:`, {
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

export const useCreatePropertyMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreatePropertyPayload) => {
      try {
        const response = await apiClient.post<ApiResponse<Property>>('/properties', payload);
        return unwrapData(response);
      } catch (error) {
        if (error instanceof AxiosError) {
          console.error('Error creating property:', {
            status: error.response?.status,
            message: error.response?.data?.message || error.message,
          });
        }
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: propertyKeys.all });
    },
  });
};

export const useUpdatePropertyMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: UpdatePropertyPayload }) => {
      try {
        const response = await apiClient.patch<ApiResponse<Property>>(`/properties/${id}`, payload);
        return unwrapData(response);
      } catch (error) {
        if (error instanceof AxiosError) {
          console.error('Error updating property:', {
            status: error.response?.status,
            message: error.response?.data?.message || error.message,
          });
        }
        throw error;
      }
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: propertyKeys.all });
      queryClient.invalidateQueries({ queryKey: propertyKeys.detail(variables.id) });
    },
  });
};

export const useDeletePropertyMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      try {
        await apiClient.delete(`/properties/${id}`);
        return id;
      } catch (error) {
        if (error instanceof AxiosError) {
          console.error('Error deleting property:', {
            status: error.response?.status,
            message: error.response?.data?.message || error.message,
          });
        }
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: propertyKeys.all });
    },
  });
};

// --- Utility Functions ---

export const formatPropertyPrice = (priceMinor: number, currency: string = 'GHS') => {
  return `${currency} ${(priceMinor / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

export const searchProperties = (properties: Property[], searchText: string) => {
  if (!searchText) return properties;
  const search = searchText.toLowerCase();
  return properties.filter(prop =>
    prop.houseNumber.toLowerCase().includes(search) ||
    prop.offerNumber.toLowerCase().includes(search) ||
    prop.description?.toLowerCase().includes(search)
  );
};

export const filterPropertiesByPrice = (properties: Property[], minPrice?: number, maxPrice?: number) => {
  return properties.filter(prop => {
    const price = prop.priceMinor;
    if (minPrice && price < minPrice) return false;
    if (maxPrice && price > maxPrice) return false;
    return true;
  });
};

export const getPropertyDisplayName = (property: Property): string => {
  return `${property.houseNumber} - ${property.offerNumber} (${formatPropertyPrice(property.priceMinor, property.currency)})`;
};

export const getPropertyShortName = (property: Property): string => {
  return property.houseNumber;
};

// --- Backward Compatibility (Deprecated) ---

/** @deprecated Use usePropertiesQuery instead */
export const useProperties = usePropertiesQuery;
/** @deprecated Use usePropertyQuery instead */
export const useProperty = usePropertyQuery;
/** @deprecated Use useCreatePropertyMutation instead */
export const useCreateProperty = useCreatePropertyMutation;
/** @deprecated Use useUpdatePropertyMutation instead */
export const useUpdateProperty = useUpdatePropertyMutation;
/** @deprecated Use useDeletePropertyMutation instead */
export const useDeleteProperty = useDeletePropertyMutation;
