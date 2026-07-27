// src/pages/branches/BranchesPage.tsx
// ⚠️ PROTOTYPE — see src/mock/branches.ts. Branches are stored locally
// (localStorage via BranchContext), not on the backend.
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card, Table, Button, Space, Modal, Form, Input, message, Typography, Popconfirm, Tag, Tooltip,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, EnvironmentOutlined, PhoneOutlined, TeamOutlined, EyeOutlined } from '@ant-design/icons';
import { PageHeader } from '@/components/shared/PageHeader';
import { MockDataBanner } from '@/components/shared/MockDataBanner';
import { useBranchContext } from '@/contexts/BranchContext';
import { getBranchMetrics } from '@/mock/branches';
import type { Branch } from '@/mock/branches';

const { Text } = Typography;

export const BranchesPage: React.FC = () => {
  const navigate = useNavigate();
  const { branches, addBranch, updateBranch, deleteBranch } = useBranchContext();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [form] = Form.useForm();

  const openCreate = () => {
    setEditingBranch(null);
    form.resetFields();
    setModalOpen(true);
  };

  const openEdit = (branch: Branch) => {
    setEditingBranch(branch);
    form.setFieldsValue(branch);
    setModalOpen(true);
  };

  const handleSubmit = (values: any) => {
    if (editingBranch) {
      updateBranch(editingBranch.id, values);
      message.success('Branch updated');
    } else {
      addBranch(values);
      message.success('Branch created');
    }
    setModalOpen(false);
    form.resetFields();
  };

  const columns = [
    {
      title: 'Branch',
      key: 'name',
      render: (_: any, record: Branch) => (
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
      dataIndex: 'managerName',
      key: 'managerName',
    },
    {
      title: 'Phone',
      dataIndex: 'phone',
      key: 'phone',
      render: (phone: string) => <a href={`tel:${phone}`}><PhoneOutlined /> {phone}</a>,
    },
    {
      title: 'Staff',
      dataIndex: 'staffCount',
      key: 'staffCount',
      render: (count: number) => <Tag icon={<TeamOutlined />}>{count}</Tag>,
    },
    {
      title: 'This Month (sample)',
      key: 'metrics',
      render: (_: any, record: Branch) => {
        const m = getBranchMetrics(record.id);
        return (
          <Tooltip title="Sample data — see the branch dashboard for details">
            <Tag color="gold">{m.salesThisMonth} sales</Tag>
          </Tooltip>
        );
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: Branch) => (
        <Space>
          <Tooltip title="View Dashboard">
            <Button type="text" icon={<EyeOutlined />} onClick={() => navigate(`/branches/${record.id}`)} />
          </Tooltip>
          <Tooltip title="Edit">
            <Button type="text" icon={<EditOutlined />} onClick={() => openEdit(record)} />
          </Tooltip>
          <Popconfirm
            title="Delete Branch"
            description="This only removes it from this local prototype, not any real system."
            onConfirm={() => { deleteBranch(record.id); message.success('Branch deleted'); }}
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

      <MockDataBanner
        message="Preview — branches are stored locally, not on the backend"
        description="This management screen works end-to-end for demo purposes (create/edit/delete persist to this browser only), but no real branch data model exists on the API yet. Nothing here is synced to any server."
      />

      <Card>
        <Table columns={columns} dataSource={branches} rowKey="id" pagination={false} />
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
            <Input placeholder="e.g. Sunyani Branch" />
          </Form.Item>
          <Form.Item name="location" label="Location" rules={[{ required: true, message: 'Location is required' }]}>
            <Input placeholder="e.g. Central Market, Sunyani" />
          </Form.Item>
          <Form.Item name="managerName" label="Branch Manager" rules={[{ required: true, message: 'Manager name is required' }]}>
            <Input placeholder="e.g. Kwame Owusu" />
          </Form.Item>
          <Form.Item name="phone" label="Phone Number" rules={[{ required: true, message: 'Phone number is required' }]}>
            <Input placeholder="+233 XX XXX XXXX" />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">{editingBranch ? 'Save Changes' : 'Create Branch'}</Button>
              <Button onClick={() => { setModalOpen(false); form.resetFields(); }}>Cancel</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
