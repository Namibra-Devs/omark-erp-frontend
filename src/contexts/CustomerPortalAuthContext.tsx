// src/contexts/CustomerPortalAuthContext.tsx
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
    const cached = customerId ? getCachedCustomer(customerId) ?? null : null;
    setCustomer(cached);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const setSessionCustomerId = (customerId: string) => {
    localStorage.setItem('portal_customer_id', customerId);
    setCustomer(getCachedCustomer(customerId) ?? null);
  };

  const logout = () => {
    clearPortalSession();
    localStorage.removeItem('portal_token');
    localStorage.removeItem('portal_customer_id');
    setCustomer(null);
  };

  return (
    <CustomerPortalAuthContext.Provider value={{ customer, isLoading, setSessionCustomerId, logout }}>
      {children}
    </CustomerPortalAuthContext.Provider>
  );
};
