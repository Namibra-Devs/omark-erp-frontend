/// <reference types="vite/client" />
// src/api/client.ts
import axios, { AxiosError, AxiosInstance, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import type { ApiError, ApiResponse } from '@/types';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://api.erp.omarkrealestate.com';

let accessToken: string | null = localStorage.getItem('accessToken');
let refreshToken: string | null = localStorage.getItem('refreshToken');
let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];

// CRM legacy client pointing to /api/v1
const apiClient: AxiosInstance = axios.create({
  baseURL: `${BASE_URL}/api/v1`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ERP new client pointing to the base URL
export const erpClient: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

function subscribeTokenRefresh(cb: (token: string) => void) {
  refreshSubscribers.push(cb);
}

function onTokenRefreshed(token: string) {
  refreshSubscribers.forEach(cb => cb(token));
  refreshSubscribers = [];
}

const addAuthInterceptor = (instance: AxiosInstance) => {
  instance.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
      if (accessToken) {
        config.headers.Authorization = `Bearer ${accessToken}`;
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
    async (error: AxiosError<ApiError>) => {
      const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

      // Handle 401 - try refresh
      if (error.response?.status === 401 && !originalRequest._retry) {
        if (isRefreshing) {
          return new Promise((resolve) => {
            subscribeTokenRefresh((token: string) => {
              originalRequest.headers.Authorization = `Bearer ${token}`;
              resolve(instance(originalRequest));
            });
          });
        }

        originalRequest._retry = true;
        isRefreshing = true;

        try {
          if (!refreshToken) {
            throw new Error('No refresh token available');
          }
          // Request refresh from backend using standalone axios to avoid interceptor side effects
          const refreshRes = await axios.post(`${BASE_URL}/api/v1/auth/refresh`, { refreshToken });
          const newAccessToken = refreshRes.data.data.accessToken;
          const newRefreshToken = refreshRes.data.data.refreshToken;

          setTokens(newAccessToken, newRefreshToken);
          onTokenRefreshed(newAccessToken);

          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
          return instance(originalRequest);
        } catch (refreshError) {
          // Refresh failed — clear tokens and redirect to login
          clearTokens();
          window.location.href = '/login';
          return Promise.reject(refreshError);
        } finally {
          isRefreshing = false;
        }
      }

      // Transform error response
      const apiError: ApiError = {
        error: {
          code: error.response?.data?.error?.code || 'UNKNOWN_ERROR',
          message: error.response?.data?.error?.message || 'An unexpected error occurred',
          details: error.response?.data?.error?.details,
        },
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
  localStorage.setItem('accessToken', access);
  localStorage.setItem('refreshToken', refresh);
};

export const clearTokens = () => {
  accessToken = null;
  refreshToken = null;
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
};

export const getAccessToken = () => accessToken;
export const getRefreshToken = () => refreshToken;

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