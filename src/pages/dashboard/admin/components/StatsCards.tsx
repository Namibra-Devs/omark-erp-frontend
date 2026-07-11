// src/pages/dashboard/admin/components/StatsCards.tsx
import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Typography, Tag, Tooltip, Skeleton } from 'antd';
import { 
  RiseOutlined, 
  UserOutlined, 
  TeamOutlined, 
  DollarOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  MinusOutlined,
  InfoCircleOutlined,
  UserAddOutlined,
} from '@ant-design/icons';
import { tokens } from '@/constants/tokens';

const { Text } = Typography;

interface StatsCardsProps {
  stats: {
    totalUsers: number;
    activeUsers: number;
    totalProspects: number;
    totalCustomers: number;
    monthlyRevenue: number;
    growthRate: number;
    pendingNotifications?: number;
    activePaymentPlans?: number;
  };
  loading?: boolean;
}

export const StatsCards: React.FC<StatsCardsProps> = ({ stats, loading }) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const formatCurrency = (amount: number) => {
    if (amount === 0) return 'GHS 0';
    return `GHS ${(amount / 100).toLocaleString()}`;
  };

  const getGrowthColor = (growth: number) => {
    if (growth > 0) return '#52c41a';
    if (growth < 0) return '#ff4d4f';
    return '#faad14';
  };

  const getGrowthIcon = (growth: number) => {
    if (growth > 0) return <ArrowUpOutlined />;
    if (growth < 0) return <ArrowDownOutlined />;
    return <MinusOutlined />;
  };

  const getGrowthLabel = (growth: number) => {
    if (growth > 0) return `+${growth}%`;
    if (growth < 0) return `${growth}%`;
    return '0%';
  };

  const statsCards = [
    {
      key: 'users',
      title: 'Total Users',
      value: stats.totalUsers || 0,
      icon: <UserOutlined />,
      color: tokens.primary,
      bg: `${tokens.primary}15`,
      subtext: `${stats.activeUsers || 0} active`,
      growth: stats.growthRate || 0,
      description: 'Total registered users in the system',
      delay: 0,
    },
    {
      key: 'prospects',
      title: 'Total Prospects',
      value: stats.totalProspects || 0,
      icon: <TeamOutlined />,
      color: '#1890ff',
      bg: '#1890ff15',
      subtext: 'Marketing leads',
      growth: 0,
      description: 'Active prospects in the pipeline',
      delay: 100,
    },
    {
      key: 'customers',
      title: 'Total Customers',
      value: stats.totalCustomers || 0,
      icon: <UserAddOutlined />,
      color: '#52c41a',
      bg: '#52c41a15',
      subtext: 'Converted customers',
      growth: 0,
      description: 'Customers with active accounts',
      delay: 200,
    },
    {
      key: 'revenue',
      title: 'Monthly Revenue',
      value: formatCurrency(stats.monthlyRevenue || 0),
      icon: <DollarOutlined />,
      color: '#722ed1',
      bg: '#722ed115',
      subtext: 'Current month',
      growth: 0,
      description: 'Total revenue this month',
      delay: 300,
    },
  ];

  if (loading) {
    return (
      <Row gutter={[16, 16]}>
        {[1, 2, 3, 4].map(i => (
          <Col xs={24} sm={12} lg={6} key={i}>
            <Card>
              <Skeleton active paragraph={{ rows: 2 }} />
            </Card>
          </Col>
        ))}
      </Row>
    );
  }

  return (
    <Row gutter={[16, 16]}>
      {statsCards.map((stat) => (
        <Col xs={24} sm={12} lg={6} key={stat.key}>
          <Card
            style={{
              height: '100%',
              borderRadius: 12,
              border: '1px solid #f0f0f0',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              opacity: visible ? 1 : 0,
              transform: visible ? 'translateY(0)' : 'translateY(20px)',
              transitionDelay: `${stat.delay}ms`,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.08)';
              e.currentTarget.style.transform = 'translateY(-4px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = 'none';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Text type="secondary" style={{ fontSize: 14, fontWeight: 500 }}>
                    {stat.title}
                  </Text>
                  <Tooltip title={stat.description}>
                    <InfoCircleOutlined style={{ fontSize: 12, color: '#bbb' }} />
                  </Tooltip>
                </div>
                <div style={{ 
                  fontSize: 28, 
                  fontWeight: 'bold', 
                  marginTop: 8,
                  color: '#1a1a2e',
                  lineHeight: 1.2,
                }}>
                  {stat.value}
                </div>
                <div style={{ marginTop: 4 }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {stat.subtext}
                  </Text>
                </div>
              </div>
              <div style={{
                width: 48,
                height: 48,
                borderRadius: 12,
                background: stat.bg,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 24,
                color: stat.color,
                flexShrink: 0,
              }}>
                {stat.icon}
              </div>
            </div>
            
            <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid #f0f0f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <Tag 
                  color={getGrowthColor(stat.growth)} 
                  style={{ 
                    fontSize: 12, 
                    fontWeight: 600,
                    margin: 0,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  {getGrowthIcon(stat.growth)}
                  {getGrowthLabel(stat.growth)}
                </Tag>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  vs last month
                </Text>
              </div>
            </div>
          </Card>
        </Col>
      ))}
    </Row>
  );
};