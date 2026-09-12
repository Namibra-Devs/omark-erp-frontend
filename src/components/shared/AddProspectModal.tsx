// src/components/shared/AddProspectModal.tsx
import React, { useState } from 'react';
import { Modal, Form, Input, Select, Row, Col, Button, Space, message, Typography } from 'antd';
import { UserAddOutlined, PlusOutlined } from '@ant-design/icons';
import { useAuth } from '@/contexts/AuthContext';
import { PhoneInput } from '@/components/shared/PhoneInput';
import { PendingPhotoUpload } from '@/components/shared/PhotoUpload';
import { useCreateProspectMutation } from '@/api/prospects';
import { useUsersQuery } from '@/api/users';
import { tagPayloadWithBranch } from '@/utils/branchIsolation';
import { tokens } from '@/constants/tokens';
import type { ProspectSource } from '@/types';

const { Option } = Select;
const { TextArea } = Input;
const { Text } = Typography;

export interface AddProspectModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: (newProspect: any) => void;
  defaultSource?: ProspectSource;
}

export const AddProspectModal: React.FC<AddProspectModalProps> = ({
  open,
  onClose,
  onSuccess,
  defaultSource = 'customer_service',
}) => {
  const { user, hasRole } = useAuth();
  const isAdmin = hasRole(['admin', 'branch_manager']);
  const [form] = Form.useForm();
  const createProspect = useCreateProspectMutation();

  const { data: usersData } = useUsersQuery();
  const allUsers = usersData?.items ?? [];
  const activeStaff = allUsers.filter((u) => u.isActive);

  const handleFinish = async (values: any) => {
    try {
      const { photo, ...prospectValues } = values;
      const payload = {
        ...prospectValues,
        source: values.source || defaultSource,
        assignedUserId: isAdmin && values.assignedUserId ? values.assignedUserId : user?.id,
      };

      const taggedPayload = tagPayloadWithBranch(payload, user);
      const newProspect = await createProspect.mutateAsync(taggedPayload);
      message.success('Prospect added successfully!');
      form.resetFields();
      onClose();
      onSuccess?.(newProspect);
    } catch (err: any) {
      message.error(err?.error?.message || err?.message || 'Failed to add prospect');
    }
  };

  return (
    <Modal
      title={
        <Space>
          <UserAddOutlined style={{ color: tokens.primary }} />
          <Text strong>Add New Prospect</Text>
        </Space>
      }
      open={open}
      onCancel={() => {
        form.resetFields();
        onClose();
      }}
      footer={null}
      width={600}
      style={{ maxWidth: '95%', top: 20 }}
      destroyOnClose
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleFinish}
        initialValues={{
          source: defaultSource,
          reasonForContact: 'Client inquiry / property interest',
        }}
      >
        <Row gutter={[16, 0]}>
          <Col xs={24} sm={12}>
            <Form.Item
              name="firstName"
              label="First Name"
              rules={[{ required: true, message: 'First name is required' }]}
            >
              <Input placeholder="First name" />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item
              name="lastName"
              label="Last Name"
              rules={[{ required: true, message: 'Last name is required' }]}
            >
              <Input placeholder="Last name" />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item
          name="phoneNumber"
          label="Phone Number"
          rules={[{ required: true, message: 'Phone number is required' }]}
        >
          <PhoneInput />
        </Form.Item>

        <Form.Item
          name="address"
          label="Address / Location"
          rules={[{ required: true, message: 'Address is required' }]}
        >
          <Input placeholder="e.g. Accra, East Legon, Spintex" />
        </Form.Item>

        <Row gutter={[16, 0]}>
          <Col xs={24} sm={12}>
            <Form.Item name="source" label="Prospect Source" rules={[{ required: true }]}>
              <Select>
                <Option value="customer_service">Customer Service / Front Desk</Option>
                <Option value="marketing">Marketing / Sales Outreach</Option>
              </Select>
            </Form.Item>
          </Col>
          {isAdmin && (
            <Col xs={24} sm={12}>
              <Form.Item name="assignedUserId" label="Assign To Staff">
                <Select placeholder="Select staff member" showSearch optionFilterProp="children" allowClear>
                  {activeStaff.map((staff) => (
                    <Option key={staff.id} value={staff.id}>
                      {staff.firstName} {staff.lastName} ({staff.role})
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          )}
        </Row>

        <Form.Item
          name="reasonForContact"
          label="Reason for Contact / Interest"
          rules={[{ required: true, message: 'Please describe the reason for contact' }]}
        >
          <TextArea rows={2} placeholder="e.g. Inquired about land plots in Prampram, interested in installment plan" />
        </Form.Item>

        <Form.Item name="notes" label="Additional Notes (Optional)">
          <TextArea rows={2} placeholder="Any extra information regarding client preferences, budget, or timeline" />
        </Form.Item>

        <Form.Item style={{ marginBottom: 0, textAlign: 'right', marginTop: 16 }}>
          <Space>
            <Button onClick={() => { form.resetFields(); onClose(); }}>Cancel</Button>
            <Button type="primary" htmlType="submit" loading={createProspect.isPending} icon={<PlusOutlined />}>
              Add Prospect
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </Modal>
  );
};
