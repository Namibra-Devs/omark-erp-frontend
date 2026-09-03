// src/pages/marketing/ProspectsPage.tsx
import React, { useState, useEffect, useMemo } from 'react';
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
import { useBranchesQuery } from '@/api/branches';
import { filterEntitiesByBranch, tagPayloadWithBranch } from '@/utils/branchIsolation';
import { markSeen } from '@/mock/seenTracker';
import { PendingPhotoUpload, PhotoUpload } from '@/components/shared/PhotoUpload';
import { setPhoto } from '@/mock/photos';

const { Option } = Select;
const { TextArea } = Input;
const { Text } = Typography;

import dayjs from 'dayjs';
import { DatePicker } from 'antd';
import { SettingOutlined, TrophyOutlined, CalendarOutlined } from '@ant-design/icons';
import { awardBonusForEvent, useStaffBonuses } from '@/mock/bonusRules';
import { BonusRulesModal } from '@/components/bonus/BonusRulesModal';

export const ProspectsPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, hasRole } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [bonusModalOpen, setBonusModalOpen] = useState(false);
  const [form] = Form.useForm();
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<ProspectStatus | 'all'>('all');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'weekly' | 'monthly' | 'yearly' | 'custom'>('all');
  const [customDateRange, setCustomDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [editModal, setEditModal] = useState(false);
  const [editingProspect, setEditingProspect] = useState<Prospect | null>(null);
  const [convertModal, setConvertModal] = useState(false);
  const [prospectToConvert, setProspectToConvert] = useState<Prospect | null>(null);
  const [editForm] = Form.useForm();

  const { totalBonusGHS: userBonusTotal } = useStaffBonuses(user?.id);

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
  }, [searchText, statusFilter, assignedUserIdFilter, dateFilter, customDateRange]);

  // Opening this page clears the "new prospects" nav badge (see NavMenu.tsx).
  useEffect(() => {
    if (user?.id) markSeen('prospects', user.id);
  }, [user?.id, prospectsData]);

  const createProspectMutation = useCreateProspectMutation();
  const updateProspectMutation = useUpdateProspectMutation();
  const deleteProspectMutation = useDeleteProspectMutation();

  // Only admins can set assignedUserId at creation (per the API), and only
  // admins need to pick — marketing_staff creating their own prospects
  // should just self-assign, matching how the field is hidden for them below.
  const isAdmin = hasRole(['admin']);
  const { data: marketingStaffData } = useUsersQuery(isAdmin ? { role: 'marketing_staff' } : undefined);
  const marketingStaff = isAdmin ? (marketingStaffData?.items ?? []) : [];

  const { data: branches = [] } = useBranchesQuery();
  const rawProspectList: Prospect[] = prospectsData?.items ?? [];
  const prospectList: Prospect[] = filterEntitiesByBranch(rawProspectList, user, branches);

  // Date-wise filtering (Daily, Weekly, Monthly, Yearly, Custom)
  const filteredByDateList = useMemo(() => {
    if (dateFilter === 'all') return prospectList;
    const now = dayjs();
    return prospectList.filter((p) => {
      if (!p.createdAt) return true;
      const created = dayjs(p.createdAt);
      if (dateFilter === 'today') {
        return created.isSame(now, 'day');
      }
      if (dateFilter === 'weekly') {
        return created.isSame(now, 'week');
      }
      if (dateFilter === 'monthly') {
        return created.isSame(now, 'month');
      }
      if (dateFilter === 'yearly') {
        return created.isSame(now, 'year');
      }
      if (dateFilter === 'custom' && customDateRange && customDateRange[0] && customDateRange[1]) {
        return (
          (created.isAfter(customDateRange[0].startOf('day')) || created.isSame(customDateRange[0].startOf('day'))) &&
          (created.isBefore(customDateRange[1].endOf('day')) || created.isSame(customDateRange[1].endOf('day')))
        );
      }
      return true;
    });
  }, [prospectList, dateFilter, customDateRange]);

  const handleAddProspect = async (values: any) => {
    try {
      // `photo` isn't a real prospect field — POST /prospects would reject
      // it, so pull it out before spreading the rest into the payload.
      const { photo, ...prospectValues } = values;
      const newProspect = await createProspectMutation.mutateAsync(
        tagPayloadWithBranch(
          {
            ...prospectValues,
            source: 'marketing',
            assignedUserId: isAdmin ? values.assignedUserId : user?.id,
          },
          user
        )
      );
      // Photo upload has no real endpoint (see src/mock/photos.ts) —
      // applied locally once we have the prospect's real id back.
      if (photo && (newProspect as any)?.id) {
        setPhoto('prospect', (newProspect as any).id, photo);
      }

      // Automatically award bonus for prospect addition
      const bonusAward = awardBonusForEvent('prospect_added', user, {
        prospectName: `${values.firstName} ${values.lastName}`,
        prospectId: (newProspect as any)?.id,
      });

      setIsModalOpen(false);
      form.resetFields();

      if (bonusAward) {
        message.success(`Prospect added successfully! 🎉 You earned a GH₵${bonusAward.amountGHS.toFixed(2)} bonus!`);
      } else {
        message.success('Prospect added successfully!');
      }
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
          ...(hasRole(['admin'])
            ? [{
                label: 'Bonus Rules',
                onClick: () => setBonusModalOpen(true),
                icon: <SettingOutlined />,
              }]
            : userBonusTotal > 0
            ? [{
                label: `Earned Bonus: GH₵${userBonusTotal.toFixed(2)}`,
                onClick: () => navigate('/profile'),
                icon: <TrophyOutlined style={{ color: '#faad14' }} />,
              }]
            : []),
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

      {/* Filters (Search, Status, and Date-wise: Daily, Weekly, Monthly, Yearly, Custom) */}
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={[12, 12]} align="middle">
          <Col xs={24} sm={12} md={6}>
            <Input
              placeholder="Search prospects..."
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear
              size="middle"
            />
          </Col>
          <Col xs={24} sm={12} md={5}>
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
          <Col xs={24} sm={12} md={5}>
            <Select
              style={{ width: '100%' }}
              placeholder="Date Filter"
              value={dateFilter}
              onChange={(val) => {
                setDateFilter(val);
                if (val !== 'custom') setCustomDateRange(null);
              }}
              size="middle"
              prefix={<CalendarOutlined style={{ color: '#8c8c8c' }} />}
            >
              <Option value="all">📅 All Time</Option>
              <Option value="today">☀️ Daily (Today)</Option>
              <Option value="weekly">📆 Weekly (This Week)</Option>
              <Option value="monthly">🗓️ Monthly (This Month)</Option>
              <Option value="yearly">📊 Yearly (This Year)</Option>
              <Option value="custom">🎯 Custom Date Range</Option>
            </Select>
          </Col>
          {dateFilter === 'custom' && (
            <Col xs={24} sm={12} md={5}>
              <DatePicker.RangePicker
                style={{ width: '100%' }}
                value={customDateRange}
                onChange={(dates: any) => setCustomDateRange(dates)}
                format="YYYY-MM-DD"
              />
            </Col>
          )}
          <Col xs={24} sm={24} md={dateFilter === 'custom' ? 3 : 8}>
            <Text type="secondary" style={{ display: 'block', textAlign: 'right', fontWeight: 500 }}>
              Showing {filteredByDateList.length} of {prospectList.length} prospects
            </Text>
          </Col>
        </Row>
      </Card>

      {/* Table */}
      <div style={{ overflowX: 'auto', maxWidth: '100%' }}>
        <Table
          columns={columns}
          dataSource={filteredByDateList}
          rowKey="id"
          loading={isLoading}
          size="middle"
          scroll={{ x: 700 }}
          pagination={{
            current: page,
            pageSize,
            total: filteredByDateList.length,
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

      {/* Bonus Rules Configuration Modal (Admin only) */}
      <BonusRulesModal
        open={bonusModalOpen}
        onClose={() => setBonusModalOpen(false)}
      />

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
          <Form.Item name="photo" label="Photo" style={{ textAlign: 'center' }}>
            <PendingPhotoUpload size={72} />
          </Form.Item>

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
          {editingProspect && (
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <PhotoUpload entityType="prospect" entityId={editingProspect.id} size={72} />
            </div>
          )}

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