// src/lib/queryClient.ts
// Shared QueryClient with sensible defaults for the ERP.

import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2,       // 2 minutes
      gcTime: 1000 * 60 * 10,         // 10 minutes
      retry: (failureCount, error: unknown) => {
        // Don't retry on 4xx (client errors)
        const status = (error as { response?: { status: number } })?.response?.status;
        if (status && status >= 400 && status < 500) return false;
        return failureCount < 2;
      },
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: false,
    },
  },
});