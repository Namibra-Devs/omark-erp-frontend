// src/contexts/AuthContext.tsx
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { message } from 'antd';
import apiClient, { setTokens, clearTokens, getAccessToken } from '@/api/client';
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

  // ── Login ──────────────────────────────────────────────────────────────────
  const login = useCallback(async (email: string, password: string) => {
    try {
      setIsLoading(true);
      const response = await apiClient.post('/auth/login', { email, password });
      
      console.log('🔍 Login response:', response.data);

      // Extract data from the response
      const responseData = response.data;
      
      // Check if we have a nested data object
      let userData = responseData.data || responseData;
      
      // If user is nested inside data.user
      if (userData.user) {
        userData = userData.user;
      }
      
      // Extract tokens - check both locations
      const accessToken = userData.accessToken || responseData.accessToken;
      const refreshToken = userData.refreshToken || responseData.refreshToken;
      const expiresIn = userData.expiresIn || responseData.expiresIn;

      console.log('📤 Extracted user data:', { 
        id: userData.id,
        firstName: userData.firstName,
        lastName: userData.lastName,
        email: userData.email,
        role: userData.role,
        hasAccessToken: !!accessToken,
        hasRefreshToken: !!refreshToken,
      });

      // Validate required fields
      if (!accessToken) {
        console.error('❌ No access token found in response:', responseData);
        throw new Error('No access token received from server');
      }

      if (!userData.id || !userData.email) {
        console.error('❌ User data missing required fields:', userData);
        throw new Error('Invalid user data received from server');
      }

      // Store tokens using the client's setTokens function
      setTokens(accessToken, refreshToken || '');

      // Build user object
      const userObj: User = {
        id: userData.id,
        firstName: userData.firstName || 'User',
        lastName: userData.lastName || '',
        email: userData.email,
        role: userData.role || 'admin',
        isActive: userData.isActive !== undefined ? userData.isActive : true,
        phone: userData.phoneNumber || userData.phone || '',
        createdAt: userData.createdAt || new Date().toISOString(),
        updatedAt: userData.updatedAt || new Date().toISOString(),
      };

      console.log('✅ User logged in:', userObj);
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
      console.error('❌ Login error:', error);
      const errorMessage = error?.error?.message || error?.message || 'Login failed. Please try again.';
      message.error(errorMessage);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [navigate]);

  // ── Logout ─────────────────────────────────────────────────────────────────
  const logout = useCallback(() => {
    clearTokens();
    setUser(null);
    navigate('/login');
    message.info('Logged out successfully');
  }, [navigate]);

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
      
      // Handle nested response
      let userData = responseData.data || responseData;
      
      if (userData.user) {
        userData = userData.user;
      }

      if (userData && userData.id) {
        const userObj: User = {
          id: userData.id,
          firstName: userData.firstName || 'User',
          lastName: userData.lastName || '',
          email: userData.email,
          role: userData.role || 'admin',
          isActive: userData.isActive !== undefined ? userData.isActive : true,
          phone: userData.phoneNumber || userData.phone || '',
          createdAt: userData.createdAt || new Date().toISOString(),
          updatedAt: userData.updatedAt || new Date().toISOString(),
        };
        setUser(userObj);
      }
    } catch (error) {
      console.error('Failed to refresh user:', error);
      // If token is invalid, log out
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