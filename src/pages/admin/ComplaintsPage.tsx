// src/pages/admin/ComplaintsPage.tsx
// ⚠️ PROTOTYPE — see src/mock/complaints.ts. Staff-side triage view for
// complaints logged through the Customer Portal (also a prototype).
import React, { useEffect, useState } from 'react';
import { Button, Card, Input, Select, Space, Table, Tag, Typography, Modal, Form, message } from 'antd';
import { MessageOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { PageHeader } from '@/components/shared/PageHeader';
import { MockDataBanner } from '@/components/shared/MockDataBanner';
import { useAuth } from '@/contexts/AuthContext';
import { markSeen } from '@/mock/seenTracker';
import { useComplaints, updateComplaintStatus, type Complaint, type ComplaintStatus } from '@/mock/complaints';

const { Text, Paragraph } = Typography;
const { TextArea } = Input;

const statusColor: Record<ComplaintStatus, string> = { open: 'gold', in_progress: 'blue', resolved: 'green' };

export const ComplaintsPage: React.FC = () => {
  const { user } = useAuth();
  const complaints = useComplaints();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [active, setActive] = useState<Complaint | null>(null);
  const [form] = Form.useForm();

  // Opening this page clears the "new complaints" nav badge (see NavMenu.tsx).
  useEffect(() => {
    if (user?.id) markSeen('complaints-staff', user.id);
  }, [user?.id, complaints]);

  const filtered = complaints.filter((c) => statusFilter === 'all' || c.status === statusFilter);

  const openRespond = (complaint: Complaint) => {
    setActive(complaint);
    form.setFieldsValue({ status: complaint.status, staffNote: complaint.staffNote });
  };

  const handleRespond = (values: { status: ComplaintStatus; staffNote?: string }) => {
    if (!active) return;
    updateComplaintStatus(active.id, values.status, values.staffNote);
    message.success(`${active.code} updated`);
    setActive(null);
  };

  const columns = [
    { title: 'Code', dataIndex: 'code', key: 'code', render: (v: string) => <Tag>{v}</Tag> },
    { title: 'Customer', dataIndex: 'customerName', key: 'customerName' },
    { title: 'Subject', dataIndex: 'subject', key: 'subject' },
    { title: 'Category', dataIndex: 'category', key: 'category', render: (v: string) => <Tag color="purple">{v}</Tag> },
    { title: 'Logged', dataIndex: 'createdAt', key: 'createdAt', render: (v: string) => dayjs(v).format('MMM D, YYYY') },
    { title: 'Status', dataIndex: 'status', key: 'status', render: (v: ComplaintStatus) => <Tag color={statusColor[v]}>{v.replace('_', ' ')}</Tag> },
    {
      title: 'Action',
      key: 'action',
      render: (_: any, record: Complaint) => <Button type="link" size="small" onClick={() => openRespond(record)}>Review</Button>,
    },
  ];

  return (
    <div>
      <PageHeader title="Customer Complaints" actions={[]} />
      <MockDataBanner />

      <Card
        title={<span><MessageOutlined style={{ marginRight: 8 }} />All Complaints (sample)</span>}
        extra={
          <Select
            style={{ width: 160 }}
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { value: 'all', label: 'All statuses' },
              { value: 'open', label: 'Open' },
              { value: 'in_progress', label: 'In Progress' },
              { value: 'resolved', label: 'Resolved' },
            ]}
          />
        }
      >
        <Table columns={columns} dataSource={filtered} rowKey="id" size="small" pagination={{ pageSize: 10 }} />
      </Card>

      <Modal title={active?.code} open={!!active} onCancel={() => setActive(null)} footer={null} destroyOnClose>
        {active && (
          <>
            <Paragraph><Text strong>{active.subject}</Text></Paragraph>
            <Paragraph type="secondary">{active.message}</Paragraph>
            <Text type="secondary" style={{ fontSize: 12 }}>From {active.customerName} · {dayjs(active.createdAt).format('MMM D, YYYY')}</Text>

            <Form form={form} layout="vertical" onFinish={handleRespond} style={{ marginTop: 16 }}>
              <Form.Item name="status" label="Status" rules={[{ required: true }]}>
                <Select
                  options={[
                    { value: 'open', label: 'Open' },
                    { value: 'in_progress', label: 'In Progress' },
                    { value: 'resolved', label: 'Resolved' },
                  ]}
                />
              </Form.Item>
              <Form.Item name="staffNote" label="Response (visible to customer)">
                <TextArea rows={3} placeholder="Let the customer know what's happening" />
              </Form.Item>
              <Form.Item>
                <Space>
                  <Button type="primary" htmlType="submit">Save</Button>
                  <Button onClick={() => setActive(null)}>Cancel</Button>
                </Space>
              </Form.Item>
            </Form>
          </>
        )}
      </Modal>
    </div>
  );
};
