// src/pages/branches/BranchDashboard.tsx
import React, { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Card,
  Col,
  Descriptions,
  List,
  Result,
  Row,
  Spin,
  Statistic,
  Tag,
  Typography,
  Button,
  Table,
  Space,
  Badge,
  Empty,
  Tooltip,
  Modal,
  Select,
  message,
  Form,
  Input,
  DatePicker,
  InputNumber,
  Alert,
} from 'antd';
import dayjs from 'dayjs';
import {
  ArrowLeftOutlined,
  DollarOutlined,
  EnvironmentOutlined,
  PhoneOutlined,
  TeamOutlined,
  UserOutlined,
  FileTextOutlined,
  MailOutlined,
  UserAddOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import { PageHeader } from '@/components/shared/PageHeader';
import { PhotoUpload } from '@/components/shared/PhotoUpload';
import { tokens } from '@/constants/tokens';
import { roleLabels } from '@/constants/enums';
import { useBranchQuery } from '@/api/branches';
import { useExpensesQuery, useCreateExpenseMutation } from '@/api/expenses';
import { useComplaintsQuery } from '@/api/complaints';
import { useUsersQuery, getUserPhone } from '@/api/users';
import { useAuth } from '@/contexts/AuthContext';
import { useBranchContext } from '@/contexts/BranchContext';
import {
  useAssignmentListener,
  enrichUserWithAssignment,
  isUserInBranch,
  getStoredBranchStaff,
  setStoredBranchStaff,
} from '@/utils/userAssignmentStorage';
import { getBranchCanonicalKey } from '@/utils/branchIsolation';

const { Text } = Typography;

export const BranchDashboard: React.FC = () => {
  const { branchId } = useParams<{ branchId: string }>();
  const navigate = useNavigate();
  const { branches, isLoading: branchesLoading } = useBranchContext();

  const { data: branchData, isLoading: branchLoading } = useBranchQuery(branchId);
  const { data: usersData, isLoading: usersLoading } = useUsersQuery();
  const { data: expensesData } = useExpensesQuery({ branchId });
  const { data: complaintsData } = useComplaintsQuery();
  const tick = useAssignmentListener();

  // Resolve branch using API data or BranchContext (with canonical matching)
  const branch = useMemo(() => {
    if (branchData) return branchData;
    if (!branchId) return null;
    return (
      branches.find(
        (b) =>
          b.id === branchId ||
          b.branchCode === branchId ||
          getBranchCanonicalKey(b.id || b.name || b.branchCode) === getBranchCanonicalKey(branchId)
      ) || null
    );
  }, [branchData, branches, branchId, tick]);

  const users = useMemo(() => {
    return (usersData?.items ?? []).map((u) =>
      enrichUserWithAssignment(
        {
          ...u,
          phoneNumber: getUserPhone(u),
        },
        branches
      )
    );
  }, [usersData, branches, tick]);

  // Assigned staff for this branch
  const assignedStaff = useMemo(() => {
    if (!branch) return [];
    return users.filter((u) => isUserInBranch(u, branch));
  }, [users, branch, tick]);

  // Branch manager
  const branchManagerName = useMemo(() => {
    if (!branch) return 'Unassigned Manager';
    if (branch.managerInfo) {
      return `${branch.managerInfo.firstName} ${branch.managerInfo.lastName}`;
    }
    if (branch.managerUserId) {
      const mgr = users.find((u) => u.id === branch.managerUserId);
      if (mgr) return `${mgr.firstName} ${mgr.lastName}`;
    }
    const mgr = assignedStaff.find(
      (u) =>
        u.role === 'branch_manager' ||
        u.role === 'marketing_director' ||
        u.role === 'admin' ||
        u.role === 'secretary'
    ) || assignedStaff[0];
    return mgr ? `${mgr.firstName} ${mgr.lastName}` : 'Unassigned Manager';
  }, [branch, users, assignedStaff]);

  // Modal state for assigning staff
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([]);
  const [savingStaff, setSavingStaff] = useState(false);

  const openAssignModal = () => {
    if (!branch) return;
    const currentIds = assignedStaff.map((u) => u.id);
    setSelectedStaffIds(currentIds);
    setAssignModalOpen(true);
  };

  const { user } = useAuth();
  const createExpenseMutation = useCreateExpenseMutation();
  const [addExpenseModal, setAddExpenseModal] = useState(false);
  const [expenseLoading, setExpenseLoading] = useState(false);
  const [expenseForm] = Form.useForm();

  const handleInitiateExpense = async (values: any) => {
    if (!branch) return;
    try {
      setExpenseLoading(true);
      const amountMinor = Math.round(values.amountGHS * 100);
      await createExpenseMutation.mutateAsync({
        category: values.category,
        type: values.type || 'internal',
        amountMinor,
        incurredOn: values.incurredOn.format('YYYY-MM-DD'),
        description: values.description,
        branchId: branch.id,
        recordedByUserId: user?.id,
        recordedByUserName: user?.firstName ? `${user.firstName} ${user.lastName}` : 'Branch Manager',
        recordedByUserRole: user?.role || 'branch_manager',
        status: 'pending',
      });
      message.success(`Expense submitted successfully for Admin & Accounts approval!`);
      setAddExpenseModal(false);
      expenseForm.resetFields();
    } catch (err: any) {
      message.error(err?.message || 'Failed to record expense');
    } finally {
      setExpenseLoading(false);
    }
  };

  const handleSaveStaff = () => {
    if (!branch) return;
    setSavingStaff(true);
    try {
      setStoredBranchStaff(branch.id, selectedStaffIds, branch.name);
      message.success(`Staff assignments for ${branch.name} updated successfully!`);
      setAssignModalOpen(false);
    } catch {
      message.error('Failed to update staff assignments');
    } finally {
      setSavingStaff(false);
    }
  };

  if ((branchLoading || usersLoading || branchesLoading) && !branch) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <Spin size="large" tip="Loading branch details..." />
      </div>
    );
  }

  if (!branch) {
    return (
      <Result
        status="404"
        title="Branch not found"
        subTitle="The requested branch does not exist."
        extra={<Button type="primary" onClick={() => navigate('/branches')}>Back to Branches</Button>}
      />
    );
  }

  const expenses = expensesData?.items ?? [];
  const complaints = complaintsData?.items ?? [];
  const totalExpenseMinor = expenses.reduce((sum, e) => sum + (e.amountMinor || 0), 0);

  const staffColumns = [
    {
      title: 'Staff Member',
      key: 'user',
      width: 240,
      render: (_: any, record: any) => (
        <Space size={10}>
          <PhotoUpload entityType="staff" entityId={record.id} size={36} editable={false} />
          <div>
            <Text strong style={{ display: 'block', fontSize: 13 }}>
              {record.firstName} {record.lastName}
            </Text>
            <Text type="secondary" style={{ fontSize: 11, color: '#64748b' }}>
              <MailOutlined /> {record.email}
            </Text>
          </div>
        </Space>
      ),
    },
    {
      title: 'Role',
      dataIndex: 'role',
      key: 'role',
      width: 160,
      render: (role: string) => (
        <Tag color="blue" style={{ borderRadius: 12, padding: '2px 10px', fontSize: 11 }}>
          {roleLabels[role as keyof typeof roleLabels] || role}
        </Tag>
      ),
    },
    {
      title: 'Phone Number',
      dataIndex: 'phoneNumber',
      key: 'phoneNumber',
      width: 150,
      render: (phone: string) => (
        phone ? <a href={`tel:${phone}`} style={{ fontSize: 12 }}><PhoneOutlined /> {phone}</a> : '—'
      ),
    },
    {
      title: 'Status',
      key: 'status',
      width: 110,
      align: 'center' as const,
      render: (_: any, record: any) => (
        <Badge
          status={record.isActive ? 'success' : 'error'}
          text={
            <Text style={{ fontSize: 12, fontWeight: 600, color: record.isActive ? '#52c41a' : '#ff4d4f' }}>
              {record.isActive ? 'ACTIVE' : 'INACTIVE'}
            </Text>
          }
        />
      ),
    },
    {
      title: 'Joined Date',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 140,
      align: 'center' as const,
      render: (date: string) => date ? new Date(date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '—',
    },
  ];

  return (
    <div>
      <PageHeader
        title={branch.name}
        actions={[
          { label: 'Record Expense', onClick: () => setAddExpenseModal(true), icon: <DollarOutlined />, type: 'primary' },
          { label: 'All Branches', onClick: () => navigate('/branches'), icon: <ArrowLeftOutlined /> },
        ]}
      />

      <Card style={{ marginBottom: 24 }}>
        <Descriptions column={{ xs: 1, sm: 2, md: 5 }}>
          <Descriptions.Item label="Branch Code"><Tag color={tokens.primary}>{branch.branchCode}</Tag></Descriptions.Item>
          <Descriptions.Item label={<span><EnvironmentOutlined /> Location</span>}>{branch.location}</Descriptions.Item>
          <Descriptions.Item label={<span><UserOutlined /> Branch Manager</span>}>
            <Tag color={branchManagerName !== 'Unassigned Manager' ? 'purple' : 'default'} style={{ borderRadius: 12, padding: '2px 10px', fontWeight: 500 }}>
              {branchManagerName}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label={<span><PhoneOutlined /> Phone</span>}>
            {branch.phone ? <a href={`tel:${branch.phone}`}>{branch.phone}</a> : 'N/A'}
          </Descriptions.Item>
          <Descriptions.Item label="Staff Count">
            <Tag color={assignedStaff.length > 0 ? 'green' : 'gold'} style={{ fontWeight: 600 }}>{assignedStaff.length} Staff</Tag>
          </Descriptions.Item>
        </Descriptions>
      </Card>

      {/* Quick stats */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={8}>
          <Card><Statistic title="Total Expenses Ledger" value={totalExpenseMinor / 100} prefix="GHS" precision={2} valueStyle={{ color: '#ff4d4f' }} /></Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card><Statistic title="Staff Assigned" value={assignedStaff.length} prefix={<TeamOutlined />} valueStyle={{ color: tokens.primary }} /></Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card><Statistic title="Open Customer Complaints" value={complaints.filter(c => c.status !== 'resolved').length} valueStyle={{ color: '#faad14' }} /></Card>
        </Col>
      </Row>

      {/* Assigned Staff Roster Table */}
      <Card
        title={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
            <Space>
              <TeamOutlined style={{ color: tokens.primary }} />
              <span>Assigned Staff Roster ({assignedStaff.length})</span>
            </Space>
            <Button
              type="primary"
              size="small"
              icon={<UserAddOutlined />}
              onClick={openAssignModal}
              style={{ backgroundColor: tokens.primary }}
            >
              Assign Staff
            </Button>
          </div>
        }
        style={{ marginBottom: 24 }}
      >
        {assignedStaff.length > 0 ? (
          <Table
            columns={staffColumns}
            dataSource={assignedStaff}
            rowKey="id"
            pagination={false}
            size="middle"
            scroll={{ x: 800 }}
          />
        ) : (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <div>
                <Text type="secondary">No staff assigned to this branch yet.</Text>
                <br />
                <Button
                  type="primary"
                  size="small"
                  icon={<UserAddOutlined />}
                  onClick={openAssignModal}
                  style={{ marginTop: 12, backgroundColor: tokens.primary }}
                >
                  Assign Staff Now
                </Button>
              </div>
            }
          />
        )}
      </Card>

      <Row gutter={16}>
        <Col xs={24} lg={12}>
          <Card
            title={
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span><DollarOutlined style={{ marginRight: 8 }} />Branch Expenses</span>
                <Button size="small" type="primary" icon={<PlusOutlined />} onClick={() => setAddExpenseModal(true)}>
                  Record Expense
                </Button>
              </div>
            }
            style={{ marginBottom: 24 }}
          >
            {expenses.length > 0 ? (
              <List
                dataSource={expenses}
                renderItem={(e) => (
                  <List.Item
                    extra={
                      <div style={{ textAlign: 'right' }}>
                        <Text strong style={{ display: 'block' }}>GHS {(e.amountMinor / 100).toLocaleString()}</Text>
                        <Tag color={e.status === 'approved' ? 'green' : e.status === 'pending' ? 'gold' : 'red'} style={{ marginTop: 4 }}>
                          {e.status === 'approved' ? 'Approved' : e.status === 'pending' ? 'Pending Approval' : 'Rejected'}
                        </Tag>
                      </div>
                    }
                  >
                    <List.Item.Meta
                      title={e.category}
                      description={`${e.code || 'EXP'} · Incurred ${e.incurredOn}${e.description ? ` · ${e.description}` : ''}`}
                    />
                  </List.Item>
                )}
              />
            ) : <Text type="secondary">No expenses recorded for this branch.</Text>}
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card title={<span><FileTextOutlined style={{ marginRight: 8 }} />Customer Support Feed</span>}>
            {complaints.length > 0 ? (
              <List
                dataSource={complaints}
                renderItem={(c) => (
                  <List.Item extra={<Tag color={c.status === 'resolved' ? 'green' : 'gold'}>{c.status}</Tag>}>
                    <List.Item.Meta
                      title={c.subject}
                      description={`Customer: ${c.customerName || 'Customer'} · ${c.message}`}
                    />
                  </List.Item>
                )}
              />
            ) : <Text type="secondary">No active complaints.</Text>}
          </Card>
        </Col>
      </Row>

      {/* Assign Staff Modal */}
      <Modal
        title={`Assign Staff to ${branch.name}`}
        open={assignModalOpen}
        onCancel={() => setAssignModalOpen(false)}
        onOk={handleSaveStaff}
        confirmLoading={savingStaff}
        okText="Save Assignments"
        width={540}
      >
        <p style={{ color: '#64748b', fontSize: 13, marginBottom: 16 }}>
          Select team members to attach to {branch.name}. Their branch affiliation in User Management and dashboards will immediately update.
        </p>
        <Select
          mode="multiple"
          placeholder="Select staff members"
          value={selectedStaffIds}
          onChange={setSelectedStaffIds}
          style={{ width: '100%' }}
          showSearch
          optionFilterProp="children"
        >
          {users.map((u: any) => {
            const roleLabel = roleLabels[u.role as keyof typeof roleLabels] || (u.role ? u.role.replace('_', ' ') : 'Staff');
            return (
              <Select.Option key={u.id} value={u.id}>
                👤 {u.firstName} {u.lastName} — {roleLabel} {u.branchName ? `(${u.branchName})` : ''}
              </Select.Option>
            );
          })}
        </Select>
      </Modal>

      {/* Record Branch Expense Modal */}
      <Modal
        title={
          <Space>
            <DollarOutlined style={{ color: '#fa8c16' }} />
            <span>Record Branch Operational Expense</span>
          </Space>
        }
        open={addExpenseModal}
        onCancel={() => {
          setAddExpenseModal(false);
          expenseForm.resetFields();
        }}
        footer={null}
        destroyOnClose
        width={540}
      >
        <Form form={expenseForm} layout="vertical" onFinish={handleInitiateExpense}>
          <Alert
            type="info"
            showIcon
            message="Pending Approval Workflow"
            description="Branch expenses will be placed in 'pending' status for review and authorization by Admin and Accounts dashboards."
            style={{ marginBottom: 16 }}
          />

          <Row gutter={12}>
            <Col span={14}>
              <Form.Item
                name="category"
                label="Expense Category"
                rules={[{ required: true, message: 'Please pick category' }]}
                initialValue="Power & Generator Servicing"
              >
                <Select placeholder="Select category">
                  <Select.Option value="Power & Generator Servicing">Power & Generator Servicing</Select.Option>
                  <Select.Option value="Site Inspection Logistics">Site Inspection Shuttle & Logistics</Select.Option>
                  <Select.Option value="Facility Maintenance">Facility & AC Maintenance</Select.Option>
                  <Select.Option value="Branch Security & Sanitation">Security & Sanitation</Select.Option>
                  <Select.Option value="Office Supplies & Stationery">Office Supplies & Stationery</Select.Option>
                  <Select.Option value="Client Refreshments">Client Hospitality & Refreshments</Select.Option>
                  <Select.Option value="Other Branch Operations">Other Branch Operations</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={10}>
              <Form.Item name="type" label="Expense Type" initialValue="internal" rules={[{ required: true }]}>
                <Select>
                  <Select.Option value="internal">🏢 Internal Operations</Select.Option>
                  <Select.Option value="external">🚚 External / Site Work</Select.Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={12}>
            <Col span={12}>
              <Form.Item
                name="amountGHS"
                label="Amount (GH₵)"
                rules={[{ required: true, message: 'Enter amount' }]}
              >
                <InputNumber style={{ width: '100%' }} min={0.01} precision={2} prefix="GH₵" placeholder="0.00" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="incurredOn"
                label="Incurred Date"
                initialValue={dayjs()}
                rules={[{ required: true }]}
              >
                <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="description"
            label="Detailed Purpose / Notes"
            rules={[{ required: true, message: 'Explain what this expense is for' }]}
          >
            <Input.TextArea rows={3} placeholder="Vendor, itemized service details, receipt/voucher reference..." />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => {
                setAddExpenseModal(false);
                expenseForm.resetFields();
              }}>
                Cancel
              </Button>
              <Button type="primary" htmlType="submit" loading={expenseLoading}>
                Submit Expense for Approval
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
