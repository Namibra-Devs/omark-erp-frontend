// src/App.tsx
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, App as AntdApp, Spin } from 'antd';
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

// Fast initial load for Login
import { LoginPage } from '@/pages/LoginPage';

// Public Pages (Lazy)
const BookingPage = React.lazy(() => import('@/pages/public/BookingPage').then(m => ({ default: m.BookingPage })));

// Dashboard Pages (Lazy)
const SecretaryDashboardPage = React.lazy(() => import('@/pages/dashboard/SecretaryDashboardPage').then(m => ({ default: m.SecretaryDashboardPage })));
const AccountsDashboardPage = React.lazy(() => import('@/pages/dashboard/AccountsDashboardPage').then(m => ({ default: m.AccountsDashboardPage })));
const AdminDashboardPage = React.lazy(() => import('@/pages/dashboard/AdminDashboardPage').then(m => ({ default: m.AdminDashboardPage })));

// Prospect Pages (Lazy)
const ProspectsPage = React.lazy(() => import('@/pages/marketing/ProspectsPage').then(m => ({ default: m.ProspectsPage })));
const ProspectDetailPage = React.lazy(() => import('@/pages/marketing/ProspectDetailPage').then(m => ({ default: m.ProspectDetailPage })));
const DirectorOverviewPage = React.lazy(() => import('@/pages/marketing/DirectorOverviewPage').then(m => ({ default: m.DirectorOverviewPage })));
const CSProspectsPage = React.lazy(() => import('@/pages/cs/CSProspectsPage').then(m => ({ default: m.CSProspectsPage })));

// Customer Service Pages (Lazy)
const AppointmentsPage = React.lazy(() => import('@/pages/cs/AppointmentsPage').then(m => ({ default: m.AppointmentsPage })));
const CheckInsPage = React.lazy(() => import('@/pages/cs/CheckInsPage').then(m => ({ default: m.CheckInsPage })));

// Customer Pages (Lazy)
const CustomersPage = React.lazy(() => import('@/pages/customers/CustomersPage').then(m => ({ default: m.CustomersPage })));
const CustomerDetailPage = React.lazy(() => import('@/pages/customers/CustomerDetailPage').then(m => ({ default: m.CustomerDetailPage })));

// Payment Plan Pages (Lazy)
const PaymentPlansPage = React.lazy(() => import('@/pages/paymentPlans/PaymentPlansPage').then(m => ({ default: m.PaymentPlansPage })));

// Deeds Pages (Lazy)
const DeedsPage = React.lazy(() => import('@/pages/deeds/DeedsPage').then(m => ({ default: m.DeedsPage })));

// Notifications Pages (Lazy)
const NotificationsPage = React.lazy(() => import('@/pages/notifications/NotificationsPage').then(m => ({ default: m.NotificationsPage })));

// Admin Pages (Lazy)
const UsersPage = React.lazy(() => import('@/pages/admin/UsersPage').then(m => ({ default: m.UsersPage })));
const StaffProfilePage = React.lazy(() => import('@/pages/admin/StaffProfilePage').then(m => ({ default: m.StaffProfilePage })));
const PropertiesPage = React.lazy(() => import('@/pages/admin/PropertiesPage').then(m => ({ default: m.PropertiesPage })));
const ComplaintsPage = React.lazy(() => import('@/pages/admin/ComplaintsPage').then(m => ({ default: m.ComplaintsPage })));
const DeedPolicyPage = React.lazy(() => import('@/pages/admin/DeedPolicyPage').then(m => ({ default: m.DeedPolicyPage })));
const MyProfilePage = React.lazy(() => import('@/pages/profile/MyProfilePage').then(m => ({ default: m.MyProfilePage })));
const ExpensesPage = React.lazy(() => import('@/pages/accounts/ExpensesPage').then(m => ({ default: m.ExpensesPage })));

// Branch Pages (Lazy)
const BranchesPage = React.lazy(() => import('@/pages/branches/BranchesPage').then(m => ({ default: m.BranchesPage })));
const HeadOfficeDashboard = React.lazy(() => import('@/pages/branches/HeadOfficeDashboard').then(m => ({ default: m.HeadOfficeDashboard })));
const BranchDashboard = React.lazy(() => import('@/pages/branches/BranchDashboard').then(m => ({ default: m.BranchDashboard })));
const MasterPricingPage = React.lazy(() => import('@/pages/branches/MasterPricingPage').then(m => ({ default: m.MasterPricingPage })));
const ApprovalWorkflowPage = React.lazy(() => import('@/pages/branches/ApprovalWorkflowPage').then(m => ({ default: m.ApprovalWorkflowPage })));
const PayrollPage = React.lazy(() => import('@/pages/branches/PayrollPage').then(m => ({ default: m.PayrollPage })));
const AttendancePage = React.lazy(() => import('@/pages/attendance/AttendancePage').then(m => ({ default: m.AttendancePage })));

// Customer Portal Pages (Lazy)
const PortalLoginPage = React.lazy(() => import('@/pages/portal/PortalLoginPage').then(m => ({ default: m.PortalLoginPage })));
const PortalLayout = React.lazy(() => import('@/pages/portal/PortalLayout').then(m => ({ default: m.PortalLayout })));
const PortalDashboardPage = React.lazy(() => import('@/pages/portal/PortalDashboardPage').then(m => ({ default: m.PortalDashboardPage })));
const PortalPropertyPage = React.lazy(() => import('@/pages/portal/PortalPropertyPage').then(m => ({ default: m.PortalPropertyPage })));
const PortalPaymentsPage = React.lazy(() => import('@/pages/portal/PortalPaymentsPage').then(m => ({ default: m.PortalPaymentsPage })));
const PortalComplaintsPage = React.lazy(() => import('@/pages/portal/PortalComplaintsPage').then(m => ({ default: m.PortalComplaintsPage })));

const RouteLoadingFallback = () => (
  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh', width: '100%' }}>
    <Spin size="large" tip="Loading..." />
  </div>
);

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
    <React.Suspense fallback={<RouteLoadingFallback />}>
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
            <ProtectedRoute allowedRoles={['admin', 'branch_manager']}>
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
    </React.Suspense>
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