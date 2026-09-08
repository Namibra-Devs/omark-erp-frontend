// src/components/layout/NavMenu.tsx (Enhanced with live notifications using optimized API)
import React, { useMemo, useEffect } from 'react';
import { Menu, Badge } from 'antd';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  DashboardOutlined,
  UserOutlined,
  TeamOutlined,
  CalendarOutlined,
  BankOutlined,
  FileTextOutlined,
  BellOutlined,
  SettingOutlined,
  BarChartOutlined,
  HomeOutlined,
  DollarOutlined,
  CopyOutlined,
  NotificationOutlined,
  ApartmentOutlined,
  MessageOutlined,
  IdcardOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import { useAuth } from '@/contexts/AuthContext';
import { usePendingNotificationsCountQuery } from '@/api/notifications';
import { useUnseenCountsQuery } from '@/api/users';
import { useProspectsQuery } from '@/api/prospects';
import { useAppointmentsQuery } from '@/api/appointments';
import { useComplaintsQuery } from '@/api/complaints';
import { useApprovalsQuery, approvalsKeys } from '@/api/approvals';
import { usePayrollQuery } from '@/api/payroll';
import { useCheckIns } from '@/utils/visitorCheckIns';
import { useUnseenCount } from '@/utils/seenTracker';

/** Small red counter badge, same visual language as the existing Notifications badge. */
const NavBadge: React.FC<{ count: number; title?: string }> = ({ count, title }) => {
  if (count <= 0) return null;
  return (
    <Badge
      count={count}
      size="small"
      title={title ?? `${count} new`}
      style={{ marginLeft: 8, backgroundColor: '#ff4d4f', boxShadow: '0 0 0 2px #001529' }}
    />
  );
};

