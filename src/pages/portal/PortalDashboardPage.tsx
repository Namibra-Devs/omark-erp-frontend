// src/pages/portal/PortalDashboardPage.tsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Col, Progress, Row, Spin, Statistic, Tag, Typography } from 'antd';
import { CalendarOutlined, DollarOutlined, HomeOutlined, MessageOutlined } from '@ant-design/icons';
import { tokens } from '@/constants/tokens';
import { usePortalMeQuery } from '@/api/portal';

const { Title, Text } = Typography;

export const PortalDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { data: portalData, isLoading } = usePortalMeQuery();

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <Spin size="large" tip="Loading customer portal..." />
      </div>
    );
  }

  const customer = portalData?.customer;
  const property = portalData?.property;
  const plan = portalData?.paymentPlan;

  return (
    <div>
      <Title level={3} style={{ fontSize: 'clamp(18px, 4vw, 24px)', marginBottom: 16 }}>
        Welcome back, {customer?.firstName || 'Valued Customer'}
      </Title>

      <Row gutter={[12, 12]} style={{ marginBottom: 20 }}>
        <Col xs={12} sm={12} lg={6}>
          <Card size="small" bodyStyle={{ padding: 12 }}>
            <Statistic
              title="Property"
              value={property?.houseNumber ?? 'Not assigned'}
              prefix={<HomeOutlined />}
              valueStyle={{ fontSize: 16, color: tokens.primary }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={12} lg={6}>
          <Card size="small" bodyStyle={{ padding: 12 }}>
            <Statistic
              title="Balance Due"
              value={plan ? plan.balanceMinor / 100 : 0}
              prefix="GHS"
              precision={2}
              valueStyle={{ fontSize: 16, color: plan && plan.balanceMinor > 0 ? '#ff4d4f' : '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={12} lg={6}>
          <Card size="small" bodyStyle={{ padding: 12 }}>
            <Statistic
              title="Plan Progress"
              value={plan?.progressPercent ?? 0}
              suffix="%"
              prefix={<DollarOutlined />}
              valueStyle={{ fontSize: 16 }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={12} lg={6}>
          <Card size="small" bodyStyle={{ padding: 12 }}>
            <Statistic
              title="Support"
              value="Active"
              prefix={<MessageOutlined />}
              valueStyle={{ fontSize: 16, color: '#52c41a' }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card
            title={<span><HomeOutlined style={{ marginRight: 8 }} />My Property</span>}
            extra={<Button type="link" onClick={() => navigate('/portal/property')}>View details</Button>}
            style={{ marginBottom: 16 }}
          >
            {property ? (
              <>
                <Text strong style={{ fontSize: 16 }}>{property.houseNumber}</Text>
                <br />
                <Text type="secondary">Offer No. {property.offerNumber}</Text>
                <br />
                <Tag color={tokens.primary} style={{ marginTop: 8 }}>
                  GHS {(property.priceMinor / 100).toLocaleString()}
                </Tag>
              </>
            ) : (
              <Text type="secondary">No property on file yet.</Text>
            )}
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card
            title={<span><DollarOutlined style={{ marginRight: 8 }} />Payment Plan</span>}
            extra={<Button type="link" onClick={() => navigate('/portal/payments')}>View payments</Button>}
            style={{ marginBottom: 16 }}
          >
            {plan ? (
              <>
                <Progress percent={plan.progressPercent} strokeColor={tokens.primary} />
                <Row gutter={12} style={{ marginTop: 12 }}>
                  <Col span={12}><Text type="secondary">Monthly</Text><br /><Text strong>GHS {(plan.monthlyAmountMinor / 100).toLocaleString()}</Text></Col>
                  <Col span={12}><Text type="secondary">Total</Text><br /><Text strong>GHS {(plan.totalAmountMinor / 100).toLocaleString()}</Text></Col>
                </Row>
              </>
            ) : (
              <Text type="secondary">No payment plan on file yet.</Text>
            )}
          </Card>
        </Col>
      </Row>

      <Card>
        <Row gutter={[12, 12]} align="middle" justify="space-between">
          <Col xs={24} sm={16}>
            <Text strong><CalendarOutlined /> Have an issue or question?</Text>
            <br />
            <Text type="secondary" style={{ fontSize: 13 }}>Log a complaint and our customer support team will follow up.</Text>
          </Col>
          <Col xs={24} sm={8} style={{ textAlign: 'right' }}>
            <Button
              type="primary"
              block
              style={{ backgroundColor: tokens.primary, height: 38, borderRadius: 8 }}
              onClick={() => navigate('/portal/complaints')}
            >
              Log a Complaint
            </Button>
          </Col>
        </Row>
      </Card>
    </div>
  );
};
