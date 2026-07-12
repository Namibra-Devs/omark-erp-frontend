// src/pages/dashboard/admin/components/EditUserDrawer.tsx
import React, { useEffect } from 'react';
import { Drawer, Form, Input, Select, Space, Button, Typography, message } from 'antd';
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
      // Map user data to form fields
      const formValues = {
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        name: user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim(),
        email: user.email || '',
        phone: user.phone || '',
        phoneNumber: user.phone || '',
        role: user.role || '',
        status: user.status || 'active',
        department: user.department || '',
        isActive: user.status === 'active',
      };
      
      console.log('📝 Setting form values:', formValues);
      form.setFieldsValue(formValues);
    }
  }, [user, open, form]);

  const handleSubmit = (values: any) => {
    console.log('📤 Edit form submitted:', values);
    
    // Build the payload with proper field mapping
    const payload: any = {};
    
    // Handle name
    if (values.name) {
      const nameParts = values.name.trim().split(' ');
      payload.firstName = nameParts[0] || '';
      payload.lastName = nameParts.slice(1).join(' ') || '';
    } else {
      // Use individual fields if name is not provided
      if (values.firstName) payload.firstName = values.firstName;
      if (values.lastName) payload.lastName = values.lastName;
    }
    
    // Email
    if (values.email) payload.email = values.email;
    
    // Phone - handle both field names
    if (values.phoneNumber) payload.phoneNumber = values.phoneNumber;
    else if (values.phone) payload.phoneNumber = values.phone;
    
    // Role
    if (values.role) payload.role = values.role;

    // Status - convert to isActive boolean
    if (values.status) {
      payload.isActive = values.status === 'active';
    } else if (values.isActive !== undefined) {
      payload.isActive = values.isActive;
    }

    console.log('📤 Sending payload:', payload);
    
    // Validate required fields
    if (!payload.firstName || !payload.lastName) {
      message.error('Full name is required');
      return;
    }
    
    if (!payload.email) {
      message.error('Email is required');
      return;
    }
    
    onEdit(payload);
  };

  const handleClose = () => {
    form.resetFields();
    onClose();
  };

  return (
    <Drawer
      title={
        <div>
          <Text strong>Edit User</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 12 }}>
            {user?.email || 'User Details'}
          </Text>
        </div>
      }
      open={open}
      onClose={handleClose}
      width={500}
      destroyOnClose
    >
      {user && (
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{
            status: 'active',
          }}
        >
          <Form.Item
            name="name"
            label="Full Name"
            rules={[{ required: true, message: 'Please enter full name' }]}
          >
            <Input placeholder="Enter full name" />
          </Form.Item>

          <Form.Item
            name="email"
            label="Email"
            rules={[
              { required: true, message: 'Please enter email' },
              { type: 'email', message: 'Please enter a valid email' }
            ]}
          >
            <Input placeholder="Enter email address" />
          </Form.Item>

          <Form.Item
            name="phone"
            label="Phone Number"
            rules={[{ required: true, message: 'Please enter phone number' }]}
          >
            <PhoneInput placeholder="Enter phone number" />
          </Form.Item>

          <Form.Item
            name="role"
            label="Role"
            rules={[{ required: true, message: 'Please select a role' }]}
          >
            <Select placeholder="Select role">
              <Option value="admin">Administrator</Option>
              <Option value="marketing_director">Marketing Director</Option>
              <Option value="marketing_staff">Marketing Staff</Option>
              <Option value="customer_service">Customer Service</Option>
              <Option value="secretary">Secretary</Option>
              <Option value="accounts">Accounts</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="status"
            label="Status"
            rules={[{ required: true, message: 'Please select a status' }]}
          >
            <Select placeholder="Select status">
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
              <Button onClick={handleClose}>
                Cancel
              </Button>
            </Space>
          </Form.Item>
        </Form>
      )}
    </Drawer>
  );
};