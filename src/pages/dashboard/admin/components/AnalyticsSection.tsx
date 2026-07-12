// src/pages/dashboard/admin/components/AnalyticsSection.tsx
import React from 'react';
import { Card, Row, Col, Statistic, Empty, Spin, Alert, Typography, List } from 'antd';
import { RiseOutlined, TrophyOutlined, CreditCardOutlined } from '@ant-design/icons';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { useAnalyticsDashboardQuery } from '@/api/dashboard';
import { tokens } from '@/constants/tokens';

const { Text } = Typography;

/**
 * GET /dashboard/analytics — admin / accounts / marketing_director only.
 * Shows a 12-month revenue trend, conversion rate, top marketers, and a
 * payment-method breakdown. Uses recharts, which is already a project
 * dependency used the same way in src/pages/marketing/DirectorOverviewPage.tsx.
 */
export const AnalyticsSection: React.FC = () => {
  const { data, isLoading, isError, refetch } = useAnalyticsDashboardQuery();

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
        <Spin size="large" tip="Loading analytics..." />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <Alert
        type="error"
        showIcon
        message="Failed to load analytics"
        description="There was a problem loading the analytics data. Please try again."
        action={
          <a onClick={() => refetch()} style={{ cursor: 'pointer' }}>
            Retry
          </a>
        }
        style={{ margin: '24px 0' }}
      />
    );
  }

  // The API docs never published a schema for this endpoint, so every
  // field is treated as possibly absent rather than trusted outright.
  const timeSeries = data.timeSeries ?? [];
  const topMarketers = data.topMarketers ?? [];
  const paymentMethods = data.paymentMethods ?? [];
  const conversionRate = data.conversionRate ?? 0;

  const chartData = timeSeries.map((point) => ({
    month: point.month,
    revenue: (point.revenue ?? 0) / 100,
    newProspects: point.newProspects ?? 0,
    newCustomers: point.newCustomers ?? 0,
  }));

  const topMarketer = topMarketers[0];

  return (
    <div>
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Conversion Rate"
              value={conversionRate}
              suffix="%"
              precision={1}
              prefix={<RiseOutlined />}
              valueStyle={{ color: tokens.primary }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Top Marketer"
              value={topMarketer?.name ?? 'N/A'}
              prefix={<TrophyOutlined />}
              valueStyle={{ color: '#faad14', fontSize: 20 }}
            />
            {topMarketer && (
              <Text type="secondary" style={{ fontSize: 12 }}>
                {topMarketer.dealsClosed} deals closed
              </Text>
            )}
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Payment Methods Tracked"
              value={paymentMethods.length}
              prefix={<CreditCardOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
      </Row>

      <Card title="Revenue Over Time (12 Months)" style={{ marginBottom: 24 }}>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <RechartsTooltip formatter={(value: any) => `GHS ${Number(value).toLocaleString()}`} />
              <Legend />
              <Line
                type="monotone"
                dataKey="revenue"
                stroke={tokens.primary}
                name="Revenue (GHS)"
                strokeWidth={2}
                dot={{ r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Empty description="No revenue data available" />
          </div>
        )}
      </Card>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card title="Top Marketers">
            {topMarketers.length > 0 ? (
              <List
                dataSource={topMarketers}
                renderItem={(m) => (
                  <List.Item key={m.userId}>
                    <Text>{m.name}</Text>
                    <Text type="secondary">
                      {m.dealsClosed} deals · GHS {(m.revenueGenerated / 100).toLocaleString()}
                    </Text>
                  </List.Item>
                )}
              />
            ) : (
              <Empty description="No marketer data" />
            )}
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="Payment Methods">
            {paymentMethods.length > 0 ? (
              <List
                dataSource={paymentMethods}
                renderItem={(pm) => (
                  <List.Item key={pm.method}>
                    <Text style={{ textTransform: 'capitalize' }}>{pm.method.replace('_', ' ')}</Text>
                    <Text type="secondary">
                      {pm.count} · GHS {(pm.totalMinor / 100).toLocaleString()}
                    </Text>
                  </List.Item>
                )}
              />
            ) : (
              <Empty description="No payment method data" />
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
};
