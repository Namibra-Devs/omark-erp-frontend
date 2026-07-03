// src/lib/tokenManager.ts
// Centralised token store.  All token reads/writes go through here.

import { ENV } from '@/config/env';

// ─── Storage helpers ────────────────────────────────────────────────────────

export const tokenManager = {
  getAccessToken(): string | null {
    return localStorage.getItem(ENV.ACCESS_TOKEN_KEY);
  },

  getRefreshToken(): string | null {
    return localStorage.getItem(ENV.REFRESH_TOKEN_KEY);
  },

  setTokens(accessToken: string, refreshToken: string): void {
    localStorage.setItem(ENV.ACCESS_TOKEN_KEY, accessToken);
    localStorage.setItem(ENV.REFRESH_TOKEN_KEY, refreshToken);
  },

  clearTokens(): void {
    localStorage.removeItem(ENV.ACCESS_TOKEN_KEY);
    localStorage.removeItem(ENV.REFRESH_TOKEN_KEY);
  },

  /** Decode the JWT payload without verifying the signature. */
  decodePayload(token: string): Record<string, unknown> | null {
    try {
      const base64Url = token.split('.')[1];
      if (!base64Url) return null;
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      return JSON.parse(atob(base64));
    } catch {
      return null;
    }
  },

  /** Return the token expiry as a Unix timestamp (seconds), or null. */
  getAccessTokenExpiry(): number | null {
    const token = this.getAccessToken();
    if (!token) return null;
    const payload = this.decodePayload(token);
    return typeof payload?.exp === 'number' ? payload.exp : null;
  },

  /** True if the access token is absent or expired (with buffer). */
  isAccessTokenExpired(): boolean {
    const exp = this.getAccessTokenExpiry();
    if (exp === null) return true;
    const bufferSec = ENV.TOKEN_REFRESH_BUFFER_MS / 1000;
    return Date.now() / 1000 >= exp - bufferSec;
  },
};