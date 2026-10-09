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

interface CacheEntry {
  data: any;
  status: number;
  statusText: string;
  headers: any;
  timestamp: number;
}

const memoryGetCache = new Map<string, CacheEntry>();
const inFlightRequests = new Map<string, Promise<AxiosResponse>>();
const SESSION_CACHE_PREFIX = 'omark_cache_res:';

let globalRateLimitResetUntil = 0;

export const isGloballyRateLimited = () => Date.now() < globalRateLimitResetUntil;
export const getRateLimitSecondsRemaining = () =>
  Math.max(0, Math.ceil((globalRateLimitResetUntil - Date.now()) / 1000));

const getCacheKey = (config: InternalAxiosRequestConfig): string => {
  const url = config.url || '';
  const params = config.params ? JSON.stringify(config.params) : '';
  return `${config.baseURL || ''}:${url}:${params}`;
};

function saveToCache(key: string, entry: CacheEntry) {
  memoryGetCache.set(key, entry);
  try {
    const serialized = JSON.stringify(entry);
    // Keep individual entries under 500KB to stay safely within sessionStorage quota
    if (serialized.length < 500000) {
      sessionStorage.setItem(`${SESSION_CACHE_PREFIX}${key}`, serialized);
    }
  } catch {
    // sessionStorage quota exceeded or unavailable - in-memory cache still works
  }
}

