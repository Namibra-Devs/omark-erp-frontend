/// <reference types="vite/client" />
// src/api/client.ts
import axios, { AxiosError, AxiosInstance, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import type { ApiError, ApiResponse } from '@/types';

// An explicit VITE_API_BASE_URL always wins. Otherwise: local dev (`vite
// dev`) talks to the real backend directly — its CORS already allows
// http://localhost:3000. Any production build defaults to a *relative*
// base URL instead, so requests go through the same-origin proxy defined
// in netlify.toml (which forwards /api/* to the real backend server-side)
// rather than hitting the backend's CORS allow-list directly. This means
// no Netlify dashboard environment-variable configuration is needed at all.
const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? (import.meta.env.DEV ? 'https://api.erp.omarkrealestate.com' : '');

const REQUEST_TIMEOUT_MS = 20000;

interface RefreshSubscriber {
  resolve: (token: string) => void;
  reject: (error: any) => void;
}

let accessToken: string | null = localStorage.getItem('accessToken');
let refreshToken: string | null = localStorage.getItem('refreshToken');
let isRefreshing = false;
let refreshSubscribers: RefreshSubscriber[] = [];

// CRM legacy client pointing to /api/v1
const apiClient: AxiosInstance = axios.create({
  baseURL: `${BASE_URL}/api/v1`,
  timeout: REQUEST_TIMEOUT_MS,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ERP new client pointing to the base URL
export const erpClient: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: REQUEST_TIMEOUT_MS,
  headers: {
    'Content-Type': 'application/json',
  },
});

function subscribeTokenRefresh(resolve: (token: string) => void, reject: (error: any) => void) {
  refreshSubscribers.push({ resolve, reject });
}

function onTokenRefreshed(token: string) {
  refreshSubscribers.forEach((sub) => sub.resolve(token));
  refreshSubscribers = [];
}

function onTokenRefreshFailed(error: any) {
  refreshSubscribers.forEach((sub) => sub.reject(error));
  refreshSubscribers = [];
}

const addAuthInterceptor = (instance: AxiosInstance) => {
  instance.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
      const isPortalRoute = window.location.pathname.startsWith('/portal') || config.url?.includes('/portal/');
      const token = isPortalRoute ? localStorage.getItem('portal_token') : getAccessToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    },
    (error) => Promise.reject(error)
  );
};

addAuthInterceptor(apiClient);
addAuthInterceptor(erpClient);

interface CacheEntry {
  data: any;
  status: number;
  statusText: string;
  headers: any;
  timestamp: number;
}

const memoryGetCache = new Map<string, CacheEntry>();

const getCacheKey = (config: InternalAxiosRequestConfig): string => {
  const url = config.url || '';
  const params = config.params ? JSON.stringify(config.params) : '';
  return `${config.baseURL || ''}:${url}:${params}`;
};

export const clearClientCache = () => {
  memoryGetCache.clear();
};

