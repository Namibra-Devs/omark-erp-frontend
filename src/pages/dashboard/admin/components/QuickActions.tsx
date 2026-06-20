// src/pages/dashboard/admin/components/QuickActions.tsx
import React from 'react';
import { Card, Row, Col, Button } from 'antd';
import { 
  PlusOutlined, 
  UserOutlined, 
  SettingOutlined, 
  ExportOutlined, 
  AuditOutlined, 
  DatabaseOutlined
} from '@ant-design/icons';
import { tokens } from '@/constants/tokens';

interface QuickActionsProps {
  onAddUser: () => void;
  onManageUsers: () => void;
  onSystemSettings: () => void;
  onExport: () => void;
  onAuditLog: () => void;
  onBackup: () => void;
  loading?: boolean;
}

export const QuickActions: React.FC<QuickActionsProps> = ({
  onAddUser,
  onManageUsers,
  onSystemSettings,
  onExport,
  onAuditLog,
  onBackup,
  loading,
}) => {
  const actions = [
    { 
      icon: <PlusOutlined />, 
      label: 'Add Staff', 
      onClick: onAddUser,
      type: 'primary' as const,
      color: tokens.primary,
    },
    { 
      icon: <UserOutlined />, 
      label: 'Manage Users', 
      onClick: onManageUsers,
      type: 'default' as const,
    },
    { 
      icon: <SettingOutlined />, 
      label: 'System Settings', 
      onClick: onSystemSettings,
      type: 'default' as const,
    },
    { 
      icon: <ExportOutlined />, 
      label: 'Export Data', 
      onClick: onExport,
      type: 'default' as const,
    },
    { 
      icon: <AuditOutlined />, 
      label: 'Audit Log', 
      onClick: onAuditLog,
      type: 'default' as const,
    },
    { 
      icon: <DatabaseOutlined />, 
      label: 'Backup', 
      onClick: onBackup,
      type: 'default' as const,
    },
  ];

  return (
    <Card title="Quick Actions">
      <Row gutter={[16, 16]}>
        {actions.map((action, index) => (
          <Col xs={12} sm={8} lg={4} key={index}>
            <Button 
              type={action.type}
              block 
              icon={action.icon}
              onClick={action.onClick}
              style={{ 
                height: 80, 
                flexDirection: 'column',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
                borderColor: action.color ? action.color : undefined,
                background: action.type === 'primary' ? action.color : undefined,
                color: action.type === 'primary' ? 'white' : undefined,
              }}
              loading={loading}
            >
              <div style={{ fontSize: 12 }}>{action.label}</div>
            </Button>
          </Col>
        ))}
      </Row>
    </Card>
  );
};