// src/pages/marketing/ProspectsPage.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Space, Modal, Form, Input, Select, Row, Col, Table, Tag, message, Typography, Card } from 'antd';
import { PlusOutlined, EyeOutlined, SearchOutlined } from '@ant-design/icons';
import { useAuth } from '@/contexts/AuthContext';
import { StatusTag } from '@/components/shared/StatusTag';
import { PhoneInput } from '@/components/shared/PhoneInput';
import { PageHeader } from '@/components/shared/PageHeader';
import { prospectStatusLabels } from '@/constants/enums';
import type { Prospect, ProspectStatus } from '@/types';

const { Option } = Select;
const { TextArea } = Input;
const { Text } = Typography;

// Mock data
const mockProspects: Prospect[] = [
  {
    id: '1',
    firstName: 'John',
    lastName: 'Doe',
    address: '123 Main St, Accra',
    phoneNumber: '+233241234567',
    source: 'marketing',
    assignedUserId: '2',
    status: 'new',
    reasonForContact: 'Interested in buying a property',
    notes: 'Follow up next week',
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-01-15T10:00:00Z',
  },
  {
    id: '2',
    firstName: 'Sarah',
    lastName: 'Smith',
    address: '456 Independence Ave, Kumasi',
    phoneNumber: '+233241234568',
    source: 'marketing',
    assignedUserId: '2',
    status: 'meeting_scheduled',
    reasonForContact: 'Wants to view properties',
    notes: 'Meeting scheduled for Monday',
    createdAt: '2024-01-14T09:30:00Z',
    updatedAt: '2024-01-14T09:30:00Z',
  },
  {
    id: '3',
    firstName: 'Michael',
    lastName: 'Johnson',
    address: '789 Liberation Rd, Tema',
    phoneNumber: '+233241234569',
    source: 'marketing',
    assignedUserId: '2',
    status: 'meeting_completed',
    reasonForContact: 'Ready to purchase',
    notes: 'Interested in property #102',
    createdAt: '2024-01-13T14:20:00Z',
    updatedAt: '2024-01-13T14:20:00Z',
  },
  {
    id: '4',
    firstName: 'Emma',
    lastName: 'Williams',
    address: '321 Castle Rd, Cape Coast',
    phoneNumber: '+233241234570',
    source: 'marketing',
    assignedUserId: '2',
    status: 'suspended',
    reasonForContact: 'Was interested but went silent',
    notes: 'Try reaching out again next month',
    createdAt: '2024-01-12T11:15:00Z',
    updatedAt: '2024-01-12T11:15:00Z',
  },
  {
    id: '5',
    firstName: 'James',
    lastName: 'Brown',
    address: '654 Ocean Dr, Takoradi',
    phoneNumber: '+233241234571',
    source: 'marketing',
    assignedUserId: '2',
    status: 'postponed',
    reasonForContact: 'Wants to see more options',
    notes: 'Postponed to next month',
    createdAt: '2024-01-11T16:45:00Z',
    updatedAt: '2024-01-11T16:45:00Z',
  },
  {
    id: '6',
    firstName: 'Lisa',
    lastName: 'Taylor',
    address: '987 Park Ave, Accra',
    phoneNumber: '+233241234572',
    source: 'marketing',
    assignedUserId: '2',
    status: 'canceled',
    reasonForContact: 'Found another property',
    notes: 'Canceled due to alternative purchase',
    createdAt: '2024-01-10T13:00:00Z',
    updatedAt: '2024-01-10T13:00:00Z',
  },
  {
    id: '7',
    firstName: 'David',
    lastName: 'Wilson',
    address: '147 Green St, Kumasi',
    phoneNumber: '+233241234573',
    source: 'marketing',
    assignedUserId: '2',
    status: 'purchased',
    reasonForContact: 'Bought a property',
    notes: 'Successfully converted to customer',
    createdAt: '2024-01-09T08:30:00Z',
    updatedAt: '2024-01-09T08:30:00Z',
  },
];

export const ProspectsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [prospects, setProspects] = useState<Prospect[]>(mockProspects);

  const handleAddProspect = async (values: any) => {
    setLoading(true);
    // Simulate API call
    setTimeout(() => {
      const newProspect: Prospect = {
        id: Date.now().toString(),
        ...values,
        source: 'marketing',
        assignedUserId: user?.id || '2',
        status: 'new',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setProspects([newProspect, ...prospects]);
      setLoading(false);
      setIsModalOpen(false);
      form.resetFields();
      message.success('Prospect added successfully!');
    }, 800);
  };

  const handleStatusChange = (id: string, newStatus: ProspectStatus) => {
    setProspects(prospects.map(p => 
      p.id === id ? { ...p, status: newStatus, updatedAt: new Date().toISOString() } : p
    ));
    message.success(`Status updated to ${prospectStatusLabels[newStatus]}`);
  };

  // Filter prospects
  const filteredProspects = prospects.filter(prospect => {
    const matchesSearch = prospect.firstName.toLowerCase().includes(searchText.toLowerCase()) ||
                          prospect.lastName.toLowerCase().includes(searchText.toLowerCase()) ||
                          prospect.phoneNumber.includes(searchText) ||
                          prospect.address.toLowerCase().includes(searchText.toLowerCase());
    const matchesStatus = statusFilter === 'all' || prospect.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

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
        <Space size={[4, 4]} wrap>
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => navigate(`/marketing/prospects/${record.id}`)}
            style={{ padding: '0 4px' }}
          >
            View
          </Button>
          <Select
            defaultValue={record.status}
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
              Total: {filteredProspects.length} prospects
            </Text>
          </Col>
        </Row>
      </Card>

      {/* Table */}
      <div style={{ overflowX: 'auto', maxWidth: '100%' }}>
        <Table
          columns={columns}
          dataSource={filteredProspects}
          rowKey="id"
          loading={loading}
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
              <Button type="primary" htmlType="submit" loading={loading}>
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