function getFromCache(key: string): CacheEntry | null {
  const mem = memoryGetCache.get(key);
  if (mem) return mem;
  try {
    const raw = sessionStorage.getItem(`${SESSION_CACHE_PREFIX}${key}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      memoryGetCache.set(key, parsed);
      return parsed;
    }
  } catch {}
  return null;
}

export const clearClientCache = () => {
  memoryGetCache.clear();
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (k?.startsWith(SESSION_CACHE_PREFIX)) {
        keysToRemove.push(k);
      }
    }
    keysToRemove.forEach((k) => sessionStorage.removeItem(k));
  } catch {}
};

const addAuthAndRateGuardInterceptor = (instance: AxiosInstance) => {
  instance.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
      const isPortalRoute = window.location.pathname.startsWith('/portal') || config.url?.includes('/portal/');
      const token = isPortalRoute ? localStorage.getItem('portal_token') : getAccessToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }

      // Automatically clamp pageSize and limit to maximum allowed by backend (100) to prevent VALIDATION_ERROR
      if (config.params) {
        if (typeof config.params.pageSize === 'number' && config.params.pageSize > 100) {
          config.params.pageSize = 100;
        } else if (typeof config.params.pageSize === 'string' && Number(config.params.pageSize) > 100) {
          config.params.pageSize = 100;
        }
        if (typeof config.params.limit === 'number' && config.params.limit > 100) {
          config.params.limit = 100;
        } else if (typeof config.params.limit === 'string' && Number(config.params.limit) > 100) {
          config.params.limit = 100;
        }
      }

      // Only apply deduplication and rate-guard cache fallback to GET requests
      if (config.method?.toLowerCase() === 'get') {
        const cacheKey = getCacheKey(config);

        // 1. If currently under an active global rate limit lockout, serve cached data if available!
        if (isGloballyRateLimited()) {
          const cached = getFromCache(cacheKey);
          if (cached) {
            config.adapter = async () => ({
              data: cached.data,
              status: 200,
              statusText: 'OK',
              headers: { ...(cached.headers || {}), 'x-omark-cache-fallback': 'true' },
              config,
              request: {},
            });
            return config;
          }
        }

        // 2. In-flight request deduplication: if identical request is pending, reuse promise!
        const pending = inFlightRequests.get(cacheKey);
        if (pending) {
          config.adapter = () => pending;
          return config;
        }

        // 3. Intercept adapter to track the promise in inFlightRequests
        const baseAdapter =
          typeof config.adapter === 'function'
            ? config.adapter
            : (axios as any).getAdapter(config.adapter || instance.defaults.adapter || axios.defaults.adapter);

        if (typeof baseAdapter === 'function') {
          config.adapter = async (cfg) => {
            const promise = baseAdapter(cfg);
            inFlightRequests.set(cacheKey, promise);
            try {
              return await promise;
            } finally {
              inFlightRequests.delete(cacheKey);
            }
          };
        }
      }

      return config;
    },
    (error) => Promise.reject(error)
  );
};

addAuthAndRateGuardInterceptor(apiClient);
addAuthAndRateGuardInterceptor(erpClient);

const addResponseInterceptor = (instance: AxiosInstance) => {
  instance.interceptors.response.use(
    (response) => {
      // Store successful GET requests in persistent cache for resilient 429 fallback
      if (response.config?.method?.toLowerCase() === 'get') {
        const cacheKey = getCacheKey(response.config);
        saveToCache(cacheKey, {
          data: response.data,
          status: response.status,
          statusText: response.statusText,
          headers: response.headers,
          timestamp: Date.now(),
        });
      } else if (['post', 'put', 'patch', 'delete'].includes(response.config?.method?.toLowerCase() || '')) {
        // Invalidate matching keys and related queries
        const url = response.config?.url || '';
        const basePath = url.split('?')[0];
        if (basePath) {
          const isPaymentPlanMutation = basePath.includes('/payment-plans') || basePath.includes('/payments');
          for (const [key] of memoryGetCache.entries()) {
            if (
              key.includes(basePath) ||
              (isPaymentPlanMutation && (key.includes('/payment-plans') || key.includes('/customers') || key.includes('/dashboard')))
            ) {
              memoryGetCache.delete(key);
              try {
                sessionStorage.removeItem(`${SESSION_CACHE_PREFIX}${key}`);
              } catch {}
            }
          }
        }
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
        // Extract server-provided retry headers
        const retryAfterHeader = error.response?.headers?.['retry-after'];
        const rateLimitResetHeader = error.response?.headers?.['ratelimit-reset'];
        let resetSeconds = 60;
        if (retryAfterHeader && !isNaN(parseInt(String(retryAfterHeader), 10))) {
          resetSeconds = Math.max(parseInt(String(retryAfterHeader), 10), 1);
        } else if (rateLimitResetHeader && !isNaN(parseInt(String(rateLimitResetHeader), 10))) {
          resetSeconds = Math.max(parseInt(String(rateLimitResetHeader), 10), 1);
        }

        // Register global rate-limit lockout so subsequent requests don't hit the server
        globalRateLimitResetUntil = Math.max(globalRateLimitResetUntil, Date.now() + resetSeconds * 1000);
        window.dispatchEvent(
          new CustomEvent('omark-rate-limited', {
            detail: { seconds: resetSeconds, until: globalRateLimitResetUntil },
          })
        );

        // A. If this is a GET request, serve cached data immediately (from memory or sessionStorage)
        if (originalRequest.method?.toLowerCase() === 'get') {
          const cacheKey = getCacheKey(originalRequest);
          const cached = getFromCache(cacheKey);
          if (cached) {
            console.warn(
              `[Omark Rate Guard] 429 Rate limited for ${originalRequest.url}. Serving cached fallback from ${Math.round((Date.now() - cached.timestamp) / 1000)}s ago.`
            );
            return Promise.resolve({
              data: cached.data,
              status: 200,
              statusText: 'OK',
              headers: { ...(cached.headers || {}), 'x-omark-cache-fallback': 'true' },
              config: originalRequest,
            } as AxiosResponse);
          }
        }

        // B. For very short rate limit windows (<= 5s), allow a single retry with jitter
        const MAX_RATE_LIMIT_RETRIES = 1;
        const currentRetries = (originalRequest._rateLimitRetryCount as number) || 0;

        if (resetSeconds <= 5 && currentRetries < MAX_RATE_LIMIT_RETRIES) {
          originalRequest._rateLimitRetryCount = currentRetries + 1;
          const delayMs = resetSeconds * 1000 + Math.random() * 500;
          console.warn(`[Omark API] Retrying rate-limited ${originalRequest.url} in ${Math.round(delayMs)}ms (attempt ${currentRetries + 1}/${MAX_RATE_LIMIT_RETRIES})`);
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          return instance(originalRequest);
        }
      }

      // Extract specific validation details if available from NestJS, Express, or OpenAPI format
      const details = serverData?.error?.details || serverData?.details || serverData?.errors;
      let detailSummary = '';
      if (Array.isArray(details) && details.length > 0) {
        detailSummary = details
          .map((d: any) => {
            if (typeof d === 'string') return d;
            if (d?.field && d?.message) return `${d.field}: ${d.message}`;
            if (d?.message) return d.message;
            return JSON.stringify(d);
          })
          .filter(Boolean)
          .join(', ');
      } else if (details && typeof details === 'object') {
        detailSummary = Object.entries(details)
          .map(([key, val]) => `${key}: ${Array.isArray(val) ? val.join(', ') : String(val)}`)
          .join(', ');
      }

      const remainingSec = getRateLimitSecondsRemaining();
      const remainingMin = Math.ceil(remainingSec / 60);
      const rateLimitFallbackMsg =
        remainingSec > 60
          ? `Server rate limit reached. Normal requests will resume in ~${remainingMin} min. (Serving cached data where available)`
          : `Server rate limit reached. Normal requests will resume in ${remainingSec || 'a few'}s.`;

      let rawMsg =
        serverData?.error?.message ||
        (Array.isArray(serverData?.message) ? serverData.message.join(', ') : serverData?.message) ||
        (typeof serverData?.error === 'string' ? serverData.error : null) ||
        (isRateLimited ? rateLimitFallbackMsg : null) ||
        error.message ||
        'An unexpected error occurred';

      if (detailSummary && rawMsg && !rawMsg.includes(detailSummary)) {
        rawMsg = `${rawMsg} (${detailSummary})`;
      } else if (!rawMsg && detailSummary) {
        rawMsg = detailSummary;
      }

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
  const body = response?.data as any;
  let items: T[] = [];
  if (Array.isArray(body?.data)) {
    items = body.data;
  } else if (Array.isArray(body?.data?.items)) {
    items = body.data.items;
  } else if (Array.isArray(body?.items)) {
    items = body.items;
  } else if (Array.isArray(body)) {
    items = body;
  }

  const meta = body?.meta || body?.data?.meta;
  const total =
    meta?.total ??
    body?.total ??
    body?.data?.total ??
    items.length;
  const pageSize =
    meta?.pageSize ??
    body?.pageSize ??
    body?.data?.pageSize ??
    (items.length || 20);
  const page =
    meta?.page ??
    body?.page ??
    body?.data?.page ??
    1;
  const computedTotalPages =
    meta?.totalPages ??
    body?.totalPages ??
    body?.data?.totalPages ??
    (total && pageSize ? Math.ceil(total / pageSize) : 1);

  return {
    items,
    total,
    page,
    pageSize,
    totalPages: computedTotalPages,
  };
}

export default apiClient;