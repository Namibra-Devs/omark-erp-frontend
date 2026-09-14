import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card, Table, Button, Space, Modal, Form, Input, Select, message, Typography, Popconfirm, Tag, Tooltip,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, EnvironmentOutlined, PhoneOutlined, TeamOutlined, EyeOutlined } from '@ant-design/icons';
import { PageHeader } from '@/components/shared/PageHeader';
import { tokens } from '@/constants/tokens';
import { useBranchContext } from '@/contexts/BranchContext';
import type { BranchEntity } from '@/api/branches';
import { useUsersQuery, getUserPhone, useUpdateUserAssignmentMutation } from '@/api/users';
import { roleLabels } from '@/constants/enums';
import {
  useAssignmentListener,
  enrichUserWithAssignment,
  isUserInBranch,
  setStoredBranchStaff,
  addStaffToBranchRoster,
  setStoredUserAssignment,
} from '@/utils/userAssignmentStorage';
import { recordEntityBranch } from '@/utils/branchIsolation';

const { Text } = Typography;

export const BranchesPage: React.FC = () => {
  const navigate = useNavigate();
  const { branches, isLoading: branchesLoading, addBranch, updateBranch, deleteBranch } = useBranchContext();
  const { data: usersData, isLoading: usersLoading } = useUsersQuery();
  const updateAssignmentMutation = useUpdateUserAssignmentMutation();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<BranchEntity | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();
  const tick = useAssignmentListener();

  const users = useMemo(() => {
    return (usersData?.items ?? []).map((u: any) =>
      enrichUserWithAssignment(
        {
          ...u,
          phoneNumber: getUserPhone(u),
        },
        branches
      )
    );
  }, [usersData, branches, tick]);

  // Helper to get assigned staff for a branch
  const getBranchStaff = (branch: BranchEntity | string) => {
    const branchObj = typeof branch === 'string' ? branches.find((b) => b.id === branch) || { id: branch } : branch;
    return users.filter((u: any) => isUserInBranch(u, branchObj));
  };

  // Helper to get branch manager
  const getBranchManagerName = (branch: BranchEntity) => {
    if (branch.managerInfo) {
      return `${branch.managerInfo.firstName} ${branch.managerInfo.lastName}`;
    }
    if (branch.managerUserId) {
      const mgr = users.find((u: any) => u.id === branch.managerUserId);
      if (mgr) return `${mgr.firstName} ${mgr.lastName}`;
    }
    const staff = getBranchStaff(branch);
    const mgr = staff.find((u: any) => u.role === 'branch_manager') ||
                staff.find((u: any) => u.role === 'marketing_director' || u.role === 'admin' || u.role === 'secretary') ||
                staff[0];
    return mgr ? `${mgr.firstName} ${mgr.lastName}` : 'Unassigned Manager';
  };

  const sortedUsersForManager = useMemo(() => {
    return [...users].sort((a: any, b: any) => {
      if (a.role === 'branch_manager' && b.role !== 'branch_manager') return -1;
      if (a.role !== 'branch_manager' && b.role === 'branch_manager') return 1;
      return (a.firstName || '').localeCompare(b.firstName || '');
    });
  }, [users]);

  const openCreate = () => {
    setEditingBranch(null);
    form.resetFields();
    setModalOpen(true);
  };

  const openEdit = (branch: BranchEntity) => {
    setEditingBranch(branch);
    const currentStaff = getBranchStaff(branch).map((u: any) => u.id);
    form.setFieldsValue({
      name: branch.name,
      branchCode: branch.branchCode,
      location: branch.location,
      phone: branch.phone,
      managerUserId: branch.managerUserId,
      staffUserIds: currentStaff,
    });
    setModalOpen(true);
  };

  const handleSubmit = async (values: any) => {
    setSubmitting(true);
    try {
      if (editingBranch) {
        await updateBranch(editingBranch.id, values);
        const branchId = editingBranch.id;
        const branchName = values.name || editingBranch.name;

        if (values.staffUserIds) {
          setStoredBranchStaff(branchId, values.staffUserIds, branchName);
        }

        if (values.managerUserId) {
          addStaffToBranchRoster(branchId, values.managerUserId, branchName);
          setStoredUserAssignment(values.managerUserId, {
            branchId,
            branchName,
            departmentId: 'dept-ops',
          });
          recordEntityBranch('staff', values.managerUserId, branchId);
          try {
            await updateAssignmentMutation.mutateAsync({
              userId: values.managerUserId,
              payload: { branchId, branchName, departmentId: 'dept-ops' },
            });
          } catch {
            // Local assignment already persisted
          }
        }
        message.success('Branch and staff assignments updated successfully');
      } else {
        const newBranch = await addBranch(values);
        const branchId = (newBranch as any)?.id || `branch-${Date.now()}`;
        const branchName = values.name;

        if (values.staffUserIds) {
          setStoredBranchStaff(branchId, values.staffUserIds, branchName);
        }

        if (values.managerUserId) {
          addStaffToBranchRoster(branchId, values.managerUserId, branchName);
          setStoredUserAssignment(values.managerUserId, {
            branchId,
            branchName,
            departmentId: 'dept-ops',
          });
          recordEntityBranch('staff', values.managerUserId, branchId);
          try {
            await updateAssignmentMutation.mutateAsync({
              userId: values.managerUserId,
              payload: { branchId, branchName, departmentId: 'dept-ops' },
            });
          } catch {
            // Local assignment already persisted
          }
        }
        message.success('Branch created and staff attached successfully');
      }
      setModalOpen(false);
      form.resetFields();
    } catch (err: any) {
      message.error(err?.error?.message || err?.message || 'Action failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteBranch(id);
      message.success('Branch deleted successfully');
    } catch (err: any) {
      message.error(err?.error?.message || err?.message || 'Delete failed');
    }
  };

  const columns = [
    {
      title: 'Branch Code',
      dataIndex: 'branchCode',
      key: 'branchCode',
      width: 110,
      render: (code: string) => <Tag color="blue">{code}</Tag>,
    },
    {
      title: 'Branch Name',
      key: 'name',
      width: 240,
      render: (_: any, record: BranchEntity) => (
        <div style={{ cursor: 'pointer' }} onClick={() => navigate(`/branches/${record.id}`)}>
          <Text strong style={{ color: tokens.primary, fontSize: 14 }}>{record.name}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 12 }}>
            <EnvironmentOutlined /> {record.location}
          </Text>
        </div>
      ),
    },
    {
      title: 'Manager',
      key: 'manager',
      width: 180,
      render: (_: any, record: BranchEntity) => {
        const mgrName = getBranchManagerName(record);
        const isAssigned = mgrName !== 'Unassigned Manager';
        return (
          <Tag color={isAssigned ? 'purple' : 'default'} style={{ borderRadius: 12, padding: '2px 10px', fontWeight: 500 }}>
            {mgrName}
          </Tag>
        );
      },
    },
    {
      title: 'Phone',
      dataIndex: 'phone',
      key: 'phone',
      width: 150,
      render: (phone?: string) => phone ? <a href={`tel:${phone}`} style={{ fontSize: 12 }}><PhoneOutlined /> {phone}</a> : 'N/A',
    },
    {
      title: 'Staff Count',
      key: 'staffCount',
      width: 120,
      align: 'center' as const,
      render: (_: any, record: BranchEntity) => {
        const count = getBranchStaff(record).length;
        return <Tag icon={<TeamOutlined />} color={count > 0 ? 'green' : 'gold'}>{count} Staff</Tag>;
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 150,
      align: 'center' as const,
      render: (_: any, record: BranchEntity) => (
        <Space>
          <Tooltip title="Open Branch Dashboard">
            <Button type="primary" size="small" icon={<EyeOutlined />} style={{ backgroundColor: tokens.primary }} onClick={() => navigate(`/branches/${record.id}`)}>
              Open
            </Button>
          </Tooltip>
          <Tooltip title="Edit Branch">
            <Button type="text" icon={<EditOutlined />} onClick={() => openEdit(record)} />
          </Tooltip>
          <Popconfirm
            title="Delete Branch"
            description="Are you sure you want to delete this branch?"
            onConfirm={() => handleDelete(record.id)}
            okText="Yes"
            cancelText="No"
          >
            <Tooltip title="Delete">
              <Button type="text" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Branches"
        actions={[{ label: 'Add Branch', onClick: openCreate, icon: <PlusOutlined /> }]}
      />

      <Card>
        <Table columns={columns} dataSource={branches} rowKey="id" loading={branchesLoading || usersLoading} pagination={false} />
      </Card>

      <Modal
        title={editingBranch ? 'Edit Branch' : 'Add Branch'}
        open={modalOpen}
        onCancel={() => { setModalOpen(false); form.resetFields(); }}
        footer={null}
        width={560}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="name" label="Branch Name" rules={[{ required: true, message: 'Branch name is required' }]}>
            <Input placeholder="e.g. Kumasi Main" />
          </Form.Item>
          <Form.Item name="branchCode" label="Branch Prefix / Code" rules={[{ required: true, message: 'Branch code is required' }]}>
            <Input placeholder="e.g. KMA" disabled={Boolean(editingBranch)} />
          </Form.Item>
          <Form.Item name="location" label="Location" rules={[{ required: true, message: 'Location is required' }]}>
            <Input placeholder="e.g. Central Market, Kumasi" />
          </Form.Item>
          <Form.Item name="phone" label="Phone Number">
            <Input placeholder="+233 XX XXX XXXX" />
          </Form.Item>
          <Form.Item name="managerUserId" label="Branch Manager">
            <Select
              placeholder="Select branch manager (optional)"
              allowClear
              showSearch
              optionFilterProp="children"
            >
              {sortedUsersForManager.map((u: any) => {
                const isManagerRole = u.role === 'branch_manager';
                const roleLabel = roleLabels[u.role as keyof typeof roleLabels] || (u.role ? u.role.replace('_', ' ') : 'Staff');
                return (
                  <Select.Option key={u.id} value={u.id}>
                    {isManagerRole ? '🏛️ ' : '👤 '}
                    {u.firstName} {u.lastName} — {roleLabel}
                  </Select.Option>
                );
              })}
            </Select>
          </Form.Item>
          <Form.Item
            name="staffUserIds"
            label="Assigned Branch Staff"
            extra="Select staff members to attach to this branch. Their branch badge in User Management will immediately update."
          >
            <Select
              mode="multiple"
              placeholder="Select staff members to attach to this branch"
              allowClear
              showSearch
              optionFilterProp="children"
              style={{ width: '100%' }}
            >
              {users.map((u: any) => {
                const roleLabel = roleLabels[u.role as keyof typeof roleLabels] || (u.role ? u.role.replace('_', ' ') : 'Staff');
                return (
                  <Select.Option key={u.id} value={u.id}>
                    👤 {u.firstName} {u.lastName} — {roleLabel} {u.branchName ? `(${u.branchName})` : ''}
                  </Select.Option>
                );
              })}
            </Select>
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={submitting}>{editingBranch ? 'Save Changes' : 'Create Branch'}</Button>
              <Button onClick={() => { setModalOpen(false); form.resetFields(); }}>Cancel</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
