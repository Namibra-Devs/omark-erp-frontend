// src/pages/dashboard/admin/components/ClientCheckInsTable.tsx
import React, { useState, useMemo, useEffect } from 'react';
import {
  Card,
  Table,
  Tag,
  Space,
  Button,
  Input,
  Select,
  Badge,
  Avatar,
  Modal,
  Form,
  Tooltip,
  Popconfirm,
  message,
  Typography,
  Row,
  Col,
  Statistic,
  Descriptions,
} from 'antd';
import {
  IdcardOutlined,
  EnvironmentOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  PlusOutlined,
  SearchOutlined,
  EyeOutlined,
  DeleteOutlined,
  UserOutlined,
  PhoneOutlined,
  ArrowRightOutlined,
  ReloadOutlined,
  ShopOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { useAuth } from '@/contexts/AuthContext';
import { useBranchesQuery } from '@/api/branches';
import {
  useCheckIns,
  visitorCategoryLabels,
  checkInStatusLabels,
  type CheckInRecord,
  type CheckInStatus,
  type VisitorCategory,
} from '@/utils/visitorCheckIns';
import { PhoneInput } from '@/components/shared/PhoneInput';
import { getUserBranchId } from '@/utils/branchIsolation';

dayjs.extend(relativeTime);

const { Title, Text } = Typography;
const { Option } = Select;

interface ClientCheckInsTableProps {
  title?: string;
  style?: React.CSSProperties;
  /** Explicit branchId override; if omitted, defaults to 'all' for admin, or user's branch */
  branchId?: string;
  /** Compact mode for smaller dashboard widgets */
  compact?: boolean;
}

export const ClientCheckInsTable: React.FC<ClientCheckInsTableProps> = ({
  title = 'Front-Desk Client & Visitor Check-Ins',
  style,
  branchId: propBranchId,
  compact = false,
}) => {
  const navigate = useNavigate();
  const { user, hasRole } = useAuth();
  const { data: branches = [] } = useBranchesQuery();
  const userBranchId = getUserBranchId(user);
  const isAdmin = hasRole(['admin', 'super_admin', 'director', 'ceo', 'executive']);

  // Active branch: if prop provided use it; else if admin default 'all', else userBranchId
  const [selectedBranch, setSelectedBranch] = useState<string>(
    propBranchId || (isAdmin ? 'all' : (userBranchId || 'all'))
  );

  useEffect(() => {
    if (propBranchId) {
      setSelectedBranch(propBranchId);
    } else if (isAdmin) {
      setSelectedBranch('all');
    } else if (userBranchId) {
      setSelectedBranch(userBranchId);
    }
  }, [propBranchId, userBranchId, isAdmin]);

  const {
    records,
    allRecords,
    addCheckIn,
    updateCheckIn,
    checkOutVisitor,
    deleteCheckIn,
  } = useCheckIns(selectedBranch, branches);

  // Filters
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<CheckInStatus | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = useState<VisitorCategory | 'all'>('all');

  // Modals
  const [checkInModalOpen, setCheckInModalOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<CheckInRecord | null>(null);
  const [checkOutModalOpen, setCheckOutModalOpen] = useState(false);
  const [recordToCheckOut, setRecordToCheckOut] = useState<CheckInRecord | null>(null);
  const [form] = Form.useForm();
  const [checkOutForm] = Form.useForm();

  // Statistics
  const stats = useMemo(() => {
    const onPremises = records.filter((r) => r.status === 'in_premises').length;
    const inLobby = records.filter((r) => r.status === 'waiting').length;
    const completed = records.filter((r) => r.status === 'completed').length;
    return {
      onPremises,
      inLobby,
      completed,
      total: records.length,
    };
  }, [records]);

  // Filtered records
  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (categoryFilter !== 'all' && r.category !== categoryFilter) return false;

      if (searchText.trim()) {
        const q = searchText.toLowerCase();
        const matchesName = r.visitorName?.toLowerCase().includes(q);
        const matchesPhone = r.phoneNumber?.toLowerCase().includes(q);
        const matchesPurpose = r.purpose?.toLowerCase().includes(q);
        const matchesHost = r.hostStaffName?.toLowerCase().includes(q);
        const matchesCode = r.code?.toLowerCase().includes(q);
        const matchesBadge = r.badgeNumber?.toLowerCase().includes(q);
        if (!matchesName && !matchesPhone && !matchesPurpose && !matchesHost && !matchesCode && !matchesBadge) {
          return false;
        }
      }
      return true;
    });
  }, [records, statusFilter, categoryFilter, searchText]);

  // Check In Submission
  const handleCheckInSubmit = async (values: any) => {
    try {
      const receptionistName = user?.firstName
        ? `${user.firstName} ${user.lastName || ''}`.trim()
        : 'Front Desk';
      const branch = values.branchId || (selectedBranch !== 'all' ? selectedBranch : (userBranchId || branches[0]?.id || 'b2'));

      addCheckIn({
        visitorName: values.visitorName.trim(),
        phoneNumber: values.phoneNumber.trim(),
        email: values.email?.trim() || undefined,
        category: values.category,
        purpose: values.purpose.trim(),
        hostStaffName: values.hostStaffName?.trim() || undefined,
        hostDepartment: values.hostDepartment?.trim() || undefined,
        branchId: branch,
        badgeNumber: values.badgeNumber?.trim() || undefined,
        notes: values.notes?.trim() || undefined,
        status: values.status || 'in_premises',
        checkInTime: new Date().toISOString(),
        handledByName: receptionistName,
        handledByUserId: user?.id,
      });

      message.success(`Client ${values.visitorName} checked in successfully!`);
      setCheckInModalOpen(false);
      form.resetFields();
    } catch (err: any) {
      message.error(err.message || 'Failed to check in visitor');
    }
  };

  // Check Out Submission
  const handleCheckOutSubmit = (values: any) => {
    if (!recordToCheckOut) return;
    try {
      checkOutVisitor(recordToCheckOut.id, values.notes);
      message.success(`${recordToCheckOut.visitorName} has been checked out.`);
      setCheckOutModalOpen(false);
      setRecordToCheckOut(null);
      checkOutForm.resetFields();
    } catch (err: any) {
      message.error(err.message || 'Failed to check out visitor');
    }
  };

  // Branch Name Resolver
  const getBranchName = (bId: string) => {
    const found = branches.find((b) => b.id === bId || b.branchCode === bId || b.name === bId);
    return found?.name || bId || 'Main Office';
  };

  // Columns definition
  const columns = [
    {
      title: 'Visitor & Identity',
      key: 'visitor',
      render: (_: any, r: CheckInRecord) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Avatar
            style={{
              backgroundColor: r.status === 'in_premises' ? '#52c41a' : r.status === 'waiting' ? '#faad14' : '#1890ff',
              fontWeight: 700,
            }}
          >
            {r.visitorName ? r.visitorName.charAt(0).toUpperCase() : 'V'}
          </Avatar>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Text strong style={{ fontSize: 13, color: '#1a1a2e' }}>
                {r.visitorName}
              </Text>
              {r.badgeNumber && (
                <Tag color="gold" style={{ fontSize: 10, padding: '0 4px', margin: 0, fontWeight: 600 }}>
                  {r.badgeNumber}
                </Tag>
              )}
            </div>
            <div style={{ fontSize: 11, color: '#8c8c8c' }}>{r.code}</div>
          </div>
        </div>
      ),
    },
    {
      title: 'Contact & Category',
      key: 'contact',
      render: (_: any, r: CheckInRecord) => {
        const catConfig = visitorCategoryLabels[r.category] || { label: r.category, color: 'default' };
        return (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
              <PhoneOutlined style={{ color: '#8c8c8c', fontSize: 11 }} />
              <a href={`tel:${r.phoneNumber}`} style={{ color: '#1890ff', fontWeight: 500 }}>
                {r.phoneNumber}
              </a>
            </div>
            <div style={{ marginTop: 3 }}>
              <Tag color={catConfig.color} style={{ fontSize: 11, margin: 0, borderRadius: 4 }}>
                {catConfig.label}
              </Tag>
            </div>
          </div>
        );
      },
    },
    ...(!compact
      ? [
          {
            title: 'Branch',
            key: 'branch',
            render: (_: any, r: CheckInRecord) => (
              <Tag color="blue" icon={<ShopOutlined />} style={{ borderRadius: 4, fontSize: 11 }}>
                {getBranchName(r.branchId)}
              </Tag>
            ),
          },
        ]
      : []),
    {
      title: 'Purpose & Host',
      key: 'purpose',
      render: (_: any, r: CheckInRecord) => (
        <div>
          <Text strong style={{ fontSize: 12, color: '#262626' }}>
            {r.purpose}
          </Text>
          {r.hostStaffName && (
            <div style={{ fontSize: 11, color: '#595959', marginTop: 2 }}>
              <UserOutlined style={{ marginRight: 4, color: '#8c8c8c' }} />
              Host: <span style={{ fontWeight: 500 }}>{r.hostStaffName}</span>
              {r.hostDepartment && (
                <span style={{ color: '#8c8c8c', marginLeft: 4 }}>({r.hostDepartment})</span>
              )}
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Check-In Time',
      key: 'checkInTime',
      render: (_: any, r: CheckInRecord) => {
        const checkIn = dayjs(r.checkInTime);
        const isToday = checkIn.isSame(dayjs(), 'day');
        return (
          <div>
            <div style={{ fontWeight: 600, color: '#262626', fontSize: 12 }}>
              {checkIn.format('h:mm A')}
            </div>
            <div style={{ fontSize: 11, color: '#8c8c8c' }}>
              {isToday ? 'Today' : checkIn.format('MMM D, YYYY')}
            </div>
          </div>
        );
      },
    },
    {
      title: 'Status',
      key: 'status',
      render: (_: any, r: CheckInRecord) => {
        const statusConfig = checkInStatusLabels[r.status] || { label: r.status, color: 'default' };
        return (
          <Tag color={statusConfig.color} style={{ fontWeight: 600, borderRadius: 4, fontSize: 11 }}>
            {r.status === 'in_premises' && <EnvironmentOutlined style={{ marginRight: 4 }} />}
            {r.status === 'waiting' && <ClockCircleOutlined style={{ marginRight: 4 }} />}
            {r.status === 'completed' && <CheckCircleOutlined style={{ marginRight: 4 }} />}
            {statusConfig.label}
          </Tag>
        );
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      align: 'right' as const,
      render: (_: any, r: CheckInRecord) => (
        <Space size={4}>
          {r.status !== 'completed' && r.status !== 'canceled' && (
            <Tooltip title="Check Out Visitor">
              <Button
                size="small"
                type="primary"
                style={{ background: '#52c41a', borderColor: '#52c41a', fontSize: 11 }}
                onClick={() => {
                  setRecordToCheckOut(r);
                  setCheckOutModalOpen(true);
                }}
              >
                Check Out
              </Button>
            </Tooltip>
          )}
          <Tooltip title="View Check-In Details">
            <Button
              size="small"
              icon={<EyeOutlined />}
              onClick={() => setSelectedRecord(r)}
            />
          </Tooltip>
          {hasRole(['admin']) && (
            <Popconfirm
              title="Delete Check-In Record"
              description={`Delete check-in for ${r.visitorName}?`}
              onConfirm={() => {
                deleteCheckIn(r.id);
                message.success('Check-in record deleted');
              }}
              okText="Yes"
              cancelText="No"
              okButtonProps={{ danger: true }}
            >
              <Button size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <Card
      style={{
        borderRadius: 14,
        boxShadow: '0 2px 10px rgba(0,0,0,0.03)',
        border: '1px solid #f0f0f0',
        ...style,
      }}
      title={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <Space size={8} wrap>
            <IdcardOutlined style={{ color: '#722ed1', fontSize: 18 }} />
            <span style={{ fontWeight: 600, fontSize: 15 }}>{title}</span>
            <Tag color="green" style={{ borderRadius: 10, fontSize: 11 }}>
              <CheckCircleOutlined style={{ marginRight: 4 }} />
              Live & Synced
            </Tag>
            <Badge
              count={stats.onPremises}
              style={{ backgroundColor: '#52c41a' }}
              title={`${stats.onPremises} on premises`}
            />
          </Space>

          <Space wrap>
            {hasRole(['admin']) && !propBranchId && (
              <Select
                value={selectedBranch}
                onChange={setSelectedBranch}
                style={{ width: 150 }}
                size="small"
              >
                <Option value="all">All Branches ({allRecords.length})</Option>
                {branches.map((b) => (
                  <Option key={b.id} value={b.id}>
                    {b.name}
                  </Option>
                ))}
              </Select>
            )}

            <Button
              type="primary"
              size="small"
              icon={<PlusOutlined />}
              onClick={() => {
                form.setFieldsValue({
                  branchId: selectedBranch !== 'all' ? selectedBranch : (userBranchId || branches[0]?.id || 'b2'),
                  category: 'customer',
                  status: 'in_premises',
                });
                setCheckInModalOpen(true);
              }}
              style={{ borderRadius: 6, fontWeight: 500 }}
            >
              + Check In Visitor
            </Button>

            <Button
              size="small"
              type="link"
              onClick={() => navigate('/cs/check-ins')}
              style={{ padding: 0, fontWeight: 500 }}
            >
              Full Check-Ins Portal <ArrowRightOutlined />
            </Button>
          </Space>
        </div>
      }
    >
      {/* ── METRIC STAT COUNTERS ────────────────────────────────────────── */}
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={6}>
          <div
            onClick={() => setStatusFilter(statusFilter === 'in_premises' ? 'all' : 'in_premises')}
            style={{
              padding: '10px 14px',
              borderRadius: 8,
              border: `1px solid ${statusFilter === 'in_premises' ? '#52c41a' : '#f0f0f0'}`,
              background: statusFilter === 'in_premises' ? '#f6ffed' : '#fafafa',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            <Statistic
              title={<span style={{ fontSize: 12, color: '#595959', fontWeight: 500 }}>On Premises</span>}
              value={stats.onPremises}
              prefix={<EnvironmentOutlined style={{ color: '#52c41a' }} />}
              valueStyle={{ color: '#52c41a', fontSize: 20, fontWeight: 700 }}
            />
          </div>
        </Col>

        <Col xs={12} sm={6}>
          <div
            onClick={() => setStatusFilter(statusFilter === 'waiting' ? 'all' : 'waiting')}
            style={{
              padding: '10px 14px',
              borderRadius: 8,
              border: `1px solid ${statusFilter === 'waiting' ? '#faad14' : '#f0f0f0'}`,
              background: statusFilter === 'waiting' ? '#fffbe6' : '#fafafa',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            <Statistic
              title={<span style={{ fontSize: 12, color: '#595959', fontWeight: 500 }}>In Reception</span>}
              value={stats.inLobby}
              prefix={<ClockCircleOutlined style={{ color: '#faad14' }} />}
              valueStyle={{ color: '#faad14', fontSize: 20, fontWeight: 700 }}
            />
          </div>
        </Col>

        <Col xs={12} sm={6}>
          <div
            onClick={() => setStatusFilter(statusFilter === 'completed' ? 'all' : 'completed')}
            style={{
              padding: '10px 14px',
              borderRadius: 8,
              border: `1px solid ${statusFilter === 'completed' ? '#1890ff' : '#f0f0f0'}`,
              background: statusFilter === 'completed' ? '#e6f7ff' : '#fafafa',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            <Statistic
              title={<span style={{ fontSize: 12, color: '#595959', fontWeight: 500 }}>Checked Out</span>}
              value={stats.completed}
              prefix={<CheckCircleOutlined style={{ color: '#1890ff' }} />}
              valueStyle={{ color: '#1890ff', fontSize: 20, fontWeight: 700 }}
            />
          </div>
        </Col>

        <Col xs={12} sm={6}>
          <div
            onClick={() => setStatusFilter('all')}
            style={{
              padding: '10px 14px',
              borderRadius: 8,
              border: `1px solid ${statusFilter === 'all' ? '#722ed1' : '#f0f0f0'}`,
              background: statusFilter === 'all' ? '#f9f0ff' : '#fafafa',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            <Statistic
              title={<span style={{ fontSize: 12, color: '#595959', fontWeight: 500 }}>Total Check-Ins</span>}
              value={stats.total}
              prefix={<IdcardOutlined style={{ color: '#722ed1' }} />}
              valueStyle={{ color: '#722ed1', fontSize: 20, fontWeight: 700 }}
            />
          </div>
        </Col>
      </Row>

      {/* ── SEARCH & FILTER CONTROLS ────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
        <Input
          prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
          placeholder="Search visitor, phone, purpose, badge..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          allowClear
          style={{ flex: 1, minWidth: 200 }}
          size="small"
        />

        <Select
          value={categoryFilter}
          onChange={setCategoryFilter}
          style={{ width: 160 }}
          size="small"
        >
          <Option value="all">All Categories</Option>
          {Object.entries(visitorCategoryLabels).map(([key, cfg]) => (
            <Option key={key} value={key}>
              {cfg.label}
            </Option>
          ))}
        </Select>

        <Select
          value={statusFilter}
          onChange={setStatusFilter}
          style={{ width: 140 }}
          size="small"
        >
          <Option value="all">All Statuses ({records.length})</Option>
          <Option value="in_premises">On Premises ({stats.onPremises})</Option>
          <Option value="waiting">In Reception ({stats.inLobby})</Option>
          <Option value="completed">Checked Out ({stats.completed})</Option>
        </Select>

        {(searchText || statusFilter !== 'all' || categoryFilter !== 'all') && (
          <Button
            size="small"
            onClick={() => {
              setSearchText('');
              setStatusFilter('all');
              setCategoryFilter('all');
            }}
          >
            Reset Filters
          </Button>
        )}
      </div>

      {/* ── CHECK-INS TABLE ─────────────────────────────────────────────── */}
      <Table
        columns={columns}
        dataSource={filteredRecords}
        rowKey="id"
        size="small"
        pagination={{ pageSize: compact ? 5 : 8, showSizeChanger: true }}
        scroll={{ x: 750 }}
      />

      {/* ── CHECK IN VISITOR MODAL ──────────────────────────────────────── */}
      <Modal
        title={
          <Space>
            <IdcardOutlined style={{ color: '#1890ff' }} />
            <span>Check In New Client / Visitor</span>
          </Space>
        }
        open={checkInModalOpen}
        onCancel={() => setCheckInModalOpen(false)}
        footer={null}
        destroyOnClose
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleCheckInSubmit}
          initialValues={{
            branchId: propBranchId || (selectedBranch !== 'all' ? selectedBranch : (userBranchId || branches[0]?.id)),
            status: 'in_premises',
            category: 'customer',
          }}
        >
          <Form.Item
            name="visitorName"
            label="Client / Visitor Full Name"
            rules={[{ required: true, message: 'Please enter visitor name' }]}
          >
            <Input placeholder="e.g. Dr. Kwame Mensah" prefix={<UserOutlined />} />
          </Form.Item>

          <Row gutter={12}>
            <Col span={12}>
              <Form.Item
                name="phoneNumber"
                label="Phone Number"
                rules={[{ required: true, message: 'Please enter phone number' }]}
              >
                <PhoneInput placeholder="e.g. 0244123456" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="email" label="Email Address (Optional)">
                <Input placeholder="e.g. visitor@gmail.com" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={12}>
            <Col span={12}>
              <Form.Item
                name="category"
                label="Visitor Category"
                rules={[{ required: true, message: 'Please select category' }]}
              >
                <Select placeholder="Select category">
                  {Object.entries(visitorCategoryLabels).map(([k, cfg]) => (
                    <Option key={k} value={k}>
                      {cfg.label}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="badgeNumber" label="Badge / Pass # (Optional)">
                <Input placeholder="e.g. VIS-024" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="purpose"
            label="Purpose of Visit"
            rules={[{ required: true, message: 'Please state purpose of visit' }]}
          >
            <Input placeholder="e.g. Land Documentation & Title Deeds Inspection" />
          </Form.Item>

          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="hostStaffName" label="Host Staff / Officer">
                <Input placeholder="e.g. Francis Ofori" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="hostDepartment" label="Host Department">
                <Select placeholder="Select department" allowClear>
                  <Option value="Customer Service">Customer Service</Option>
                  <Option value="Marketing & Sales">Marketing & Sales</Option>
                  <Option value="Accounts & Finance">Accounts & Finance</Option>
                  <Option value="Executive Management">Executive Management</Option>
                  <Option value="Operations & Projects">Operations & Projects</Option>
                  <Option value="Legal & Surveys">Legal & Surveys</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="branchId" label="Branch Office">
            <Select placeholder="Select branch">
              {branches.map((b) => (
                <Option key={b.id} value={b.id}>
                  {b.name}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
            <Button onClick={() => setCheckInModalOpen(false)}>Cancel</Button>
            <Button type="primary" htmlType="submit">
              Record Check-In
            </Button>
          </div>
        </Form>
      </Modal>

      {/* ── CHECK OUT MODAL ─────────────────────────────────────────────── */}
      <Modal
        title={
          <Space>
            <CheckCircleOutlined style={{ color: '#52c41a' }} />
            <span>Check Out Visitor — {recordToCheckOut?.visitorName}</span>
          </Space>
        }
        open={checkOutModalOpen}
        onCancel={() => {
          setCheckOutModalOpen(false);
          setRecordToCheckOut(null);
        }}
        footer={null}
        destroyOnClose
      >
        <Form form={checkOutForm} layout="vertical" onFinish={handleCheckOutSubmit}>
          <Descriptions size="small" column={1} bordered style={{ marginBottom: 16 }}>
            <Descriptions.Item label="Visitor">{recordToCheckOut?.visitorName}</Descriptions.Item>
            <Descriptions.Item label="Pass Code">{recordToCheckOut?.code}</Descriptions.Item>
            <Descriptions.Item label="Check-In Time">
              {recordToCheckOut ? dayjs(recordToCheckOut.checkInTime).format('MMM D, YYYY · h:mm A') : ''}
            </Descriptions.Item>
            <Descriptions.Item label="Host Staff">{recordToCheckOut?.hostStaffName || 'General Reception'}</Descriptions.Item>
          </Descriptions>

          <Form.Item name="notes" label="Departure Notes / Handover">
            <Input.TextArea
              rows={3}
              placeholder="e.g. Visitor collected site plan copy; pass returned."
            />
          </Form.Item>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button
              onClick={() => {
                setCheckOutModalOpen(false);
                setRecordToCheckOut(null);
              }}
            >
              Cancel
            </Button>
            <Button type="primary" htmlType="submit" style={{ background: '#52c41a', borderColor: '#52c41a' }}>
              Confirm Check-Out
            </Button>
          </div>
        </Form>
      </Modal>

      {/* ── VIEW RECORD DETAILS MODAL ───────────────────────────────────── */}
      <Modal
        title="Visitor Check-In Record Details"
        open={selectedRecord !== null}
        onCancel={() => setSelectedRecord(null)}
        footer={[
          <Button key="close" onClick={() => setSelectedRecord(null)}>
            Close
          </Button>,
          selectedRecord && selectedRecord.status !== 'completed' && (
            <Button
              key="checkout"
              type="primary"
              style={{ background: '#52c41a', borderColor: '#52c41a' }}
              onClick={() => {
                const rec = selectedRecord;
                setSelectedRecord(null);
                setRecordToCheckOut(rec);
                setCheckOutModalOpen(true);
              }}
            >
              Check Out Visitor
            </Button>
          ),
        ]}
      >
        {selectedRecord && (
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="Visitor Name">{selectedRecord.visitorName}</Descriptions.Item>
            <Descriptions.Item label="Pass Code">{selectedRecord.code}</Descriptions.Item>
            <Descriptions.Item label="Badge #">{selectedRecord.badgeNumber || 'None'}</Descriptions.Item>
            <Descriptions.Item label="Phone Number">{selectedRecord.phoneNumber}</Descriptions.Item>
            {selectedRecord.email && (
              <Descriptions.Item label="Email">{selectedRecord.email}</Descriptions.Item>
            )}
            <Descriptions.Item label="Category">
              <Tag color={visitorCategoryLabels[selectedRecord.category]?.color}>
                {visitorCategoryLabels[selectedRecord.category]?.label}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Branch">{getBranchName(selectedRecord.branchId)}</Descriptions.Item>
            <Descriptions.Item label="Purpose">{selectedRecord.purpose}</Descriptions.Item>
            <Descriptions.Item label="Host Staff">
              {selectedRecord.hostStaffName || 'General Reception'}{' '}
              {selectedRecord.hostDepartment ? `(${selectedRecord.hostDepartment})` : ''}
            </Descriptions.Item>
            <Descriptions.Item label="Check-In Time">
              {dayjs(selectedRecord.checkInTime).format('MMM D, YYYY · h:mm A')}
            </Descriptions.Item>
            {selectedRecord.checkOutTime && (
              <Descriptions.Item label="Check-Out Time">
                {dayjs(selectedRecord.checkOutTime).format('MMM D, YYYY · h:mm A')}
              </Descriptions.Item>
            )}
            <Descriptions.Item label="Status">
              <Tag color={checkInStatusLabels[selectedRecord.status]?.color}>
                {checkInStatusLabels[selectedRecord.status]?.label}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Handled By">
              {selectedRecord.handledByName || 'Front Desk'}
            </Descriptions.Item>
            {selectedRecord.notes && (
              <Descriptions.Item label="Notes">{selectedRecord.notes}</Descriptions.Item>
            )}
          </Descriptions>
        )}
      </Modal>
    </Card>
  );
};
