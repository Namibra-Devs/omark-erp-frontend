// src/components/layout/TopHeader.tsx (Enhanced with shadow and better styling)
import React from 'react';
import { Layout, Space, Typography, Tag, Dropdown, Avatar, Badge } from 'antd';
import { 
  UserOutlined, 
  LogoutOutlined, 
  DownOutlined,
  BellOutlined,
  SettingOutlined,
  QuestionCircleOutlined
} from '@ant-design/icons';
import { useAuth } from '@/contexts/AuthContext';
import { roleLabels } from '@/constants/enums';

const { Header } = Layout;
const { Text } = Typography;

export const TopHeader: React.FC = () => {
  const { user, logout } = useAuth();
  
  const userMenuItems = [
    {
      key: 'profile',
      label: 'My Profile',
      icon: <UserOutlined />,
    },
    {
      key: 'settings',
      label: 'Settings',
      icon: <SettingOutlined />,
    },
    {
      type: 'divider' as const,
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: 'Logout',
      onClick: logout,
      danger: true,
    },
  ];
  
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
          <Badge dot={true} offset={[-4, 4]}>
            <BellOutlined style={{ fontSize: 20, cursor: 'pointer' }} />
          </Badge>
          
          {/* Help Icon */}
          <QuestionCircleOutlined style={{ fontSize: 20, cursor: 'pointer' }} />
          
          {/* Role Tag */}
          <Tag color="blue" style={{ margin: 0, padding: '2px 12px' }}>
            {roleLabels[user.role]}
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
  );
};