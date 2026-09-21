// src/lib/queryClient.ts
// Shared QueryClient with sensible defaults for the ERP.

import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 3,       // 3 minutes data freshness
      gcTime: 1000 * 60 * 15,         // 15 minutes cache retention
      retry: (failureCount, error: unknown) => {
        // Axios interceptor already handles 429 retries with backoff.
        // Don't retry on other 4xx client errors (400, 401, 403, 404).
        const status =
          (error as { status?: number })?.status ||
          (error as { response?: { status: number } })?.response?.status;
        if (status && status >= 400 && status < 500) return false;
        return failureCount < 2;
      },
      refetchOnWindowFocus: false,
      refetchIntervalInBackground: false, // Stop query polling when browser tab is inactive/hidden
      refetchOnReconnect: 'always',
    },
    mutations: {
      retry: false,
    },
  },
});