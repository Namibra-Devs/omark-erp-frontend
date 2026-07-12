// src/pages/dashboard/admin/components/UserManagement.tsx
import React, { useState } from 'react';
import {
  Card, Table, Input, Select, Button, Space, Tag, Avatar,
  Typography, Tooltip, Popconfirm, Badge, Empty, message, Modal
} from 'antd';
import {
  SearchOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  LockOutlined,
  UnlockOutlined,
  UserOutlined,
  UserAddOutlined,
  ReloadOutlined,
  FilterOutlined,
  ExclamationCircleOutlined,
  StopOutlined,
  CheckCircleOutlined,
  EyeOutlined,
  EyeInvisibleOutlined,
  CopyOutlined,
} from '@ant-design/icons';
import { roleLabels } from '@/constants/enums';
import { tokens } from '@/constants/tokens';
import type { User } from '../types';

const { Text } = Typography;
const { Option } = Select;

interface UserManagementProps {
  users: User[];
  loading?: boolean;
  searchText: string;
  filterRole: string;
  onSearchChange: (value: string) => void;
  onFilterChange: (value: string) => void;
  onAddUser: () => void;
  onEditUser: (user: User) => void;
  onDeleteUser: (id: string) => void;
  onToggleStatus: (id: string) => void;
  onRefresh?: () => void;
}

