// src/App.tsx
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, App as AntdApp } from 'antd';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { BranchProvider } from '@/contexts/BranchContext';
import { CustomerPortalAuthProvider } from '@/contexts/CustomerPortalAuthContext';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { PortalProtectedRoute } from '@/components/portal/PortalProtectedRoute';
import { AppShell } from '@/components/layout/AppShell';
import { ScrollToTop } from '@/components/layout/ScrollToTop';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import { tokens } from '@/constants/tokens';

// Pages
import { LoginPage } from '@/pages/LoginPage';

// Dashboard Pages
import { SecretaryDashboardPage } from '@/pages/dashboard/SecretaryDashboardPage';
import { AccountsDashboardPage } from '@/pages/dashboard/AccountsDashboardPage';
import { AdminDashboardPage } from '@/pages/dashboard/AdminDashboardPage';

// Prospect Pages
import { ProspectsPage } from '@/pages/marketing/ProspectsPage';
import { ProspectDetailPage } from '@/pages/marketing/ProspectDetailPage';
import { DirectorOverviewPage } from '@/pages/marketing/DirectorOverviewPage';
import { CSProspectsPage } from '@/pages/cs/CSProspectsPage';

// Customer Service Pages
import { AppointmentsPage } from '@/pages/cs/AppointmentsPage';
import { CheckInsPage } from '@/pages/cs/CheckInsPage';

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
import { StaffProfilePage } from '@/pages/admin/StaffProfilePage';
import { PropertiesPage } from '@/pages/admin/PropertiesPage';
import { ComplaintsPage } from '@/pages/admin/ComplaintsPage';
import { DeedPolicyPage } from '@/pages/admin/DeedPolicyPage';
import { MyProfilePage } from '@/pages/profile/MyProfilePage';
import { ExpensesPage } from '@/pages/accounts/ExpensesPage';

// Branch Pages (prototype — see src/mock/branches.ts)
import { BranchesPage } from '@/pages/branches/BranchesPage';
import { HeadOfficeDashboard } from '@/pages/branches/HeadOfficeDashboard';
import { BranchDashboard } from '@/pages/branches/BranchDashboard';
import { MasterPricingPage } from '@/pages/branches/MasterPricingPage';
import { ApprovalWorkflowPage } from '@/pages/branches/ApprovalWorkflowPage';
import { PayrollPage } from '@/pages/branches/PayrollPage';
import { AttendancePage } from '@/pages/attendance/AttendancePage';

// Public Pages
import { BookingPage } from '@/pages/public/BookingPage';

