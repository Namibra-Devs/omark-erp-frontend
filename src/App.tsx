// src/App.tsx
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, App as AntdApp } from 'antd';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { AppShell } from '@/components/layout/AppShell';
import { tokens } from '@/constants/tokens';

// Pages
import { LoginPage } from '@/pages/LoginPage';

// Dashboard Pages
import { SecretaryDashboardPage } from '@/pages/dashboard/SecretaryDashboardPage';
import { AdminDashboardPage } from '@/pages/dashboard/AdminDashboardPage';

// Prospect Pages
import { ProspectsPage } from '@/pages/marketing/ProspectsPage';
import { ProspectDetailPage } from '@/pages/marketing/ProspectDetailPage';
import { DirectorOverviewPage } from '@/pages/marketing/DirectorOverviewPage';
import { CSProspectsPage } from '@/pages/cs/CSProspectsPage';

// Customer Service Pages
import { AppointmentsPage } from '@/pages/cs/AppointmentsPage';

// Customer Pages
import { CustomersPage } from '@/pages/customers/CustomersPage';
import { CustomerDetailPage } from '@/pages/customers/CustomerDetailPage';

// Payment Plan Pages
import { PaymentPlansPage } from '@/pages/paymentPlans/PaymentPlansPage';

// Deeds Pages
import { DeedsPage } from '@/pages/deeds/DeedsPage';

// Notifications Pages
import { NotificationsPage } from '@/pages/notifications/NotificationsPage';

// Admin Pages
import { UsersPage } from '@/pages/admin/UsersPage';

// Public Pages
import { BookingPage } from '@/pages/public/BookingPage';

// Error pages
const UnauthorizedPage = () => (
  <div style={{ textAlign: 'center', padding: '50px' }}>
    <h1>403 - Unauthorized</h1>
    <p>You don't have permission to access this page.</p>
  </div>
);

const NotFoundPage = () => (
  <div style={{ textAlign: 'center', padding: '50px' }}>
    <h1>404 - Page Not Found</h1>
    <p>The page you're looking for doesn't exist.</p>
  </div>
);

// Role-based redirect after login
const RoleRedirect: React.FC = () => {
  const { user } = useAuth();
  
  if (!user) return <Navigate to="/login" replace />;
  
  // Map each role to its default route
  const defaultRoutes: Record<string, string> = {
    admin: '/admin/dashboard',
    marketing_staff: '/marketing/prospects',
    marketing_director: '/marketing/overview',
    customer_service: '/cs/prospects',
    secretary: '/dashboard',
    accounts: '/dashboard',
  };
  
  const redirectPath = defaultRoutes[user.role] || '/';
  return <Navigate to={redirectPath} replace />;
};

// Query client configuration
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000,
    },
  },
});

