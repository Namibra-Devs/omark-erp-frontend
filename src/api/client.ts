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

const addResponseInterceptor = (instance: AxiosInstance) => {
  instance.interceptors.response.use(
    (response) => {
      // Return the full axios response so that hooks can access response.data
      // Each API hook handles its own unwrapping of the server envelope
      return response;
    },
    async (error: AxiosError<any>) => {
      const originalRequest = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;

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
      const rawMsg =
        serverData?.error?.message ||
        (Array.isArray(serverData?.message) ? serverData.message.join(', ') : serverData?.message) ||
        (typeof serverData?.error === 'string' ? serverData.error : null) ||
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
  return {
    items,
    total: meta?.total ?? items.length,
    page: meta?.page ?? 1,
    pageSize: meta?.pageSize ?? items.length,
    totalPages: meta?.totalPages ?? 1,
  };
}

export default apiClient;