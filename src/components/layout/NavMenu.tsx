// src/components/layout/NavMenu.tsx (Enhanced with live notifications using optimized API)
import React, { useMemo } from 'react';
import { Menu, Badge } from 'antd';
import { useNavigate, useLocation } from 'react-router-dom';
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
} from '@ant-design/icons';
import { useAuth } from '@/contexts/AuthContext';
import { usePendingNotificationsCountQuery } from '@/api/notifications';
import { useUnseenCountsQuery } from '@/api/users';
import { useProspectsQuery } from '@/api/prospects';
import { useAppointmentsQuery } from '@/api/appointments';
import { useComplaints } from '@/mock/complaints';
import { useUnseenCount } from '@/mock/seenTracker';
import { useMockActivityFeed } from '@/pages/dashboard/admin/hooks/useMockActivityFeed';

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

  // ── Real Staff Nav-Badge Unseen Counts API ─────────────────────────────────
  const { data: apiUnseenCounts } = useUnseenCountsQuery(user?.id, !!user?.id);

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
  const complaints = useComplaints();
  const { count: fallbackComplaintsCount } = useUnseenCount(
    'complaints-staff',
    canSeeComplaints ? user?.id : undefined,
    complaints.map((c) => c.createdAt)
  );

  const canSeeHeadOffice = hasRole(['admin']);
  const canSeePayroll = hasRole(['accounts']);
  const { stats: mockStats } = useMockActivityFeed();

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

  // Use real backend unseen-counts if available, falling back to local trackers
  const newComplaintsCount = apiUnseenCounts?.complaints ?? (canSeeComplaints ? fallbackComplaintsCount : 0);
  const pendingApprovalsCount = apiUnseenCounts?.approvals ?? (canSeeHeadOffice ? mockStats.pendingApprovalsCount : 0);
  const pendingPayrollCount = apiUnseenCounts?.payroll ?? (canSeePayroll ? mockStats.pendingPayrollCount : 0);
  const newProspectsCount = apiUnseenCounts?.prospects ?? (canSeeMyProspects ? fallbackProspectsCount : 0);
  const newAppointmentsCount = apiUnseenCounts?.appointments ?? (canSeeAppointmentsBadge ? fallbackAppointmentsCount : 0);

  // Get the current selected key based on path
  const getSelectedKey = () => {
    const path = location.pathname;
    if (path.startsWith('/marketing/overview')) return '/marketing/overview';
    if (path.startsWith('/marketing/prospects')) return '/marketing/prospects';
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
    if (path.startsWith('/accounts/dashboard')) return '/accounts/dashboard';
    if (path.startsWith('/accounts/payroll')) return '/accounts/payroll';
    if (path.startsWith('/dashboard')) return '/dashboard';
    return path;
  };

  // Build menu items based on user role
  const menuItems = useMemo(() => {
    const items = [];

    // Dashboard section — each role gets its own distinct dashboard now
    // (accounts used to silently reuse Secretary's page).
    if (hasRole(['admin'])) {
      items.push({
        key: '/admin/dashboard',
        icon: <DashboardOutlined />,
        label: 'Dashboard',
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
    }

    // Bonuses & Salaries (prototype — see src/mock/payroll.ts)
    if (hasRole(['accounts'])) {
      items.push({
        key: '/accounts/payroll',
        icon: <IdcardOutlined />,
        label: <span>Bonuses & Salaries<NavBadge count={pendingPayrollCount} title={`${pendingPayrollCount} pending payroll run(s)`} /></span>,
      });
    }

    // Marketing section
    if (hasRole(['marketing_director', 'admin'])) {
      items.push({
        key: '/marketing/overview',
        icon: <BarChartOutlined />,
        label: 'Director Overview',
      });
    }

    if (hasRole(['marketing_staff', 'marketing_director', 'admin'])) {
      items.push({
        key: '/marketing/prospects',
        icon: <UserOutlined />,
        label: <span>My Prospects<NavBadge count={newProspectsCount} title={`${newProspectsCount} new prospect(s)`} /></span>,
      });
    }

    // Customer Service section
    if (hasRole(['customer_service', 'admin'])) {
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
        label: <span>Head Office<NavBadge count={pendingApprovalsCount} title={`${pendingApprovalsCount} pending approval(s)`} /></span>,
        children: [
          { key: '/head-office', label: 'Dashboard' },
          { key: '/head-office/pricing', label: 'Master Pricing' },
          {
            key: '/head-office/approvals',
            label: <span>Approvals<NavBadge count={pendingApprovalsCount} title={`${pendingApprovalsCount} pending approval(s)`} /></span>,
          },
          { key: '/head-office/payroll', label: 'Payroll' },
        ],
      });
      items.push({
        key: '/branches',
        icon: <ApartmentOutlined />,
        label: 'Branches',
      });
    }

    // Customers section
    if (hasRole(['secretary', 'accounts', 'admin'])) {
      items.push({
        key: '/customers',
        icon: <TeamOutlined />,
        label: 'Customers',
      });
    }

    // Payment Plans
    if (hasRole(['secretary', 'accounts', 'admin'])) {
      items.push({
        key: '/payment-plans',
        icon: <DollarOutlined />,
        label: 'Payment Plans',
      });
    }

    // Deeds
    if (hasRole(['secretary', 'admin'])) {
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
    if (canSeeComplaints) {
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

    return items;
  }, [
    hasRole,
    pendingCount,
    countLoading,
    newComplaintsCount,
    pendingApprovalsCount,
    pendingPayrollCount,
    newProspectsCount,
    newAppointmentsCount,
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