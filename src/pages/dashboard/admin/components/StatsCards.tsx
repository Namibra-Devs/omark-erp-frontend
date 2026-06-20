// src/pages/dashboard/admin/components/StatsCards.tsx
import React, { useEffect } from 'react';
import { Card, Row, Col, Typography, Tag } from 'antd';
import { RiseOutlined, UserOutlined, TeamOutlined, DollarOutlined } from '@ant-design/icons';
import AOS from 'aos';
import 'aos/dist/aos.css';
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
  };
  loading?: boolean;
}

export const StatsCards: React.FC<StatsCardsProps> = ({ stats, loading }) => {
  useEffect(() => {
    AOS.init({
      duration: 600,
      easing: 'ease-in-out',
      once: false,
      mirror: true,
    });
    // Refresh AOS to detect new elements
    AOS.refresh();
  }, []);

  const statsCards = [
    {
      title: 'Total Users',
      value: stats.totalUsers,
      icon: <UserOutlined />,
      color: tokens.primary,
      subtext: `${stats.activeUsers} active`,
      growth: '+12%',
      delay: 0,
    },
    {
      title: 'Total Prospects',
      value: stats.totalProspects,
      icon: <TeamOutlined />,
      color: '#1890ff',
      subtext: 'This month',
      growth: '+8.5%',
      delay: 100,
    },
    {
      title: 'Total Customers',
      value: stats.totalCustomers,
      icon: <TeamOutlined />,
      color: '#52c41a',
      subtext: 'Active accounts',
      growth: '+15.3%',
      delay: 200,
    },
    {
      title: 'Monthly Revenue',
      value: `GHS ${(stats.monthlyRevenue / 100).toLocaleString()}`,
      icon: <DollarOutlined />,
      color: '#722ed1',
      subtext: 'This month',
      growth: '+23.7%',
      delay: 300,
    },
  ];

  return (
    <Row gutter={[16, 16]}>
      {statsCards.map((stat, index) => (
        <Col xs={24} sm={12} lg={6} key={index}>
          <div 
            data-aos="fade-up" 
            data-aos-delay={stat.delay}
            data-aos-duration="600"
            data-aos-easing="ease-in-out"
          >
            <Card loading={loading} style={{ height: '100%', transition: 'all 0.3s' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <Text type="secondary" style={{ fontSize: 14 }}>{stat.title}</Text>
                  <div style={{ fontSize: 28, fontWeight: 'bold', marginTop: 8 }}>
                    {stat.value}
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>{stat.subtext}</Text>
                  </div>
                </div>
                <div style={{
                  width: 48,
                  height: 48,
                  borderRadius: 12,
                  background: `${stat.color}15`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 24,
                  color: stat.color,
                }}>
                  {stat.icon}
                </div>
              </div>
              <div style={{ marginTop: 12 }}>
                <Tag color="green" style={{ fontSize: 12 }}>
                  <RiseOutlined /> {stat.growth}
                </Tag>
                <Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>
                  vs last month
                </Text>
              </div>
            </Card>
          </div>
        </Col>
      ))}
    </Row>
  );
};