export const UserManagement: React.FC<UserManagementProps> = ({
  users,
  loading,
  searchText,
  filterRole,
  onSearchChange,
  onFilterChange,
  onAddUser,
  onEditUser,
  onDeleteUser,
  onToggleStatus,
  onRefresh,
}) => {
  // Row ids whose password is currently revealed (masked by default).
  const [revealedIds, setRevealedIds] = useState<Set<string>>(new Set());

  const toggleReveal = (id: string) => {
    setRevealedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const copyPassword = async (password: string) => {
    try {
      await navigator.clipboard.writeText(password);
      message.success('Password copied to clipboard');
    } catch {
      message.error('Could not copy — please copy it manually');
    }
  };

  // Get status counts
  const activeCount = users.filter(u => u.status === 'active').length;
  const inactiveCount = users.filter(u => u.status === 'inactive').length;
  const adminCount = users.filter(u => u.role === 'admin').length;

  // Role color mapping
  const getRoleColor = (role: string) => {
    const colors: Record<string, string> = {
      admin: 'red',
      marketing_director: 'purple',
      marketing_staff: 'blue',
      customer_service: 'cyan',
      secretary: 'orange',
      accounts: 'green',
    };
    return colors[role] || 'default';
  };

  // Handle delete with confirmation
  const handleDelete = (record: User) => {
    const displayName = record.name || `${record.firstName || ''} ${record.lastName || ''}`.trim() || record.email;
    
    Modal.confirm({
      title: (
        <Space>
          <ExclamationCircleOutlined style={{ color: '#ff4d4f', fontSize: 20 }} />
          <span style={{ fontSize: 16 }}>Delete User</span>
        </Space>
      ),
      content: (
        <div style={{ marginTop: 8 }}>
          <p style={{ marginBottom: 8 }}>
            Are you sure you want to permanently delete <strong>{displayName}</strong>?
          </p>
          <div style={{ 
            padding: 12, 
            background: '#fff1f0', 
            borderRadius: 6,
            border: '1px solid #ffa39e'
          }}>
            <Text type="danger" style={{ fontSize: 13 }}>
              <DeleteOutlined /> This action cannot be undone. All associated data will be permanently removed.
            </Text>
          </div>
          <div style={{ marginTop: 8, fontSize: 13 }}>
            <Text type="secondary">Email: </Text>
            <Text code>{record.email}</Text>
          </div>
          <div style={{ fontSize: 13 }}>
            <Text type="secondary">Role: </Text>
            <Tag color={getRoleColor(record.role)} style={{ margin: 0 }}>
              {roleLabels[record.role as keyof typeof roleLabels] || record.role}
            </Tag>
          </div>
        </div>
      ),
      okText: 'Yes, Delete Permanently',
      okType: 'danger',
      cancelText: 'Cancel',
      icon: null,
      onOk: () => {
        console.log('🗑️ Deleting user with ID:', record.id);
        onDeleteUser(record.id);
      },
    });
  };

  // Handle deactivation with confirmation
  const handleDeactivate = (record: User) => {
    const displayName = record.name || `${record.firstName || ''} ${record.lastName || ''}`.trim() || record.email;
    
    Modal.confirm({
      title: (
        <Space>
          <StopOutlined style={{ color: '#faad14', fontSize: 20 }} />
          <span style={{ fontSize: 16 }}>Deactivate User</span>
        </Space>
      ),
      content: (
        <div style={{ marginTop: 8 }}>
          <p style={{ marginBottom: 8 }}>
            Are you sure you want to deactivate <strong>{displayName}</strong>?
          </p>
          <div style={{ 
            padding: 12, 
            background: '#fffbe6', 
            borderRadius: 6,
            border: '1px solid #ffe58f'
          }}>
            <Text type="warning" style={{ fontSize: 13 }}>
              <StopOutlined /> This user will lose access to the system.
            </Text>
          </div>
          <div style={{ marginTop: 8, fontSize: 13 }}>
            <Text type="secondary">Email: </Text>
            <Text code>{record.email}</Text>
          </div>
          <div style={{ fontSize: 13 }}>
            <Text type="secondary">Role: </Text>
            <Tag color={getRoleColor(record.role)} style={{ margin: 0 }}>
              {roleLabels[record.role as keyof typeof roleLabels] || record.role}
            </Tag>
          </div>
        </div>
      ),
      okText: 'Yes, Deactivate',
      okType: 'danger',
      cancelText: 'Cancel',
      icon: null,
      onOk: () => {
        console.log('🔒 Deactivating user with ID:', record.id);
        onToggleStatus(record.id);
      },
    });
  };

  // Handle reactivation
  const handleReactivate = (record: User) => {
    const displayName = record.name || `${record.firstName || ''} ${record.lastName || ''}`.trim() || record.email;
    
    Modal.confirm({
      title: (
        <Space>
          <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 20 }} />
          <span style={{ fontSize: 16 }}>Activate User</span>
        </Space>
      ),
      content: (
        <div style={{ marginTop: 8 }}>
          <p style={{ marginBottom: 8 }}>
            Are you sure you want to activate <strong>{displayName}</strong>?
          </p>
          <div style={{ 
            padding: 12, 
            background: '#f6ffed', 
            borderRadius: 6,
            border: '1px solid #b7eb8f'
          }}>
            <Text type="success" style={{ fontSize: 13 }}>
              <CheckCircleOutlined /> This user will regain access to the system.
            </Text>
          </div>
          <div style={{ marginTop: 8, fontSize: 13 }}>
            <Text type="secondary">Email: </Text>
            <Text code>{record.email}</Text>
          </div>
          <div style={{ fontSize: 13 }}>
            <Text type="secondary">Role: </Text>
            <Tag color={getRoleColor(record.role)} style={{ margin: 0 }}>
              {roleLabels[record.role as keyof typeof roleLabels] || record.role}
            </Tag>
          </div>
        </div>
      ),
      okText: 'Yes, Activate',
      okType: 'primary',
      cancelText: 'Cancel',
      icon: null,
      onOk: () => {
        console.log('🔓 Activating user with ID:', record.id);
        onToggleStatus(record.id);
      },
    });
  };

  const columns = [
    {
      title: 'User',
      key: 'user',
      width: 220,
      render: (_: any, record: User) => {
        const fullName = record.name || `${record.firstName || ''} ${record.lastName || ''}`.trim() || record.email;
        return (
          <Space>
            <Avatar 
              icon={<UserOutlined />} 
              style={{ 
                backgroundColor: record.status === 'active' ? tokens.primary : '#d9d9d9',
                flexShrink: 0
              }} 
            />
            <div style={{ minWidth: 0 }}>
              <Text strong style={{ display: 'block', fontSize: 13 }}>
                {fullName}
              </Text>
              <Text type="secondary" style={{ fontSize: 11 }}>
                {record.email}
              </Text>
            </div>
          </Space>
        );
      },
    },
    {
      title: 'Role',
      dataIndex: 'role',
      key: 'role',
      width: 140,
      render: (role: string) => (
        <Tag color={getRoleColor(role)} style={{ borderRadius: 12, padding: '2px 12px' }}>
          {roleLabels[role as keyof typeof roleLabels] || role}
        </Tag>
      ),
    },
    {
      title: 'Login Password',
      key: 'createdPassword',
      width: 200,
      render: (_: any, record: User) => {
        if (!record.createdPassword) {
          return (
            <Tooltip title="Only shown once, right after an account is created in this session — the server never returns passwords again.">
              <Text type="secondary" style={{ fontSize: 12 }}>Not available</Text>
            </Tooltip>
          );
        }
        const revealed = revealedIds.has(record.id);
        return (
          <Space size={4}>
            <Text code style={{ fontSize: 12 }}>
              {revealed ? record.createdPassword : '•'.repeat(10)}
            </Text>
            <Tooltip title={revealed ? 'Hide' : 'Reveal'}>
              <Button
                type="text"
                size="small"
                icon={revealed ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                onClick={() => toggleReveal(record.id)}
              />
            </Tooltip>
            <Tooltip title="Copy password">
              <Button
                type="text"
                size="small"
                icon={<CopyOutlined />}
                onClick={() => copyPassword(record.createdPassword!)}
              />
            </Tooltip>
          </Space>
        );
      },
    },
    {
      title: 'Status',
      key: 'status',
      width: 120,
      render: (_: any, record: User) => {
        const isUserActive = (record as any).isActive ?? record.status === 'active';
        return (
          <Badge 
            status={isUserActive ? 'success' : 'error'}
            text={
              <Text style={{ fontSize: 12, fontWeight: 500 }}>
                {isUserActive ? 'ACTIVE' : 'INACTIVE'}
              </Text>
            }
          />
        );
      },
    },
    {
      title: 'Joined',
      dataIndex: 'joined',
      key: 'joined',
      width: 120,
      render: (date: string) => date ? new Date(date).toLocaleDateString() : 'N/A',
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 280,
      render: (_: any, record: User) => {
        const isUserActive = (record as any).isActive ?? record.status === 'active';
        const displayName = record.name || `${record.firstName || ''} ${record.lastName || ''}`.trim();
        return (
          <Space size="small">
            <Tooltip title="Edit User">
              <Button 
                type="text" 
                icon={<EditOutlined />} 
                onClick={() => onEditUser(record)}
                size="small"
              />
            </Tooltip>
            {isUserActive ? (
              <Tooltip title="Deactivate User">
                <Button 
                  type="text" 
                  icon={<StopOutlined />} 
                  onClick={() => handleDeactivate(record)}
                  size="small"
                  style={{ color: '#faad14' }}
                />
              </Tooltip>
            ) : (
              <Tooltip title="Activate User">
                <Button 
                  type="text" 
                  icon={<CheckCircleOutlined />} 
                  onClick={() => handleReactivate(record)}
                  size="small"
                  style={{ color: '#52c41a' }}
                />
              </Tooltip>
            )}
            <Tooltip title="Delete User (Permanent)">
              <Button 
                type="text" 
                danger 
                icon={<DeleteOutlined />} 
                onClick={() => handleDelete(record)}
                size="small"
              />
            </Tooltip>
          </Space>
        );
      },
    },
  ];

  return (
    <Card 
      style={{ borderRadius: 12 }}
      bodyStyle={{ padding: '16px' }}
    >
      {/* Stats Summary */}
      <div style={{ 
        display: 'flex', 
        gap: 24, 
        flexWrap: 'wrap',
        padding: '12px 16px',
        background: '#fafafa',
        borderRadius: 8,
        marginBottom: 16,
        border: '1px solid #f0f0f0'
      }}>
        <div>
          <Text type="secondary" style={{ fontSize: 12 }}>Total Users</Text>
          <div style={{ fontSize: 20, fontWeight: 'bold', color: tokens.primary }}>
            {users.length}
          </div>
        </div>
        <div>
          <Text type="secondary" style={{ fontSize: 12 }}>Active</Text>
          <div style={{ fontSize: 20, fontWeight: 'bold', color: '#52c41a' }}>
            {activeCount}
          </div>
        </div>
        <div>
          <Text type="secondary" style={{ fontSize: 12 }}>Inactive</Text>
          <div style={{ fontSize: 20, fontWeight: 'bold', color: '#ff4d4f' }}>
            {inactiveCount}
          </div>
        </div>
        <div>
          <Text type="secondary" style={{ fontSize: 12 }}>Admins</Text>
          <div style={{ fontSize: 20, fontWeight: 'bold', color: '#f5222d' }}>
            {adminCount}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div style={{ marginBottom: 16, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <Input
          placeholder="Search by name or email..."
          prefix={<SearchOutlined style={{ color: '#bbb' }} />}
          value={searchText}
          onChange={(e) => onSearchChange(e.target.value)}
          style={{ width: 260 }}
          allowClear
          size="middle"
        />
        <Select
          value={filterRole}
          onChange={onFilterChange}
          style={{ width: 180 }}
          size="middle"
          prefix={<FilterOutlined style={{ color: '#bbb' }} />}
        >
          <Option value="all">All Roles</Option>
          <Option value="admin">👑 Admin</Option>
          <Option value="marketing_director">📊 Marketing Director</Option>
          <Option value="marketing_staff">📝 Marketing Staff</Option>
          <Option value="customer_service">💬 Customer Service</Option>
          <Option value="secretary">📋 Secretary</Option>
          <Option value="accounts">💰 Accounts</Option>
        </Select>
        <Button 
          icon={<PlusOutlined />} 
          type="primary" 
          onClick={onAddUser}
          size="middle"
        >
          Add Staff
        </Button>
        {onRefresh && (
          <Button 
            icon={<ReloadOutlined />} 
            onClick={onRefresh}
            loading={loading}
            size="middle"
          >
            Refresh
          </Button>
        )}
        <Text type="secondary" style={{ marginLeft: 'auto', fontSize: 13 }}>
          Showing {users.length} of {users.length} users
        </Text>
      </div>

      {/* Table */}
      <Table
        columns={columns}
        dataSource={users}
        rowKey="id"
        loading={loading}
        size="middle"
        pagination={{
          pageSize: 5,
          showSizeChanger: true,
          showTotal: (total) => `Total ${total} users`,
          pageSizeOptions: ['5', '10', '20', '50'],
        }}
        locale={{
          emptyText: (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                <div>
                  <Text type="secondary">No users found</Text>
                  <br />
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {searchText ? 'Try adjusting your search or filters' : 'Click "Add Staff" to create your first user'}
                  </Text>
                </div>
              }
            />
          )
        }}
        rowClassName={(record) => 
          record.status === 'inactive' ? 'inactive-row' : ''
        }
      />

      <style>{`
        .inactive-row td {
          opacity: 0.6;
        }
        .inactive-row:hover td {
          opacity: 0.8;
        }
      `}</style>
    </Card>
  );
};