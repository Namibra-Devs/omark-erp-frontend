// src/components/layout/TopHeader.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout, Space, Typography, Tag, Dropdown, Badge, Button, message, List, Spin, Empty, Drawer, Tabs, Tooltip } from 'antd';
import {
  UserOutlined,
  LogoutOutlined,
  DownOutlined,
  BellOutlined,
  SettingOutlined,
  CloseOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  WarningOutlined,
  DollarOutlined,
  SafetyCertificateOutlined,
  FileTextOutlined,
  CheckOutlined,
} from '@ant-design/icons';
import { useAuth } from '@/contexts/AuthContext';
import { PhotoUpload } from '@/components/shared/PhotoUpload';
import { useBranchesQuery } from '@/api/branches';
import { getUserBranchRoleTitle } from '@/utils/branchIsolation';
import { useUserQuery } from '@/api/users';
import { useNotificationsQuery, type NotificationLog } from '@/api/notifications';
import { StaffClockWidget } from '@/components/attendance/StaffClockWidget';
import {
  getStoredNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  type SystemNotification,
} from '@/utils/activityNotificationEngine';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

const { Header } = Layout;
const { Text } = Typography;

export const TopHeader: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout, hasRole } = useAuth();
  const [notificationDrawer, setNotificationDrawer] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const canSeeSmsLogs = hasRole(['admin', 'secretary', 'accounts']);

  const { data: userData, isLoading: userLoading } = useUserQuery(user?.id || '');
  const { data: branches = [] } = useBranchesQuery();

  const currentUser = userData || user;
  const branchRoleTitle = getUserBranchRoleTitle(currentUser, branches);

  const [systemNotifications, setSystemNotifications] = useState<SystemNotification[]>(() =>
    getStoredNotifications(user?.id, user?.role)
  );

  const {
    data: notificationsData,
    isLoading: notificationsLoading,
    refetch: refetchNotifications,
  } = useNotificationsQuery({ pageSize: 10 }, canSeeSmsLogs);

  // Sync real-time notifications
  useEffect(() => {
    const refreshNotifications = () => {
      setSystemNotifications(getStoredNotifications(currentUser?.id, currentUser?.role));
    };
    refreshNotifications();
    window.addEventListener('omark-notifications-changed', refreshNotifications);
    window.addEventListener('storage', refreshNotifications);
    return () => {
      window.removeEventListener('omark-notifications-changed', refreshNotifications);
      window.removeEventListener('storage', refreshNotifications);
    };
  }, [currentUser?.id, currentUser?.role]);

  const handleLogout = () => {
    logout();
  };

  // ── User Menu Items ──────────────────────────────────────────────────────
  const userMenuItems = [
    {
      key: 'profile',
      label: (
        <Space>
          <UserOutlined />
          My Profile
        </Space>
      ),
      onClick: () => navigate('/profile'),
    },
    {
      key: 'settings',
      label: (
        <Space>
          <SettingOutlined />
          Settings
        </Space>
      ),
      onClick: () => message.info('Settings page coming soon!'),
    },
    {
      type: 'divider' as const,
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: 'Logout',
      onClick: handleLogout,
      danger: true,
    },
  ];

  // ── Filtered Notifications ────────────────────────────────────────────────
  const filteredNotifications = systemNotifications.filter((n) => {
    if (activeCategory === 'all') return true;
    if (activeCategory === 'attendance') return n.category === 'attendance';
    if (activeCategory === 'payroll') return n.category === 'payroll';
    if (activeCategory === 'payment') return n.category === 'payment' || n.category === 'deed';
    if (activeCategory === 'security') return n.category === 'security';
    return true;
  });

  const unreadCount = systemNotifications.filter((n) => !n.read).length;

  const getCategoryIcon = (category: string, type: string) => {
    if (category === 'attendance') return <ClockCircleOutlined style={{ color: '#0284c7', fontSize: 18 }} />;
    if (category === 'payroll') return <DollarOutlined style={{ color: '#52c41a', fontSize: 18 }} />;
    if (category === 'payment') return <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 18 }} />;
    if (category === 'deed') return <FileTextOutlined style={{ color: '#722ed1', fontSize: 18 }} />;
    if (category === 'security') return <SafetyCertificateOutlined style={{ color: '#faad14', fontSize: 18 }} />;
    if (type === 'error') return <CloseCircleOutlined style={{ color: '#ff4d4f', fontSize: 18 }} />;
    if (type === 'warning') return <WarningOutlined style={{ color: '#faad14', fontSize: 18 }} />;
    return <BellOutlined style={{ color: '#2E5E8C', fontSize: 18 }} />;
  };

  const handleNotificationClick = (n: SystemNotification) => {
    markNotificationAsRead(n.id);
    setSystemNotifications(getStoredNotifications());
    if (n.link) {
      setNotificationDrawer(false);
      navigate(n.link);
    }
  };

  const handleMarkAllRead = () => {
    markAllNotificationsAsRead();
    setSystemNotifications(getStoredNotifications());
    message.success('All notifications marked as read');
  };

  const renderNotificationDrawer = () => (
    <Drawer
      title={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <Space>
            <BellOutlined style={{ color: '#2E5E8C' }} />
            <span style={{ fontWeight: 700 }}>Notifications & Live Updates</span>
            {unreadCount > 0 && <Badge count={unreadCount} style={{ backgroundColor: '#ff4d4f' }} />}
          </Space>
          {unreadCount > 0 && (
            <Button size="small" type="link" icon={<CheckOutlined />} onClick={handleMarkAllRead}>
              Mark all read
            </Button>
          )}
        </div>
      }
      placement="right"
      open={notificationDrawer}
      onClose={() => setNotificationDrawer(false)}
      width={440}
      bodyStyle={{ padding: 0 }}
    >
      <div style={{ padding: '8px 16px', background: '#fafafa', borderBottom: '1px solid #f0f0f0' }}>
        <Tabs
          activeKey={activeCategory}
          onChange={setActiveCategory}
          size="small"
          items={[
            { key: 'all', label: `All (${systemNotifications.length})` },
            { key: 'attendance', label: 'Attendance' },
            { key: 'payroll', label: 'Payroll & Bonuses' },
            { key: 'payment', label: 'Sales & Deeds' },
            { key: 'security', label: 'Security Sentinel' },
          ]}
        />
      </div>

      {filteredNotifications.length > 0 ? (
        <List
          dataSource={filteredNotifications}
          renderItem={(item: SystemNotification) => (
            <List.Item
              style={{
                padding: '14px 18px',
                borderBottom: '1px solid #f0f0f0',
                cursor: 'pointer',
                background: item.read ? '#fff' : '#f0f9ff',
                transition: 'background 0.2s',
              }}
              onClick={() => handleNotificationClick(item)}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#e6f4ff';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = item.read ? '#fff' : '#f0f9ff';
              }}
            >
              <List.Item.Meta
                avatar={
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: item.type === 'error' ? '#fff1f0' : item.type === 'warning' ? '#fffbe6' : '#e6f7ff',
                    }}
                  >
                    {getCategoryIcon(item.category, item.type)}
                  </div>
                }
                title={
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text strong style={{ fontSize: 13, color: '#1e293b' }}>
                      {item.title}
                    </Text>
                    {!item.read && <Badge status="processing" />}
                  </div>
                }
                description={
                  <div style={{ marginTop: 2 }}>
                    <Text style={{ fontSize: 12, color: '#475569', display: 'block', lineHeight: 1.4 }}>
                      {item.message}
                    </Text>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        {item.timestamp ? dayjs(item.timestamp).fromNow() : 'Recently'}
                      </Text>
                      {item.branchName && (
                        <Tag color="cyan" style={{ fontSize: 10, margin: 0, padding: '0 6px', borderRadius: 8 }}>
                          {item.branchName}
                        </Tag>
                      )}
                    </div>
                  </div>
                }
              />
            </List.Item>
          )}
        />
      ) : (
        <div style={{ padding: '60px 20px', textAlign: 'center' }}>
          <BellOutlined style={{ fontSize: 44, color: '#cbd5e1' }} />
          <p style={{ marginTop: 12, color: '#94a3b8', fontSize: 13 }}>No notifications in this category</p>
        </div>
      )}

      <div style={{ padding: '12px 16px', borderTop: '1px solid #f0f0f0', background: '#fff' }}>
        <Button
          type="primary"
          ghost
          block
          onClick={() => {
            setNotificationDrawer(false);
            navigate('/notifications');
          }}
        >
          View Full Notifications Center
        </Button>
      </div>
    </Drawer>
  );

  if (userLoading) {
    return (
      <Header style={{ 
        background: '#fff', 
        padding: '0 24px',
        height: 64,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        borderBottom: '1px solid #f0f0f0',
        width: '100%',
      }}>
        <div>
          <Text strong style={{ fontSize: 18, color: '#2E5E8C' }}>
            Omark Real Estate
          </Text>
        </div>
        <Space>
          <Spin size="small" />
        </Space>
      </Header>
    );
  }

  return (
    <>
      <Header style={{ 
        background: '#fff', 
        padding: '0 24px',
        height: 64,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        borderBottom: '1px solid #f0f0f0',
        width: '100%',
        position: 'sticky',
        top: 0,
        zIndex: 1000,
      }}>
        {/* Left side - App Title */}
        <div>
          <Text strong style={{ fontSize: 18, color: '#2E5E8C' }}>
            Omark Real Estate
          </Text>
        </div>
        
        {/* Right side - User info and actions */}
        {user && (
          <Space size="middle">
            {/* Live Staff Attendance Punch Pill */}
            <StaffClockWidget />

            {/* Notifications Bell */}
            <Badge count={unreadCount} offset={[-4, 4]}>
              <BellOutlined
                style={{ fontSize: 20, cursor: 'pointer', color: unreadCount > 0 ? '#1e293b' : '#64748b' }}
                onClick={() => {
                  setNotificationDrawer(true);
                  if (canSeeSmsLogs) refetchNotifications();
                }}
              />
            </Badge>

            {/* Role Tag */}
            <Tag color="blue" style={{ margin: 0, padding: '4px 12px', borderRadius: 12, fontWeight: 500 }}>
              {branchRoleTitle}
            </Tag>
            
            {/* User Dropdown */}
            <Dropdown menu={{ items: userMenuItems }} placement="bottomRight" trigger={['click']}>
              <Space style={{ cursor: 'pointer', padding: '4px 8px', borderRadius: 4 }}>
                <PhotoUpload
                  entityType="staff"
                  entityId={currentUser?.id || user.id}
                  size={36}
                  src={currentUser?.avatarUrl || currentUser?.photoUrl || user.avatarUrl || user.photoUrl}
                  editable={false}
                />
                <Space direction="vertical" size={0} style={{ lineHeight: 1.2 }}>
                  <Text strong style={{ fontSize: 14 }}>
                    {user.firstName} {user.lastName}
                  </Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {user.email}
                  </Text>
                </Space>
                <DownOutlined style={{ fontSize: 12, marginLeft: 4 }} />
              </Space>
            </Dropdown>
          </Space>
        )}
      </Header>


      {/* Notification Drawer */}
      {renderNotificationDrawer()}
    </>
  );
};