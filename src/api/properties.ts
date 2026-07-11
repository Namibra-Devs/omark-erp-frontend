// src/api/properties.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/api/client';
import { AxiosError } from 'axios';

// --- Types ---

export interface Property {
  id: string;
  houseNumber: string;
  offerNumber: string;
  priceMinor: number;
  currency: string;
  description?: string;
  location?: string;
  bedrooms?: number;
  bathrooms?: number;
  area?: number;
  status?: 'available' | 'sold' | 'reserved' | 'construction';
  images?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface PropertiesListParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  minPrice?: number;
  maxPrice?: number;
}

export interface PropertiesListResponse {
  items: Property[];
  total: number;
  page: number;
  limit: number;
}

export interface CreatePropertyPayload {
  houseNumber: string;
  offerNumber: string;
  priceMinor: number;
  currency: string;
  description?: string;
  location?: string;
  bedrooms?: number;
  bathrooms?: number;
  area?: number;
  status?: string;
  images?: string[];
}

export interface UpdatePropertyPayload extends Partial<CreatePropertyPayload> {
  status?: string;
  images?: string[];
}

// --- Query Keys ---

export const propertyKeys = {
  all: ['properties'] as const,
  lists: () => [...propertyKeys.all, 'list'] as const,
  list: (params?: PropertiesListParams) => 
    [...propertyKeys.lists(), params ?? {}] as const,
  details: () => [...propertyKeys.all, 'detail'] as const,
  detail: (id: string) => [...propertyKeys.details(), id] as const,
};

// --- Hooks ---

/**
 * Get properties list with pagination and filters
 */
export const usePropertiesQuery = (params?: PropertiesListParams) => {
  return useQuery({
    queryKey: propertyKeys.list(params),
    queryFn: async () => {
      try {
        const response = await apiClient.get<PropertiesListResponse>('/properties', { 
          params 
        });
        
        // Handle both wrapped and unwrapped responses
        const data = response.data;
        
        if (data && typeof data === 'object' && 'data' in data) {
          return (data as any).data as PropertiesListResponse;
        }
        
        if (data && 'items' in data && 'total' in data) {
          return data as PropertiesListResponse;
        }
        
        // Fallback: return empty response
        console.warn('Unexpected properties response format:', data);
        return {
          items: [],
          total: 0,
          page: params?.page || 1,
          limit: params?.limit || 10,
        } as PropertiesListResponse;
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

/**
 * Get single property by ID
 */
export const usePropertyQuery = (id: string) => {
  return useQuery({
    queryKey: propertyKeys.detail(id),
    queryFn: async () => {
      try {
        const response = await apiClient.get<Property>(`/properties/${id}`);
        
        // Handle both wrapped and unwrapped responses
        const data = response.data;
        
        if (data && typeof data === 'object' && 'data' in data) {
          return (data as any).data as Property;
        }
        
        return data as Property;
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

/**
 * Create a new property
 */
export const useCreatePropertyMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreatePropertyPayload) => {
      try {
        const response = await apiClient.post<Property>('/properties', payload);
        
        const data = response.data;
        
        if (data && typeof data === 'object' && 'data' in data) {
          return (data as any).data as Property;
        }
        
        return data as Property;
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
      queryClient.invalidateQueries({ queryKey: propertyKeys.lists() });
      queryClient.invalidateQueries({ queryKey: propertyKeys.all });
    },
  });
};

/**
 * Update a property
 */
export const useUpdatePropertyMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      id, 
      payload 
    }: { 
      id: string; 
      payload: UpdatePropertyPayload 
    }) => {
      try {
        const response = await apiClient.patch<Property>(`/properties/${id}`, payload);
        
        const data = response.data;
        
        if (data && typeof data === 'object' && 'data' in data) {
          return (data as any).data as Property;
        }
        
        return data as Property;
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
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: propertyKeys.lists() });
      queryClient.invalidateQueries({ queryKey: propertyKeys.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: propertyKeys.all });
    },
  });
};

/**
 * Delete a property
 */
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
      queryClient.invalidateQueries({ queryKey: propertyKeys.lists() });
      queryClient.invalidateQueries({ queryKey: propertyKeys.all });
    },
  });
};

// --- Utility Functions ---

/**
 * Format property price for display
 */
export const formatPropertyPrice = (priceMinor: number, currency: string = 'GHS') => {
  return `${currency} ${(priceMinor / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

/**
 * Get property status config for UI display
 */
export const getPropertyStatusConfig = (status?: string) => {
  const configs: Record<string, { color: string; label: string }> = {
    available: { color: 'green', label: 'Available' },
    sold: { color: 'red', label: 'Sold' },
    reserved: { color: 'orange', label: 'Reserved' },
    construction: { color: 'blue', label: 'Under Construction' },
  };
  return configs[status || ''] || { color: 'default', label: status || 'Unknown' };
};

/**
 * Search properties by text
 */
export const searchProperties = (properties: Property[], searchText: string) => {
  if (!searchText) return properties;
  
  const search = searchText.toLowerCase();
  return properties.filter(prop => 
    prop.houseNumber.toLowerCase().includes(search) ||
    prop.offerNumber.toLowerCase().includes(search) ||
    prop.description?.toLowerCase().includes(search) ||
    prop.location?.toLowerCase().includes(search)
  );
};

/**
 * Filter properties by price range
 */
export const filterPropertiesByPrice = (
  properties: Property[], 
  minPrice?: number, 
  maxPrice?: number
) => {
  return properties.filter(prop => {
    const price = prop.priceMinor;
    if (minPrice && price < minPrice) return false;
    if (maxPrice && price > maxPrice) return false;
    return true;
  });
};

/**
 * Get property display name
 */
export const getPropertyDisplayName = (property: Property): string => {
  return `${property.houseNumber} - ${property.offerNumber} (${formatPropertyPrice(property.priceMinor, property.currency)})`;
};

/**
 * Get property short display name
 */
export const getPropertyShortName = (property: Property): string => {
  return `${property.houseNumber} (${property.location || 'N/A'})`;
};

// --- Backward Compatibility (Deprecated) ---

/**
 * @deprecated Use usePropertiesQuery instead
 */
export const useProperties = usePropertiesQuery;

/**
 * @deprecated Use usePropertyQuery instead
 */
export const useProperty = usePropertyQuery;

/**
 * @deprecated Use useCreatePropertyMutation instead
 */
export const useCreateProperty = useCreatePropertyMutation;

/**
 * @deprecated Use useUpdatePropertyMutation instead
 */
export const useUpdateProperty = useUpdatePropertyMutation;

/**
 * @deprecated Use useDeletePropertyMutation instead
 */
export const useDeleteProperty = useDeletePropertyMutation;