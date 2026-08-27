// src/pages/branches/HeadOfficeDashboard.tsx
import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Row, Col, Card, Statistic, Table, Tag, Typography, Button, Spin,
} from 'antd';
import {
  BankOutlined,
  DollarOutlined, AuditOutlined, IdcardOutlined, EnvironmentOutlined,
} from '@ant-design/icons';
import { PageHeader } from '@/components/shared/PageHeader';
import { tokens } from '@/constants/tokens';
import { useBranchContext } from '@/contexts/BranchContext';
import { useExpensesQuery } from '@/api/expenses';
import { useApprovalsQuery } from '@/api/approvals';

const { Text } = Typography;

export const HeadOfficeDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { branches, isLoading: branchesLoading } = useBranchContext();
  const { data: expensesData } = useExpensesQuery();
  const { data: approvals = [] } = useApprovalsQuery();

  const expenses = expensesData?.items ?? [];
  const pendingApprovalsCount = approvals.filter((a) => a.status === 'pending').length;

  const totalExpenseMinor = useMemo(
    () => expenses.reduce((sum, e) => sum + (e.amountMinor || 0), 0),
    [expenses]
  );

  const columns = [
    { title: 'Code', dataIndex: 'branchCode', key: 'branchCode', render: (v: string) => <Tag color="blue">{v}</Tag> },
    {
      title: 'Branch Name',
      key: 'name',
      render: (_: any, record: any) => (
        <div>
          <Text strong>{record.name}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 12 }}>
            <EnvironmentOutlined /> {record.location}
          </Text>
        </div>
      ),
    },
    { title: 'Manager', key: 'manager', render: (_: any, r: any) => r.managerInfo ? `${r.managerInfo.firstName} ${r.managerInfo.lastName}` : (r.managerUserId || 'N/A') },
    { title: 'Staff Count', dataIndex: 'staffCount', key: 'staffCount', render: (count?: number) => <Tag color="purple">{count ?? 0}</Tag> },
    {
      title: 'Action',
      key: 'action',
      render: (_: any, record: any) => (
        <Button type="link" size="small" onClick={() => navigate(`/branches/${record.id}`)}>
          View Dashboard
        </Button>
      ),
    },
  ];

  if (branchesLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <Spin size="large" tip="Loading Head Office Dashboard..." />
      </div>
    );
  }

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

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card><Statistic title="Active Branches" value={branches.length} prefix={<BankOutlined />} valueStyle={{ color: tokens.primary }} /></Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card><Statistic title="Total Expenses Ledger" value={totalExpenseMinor / 100} prefix="GHS" precision={2} valueStyle={{ color: '#faad14' }} /></Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card><Statistic title="Pending Approvals" value={pendingApprovalsCount} valueStyle={{ color: pendingApprovalsCount > 0 ? '#ff4d4f' : '#52c41a' }} /></Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card><Statistic title="Total Staff Members" value={branches.reduce((sum, b) => sum + (b.staffCount || 0), 0)} valueStyle={{ color: '#1890ff' }} /></Card>
        </Col>
      </Row>

      <Card title="Branch Network Overview">
        <Table columns={columns} dataSource={branches} rowKey="id" pagination={false} size="small" />
      </Card>
    </div>
  );
};
