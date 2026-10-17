// src/pages/dashboard/admin/components/StatsCards.tsx
import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Typography, Tag, Tooltip, Skeleton } from 'antd';
import { 
  UserOutlined, 
  TeamOutlined, 
  DollarOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  MinusOutlined,
  InfoCircleOutlined,
  UserAddOutlined,
  RightOutlined,
  RiseOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { tokens } from '@/constants/tokens';
import { formatRevenueGHS } from '@/utils/monthlyCustomerRevenue';

const { Text } = Typography;

interface StatsCardsProps {
  stats: {
    totalUsers: number;
    activeUsers: number;
    totalProspects: number;
    marketingProspects?: number;
    csProspects?: number;
    totalCustomers: number;
    totalPaymentPlans?: number;
    activePaymentPlans?: number;
    monthlyRevenue?: number;
    growthRate: number;
    pendingNotifications?: number;
  };
  loading?: boolean;
  onOpenMonthlyRevenue?: () => void;
}

export const StatsCards: React.FC<StatsCardsProps> = ({ stats, loading, onOpenMonthlyRevenue }) => {
  const navigate = useNavigate();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

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

  // 5 Core Balanced Stats Cards (Featuring Monthly Revenue with interactive drawer)
  const statsCards = [
    {
      key: 'users',
      title: 'Total Users',
      value: stats.totalUsers || 0,
      icon: <UserOutlined />,
      color: tokens.primary,
      bg: '#e6f7ff',
      subtext: `${stats.activeUsers || 0} active in system`,
      growth: stats.growthRate || 0,
      description: 'Total registered system users across all roles and branches',
      delay: 0,
      link: '/admin/users',
      linkText: 'View Users',
    },
    {
      key: 'prospects',
      title: 'Total Prospects',
      value: stats.totalProspects ?? ((stats.marketingProspects ?? 0) + (stats.csProspects ?? 0)),
      icon: <TeamOutlined />,
      color: '#fa8c16',
      bg: '#fff7e6',
      subtext: `${stats.marketingProspects ?? 0} Marketing • ${stats.csProspects ?? 0} CS`,
      growth: 0,
      description: 'Total lead volume across Marketing and Customer Service pipelines',
      delay: 75,
      link: undefined,
      linkText: undefined,
    },
    {
      key: 'customers',
      title: 'Total Customers',
      value: stats.totalCustomers || 0,
      icon: <UserAddOutlined />,
      color: '#52c41a',
      bg: '#f6ffed',
      subtext: 'Converted property buyers',
      growth: 0,
      description: 'Converted customers with registered buyer profiles and deeds',
      delay: 150,
      link: '/customers',
      linkText: 'View Customers',
    },
    {
      key: 'payment-plans',
      title: 'Active Payment Plans',
      value: stats.activePaymentPlans || 0,
      icon: <DollarOutlined />,
      color: '#722ed1',
      bg: '#f9f0ff',
      subtext: `${stats.totalPaymentPlans || stats.activePaymentPlans || 0} total plans logged`,
      growth: 0,
      description: 'Active installment and milestone payment contracts',
      delay: 225,
      link: '/payment-plans',
      linkText: 'View Plans',
    },
    {
      key: 'monthly-revenue',
      title: 'Monthly Revenue',
      value: stats.monthlyRevenue || 0,
      isCurrency: true,
      icon: <RiseOutlined />,
      color: '#059669',
      bg: '#ecfdf5',
      subtext: 'New buyer revenue & deposits',
      growth: stats.growthRate || 0,
      description: 'Tracks total new customer revenue, initial deposits & installments with monthly folding accordions',
      delay: 300,
      onClick: onOpenMonthlyRevenue,
      linkText: 'Track Revenue',
    },
  ];

  if (loading) {
    return (
      <Row gutter={[16, 16]}>
        {[1, 2, 3, 4, 5].map((i) => (
          <Col xs={24} sm={12} md={12} lg={8} xl={4} style={{ flex: '1 1 200px' }} key={i}>
            <Card style={{ borderRadius: 12, border: '1px solid #f0f0f0' }}>
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
        <Col xs={24} sm={12} md={12} lg={8} xl={4} style={{ flex: '1 1 200px' }} key={stat.key}>
          <Card
            onClick={() => {
              if (stat.onClick) {
                stat.onClick();
              } else if (stat.link) {
                navigate(stat.link);
              }
            }}
            style={{
              height: '100%',
              borderRadius: 14,
              border: '1px solid #eef2f6',
              borderTop: `3px solid ${stat.color}`,
              background: 'linear-gradient(180deg, #ffffff 0%, #fafbfc 100%)',
              cursor: stat.onClick || stat.link ? 'pointer' : 'default',
              transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
              opacity: visible ? 1 : 0,
              transform: visible ? 'translateY(0)' : 'translateY(16px)',
              transitionDelay: `${stat.delay}ms`,
              boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
            }}
            bodyStyle={{ padding: '18px 20px' }}
            onMouseEnter={(e) => {
              if (stat.onClick || stat.link) {
                e.currentTarget.style.boxShadow = '0 10px 24px rgba(0,0,0,0.08)';
                e.currentTarget.style.transform = 'translateY(-3px)';
                e.currentTarget.style.borderColor = stat.color;
              }
            }}
            onMouseLeave={(e) => {
              if (stat.onClick || stat.link) {
                e.currentTarget.style.boxShadow = '0 2px 6px rgba(0,0,0,0.02)';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.borderColor = '#eef2f6';
              }
            }}
          >
            {/* Header: Title + Icon Badge */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Text strong style={{ fontSize: 13, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                    {stat.title}
                  </Text>
                  <Tooltip title={stat.description}>
                    <InfoCircleOutlined style={{ fontSize: 12, color: '#94a3b8', cursor: 'help' }} />
                  </Tooltip>
                </div>

                <div
                  style={{ 
                    fontSize: stat.isCurrency ? 24 : 30, 
                    fontWeight: 800, 
                    marginTop: 8,
                    color: stat.color === '#059669' ? '#059669' : '#0f172a',
                    lineHeight: 1.15,
                    letterSpacing: '-0.5px',
                    fontVariantNumeric: 'tabular-nums',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {stat.isCurrency
                    ? formatRevenueGHS(stat.value >= 100000 ? stat.value : stat.value * 100, false)
                    : stat.value.toLocaleString()}
                </div>
              </div>

              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 14,
                  background: stat.bg,
                  color: stat.color,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 22,
                  flexShrink: 0,
                  boxShadow: `0 2px 8px ${stat.color}25`,
                }}
              >
                {stat.icon}
              </div>
            </div>

            {/* Footer Metadata & Indicator */}
            <div
              style={{
                marginTop: 14,
                paddingTop: 10,
                borderTop: '1px solid #f1f5f9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 6,
              }}
            >
              <Text type="secondary" style={{ fontSize: 12, color: '#64748b', fontWeight: 500 }}>
                {stat.subtext}
              </Text>

              {stat.onClick || stat.link ? (
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: stat.color,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 3,
                  }}
                >
                  {stat.linkText || 'View'} <RightOutlined style={{ fontSize: 10 }} />
                </span>
              ) : (
                <Tag
                  style={{
                    borderRadius: 6,
                    fontSize: 10,
                    fontWeight: 600,
                    color: '#64748b',
                    margin: 0,
                    border: 'none',
                    background: '#f1f5f9',
                  }}
                >
                  Overview
                </Tag>
              )}
            </div>
          </Card>
        </Col>
      ))}
    </Row>
  );
};