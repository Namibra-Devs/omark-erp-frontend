// src/pages/branches/HeadOfficeDashboard.tsx
// ⚠️ PROTOTYPE — see src/mock/branches.ts. Every widget here reads static
// sample data. Nothing on this page is live.
import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Row, Col, Card, Statistic, Table, Tag, Progress, Space, Typography, List, Avatar, Button, Empty, message,
} from 'antd';
import {
  BankOutlined, RiseOutlined, FallOutlined,
  ClockCircleOutlined, FileTextOutlined, InboxOutlined, TrophyOutlined,
  WarningOutlined, UserOutlined, EyeOutlined, DollarOutlined, AuditOutlined, IdcardOutlined,
} from '@ant-design/icons';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { PageHeader } from '@/components/shared/PageHeader';
import { MockDataBanner } from '@/components/shared/MockDataBanner';
import { tokens } from '@/constants/tokens';
import { useBranchContext } from '@/contexts/BranchContext';
import {
  getAllBranchProjects,
  getAllBranchUsers,
  getBranchDocuments,
  getBranchMetrics,
  getUnderperformingBranches,
  mockBranchDepartments,
  mockPropertyTypes,
  mockTopStaff,
} from '@/mock/branches';
import { documentRequiresHQApproval } from '@/mock/governance';
import { setApprovalOverride, useApprovalOverrides } from '@/mock/approvalStore';
import { BranchFilterBar, EMPTY_FILTERS, type BranchFilterValues } from './components/BranchFilterBar';

const { Text } = Typography;

