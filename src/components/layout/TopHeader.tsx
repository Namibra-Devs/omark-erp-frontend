// src/components/layout/TopHeader.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout, Space, Typography, Tag, Dropdown, Avatar, Badge, Modal, Form, Input, Button, message, List, Spin, Empty, Drawer, Divider } from 'antd';
import {
  UserOutlined,
  LogoutOutlined,
  DownOutlined,
  BellOutlined,
  SettingOutlined,
  EditOutlined,
  MailOutlined,
  PhoneOutlined,
  CloseOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined
} from '@ant-design/icons';
import { useAuth } from '@/contexts/AuthContext';
import { roleLabels } from '@/constants/enums';
import { useUserQuery, useUpdateUserMutation } from '@/api/users';
import { useNotificationsQuery, usePendingNotificationsCountQuery, type NotificationLog } from '@/api/notifications';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

const { Header } = Layout;
const { Text } = Typography;

export const TopHeader: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout, hasRole } = useAuth();
  const [profileModal, setProfileModal] = useState(false);
  const [notificationDrawer, setNotificationDrawer] = useState(false);
  const [form] = Form.useForm();

  // GET /notifications is only accessible to admin/secretary/accounts on
  // the backend — every other role 403s, so the bell/drawer are hidden
  // entirely for them rather than showing a broken control.
  const canSeeNotifications = hasRole(['admin', 'secretary', 'accounts']);

  // ── API Queries ────────────────────────────────────────────────────────────
  const {
    data: userData,
    isLoading: userLoading,
    refetch: refetchUser
  } = useUserQuery(user?.id || '');

  // The drawer lists recent notifications regardless of status (sent,
  // pending, failed) — not just pending ones — so it's an actual activity
  // list rather than a narrow to-do queue.
  const {
    data: notificationsData,
    isLoading: notificationsLoading,
    refetch: refetchNotifications
  } = useNotificationsQuery({ pageSize: 10 }, canSeeNotifications);

  // Sourced from the paginated total (not the 10 items on this page), so it
  // doesn't undercount once there are more than 10 pending notifications.
  const { data: pendingCount = 0 } = usePendingNotificationsCountQuery(canSeeNotifications);

  // ── API Mutations ──────────────────────────────────────────────────────────
  const updateUser = useUpdateUserMutation();

  // ── Data Extraction ──────────────────────────────────────────────────────
  const currentUser = userData || user;
  const notifications = notificationsData?.items ?? [];

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleUpdateProfile = async (values: any) => {
    if (!user?.id) return;

    try {
      await updateUser.mutateAsync({
        id: user.id,
        payload: {
          firstName: values.firstName,
          lastName: values.lastName,
          email: values.email,
          phoneNumber: values.phoneNumber,
        },
      });

      message.success('Profile updated successfully!');
      setProfileModal(false);
      refetchUser();
    } catch (error: any) {
      message.error(error?.message || 'Failed to update profile');
    }
  };

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
      onClick: () => {
        setProfileModal(true);
        form.setFieldsValue({
          firstName: currentUser?.firstName,
          lastName: currentUser?.lastName,
          email: currentUser?.email,
          phoneNumber: currentUser?.phoneNumber,
        });
      },
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

  // ── Notification Items ────────────────────────────────────────────────────
  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'contribution_due_soon':
        return <ClockCircleOutlined style={{ color: '#1890ff' }} />;
      case 'contribution_overdue':
        return <CloseCircleOutlined style={{ color: '#ff4d4f' }} />;
      default:
        return <BellOutlined style={{ color: '#faad14' }} />;
    }
  };

  const getNotificationStatusColor = (status: string) => {
    switch (status) {
      case 'sent': return 'green';
      case 'failed': return 'red';
      case 'pending': return 'blue';
      default: return 'default';
    }
  };

  const renderNotificationDrawer = () => (
    <Drawer
      title={
        <Space>
          <BellOutlined />
          <span>Notifications</span>
          <Badge count={pendingCount} style={{ marginLeft: 8 }} />
        </Space>
      }
      placement="right"
      open={notificationDrawer}
      onClose={() => setNotificationDrawer(false)}
      width={400}
      bodyStyle={{ padding: 0 }}
    >
      {notificationsLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
          <Spin />
        </div>
      ) : notifications.length > 0 ? (
        <List
          dataSource={notifications}
          renderItem={(item: NotificationLog) => (
            <List.Item
              style={{
                padding: '12px 16px',
                borderBottom: '1px solid #f0f0f0',
                cursor: 'pointer',
                transition: 'background 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#f5f5f5';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
            >
              <List.Item.Meta
                avatar={getNotificationIcon(item.type)}
                title={
                  <Space>
                    <Text strong>{item.type?.replace(/_/g, ' ').toUpperCase() || 'Notification'}</Text>
                    <Tag color={getNotificationStatusColor(item.status)}>
                      {item.status?.toUpperCase() || 'PENDING'}
                    </Tag>
                  </Space>
                }
                description={
                  <div>
                    <Text style={{ fontSize: 13 }}>{item.messageBody}</Text>
                    <br />
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      {dayjs(item.createdAt).fromNow()}
                    </Text>
                    {item.sentAt && (
                      <>
                        <br />
                        <Text type="secondary" style={{ fontSize: 11 }}>
                          Sent: {dayjs(item.sentAt).format('MMM DD, HH:mm')}
                        </Text>
                      </>
                    )}
                  </div>
                }
              />
            </List.Item>
          )}
        />
      ) : (
        <div style={{ padding: '40px 20px', textAlign: 'center' }}>
          <BellOutlined style={{ fontSize: 48, color: '#d9d9d9' }} />
          <p style={{ marginTop: 16, color: '#999' }}>No notifications</p>
        </div>
      )}
      <div style={{ padding: '12px 16px', borderTop: '1px solid #f0f0f0' }}>
        <Button
          type="link"
          block
          onClick={() => {
            setNotificationDrawer(false);
            navigate('/notifications');
          }}
        >
          View All Notifications
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
            {/* Notifications Bell */}
            {canSeeNotifications && (
              <Badge count={pendingCount} offset={[-4, 4]}>
                <BellOutlined
                  style={{ fontSize: 20, cursor: 'pointer' }}
                  onClick={() => {
                    setNotificationDrawer(true);
                    refetchNotifications();
                  }}
                />
              </Badge>
            )}

            {/* Role Tag */}
            <Tag color="blue" style={{ margin: 0, padding: '2px 12px' }}>
              {roleLabels[user.role as keyof typeof roleLabels] || user.role}
            </Tag>
            
            {/* User Dropdown */}
            <Dropdown menu={{ items: userMenuItems }} placement="bottomRight" trigger={['click']}>
              <Space style={{ cursor: 'pointer', padding: '4px 8px', borderRadius: 4 }}>
                <Avatar 
                  icon={<UserOutlined />} 
                  style={{ backgroundColor: '#2E5E8C' }}
                  size="default"
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

      {/* Profile Modal */}
      <Modal
        title={
          <Space>
            <UserOutlined />
            <span>My Profile</span>
          </Space>
        }
        open={profileModal}
        onCancel={() => setProfileModal(false)}
        footer={null}
        width={500}
        style={{ top: 20 }}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleUpdateProfile}
        >
          <Form.Item
            name="firstName"
            label="First Name"
            rules={[{ required: true, message: 'Please enter your first name' }]}
          >
            <Input prefix={<UserOutlined />} placeholder="First name" />
          </Form.Item>
          
          <Form.Item
            name="lastName"
            label="Last Name"
            rules={[{ required: true, message: 'Please enter your last name' }]}
          >
            <Input prefix={<UserOutlined />} placeholder="Last name" />
          </Form.Item>
          
          <Form.Item
            name="email"
            label="Email"
            rules={[
              { required: true, message: 'Please enter your email' },
              { type: 'email', message: 'Please enter a valid email' }
            ]}
          >
            <Input prefix={<MailOutlined />} placeholder="Email address" />
          </Form.Item>
          
          <Form.Item
            name="phoneNumber"
            label="Phone Number"
            rules={[{ required: true, message: 'Please enter your phone number' }]}
          >
            <Input prefix={<PhoneOutlined />} placeholder="Phone number" />
          </Form.Item>

          <Divider />

          <Form.Item>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={() => setProfileModal(false)}>
                Cancel
              </Button>
              <Button 
                type="primary" 
                htmlType="submit" 
                loading={updateUser.isPending}
              >
                Update Profile
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Notification Drawer */}
      {renderNotificationDrawer()}
    </>
  );
};