// Main App Routes
const AppRoutes: React.FC = () => {
  return (
    <Routes>
      {/* ============ PUBLIC ROUTES ============ */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/book-appointment" element={<BookingPage />} />
      <Route path="/403" element={<UnauthorizedPage />} />
      <Route path="/404" element={<NotFoundPage />} />
      
      {/* ============ PROTECTED ROUTES ============ */}
      <Route element={<ProtectedRoute><AppShell /></ProtectedRoute>}>
        {/* Root redirect based on role */}
        <Route index element={<RoleRedirect />} />
        
        {/* ===== DASHBOARD ROUTES ===== */}
        
        {/* Secretary/Accounts Dashboard - /dashboard */}
        <Route 
          path="/dashboard" 
          element={
            <ProtectedRoute allowedRoles={['secretary', 'accounts']}>
              <SecretaryDashboardPage />
            </ProtectedRoute>
          } 
        />
        
        {/* Admin Dashboard - /admin/dashboard */}
        <Route 
          path="/admin/dashboard" 
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminDashboardPage />
            </ProtectedRoute>
          } 
        />
        
        {/* ===== PROSPECT ROUTES ===== */}
        
        {/* Marketing Prospects List - /marketing/prospects */}
        <Route 
          path="/marketing/prospects" 
          element={
            <ProtectedRoute allowedRoles={['marketing_staff', 'marketing_director', 'admin']}>
              <ProspectsPage />
            </ProtectedRoute>
          } 
        />
        
        {/* Prospect Detail - /marketing/prospects/:id */}
        <Route 
          path="/marketing/prospects/:id" 
          element={
            <ProtectedRoute allowedRoles={['marketing_staff', 'marketing_director', 'admin']}>
              <ProspectDetailPage />
            </ProtectedRoute>
          } 
        />
        
        {/* Marketing Director Overview - /marketing/overview */}
        <Route 
          path="/marketing/overview" 
          element={
            <ProtectedRoute allowedRoles={['marketing_director', 'admin']}>
              <DirectorOverviewPage />
            </ProtectedRoute>
          } 
        />
        
        {/* CS Prospects List - /cs/prospects */}
        <Route 
          path="/cs/prospects" 
          element={
            <ProtectedRoute allowedRoles={['customer_service', 'admin']}>
              <CSProspectsPage />
            </ProtectedRoute>
          } 
        />
        
        {/* ===== CUSTOMER SERVICE ROUTES ===== */}
        
        {/* Appointments - /cs/appointments */}
        <Route 
          path="/cs/appointments" 
          element={
            <ProtectedRoute allowedRoles={['customer_service', 'admin']}>
              <AppointmentsPage />
            </ProtectedRoute>
          } 
        />
        
        {/* ===== CUSTOMER ROUTES ===== */}
        
        {/* Customers List - /customers */}
        <Route 
          path="/customers" 
          element={
            <ProtectedRoute allowedRoles={['secretary', 'accounts', 'admin']}>
              <CustomersPage />
            </ProtectedRoute>
          } 
        />
        
        {/* Customer Detail - /customers/:id */}
        <Route 
          path="/customers/:id" 
          element={
            <ProtectedRoute allowedRoles={['secretary', 'accounts', 'admin']}>
              <CustomerDetailPage />
            </ProtectedRoute>
          } 
        />
        
        {/* ===== PAYMENT PLAN ROUTES ===== */}
        
        {/* Payment Plans List - /payment-plans */}
        <Route 
          path="/payment-plans" 
          element={
            <ProtectedRoute allowedRoles={['secretary', 'accounts', 'admin']}>
              <PaymentPlansPage />
            </ProtectedRoute>
          } 
        />
        
        {/* ===== DEEDS ROUTES ===== */}
        
        {/* Deeds List - /deeds */}
        <Route 
          path="/deeds" 
          element={
            <ProtectedRoute allowedRoles={['secretary', 'admin']}>
              <DeedsPage />
            </ProtectedRoute>
          } 
        />
        
        {/* ===== NOTIFICATIONS ROUTES ===== */}
        
        {/* Notifications Log - /notifications */}
        <Route 
          path="/notifications" 
          element={
            <ProtectedRoute allowedRoles={['secretary', 'admin']}>
              <NotificationsPage />
            </ProtectedRoute>
          } 
        />
        
        {/* ===== ADMIN ROUTES ===== */}
        
        {/* User Management - /admin/users */}
        <Route 
          path="/admin/users" 
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <UsersPage />
            </ProtectedRoute>
          } 
        />
      </Route>
      
      {/* ===== CATCH ALL ===== */}
      <Route path="*" element={<Navigate to="/404" replace />} />
    </Routes>
  );
};

// Main App Component
const App: React.FC = () => {
  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: tokens.primary,
          borderRadius: 6,
        },
        components: {
          Table: {
            headerBg: '#fafafa',
          },
          Card: {
            borderRadius: 8,
          },
        },
      }}
    >
      <AntdApp>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <AuthProvider>
              <AppRoutes />
            </AuthProvider>
          </BrowserRouter>
        </QueryClientProvider>
      </AntdApp>
    </ConfigProvider>
  );
};

export default App;