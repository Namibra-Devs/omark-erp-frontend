// src/pages/dashboard/admin/components/QuickActions.tsx
import React from 'react';
import { Card, Row, Col, Button, Space, Typography, Badge, Tooltip } from 'antd';
import {
  UserAddOutlined,
  TeamOutlined,
  ExportOutlined,
  ReloadOutlined,
  SettingOutlined,
  FileTextOutlined,
  PlusOutlined,
  BellOutlined,
} from '@ant-design/icons';

const { Text } = Typography;

interface QuickActionsProps {
  onAddUser: () => void;
  onManageUsers: () => void;
  onExport: () => void;
  onRefresh?: () => void;
  onSettings?: () => void;
  onViewNotifications?: () => void;
  pendingNotifications?: number;
  loading?: boolean;
}

export const QuickActions: React.FC<QuickActionsProps> = ({
  onAddUser,
  onManageUsers,
  onExport,
  onRefresh,
  onSettings,
  onViewNotifications,
  pendingNotifications = 0,
  loading = false,
}) => {
  const actions = [
    {
      key: 'add-user',
      icon: <UserAddOutlined style={{ fontSize: 20 }} />,
      label: 'Add Staff',
      description: 'Create new user account',
      color: '#1890ff',
      bg: '#e6f7ff',
      onClick: onAddUser,
    },
    {
      key: 'manage-users',
      icon: <TeamOutlined style={{ fontSize: 20 }} />,
      label: 'Manage Users',
      description: 'View & edit staff profiles',
      color: '#52c41a',
      bg: '#f6ffed',
      onClick: onManageUsers,
    },
    {
      key: 'export',
      icon: <ExportOutlined style={{ fontSize: 20 }} />,
      label: 'Export Data',
      description: 'Download reports & data',
      color: '#722ed1',
      bg: '#f9f0ff',
      onClick: onExport,
    },
  ];

  // Additional actions for the right side (optional)
  const additionalActions = [
    {
      key: 'notifications',
      icon: (
        <Badge count={pendingNotifications} size="small">
          <BellOutlined style={{ fontSize: 18 }} />
        </Badge>
      ),
      label: 'Notifications',
      description: `${pendingNotifications} pending`,
      color: pendingNotifications > 0 ? '#ff4d4f' : '#d9d9d9',
      onClick: onViewNotifications,
      show: !!onViewNotifications,
    },
    {
      key: 'refresh',
      icon: <ReloadOutlined style={{ fontSize: 18, animation: loading ? 'spin 1s linear infinite' : 'none' }} />,
      label: 'Refresh',
      description: 'Update dashboard',
      color: '#1890ff',
      onClick: onRefresh,
      show: !!onRefresh,
    },
  ];

  return (
    <Card 
      title={
        <Space>
          <span>Quick Actions</span>
          {pendingNotifications > 0 && (
            <Badge count={pendingNotifications} style={{ marginLeft: 4 }} />
          )}
        </Space>
      }
      size="small"
      style={{ borderRadius: 12 }}
      bodyStyle={{ padding: '12px 16px' }}
      extra={
        <Button 
          type="text" 
          size="small" 
          icon={<ReloadOutlined spin={loading} />}
          onClick={onRefresh}
          loading={loading}
        >
          Refresh
        </Button>
      }
    >
      <Row gutter={[16, 16]} justify="start">
        {actions.map((action) => (
          <Col key={action.key}>
            <Button
              type="text"
              onClick={action.onClick}
              style={{
                height: 'auto',
                padding: '12px 20px',
                borderRadius: 10,
                background: '#fafafa',
                border: '1px solid #f0f0f0',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: 140,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = action.bg || '#f0f0f0';
                e.currentTarget.style.transform = 'translateY(-3px)';
                e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.1)';
                e.currentTarget.style.borderColor = action.color;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#fafafa';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
                e.currentTarget.style.borderColor = '#f0f0f0';
              }}
            >
              <Space direction="vertical" size={4} align="center">
                <Space>
                  <span style={{ color: action.color, fontSize: 20 }}>{action.icon}</span>
                  <Text strong style={{ fontSize: 14 }}>{action.label}</Text>
                </Space>
                <Text type="secondary" style={{ fontSize: 11, textAlign: 'center' }}>
                  {action.description}
                </Text>
              </Space>
            </Button>
          </Col>
        ))}

        {/* Additional actions */}
        {additionalActions.filter(a => a.show).map((action) => (
          <Col key={action.key}>
            <Tooltip title={action.description}>
              <Button
                type="text"
                onClick={action.onClick}
                style={{
                  height: 'auto',
                  padding: '12px 16px',
                  borderRadius: 10,
                  background: '#fafafa',
                  border: '1px solid #f0f0f0',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#f5f5f5';
                  e.currentTarget.style.transform = 'translateY(-3px)';
                  e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#fafafa';
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <Space direction="vertical" size={4} align="center">
                  <span style={{ color: action.color, fontSize: 20 }}>
                    {action.icon}
                  </span>
                  <Text strong style={{ fontSize: 12 }}>{action.label}</Text>
                </Space>
              </Button>
            </Tooltip>
          </Col>
        ))}
      </Row>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </Card>
  );
};