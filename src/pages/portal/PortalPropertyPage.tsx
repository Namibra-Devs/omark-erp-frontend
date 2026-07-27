// src/pages/portal/PortalPropertyPage.tsx
// ⚠️ PROTOTYPE — see src/mock/customerPortalCache.ts.
import React from 'react';
import { Card, Descriptions, Empty, Progress, Tag, Typography } from 'antd';
import { HomeOutlined } from '@ant-design/icons';
import { tokens } from '@/constants/tokens';
import { useCustomerPortalAuth } from '@/contexts/CustomerPortalAuthContext';

const { Title } = Typography;

export const PortalPropertyPage: React.FC = () => {
  const { customer } = useCustomerPortalAuth();
  if (!customer) return null;

  const { property, paymentPlan } = customer;

  return (
    <div>
      <Title level={3}><HomeOutlined /> My Property</Title>

      {property ? (
        <Card style={{ marginBottom: 24 }}>
          <Descriptions title={property.houseNumber} column={{ xs: 1, sm: 2 }} bordered>
            <Descriptions.Item label="Offer Number">{property.offerNumber}</Descriptions.Item>
            <Descriptions.Item label="Price">
              <Tag color={tokens.primary}>{property.currency} {(property.priceMinor / 100).toLocaleString()}</Tag>
            </Descriptions.Item>
          </Descriptions>
        </Card>
      ) : (
        <Card style={{ marginBottom: 24 }}><Empty description="No property on file yet." /></Card>
      )}

      <Card title="Payment Plan Progress">
        {paymentPlan ? (
          <>
            <Progress percent={paymentPlan.progressPercent} strokeColor={tokens.primary} />
            <Descriptions column={{ xs: 1, sm: 2 }} style={{ marginTop: 16 }}>
              <Descriptions.Item label="Total Price">{paymentPlan.currency} {(paymentPlan.totalAmountMinor / 100).toLocaleString()}</Descriptions.Item>
              <Descriptions.Item label="Down Payment">{paymentPlan.currency} {(paymentPlan.downPaymentMinor / 100).toLocaleString()}</Descriptions.Item>
              <Descriptions.Item label="Monthly Installment">{paymentPlan.currency} {(paymentPlan.monthlyAmountMinor / 100).toLocaleString()}</Descriptions.Item>
              <Descriptions.Item label="Duration">{paymentPlan.numMonths} months</Descriptions.Item>
              <Descriptions.Item label="Balance Remaining">{paymentPlan.currency} {(paymentPlan.balanceMinor / 100).toLocaleString()}</Descriptions.Item>
              <Descriptions.Item label="Status"><Tag>{paymentPlan.status.replace('_', ' ')}</Tag></Descriptions.Item>
            </Descriptions>
          </>
        ) : (
          <Empty description="No payment plan on file yet." />
        )}
      </Card>
    </div>
  );
};
