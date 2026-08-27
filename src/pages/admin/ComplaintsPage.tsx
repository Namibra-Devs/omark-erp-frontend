// src/pages/admin/ComplaintsPage.tsx
import React, { useState } from 'react';
import { Button, Card, Input, Select, Space, Table, Tag, Typography, Modal, Form, message } from 'antd';
import { MessageOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { PageHeader } from '@/components/shared/PageHeader';
import { useComplaintsQuery, useUpdateComplaintMutation, type ComplaintEntity } from '@/api/complaints';

const { Text, Paragraph } = Typography;
const { TextArea } = Input;

const statusColor: Record<string, string> = { open: 'gold', in_progress: 'blue', resolved: 'green' };

export const ComplaintsPage: React.FC = () => {
  const [statusFilter, setStatusFilter] = useState<'open' | 'in_progress' | 'resolved' | undefined>(undefined);
  const { data: complaintsData, isLoading } = useComplaintsQuery(statusFilter ? { status: statusFilter } : undefined);
  const updateComplaint = useUpdateComplaintMutation();

  const complaints: ComplaintEntity[] = complaintsData?.items ?? [];
  const [active, setActive] = useState<ComplaintEntity | null>(null);
  const [form] = Form.useForm();

  const openRespond = (complaint: ComplaintEntity) => {
    setActive(complaint);
    form.setFieldsValue({ status: complaint.status, response: complaint.response });
  };

  const handleRespond = async (values: { status: 'open' | 'in_progress' | 'resolved'; response?: string }) => {
    if (!active) return;
    try {
      await updateComplaint.mutateAsync({
        id: active.id,
        payload: {
          status: values.status,
          response: values.response,
        },
      });
      message.success('Complaint status updated');
      setActive(null);
    } catch (err: any) {
      message.error(err?.error?.message || err?.message || 'Update failed');
    }
  };

  const columns = [
    { title: 'Customer', dataIndex: 'customerName', key: 'customerName', render: (v: string) => v || 'Customer' },
    { title: 'Subject', dataIndex: 'subject', key: 'subject' },
    { title: 'Message', dataIndex: 'message', key: 'message', ellipsis: true },
    { title: 'Logged', dataIndex: 'createdAt', key: 'createdAt', render: (v: string) => v ? dayjs(v).format('MMM D, YYYY') : 'N/A' },
    { title: 'Status', dataIndex: 'status', key: 'status', render: (v: string) => <Tag color={statusColor[v] || 'default'}>{v.replace('_', ' ')}</Tag> },
    {
      title: 'Action',
      key: 'action',
      render: (_: any, record: ComplaintEntity) => <Button type="link" size="small" onClick={() => openRespond(record)}>Review</Button>,
    },
  ];

  return (
    <div>
      <PageHeader title="Customer Complaints" actions={[]} />

      <Card
        title={<span><MessageOutlined style={{ marginRight: 8 }} />All Customer Complaints</span>}
        extra={
          <Select
            allowClear
            style={{ width: 160 }}
            placeholder="All statuses"
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { value: 'open', label: 'Open' },
              { value: 'in_progress', label: 'In Progress' },
              { value: 'resolved', label: 'Resolved' },
            ]}
          />
        }
      >
        <Table columns={columns} dataSource={complaints} rowKey="id" loading={isLoading} size="small" pagination={{ pageSize: 10 }} />
      </Card>

      <Modal title={active?.subject || 'Review Complaint'} open={!!active} onCancel={() => setActive(null)} footer={null} destroyOnClose>
        {active && (
          <>
            <Paragraph><Text strong>{active.subject}</Text></Paragraph>
            <Paragraph type="secondary">{active.message}</Paragraph>
            <Text type="secondary" style={{ fontSize: 12 }}>From {active.customerName || 'Customer'} · {dayjs(active.createdAt).format('MMM D, YYYY')}</Text>

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
              <Form.Item name="response" label="Response (visible to customer)">
                <TextArea rows={3} placeholder="Let the customer know what's happening" />
              </Form.Item>
              <Form.Item>
                <Space>
                  <Button type="primary" htmlType="submit" loading={updateComplaint.isPending}>Save</Button>
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
