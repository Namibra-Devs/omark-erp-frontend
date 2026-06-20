// src/utils/navigation.ts
export const prospectRoutes = {
  // Marketing prospects
  list: '/marketing/prospects',
  detail: (id: string) => `/marketing/prospects/${id}`,
  overview: '/marketing/overview',
  
  // CS prospects
  csList: '/cs/prospects',
  csDetail: (id: string) => `/cs/prospects/${id}`,
};

// Usage in components:
// import { prospectRoutes } from '@/utils/navigation';
// navigate(prospectRoutes.list);
// navigate(prospectRoutes.detail('123e4567-e89b-12d3-a456-426614174000'));