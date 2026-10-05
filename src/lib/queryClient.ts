// src/lib/queryClient.ts
// Shared QueryClient with sensible defaults for the ERP.

import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,       // 5 minutes data freshness (prevents redundant fetches across navigation)
      gcTime: 1000 * 60 * 60,         // 60 minutes cache retention
      refetchOnWindowFocus: false,
      refetchOnMount: false,          // Don't refetch on component remount if data is within staleTime
      refetchIntervalInBackground: false, // Halt polling when tab is inactive/hidden
      refetchOnReconnect: 'always',
      retry: false, // Network-level retries and 429 backoff are handled by Axios client
    },
    mutations: {
      retry: false,
    },
  },
});