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
import { useUsersQuery, getUserPhone } from '@/api/users';
import { getStaffAssignment } from '@/mock/staffAssignments';
import { PhotoUpload } from '@/components/shared/PhotoUpload';

const { Text } = Typography;

export const HeadOfficeDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { branches, isLoading: branchesLoading } = useBranchContext();
  const { data: usersData, isLoading: usersLoading } = useUsersQuery();
  const { data: expensesData } = useExpensesQuery();
  const { data: approvals = [] } = useApprovalsQuery();

  const users = useMemo(() => {
    return (usersData?.items ?? []).map((u) => ({
      ...u,
      phoneNumber: getUserPhone(u),
    }));
  }, [usersData]);

  const expenses = expensesData?.items ?? [];
  const pendingApprovalsCount = approvals.filter((a: any) => a.status === 'pending').length;

  const totalExpenseMinor = useMemo(
    () => expenses.reduce((sum, e) => sum + (e.amountMinor || 0), 0),
    [expenses]
  );

  // Helper to get assigned staff for a branch
  const getBranchStaff = (branchId: string) => {
    return users.filter((u) => {
      const assignment = getStaffAssignment(u.id);
      const bId = assignment?.branchId || (u as any).branchId || (u as any).branch;
      return bId === branchId;
    });
  };

  // Helper to get branch manager
  const getBranchManagerName = (branch: any) => {
    if (branch.managerInfo) {
      return `${branch.managerInfo.firstName} ${branch.managerInfo.lastName}`;
    }
    if (branch.managerUserId) {
      const mgr = users.find((u) => u.id === branch.managerUserId);
      if (mgr) return `${mgr.firstName} ${mgr.lastName}`;
    }
    const staff = getBranchStaff(branch.id);
    const mgr = staff.find((u) => u.role === 'branch_manager') ||
                staff.find((u) => u.role === 'marketing_director' || u.role === 'admin' || u.role === 'secretary') ||
                staff[0];
    return mgr ? `${mgr.firstName} ${mgr.lastName}` : 'Unassigned Manager';
  };

  const totalSystemStaffCount = useMemo(() => {
    return users.length;
  }, [users]);

  const columns = [
    { title: 'Code', dataIndex: 'branchCode', key: 'branchCode', width: 90, render: (v: string) => <Tag color="blue">{v}</Tag> },
    {
      title: 'Branch Name',
      key: 'name',
      width: 220,
      render: (_: any, record: any) => (
        <div>
          <Text strong style={{ fontSize: 14 }}>{record.name}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 12 }}>
            <EnvironmentOutlined /> {record.location}
          </Text>
        </div>
      ),
    },
    {
      title: 'Branch Manager',
      key: 'manager',
      width: 180,
      render: (_: any, r: any) => {
        const mgrName = getBranchManagerName(r);
        const isAssigned = mgrName !== 'Unassigned Manager';
        return (
          <Tag color={isAssigned ? 'purple' : 'default'} style={{ fontWeight: 500, borderRadius: 12, padding: '2px 10px' }}>
            {mgrName}
          </Tag>
        );
      },
    },
    {
      title: 'Staff Assigned',
      key: 'staffCount',
      width: 130,
      align: 'center' as const,
      render: (_: any, r: any) => {
        const count = getBranchStaff(r.id).length;
        return <Tag color={count > 0 ? 'green' : 'gold'} style={{ fontWeight: 600 }}>{count} Staff</Tag>;
      },
    },
    {
      title: 'Action',
      key: 'action',
      width: 150,
      align: 'center' as const,
      render: (_: any, record: any) => (
        <Button type="primary" size="small" style={{ borderRadius: 6, backgroundColor: tokens.primary }} onClick={() => navigate(`/branches/${record.id}`)}>
          View Branch
        </Button>
      ),
    },
  ];

  if (branchesLoading || usersLoading) {
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
          <Card><Statistic title="Total System Staff" value={totalSystemStaffCount} valueStyle={{ color: '#1890ff' }} /></Card>
        </Col>
      </Row>

      <Card title="Branch Network Overview">
        <Table columns={columns} dataSource={branches} rowKey="id" pagination={false} size="middle" scroll={{ x: 800 }} />
      </Card>
    </div>
  );
};
