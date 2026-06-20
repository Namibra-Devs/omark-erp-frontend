// src/pages/dashboard/SecretaryDashboardPage.tsx
import React from 'react';
import { Card, Row, Col, Typography, Statistic, Table, Tag, Progress, Empty } from 'antd';
import { 
  UserOutlined, 
  DollarOutlined, 
  FileTextOutlined, 
  TeamOutlined,
  WarningOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined
} from '@ant-design/icons';
import { useAuth } from '@/contexts/AuthContext';
import { roleLabels, progressBandLabels } from '@/constants/enums';
import { tokens } from '@/constants/tokens';
import { MoneyText } from '@/components/shared/MoneyText';
import { useNavigate } from 'react-router-dom';

const { Title, Text } = Typography;

// Mock data for demonstration
const mockDashboardData = {
  byBand: {
    red: 12,
    yellow: 7,
    light_green: 4,
    green: 9,
  },
  defaulters: [
    { customerId: '1', name: 'John Doe', overdueAmountMinor: 1000000, daysOverdue: 8 },
    { customerId: '2', name: 'Jane Smith', overdueAmountMinor: 500000, daysOverdue: 5 },
    { customerId: '3', name: 'Mike Johnson', overdueAmountMinor: 250000, daysOverdue: 3 },
  ],
  dueSoon: [
    { customerId: '4', name: 'Sarah Williams', dueDate: '2024-01-20', amountMinor: 1000000 },
    { customerId: '5', name: 'Robert Brown', dueDate: '2024-01-22', amountMinor: 750000 },
    { customerId: '6', name: 'Emily Davis', dueDate: '2024-01-25', amountMinor: 500000 },
  ],
  totalCustomers: 156,
  activePlans: 89,
  totalDeeds: 67,
  monthlyRevenue: 12500000, // GHS 125,000.00
};

export const SecretaryDashboardPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const bandConfig = [
    { band: 'red' as const, label: progressBandLabels.red, color: tokens.band.red, icon: <WarningOutlined /> },
    { band: 'yellow' as const, label: progressBandLabels.yellow, color: tokens.band.yellow, icon: <ClockCircleOutlined /> },
    { band: 'light_green' as const, label: progressBandLabels.light_green, color: tokens.band.light_green, icon: <CheckCircleOutlined /> },
    { band: 'green' as const, label: progressBandLabels.green, color: tokens.band.green, icon: <CheckCircleOutlined /> },
  ];

  const defaulterColumns = [
    { 
      title: 'Customer Name', 
      dataIndex: 'name', 
      key: 'name',
      render: (name: string, record: any) => (
        <a onClick={() => navigate(`/customers/${record.customerId}`)}>
          {name}
        </a>
      )
    },
    {
      title: 'Overdue Amount',
      dataIndex: 'overdueAmountMinor',
      key: 'overdueAmountMinor',
      render: (value: number) => <MoneyText minor={value} />,
    },
    { 
      title: 'Days Overdue', 
      dataIndex: 'daysOverdue', 
      key: 'daysOverdue',
      render: (days: number) => (
        <Tag color={days > 7 ? 'red' : days > 3 ? 'orange' : 'yellow'}>
          {days} days
        </Tag>
      )
    },
  ];

  const dueSoonColumns = [
    { 
      title: 'Customer Name', 
      dataIndex: 'name', 
      key: 'name',
      render: (name: string, record: any) => (
        <a onClick={() => navigate(`/customers/${record.customerId}`)}>
          {name}
        </a>
      )
    },
    {
      title: 'Amount Due',
      dataIndex: 'amountMinor',
      key: 'amountMinor',
      render: (value: number) => <MoneyText minor={value} />,
    },
    { 
      title: 'Due Date', 
      dataIndex: 'dueDate', 
      key: 'dueDate',
      render: (date: string) => {
        const daysUntil = Math.ceil((new Date(date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
        return (
          <Tag color={daysUntil <= 2 ? 'red' : daysUntil <= 5 ? 'orange' : 'blue'}>
            {daysUntil <= 0 ? 'Overdue' : `${daysUntil} days`}
          </Tag>
        );
      }
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <Title level={2}>Secretary Dashboard</Title>
        <Text type="secondary">Welcome back, {user?.firstName}! Here's your overview</Text>
      </div>

      {/* Stats Cards */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="Total Customers"
              value={mockDashboardData.totalCustomers}
              prefix={<TeamOutlined />}
              valueStyle={{ color: tokens.primary }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Active Payment Plans"
              value={mockDashboardData.activePlans}
              prefix={<DollarOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Total Deeds"
              value={mockDashboardData.totalDeeds}
              prefix={<FileTextOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Monthly Revenue"
              value={mockDashboardData.monthlyRevenue / 100}
              prefix="GHS"
              precision={2}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Progress Band Summary Cards */}
      <Title level={4} style={{ marginBottom: 16 }}>Payment Plan Progress</Title>
      <Row gutter={16} style={{ marginBottom: 24 }}>
        {bandConfig.map((band) => (
          <Col span={6} key={band.band}>
            <Card 
              style={{ 
                borderTop: `4px solid ${band.color}`,
                cursor: 'pointer'
              }}
              onClick={() => navigate(`/payment-plans?band=${band.band}`)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {band.icon}
                <Text type="secondary">{band.label}</Text>
              </div>
              <div style={{ fontSize: 32, fontWeight: 'bold', marginTop: 8, color: band.color }}>
                {mockDashboardData.byBand[band.band]}
              </div>
              <Progress 
                percent={Math.round((mockDashboardData.byBand[band.band] / mockDashboardData.activePlans) * 100)} 
                strokeColor={band.color}
                size="small"
              />
            </Card>
          </Col>
        ))}
      </Row>

      {/* Two side-by-side tables */}
      <Row gutter={16}>
        <Col span={12}>
          <Card 
            title={
              <span>
                <WarningOutlined style={{ color: '#ff4d4f', marginRight: 8 }} />
                Defaulters
              </span>
            }
          >
            {mockDashboardData.defaulters.length > 0 ? (
              <Table
                columns={defaulterColumns}
                dataSource={mockDashboardData.defaulters}
                rowKey="customerId"
                pagination={false}
                size="small"
              />
            ) : (
              <Empty
                description={
                  <span style={{ color: '#52c41a' }}>
                    <CheckCircleOutlined /> No defaulters — all payments on track
                  </span>
                }
              />
            )}
          </Card>
        </Col>
        
        <Col span={12}>
          <Card 
            title={
              <span>
                <ClockCircleOutlined style={{ color: '#faad14', marginRight: 8 }} />
                Due Soon
              </span>
            }
          >
            {mockDashboardData.dueSoon.length > 0 ? (
              <Table
                columns={dueSoonColumns}
                dataSource={mockDashboardData.dueSoon}
                rowKey="customerId"
                pagination={false}
                size="small"
              />
            ) : (
              <Empty description="No payments due soon" />
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
};