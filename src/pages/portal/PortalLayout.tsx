// src/pages/portal/PortalLayout.tsx
// ⚠️ PROTOTYPE — customer-facing shell, deliberately separate from the
// staff AppShell/NavMenu (different auth domain, different audience).
import React, { useMemo } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Avatar, Badge, Button, Layout, Menu, Tag, Typography } from 'antd';
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

  // "Your complaint was updated" badge — see src/mock/seenTracker.ts.
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
              style={{ marginLeft: 8, backgroundColor: '#ff4d4f' }}
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
      <Header style={{ display: 'flex', alignItems: 'center', background: '#fff', borderBottom: '1px solid #f0f0f0', padding: '0 24px' }}>
        <Text strong style={{ color: tokens.primary, fontSize: 18, marginRight: 8 }}>Omark Portal</Text>
        <Tag color="gold">Preview</Tag>
        <Menu
          mode="horizontal"
          selectedKeys={[selectedKey]}
          items={NAV_ITEMS}
          onClick={({ key }) => navigate(key)}
          style={{ flex: 1, marginLeft: 24, borderBottom: 'none' }}
        />
        <Avatar icon={<UserOutlined />} style={{ backgroundColor: tokens.primary, marginRight: 8 }} />
        <Text style={{ marginRight: 16 }}>{customer?.firstName} {customer?.lastName}</Text>
        <Button icon={<LogoutOutlined />} onClick={handleLogout}>Sign Out</Button>
      </Header>
      <Content style={{ padding: 24, background: '#f5f7fa' }}>
        <Outlet />
      </Content>
    </Layout>
  );
};
