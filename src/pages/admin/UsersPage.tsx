// src/pages/admin/UsersPage.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button, Space, Modal, Form, Input, Select, Row, Col, Table,
  Tag, message, Typography, Card, Avatar, Badge, Tooltip,
  DatePicker, Statistic, Divider, Empty, Dropdown, Popconfirm,
  Alert, Drawer, Descriptions, Timeline, Tabs, Progress,
  Radio, Switch, InputNumber, Upload, List, Collapse, Checkbox
} from 'antd';
import {
  PlusOutlined,
  EyeOutlined,
  SearchOutlined,
  ReloadOutlined,
  ExportOutlined,
  PhoneOutlined,
  MailOutlined,
  UserOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  WarningOutlined,
  InfoCircleOutlined,
  EditOutlined,
  DeleteOutlined,
  FileExcelOutlined,
  FileTextOutlined,
  FilePdfOutlined,
  CodeOutlined,
  DownloadOutlined,
  CloseOutlined,
  ArrowLeftOutlined,
  ArrowRightOutlined,
  ShareAltOutlined,
  PrinterOutlined,
  GlobalOutlined,
  IdcardOutlined,
  HomeOutlined,
  DollarOutlined,
  FileOutlined,
  TeamOutlined,
  BankOutlined,
  PercentageOutlined,
  StarOutlined,
  StarFilled,
  HeartOutlined,
  HeartFilled,
  MessageOutlined,
  WhatsAppOutlined,
  EnvironmentOutlined,
  BuildOutlined,
  CarOutlined,
  ShopOutlined,
  ApartmentOutlined,
  FundOutlined,
  PieChartOutlined,
  LineChartOutlined,
  BarChartOutlined,
  FileProtectOutlined,
  SafetyOutlined,
  VerifyOutlined,
  CopyOutlined,
  NotificationOutlined,
  BellOutlined,
  SendOutlined,
  RetweetOutlined,
  FilterOutlined,
  BulbOutlined,
  ThunderboltOutlined,
  SoundOutlined,
  CustomerServiceOutlined,
  SettingOutlined,
  LockOutlined,
  UnlockOutlined,
  UserAddOutlined,
  UserDeleteOutlined,
  UserSwitchOutlined,
  CrownOutlined,
  StarOutlined as StarIcon,
  TrophyOutlined,
  AwardOutlined
} from '@ant-design/icons';
import { useAuth } from '@/contexts/AuthContext';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatusTag } from '@/components/shared/StatusTag';
import { PhoneInput } from '@/components/shared/PhoneInput';
import { tokens } from '@/constants/tokens';
import { roleLabels } from '@/constants/enums';
import type { User, Role } from '@/types';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import advancedFormat from 'dayjs/plugin/advancedFormat';

dayjs.extend(relativeTime);
dayjs.extend(advancedFormat);

const { Option } = Select;
const { TextArea } = Input;
const { Text, Title } = Typography;

// Mock Users Data
const mockUsers: User[] = [
  {
    id: '1',
    firstName: 'John',
    lastName: 'Admin',
    email: 'admin@omark.com',
    phoneNumber: '+233201234567',
    role: 'admin',
    isActive: true,
    createdAt: '2024-01-01T08:00:00Z',
    updatedAt: '2024-01-20T14:30:00Z',
  },
  {
    id: '2',
    firstName: 'Sarah',
    lastName: 'Marketing',
    email: 'sarah@omark.com',
    phoneNumber: '+233201234568',
    role: 'marketing_staff',
    isActive: true,
    createdAt: '2024-01-02T09:00:00Z',
    updatedAt: '2024-01-19T10:00:00Z',
  },
  {
    id: '3',
    firstName: 'Michael',
    lastName: 'Director',
    email: 'michael@omark.com',
    phoneNumber: '+233201234569',
    role: 'marketing_director',
    isActive: true,
    createdAt: '2024-01-03T10:00:00Z',
    updatedAt: '2024-01-18T11:30:00Z',
  },
  {
    id: '4',
    firstName: 'Emma',
    lastName: 'Service',
    email: 'emma@omark.com',
    phoneNumber: '+233201234570',
    role: 'customer_service',
    isActive: true,
    createdAt: '2024-01-04T11:00:00Z',
    updatedAt: '2024-01-17T09:15:00Z',
  },
  {
    id: '5',
    firstName: 'David',
    lastName: 'Secretary',
    email: 'david@omark.com',
    phoneNumber: '+233201234571',
    role: 'secretary',
    isActive: true,
    createdAt: '2024-01-05T12:00:00Z',
    updatedAt: '2024-01-16T16:45:00Z',
  },
  {
    id: '6',
    firstName: 'Lisa',
    lastName: 'Accounts',
    email: 'lisa@omark.com',
    phoneNumber: '+233201234572',
    role: 'accounts',
    isActive: true,
    createdAt: '2024-01-06T13:00:00Z',
    updatedAt: '2024-01-15T14:20:00Z',
  },
  {
    id: '7',
    firstName: 'James',
    lastName: 'Wilson',
    email: 'james@omark.com',
    phoneNumber: '+233201234573',
    role: 'marketing_staff',
    isActive: false,
    createdAt: '2024-01-07T14:00:00Z',
    updatedAt: '2024-01-14T08:30:00Z',
  },
  {
    id: '8',
    firstName: 'Mary',
    lastName: 'Thompson',
    email: 'mary@omark.com',
    phoneNumber: '+233201234574',
    role: 'customer_service',
    isActive: true,
    createdAt: '2024-01-08T15:00:00Z',
    updatedAt: '2024-01-13T10:00:00Z',
  },
];

