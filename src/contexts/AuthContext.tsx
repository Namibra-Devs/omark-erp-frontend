// src/contexts/AuthContext.tsx
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { App } from 'antd'; // Changed from 'message' to 'App'
import apiClient, { setTokens, clearTokens, getAccessToken, getRefreshToken } from '@/api/client';
import type { User } from '@/types';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  hasRole: (roles: string[]) => boolean;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();
  
  // Use Ant Design's context-safe messaging API
  const { message } = App.useApp();

  // ── Login ──────────────────────────────────────────────────────────────────
  const login = useCallback(async (email: string, password: string) => {
    try {
      setIsLoading(true);
      const response = await apiClient.post('/auth/login', { email, password });
      
      console.log('🔍 Login response raw data:', response.data);

      const responseData = response.data;
      
      // 1. Unpack the response container safely without mutating
      const dataContainer = responseData?.data || responseData;
      
      // 2. Extract tokens from all possible standard payload locations
      const accessToken = responseData?.accessToken || dataContainer?.accessToken || dataContainer?.token;
      const refreshToken = responseData?.refreshToken || dataContainer?.refreshToken;

      // 3. Safely target the user profile object
      const userData = dataContainer?.user || dataContainer;

      console.log('📤 Extracted validation profile:', { 
        id: userData?.id,
        firstName: userData?.firstName,
        lastName: userData?.lastName,
        email: userData?.email,
        role: userData?.role,
        hasAccessToken: !!accessToken,
        hasRefreshToken: !!refreshToken,
      });

      // Validate required fields
      if (!accessToken) {
        console.error('❌ No access token found in response wrappers:', responseData);
        throw new Error('No access token received from server');
      }

      if (!userData?.id || !userData?.email) {
        console.error('❌ User profile validation missing keys:', userData);
        throw new Error('Invalid user data received from server');
      }

      // Store tokens using the client's setTokens function
      setTokens(accessToken, refreshToken || '');

      // Build user object safely
      const userObj: User = {
        id: userData.id,
        firstName: userData.firstName || 'User',
        lastName: userData.lastName || '',
        email: userData.email,
        role: userData.role || 'admin',
        isActive: userData.isActive !== undefined ? userData.isActive : true,
        phoneNumber: userData.phoneNumber || userData.phone || '',
        createdAt: userData.createdAt || new Date().toISOString(),
        updatedAt: userData.updatedAt || new Date().toISOString(),
      };

      console.log('✅ User context authenticated successfully:', userObj);
      setUser(userObj);
      
      // Navigate based on role
      const role = userObj.role;
      const roleRoutes: Record<string, string> = {
        admin: '/admin/dashboard',
        marketing_director: '/marketing/overview',
        marketing_staff: '/marketing/prospects',
        customer_service: '/cs/prospects',
        secretary: '/dashboard',
        accounts: '/dashboard',
      };
      
      const redirectPath = roleRoutes[role] || '/dashboard';
      navigate(redirectPath);
      
      message.success(`Welcome ${userObj.firstName}!`);
    } catch (error: any) {
      console.error('❌ Login pipeline error:', error);
      const errorMessage = error?.response?.data?.message || error?.message || 'Login failed. Please try again.';
      message.error(errorMessage);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [navigate, message]);

  // ── Logout ─────────────────────────────────────────────────────────────────
  const logout = useCallback(() => {
    const refreshToken = getRefreshToken();
    // Best-effort server-side revocation — clear local state regardless of
    // whether this succeeds (e.g. token already expired).
    if (refreshToken) {
      apiClient.post('/auth/logout', { refreshToken }).catch(() => {});
    }
    clearTokens();
    setUser(null);
    navigate('/login');
    message.info('Logged out successfully');
  }, [navigate, message]);

  // ── Refresh User ──────────────────────────────────────────────────────────
  const refreshUser = useCallback(async () => {
    try {
      const token = getAccessToken();
      if (!token) {
        setUser(null);
        return;
      }

      const response = await apiClient.get('/auth/me');
      const responseData = response.data;
      
      const dataContainer = responseData.data || responseData;
      const userData = dataContainer.user || dataContainer;

      if (userData && userData.id) {
        const userObj: User = {
          id: userData.id,
          firstName: userData.firstName || 'User',
          lastName: userData.lastName || '',
          email: userData.email,
          role: userData.role || 'admin',
          isActive: userData.isActive !== undefined ? userData.isActive : true,
          phoneNumber: userData.phoneNumber || userData.phone || '',
          createdAt: userData.createdAt || new Date().toISOString(),
          updatedAt: userData.updatedAt || new Date().toISOString(),
        };
        setUser(userObj);
      }
    } catch (error) {
      console.error('Failed to refresh user:', error);
      if (error instanceof Error && (error as any).response?.status === 401) {
        logout();
      }
    }
  }, [logout]);

  // ── Check authentication on mount ────────────────────────────────────────
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = getAccessToken();
        if (!token) {
          setUser(null);
          setIsLoading(false);
          return;
        }

        await refreshUser();
      } catch (error) {
        console.error('Auth check failed:', error);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, [refreshUser]);

  // ── Has Role ──────────────────────────────────────────────────────────────
  const hasRole = useCallback((roles: string[]) => {
    if (!user) return false;
    return roles.includes(user.role);
  }, [user]);

  const value = useMemo(() => ({
    user,
    isLoading,
    login,
    logout,
    hasRole,
    refreshUser,
  }), [user, isLoading, login, logout, hasRole, refreshUser]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};