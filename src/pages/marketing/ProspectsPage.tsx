// src/pages/marketing/ProspectsPage.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Space, Modal, Form, Input, Select, Row, Col, Table, Tag, message, Typography, Card, Spin, Popconfirm, Tooltip } from 'antd';
import { PlusOutlined, EyeOutlined, SearchOutlined, EditOutlined, DeleteOutlined, DollarOutlined } from '@ant-design/icons';
import { useAuth } from '@/contexts/AuthContext';
import { StatusTag } from '@/components/shared/StatusTag';
import { PhoneInput } from '@/components/shared/PhoneInput';
import { PageHeader } from '@/components/shared/PageHeader';
import { ConvertProspectModal } from '@/components/shared/ConvertProspectModal';
import { prospectStatusLabels } from '@/constants/enums';
import type { Prospect, ProspectStatus } from '@/types';
import { useProspectsQuery, useCreateProspectMutation, useUpdateProspectMutation, useDeleteProspectMutation } from '@/api/prospects';

const { Option } = Select;
const { TextArea } = Input;
const { Text } = Typography;

export const ProspectsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, hasRole } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form] = Form.useForm();
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<ProspectStatus | 'all'>('all');
  const [editModal, setEditModal] = useState(false);
  const [editingProspect, setEditingProspect] = useState<Prospect | null>(null);
  const [convertModal, setConvertModal] = useState(false);
  const [prospectToConvert, setProspectToConvert] = useState<Prospect | null>(null);
  const [editForm] = Form.useForm();

  // React Query hooks
  const { data: prospectsData, isLoading, refetch } = useProspectsQuery({
    source: 'marketing',
    status: statusFilter === 'all' ? undefined : statusFilter,
    q: searchText || undefined,
  });

  const createProspectMutation = useCreateProspectMutation();
  const updateProspectMutation = useUpdateProspectMutation();
  const deleteProspectMutation = useDeleteProspectMutation();

  const prospectList: Prospect[] = prospectsData?.items ?? [];

  const handleAddProspect = async (values: any) => {
    try {
      await createProspectMutation.mutateAsync({
        ...values,
        source: 'marketing',
        assignedUserId: user?.id || '2',
      });
      setIsModalOpen(false);
      form.resetFields();
      message.success('Prospect added successfully!');
    } catch (err: any) {
      console.error('Failed to add prospect:', err);
      message.error(err.error?.message || 'Failed to add prospect. Please try again.');
    }
  };

  const handleEditClick = (record: Prospect) => {
    setEditingProspect(record);
    editForm.setFieldsValue({
      firstName: record.firstName,
      lastName: record.lastName,
      address: record.address,
      phoneNumber: record.phoneNumber,
      status: record.status,
      reasonForContact: record.reasonForContact,
      notes: record.notes,
    });
    setEditModal(true);
  };

  const handleEditProspect = async (values: any) => {
    if (!editingProspect) return;
    try {
      await updateProspectMutation.mutateAsync({
        id: editingProspect.id,
        data: {
          firstName: values.firstName,
          lastName: values.lastName,
          address: values.address,
          phoneNumber: values.phoneNumber,
          status: values.status,
          reasonForContact: values.reasonForContact,
          notes: values.notes,
        },
      });
      message.success('Prospect updated successfully!');
      setEditModal(false);
      setEditingProspect(null);
      editForm.resetFields();
      refetch();
    } catch (err: any) {
      message.error(err?.message || 'Failed to update prospect');
    }
  };

  const handleDeleteProspect = async (id: string) => {
    try {
      await deleteProspectMutation.mutateAsync(id);
      message.success('Prospect deleted successfully!');
      refetch();
    } catch (err: any) {
      message.error(err?.message || 'Failed to delete prospect');
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
      width: 100,
      fixed: 'right' as any,
      render: (_: any, record: Prospect) => (
        <Space size={[4, 4]} wrap onClick={(e) => e.stopPropagation()}>
          <Button
            type="primary"
            ghost
            icon={<EyeOutlined />}
            onClick={() => navigate(`/marketing/prospects/${record.id}`)}
            size="small"
          >
            View
          </Button>
          <Tooltip title="Edit Prospect">
            <Button
              icon={<EditOutlined />}
              onClick={() => handleEditClick(record)}
              size="small"
            />
          </Tooltip>
          {record.status !== 'purchased' && (
            <Tooltip title="Convert to Customer">
              <Button
                type="primary"
                icon={<DollarOutlined />}
                onClick={() => {
                  setProspectToConvert(record);
                  setConvertModal(true);
                }}
                size="small"
                style={{ background: '#52c41a', borderColor: '#52c41a' }}
              />
            </Tooltip>
          )}
          {hasRole(['admin']) && (
            <Popconfirm
              title="Delete Prospect"
              description={`Are you sure you want to delete ${record.firstName} ${record.lastName}? This also removes its interactions and appointments.`}
              onConfirm={() => handleDeleteProspect(record.id)}
              okText="Yes"
              cancelText="No"
            >
              <Tooltip title="Delete (admin only)">
                <Button danger icon={<DeleteOutlined />} size="small" />
              </Tooltip>
            </Popconfirm>
          )}
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
              Total: {prospectList.length} prospects
            </Text>
          </Col>
        </Row>
      </Card>

      {/* Table */}
      <div style={{ overflowX: 'auto', maxWidth: '100%' }}>
        <Table
          columns={columns}
          dataSource={prospectList}
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

      {/* Edit Prospect Modal */}
      <Modal
        title="Edit Prospect"
        open={editModal}
        onCancel={() => {
          setEditModal(false);
          setEditingProspect(null);
          editForm.resetFields();
        }}
        footer={null}
        width={600}
        style={{ maxWidth: '95%', top: 20 }}
        bodyStyle={{ padding: '16px' }}
      >
        <Form
          form={editForm}
          layout="vertical"
          onFinish={handleEditProspect}
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
            name="status"
            label="Status"
            rules={[{ required: true, message: 'Please select a status' }]}
          >
            <Select placeholder="Select status">
              <Option value="new">New</Option>
              <Option value="meeting_scheduled">Meeting Scheduled</Option>
              <Option value="meeting_completed">Meeting Completed</Option>
              <Option value="suspended">Suspended</Option>
              <Option value="postponed">Postponed</Option>
              <Option value="canceled">Canceled</Option>
              <Option value="purchased">Purchased</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="reasonForContact"
            label="Reason for Contact"
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
              <Button type="primary" htmlType="submit" loading={updateProspectMutation.isPending}>
                Save Changes
              </Button>
              <Button onClick={() => {
                setEditModal(false);
                setEditingProspect(null);
                editForm.resetFields();
              }}>
                Cancel
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <ConvertProspectModal
        open={convertModal}
        prospect={prospectToConvert}
        onClose={() => {
          setConvertModal(false);
          setProspectToConvert(null);
        }}
      />
    </div>
  );
};