// src/pages/branches/MasterPricingPage.tsx
// ⚠️ PROTOTYPE — see src/mock/governance.ts. Sample data only.
//
// "Head office owns the master pricing and templates" — branches can see
// these but never edit them here; there is no branch-level pricing screen.
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Table, Tag, Typography } from 'antd';
import { ArrowLeftOutlined, LockOutlined } from '@ant-design/icons';
import { PageHeader } from '@/components/shared/PageHeader';
import { MockDataBanner } from '@/components/shared/MockDataBanner';
import { mockPricingTemplates } from '@/mock/governance';

const { Text } = Typography;

export const MasterPricingPage: React.FC = () => {
  const navigate = useNavigate();

  const columns = [
    { title: 'Code', dataIndex: 'code', key: 'code', render: (v: string) => <Tag>{v}</Tag> },
    { title: 'Template', dataIndex: 'name', key: 'name' },
    { title: 'Property Type', dataIndex: 'propertyType', key: 'propertyType', render: (v: string) => <Tag color="purple">{v}</Tag> },
    {
      title: 'Base Price',
      key: 'price',
      render: (_: any, record: { basePriceMinor: number; unit: string }) => (
        <Text strong>GHS {(record.basePriceMinor / 100).toLocaleString()} <Text type="secondary">/ {record.unit}</Text></Text>
      ),
    },
    { title: 'Last Updated', dataIndex: 'updatedAt', key: 'updatedAt' },
    {
      title: 'Owner',
      key: 'owner',
      render: () => <Tag icon={<LockOutlined />} color="gold">Head Office only</Tag>,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Master Pricing & Templates"
        actions={[{ label: 'Head Office', onClick: () => navigate('/head-office'), icon: <ArrowLeftOutlined /> }]}
      />
      <MockDataBanner />

      <Card style={{ marginBottom: 24 }}>
        <Text>
          These pricing templates are owned centrally by Head Office. Branches use them as-is for
          quotes and invoices — day-to-day branch operations never edit the base price or template here.
        </Text>
      </Card>

      <Card title="Property Pricing Templates (sample)">
        <Table columns={columns} dataSource={mockPricingTemplates} rowKey="id" pagination={false} />
      </Card>
    </div>
  );
};