// Customer Portal Pages (prototype — see src/mock/portalAuth.ts)
import { PortalLoginPage } from '@/pages/portal/PortalLoginPage';
import { PortalLayout } from '@/pages/portal/PortalLayout';
import { PortalDashboardPage } from '@/pages/portal/PortalDashboardPage';
import { PortalPropertyPage } from '@/pages/portal/PortalPropertyPage';
import { PortalPaymentsPage } from '@/pages/portal/PortalPaymentsPage';
import { PortalComplaintsPage } from '@/pages/portal/PortalComplaintsPage';

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
    branch_manager: user.branchId ? `/branches/${user.branchId}` : '/branches',
    marketing_staff: '/marketing/prospects',
    marketing_director: '/marketing/overview',
    customer_service: '/cs/prospects',
    secretary: '/dashboard',
    accounts: '/accounts/dashboard',
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
    <>
    <ScrollToTop />
    <Routes>
      {/* ============ PUBLIC ROUTES ============ */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/book-appointment" element={<BookingPage />} />
      <Route path="/403" element={<UnauthorizedPage />} />
      <Route path="/404" element={<NotFoundPage />} />

      {/* ============ CUSTOMER PORTAL (prototype) ============ */}
      <Route path="/portal/login" element={<PortalLoginPage />} />
      <Route
        element={
          <PortalProtectedRoute>
            <PortalLayout />
          </PortalProtectedRoute>
        }
      >
        <Route path="/portal" element={<PortalDashboardPage />} />
        <Route path="/portal/property" element={<PortalPropertyPage />} />
        <Route path="/portal/payments" element={<PortalPaymentsPage />} />
        <Route path="/portal/complaints" element={<PortalComplaintsPage />} />
      </Route>

      {/* ============ PROTECTED ROUTES ============ */}
      <Route element={<ProtectedRoute><AppShell /></ProtectedRoute>}>
        {/* Root redirect based on role */}
        <Route index element={<RoleRedirect />} />

        {/* My Profile - any authenticated staff role */}
        <Route path="/profile" element={<MyProfilePage />} />
        
        {/* ===== DASHBOARD ROUTES ===== */}
        
        {/* Secretary Dashboard - /dashboard */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute allowedRoles={['secretary']}>
              <SecretaryDashboardPage />
            </ProtectedRoute>
          }
        />

        {/* Accounts Dashboard - /accounts/dashboard */}
        <Route
          path="/accounts/dashboard"
          element={
            <ProtectedRoute allowedRoles={['accounts', 'admin']}>
              <AccountsDashboardPage />
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
        
        {/* Marketing Director Overview - /marketing/overview */}
        <Route 
          path="/marketing/overview" 
          element={
            <ProtectedRoute allowedRoles={['marketing_director', 'admin']}>
              <DirectorOverviewPage />
            </ProtectedRoute>
          } 
        />

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
            <ProtectedRoute allowedRoles={['customer_service', 'admin', 'secretary', 'branch_manager']}>
              <AppointmentsPage />
            </ProtectedRoute>
          } 
        />

        {/* Client & Visitor Check-Ins - /cs/check-ins */}
        <Route 
          path="/cs/check-ins" 
          element={
            <ProtectedRoute allowedRoles={['customer_service', 'secretary', 'admin', 'branch_manager']}>
              <CheckInsPage />
            </ProtectedRoute>
          } 
        />
        
        {/* ===== CUSTOMER ROUTES ===== */}
        
        {/* Customers List - /customers */}
        <Route 
          path="/customers" 
          element={
            <ProtectedRoute allowedRoles={['secretary', 'accounts', 'admin', 'branch_manager']}>
              <CustomersPage />
            </ProtectedRoute>
          } 
        />
        
        {/* Customer Detail - /customers/:id */}
        <Route 
          path="/customers/:id" 
          element={
            <ProtectedRoute allowedRoles={['secretary', 'accounts', 'admin', 'branch_manager']}>
              <CustomerDetailPage />
            </ProtectedRoute>
          } 
        />
        
        {/* ===== PAYMENT PLAN ROUTES ===== */}
        
        {/* Payment Plans List - /payment-plans */}
        <Route 
          path="/payment-plans" 
          element={
            <ProtectedRoute allowedRoles={['secretary', 'accounts', 'admin', 'branch_manager']}>
              <PaymentPlansPage />
            </ProtectedRoute>
          } 
        />
        
        {/* ===== DEEDS ROUTES ===== */}
        
        {/* Deeds List - /deeds */}
        <Route 
          path="/deeds" 
          element={
            <ProtectedRoute allowedRoles={['secretary', 'admin', 'branch_manager']}>
              <DeedsPage />
            </ProtectedRoute>
          } 
        />
        
        {/* ===== NOTIFICATIONS ROUTES ===== */}
        
        {/* Notifications Log - /notifications */}
        <Route 
          path="/notifications" 
          element={
            <ProtectedRoute allowedRoles={['secretary', 'admin', 'customer_service', 'marketing_staff', 'marketing_director', 'accounts', 'branch_manager']}>
              <NotificationsPage />
            </ProtectedRoute>
          } 
        />
        
        {/* ===== ADMIN ROUTES ===== */}
        
        {/* User Management - /admin/users */}
        <Route 
          path="/admin/users" 
          element={
            <ProtectedRoute allowedRoles={['admin', 'branch_manager']}>
              <UsersPage />
            </ProtectedRoute>
          } 
        />

        {/* Staff Profile Detail - /admin/users/:id */}
        <Route 
          path="/admin/users/:id" 
          element={
            <ProtectedRoute allowedRoles={['admin', 'branch_manager', 'secretary', 'accounts', 'customer_service', 'marketing_director', 'marketing_staff']}>
              <StaffProfilePage />
            </ProtectedRoute>
          } 
        />

        {/* Expenses Management Hub - /expenses and /accounts/expenses */}
        <Route 
          path="/expenses" 
          element={
            <ProtectedRoute allowedRoles={['accounts', 'admin', 'branch_manager']}>
              <ExpensesPage />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/accounts/expenses" 
          element={
            <ProtectedRoute allowedRoles={['accounts', 'admin', 'branch_manager']}>
              <ExpensesPage />
            </ProtectedRoute>
          } 
        />
        
        {/* Properties Management - /admin/properties */}
        <Route
          path="/admin/properties"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <PropertiesPage />
            </ProtectedRoute>
          }
        />

        {/* Complaints (prototype) - /admin/complaints */}
        <Route
          path="/admin/complaints"
          element={
            <ProtectedRoute allowedRoles={['admin', 'secretary', 'customer_service', 'branch_manager']}>
              <ComplaintsPage />
            </ProtectedRoute>
          }
        />

        {/* Company Deed Policy (prototype) - /admin/deed-policy */}
        <Route
          path="/admin/deed-policy"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <DeedPolicyPage />
            </ProtectedRoute>
          }
        />

        {/* Branches (prototype) - /head-office, /branches, /branches/:branchId */}
        <Route
          path="/head-office"
          element={
            <ProtectedRoute allowedRoles={['admin', 'branch_manager']}>
              <HeadOfficeDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/branches"
          element={
            <ProtectedRoute allowedRoles={['admin', 'branch_manager']}>
              <BranchesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/branches/:branchId"
          element={
            <ProtectedRoute allowedRoles={['admin', 'branch_manager']}>
              <BranchDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/head-office/pricing"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <MasterPricingPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/head-office/approvals"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <ApprovalWorkflowPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/head-office/payroll"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <PayrollPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/accounts/payroll"
          element={
            <ProtectedRoute allowedRoles={['admin', 'accounts', 'branch_manager']}>
              <PayrollPage />
            </ProtectedRoute>
          }
        />

        {/* Staff Attendance & Time Tracking Hub - /attendance, /head-office/attendance */}
        <Route
          path="/attendance"
          element={
            <ProtectedRoute>
              <AttendancePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/head-office/attendance"
          element={
            <ProtectedRoute allowedRoles={['admin', 'branch_manager']}>
              <AttendancePage />
            </ProtectedRoute>
          }
        />
      </Route>
      
      {/* ===== CATCH ALL ===== */}
      <Route path="*" element={<Navigate to="/404" replace />} />
    </Routes>
    </>
  );
};

// Main App Component
const App: React.FC = () => {
  return (
    <ErrorBoundary>
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
                <BranchProvider>
                  <CustomerPortalAuthProvider>
                    <AppRoutes />
                  </CustomerPortalAuthProvider>
                </BranchProvider>
              </AuthProvider>
            </BrowserRouter>
          </QueryClientProvider>
        </AntdApp>
      </ConfigProvider>
    </ErrorBoundary>
  );
};

export default App;