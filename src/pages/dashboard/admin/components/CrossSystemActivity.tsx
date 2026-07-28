// src/pages/dashboard/admin/components/CrossSystemActivity.tsx
// Summary cards for everything happening in the prototype features that
// have no backend yet (Accounts & Finance expenses/payroll, complaints,
// branch approvals) — see src/pages/dashboard/admin/hooks/useMockActivityFeed.ts.
// Kept visually separate from StatsCards (real API data) and clearly
// tagged Preview so it's never mistaken for live backend numbers.
import React from 'react';
import { Card, Col, Row, Statistic, Tag, Typography } from 'antd';
import { ExperimentOutlined, IdcardOutlined, MessageOutlined, AuditOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import type { MockActivityStats } from '../hooks/useMockActivityFeed';

const { Title } = Typography;

interface CrossSystemActivityProps {
  stats: MockActivityStats;
  /** Name of the branch this data is scoped to, if the viewer is assigned to one. */
  branchName?: string;
}

export const CrossSystemActivity: React.FC<CrossSystemActivityProps> = ({ stats, branchName }) => {
  const navigate = useNavigate();

  return (
    <div style={{ marginBottom: 24 }}>
      <Title level={5} style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
        Accounts, Finance & Branch Activity
        <Tag color="gold" style={{ fontWeight: 'normal' }}>Preview — local prototype data</Tag>
        {branchName && <Tag color="blue" style={{ fontWeight: 'normal' }}>Scoped to {branchName}</Tag>}
      </Title>
      <Row gutter={16}>
        <Col xs={24} sm={12} lg={6}>
          <Card hoverable onClick={() => navigate('/accounts/dashboard')}>
            <Statistic
              title={<span><ExperimentOutlined /> Total Expenses</span>}
              value={stats.totalExpensesMinor / 100}
              prefix="GHS"
              precision={2}
              valueStyle={{ color: '#ff4d4f', fontSize: 20 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card hoverable onClick={() => navigate('/accounts/payroll')}>
            <Statistic
              title={<span><IdcardOutlined /> Bonuses Paid</span>}
              value={stats.totalBonusesMinor / 100}
              prefix="GHS"
              precision={2}
              valueStyle={{ color: '#52c41a', fontSize: 20 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card hoverable onClick={() => navigate('/admin/complaints')}>
            <Statistic
              title={<span><MessageOutlined /> Open Complaints</span>}
              value={stats.openComplaintsCount}
              valueStyle={{ color: stats.openComplaintsCount > 0 ? '#faad14' : '#52c41a', fontSize: 20 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card hoverable onClick={() => navigate('/head-office/approvals')}>
            <Statistic
              title={<span><AuditOutlined /> Pending Approvals</span>}
              value={stats.pendingApprovalsCount}
              valueStyle={{ color: stats.pendingApprovalsCount > 0 ? '#faad14' : '#52c41a', fontSize: 20 }}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};
