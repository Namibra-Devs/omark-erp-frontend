// src/pages/branches/BranchDashboard.tsx
import React from 'react';
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
} from 'antd';
import {
  ArrowLeftOutlined,
  DollarOutlined,
  EnvironmentOutlined,
  PhoneOutlined,
  TeamOutlined,
  UserOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import { PageHeader } from '@/components/shared/PageHeader';
import { tokens } from '@/constants/tokens';
import { useBranchQuery } from '@/api/branches';
import { useExpensesQuery } from '@/api/expenses';
import { useComplaintsQuery } from '@/api/complaints';

const { Text } = Typography;

export const BranchDashboard: React.FC = () => {
  const { branchId } = useParams<{ branchId: string }>();
  const navigate = useNavigate();

  const { data: branch, isLoading: branchLoading } = useBranchQuery(branchId);
  const { data: expensesData } = useExpensesQuery({ branchId });
  const { data: complaintsData } = useComplaintsQuery();

  if (branchLoading) {
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

  return (
    <div>
      <PageHeader
        title={branch.name}
        actions={[{ label: 'All Branches', onClick: () => navigate('/branches'), icon: <ArrowLeftOutlined /> }]}
      />

      <Card style={{ marginBottom: 24 }}>
        <Descriptions column={{ xs: 1, sm: 2, md: 5 }}>
          <Descriptions.Item label="Code"><Tag color={tokens.primary}>{branch.branchCode}</Tag></Descriptions.Item>
          <Descriptions.Item label={<span><EnvironmentOutlined /> Location</span>}>{branch.location}</Descriptions.Item>
          <Descriptions.Item label={<span><UserOutlined /> Manager</span>}>
            {branch.managerInfo ? `${branch.managerInfo.firstName} ${branch.managerInfo.lastName}` : (branch.managerUserId || 'N/A')}
          </Descriptions.Item>
          <Descriptions.Item label={<span><PhoneOutlined /> Phone</span>}>
            {branch.phone ? <a href={`tel:${branch.phone}`}>{branch.phone}</a> : 'N/A'}
          </Descriptions.Item>
          <Descriptions.Item label="Staff">{branch.staffCount ?? 0}</Descriptions.Item>
        </Descriptions>
      </Card>

      {/* Quick stats */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={8}>
          <Card><Statistic title="Total Expenses Ledger" value={totalExpenseMinor / 100} prefix="GHS" precision={2} valueStyle={{ color: '#ff4d4f' }} /></Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card><Statistic title="Staff Assigned" value={branch.staffCount ?? 0} prefix={<TeamOutlined />} valueStyle={{ color: tokens.primary }} /></Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card><Statistic title="Open Customer Complaints" value={complaints.filter(c => c.status !== 'resolved').length} valueStyle={{ color: '#faad14' }} /></Card>
        </Col>
      </Row>

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
