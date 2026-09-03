// src/pages/branches/BranchDashboard.tsx
import React, { useMemo } from 'react';
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
} from 'antd';
import {
  ArrowLeftOutlined,
  DollarOutlined,
  EnvironmentOutlined,
  PhoneOutlined,
  TeamOutlined,
  UserOutlined,
  FileTextOutlined,
  MailOutlined,
} from '@ant-design/icons';
import { PageHeader } from '@/components/shared/PageHeader';
import { PhotoUpload } from '@/components/shared/PhotoUpload';
import { tokens } from '@/constants/tokens';
import { roleLabels } from '@/constants/enums';
import { useBranchQuery } from '@/api/branches';
import { useExpensesQuery } from '@/api/expenses';
import { useComplaintsQuery } from '@/api/complaints';
import { useUsersQuery, getUserPhone } from '@/api/users';
import { getStaffAssignment } from '@/mock/staffAssignments';

const { Text } = Typography;

export const BranchDashboard: React.FC = () => {
  const { branchId } = useParams<{ branchId: string }>();
  const navigate = useNavigate();

  const { data: branch, isLoading: branchLoading } = useBranchQuery(branchId);
  const { data: usersData, isLoading: usersLoading } = useUsersQuery();
  const { data: expensesData } = useExpensesQuery({ branchId });
  const { data: complaintsData } = useComplaintsQuery();

  const users = useMemo(() => {
    return (usersData?.items ?? []).map((u) => ({
      ...u,
      phoneNumber: getUserPhone(u),
    }));
  }, [usersData]);

  // Assigned staff for this branch
  const assignedStaff = useMemo(() => {
    if (!branchId) return [];
    return users.filter((u) => {
      const assignment = getStaffAssignment(u.id);
      const bId = assignment?.branchId || (u as any).branchId || (u as any).branch;
      return bId === branchId;
    });
  }, [users, branchId]);

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
    const mgr = assignedStaff.find((u) => u.role === 'marketing_director' || u.role === 'admin' || u.role === 'secretary') || assignedStaff[0];
    return mgr ? `${mgr.firstName} ${mgr.lastName}` : 'Unassigned Manager';
  }, [branch, users, assignedStaff]);

  if (branchLoading || usersLoading) {
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
        actions={[{ label: 'All Branches', onClick: () => navigate('/branches'), icon: <ArrowLeftOutlined /> }]}
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
          <Space>
            <TeamOutlined style={{ color: tokens.primary }} />
            <span>Assigned Staff Roster ({assignedStaff.length})</span>
          </Space>
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
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Assign staff to this branch from the Admin User Management page.
                </Text>
              </div>
            }
          />
        )}
      </Card>

      <Row gutter={16}>
        <Col xs={24} lg={12}>
          <Card title={<span><DollarOutlined style={{ marginRight: 8 }} />Branch Expenses</span>} style={{ marginBottom: 24 }}>
            {expenses.length > 0 ? (
              <List
                dataSource={expenses}
                renderItem={(e) => (
                  <List.Item extra={<Text strong>GHS {(e.amountMinor / 100).toLocaleString()}</Text>}>
                    <List.Item.Meta
                      title={e.category}
                      description={`${e.code || 'EXP'} · Incurred ${e.incurredOn}`}
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
    </div>
  );
};
