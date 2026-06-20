// src/pages/dashboard/admin/components/EditUserDrawer.tsx
import React, { useEffect } from 'react';
import { Drawer, Form, Input, Select, Space, Button, Typography } from 'antd';
import { PhoneInput } from '@/components/shared/PhoneInput';
import type { User } from '../types';

const { Option } = Select;
const { Text } = Typography;

interface EditUserDrawerProps {
  open: boolean;
  user: User | null;
  onClose: () => void;
  onEdit: (values: any) => void;
  loading?: boolean;
}

export const EditUserDrawer: React.FC<EditUserDrawerProps> = ({
  open,
  user,
  onClose,
  onEdit,
  loading,
}) => {
  const [form] = Form.useForm();

  useEffect(() => {
    if (user && open) {
      form.setFieldsValue({
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        status: user.status,
        department: user.department,
      });
    }
  }, [user, open, form]);

  const handleSubmit = (values: any) => {
    onEdit(values);
  };

  return (
    <Drawer
      title={
        <div>
          <Text strong>Edit User</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 12 }}>
            {user?.email}
          </Text>
        </div>
      }
      open={open}
      onClose={onClose}
      width={500}
    >
      {user && (
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Form.Item
            name="name"
            label="Full Name"
            rules={[{ required: true, message: 'Please enter name' }]}
          >
            <Input />
          </Form.Item>

          <Form.Item
            name="email"
            label="Email"
            rules={[
              { required: true, message: 'Please enter email' },
              { type: 'email', message: 'Please enter a valid email' }
            ]}
          >
            <Input />
          </Form.Item>

          <Form.Item
            name="phone"
            label="Phone"
          >
            <PhoneInput />
          </Form.Item>

          <Form.Item
            name="role"
            label="Role"
            rules={[{ required: true, message: 'Please select a role' }]}
          >
            <Select>
              <Option value="admin">Administrator</Option>
              <Option value="marketing_staff">Marketing Staff</Option>
              <Option value="marketing_director">Marketing Director</Option>
              <Option value="customer_service">Customer Service</Option>
              <Option value="secretary">Secretary</Option>
              <Option value="accounts">Accounts</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="department"
            label="Department"
          >
            <Input />
          </Form.Item>

          <Form.Item
            name="status"
            label="Status"
          >
            <Select>
              <Option value="active">Active</Option>
              <Option value="inactive">Inactive</Option>
              <Option value="suspended">Suspended</Option>
            </Select>
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={loading}>
                Update User
              </Button>
              <Button onClick={onClose}>
                Cancel
              </Button>
            </Space>
          </Form.Item>
        </Form>
      )}
    </Drawer>
  );
};