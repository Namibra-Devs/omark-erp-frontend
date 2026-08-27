// src/pages/portal/PortalLayout.tsx
import React, { useMemo } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Avatar, Badge, Button, Layout, Menu, Typography } from 'antd';
import {
  DashboardOutlined, HomeOutlined, DollarOutlined, MessageOutlined,
  LogoutOutlined, UserOutlined,
} from '@ant-design/icons';
import { tokens } from '@/constants/tokens';
import { useCustomerPortalAuth } from '@/contexts/CustomerPortalAuthContext';
import { useComplaints } from '@/mock/complaints';
import { useUnseenCount } from '@/mock/seenTracker';

const { Header, Content } = Layout;
const { Text } = Typography;

export const PortalLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { customer, logout } = useCustomerPortalAuth();

  const allComplaints = useComplaints();
  const myComplaints = useMemo(
    () => (customer ? allComplaints.filter((c) => c.customerId === customer.id) : []),
    [allComplaints, customer]
  );
  const { count: complaintUpdatesCount } = useUnseenCount(
    'complaints-customer',
    customer?.id,
    myComplaints.map((c) => c.updatedAt)
  );

  const NAV_ITEMS = [
    { key: '/portal', icon: <DashboardOutlined />, label: 'Dashboard' },
    { key: '/portal/property', icon: <HomeOutlined />, label: 'My Property' },
    { key: '/portal/payments', icon: <DollarOutlined />, label: 'Payments' },
    {
      key: '/portal/complaints',
      icon: <MessageOutlined />,
      label: (
        <span>
          Complaints
          {complaintUpdatesCount > 0 && (
            <Badge
              count={complaintUpdatesCount}
              size="small"
              title={`${complaintUpdatesCount} update(s) on your complaints`}
              style={{ marginLeft: 6, backgroundColor: '#ff4d4f' }}
            />
          )}
        </span>
      ),
    },
  ];

  const selectedKey = NAV_ITEMS.slice().reverse().find((item) => location.pathname.startsWith(item.key))?.key ?? '/portal';

  const handleLogout = () => {
    logout();
    navigate('/portal/login');
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {/* Top Header Bar */}
      <Header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: '#fff',
          borderBottom: '1px solid #f0f0f0',
          padding: '0 16px',
          height: 64,
          position: 'sticky',
          top: 0,
          zIndex: 100,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Text strong style={{ color: tokens.primary, fontSize: 18, whiteSpace: 'nowrap' }}>
            Omark Portal
          </Text>
        </div>

        {/* Desktop Menu */}
        <div className="portal-desktop-menu" style={{ flex: 1, marginLeft: 24, marginRight: 16 }}>
          <Menu
            mode="horizontal"
            selectedKeys={[selectedKey]}
            items={NAV_ITEMS}
            onClick={({ key }) => navigate(key)}
            style={{ borderBottom: 'none' }}
          />
        </div>

        {/* User Info & Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Avatar icon={<UserOutlined />} style={{ backgroundColor: tokens.primary, flexShrink: 0 }} />
          <Text className="portal-user-name" style={{ whiteSpace: 'nowrap', fontWeight: 500 }}>
            {customer?.firstName} {customer?.lastName}
          </Text>
          <Button icon={<LogoutOutlined />} onClick={handleLogout} size="small" type="text" danger title="Sign Out">
            <span className="portal-logout-text">Sign Out</span>
          </Button>
        </div>
      </Header>

      {/* Main Page Content */}
      <Content
        style={{
          padding: '20px 16px 80px 16px',
          background: '#f5f7fa',
          maxWidth: 1200,
          margin: '0 auto',
          width: '100%',
        }}
      >
        <Outlet />
      </Content>

      {/* Mobile Sticky Bottom Navigation Bar */}
      <div className="portal-mobile-bottom-nav">
        {NAV_ITEMS.map((item) => {
          const isActive = selectedKey === item.key;
          return (
            <button
              key={item.key}
              onClick={() => navigate(item.key)}
              className={`portal-bottom-nav-item ${isActive ? 'active' : ''}`}
            >
              <div style={{ fontSize: 20, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {item.icon}
              </div>
              <span style={{ fontSize: 11, marginTop: 2, fontWeight: isActive ? 600 : 400 }}>
                {item.key === '/portal/complaints' ? 'Complaints' : item.label}
              </span>
            </button>
          );
        })}
      </div>

      <style>{`
        @media (max-width: 768px) {
          .portal-desktop-menu {
            display: none !important;
          }
          .portal-user-name {
            display: none !important;
          }
          .portal-logout-text {
            display: none !important;
          }
          .portal-mobile-bottom-nav {
            display: flex !important;
          }
        }
        @media (min-width: 769px) {
          .portal-mobile-bottom-nav {
            display: none !important;
          }
        }
        .portal-mobile-bottom-nav {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          height: 60px;
          background: #ffffff;
          border-top: 1px solid #e8e8e8;
          z-index: 1000;
          justify-content: space-around;
          align-items: center;
          box-shadow: 0 -2px 10px rgba(0,0,0,0.05);
        }
        .portal-bottom-nav-item {
          background: transparent;
          border: none;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          flex: 1;
          height: 100%;
          color: #8c8c8c;
          cursor: pointer;
          padding: 4px 0;
          transition: color 0.2s ease;
        }
        .portal-bottom-nav-item.active {
          color: ${tokens.primary};
        }
      `}</style>
    </Layout>
  );
};
