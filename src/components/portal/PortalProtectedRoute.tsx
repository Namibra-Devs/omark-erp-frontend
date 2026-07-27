// src/components/portal/PortalProtectedRoute.tsx
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useCustomerPortalAuth } from '@/contexts/CustomerPortalAuthContext';

export const PortalProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { customer, isLoading } = useCustomerPortalAuth();

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        Loading...
      </div>
    );
  }

  if (!customer) {
    return <Navigate to="/portal/login" replace />;
  }

  return <>{children}</>;
};
