// src/pages/portal/PortalComplaintsPage.tsx
// ⚠️ PROTOTYPE — see src/mock/complaints.ts. Not connected to any real
// support/ticketing system yet.
import React, { useEffect, useState } from 'react';
import { Button, Card, Form, Input, List, Modal, Select, Tag, Typography, message } from 'antd';
import { MessageOutlined, PlusOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { tokens } from '@/constants/tokens';
import { useCustomerPortalAuth } from '@/contexts/CustomerPortalAuthContext';
import { addComplaint, useComplaints, type ComplaintCategory } from '@/mock/complaints';
import { markSeen } from '@/mock/seenTracker';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

const CATEGORY_LABEL: Record<ComplaintCategory, string> = {
  payment: 'Payment Issue',
  property: 'Property Issue',
  documentation: 'Documentation',
  service: 'Customer Service',
  other: 'Other',
};

const statusColor: Record<string, string> = { open: 'gold', in_progress: 'blue', resolved: 'green' };

export const PortalComplaintsPage: React.FC = () => {
  const { customer } = useCustomerPortalAuth();
  const allComplaints = useComplaints();
  const [form] = Form.useForm();
  const [modalOpen, setModalOpen] = useState(false);

  const myComplaints = customer ? allComplaints.filter((c) => c.customerId === customer.id) : [];

  // Opening this page clears the "complaint updated" nav badge (see PortalLayout.tsx).
  useEffect(() => {
    if (customer?.id) markSeen('complaints-customer', customer.id);
  }, [customer?.id, allComplaints]);

  if (!customer) return null;

  const handleSubmit = (values: { category: ComplaintCategory; subject: string; message: string }) => {
    addComplaint({
      customerId: customer.id,
      customerName: `${customer.firstName} ${customer.lastName}`,
      ...values,
    });
    message.success('Complaint logged. Our team will follow up soon.');
    form.resetFields();
    setModalOpen(false);
  };

  return (
    <div>
      <Title level={3}><MessageOutlined /> Complaints</Title>

      <Card
        extra={<Button type="primary" icon={<PlusOutlined />} style={{ backgroundColor: tokens.primary }} onClick={() => setModalOpen(true)}>Log a Complaint</Button>}
        title="My Complaints"
      >
        {myComplaints.length > 0 ? (
          <List
            dataSource={myComplaints}
            renderItem={(c) => (
              <List.Item extra={<Tag color={statusColor[c.status]}>{c.status.replace('_', ' ')}</Tag>}>
                <List.Item.Meta
                  title={<span>{c.subject} <Tag style={{ marginLeft: 8 }}>{CATEGORY_LABEL[c.category]}</Tag></span>}
                  description={
                    <>
                      <Paragraph style={{ marginBottom: 4 }}>{c.message}</Paragraph>
                      <Text type="secondary" style={{ fontSize: 12 }}>{c.code} · Logged {dayjs(c.createdAt).format('MMM D, YYYY')}</Text>
                      {c.staffNote && (
                        <Paragraph style={{ marginTop: 8, marginBottom: 0, background: '#fafafa', padding: 8, borderRadius: 6 }}>
                          <Text strong style={{ fontSize: 12 }}>Team response:</Text> {c.staffNote}
                        </Paragraph>
                      )}
                    </>
                  }
                />
              </List.Item>
            )}
          />
        ) : (
          <Text type="secondary">You haven't logged any complaints yet.</Text>
        )}
      </Card>

      <Modal title="Log a Complaint" open={modalOpen} onCancel={() => setModalOpen(false)} footer={null} destroyOnClose>
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="category" label="Category" rules={[{ required: true, message: 'Please select a category' }]}>
            <Select placeholder="Select category" options={Object.entries(CATEGORY_LABEL).map(([value, label]) => ({ value, label }))} />
          </Form.Item>
          <Form.Item name="subject" label="Subject" rules={[{ required: true, message: 'Please enter a subject' }]}>
            <Input placeholder="Brief summary" />
          </Form.Item>
          <Form.Item name="message" label="Details" rules={[{ required: true, message: 'Please describe the issue' }]}>
            <TextArea rows={4} placeholder="Describe what happened" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block style={{ backgroundColor: tokens.primary }}>Submit</Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
