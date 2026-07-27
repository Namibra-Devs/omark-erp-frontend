// src/pages/admin/DeedPolicyPage.tsx
// ⚠️ PROTOTYPE — see src/mock/deedPolicy.ts. Sample data only.
import React from 'react';
import { Alert, Button, Card, Form, Input, InputNumber, Typography, message } from 'antd';
import { SaveOutlined } from '@ant-design/icons';
import { PageHeader } from '@/components/shared/PageHeader';
import { MockDataBanner } from '@/components/shared/MockDataBanner';
import { useAuth } from '@/contexts/AuthContext';
import { useDeedPolicy, updateDeedPolicy } from '@/mock/deedPolicy';

const { TextArea } = Input;
const { Text } = Typography;

export const DeedPolicyPage: React.FC = () => {
  const { user } = useAuth();
  const policy = useDeedPolicy();
  const [form] = Form.useForm();

  const handleSave = (values: { standardBusinessContacts: string; defaultWitnessCount: number; internalNotes: string }) => {
    updateDeedPolicy(values, user ? `${user.firstName} ${user.lastName}` : 'Admin');
    message.success('Company Deed Policy updated');
  };

  return (
    <div>
      <PageHeader title="Company Deed Policy" actions={[]} />
      <MockDataBanner />

      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 24 }}
        message="What this actually affects"
        description="The real Generate Deed endpoint only accepts customerId, propertyId, witnesses and a free-text Business Contacts field. 'Standard Business Contacts' below pre-fills that field on every new deed. 'Default Witness Count' only shapes how many witness rows the form starts with — witness names must still be entered per deed. 'Internal Notes' is for staff reference only and is never sent anywhere."
      />

      <Card title="Policy">
        <Form
          form={form}
          layout="vertical"
          initialValues={policy}
          onFinish={handleSave}
        >
          <Form.Item
            name="standardBusinessContacts"
            label="Standard Business Contacts"
            rules={[{ required: true, message: 'Required' }]}
            extra="Auto-fills the Business Contacts field when staff open Generate Deed."
          >
            <TextArea rows={4} />
          </Form.Item>
          <Form.Item
            name="defaultWitnessCount"
            label="Default Witness Count"
            rules={[{ required: true }]}
          >
            <InputNumber min={1} max={5} style={{ width: 160 }} />
          </Form.Item>
          <Form.Item name="internalNotes" label="Internal Notes (staff reference only)">
            <TextArea rows={3} />
          </Form.Item>
          <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 16 }}>
            Last updated {new Date(policy.updatedAt).toLocaleString()} by {policy.updatedBy}
          </Text>
          <Button type="primary" htmlType="submit" icon={<SaveOutlined />}>Save Policy</Button>
        </Form>
      </Card>
    </div>
  );
};
