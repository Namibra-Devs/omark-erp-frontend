// src/pages/portal/PortalComplaintsPage.tsx
import React, { useState } from 'react';
import { Button, Card, Form, Input, List, Modal, Tag, Typography, message } from 'antd';
import { MessageOutlined, PlusOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { tokens } from '@/constants/tokens';
import { useComplaintsQuery, useCreateComplaintMutation, type ComplaintEntity } from '@/api/complaints';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

const statusColor: Record<string, string> = { open: 'gold', in_progress: 'blue', resolved: 'green' };

export const PortalComplaintsPage: React.FC = () => {
  const { data: complaintsData, isLoading } = useComplaintsQuery();
  const createComplaint = useCreateComplaintMutation();
  const [form] = Form.useForm();
  const [modalOpen, setModalOpen] = useState(false);

  const myComplaints: ComplaintEntity[] = complaintsData?.items ?? [];

  const handleSubmit = async (values: { subject: string; message: string }) => {
    try {
      await createComplaint.mutateAsync({
        subject: values.subject,
        message: values.message,
      });
      message.success('Complaint logged. Our team will follow up soon.');
      form.resetFields();
      setModalOpen(false);
    } catch (err: any) {
      message.error(err?.error?.message || err?.message || 'Failed to submit complaint');
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <Title level={3} style={{ margin: 0, fontSize: 'clamp(18px, 4vw, 24px)' }}>
          <MessageOutlined /> Complaints
        </Title>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          style={{ backgroundColor: tokens.primary, borderRadius: 8, height: 38 }}
          onClick={() => setModalOpen(true)}
        >
          Log a Complaint
        </Button>
      </div>

      <Card title="My Complaints Feed" loading={isLoading}>
        {myComplaints.length > 0 ? (
          <List
            dataSource={myComplaints}
            renderItem={(c: ComplaintEntity) => (
              <List.Item extra={<Tag color={statusColor[c.status] || 'default'}>{(c.status || 'open').replace('_', ' ')}</Tag>}>
                <List.Item.Meta
                  title={<span>{c.subject}</span>}
                  description={
                    <>
                      <Paragraph style={{ marginBottom: 4 }}>{c.message}</Paragraph>
                      <Text type="secondary" style={{ fontSize: 12 }}>Logged {c.createdAt ? dayjs(c.createdAt).format('MMM D, YYYY') : 'N/A'}</Text>
                      {c.response && (
                        <Paragraph style={{ marginTop: 8, marginBottom: 0, background: '#fafafa', padding: 8, borderRadius: 6 }}>
                          <Text strong style={{ fontSize: 12 }}>Team response:</Text> {c.response}
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

      <Modal
        title="Log a Complaint"
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        footer={null}
        destroyOnClose
        width="100%"
        style={{ maxWidth: 480, top: 20 }}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="subject" label="Subject" rules={[{ required: true, message: 'Please enter a subject' }]}>
            <Input placeholder="Brief summary" />
          </Form.Item>
          <Form.Item name="message" label="Details" rules={[{ required: true, message: 'Please describe the issue' }]}>
            <TextArea rows={4} placeholder="Describe what happened" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={createComplaint.isPending} block style={{ backgroundColor: tokens.primary, height: 42, borderRadius: 8, fontSize: 15, fontWeight: 600 }}>
              Submit
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
