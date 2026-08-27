// src/pages/admin/DeedPolicyPage.tsx
import React, { useEffect } from 'react';
import { Alert, Button, Card, Form, Input, InputNumber, Typography, message } from 'antd';
import { SaveOutlined } from '@ant-design/icons';
import { PageHeader } from '@/components/shared/PageHeader';
import { useDeedPolicyQuery, useUpdateDeedPolicyMutation } from '@/api/deedPolicy';

const { TextArea } = Input;
const { Text } = Typography;

export const DeedPolicyPage: React.FC = () => {
  const { data: policy, isLoading } = useDeedPolicyQuery();
  const updatePolicy = useUpdateDeedPolicyMutation();
  const [form] = Form.useForm();

  useEffect(() => {
    if (policy) {
      form.setFieldsValue({
        businessContacts: policy.businessContacts,
        defaultWitnessCount: policy.defaultWitnessCount || 2,
        notes: policy.notes,
      });
    }
  }, [policy, form]);

  const handleSave = async (values: any) => {
    try {
      await updatePolicy.mutateAsync({
        businessContacts: values.businessContacts,
        defaultWitnessCount: values.defaultWitnessCount,
        notes: values.notes,
      });
      message.success('Company Deed Policy updated successfully');
    } catch (err: any) {
      message.error(err?.error?.message || err?.message || 'Policy update failed');
    }
  };

  return (
    <div>
      <PageHeader title="Company Deed Policy" actions={[]} />

      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 24 }}
        message="Governance Policy"
        description="Business Contacts pre-fills official company witness & legal contact information on newly generated deed certificates. Default Witness Count configures mandatory witness entries per document."
      />

      <Card title="Policy Configuration" loading={isLoading}>
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSave}
        >
          <Form.Item
            name="businessContacts"
            label="Standard Business Contacts"
            rules={[{ required: true, message: 'Business contact details required' }]}
            extra="Auto-fills the Business Contacts field when staff generate deed certificates."
          >
            <TextArea rows={4} placeholder="Company Legal Representative, Contact Details, HQ Address" />
          </Form.Item>
          <Form.Item
            name="defaultWitnessCount"
            label="Default Witness Count"
            rules={[{ required: true }]}
          >
            <InputNumber min={1} max={5} style={{ width: 160 }} />
          </Form.Item>
          <Form.Item name="notes" label="Internal Notes (staff reference)">
            <TextArea rows={3} placeholder="Internal legal guidelines or notes" />
          </Form.Item>
          {policy?.updatedAt && (
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 16 }}>
              Last updated {new Date(policy.updatedAt).toLocaleString()}
            </Text>
          )}
          <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={updatePolicy.isPending}>Save Policy</Button>
        </Form>
      </Card>
    </div>
  );
};
