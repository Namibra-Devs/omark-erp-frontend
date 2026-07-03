// src/contexts/AuthContext.tsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import type { User, Role } from '@/types';
import type { UserEntity } from '@/types/api';
import { erpClient, setTokens, clearTokens, getAccessToken } from '@/api/client';

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  isLoading: boolean;
  hasRole: (roles: Role[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

// Maps backend UserEntity to frontend User interface
const mapUserEntityToUser = (entity: UserEntity): User => {
  // 1. Safe handling for name properties
  let firstName = (entity as any).firstName || '';
  let lastName = (entity as any).lastName || '';

  // 2. Fallback fallback if the backend ever *does* use a single name field down the road
  if (!firstName && !lastName && entity.name) {
    const nameParts = entity.name.trim().split(/\s+/);
    firstName = nameParts[0] || '';
    lastName = nameParts.slice(1).join(' ') || '';
  }

  let phoneNumber = '';
  if (entity.phone) {
    if (typeof entity.phone === 'string') {
      phoneNumber = entity.phone;
    } else if (typeof entity.phone === 'object') {
      phoneNumber = (entity.phone as any).number || (entity.phone as any).value || JSON.stringify(entity.phone);
    }
  }

  return {
    id: String(entity.id),
    firstName,
    lastName,
    email: entity.email,
    phoneNumber,
    role: entity.role as Role,
    isActive: true, // Default to active
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
  };
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load user profile on startup if tokens exist
  useEffect(() => {
    const initializeAuth = async () => {
      const token = getAccessToken();
      if (!token) {
        setIsLoading(false);
        return;
      }

      try {
        // Fetch current user details from /api/auth/me
        // Note: erpClient automatically unwraps 'data' object in response envelope if structured
        const res = await erpClient.get('/api/auth/me');
        // If data was unwrapped: res is { success: true, data: UserEntity } or just UserEntity
        const userEntity = (res as any).data || res;
        if (userEntity) {
          setUser(mapUserEntityToUser(userEntity));
        }
      } catch (err) {
        console.error('Failed to load user profile on startup:', err);
        // Interceptor might have already handled clearing tokens if it was 401 and refresh failed
        clearTokens();
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();
  }, []);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const res = await erpClient.post('/api/v1/auth/login', { email, password });
    
      const loginData = (res as any).data || res;
      
      if (loginData.accessToken && loginData.refreshToken) {
        setTokens(loginData.accessToken, loginData.refreshToken);
        setUser(mapUserEntityToUser(loginData.user));
      } else {
        throw new Error('Tokens not found in login response');
      }
    } catch (err: any) {
      console.error('Login error:', err);
      // Re-throw with formatted error expected by LoginPage
      const errorMsg = err.error?.message || err.message || 'Invalid email or password';
      throw { error: { message: errorMsg } };
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await erpClient.post('/api/auth/logout');
    } catch (err) {
      console.error('API logout failed, performing local logout:', err);
    } finally {
      clearTokens();
      setUser(null);
      setIsLoading(false);
    }
  };

  const hasRole = (roles: Role[]) => {
    if (!user) return false;
    return roles.includes(user.role);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isLoading, hasRole }}>
      {children}
    </AuthContext.Provider>
  );
};