export const HeadOfficeDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { branches: allBranches } = useBranchContext();
  const [filters, setFilters] = useState<BranchFilterValues>(EMPTY_FILTERS);
  const overrides = useApprovalOverrides();

  const branches = useMemo(
    () => allBranches.filter((b) => !filters.branchId || b.id === filters.branchId),
    [allBranches, filters.branchId]
  );

  const users = useMemo(() => getAllBranchUsers(), []);
  const projects = useMemo(() => getAllBranchProjects(), []);

  const metricsByBranch = branches.map((b) => ({ branch: b, metrics: getBranchMetrics(b.id) }));

  const totalRevenueMinor = metricsByBranch.reduce((sum, x) => sum + x.metrics.revenueMinor, 0);
  const totalSales = metricsByBranch.reduce((sum, x) => sum + x.metrics.salesThisMonth, 0);
  const totalExpensesMinor = metricsByBranch.reduce((sum, x) => sum + x.metrics.expensesMinor, 0);
  const avgAttendance = metricsByBranch.length > 0
    ? metricsByBranch.reduce((sum, x) => sum + x.metrics.attendanceRatePercent, 0) / metricsByBranch.length
    : 0;

  const comparisonData = metricsByBranch.map(({ branch, metrics }) => ({
    name: branch.name.replace(' Branch', '').replace(' Head Office', ' HQ'),
    salesGHS: metrics.revenueMinor / 100,
    expensesGHS: metrics.expensesMinor / 100,
  }));

  const underperforming = getUnderperformingBranches().filter((b) => branches.some((x) => x.id === b.id));

  const topStaff = mockTopStaff.filter((s) => branches.some((b) => b.id === s.branchId));

  const documentsColumns = [
    { title: 'Branch', dataIndex: 'name', key: 'name' },
    {
      title: 'Pending Approval',
      key: 'pending',
      render: (_: any, record: { id: string }) => {
        const count = getBranchDocuments(record.id).filter((d) => d.status === 'pending' && !overrides[d.id]).length;
        return <Tag color={count > 5 ? 'red' : count > 0 ? 'gold' : 'green'}>{count}</Tag>;
      },
    },
    {
      title: 'Action',
      key: 'action',
      render: (_: any, record: { id: string }) => (
        <Button type="link" size="small" onClick={() => navigate(`/branches/${record.id}`)}>Review</Button>
      ),
    },
  ];

  const stockColumns = [
    { title: 'Branch', dataIndex: 'name', key: 'name' },
    {
      title: 'Stock In',
      key: 'in',
      render: (_: any, record: { id: string }) => <Tag color="blue">{getBranchMetrics(record.id).stockMovement.in}</Tag>,
    },
    {
      title: 'Stock Out',
      key: 'out',
      render: (_: any, record: { id: string }) => <Tag color="orange">{getBranchMetrics(record.id).stockMovement.out}</Tag>,
    },
    {
      title: 'Net',
      key: 'net',
      render: (_: any, record: { id: string }) => {
        const m = getBranchMetrics(record.id);
        const net = m.stockMovement.in - m.stockMovement.out;
        return <Text strong style={{ color: net >= 0 ? '#52c41a' : '#ff4d4f' }}>{net >= 0 ? `+${net}` : net}</Text>;
      },
    },
  ];

  return (
    <div>
      <PageHeader
        title="Head Office Dashboard"
        actions={[
          { label: 'Master Pricing', onClick: () => navigate('/head-office/pricing'), icon: <DollarOutlined />, type: 'default' },
          { label: 'Approvals', onClick: () => navigate('/head-office/approvals'), icon: <AuditOutlined />, type: 'default' },
          { label: 'Payroll', onClick: () => navigate('/head-office/payroll'), icon: <IdcardOutlined />, type: 'default' },
          { label: 'Manage Branches', onClick: () => navigate('/branches'), icon: <BankOutlined /> },
        ]}
      />
      <MockDataBanner />

      <BranchFilterBar
        value={filters}
        onChange={setFilters}
        branches={allBranches}
        departments={mockBranchDepartments}
        users={users}
        projects={projects}
        propertyTypes={mockPropertyTypes}
      />

      {/* Summary */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card><Statistic title="Branches" value={branches.length} prefix={<BankOutlined />} valueStyle={{ color: tokens.primary }} /></Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card><Statistic title="Total Revenue (sample)" value={totalRevenueMinor / 100} prefix="GHS" precision={2} valueStyle={{ color: '#52c41a' }} /></Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card><Statistic title="Total Sales (sample)" value={totalSales} prefix={<RiseOutlined />} valueStyle={{ color: '#722ed1' }} /></Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card><Statistic title="Avg. Attendance (sample)" value={avgAttendance} suffix="%" precision={1} prefix={<ClockCircleOutlined />} valueStyle={{ color: '#1890ff' }} /></Card>
        </Col>
      </Row>

      {/* Branch sales/revenue comparison */}
      <Card title="Branch Revenue vs Expenses (sample)" style={{ marginBottom: 24 }}>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={comparisonData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <RechartsTooltip formatter={(value: any) => `GHS ${Number(value).toLocaleString()}`} />
            <Legend />
            <Bar dataKey="salesGHS" fill={tokens.primary} name="Revenue (GHS)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="expensesGHS" fill="#faad14" name="Expenses (GHS)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* Attendance & Project Progress */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={24} lg={12}>
          <Card title="Branch Attendance (sample)">
            {metricsByBranch.map(({ branch, metrics }) => (
              <div key={branch.id} style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Text>{branch.name}</Text>
                  <Text strong>{metrics.attendanceRatePercent}%</Text>
                </div>
                <Progress
                  percent={metrics.attendanceRatePercent}
                  size="small"
                  strokeColor={metrics.attendanceRatePercent > 90 ? '#52c41a' : metrics.attendanceRatePercent > 80 ? '#faad14' : '#ff4d4f'}
                  showInfo={false}
                />
              </div>
            ))}
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="Branch Project Progress (sample)">
            {metricsByBranch.map(({ branch, metrics }) => (
              <div key={branch.id} style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Text>{branch.name}</Text>
                  <Text strong>{metrics.projectProgressPercent}%</Text>
                </div>
                <Progress percent={metrics.projectProgressPercent} size="small" strokeColor={tokens.primary} showInfo={false} />
              </div>
            ))}
          </Card>
        </Col>
      </Row>

      {/* Documents pending approval & Stock movement */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={24} lg={12}>
          <Card title={<span><FileTextOutlined style={{ marginRight: 8 }} />Documents Pending Approval (sample)</span>}>
            <Table
              columns={documentsColumns}
              dataSource={branches}
              rowKey="id"
              pagination={false}
              size="small"
              expandable={{
                rowExpandable: (record) => getBranchDocuments(record.id).some((d) => d.status === 'pending' && !overrides[d.id]),
                expandedRowRender: (record) => (
                  <List
                    size="small"
                    dataSource={getBranchDocuments(record.id).filter((d) => d.status === 'pending' && !overrides[d.id])}
                    renderItem={(doc) => {
                      const needsHQ = documentRequiresHQApproval(record.id, doc.amountMinor);
                      return (
                        <List.Item
                          extra={
                            needsHQ ? (
                              <Space size={6}>
                                <Tag>{doc.code}</Tag>
                                <Tag color="red">Needs HQ approval</Tag>
                                <Button
                                  size="small"
                                  type="primary"
                                  onClick={() => {
                                    setApprovalOverride(doc.id, 'approved', 'head_office');
                                    message.success(`${doc.title} approved by Head Office (mock — not sent anywhere).`);
                                  }}
                                >
                                  Approve
                                </Button>
                                <Button
                                  size="small"
                                  danger
                                  onClick={() => {
                                    setApprovalOverride(doc.id, 'rejected', 'head_office');
                                    message.success(`${doc.title} rejected by Head Office (mock — not sent anywhere).`);
                                  }}
                                >
                                  Reject
                                </Button>
                              </Space>
                            ) : (
                              <Space size={6}>
                                <Tag>{doc.code}</Tag>
                                <Tag color="blue">Branch manager can approve</Tag>
                              </Space>
                            )
                          }
                        >
                          <List.Item.Meta title={doc.title} description={`Submitted by ${doc.submittedBy}`} />
                        </List.Item>
                      );
                    }}
                  />
                ),
              }}
            />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title={<span><InboxOutlined style={{ marginRight: 8 }} />Stock Movement (sample)</span>}>
            <Table columns={stockColumns} dataSource={branches} rowKey="id" pagination={false} size="small" />
          </Card>
        </Col>
      </Row>

      {/* Top staff & underperforming branches */}
      <Row gutter={16}>
        <Col xs={24} lg={12}>
          <Card title={<span><TrophyOutlined style={{ color: '#faad14', marginRight: 8 }} />Top-Performing Staff (sample)</span>}>
            <List
              dataSource={topStaff}
              renderItem={(staff) => {
                const branch = branches.find((b) => b.id === staff.branchId);
                return (
                  <List.Item>
                    <List.Item.Meta
                      avatar={<Avatar icon={<UserOutlined />} style={{ backgroundColor: tokens.primary }} />}
                      title={staff.name}
                      description={`${staff.role} — ${branch?.name ?? 'Unknown branch'}`}
                    />
                    <Tag color="gold">{staff.metric}</Tag>
                  </List.Item>
                );
              }}
            />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title={<span><WarningOutlined style={{ color: '#ff4d4f', marginRight: 8 }} />Underperforming Branches (sample)</span>}>
            {underperforming.length > 0 ? (
              <List
                dataSource={underperforming}
                renderItem={(branch) => {
                  const m = getBranchMetrics(branch.id);
                  const pct = m.targetRevenueMinor > 0 ? Math.round((m.revenueMinor / m.targetRevenueMinor) * 100) : 0;
                  return (
                    <List.Item
                      actions={[<Button key="view" type="link" size="small" icon={<EyeOutlined />} onClick={() => navigate(`/branches/${branch.id}`)}>View</Button>]}
                    >
                      <List.Item.Meta
                        avatar={<Avatar icon={<FallOutlined />} style={{ backgroundColor: '#ff4d4f' }} />}
                        title={branch.name}
                        description={`${pct}% of revenue target`}
                      />
                    </List.Item>
                  );
                }}
              />
            ) : (
              <Empty description="All branches meeting targets" />
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
};
