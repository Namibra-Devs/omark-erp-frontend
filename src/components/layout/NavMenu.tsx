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
} from '@ant-design/icons';
import { useAuth } from '@/contexts/AuthContext';
import { usePendingNotificationsCountQuery } from '@/api/notifications';

export const NavMenu: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, hasRole } = useAuth();

  // GET /notifications is only accessible to admin/secretary/accounts on
  // the backend — every other role 403s, so notifications are hidden from
  // the nav entirely for them rather than showing a broken link.
  const canSeeNotifications = hasRole(['admin', 'secretary', 'accounts']);

  // ── Pending Notifications Count Query ─────────────────────────────────────
  // Refetches every 30s on its own (see usePendingNotificationsCountQuery),
  // and TanStack Query refetches on window focus by default, so navigating
  // back to the tab / route keeps this reasonably fresh without extra effects.
  const {
    data: pendingCount = 0,
    isLoading: countLoading,
  } = usePendingNotificationsCountQuery(canSeeNotifications);

  // Get the current selected key based on path
  const getSelectedKey = () => {
    const path = location.pathname;
    if (path.startsWith('/marketing/overview')) return '/marketing/overview';
    if (path.startsWith('/marketing/prospects')) return '/marketing/prospects';
    if (path.startsWith('/cs/prospects')) return '/cs/prospects';
    if (path.startsWith('/cs/appointments')) return '/cs/appointments';
    if (path.startsWith('/admin/properties')) return '/admin/properties';
    if (path.startsWith('/customers')) return '/customers';
    if (path.startsWith('/payment-plans')) return '/payment-plans';
    if (path.startsWith('/deeds')) return '/deeds';
    if (path.startsWith('/notifications')) return '/notifications';
    if (path.startsWith('/admin/dashboard')) return '/admin/dashboard';
    if (path.startsWith('/admin/users')) return '/admin/users';
    if (path.startsWith('/dashboard')) return '/dashboard';
    return path;
  };

  // Build menu items based on user role
  const menuItems = useMemo(() => {
    const items = [];

    // Dashboard section
    if (hasRole(['admin'])) {
      items.push({
        key: '/admin/dashboard',
        icon: <DashboardOutlined />,
        label: 'Dashboard',
      });
    } else if (hasRole(['secretary', 'accounts'])) {
      items.push({
        key: '/dashboard',
        icon: <DashboardOutlined />,
        label: 'Dashboard',
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
        label: 'My Prospects',
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
        label: 'Appointments',
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
  }, [hasRole, pendingCount, countLoading]);

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