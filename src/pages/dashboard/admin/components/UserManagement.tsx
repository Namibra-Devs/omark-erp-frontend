// src/pages/dashboard/admin/components/UserManagement.tsx
import React, { useState } from 'react';
import { 
  Card, Table, Input, Select, Button, Space, Tag, Avatar, 
  Typography, Tooltip, Popconfirm, message, Badge
} from 'antd';
import { 
  SearchOutlined, 
  PlusOutlined, 
  EditOutlined, 
  DeleteOutlined, 
  LockOutlined, 
  UnlockOutlined,
  UserOutlined
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
}) => {
  const columns = [
    {
      title: 'User',
      key: 'user',
      render: (_: any, record: User) => (
        <Space>
          <Avatar icon={<UserOutlined />} style={{ backgroundColor: tokens.primary }} />
          <div>
            <Text strong>{record.name}</Text>
            <br />
            <Text type="secondary" style={{ fontSize: 12 }}>{record.email}</Text>
          </div>
        </Space>
      ),
    },
    {
      title: 'Role',
      dataIndex: 'role',
      key: 'role',
      render: (role: string) => (
        <Tag color={role === 'admin' ? 'red' : role === 'marketing_director' ? 'purple' : 'blue'}>
          {roleLabels[role as keyof typeof roleLabels]}
        </Tag>
      ),
    },
    {
      title: 'Department',
      dataIndex: 'department',
      key: 'department',
      render: (dept: string) => <Text>{dept || 'N/A'}</Text>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Badge 
          status={status === 'active' ? 'success' : status === 'suspended' ? 'warning' : 'error'}
          text={status.toUpperCase()}
        />
      ),
    },
    {
      title: 'Joined',
      dataIndex: 'joined',
      key: 'joined',
      render: (date: string) => new Date(date).toLocaleDateString(),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: User) => (
        <Space>
          <Tooltip title="Edit User">
            <Button 
              type="text" 
              icon={<EditOutlined />} 
              onClick={() => onEditUser(record)}
            />
          </Tooltip>
          <Tooltip title={record.status === 'active' ? 'Deactivate User' : 'Activate User'}>
            <Button 
              type="text" 
              icon={record.status === 'active' ? <LockOutlined /> : <UnlockOutlined />}
              onClick={() => onToggleStatus(record.id)}
            />
          </Tooltip>
          <Popconfirm
            title="Delete User"
            description={`Are you sure you want to delete ${record.name}?`}
            onConfirm={() => onDeleteUser(record.id)}
            okText="Yes"
            cancelText="No"
          >
            <Tooltip title="Delete User">
              <Button type="text" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Card>
      <div style={{ marginBottom: 16, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <Input
          placeholder="Search users..."
          prefix={<SearchOutlined />}
          value={searchText}
          onChange={(e) => onSearchChange(e.target.value)}
          style={{ width: 300 }}
          allowClear
        />
        <Select
          value={filterRole}
          onChange={onFilterChange}
          style={{ width: 200 }}
        >
          <Option value="all">All Roles</Option>
          <Option value="admin">Admin</Option>
          <Option value="marketing_staff">Marketing Staff</Option>
          <Option value="marketing_director">Marketing Director</Option>
          <Option value="customer_service">Customer Service</Option>
          <Option value="secretary">Secretary</Option>
          <Option value="accounts">Accounts</Option>
        </Select>
        <Button icon={<PlusOutlined />} type="primary" onClick={onAddUser}>
          Add Staff
        </Button>
        <Text type="secondary" style={{ marginLeft: 'auto', alignSelf: 'center' }}>
          Total: {users.length} users
        </Text>
      </div>

      <Table
        columns={columns}
        dataSource={users}
        rowKey="id"
        loading={loading}
        pagination={{
          pageSize: 5,
          showSizeChanger: true,
          showTotal: (total) => `Total ${total} users`,
        }}
      />
    </Card>
  );
};