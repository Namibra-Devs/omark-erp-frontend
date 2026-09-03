// src/pages/cs/CheckInsPage.tsx
import React, { useState, useEffect, useMemo } from 'react';
import {
  Card, Row, Col, Typography, Statistic, Table, Tag, Space, Button,
  Modal, Form, Input, Select, DatePicker, message, Tooltip, Popconfirm,
  Drawer, Descriptions, Badge, Divider, Alert, AutoComplete
} from 'antd';
import {
  UserAddOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  SearchOutlined,
  PlusOutlined,
  LogoutOutlined,
  EyeOutlined,
  EditOutlined,
  DeleteOutlined,
  CalendarOutlined,
  FilterOutlined,
  IdcardOutlined,
  PrinterOutlined,
  ExportOutlined,
  PhoneOutlined,
  MailOutlined,
  TeamOutlined,
  EnvironmentOutlined,
  InfoCircleOutlined,
  TagOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useAuth } from '@/contexts/AuthContext';
import { PageHeader } from '@/components/shared/PageHeader';
import { useUsersQuery, getUserFullName } from '@/api/users';
import { useBranchesQuery } from '@/api/branches';
import { getUserBranchId } from '@/utils/branchIsolation';
import { tokens } from '@/constants/tokens';
import { markSeen } from '@/mock/seenTracker';
import {
  useCheckIns,
  visitorCategoryLabels,
  checkInStatusLabels,
  type CheckInRecord,
  type CheckInStatus,
  type VisitorCategory,
} from '@/mock/checkIns';

const { Text, Title, Paragraph } = Typography;
const { Option } = Select;
const { TextArea } = Input;

