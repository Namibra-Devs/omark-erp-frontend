// src/contexts/AuthContext.tsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import type { User, Role } from '@/types';

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  isLoading: boolean;
  hasRole: (roles: Role[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Mock users with different roles
const mockUsers: Record<string, User> = {
  // Admin
  'admin@omark.com': {
    id: '1',
    firstName: 'John',
    lastName: 'Admin',
    email: 'admin@omark.com',
    phoneNumber: '+233201234567',
    role: 'admin',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  
  // Marketing Staff
  'marketing@omark.com': {
    id: '2',
    firstName: 'Sarah',
    lastName: 'Marketing',
    email: 'marketing@omark.com',
    phoneNumber: '+233201234568',
    role: 'marketing_staff',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  
  // Marketing Director
  'director@omark.com': {
    id: '3',
    firstName: 'Michael',
    lastName: 'Director',
    email: 'director@omark.com',
    phoneNumber: '+233201234569',
    role: 'marketing_director',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  
  // Customer Service
  'cs@omark.com': {
    id: '4',
    firstName: 'Emma',
    lastName: 'Service',
    email: 'cs@omark.com',
    phoneNumber: '+233201234570',
    role: 'customer_service',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  
  // Secretary
  'secretary@omark.com': {
    id: '5',
    firstName: 'David',
    lastName: 'Secretary',
    email: 'secretary@omark.com',
    phoneNumber: '+233201234571',
    role: 'secretary',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  
  // Accounts
  'accounts@omark.com': {
    id: '6',
    firstName: 'Lisa',
    lastName: 'Accounts',
    email: 'accounts@omark.com',
    phoneNumber: '+233201234572',
    role: 'accounts',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const savedUser = sessionStorage.getItem('mockUser');
    return savedUser ? JSON.parse(savedUser) : null;
  });
  const [isLoading, setIsLoading] = useState(false);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 800));
    
    const mockUser = mockUsers[email.toLowerCase()];
    
    // Check if user exists and password is not empty
    if (mockUser && password && password.trim() !== '') {
      setUser(mockUser);
      sessionStorage.setItem('mockUser', JSON.stringify(mockUser));
      setIsLoading(false);
      return;
    }
    
    setIsLoading(false);
    throw { error: { message: 'Invalid email or password' } };
  };

  const logout = async () => {
    setUser(null);
    sessionStorage.removeItem('mockUser');
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