export const UsersPage: React.FC = () => {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  
  // States
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<User[]>(mockUsers);
  const [searchText, setSearchText] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [viewDrawerOpen, setViewDrawerOpen] = useState(false);
  const [addModal, setAddModal] = useState(false);
  const [editModal, setEditModal] = useState(false);
  const [form] = Form.useForm();
  const [addForm] = Form.useForm();

  // Export states
  const [exportModal, setExportModal] = useState(false);
  const [exportFormat, setExportFormat] = useState<'excel' | 'csv' | 'pdf' | 'json'>('excel');
  const [exportLoading, setExportLoading] = useState(false);

  // Role configuration
  const roleConfig: Record<Role, { color: string; icon: any; label: string }> = {
    admin: { color: 'red', icon: <CrownOutlined />, label: 'Administrator' },
    marketing_staff: { color: 'blue', icon: <UserOutlined />, label: 'Marketing Staff' },
    marketing_director: { color: 'purple', icon: <StarIcon />, label: 'Marketing Director' },
    customer_service: { color: 'green', icon: <CustomerServiceOutlined />, label: 'Customer Service' },
    secretary: { color: 'orange', icon: <SettingOutlined />, label: 'Secretary' },
    accounts: { color: 'cyan', icon: <BankOutlined />, label: 'Accounts' },
  };

  // Get role display
  const getRoleDisplay = (role: Role) => {
    return roleConfig[role]?.label || role;
  };

  const getRoleColor = (role: Role) => {
    return roleConfig[role]?.color || 'default';
  };

  const getRoleIcon = (role: Role) => {
    return roleConfig[role]?.icon || <UserOutlined />;
  };

  // Filter users
  const filteredUsers = users.filter(user => {
    const fullName = `${user.firstName} ${user.lastName}`.toLowerCase();
    const matchesSearch = fullName.includes(searchText.toLowerCase()) ||
                          user.email.toLowerCase().includes(searchText.toLowerCase()) ||
                          user.phoneNumber.includes(searchText);
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    const matchesStatus = statusFilter === 'all' || 
                         (statusFilter === 'active' && user.isActive) ||
                         (statusFilter === 'inactive' && !user.isActive);
    return matchesSearch && matchesRole && matchesStatus;
  });

  // Stats
  const stats = {
    total: users.length,
    active: users.filter(u => u.isActive).length,
    inactive: users.filter(u => !u.isActive).length,
    admin: users.filter(u => u.role === 'admin').length,
    marketing: users.filter(u => u.role === 'marketing_staff' || u.role === 'marketing_director').length,
    customerService: users.filter(u => u.role === 'customer_service').length,
    support: users.filter(u => u.role === 'secretary' || u.role === 'accounts').length,
  };

  // Add User
  const handleAddUser = (values: any) => {
    setLoading(true);
    setTimeout(() => {
      const newUser: User = {
        id: `${Date.now()}`,
        firstName: values.firstName,
        lastName: values.lastName,
        email: values.email,
        phoneNumber: values.phoneNumber,
        role: values.role,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setUsers([newUser, ...users]);
      setLoading(false);
      setAddModal(false);
      addForm.resetFields();
      message.success(`User ${newUser.firstName} ${newUser.lastName} added successfully!`);
    }, 800);
  };

  // Edit User
  const handleEditUser = (values: any) => {
    if (!selectedUser) return;
    setLoading(true);
    setTimeout(() => {
      setUsers(users.map(u => 
        u.id === selectedUser.id 
          ? { 
              ...u, 
              ...values, 
              updatedAt: new Date().toISOString(),
              isActive: values.isActive !== undefined ? values.isActive : u.isActive
            }
          : u
      ));
      setLoading(false);
      setEditModal(false);
      setSelectedUser(null);
      form.resetFields();
      message.success('User updated successfully!');
    }, 800);
  };

  // Toggle User Status
  const handleToggleStatus = (id: string) => {
    setUsers(users.map(u => 
      u.id === id 
        ? { ...u, isActive: !u.isActive, updatedAt: new Date().toISOString() }
        : u
    ));
    const user = users.find(u => u.id === id);
    message.success(`${user?.firstName} ${user?.lastName} ${user?.isActive ? 'deactivated' : 'activated'} successfully!`);
  };

  // Delete User
  const handleDeleteUser = (id: string) => {
    const user = users.find(u => u.id === id);
    if (user?.email === 'admin@omark.com') {
      message.error('Cannot delete the primary admin user!');
      return;
    }
    setUsers(users.filter(u => u.id !== id));
    message.success('User deleted successfully!');
  };

  // Export function
  const handleExport = () => {
    setExportLoading(true);
    const dataToExport = filteredUsers.map(user => ({
      'Full Name': `${user.firstName} ${user.lastName}`,
      'Email': user.email,
      'Phone': user.phoneNumber,
      'Role': getRoleDisplay(user.role),
      'Status': user.isActive ? 'Active' : 'Inactive',
      'Joined': dayjs(user.createdAt).format('YYYY-MM-DD'),
      'Last Updated': dayjs(user.updatedAt).format('YYYY-MM-DD'),
    }));

    let fileName = `users-${dayjs().format('YYYY-MM-DD-HHmmss')}`;
    let blob: Blob;

    setTimeout(() => {
      switch (exportFormat) {
        case 'json':
          blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: 'application/json' });
          fileName += '.json';
          break;
        case 'csv': {
          const headers = Object.keys(dataToExport[0] || {});
          const csvRows = [
            headers.join(','),
            ...dataToExport.map(row => 
              headers.map(header => {
                const value = row[header as keyof typeof row] || '';
                return typeof value === 'string' ? `"${value.replace(/"/g, '""')}"` : value;
              }).join(',')
            )
          ];
          blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
          fileName += '.csv';
          break;
        }
        case 'excel': {
          const headers = Object.keys(dataToExport[0] || {});
          const excelRows = [
            headers.join('\t'),
            ...dataToExport.map(row => 
              headers.map(header => {
                const value = row[header as keyof typeof row] || '';
                return typeof value === 'string' ? `"${value.replace(/"/g, '""')}"` : value;
              }).join('\t')
            )
          ];
          blob = new Blob([excelRows.join('\n')], { type: 'application/vnd.ms-excel' });
          fileName += '.xls';
          break;
        }
        case 'pdf': {
          const pdfContent = dataToExport.map(row => 
            Object.entries(row).map(([key, value]) => `${key}: ${value}`).join('\n')
          ).join('\n\n---\n\n');
          blob = new Blob([pdfContent], { type: 'application/pdf' });
          fileName += '.txt';
          break;
        }
        default:
          blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: 'application/json' });
          fileName += '.json';
      }

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setExportLoading(false);
      setExportModal(false);
      message.success(`Exported ${dataToExport.length} users as ${exportFormat.toUpperCase()}!`);
    }, 1000);
  };

  // Table Columns
  const columns = [
    {
      title: 'User',
      key: 'user',
      width: 220,
      render: (_: any, record: User) => (
        <Space>
          <Avatar icon={<UserOutlined />} style={{ backgroundColor: tokens.primary }} />
          <div>
            <Text strong>{record.firstName} {record.lastName}</Text>
            <br />
            <Text type="secondary" style={{ fontSize: 12 }}>
              <MailOutlined /> {record.email}
            </Text>
          </div>
        </Space>
      ),
    },
    {
      title: 'Phone',
      dataIndex: 'phoneNumber',
      key: 'phoneNumber',
      width: 150,
      render: (phone: string) => (
        <a href={`tel:${phone}`}>
          <PhoneOutlined /> {phone}
        </a>
      ),
    },
    {
      title: 'Role',
      dataIndex: 'role',
      key: 'role',
      width: 160,
      render: (role: Role) => (
        <Tag color={getRoleColor(role)} icon={getRoleIcon(role)}>
          {getRoleDisplay(role)}
        </Tag>
      ),
      filters: [
        { text: 'Administrator', value: 'admin' },
        { text: 'Marketing Staff', value: 'marketing_staff' },
        { text: 'Marketing Director', value: 'marketing_director' },
        { text: 'Customer Service', value: 'customer_service' },
        { text: 'Secretary', value: 'secretary' },
        { text: 'Accounts', value: 'accounts' },
      ],
      onFilter: (value: any, record: User) => record.role === value,
    },
    {
      title: 'Status',
      dataIndex: 'isActive',
      key: 'isActive',
      width: 120,
      render: (isActive: boolean) => (
        <Badge 
          status={isActive ? 'success' : 'error'} 
          text={isActive ? 'Active' : 'Inactive'}
        />
      ),
    },
    {
      title: 'Joined',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 140,
      render: (date: string) => (
        <Tooltip title={dayjs(date).format('MMMM DD, YYYY HH:mm')}>
          <div>
            <CalendarOutlined /> {dayjs(date).format('MMM DD, YYYY')}
            <br />
            <Text type="secondary" style={{ fontSize: 12 }}>
              {dayjs(date).fromNow()}
            </Text>
          </div>
        </Tooltip>
      ),
      sorter: (a: User, b: User) => dayjs(a.createdAt).unix() - dayjs(b.createdAt).unix(),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 200,
      fixed: 'right' as const,
      render: (_: any, record: User) => (
        <Space>
          <Tooltip title="View Details">
            <Button 
              type="primary"
              ghost
              icon={<EyeOutlined />} 
              onClick={() => {
                setSelectedUser(record);
                setViewDrawerOpen(true);
              }}
            />
          </Tooltip>
          <Tooltip title="Edit">
            <Button 
              icon={<EditOutlined />} 
              onClick={() => {
                setSelectedUser(record);
                setEditModal(true);
                form.setFieldsValue({
                  firstName: record.firstName,
                  lastName: record.lastName,
                  email: record.email,
                  phoneNumber: record.phoneNumber,
                  role: record.role,
                  isActive: record.isActive,
                });
              }}
            />
          </Tooltip>
          <Tooltip title={record.isActive ? 'Deactivate' : 'Activate'}>
            <Button 
              icon={record.isActive ? <LockOutlined /> : <UnlockOutlined />}
              onClick={() => handleToggleStatus(record.id)}
            />
          </Tooltip>
          {record.email !== 'admin@omark.com' && (
            <Popconfirm
              title="Delete User"
              description={`Are you sure you want to delete ${record.firstName} ${record.lastName}?`}
              onConfirm={() => handleDeleteUser(record.id)}
              okText="Yes"
              cancelText="No"
            >
              <Tooltip title="Delete">
                <Button danger icon={<DeleteOutlined />} />
              </Tooltip>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  // Render Drawer Content
  const renderDrawerContent = () => {
    if (!selectedUser) return null;

    return (
      <div style={{ height: '100%' }}>
        {/* Header */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: 24,
          paddingBottom: 16,
          borderBottom: '1px solid #f0f0f0'
        }}>
          <Space>
            <Avatar 
              size={48} 
              icon={<UserOutlined />} 
              style={{ backgroundColor: tokens.primary }}
            />
            <div>
              <Title level={4} style={{ margin: 0 }}>
                {selectedUser.firstName} {selectedUser.lastName}
              </Title>
              <Text type="secondary" style={{ fontSize: 12 }}>
                <IdcardOutlined /> ID: {selectedUser.id}
              </Text>
            </div>
          </Space>
          <Button 
            type="text" 
            icon={<CloseOutlined />} 
            onClick={() => setViewDrawerOpen(false)}
            style={{ fontSize: 18 }}
          />
        </div>

        {/* Status Banner */}
        <div style={{
          background: selectedUser.isActive ? '#f6ffed' : '#fff2e8',
          border: `1px solid ${selectedUser.isActive ? '#b7eb8f' : '#ffccc7'}`,
          borderRadius: 8,
          padding: '12px 16px',
          marginBottom: 24,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <Space>
            {selectedUser.isActive ? <CheckCircleOutlined style={{ color: '#52c41a' }} /> : <CloseCircleOutlined style={{ color: '#ff4d4f' }} />}
            <Text strong>Status: {selectedUser.isActive ? 'Active' : 'Inactive'}</Text>
          </Space>
          <Badge 
            status={selectedUser.isActive ? 'success' : 'error'} 
            text={selectedUser.isActive ? 'Active' : 'Inactive'}
          />
        </div>

        {/* Quick Actions */}
        <div style={{ marginBottom: 24 }}>
          <Space wrap>
            <Button 
              type="primary" 
              icon={<EditOutlined />}
              onClick={() => {
                setEditModal(true);
                form.setFieldsValue({
                  firstName: selectedUser.firstName,
                  lastName: selectedUser.lastName,
                  email: selectedUser.email,
                  phoneNumber: selectedUser.phoneNumber,
                  role: selectedUser.role,
                  isActive: selectedUser.isActive,
                });
                setViewDrawerOpen(false);
              }}
            >
              Edit User
            </Button>
            <Button 
              icon={selectedUser.isActive ? <LockOutlined /> : <UnlockOutlined />}
              onClick={() => handleToggleStatus(selectedUser.id)}
            >
              {selectedUser.isActive ? 'Deactivate' : 'Activate'}
            </Button>
            <Button icon={<MessageOutlined />}>
              Send Message
            </Button>
          </Space>
        </div>

        {/* User Details */}
        <Row gutter={[16, 16]}>
          <Col span={24}>
            <Card size="small" title="Personal Information" bordered={false} style={{ background: '#fafafa' }}>
              <Descriptions column={1} size="small">
                <Descriptions.Item label={<Space><UserOutlined /> Full Name</Space>}>
                  <Text strong>{selectedUser.firstName} {selectedUser.lastName}</Text>
                </Descriptions.Item>
                <Descriptions.Item label={<Space><MailOutlined /> Email</Space>}>
                  <a href={`mailto:${selectedUser.email}`}>{selectedUser.email}</a>
                </Descriptions.Item>
                <Descriptions.Item label={<Space><PhoneOutlined /> Phone</Space>}>
                  <a href={`tel:${selectedUser.phoneNumber}`}>{selectedUser.phoneNumber}</a>
                </Descriptions.Item>
              </Descriptions>
            </Card>
          </Col>
        </Row>

        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          <Col span={24}>
            <Card size="small" title="Role & Access" bordered={false} style={{ background: '#fafafa' }}>
              <Descriptions column={1} size="small">
                <Descriptions.Item label={<Space><UserOutlined /> Role</Space>}>
                  <Tag color={getRoleColor(selectedUser.role)} icon={getRoleIcon(selectedUser.role)}>
                    {getRoleDisplay(selectedUser.role)}
                  </Tag>
                </Descriptions.Item>
              </Descriptions>
            </Card>
          </Col>
        </Row>

        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          <Col span={24}>
            <Card size="small" title="Account Information" bordered={false} style={{ background: '#fafafa' }}>
              <Descriptions column={1} size="small">
                <Descriptions.Item label={<Space><CalendarOutlined /> Joined</Space>}>
                  {dayjs(selectedUser.createdAt).format('MMMM DD, YYYY HH:mm')}
                </Descriptions.Item>
                <Descriptions.Item label={<Space><ClockCircleOutlined /> Last Updated</Space>}>
                  {dayjs(selectedUser.updatedAt).format('MMMM DD, YYYY HH:mm')}
                </Descriptions.Item>
              </Descriptions>
            </Card>
          </Col>
        </Row>

        {/* Timeline */}
        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          <Col span={24}>
            <Card size="small" title="Activity Timeline" bordered={false} style={{ background: '#fafafa' }}>
              <Timeline>
                <Timeline.Item color="blue">
                  <Text>Account created</Text>
                  <br />
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {dayjs(selectedUser.createdAt).format('MMMM DD, YYYY HH:mm')}
                  </Text>
                </Timeline.Item>
                <Timeline.Item color={selectedUser.isActive ? 'green' : 'red'}>
                  <Text>Status: {selectedUser.isActive ? 'Active' : 'Inactive'}</Text>
                  <br />
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    Last updated {dayjs(selectedUser.updatedAt).fromNow()}
                  </Text>
                </Timeline.Item>
              </Timeline>
            </Card>
          </Col>
        </Row>

        {/* Footer */}
        <div style={{ 
          marginTop: 24, 
          paddingTop: 16, 
          borderTop: '1px solid #f0f0f0',
          display: 'flex',
          justifyContent: 'space-between'
        }}>
          <Space>
            <Button icon={<PrinterOutlined />}>Print</Button>
            <Button icon={<ShareAltOutlined />}>Share</Button>
          </Space>
          {selectedUser.email !== 'admin@omark.com' && (
            <Popconfirm
              title="Delete User"
              description={`Are you sure you want to delete ${selectedUser.firstName} ${selectedUser.lastName}?`}
              onConfirm={() => {
                handleDeleteUser(selectedUser.id);
                setViewDrawerOpen(false);
              }}
              okText="Yes"
              cancelText="No"
            >
              <Button danger icon={<DeleteOutlined />}>
                Delete User
              </Button>
            </Popconfirm>
          )}
        </div>
      </div>
    );
  };

  return (
    <div style={{ maxWidth: '100%', overflow: 'hidden', padding: '0 4px' }}>
      <PageHeader
        title="Staff Accounts"
        actions={[
          {
            label: 'Add Staff',
            onClick: () => setAddModal(true),
            icon: <PlusOutlined />,
          },
          {
            label: 'Export',
            onClick: () => setExportModal(true),
            icon: <ExportOutlined />,
          },
          {
            label: 'Refresh',
            onClick: () => {
              setLoading(true);
              setTimeout(() => {
                setLoading(false);
                message.success('Refreshed!');
              }, 500);
            },
            icon: <ReloadOutlined />,
          },
        ]}
      />

      {/* Stats Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} md={4}>
          <Card size="small">
            <Statistic
              title="Total Staff"
              value={stats.total}
              prefix={<TeamOutlined />}
              valueStyle={{ color: tokens.primary }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={4}>
          <Card size="small">
            <Statistic
              title="Active"
              value={stats.active}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={4}>
          <Card size="small">
            <Statistic
              title="Inactive"
              value={stats.inactive}
              prefix={<CloseCircleOutlined />}
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={4}>
          <Card size="small">
            <Statistic
              title="Administrators"
              value={stats.admin}
              prefix={<CrownOutlined />}
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={4}>
          <Card size="small">
            <Statistic
              title="Marketing Team"
              value={stats.marketing}
              prefix={<UserOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={4}>
          <Card size="small">
            <Statistic
              title="Support Team"
              value={stats.support}
              prefix={<CustomerServiceOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Filters */}
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={[16, 16]}>
          <Col xs={24} md={6}>
            <Input
              placeholder="Search by name, email, or phone"
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear
              size="middle"
            />
          </Col>
          <Col xs={12} md={5}>
            <Select
              style={{ width: '100%' }}
              placeholder="Filter by role"
              value={roleFilter}
              onChange={setRoleFilter}
              allowClear
              size="middle"
            >
              <Option value="all">All Roles</Option>
              <Option value="admin">Administrator</Option>
              <Option value="marketing_staff">Marketing Staff</Option>
              <Option value="marketing_director">Marketing Director</Option>
              <Option value="customer_service">Customer Service</Option>
              <Option value="secretary">Secretary</Option>
              <Option value="accounts">Accounts</Option>
            </Select>
          </Col>
          <Col xs={12} md={5}>
            <Select
              style={{ width: '100%' }}
              placeholder="Filter by status"
              value={statusFilter}
              onChange={setStatusFilter}
              allowClear
              size="middle"
            >
              <Option value="all">All Statuses</Option>
              <Option value="active">Active</Option>
              <Option value="inactive">Inactive</Option>
            </Select>
          </Col>
          <Col xs={24} md={8}>
            <Text type="secondary" style={{ display: 'block', textAlign: 'right' }}>
              Total: {filteredUsers.length} staff members
            </Text>
          </Col>
        </Row>
      </Card>

      {/* Table */}
      <div style={{ overflowX: 'auto', maxWidth: '100%' }}>
        <Table
          columns={columns}
          dataSource={filteredUsers}
          rowKey="id"
          loading={loading}
          size="middle"
          scroll={{ x: 1200 }}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `Total ${total} staff members`,
            responsive: true,
          }}
        />
      </div>

      {/* Add Staff Modal */}
      <Modal
        title={
          <Space>
            <UserAddOutlined style={{ color: tokens.primary }} />
            <Text strong>Add Staff Member</Text>
          </Space>
        }
        open={addModal}
        onCancel={() => {
          setAddModal(false);
          addForm.resetFields();
        }}
        footer={null}
        width={600}
        style={{ maxWidth: '95%', top: 20 }}
        bodyStyle={{ padding: '16px', maxHeight: '70vh', overflowY: 'auto' }}
      >
        <Alert
          message="Add Staff Member"
          description="Create a new staff account with appropriate role and access permissions."
          type="info"
          showIcon
          style={{ marginBottom: 24 }}
        />

        <Form
          form={addForm}
          layout="vertical"
          onFinish={handleAddUser}
        >
          <Row gutter={[8, 0]}>
            <Col xs={24} sm={12}>
              <Form.Item
                name="firstName"
                label="First Name"
                rules={[{ required: true, message: 'First name is required' }]}
              >
                <Input placeholder="First name" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                name="lastName"
                label="Last Name"
                rules={[{ required: true, message: 'Last name is required' }]}
              >
                <Input placeholder="Last name" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="email"
            label="Email Address"
            rules={[
              { required: true, message: 'Email is required' },
              { type: 'email', message: 'Please enter a valid email' }
            ]}
          >
            <Input placeholder="user@omark.com" prefix={<MailOutlined />} />
          </Form.Item>

          <Form.Item
            name="phoneNumber"
            label="Phone Number"
            rules={[{ required: true, message: 'Phone number is required' }]}
          >
            <PhoneInput />
          </Form.Item>

          <Form.Item
            name="role"
            label="Role"
            rules={[{ required: true, message: 'Please select a role' }]}
          >
            <Select placeholder="Select role">
              <Option value="admin">Administrator</Option>
              <Option value="marketing_staff">Marketing Staff</Option>
              <Option value="marketing_director">Marketing Director</Option>
              <Option value="customer_service">Customer Service</Option>
              <Option value="secretary">Secretary</Option>
              <Option value="accounts">Accounts</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="password"
            label="Temporary Password"
            rules={[
              { required: true, message: 'Please enter a temporary password' },
              { min: 8, message: 'Password must be at least 8 characters' }
            ]}
          >
            <Input.Password placeholder="Temporary password" />
          </Form.Item>

          <Form.Item>
            <Space wrap>
              <Button type="primary" htmlType="submit" loading={loading}>
                <UserAddOutlined /> Add Staff
              </Button>
              <Button onClick={() => {
                setAddModal(false);
                addForm.resetFields();
              }}>
                Cancel
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Edit Staff Modal */}
      <Modal
        title={
          <Space>
            <EditOutlined style={{ color: tokens.primary }} />
            <Text strong>Edit Staff Member</Text>
          </Space>
        }
        open={editModal}
        onCancel={() => {
          setEditModal(false);
          setSelectedUser(null);
          form.resetFields();
        }}
        footer={null}
        width={600}
        style={{ maxWidth: '95%', top: 20 }}
        bodyStyle={{ padding: '16px', maxHeight: '70vh', overflowY: 'auto' }}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleEditUser}
        >
          <Row gutter={[8, 0]}>
            <Col xs={24} sm={12}>
              <Form.Item
                name="firstName"
                label="First Name"
                rules={[{ required: true, message: 'First name is required' }]}
              >
                <Input />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                name="lastName"
                label="Last Name"
                rules={[{ required: true, message: 'Last name is required' }]}
              >
                <Input />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="email"
            label="Email Address"
            rules={[
              { required: true, message: 'Email is required' },
              { type: 'email', message: 'Please enter a valid email' }
            ]}
          >
            <Input disabled={selectedUser?.email === 'admin@omark.com'} prefix={<MailOutlined />} />
          </Form.Item>

          <Form.Item
            name="phoneNumber"
            label="Phone Number"
            rules={[{ required: true, message: 'Phone number is required' }]}
          >
            <PhoneInput />
          </Form.Item>

          <Form.Item
            name="role"
            label="Role"
            rules={[{ required: true, message: 'Please select a role' }]}
          >
            <Select placeholder="Select role">
              <Option value="admin">Administrator</Option>
              <Option value="marketing_staff">Marketing Staff</Option>
              <Option value="marketing_director">Marketing Director</Option>
              <Option value="customer_service">Customer Service</Option>
              <Option value="secretary">Secretary</Option>
              <Option value="accounts">Accounts</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="isActive"
            label="Status"
            valuePropName="checked"
          >
            <Switch 
              checkedChildren="Active" 
              unCheckedChildren="Inactive"
            />
          </Form.Item>

          <Form.Item>
            <Space wrap>
              <Button type="primary" htmlType="submit" loading={loading}>
                Update Staff
              </Button>
              <Button onClick={() => {
                setEditModal(false);
                setSelectedUser(null);
                form.resetFields();
              }}>
                Cancel
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Export Modal */}
      <Modal
        title={
          <Space>
            <ExportOutlined style={{ color: tokens.primary }} />
            <Text strong>Export Staff Data</Text>
          </Space>
        }
        open={exportModal}
        onCancel={() => {
          setExportModal(false);
          setExportFormat('excel');
        }}
        footer={[
          <Button key="cancel" onClick={() => {
            setExportModal(false);
            setExportFormat('excel');
          }}>
            Cancel
          </Button>,
          <Button 
            key="export" 
            type="primary" 
            icon={<DownloadOutlined />}
            onClick={handleExport}
            loading={exportLoading}
          >
            Export {exportFormat.toUpperCase()}
          </Button>,
        ]}
        width={500}
        style={{ maxWidth: '95%', top: 20 }}
        bodyStyle={{ padding: '16px' }}
      >
        <Alert
          message={`${filteredUsers.length} staff members will be exported`}
          description="Select the file format you want to export your data in."
          type="info"
          showIcon
          style={{ marginBottom: 24 }}
        />

        <div style={{ marginBottom: 16 }}>
          <Text strong>Select Export Format:</Text>
        </div>

        <Radio.Group 
          value={exportFormat} 
          onChange={(e) => setExportFormat(e.target.value)}
          style={{ width: '100%' }}
        >
          <Space direction="vertical" style={{ width: '100%' }}>
            <Radio value="excel" style={{ width: '100%', padding: '8px 12px', border: '1px solid #d9d9d9', borderRadius: 6 }}>
              <Space>
                <FileExcelOutlined style={{ color: '#217346', fontSize: 18 }} />
                <div>
                  <Text strong>Excel (.xls)</Text>
                  <br />
                  <Text type="secondary" style={{ fontSize: 12 }}>Best for data analysis and editing</Text>
                </div>
              </Space>
            </Radio>
            
            <Radio value="csv" style={{ width: '100%', padding: '8px 12px', border: '1px solid #d9d9d9', borderRadius: 6 }}>
              <Space>
                <FileTextOutlined style={{ color: '#1890ff', fontSize: 18 }} />
                <div>
                  <Text strong>CSV (.csv)</Text>
                  <br />
                  <Text type="secondary" style={{ fontSize: 12 }}>Compatible with most spreadsheet apps</Text>
                </div>
              </Space>
            </Radio>
            
            <Radio value="pdf" style={{ width: '100%', padding: '8px 12px', border: '1px solid #d9d9d9', borderRadius: 6 }}>
              <Space>
                <FilePdfOutlined style={{ color: '#ff4d4f', fontSize: 18 }} />
                <div>
                  <Text strong>PDF (.pdf)</Text>
                  <br />
                  <Text type="secondary" style={{ fontSize: 12 }}>For printing and sharing</Text>
                </div>
              </Space>
            </Radio>
            
            <Radio value="json" style={{ width: '100%', padding: '8px 12px', border: '1px solid #d9d9d9', borderRadius: 6 }}>
              <Space>
                <CodeOutlined style={{ color: '#722ed1', fontSize: 18 }} />
                <div>
                  <Text strong>JSON (.json)</Text>
                  <br />
                  <Text type="secondary" style={{ fontSize: 12 }}>For developers and API integration</Text>
                </div>
              </Space>
            </Radio>
          </Space>
        </Radio.Group>

        <Divider />
        <div style={{ padding: 12, background: '#f5f5f5', borderRadius: 6 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            <InfoCircleOutlined /> The export will include all filtered staff members with their details.
          </Text>
        </div>
      </Modal>

      {/* Premium Drawer */}
      <Drawer
        title={null}
        placement="right"
        closable={false}
        onClose={() => setViewDrawerOpen(false)}
        open={viewDrawerOpen}
        width="50%"
        style={{ 
          padding: 0,
          boxShadow: '-4px 0 20px rgba(0,0,0,0.1)'
        }}
        bodyStyle={{ 
          padding: '24px',
          background: '#f5f7fa',
          overflowY: 'auto',
          height: '100%'
        }}
        maskStyle={{ background: 'rgba(0,0,0,0.3)' }}
        push={false}
      >
        {renderDrawerContent()}
      </Drawer>
    </div>
  );
};