export const CheckInsPage: React.FC = () => {
  const { user, hasRole } = useAuth();
  const currentBranchId = getUserBranchId(user);
  const { data: branches = [] } = useBranchesQuery();
  const { data: usersData } = useUsersQuery();
  const staffList = usersData?.items ?? [];

  // Active branch selector for admins / branch managers
  const [selectedBranchId, setSelectedBranchId] = useState<string>(
    hasRole(['admin']) ? 'all' : (currentBranchId || 'all')
  );

  const {
    records,
    addCheckIn,
    updateCheckIn,
    checkOutVisitor,
    deleteCheckIn,
  } = useCheckIns(selectedBranchId);

  // Clear unread badge counter when viewing check-ins page
  useEffect(() => {
    if (user?.id) {
      markSeen('check-ins', user.id);
    }
  }, [user?.id, records]);

  // ── Filters & Search State ────────────────────────────────────────────────
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<CheckInStatus | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = useState<VisitorCategory | 'all'>('all');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'weekly' | 'monthly' | 'yearly' | 'custom'>('today');
  const [customDateRange, setCustomDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);

  // ── Modals & Drawers ──────────────────────────────────────────────────────
  const [checkInModalOpen, setCheckInModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<CheckInRecord | null>(null);
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<CheckInRecord | null>(null);
  const [checkOutModalOpen, setCheckOutModalOpen] = useState(false);
  const [recordToCheckOut, setRecordToCheckOut] = useState<CheckInRecord | null>(null);

  const [form] = Form.useForm();
  const [editForm] = Form.useForm();
  const [checkOutForm] = Form.useForm();

  // ── Filter records by Search, Category, Status, and Date ──────────────────
  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      // Search
      if (searchText) {
        const query = searchText.toLowerCase();
        const matchesName = r.visitorName.toLowerCase().includes(query);
        const matchesPhone = r.phoneNumber.toLowerCase().includes(query);
        const matchesCode = r.code.toLowerCase().includes(query);
        const matchesPurpose = r.purpose.toLowerCase().includes(query);
        const matchesHost = (r.hostStaffName || '').toLowerCase().includes(query);
        const matchesBadge = (r.badgeNumber || '').toLowerCase().includes(query);
        if (!matchesName && !matchesPhone && !matchesCode && !matchesPurpose && !matchesHost && !matchesBadge) {
          return false;
        }
      }

      // Status
      if (statusFilter !== 'all' && r.status !== statusFilter) {
        return false;
      }

      // Category
      if (categoryFilter !== 'all' && r.category !== categoryFilter) {
        return false;
      }

      // Date
      if (dateFilter !== 'all') {
        const itemDate = dayjs(r.checkInTime || r.createdAt);
        const now = dayjs();
        if (dateFilter === 'today' && !itemDate.isSame(now, 'day')) {
          return false;
        }
        if (dateFilter === 'weekly' && !itemDate.isSame(now, 'week')) {
          return false;
        }
        if (dateFilter === 'monthly' && !itemDate.isSame(now, 'month')) {
          return false;
        }
        if (dateFilter === 'yearly' && !itemDate.isSame(now, 'year')) {
          return false;
        }
        if (dateFilter === 'custom' && customDateRange && customDateRange[0] && customDateRange[1]) {
          const start = customDateRange[0].startOf('day');
          const end = customDateRange[1].endOf('day');
          if (itemDate.isBefore(start) || itemDate.isAfter(end)) {
            return false;
          }
        }
      }

      return true;
    });
  }, [records, searchText, statusFilter, categoryFilter, dateFilter, customDateRange]);

  // ── Key Statistics ────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const today = dayjs();
    const todayRecords = records.filter((r) => dayjs(r.checkInTime || r.createdAt).isSame(today, 'day'));
    const onPremises = records.filter((r) => r.status === 'in_premises').length;
    const inLobby = records.filter((r) => r.status === 'waiting').length;
    const completedToday = todayRecords.filter((r) => r.status === 'completed').length;
    const totalThisMonth = records.filter((r) => dayjs(r.checkInTime || r.createdAt).isSame(today, 'month')).length;

    return {
      onPremises,
      inLobby,
      completedToday,
      totalThisMonth,
      totalRecorded: records.length,
    };
  }, [records]);

  // ── Check-in Submission ───────────────────────────────────────────────────
  const handleCheckInSubmit = async (values: any) => {
    try {
      const hostStaff = staffList.find((s) => s.id === values.hostStaffId);
      const hostStaffName = hostStaff ? getUserFullName(hostStaff) : values.customHostStaff;
      const receptionistName = user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : 'Front Desk';
      const branchId = values.branchId || currentBranchId || 'b2';

      addCheckIn({
        branchId,
        visitorName: values.visitorName.trim(),
        phoneNumber: values.phoneNumber.trim(),
        email: values.email?.trim() || undefined,
        category: values.category,
        purpose: values.purpose.trim(),
        hostStaffId: values.hostStaffId,
        hostStaffName: hostStaffName || undefined,
        hostDepartment: values.hostDepartment || undefined,
        checkInTime: new Date().toISOString(),
        status: values.status || 'in_premises',
        badgeNumber: values.badgeNumber?.trim() || undefined,
        notes: values.notes?.trim() || undefined,
        handledByUserId: user?.id,
        handledByName: receptionistName,
      });

      message.success(`Client ${values.visitorName} checked in successfully!`);
      setCheckInModalOpen(false);
      form.resetFields();
    } catch (err: any) {
      message.error(err.message || 'Failed to check in visitor');
    }
  };

  // ── Check-out Handler ─────────────────────────────────────────────────────
  const handleQuickCheckOut = (record: CheckInRecord) => {
    setRecordToCheckOut(record);
    checkOutForm.setFieldsValue({ notes: record.notes || '' });
    setCheckOutModalOpen(true);
  };

  const confirmCheckOut = (values: any) => {
    if (!recordToCheckOut) return;
    try {
      checkOutVisitor(recordToCheckOut.id, values.notes);
      message.success(`${recordToCheckOut.visitorName} has been checked out.`);
      setCheckOutModalOpen(false);
      setRecordToCheckOut(null);
    } catch (err: any) {
      message.error(err.message || 'Check out failed');
    }
  };

  // ── Edit Record Handler ───────────────────────────────────────────────────
  const handleEditClick = (record: CheckInRecord) => {
    setEditingRecord(record);
    editForm.setFieldsValue({
      visitorName: record.visitorName,
      phoneNumber: record.phoneNumber,
      email: record.email,
      category: record.category,
      purpose: record.purpose,
      hostStaffId: record.hostStaffId,
      hostDepartment: record.hostDepartment,
      status: record.status,
      badgeNumber: record.badgeNumber,
      notes: record.notes,
    });
  };

  const handleEditSubmit = (values: any) => {
    if (!editingRecord) return;
    try {
      const hostStaff = staffList.find((s) => s.id === values.hostStaffId);
      const hostStaffName = hostStaff ? getUserFullName(hostStaff) : editingRecord.hostStaffName;

      updateCheckIn(editingRecord.id, {
        ...values,
        hostStaffName,
      });
      message.success('Check-in details updated.');
      setEditingRecord(null);
    } catch (err: any) {
      message.error(err.message || 'Failed to update record');
    }
  };

  // ── Columns ───────────────────────────────────────────────────────────────
  const columns = [
    {
      title: 'Code & Visitor',
      key: 'visitor',
      width: 220,
      render: (_: any, record: CheckInRecord) => (
        <div>
          <Space size={4}>
            <Text strong style={{ fontSize: 14 }}>{record.visitorName}</Text>
            {record.badgeNumber && (
              <Tag color="geekblue" style={{ fontSize: 11, padding: '0 4px' }}>
                🏷️ {record.badgeNumber}
              </Tag>
            )}
          </Space>
          <div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              ID: {record.code}
            </Text>
          </div>
        </div>
      ),
    },
    {
      title: 'Contact & Category',
      key: 'contact',
      width: 190,
      render: (_: any, record: CheckInRecord) => {
        const catConfig = visitorCategoryLabels[record.category] || { label: record.category, color: 'default' };
        return (
          <div>
            <div>
              <Text style={{ fontSize: 13 }}><PhoneOutlined /> {record.phoneNumber}</Text>
            </div>
            <div style={{ marginTop: 4 }}>
              <Tag color={catConfig.color} style={{ fontSize: 11 }}>
                {catConfig.label}
              </Tag>
            </div>
          </div>
        );
      },
    },
    {
      title: 'Purpose & Person to See',
      key: 'purpose',
      render: (_: any, record: CheckInRecord) => (
        <div>
          <Text strong style={{ display: 'block', fontSize: 13 }}>{record.purpose}</Text>
          {record.hostStaffName && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              👤 Host: <span style={{ color: '#1890ff', fontWeight: 500 }}>{record.hostStaffName}</span>
              {record.hostDepartment ? ` (${record.hostDepartment})` : ''}
            </Text>
          )}
        </div>
      ),
    },
    {
      title: 'Check-In / Out Time',
      key: 'times',
      width: 200,
      render: (_: any, record: CheckInRecord) => {
        const checkIn = dayjs(record.checkInTime);
        const checkOut = record.checkOutTime ? dayjs(record.checkOutTime) : null;
        return (
          <div>
            <div>
              <Text style={{ fontSize: 12 }}>
                🟢 In: <strong style={{ color: '#237804' }}>{checkIn.format('h:mm A')}</strong> ({checkIn.fromNow ? checkIn.fromNow() : checkIn.format('MMM D')})
              </Text>
            </div>
            {checkOut && (
              <div style={{ marginTop: 2 }}>
                <Text style={{ fontSize: 12 }}>
                  🔴 Out: <strong style={{ color: '#096dd9' }}>{checkOut.format('h:mm A')}</strong>
                </Text>
              </div>
            )}
          </div>
        );
      },
    },
    {
      title: 'Status',
      key: 'status',
      width: 150,
      render: (_: any, record: CheckInRecord) => {
        const statusConfig = checkInStatusLabels[record.status] || { label: record.status, color: 'default' };
        return (
          <Tag color={statusConfig.color} style={{ fontSize: 12, padding: '2px 8px', borderRadius: 4 }}>
            {record.status === 'in_premises' ? '🟢 ' : record.status === 'waiting' ? '⏳ ' : record.status === 'completed' ? '✅ ' : '⚪ '}
            {statusConfig.label}
          </Tag>
        );
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 170,
      fixed: 'right' as const,
      render: (_: any, record: CheckInRecord) => (
        <Space size="small">
          {(record.status === 'in_premises' || record.status === 'waiting') && (
            <Tooltip title="Check Out Visitor">
              <Button
                type="primary"
                size="small"
                icon={<LogoutOutlined />}
                style={{ background: '#52c41a', borderColor: '#52c41a' }}
                onClick={() => handleQuickCheckOut(record)}
              >
                Check Out
              </Button>
            </Tooltip>
          )}
          <Tooltip title="View Details">
            <Button
              type="text"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => {
                setSelectedRecord(record);
                setDetailDrawerOpen(true);
              }}
            />
          </Tooltip>
          <Tooltip title="Edit Record">
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleEditClick(record)}
            />
          </Tooltip>
          {hasRole(['admin', 'branch_manager']) && (
            <Popconfirm
              title="Delete check-in record?"
              onConfirm={() => {
                deleteCheckIn(record.id);
                message.success('Record removed');
              }}
              okText="Yes"
              cancelText="No"
            >
              <Tooltip title="Delete">
                <Button type="text" danger size="small" icon={<DeleteOutlined />} />
              </Tooltip>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div style={{ maxWidth: '100%', overflow: 'hidden', padding: '0 4px' }}>
      <PageHeader
        title="Client & Visitor Check-Ins"
        actions={[
          {
            label: 'Check In Client / Visitor',
            onClick: () => setCheckInModalOpen(true),
            icon: <PlusOutlined />,
          },
        ]}
      />

      {/* ── METRIC STAT CARDS ────────────────────────────────────────────── */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={12} md={6}>
          <Card style={{ borderRadius: 8, borderLeft: '4px solid #52c41a' }}>
            <Statistic
              title="Currently on Premises"
              value={stats.onPremises}
              prefix={<EnvironmentOutlined style={{ color: '#52c41a' }} />}
              valueStyle={{ color: '#52c41a', fontWeight: 600 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card style={{ borderRadius: 8, borderLeft: '4px solid #faad14' }}>
            <Statistic
              title="Waiting in Reception"
              value={stats.inLobby}
              prefix={<ClockCircleOutlined style={{ color: '#faad14' }} />}
              valueStyle={{ color: '#faad14', fontWeight: 600 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card style={{ borderRadius: 8, borderLeft: '4px solid #1890ff' }}>
            <Statistic
              title="Checked Out Today"
              value={stats.completedToday}
              prefix={<CheckCircleOutlined style={{ color: '#1890ff' }} />}
              valueStyle={{ color: '#1890ff', fontWeight: 600 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card style={{ borderRadius: 8, borderLeft: '4px solid #722ed1' }}>
            <Statistic
              title="Total Visitors This Month"
              value={stats.totalThisMonth}
              prefix={<TeamOutlined style={{ color: '#722ed1' }} />}
              valueStyle={{ color: '#722ed1', fontWeight: 600 }}
            />
          </Card>
        </Col>
      </Row>

      {/* ── FILTERS BAR ──────────────────────────────────────────────────── */}
      <Card style={{ marginBottom: 16, borderRadius: 8 }}>
        <Row gutter={[12, 12]} align="middle">
          <Col xs={24} sm={12} md={6}>
            <Input
              placeholder="Search visitor, phone, purpose, badge..."
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear
              size="middle"
            />
          </Col>
          <Col xs={24} sm={12} md={4}>
            <Select
              style={{ width: '100%' }}
              placeholder="Filter by Status"
              value={statusFilter}
              onChange={setStatusFilter}
              size="middle"
            >
              <Option value="all">All Statuses</Option>
              <Option value="in_premises">🟢 On Premises</Option>
              <Option value="waiting">⏳ Waiting in Lobby</Option>
              <Option value="completed">✅ Checked Out</Option>
              <Option value="canceled">⚪ Canceled</Option>
            </Select>
          </Col>
          <Col xs={24} sm={12} md={4}>
            <Select
              style={{ width: '100%' }}
              placeholder="Visitor Category"
              value={categoryFilter}
              onChange={setCategoryFilter}
              size="middle"
            >
              <Option value="all">All Categories</Option>
              <Option value="customer">Existing Customer</Option>
              <Option value="prospect">Prospective Client</Option>
              <Option value="inquiry">General Inquiry</Option>
              <Option value="contractor">Vendor / Contractor</Option>
              <Option value="legal_survey">Legal / Surveyor</Option>
              <Option value="vip">VIP Guest</Option>
              <Option value="other">Other</Option>
            </Select>
          </Col>
          <Col xs={24} sm={12} md={4}>
            <Select
              style={{ width: '100%' }}
              value={dateFilter}
              onChange={(val) => {
                setDateFilter(val);
                if (val !== 'custom') setCustomDateRange(null);
              }}
              size="middle"
              prefix={<CalendarOutlined style={{ color: '#8c8c8c' }} />}
            >
              <Option value="today">☀️ Today</Option>
              <Option value="weekly">📆 This Week</Option>
              <Option value="monthly">🗓️ This Month</Option>
              <Option value="yearly">📊 This Year</Option>
              <Option value="all">📅 All Time</Option>
              <Option value="custom">🎯 Custom Range</Option>
            </Select>
          </Col>
          {dateFilter === 'custom' && (
            <Col xs={24} sm={12} md={4}>
              <DatePicker.RangePicker
                style={{ width: '100%' }}
                value={customDateRange}
                onChange={(dates: any) => setCustomDateRange(dates)}
                format="YYYY-MM-DD"
              />
            </Col>
          )}
          {hasRole(['admin']) && (
            <Col xs={24} sm={12} md={2}>
              <Select
                style={{ width: '100%' }}
                value={selectedBranchId}
                onChange={setSelectedBranchId}
                size="middle"
              >
                <Option value="all">All Branches</Option>
                {branches.map((b: any) => (
                  <Option key={b.id} value={b.id}>{b.name}</Option>
                ))}
              </Select>
            </Col>
          )}
          <Col xs={24} sm={24} md={dateFilter === 'custom' ? 2 : (hasRole(['admin']) ? 4 : 6)}>
            <Text type="secondary" style={{ display: 'block', textAlign: 'right', fontWeight: 500 }}>
              Showing {filteredRecords.length} records
            </Text>
          </Col>
        </Row>
      </Card>

      {/* ── TABLE ────────────────────────────────────────────────────────── */}
      <div style={{ overflowX: 'auto', maxWidth: '100%' }}>
        <Table
          columns={columns}
          dataSource={filteredRecords}
          rowKey="id"
          size="middle"
          scroll={{ x: 950 }}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `Total ${total} check-ins`,
          }}
        />
      </div>

      {/* ── CHECK IN CLIENT MODAL ─────────────────────────────────────────── */}
      <Modal
        title={
          <Space>
            <UserAddOutlined style={{ color: tokens.primary }} />
            <span>Front Desk Client & Visitor Check-In</span>
          </Space>
        }
        open={checkInModalOpen}
        onCancel={() => {
          setCheckInModalOpen(false);
          form.resetFields();
        }}
        footer={null}
        width={620}
        style={{ top: 20 }}
      >
        <Alert
          message="Record incoming client or visitor arriving at the branch premises."
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
        <Form form={form} layout="vertical" onFinish={handleCheckInSubmit}>
          <Row gutter={12}>
            <Col xs={24} sm={14}>
              <Form.Item
                name="visitorName"
                label="Client / Visitor Full Name"
                rules={[{ required: true, message: 'Please enter visitor name' }]}
              >
                <Input placeholder="e.g. Kwame Mensah" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={10}>
              <Form.Item
                name="phoneNumber"
                label="Phone Number"
                rules={[{ required: true, message: 'Please enter phone number' }]}
              >
                <Input placeholder="e.g. +233 24 000 0000" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={12}>
            <Col xs={24} sm={12}>
              <Form.Item
                name="category"
                label="Visitor Category"
                initialValue="customer"
                rules={[{ required: true, message: 'Please select visitor category' }]}
              >
                <Select>
                  <Option value="customer">Existing Customer</Option>
                  <Option value="prospect">Prospective Client (New)</Option>
                  <Option value="inquiry">General Inquiry</Option>
                  <Option value="contractor">Vendor / Contractor</Option>
                  <Option value="legal_survey">Legal / Surveyor</Option>
                  <Option value="vip">VIP Guest</Option>
                  <Option value="other">Other</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="email" label="Email Address (Optional)">
                <Input placeholder="e.g. client@email.com" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="purpose"
            label="Purpose of Visit"
            rules={[{ required: true, message: 'Please specify the visit purpose' }]}
          >
            <AutoComplete
              placeholder="Select from common options or type purpose..."
              options={[
                { value: 'Deed of Assignment Documentation & Signatures' },
                { value: 'Payment Submission & Receipt Collection' },
                { value: 'Site Visit / Plot Inspection Inquiries' },
                { value: 'Payment Plan Statement Follow-up' },
                { value: 'Meeting with Branch Manager' },
                { value: 'Meeting with Marketing Director / Staff' },
                { value: 'Complaint / Customer Support Resolution' },
                { value: 'Contractor / Construction Bill Submission' },
              ]}
              filterOption={(inputValue, option) =>
                (option?.value?.toUpperCase().indexOf(inputValue.toUpperCase()) ?? -1) !== -1
              }
            />
          </Form.Item>

          <Row gutter={12}>
            <Col xs={24} sm={14}>
              <Form.Item name="hostStaffId" label="Person to See (Host Staff)">
                <Select
                  allowClear
                  showSearch
                  placeholder="Select staff member to visit"
                  optionFilterProp="children"
                >
                  {staffList.map((s) => (
                    <Option key={s.id} value={s.id}>
                      {getUserFullName(s)} ({s.role?.replace('_', ' ')})
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} sm={10}>
              <Form.Item name="hostDepartment" label="Department to Visit">
                <Select allowClear placeholder="Select department">
                  <Option value="Administration">Administration & Secretary</Option>
                  <Option value="Accounts & Finance">Accounts & Finance</Option>
                  <Option value="Marketing & Sales">Marketing & Sales</Option>
                  <Option value="Customer Service">Customer Service</Option>
                  <Option value="Operations">Operations & Survey</Option>
                  <Option value="Executive Management">Executive Management</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={12}>
            <Col xs={24} sm={12}>
              <Form.Item name="badgeNumber" label="Visitor Pass / Badge # (Optional)">
                <Input placeholder="e.g. VIS-014" prefix={<IdcardOutlined />} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="status" label="Initial Status" initialValue="in_premises">
                <Select>
                  <Option value="in_premises">🟢 In Premises / Meeting</Option>
                  <Option value="waiting">⏳ Waiting in Lobby</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="notes" label="Additional Notes / Remarks">
            <TextArea rows={2} placeholder="Any specific instructions, requested files, or notes..." />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setCheckInModalOpen(false)}>Cancel</Button>
              <Button type="primary" htmlType="submit" icon={<UserAddOutlined />}>
                Record Check-In
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* ── QUICK CHECK OUT MODAL ─────────────────────────────────────────── */}
      <Modal
        title={
          <Space>
            <LogoutOutlined style={{ color: '#52c41a' }} />
            <span>Check Out: {recordToCheckOut?.visitorName}</span>
          </Space>
        }
        open={checkOutModalOpen}
        onCancel={() => setCheckOutModalOpen(false)}
        footer={null}
        width={480}
      >
        <Form form={checkOutForm} layout="vertical" onFinish={confirmCheckOut}>
          <Paragraph>
            Confirm departure for <strong>{recordToCheckOut?.visitorName}</strong> ({recordToCheckOut?.code}).
          </Paragraph>
          <Form.Item name="notes" label="Visit Outcome / Closing Remarks (Optional)">
            <TextArea rows={3} placeholder="e.g. Completed deed signatures, receipt issued, meeting concluded smoothly." />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setCheckOutModalOpen(false)}>Cancel</Button>
              <Button type="primary" htmlType="submit" style={{ background: '#52c41a', borderColor: '#52c41a' }}>
                Confirm Check-Out
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* ── EDIT CHECK-IN MODAL ───────────────────────────────────────────── */}
      <Modal
        title="Edit Check-In Details"
        open={Boolean(editingRecord)}
        onCancel={() => setEditingRecord(null)}
        footer={null}
        width={600}
      >
        <Form form={editForm} layout="vertical" onFinish={handleEditSubmit}>
          <Row gutter={12}>
            <Col xs={24} sm={14}>
              <Form.Item name="visitorName" label="Visitor Name" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col xs={24} sm={10}>
              <Form.Item name="phoneNumber" label="Phone" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col xs={24} sm={12}>
              <Form.Item name="category" label="Category">
                <Select>
                  <Option value="customer">Existing Customer</Option>
                  <Option value="prospect">Prospective Client</Option>
                  <Option value="inquiry">General Inquiry</Option>
                  <Option value="contractor">Vendor / Contractor</Option>
                  <Option value="legal_survey">Legal / Surveyor</Option>
                  <Option value="vip">VIP Guest</Option>
                  <Option value="other">Other</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="status" label="Status">
                <Select>
                  <Option value="in_premises">On Premises</Option>
                  <Option value="waiting">Waiting in Lobby</Option>
                  <Option value="completed">Checked Out</Option>
                  <Option value="canceled">Canceled</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="purpose" label="Purpose of Visit" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="badgeNumber" label="Badge / Pass #">
            <Input />
          </Form.Item>
          <Form.Item name="notes" label="Notes">
            <TextArea rows={2} />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setEditingRecord(null)}>Cancel</Button>
              <Button type="primary" htmlType="submit">Save Changes</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* ── VISITOR DETAIL DRAWER ─────────────────────────────────────────── */}
      <Drawer
        title={
          <Space>
            <IdcardOutlined style={{ color: tokens.primary }} />
            <span>Visitor Check-In Details</span>
          </Space>
        }
        open={detailDrawerOpen}
        onClose={() => setDetailDrawerOpen(false)}
        width={480}
      >
        {selectedRecord && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <Title level={4} style={{ margin: 0 }}>{selectedRecord.visitorName}</Title>
              <Text type="secondary">{selectedRecord.code}</Text>
              <div style={{ marginTop: 8 }}>
                <Tag color={checkInStatusLabels[selectedRecord.status]?.color || 'default'} style={{ fontSize: 13, padding: '2px 10px' }}>
                  {checkInStatusLabels[selectedRecord.status]?.label}
                </Tag>
                <Tag color={visitorCategoryLabels[selectedRecord.category]?.color || 'default'} style={{ fontSize: 13, padding: '2px 10px' }}>
                  {visitorCategoryLabels[selectedRecord.category]?.label}
                </Tag>
              </div>
            </div>

            <Divider />

            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="Phone Number">{selectedRecord.phoneNumber}</Descriptions.Item>
              {selectedRecord.email && (
                <Descriptions.Item label="Email">{selectedRecord.email}</Descriptions.Item>
              )}
              {selectedRecord.badgeNumber && (
                <Descriptions.Item label="Badge / Pass #">{selectedRecord.badgeNumber}</Descriptions.Item>
              )}
              <Descriptions.Item label="Purpose of Visit">{selectedRecord.purpose}</Descriptions.Item>
              <Descriptions.Item label="Person / Staff to See">{selectedRecord.hostStaffName || 'General Desk'}</Descriptions.Item>
              {selectedRecord.hostDepartment && (
                <Descriptions.Item label="Department">{selectedRecord.hostDepartment}</Descriptions.Item>
              )}
              <Descriptions.Item label="Check-In Time">
                {dayjs(selectedRecord.checkInTime).format('MMM D, YYYY — h:mm A')}
              </Descriptions.Item>
              {selectedRecord.checkOutTime && (
                <Descriptions.Item label="Check-Out Time">
                  {dayjs(selectedRecord.checkOutTime).format('MMM D, YYYY — h:mm A')}
                </Descriptions.Item>
              )}
              <Descriptions.Item label="Front Desk Handled By">
                {selectedRecord.handledByName || 'Receptionist'}
              </Descriptions.Item>
              {selectedRecord.notes && (
                <Descriptions.Item label="Notes & Remarks">{selectedRecord.notes}</Descriptions.Item>
              )}
            </Descriptions>

            <div style={{ marginTop: 24, textAlign: 'right' }}>
              {(selectedRecord.status === 'in_premises' || selectedRecord.status === 'waiting') && (
                <Button
                  type="primary"
                  block
                  icon={<LogoutOutlined />}
                  style={{ background: '#52c41a', borderColor: '#52c41a', marginBottom: 8 }}
                  onClick={() => {
                    setDetailDrawerOpen(false);
                    handleQuickCheckOut(selectedRecord);
                  }}
                >
                  Check Out This Visitor
                </Button>
              )}
              <Button block onClick={() => setDetailDrawerOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
};