const addResponseInterceptor = (instance: AxiosInstance) => {
  instance.interceptors.response.use(
    (response) => {
      // Store successful GET requests in memory cache for resilient 429 fallback
      if (response.config?.method?.toLowerCase() === 'get') {
        const cacheKey = getCacheKey(response.config);
        memoryGetCache.set(cacheKey, {
          data: response.data,
          status: response.status,
          statusText: response.statusText,
          headers: response.headers,
          timestamp: Date.now(),
        });
      } else if (['post', 'put', 'patch', 'delete'].includes(response.config?.method?.toLowerCase() || '')) {
        // Clear cached data on mutations to keep views fresh
        memoryGetCache.clear();
      }
      return response;
    },
    async (error: AxiosError<any>) => {
      const originalRequest = error.config as (InternalAxiosRequestConfig & { _retry?: boolean; _rateLimitRetryCount?: number }) | undefined;

      // Handle 401 for Customer Portal
      const isPortalRoute = window.location.pathname.startsWith('/portal') || originalRequest?.url?.includes('/portal/');
      const isAuthEndpoint =
        originalRequest?.url?.includes('/auth/login') ||
        originalRequest?.url?.includes('/auth/refresh') ||
        originalRequest?.url?.includes('/portal/auth');

      if (isPortalRoute && error.response?.status === 401 && !isAuthEndpoint) {
        localStorage.removeItem('portal_token');
        localStorage.removeItem('portal_customer_id');
        if (window.location.pathname !== '/portal/login') {
          window.location.href = '/portal/login';
        }
        return Promise.reject(error);
      }

      // Handle 401 for ERP Staff - try token refresh
      if (error.response?.status === 401 && originalRequest && !originalRequest._retry && !isAuthEndpoint && !isPortalRoute) {
        if (isRefreshing) {
          return new Promise((resolve, reject) => {
            subscribeTokenRefresh(
              (token: string) => {
                originalRequest.headers.Authorization = `Bearer ${token}`;
                resolve(instance(originalRequest));
              },
              (refreshErr: any) => {
                reject(refreshErr);
              }
            );
          });
        }

        originalRequest._retry = true;
        isRefreshing = true;

        try {
          const currentRefreshToken = getRefreshToken();
          if (!currentRefreshToken) {
            throw new Error('No refresh token available');
          }
          // Request refresh from backend using standalone axios to avoid interceptor side effects
          const refreshRes = await axios.post(`${BASE_URL}/api/v1/auth/refresh`, { refreshToken: currentRefreshToken });
          const newAccessToken = refreshRes.data?.data?.accessToken || refreshRes.data?.accessToken;
          const newRefreshToken = refreshRes.data?.data?.refreshToken || refreshRes.data?.refreshToken;

          if (!newAccessToken) {
            throw new Error('Refresh endpoint returned empty token');
          }

          setTokens(newAccessToken, newRefreshToken || currentRefreshToken);
          onTokenRefreshed(newAccessToken);

          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
          return instance(originalRequest);
        } catch (refreshError) {
          // Reject all queued requests so spinners do not hang forever
          onTokenRefreshFailed(refreshError);
          clearTokens();
          if (window.location.pathname !== '/login' && !window.location.pathname.startsWith('/portal/login')) {
            window.location.href = '/login';
          }
          return Promise.reject(refreshError);
        } finally {
          isRefreshing = false;
        }
      }

      // Extract comprehensive error details without dropping NestJS or Express error formats
      const serverData = error.response?.data as any;
      const status = error.response?.status;
      const isRateLimited = status === 429 || serverData?.error?.code === 'RATE_LIMITED';

      // ── Handle 429 Rate Limiting ─────────────────────────────────────────
      if (isRateLimited && originalRequest && !isAuthEndpoint) {
        // A. If this is a GET request, serve existing cached data immediately to keep ERP usable
        if (originalRequest.method?.toLowerCase() === 'get') {
          const cacheKey = getCacheKey(originalRequest);
          const cached = memoryGetCache.get(cacheKey);
          if (cached) {
            console.warn(
              `[Omark Rate Guard] 429 Rate limited for ${originalRequest.url}. Serving cached data from ${Math.round((Date.now() - cached.timestamp) / 1000)}s ago.`
            );
            return Promise.resolve({
              data: cached.data,
              status: cached.status,
              statusText: cached.statusText,
              headers: { ...cached.headers, 'x-omark-cache-fallback': 'true' },
              config: originalRequest,
            } as AxiosResponse);
          }
        }

        // B. Intelligent exponential backoff retry for essential requests
        const MAX_RATE_LIMIT_RETRIES = 3;
        const currentRetries = (originalRequest._rateLimitRetryCount as number) || 0;

        if (currentRetries < MAX_RATE_LIMIT_RETRIES) {
          originalRequest._rateLimitRetryCount = currentRetries + 1;

          // Parse retry headers from server if available
          const retryAfterHeader = error.response?.headers?.['retry-after'];
          const rateLimitResetHeader = error.response?.headers?.['ratelimit-reset'];

          let delayMs = 0;
          if (retryAfterHeader) {
            const parsed = parseInt(String(retryAfterHeader), 10);
            if (!isNaN(parsed) && parsed > 0) {
              delayMs = Math.min(parsed * 1000, 8000);
            }
          } else if (rateLimitResetHeader) {
            const parsed = parseInt(String(rateLimitResetHeader), 10);
            if (!isNaN(parsed) && parsed > 0) {
              delayMs = Math.min(parsed * 1000, 8000);
            }
          }

          if (!delayMs || delayMs <= 0) {
            const baseDelay = Math.pow(2, currentRetries) * 1000;
            const jitter = Math.random() * 500;
            delayMs = Math.min(baseDelay + jitter, 8000);
          } else {
            delayMs += Math.random() * 300;
          }

          console.warn(`[Omark API] Retrying rate-limited ${originalRequest.url} in ${Math.round(delayMs)}ms (attempt ${currentRetries + 1}/${MAX_RATE_LIMIT_RETRIES})`);
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          return instance(originalRequest);
        }
      }

      const rawMsg =
        serverData?.error?.message ||
        (Array.isArray(serverData?.message) ? serverData.message.join(', ') : serverData?.message) ||
        (typeof serverData?.error === 'string' ? serverData.error : null) ||
        (isRateLimited ? 'The system is experiencing high traffic. Please wait a moment and try again.' : null) ||
        error.message ||
        'An unexpected error occurred';

      const errorCode =
        serverData?.error?.code ||
        serverData?.code ||
        (error.response?.status ? `HTTP_${error.response.status}` : 'UNKNOWN_ERROR');

      // Construct a backward-compatible rich error object that matches ApiError,
      // while also carrying status, response, and standard Error fields so UI components
      // can inspect either err.response, err.error.message, or err.message
      const apiError: ApiError & { status?: number; response?: any; message: string } = {
        error: {
          code: errorCode,
          message: rawMsg,
          details: serverData?.error?.details || serverData?.details,
        },
        status: error.response?.status,
        response: error.response,
        message: rawMsg,
      };

      return Promise.reject(apiError);
    }
  );
};

addResponseInterceptor(apiClient);
addResponseInterceptor(erpClient);

export const setTokens = (access: string, refresh: string) => {
  accessToken = access;
  refreshToken = refresh;
  if (access) {
    localStorage.setItem('accessToken', access);
  }
  if (refresh) {
    localStorage.setItem('refreshToken', refresh);
  }
};

export const clearTokens = () => {
  accessToken = null;
  refreshToken = null;
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('portal_token');
};

export const getAccessToken = () => accessToken || localStorage.getItem('accessToken');
export const getRefreshToken = () => refreshToken || localStorage.getItem('refreshToken');

// The backend always wraps single-resource responses as { data: T } and
// paginated list responses as { data: T[], meta: PaginationMeta }.
export interface ListResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export function unwrapData<T>(response: AxiosResponse<ApiResponse<T>>): T {
  return response.data?.data as T;
}

export function unwrapList<T>(response: AxiosResponse<ApiResponse<T[]>>): ListResult<T> {
  const body = response.data;
  const items = Array.isArray(body?.data) ? body.data : [];
  const meta = body?.meta;
  const total = meta?.total ?? items.length;
  const pageSize = meta?.pageSize ?? items.length;
  const computedTotalPages = meta?.totalPages ?? (total && pageSize ? Math.ceil(total / pageSize) : 1);
  return {
    items,
    total,
    page: meta?.page ?? 1,
    pageSize,
    totalPages: computedTotalPages,
  };
}

export default apiClient;