export const NavMenu: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, hasRole } = useAuth();
  const queryClient = useQueryClient();

  // ── Real Staff Nav-Badge Unseen Counts API ─────────────────────────────────
  const { data: apiUnseenCounts } = useUnseenCountsQuery(user?.id, !!user?.id);
  const { records: checkInRecords } = useCheckIns(user?.branchId);

  // GET /notifications is only accessible to admin/secretary/accounts on
  // the backend — every other role 403s, so notifications are hidden from
  // the nav entirely for them rather than showing a broken link.
  const canSeeNotifications = hasRole(['admin', 'secretary', 'accounts']);

  // ── Pending Notifications Count Query ─────────────────────────────────────
  const {
    data: pendingCount = 0,
    isLoading: countLoading,
  } = usePendingNotificationsCountQuery(canSeeNotifications);

  // ── Cross-nav badge counters ──────────────────────────────────────────────
  const canSeeComplaints = hasRole(['secretary', 'customer_service', 'admin']);
  const { data: complaintsData } = useComplaintsQuery(canSeeComplaints ? { status: 'open' } : undefined);
  const complaintsList = complaintsData?.items ?? [];
  const { count: fallbackComplaintsCount } = useUnseenCount(
    'complaints-staff',
    canSeeComplaints ? user?.id : undefined,
    complaintsList.map((c) => c.createdAt)
  );

  const canSeeHeadOffice = hasRole(['admin', 'branch_manager']);
  const canSeePayroll = hasRole(['accounts', 'admin', 'branch_manager']);

  // Live real-time approvals query
  const { data: approvalsData = [] } = useApprovalsQuery();
  const pendingApprovalsFromApi = (Array.isArray(approvalsData) ? approvalsData : []).filter(
    (a) => String(a?.status || '').trim().toLowerCase() === 'pending'
  ).length;

  // Live real-time payroll query
  const { data: payrollData } = usePayrollQuery(canSeePayroll ? { status: 'pending' } : undefined);
  const payrollList = Array.isArray(payrollData?.items) ? payrollData.items : [];
  const pendingPayrollFromApi = payrollList.filter(
    (p: any) => String(p?.status || '').trim().toLowerCase() === 'pending'
  ).length;

  // Listen for real-time approval decisions/creations across tabs & components
  useEffect(() => {
    const handleApprovalsChange = () => {
      queryClient.invalidateQueries({ queryKey: approvalsKeys.all });
    };
    window.addEventListener('omark-approvals-changed', handleApprovalsChange);
    return () => {
      window.removeEventListener('omark-approvals-changed', handleApprovalsChange);
    };
  }, [queryClient]);

  const canSeeMyProspects = hasRole(['marketing_staff', 'marketing_director', 'admin']);
  const { data: myProspectsData } = useProspectsQuery(
    { assignedUserId: user?.id, pageSize: 100 },
    canSeeMyProspects && !apiUnseenCounts && !!user?.id
  );
  const { count: fallbackProspectsCount } = useUnseenCount(
    'prospects',
    canSeeMyProspects ? user?.id : undefined,
    (myProspectsData?.items ?? []).map((p) => p.createdAt)
  );

  const canSeeAppointmentsBadge = hasRole(['customer_service', 'admin']);
  const { data: appointmentsData } = useAppointmentsQuery(
    { pageSize: 100 },
    canSeeAppointmentsBadge && !apiUnseenCounts
  );
  const { count: fallbackAppointmentsCount } = useUnseenCount(
    'appointments',
    canSeeAppointmentsBadge ? user?.id : undefined,
    (appointmentsData?.items ?? []).map((a) => a.createdAt)
  );

  const canSeeCheckIns = hasRole(['customer_service', 'admin', 'secretary', 'branch_manager']);
  const { count: fallbackCheckInsCount } = useUnseenCount(
    'check-ins',
    canSeeCheckIns ? user?.id : undefined,
    checkInRecords.map((c) => c.createdAt)
  );

  // Real-time counter metrics with live query priority
  const newComplaintsCount = apiUnseenCounts?.complaints ?? (canSeeComplaints ? fallbackComplaintsCount : 0);
  const pendingApprovalsCount = canSeeHeadOffice
    ? (pendingApprovalsFromApi > 0 ? pendingApprovalsFromApi : (apiUnseenCounts?.approvals || 0))
    : (apiUnseenCounts?.approvals || 0);

  const pendingPayrollCount = canSeePayroll
    ? (pendingPayrollFromApi > 0 ? pendingPayrollFromApi : (apiUnseenCounts?.payroll || 0))
    : (apiUnseenCounts?.payroll || 0);

  // Total pending items requiring Head Office action (Approvals + Escalated Payroll)
  const headOfficeBadgeCount = pendingApprovalsCount + pendingPayrollCount;

  const newProspectsCount = apiUnseenCounts?.prospects ?? (canSeeMyProspects ? fallbackProspectsCount : 0);
  const newAppointmentsCount = apiUnseenCounts?.appointments ?? (canSeeAppointmentsBadge ? fallbackAppointmentsCount : 0);
  const newCheckInsCount = apiUnseenCounts?.checkIns ?? (canSeeCheckIns ? fallbackCheckInsCount : 0);

  // Get the current selected key based on path
  const getSelectedKey = () => {
    const path = location.pathname;
    if (path.startsWith('/marketing/overview')) return '/marketing/overview';
    if (path.startsWith('/marketing/prospects')) return '/marketing/prospects';
    if (path.startsWith('/cs/check-ins')) return '/cs/check-ins';
    if (path.startsWith('/cs/prospects')) return '/cs/prospects';
    if (path.startsWith('/cs/appointments')) return '/cs/appointments';
    if (path.startsWith('/admin/properties')) return '/admin/properties';
    if (path.startsWith('/head-office/pricing')) return '/head-office/pricing';
    if (path.startsWith('/head-office/approvals')) return '/head-office/approvals';
    if (path.startsWith('/head-office/payroll')) return '/head-office/payroll';
    if (path.startsWith('/head-office')) return '/head-office';
    if (path.startsWith('/branches')) return '/branches';
    if (path.startsWith('/customers')) return '/customers';
    if (path.startsWith('/payment-plans')) return '/payment-plans';
    if (path.startsWith('/deeds')) return '/deeds';
    if (path.startsWith('/notifications')) return '/notifications';
    if (path.startsWith('/admin/complaints')) return '/admin/complaints';
    if (path.startsWith('/admin/deed-policy')) return '/admin/deed-policy';
    if (path.startsWith('/admin/dashboard')) return '/admin/dashboard';
    if (path.startsWith('/admin/users')) return '/admin/users';
    if (path.startsWith('/profile')) return '/profile';
    if (path.startsWith('/expenses') || path.startsWith('/accounts/expenses')) return '/accounts/expenses';
    if (path.startsWith('/accounts/dashboard')) return '/accounts/dashboard';
    if (path.startsWith('/accounts/payroll')) return '/accounts/payroll';
    if (path.startsWith('/attendance') || path.startsWith('/head-office/attendance')) return '/attendance';
    if (path.startsWith('/dashboard')) return '/dashboard';
    return path;
  };

  // Build menu items based on user role
  const menuItems = useMemo(() => {
    const items = [];

    // Dashboard section — each role gets its own distinct dashboard now
    if (hasRole(['admin'])) {
      items.push({
        key: '/admin/dashboard',
        icon: <DashboardOutlined />,
        label: 'Dashboard',
      });
      // Admin access to Accounts Dashboard
      items.push({
        key: '/accounts/dashboard',
        icon: <DollarOutlined />,
        label: 'Accounts Dashboard',
      });
    } else if (hasRole(['secretary'])) {
      items.push({
        key: '/dashboard',
        icon: <DashboardOutlined />,
        label: 'Dashboard',
      });
    } else if (hasRole(['accounts'])) {
      items.push({
        key: '/accounts/dashboard',
        icon: <DashboardOutlined />,
        label: 'Dashboard',
      });
    } else if (hasRole(['branch_manager'])) {
      const branchRoute = user?.branchId ? `/branches/${user.branchId}` : '/branches';
      items.push({
        key: branchRoute,
        icon: <DashboardOutlined />,
        label: 'Branch Dashboard',
      });
    }

    // ── EXPENSES (Critical feature moved to Sidebar) ──────────────────────────
    if (hasRole(['accounts', 'admin', 'branch_manager'])) {
      items.push({
        key: '/accounts/expenses',
        icon: <DollarOutlined />,
        label: 'Expenses',
      });
    }

    // Bonuses & Salaries (prototype — see src/mock/payroll.ts)
    if (hasRole(['accounts', 'admin', 'branch_manager'])) {
      items.push({
        key: '/accounts/payroll',
        icon: <IdcardOutlined />,
        label: <span>Bonuses & Salaries<NavBadge count={pendingPayrollCount} title={`${pendingPayrollCount} pending payroll run(s)`} /></span>,
      });
    }

    // ── Staff Attendance & Time Tracking (Available to all staff members) ─────
    items.push({
      key: '/attendance',
      icon: <ClockCircleOutlined />,
      label: 'Attendance & Shifts',
    });

    // Marketing section
    if (hasRole(['marketing_director', 'admin', 'branch_manager'])) {
      items.push({
        key: '/marketing/overview',
        icon: <BarChartOutlined />,
        label: 'Director Overview',
      });
    }

    if (hasRole(['marketing_staff', 'marketing_director', 'admin', 'branch_manager'])) {
      items.push({
        key: '/marketing/prospects',
        icon: <UserOutlined />,
        label: <span>My Prospects<NavBadge count={newProspectsCount} title={`${newProspectsCount} new prospect(s)`} /></span>,
      });
    }

    // Customer Service & Front Desk section
    if (hasRole(['customer_service', 'admin', 'secretary', 'branch_manager'])) {
      items.push({
        key: '/cs/check-ins',
        icon: <IdcardOutlined />,
        label: <span>Client Check-Ins<NavBadge count={newCheckInsCount} title={`${newCheckInsCount} new check-in(s)`} /></span>,
      });
    }

    if (hasRole(['customer_service', 'admin', 'branch_manager'])) {
      items.push({
        key: '/cs/prospects',
        icon: <TeamOutlined />,
        label: 'CS Prospects',
      });
      items.push({
        key: '/cs/appointments',
        icon: <CalendarOutlined />,
        label: <span>Appointments<NavBadge count={newAppointmentsCount} title={`${newAppointmentsCount} new appointment(s)`} /></span>,
      });
    }

    // ── Properties (moved up - before Customers) ──────────────────────────
    if (hasRole(['admin'])) {
      items.push({
        key: '/admin/properties',
        icon: <HomeOutlined />,
        label: 'Properties',
      });
    }

    // ── Branches (prototype — see src/mock/branches.ts) ────────────────────
    if (hasRole(['admin'])) {
      items.push({
        key: 'head-office-group',
        icon: <BankOutlined />,
        label: (
          <span>
            Head Office
            <NavBadge count={headOfficeBadgeCount} title={`${headOfficeBadgeCount} pending action(s)`} />
          </span>
        ),
        children: [
          { key: '/head-office', label: 'Dashboard' },
          { key: '/head-office/pricing', label: 'Master Pricing' },
          {
            key: '/head-office/approvals',
            label: (
              <span>
                Approvals
                <NavBadge count={pendingApprovalsCount} title={`${pendingApprovalsCount} pending approval(s)`} />
              </span>
            ),
          },
          {
            key: '/head-office/payroll',
            label: (
              <span>
                Payroll
                <NavBadge count={pendingPayrollCount} title={`${pendingPayrollCount} pending payroll run(s)`} />
              </span>
            ),
          },
        ],
      });
      items.push({
        key: '/branches',
        icon: <ApartmentOutlined />,
        label: 'Branches',
      });
    } else if (hasRole(['branch_manager'])) {
      items.push({
        key: 'head-office-group',
        icon: <BankOutlined />,
        label: (
          <span>
            Head Office
            <NavBadge count={headOfficeBadgeCount} title={`${headOfficeBadgeCount} pending action(s)`} />
          </span>
        ),
        children: [
          { key: '/head-office', label: 'Dashboard' },
          {
            key: '/head-office/approvals',
            label: (
              <span>
                Approvals
                <NavBadge count={pendingApprovalsCount} title={`${pendingApprovalsCount} pending approval(s)`} />
              </span>
            ),
          },
        ],
      });
      items.push({
        key: '/branches',
        icon: <ApartmentOutlined />,
        label: 'Branches',
      });
    }

    // Customers section
    if (hasRole(['secretary', 'accounts', 'admin', 'branch_manager'])) {
      items.push({
        key: '/customers',
        icon: <TeamOutlined />,
        label: 'Customers',
      });
    }

    // Payment Plans
    if (hasRole(['secretary', 'accounts', 'admin', 'branch_manager'])) {
      items.push({
        key: '/payment-plans',
        icon: <DollarOutlined />,
        label: 'Payment Plans',
      });
    }

    // Deeds
    if (hasRole(['secretary', 'admin', 'branch_manager'])) {
      items.push({
        key: '/deeds',
        icon: <CopyOutlined />,
        label: 'Deeds',
      });
    }

    // Company Deed Policy (prototype — see src/mock/deedPolicy.ts)
    if (hasRole(['admin'])) {
      items.push({
        key: '/admin/deed-policy',
        icon: <FileTextOutlined />,
        label: 'Deed Policy',
      });
    }

    // Complaints (prototype — see src/mock/complaints.ts, fed by the Customer Portal)
    if (canSeeComplaints || hasRole(['branch_manager'])) {
      items.push({
        key: '/admin/complaints',
        icon: <MessageOutlined />,
        label: <span>Complaints<NavBadge count={newComplaintsCount} title={`${newComplaintsCount} new complaint(s)`} /></span>,
      });
    }

    // Notifications (with live count) — only for roles the backend actually
    // grants GET /notifications to.
    if (canSeeNotifications) {
      items.push({
        key: '/notifications',
        icon: <NotificationOutlined />,
        label: (
          <span>
            Notifications
            {!countLoading && pendingCount > 0 && (
              <Badge
                count={pendingCount}
                size="small"
                title={`${pendingCount} pending notification${pendingCount === 1 ? '' : 's'}`}
                style={{
                  marginLeft: 8,
                  backgroundColor: '#ff4d4f',
                  boxShadow: '0 0 0 2px #001529',
                }}
              />
            )}
          </span>
        ),
      });
    }

    // ── User Management & Staff Profiles ─────────────────────────────────────
    if (hasRole(['admin', 'branch_manager'])) {
      items.push({
        key: '/admin/users',
        icon: <TeamOutlined />,
        label: 'Staff & Users',
      });
    }

    // ── My Profile ──────────────────────────────────────────────────────────
    items.push({
      key: '/profile',
      icon: <UserOutlined />,
      label: 'My Profile',
    });

    return items;
  }, [
    hasRole,
    pendingCount,
    countLoading,
    newComplaintsCount,
    pendingApprovalsCount,
    pendingPayrollCount,
    headOfficeBadgeCount,
    newProspectsCount,
    newAppointmentsCount,
    newCheckInsCount,
  ]);

  // If no user, don't render menu
  if (!user) return null;

  return (
    <Menu
      theme="dark"
      mode="inline"
      selectedKeys={[getSelectedKey()]}
      items={menuItems}
      onClick={({ key }) => navigate(key)}
      style={{ 
        height: 'calc(100vh - 64px)',
        borderRight: 0,
        paddingTop: 8,
      }}
    />
  );
};