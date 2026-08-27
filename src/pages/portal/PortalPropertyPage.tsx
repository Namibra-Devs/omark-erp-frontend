// src/pages/portal/PortalPropertyPage.tsx
import React from 'react';
import { Card, Descriptions, Empty, Progress, Spin, Tag, Typography } from 'antd';
import { HomeOutlined } from '@ant-design/icons';
import { tokens } from '@/constants/tokens';
import { usePortalMeQuery } from '@/api/portal';

const { Title } = Typography;

export const PortalPropertyPage: React.FC = () => {
  const { data: portalData, isLoading } = usePortalMeQuery();

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <Spin size="large" tip="Loading property details..." />
      </div>
    );
  }

  const property = portalData?.property;
  const paymentPlan = portalData?.paymentPlan;

  return (
    <div>
      <Title level={3}><HomeOutlined /> My Property</Title>

      {property ? (
        <Card style={{ marginBottom: 24 }}>
          <Descriptions title={property.houseNumber} column={{ xs: 1, sm: 2 }} bordered>
            <Descriptions.Item label="Offer Number">{property.offerNumber}</Descriptions.Item>
            <Descriptions.Item label="Price">
              <Tag color={tokens.primary}>{property.currency || 'GHS'} {(property.priceMinor / 100).toLocaleString()}</Tag>
            </Descriptions.Item>
            {property.description && (
              <Descriptions.Item label="Description" span={2}>{property.description}</Descriptions.Item>
            )}
          </Descriptions>
        </Card>
      ) : (
        <Card style={{ marginBottom: 24 }}><Empty description="No property on file yet." /></Card>
      )}

      <Card title="Payment Plan Progress">
        {paymentPlan ? (
          <>
            <Progress percent={paymentPlan.progressPercent || 0} strokeColor={tokens.primary} />
            <Descriptions column={{ xs: 1, sm: 2 }} style={{ marginTop: 16 }}>
              <Descriptions.Item label="Total Price">{paymentPlan.currency || 'GHS'} {(paymentPlan.totalAmountMinor / 100).toLocaleString()}</Descriptions.Item>
              <Descriptions.Item label="Down Payment">{paymentPlan.currency || 'GHS'} {(paymentPlan.downPaymentMinor / 100).toLocaleString()}</Descriptions.Item>
              <Descriptions.Item label="Monthly Installment">{paymentPlan.currency || 'GHS'} {(paymentPlan.monthlyAmountMinor / 100).toLocaleString()}</Descriptions.Item>
              <Descriptions.Item label="Duration">{paymentPlan.numMonths} months</Descriptions.Item>
              <Descriptions.Item label="Balance Remaining">{paymentPlan.currency || 'GHS'} {(paymentPlan.balanceMinor / 100).toLocaleString()}</Descriptions.Item>
              <Descriptions.Item label="Status"><Tag color="blue">{paymentPlan.status}</Tag></Descriptions.Item>
            </Descriptions>
          </>
        ) : (
          <Empty description="No payment plan on file yet." />
        )}
      </Card>
    </div>
  );
};
