// src/pages/marketing/ProspectsPage.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button, Space, Modal, Form, Input, Select, Row, Col, Table, Tag, message, Typography, Card, Spin, Popconfirm, Tooltip, Alert } from 'antd';
import { PlusOutlined, EyeOutlined, SearchOutlined, EditOutlined, DeleteOutlined, DollarOutlined, CloseOutlined } from '@ant-design/icons';
import { useAuth } from '@/contexts/AuthContext';
import { StatusTag } from '@/components/shared/StatusTag';
import { PhoneInput } from '@/components/shared/PhoneInput';
import { PageHeader } from '@/components/shared/PageHeader';
import { ConvertProspectModal } from '@/components/shared/ConvertProspectModal';
import { prospectStatusLabels } from '@/constants/enums';
import type { Prospect, ProspectStatus } from '@/types';
import { useProspectsQuery, useCreateProspectMutation, useUpdateProspectMutation, useDeleteProspectMutation } from '@/api/prospects';
import { useUsersQuery } from '@/api/users';

const { Option } = Select;
const { TextArea } = Input;
const { Text } = Typography;

export const ProspectsPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, hasRole } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form] = Form.useForm();
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<ProspectStatus | 'all'>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [editModal, setEditModal] = useState(false);
  const [editingProspect, setEditingProspect] = useState<Prospect | null>(null);
  const [convertModal, setConvertModal] = useState(false);
  const [prospectToConvert, setProspectToConvert] = useState<Prospect | null>(null);
  const [editForm] = Form.useForm();

  // Drill-down from the Director Overview's per-marketer table ("View
  // Prospects") lands here with these params — apply them as a filter
  // instead of silently showing everyone's prospects.
  const assignedUserIdFilter = searchParams.get('assignedUserId') || undefined;
  const assignedUserName = searchParams.get('name') || undefined;

  const clearAssignedFilter = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('assignedUserId');
    next.delete('name');
    setSearchParams(next);
  };

  // React Query hooks — page/pageSize are sent to the server (not just
  // applied client-side) so lists longer than one page actually paginate
  // instead of silently capping at whatever the server's default page returns.
  const { data: prospectsData, isLoading, refetch } = useProspectsQuery({
    source: 'marketing',
    status: statusFilter === 'all' ? undefined : statusFilter,
    q: searchText || undefined,
    assignedUserId: assignedUserIdFilter,
    page,
    pageSize,
  });

  // Reset to page 1 whenever a filter changes, so a new, smaller result set
  // doesn't strand the user on a page that no longer exists.
  useEffect(() => {
    setPage(1);
  }, [searchText, statusFilter, assignedUserIdFilter]);

  const createProspectMutation = useCreateProspectMutation();
  const updateProspectMutation = useUpdateProspectMutation();
  const deleteProspectMutation = useDeleteProspectMutation();

  // Only admins can set assignedUserId at creation (per the API), and only
  // admins need to pick — marketing_staff creating their own prospects
  // should just self-assign, matching how the field is hidden for them below.
  const isAdmin = hasRole(['admin']);
  const { data: marketingStaffData } = useUsersQuery(isAdmin ? { role: 'marketing_staff' } : undefined);
  const marketingStaff = isAdmin ? (marketingStaffData?.items ?? []) : [];

  const prospectList: Prospect[] = prospectsData?.items ?? [];

  const handleAddProspect = async (values: any) => {
    try {
      await createProspectMutation.mutateAsync({
        ...values,
        source: 'marketing',
        // Admins explicitly choose the marketer via the form below. Anyone
        // else creating their own prospect self-assigns — leaving this as
        // the logged-in user's id, as before.
        assignedUserId: isAdmin ? values.assignedUserId : user?.id,
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
          // POST /prospects is only granted to admin/marketing_staff/customer_service
          // on the backend — marketing_director can view this page but can't create,
          // so the button is hidden rather than showing an action that always 403s.
          ...(hasRole(['admin', 'marketing_staff'])
            ? [{
                label: 'Add Prospect',
                onClick: () => setIsModalOpen(true),
                icon: <PlusOutlined />,
              }]
            : []),
        ]}
      />

      {assignedUserIdFilter && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message={`Showing prospects assigned to ${assignedUserName || 'this marketer'}`}
          action={
            <Button size="small" type="text" icon={<CloseOutlined />} onClick={clearAssignedFilter}>
              Clear
            </Button>
          }
        />
      )}

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
              Total: {prospectsData?.total ?? 0} prospects
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
            current: page,
            pageSize,
            total: prospectsData?.total ?? 0,
            showSizeChanger: true,
            showTotal: (total) => `Total ${total} prospects`,
            responsive: true,
            onChange: (nextPage, nextPageSize) => {
              setPage(nextPage);
              setPageSize(nextPageSize);
            },
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

          {isAdmin && (
            <Form.Item
              name="assignedUserId"
              label="Assign To Marketer"
              rules={[{ required: true, message: 'Please choose which marketer this prospect belongs to' }]}
              extra="This can't be changed later — the API only accepts assignment at creation."
            >
              <Select placeholder="Select marketer" showSearch optionFilterProp="children">
                {marketingStaff.map((staff) => (
                  <Option key={staff.id} value={staff.id}>
                    {staff.firstName} {staff.lastName} ({staff.email})
                  </Option>
                ))}
              </Select>
            </Form.Item>
          )}

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