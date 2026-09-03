// src/contexts/AuthContext.tsx
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { App } from 'antd'; // Changed from 'message' to 'App'
import apiClient, { setTokens, clearTokens, getAccessToken, getRefreshToken } from '@/api/client';
import { getStaffAssignment, setStaffAssignment } from '@/mock/staffAssignments';
import { getEntityPhoto } from '@/utils/userPhotoStorage';
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

  // ── Listen for real-time avatar changes globally ─────────────────────────
  useEffect(() => {
    const handleAvatarChange = (e: Event) => {
      const customEvent = e as CustomEvent<{ entityType: string; entityId: string; photoUrl: string | undefined }>;
      if (customEvent.detail && user && customEvent.detail.entityId === user.id) {
        setUser((prev) => prev ? { ...prev, avatarUrl: customEvent.detail.photoUrl, photoUrl: customEvent.detail.photoUrl } : null);
      }
    };
    window.addEventListener('omark-avatar-changed', handleAvatarChange);
    return () => {
      window.removeEventListener('omark-avatar-changed', handleAvatarChange);
    };
  }, [user]);

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

      // Retrieve local or server assignment
      const localAssign = getStaffAssignment(userData.id);
      const branchId = userData.branchId || userData.branch || localAssign?.branchId;
      const departmentId = userData.departmentId || userData.department || localAssign?.departmentId;

      if (branchId || departmentId) {
        setStaffAssignment(userData.id, { branchId, departmentId });
      }

      const storedAvatar = getEntityPhoto('staff', userData.id) || getEntityPhoto('user', userData.id);

      // Build user object safely
      const userObj: User = {
        id: userData.id,
        firstName: userData.firstName || 'User',
        lastName: userData.lastName || '',
        name: userData.name || `${userData.firstName || ''} ${userData.lastName || ''}`.trim() || undefined,
        email: userData.email,
        role: userData.role || 'admin',
        isActive: userData.isActive !== undefined ? userData.isActive : true,
        phoneNumber: userData.phoneNumber || userData.phone || '',
        branchId,
        branch: userData.branch || branchId,
        departmentId,
        department: userData.department || departmentId,
        avatarUrl: userData.avatarUrl || userData.photoUrl || storedAvatar,
        photoUrl: userData.photoUrl || userData.avatarUrl || storedAvatar,
        createdAt: userData.createdAt || new Date().toISOString(),
        updatedAt: userData.updatedAt || new Date().toISOString(),
      };

      console.log('✅ User context authenticated successfully:', userObj);
      setUser(userObj);

      // Async fetch server assignment in background if available
      apiClient.get(`/users/${userData.id}/assignment`).then((res) => {
        const assign = res.data?.data || res.data;
        if (assign?.branchId || assign?.departmentId) {
          setStaffAssignment(userData.id, { branchId: assign.branchId, departmentId: assign.departmentId });
          setUser((prev) => prev ? {
            ...prev,
            branchId: assign.branchId || prev.branchId,
            branch: assign.branchName || prev.branch,
            departmentId: assign.departmentId || prev.departmentId,
            department: assign.departmentName || prev.department,
          } : null);
        }
      }).catch(() => {});
      
      // Navigate based on role
      const role = userObj.role;
      const roleRoutes: Record<string, string> = {
        admin: '/admin/dashboard',
        marketing_director: '/marketing/overview',
        marketing_staff: '/marketing/prospects',
        customer_service: '/cs/prospects',
        secretary: '/dashboard',
        accounts: '/accounts/dashboard',
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
        const localAssign = getStaffAssignment(userData.id);
        const branchId = userData.branchId || userData.branch || localAssign?.branchId;
        const departmentId = userData.departmentId || userData.department || localAssign?.departmentId;

        if (branchId || departmentId) {
          setStaffAssignment(userData.id, { branchId, departmentId });
        }

        const storedAvatar = getEntityPhoto('staff', userData.id) || getEntityPhoto('user', userData.id);

        const userObj: User = {
          id: userData.id,
          firstName: userData.firstName || 'User',
          lastName: userData.lastName || '',
          name: userData.name || `${userData.firstName || ''} ${userData.lastName || ''}`.trim() || undefined,
          email: userData.email,
          role: userData.role || 'admin',
          isActive: userData.isActive !== undefined ? userData.isActive : true,
          phoneNumber: userData.phoneNumber || userData.phone || '',
          branchId,
          branch: userData.branch || branchId,
          departmentId,
          department: userData.department || departmentId,
          avatarUrl: userData.avatarUrl || userData.photoUrl || storedAvatar,
          photoUrl: userData.photoUrl || userData.avatarUrl || storedAvatar,
          createdAt: userData.createdAt || new Date().toISOString(),
          updatedAt: userData.updatedAt || new Date().toISOString(),
        };
        setUser(userObj);

        // Background server assignment query
        apiClient.get(`/users/${userData.id}/assignment`).then((res) => {
          const assign = res.data?.data || res.data;
          if (assign?.branchId || assign?.departmentId) {
            setStaffAssignment(userData.id, { branchId: assign.branchId, departmentId: assign.departmentId });
            setUser((prev) => prev ? {
              ...prev,
              branchId: assign.branchId || prev.branchId,
              branch: assign.branchName || prev.branch,
              departmentId: assign.departmentId || prev.departmentId,
              department: assign.departmentName || prev.department,
            } : null);
          }
        }).catch(() => {});
      }
    } catch (error) {
      console.error('Failed to refresh user:', error);
      clearTokens();
      setUser(null);
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