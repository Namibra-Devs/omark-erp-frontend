// src/components/layout/NavMenu.tsx (Enhanced with icons and tooltips)
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

export const NavMenu: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, hasRole } = useAuth();

  // Get the current selected key based on path
  const getSelectedKey = () => {
    const path = location.pathname;
     if (path.startsWith('/marketing/overview')) return '/marketing/overview';
    if (path.startsWith('/marketing/prospects')) return '/marketing/prospects';
   
    if (path.startsWith('/cs/prospects')) return '/cs/prospects';
    if (path.startsWith('/cs/appointments')) return '/cs/appointments';
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

    // Notifications
    if (hasRole(['secretary', 'admin'])) {
      items.push({
        key: '/notifications',
        icon: <NotificationOutlined />,
        label: (
          <span>
            Notifications
            <Badge 
              count={5} 
              size="small" 
              style={{ marginLeft: 8, backgroundColor: '#ff4d4f' }} 
            />
          </span>
        ),
      });
    }

    // Admin section
    if (hasRole(['admin'])) {
      items.push({
        key: '/admin/users',
        icon: <SettingOutlined />,
        label: 'User Management',
      });
    }

    return items;
  }, [hasRole]);

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