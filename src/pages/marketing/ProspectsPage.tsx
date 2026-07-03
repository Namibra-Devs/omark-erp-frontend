// src/pages/marketing/ProspectsPage.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Space, Modal, Form, Input, Select, Row, Col, Table, Tag, message, Typography, Card, Spin } from 'antd';
import { PlusOutlined, EyeOutlined, SearchOutlined } from '@ant-design/icons';
import { useAuth } from '@/contexts/AuthContext';
import { StatusTag } from '@/components/shared/StatusTag';
import { PhoneInput } from '@/components/shared/PhoneInput';
import { PageHeader } from '@/components/shared/PageHeader';
import { prospectStatusLabels } from '@/constants/enums';
import type { Prospect, ProspectStatus } from '@/types';
import { useProspects, useCreateProspect, useUpdateProspect } from '@/api/prospects';

const { Option } = Select;
const { TextArea } = Input;
const { Text } = Typography;

export const ProspectsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form] = Form.useForm();
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // React Query hooks
  const { data: prospectsResponse, isLoading, refetch } = useProspects({
    source: 'marketing',
    status: statusFilter === 'all' ? undefined : statusFilter,
    q: searchText || undefined,
  });

  const createProspectMutation = useCreateProspect();
  const updateProspectMutation = useUpdateProspect();

  const prospects = prospectsResponse?.data || [];

  const handleAddProspect = async (values: any) => {
    try {
      await createProspectMutation.mutateAsync({
        ...values,
        source: 'marketing',
        assignedUserId: user?.id || '2',
        status: 'new',
      });
      setIsModalOpen(false);
      form.resetFields();
      message.success('Prospect added successfully!');
    } catch (err: any) {
      console.error('Failed to add prospect:', err);
      message.error(err.error?.message || 'Failed to add prospect. Please try again.');
    }
  };

  const handleStatusChange = async (id: string, newStatus: ProspectStatus) => {
    try {
      await updateProspectMutation.mutateAsync({
        id,
        data: { status: newStatus },
      });
      message.success(`Status updated to ${prospectStatusLabels[newStatus]}`);
    } catch (err: any) {
      console.error('Failed to update status:', err);
      message.error(err.error?.message || 'Failed to update status.');
    }
  };

  const columns = [
    {
      title: 'Name',
      key: 'name',
      width: 120,
      render: (_: any, record: Prospect) => (
        <Text strong style={{ fontSize: 'clamp(12px, 1vw, 14px)' }}>
          {record.firstName} {record.lastName}
        </Text>
      ),
    },
    {
      title: 'Phone',
      dataIndex: 'phoneNumber',
      key: 'phoneNumber',
      width: 120,
      responsive: ['md'] as any,
    },
    {
      title: 'Address',
      dataIndex: 'address',
      key: 'address',
      ellipsis: true,
      width: 150,
      responsive: ['lg'] as any,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status: string) => <StatusTag status={status} type="prospect" />,
    },
    {
      title: 'Reason',
      dataIndex: 'reasonForContact',
      key: 'reasonForContact',
      ellipsis: true,
      width: 150,
      responsive: ['xl'] as any,
    },
    {
      title: 'Last Activity',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: 100,
      responsive: ['lg'] as any,
      render: (date: string) => new Date(date).toLocaleDateString(),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 240,
      fixed: 'right' as any,
      render: (_: any, record: Prospect) => (
        <Space size={[4, 4]} wrap onClick={(e) => e.stopPropagation()}>
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => navigate(`/marketing/prospects/${record.id}`)}
            style={{ padding: '0 4px' }}
          >
            View
          </Button>
          <Select
            value={record.status}
            style={{ width: 130, minWidth: 100 }}
            size="small"
            onChange={(value) => handleStatusChange(record.id, value as ProspectStatus)}
            dropdownMatchSelectWidth={false}
          >
            <Option value="new">New</Option>
            <Option value="meeting_scheduled">Schedule</Option>
            <Option value="meeting_completed">Complete</Option>
            <Option value="suspended">Suspend</Option>
            <Option value="postponed">Postpone</Option>
            <Option value="canceled">Cancel</Option>
          </Select>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ maxWidth: '100%', overflow: 'hidden', padding: '0 4px' }}>
      <PageHeader
        title="Marketing Prospects"
        actions={[
          {
            label: 'Add Prospect',
            onClick: () => setIsModalOpen(true),
            icon: <PlusOutlined />,
          },
        ]}
      />

      {/* Filters */}
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={[8, 8]}>
          <Col xs={24} sm={12} md={8}>
            <Input
              placeholder="Search..."
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear
              size="middle"
            />
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Select
              style={{ width: '100%' }}
              placeholder="Filter by status"
              value={statusFilter}
              onChange={setStatusFilter}
              allowClear
              size="middle"
            >
              <Option value="all">All Statuses</Option>
              <Option value="new">New</Option>
              <Option value="meeting_scheduled">Meeting Scheduled</Option>
              <Option value="meeting_completed">Meeting Completed</Option>
              <Option value="suspended">Suspended</Option>
              <Option value="postponed">Postponed</Option>
              <Option value="canceled">Canceled</Option>
              <Option value="purchased">Purchased</Option>
            </Select>
          </Col>
          <Col xs={24} sm={24} md={8}>
            <Text type="secondary" style={{ display: 'block', textAlign: 'right' }}>
              Total: {prospects.length} prospects
            </Text>
          </Col>
        </Row>
      </Card>

      {/* Table */}
      <div style={{ overflowX: 'auto', maxWidth: '100%' }}>
        <Table
          columns={columns}
          dataSource={prospects}
          rowKey="id"
          loading={isLoading}
          size="middle"
          scroll={{ x: 700 }}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `Total ${total} prospects`,
            responsive: true,
          }}
          onRow={(record) => ({
            onClick: () => navigate(`/marketing/prospects/${record.id}`),
            style: { cursor: 'pointer' },
          })}
        />
      </div>

      {/* Add Prospect Modal */}
      <Modal
        title="Add New Prospect"
        open={isModalOpen}
        onCancel={() => {
          setIsModalOpen(false);
          form.resetFields();
        }}
        footer={null}
        width={600}
        style={{ maxWidth: '95%', top: 20 }}
        bodyStyle={{ padding: '16px' }}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleAddProspect}
        >
          <Row gutter={[8, 0]}>
            <Col xs={24} sm={12}>
              <Form.Item
                name="firstName"
                label="First Name"
                rules={[{ required: true, message: 'First name is required' }]}
              >
                <Input />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                name="lastName"
                label="Last Name"
                rules={[{ required: true, message: 'Last name is required' }]}
              >
                <Input />
              </Form.Item>
            </Col>
          </Row>
          
          <Form.Item
            name="address"
            label="Address"
            rules={[{ required: true, message: 'Address is required' }]}
          >
            <Input.TextArea rows={2} />
          </Form.Item>
          
          <Form.Item
            name="phoneNumber"
            label="Phone Number"
            rules={[{ required: true, message: 'Phone number is required' }]}
          >
            <PhoneInput />
          </Form.Item>
          
          <Form.Item
            name="reasonForContact"
            label="Reason for Contact"
            rules={[{ required: true, message: 'Reason for contact is required' }]}
          >
            <TextArea rows={3} />
          </Form.Item>
          
          <Form.Item
            name="notes"
            label="Additional Notes"
          >
            <TextArea rows={3} />
          </Form.Item>
          
          <Form.Item>
            <Space wrap>
              <Button type="primary" htmlType="submit" loading={createProspectMutation.isPending}>
                Create Prospect
              </Button>
              <Button onClick={() => setIsModalOpen(false)}>Cancel</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};