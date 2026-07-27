// src/contexts/CustomerPortalAuthContext.tsx
// ⚠️ PROTOTYPE — see src/mock/portalAuth.ts. A separate, parallel auth
// context from AuthContext.tsx: customers are not a recognized principal
// on the real backend at all, so this session has nothing to do with staff
// JWTs and cannot call any protected endpoint.
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { getCachedCustomer, type CachedCustomerRecord } from '@/mock/customerPortalCache';
import { clearPortalSession, getPortalSessionCustomerId } from '@/mock/portalAuth';

interface CustomerPortalAuthContextType {
  customer: CachedCustomerRecord | null;
  isLoading: boolean;
  setSessionCustomerId: (customerId: string) => void;
  logout: () => void;
}

const CustomerPortalAuthContext = createContext<CustomerPortalAuthContextType | undefined>(undefined);

export const useCustomerPortalAuth = () => {
  const ctx = useContext(CustomerPortalAuthContext);
  if (!ctx) throw new Error('useCustomerPortalAuth must be used within a CustomerPortalAuthProvider');
  return ctx;
};

export const CustomerPortalAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [customer, setCustomer] = useState<CachedCustomerRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(() => {
    const customerId = getPortalSessionCustomerId();
    setCustomer(customerId ? getCachedCustomer(customerId) ?? null : null);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const setSessionCustomerId = (customerId: string) => {
    setCustomer(getCachedCustomer(customerId) ?? null);
  };

  const logout = () => {
    clearPortalSession();
    setCustomer(null);
  };

  return (
    <CustomerPortalAuthContext.Provider value={{ customer, isLoading, setSessionCustomerId, logout }}>
      {children}
    </CustomerPortalAuthContext.Provider>
  );
};
