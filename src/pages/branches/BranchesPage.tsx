// src/pages/branches/BranchesPage.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card, Table, Button, Space, Modal, Form, Input, message, Typography, Popconfirm, Tag, Tooltip,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, EnvironmentOutlined, PhoneOutlined, TeamOutlined, EyeOutlined } from '@ant-design/icons';
import { PageHeader } from '@/components/shared/PageHeader';
import { useBranchContext } from '@/contexts/BranchContext';
import type { BranchEntity } from '@/api/branches';

const { Text } = Typography;

export const BranchesPage: React.FC = () => {
  const navigate = useNavigate();
  const { branches, isLoading, addBranch, updateBranch, deleteBranch } = useBranchContext();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<BranchEntity | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();

  const openCreate = () => {
    setEditingBranch(null);
    form.resetFields();
    setModalOpen(true);
  };

  const openEdit = (branch: BranchEntity) => {
    setEditingBranch(branch);
    form.setFieldsValue({
      name: branch.name,
      branchCode: branch.branchCode,
      location: branch.location,
      phone: branch.phone,
      managerUserId: branch.managerUserId,
    });
    setModalOpen(true);
  };

  const handleSubmit = async (values: any) => {
    setSubmitting(true);
    try {
      if (editingBranch) {
        await updateBranch(editingBranch.id, values);
        message.success('Branch updated successfully');
      } else {
        await addBranch(values);
        message.success('Branch created successfully');
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
      render: (code: string) => <Tag color="blue">{code}</Tag>,
    },
    {
      title: 'Branch Name',
      key: 'name',
      render: (_: any, record: BranchEntity) => (
        <div>
          <Text strong>{record.name}</Text>
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
      render: (_: any, record: BranchEntity) => (
        record.managerInfo ? `${record.managerInfo.firstName} ${record.managerInfo.lastName}` : (record.managerUserId || 'N/A')
      ),
    },
    {
      title: 'Phone',
      dataIndex: 'phone',
      key: 'phone',
      render: (phone?: string) => phone ? <a href={`tel:${phone}`}><PhoneOutlined /> {phone}</a> : 'N/A',
    },
    {
      title: 'Staff Count',
      dataIndex: 'staffCount',
      key: 'staffCount',
      render: (count?: number) => <Tag icon={<TeamOutlined />}>{count ?? 0}</Tag>,
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: BranchEntity) => (
        <Space>
          <Tooltip title="View Dashboard">
            <Button type="text" icon={<EyeOutlined />} onClick={() => navigate(`/branches/${record.id}`)} />
          </Tooltip>
          <Tooltip title="Edit">
            <Button type="text" icon={<EditOutlined />} onClick={() => openEdit(record)} />
          </Tooltip>
          <Popconfirm
            title="Delete Branch"
            description="Are you sure you want to delete or deactivate this branch?"
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
        <Table columns={columns} dataSource={branches} rowKey="id" loading={isLoading} pagination={false} />
      </Card>

      <Modal
        title={editingBranch ? 'Edit Branch' : 'Add Branch'}
        open={modalOpen}
        onCancel={() => { setModalOpen(false); form.resetFields(); }}
        footer={null}
        width={520}
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
