// src/components/portal/PortalProtectedRoute.tsx
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useCustomerPortalAuth } from '@/contexts/CustomerPortalAuthContext';

export const PortalProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { customer, isLoading } = useCustomerPortalAuth();
  const hasPortalToken = Boolean(localStorage.getItem('portal_token'));

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        Loading portal...
      </div>
    );
  }

  if (!hasPortalToken && !customer) {
    return <Navigate to="/portal/login" replace />;
  }

  return <>{children}</>;
};
