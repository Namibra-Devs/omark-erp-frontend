// src/pages/portal/PortalDashboardPage.tsx
// ⚠️ PROTOTYPE — see src/mock/customerPortalCache.ts. Property/payment
// figures are a snapshot cached the last time staff viewed this record.
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Button, Card, Col, Progress, Row, Statistic, Tag, Typography } from 'antd';
import { CalendarOutlined, DollarOutlined, HomeOutlined, MessageOutlined } from '@ant-design/icons';
import { tokens } from '@/constants/tokens';
import { useCustomerPortalAuth } from '@/contexts/CustomerPortalAuthContext';
import { getComplaintsForCustomer } from '@/mock/complaints';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

export const PortalDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { customer } = useCustomerPortalAuth();

  if (!customer) return null;

  const plan = customer.paymentPlan;
  const openComplaints = getComplaintsForCustomer(customer.id).filter((c) => c.status !== 'resolved').length;
  const cachedAgo = dayjs(customer.cachedAt).format('MMM D, YYYY');

  return (
    <div>
      <Title level={3}>Welcome back, {customer.firstName}</Title>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 24 }}
        message="This is a preview of the customer portal"
        description={`Figures below are a snapshot from our records as of ${cachedAgo}. Payments and property changes made after that won't show here yet.`}
      />

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Property"
              value={customer.property?.houseNumber ?? 'Not on file'}
              prefix={<HomeOutlined />}
              valueStyle={{ fontSize: 18, color: tokens.primary }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Balance Remaining"
              value={plan ? plan.balanceMinor / 100 : 0}
              prefix="GHS"
              precision={2}
              valueStyle={{ color: plan && plan.balanceMinor > 0 ? '#ff4d4f' : '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="Payment Plan Progress" value={plan?.progressPercent ?? 0} suffix="%" prefix={<DollarOutlined />} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="Open Complaints" value={openComplaints} prefix={<MessageOutlined />} valueStyle={{ color: openComplaints > 0 ? '#faad14' : '#52c41a' }} />
          </Card>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col xs={24} lg={12}>
          <Card
            title={<span><HomeOutlined style={{ marginRight: 8 }} />My Property</span>}
            extra={<Button type="link" onClick={() => navigate('/portal/property')}>View details</Button>}
            style={{ marginBottom: 24 }}
          >
            {customer.property ? (
              <>
                <Text strong style={{ fontSize: 16 }}>{customer.property.houseNumber}</Text>
                <br />
                <Text type="secondary">Offer No. {customer.property.offerNumber}</Text>
                <br />
                <Tag color={tokens.primary} style={{ marginTop: 8 }}>
                  GHS {(customer.property.priceMinor / 100).toLocaleString()}
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
            style={{ marginBottom: 24 }}
          >
            {plan ? (
              <>
                <Progress percent={plan.progressPercent} strokeColor={tokens.primary} />
                <Row gutter={16} style={{ marginTop: 12 }}>
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
        <Row align="middle" justify="space-between">
          <Col>
            <Text strong><CalendarOutlined /> Have an issue or question?</Text>
            <br />
            <Text type="secondary">Log a complaint and our team will follow up.</Text>
          </Col>
          <Col>
            <Button type="primary" style={{ backgroundColor: tokens.primary }} onClick={() => navigate('/portal/complaints')}>
              Log a Complaint
            </Button>
          </Col>
        </Row>
      </Card>
    </div>
  );
};
