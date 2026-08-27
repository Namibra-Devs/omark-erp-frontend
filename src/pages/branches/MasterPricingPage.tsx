// src/pages/branches/MasterPricingPage.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Table, Tag, Typography, Modal, Form, Input, InputNumber, Space, message } from 'antd';
import { ArrowLeftOutlined, LockOutlined, PlusOutlined } from '@ant-design/icons';
import { PageHeader } from '@/components/shared/PageHeader';
import { usePricingTemplatesQuery, useCreatePricingTemplateMutation, type PricingTemplate } from '@/api/pricingTemplates';

const { Text } = Typography;

export const MasterPricingPage: React.FC = () => {
  const navigate = useNavigate();
  const { data: templates = [], isLoading } = usePricingTemplatesQuery();
  const createTemplate = useCreatePricingTemplateMutation();

  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();

  const handleCreate = async (values: any) => {
    try {
      await createTemplate.mutateAsync({
        name: values.name,
        priceMinor: Math.round(values.price * 100),
        currency: values.currency || 'GHS',
        description: values.description,
      });
      message.success('Pricing template created successfully');
      setModalOpen(false);
      form.resetFields();
    } catch (err: any) {
      message.error(err?.error?.message || err?.message || 'Failed to create template');
    }
  };

  const columns = [
    { title: 'Template Name', dataIndex: 'name', key: 'name' },
    {
      title: 'Base Price',
      key: 'price',
      render: (_: any, record: PricingTemplate) => (
        <Text strong>
          {record.currency || 'GHS'} {(record.priceMinor / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}
        </Text>
      ),
    },
    { title: 'Description', dataIndex: 'description', key: 'description', render: (v?: string) => v || 'N/A' },
    {
      title: 'Created At',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date?: string) => date ? new Date(date).toLocaleDateString() : 'N/A',
    },
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
        actions={[
          { label: 'Add Template', onClick: () => setModalOpen(true), icon: <PlusOutlined /> },
          { label: 'Head Office', onClick: () => navigate('/head-office'), icon: <ArrowLeftOutlined /> },
        ]}
      />

      <Card style={{ marginBottom: 24 }}>
        <Text>
          These pricing templates are owned centrally by Head Office. Branches use them as-is for
          quotes and payment plan configurations.
        </Text>
      </Card>

      <Card title="Property Pricing Templates">
        <Table columns={columns} dataSource={templates} rowKey="id" loading={isLoading} pagination={false} />
      </Card>

      <Modal
        title="Create Pricing Template"
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        footer={null}
      >
        <Form form={form} layout="vertical" onFinish={handleCreate} initialValues={{ currency: 'GHS' }}>
          <Form.Item name="name" label="Template Name" rules={[{ required: true, message: 'Name is required' }]}>
            <Input placeholder="e.g. 2-Bedroom Deluxe Standard" />
          </Form.Item>
          <Form.Item name="price" label="Base Price (GHS)" rules={[{ required: true, message: 'Price is required' }]}>
            <InputNumber style={{ width: '100%' }} min={0} placeholder="e.g. 250000" />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={3} placeholder="Template features and terms" />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={createTemplate.isPending}>
                Create Template
              </Button>
              <Button onClick={() => setModalOpen(false)}>Cancel</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
