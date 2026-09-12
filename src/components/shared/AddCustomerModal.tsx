// src/components/shared/AddCustomerModal.tsx
import React, { useState } from 'react';
import {
  Modal, Form, Input, Select, Row, Col, Button, Space, message,
  InputNumber, DatePicker, Typography, Alert,
} from 'antd';
import { UserAddOutlined, PlusOutlined, HomeOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useAuth } from '@/contexts/AuthContext';
import { PhoneInput } from '@/components/shared/PhoneInput';
import { useCreateCustomerMutation } from '@/api/customers';
import { usePropertiesQuery } from '@/api/properties';
import { tagPayloadWithBranch } from '@/utils/branchIsolation';
import { tokens } from '@/constants/tokens';

const { Option } = Select;
const { Text } = Typography;

export interface AddCustomerModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: (customerId: string) => void;
}

export const AddCustomerModal: React.FC<AddCustomerModalProps> = ({
  open,
  onClose,
  onSuccess,
}) => {
  const { user } = useAuth();
  const [form] = Form.useForm();
  const createCustomer = useCreateCustomerMutation();
  const { data: propertiesData, isLoading: propertiesLoading } = usePropertiesQuery({ pageSize: 100 });
  const properties = propertiesData?.items ?? [];

  const handleFinish = async (values: any) => {
    try {
      const customerData: any = {
        firstName: values.firstName,
        lastName: values.lastName,
        phoneNumber: values.phoneNumber,
        address: values.address,
        type: values.type,
        propertyId: values.propertyId,
      };

      if (values.type === 'payment_plan' && values.totalAmount > 0) {
        const totalAmountMinor = Math.round(Number(values.totalAmount) * 100);
        const downPaymentMinor = Math.round(Number(values.downPayment || 0) * 100);
        const remainingMinor = totalAmountMinor - downPaymentMinor;
        const planBasis = values.planBasis || 'months';

        let numMonths = 12;
        let monthlyAmountMinor = Math.round(remainingMinor / 12);

        if (planBasis === 'months') {
          numMonths = Number(values.numMonths) || 12;
          monthlyAmountMinor = Math.round(remainingMinor / numMonths);
        } else {
          monthlyAmountMinor = Math.round(Number(values.monthlyAmount || 0) * 100);
          numMonths = monthlyAmountMinor > 0 ? Math.ceil(remainingMinor / monthlyAmountMinor) : 12;
        }

        customerData.createPlan = {
          totalAmountMinor,
          downPaymentMinor,
          planBasis,
          numMonths: planBasis === 'months' ? numMonths : undefined,
          monthlyAmountMinor: planBasis === 'monthly' ? monthlyAmountMinor : undefined,
          startDate: values.startDate ? values.startDate.format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD'),
        };
      }

      const taggedPayload = tagPayloadWithBranch(customerData, user);
      const newCustomer = await createCustomer.mutateAsync(taggedPayload);
      message.success(`Customer ${values.firstName} ${values.lastName} added successfully!`);
      form.resetFields();
      onClose();
      onSuccess?.(newCustomer.id);
    } catch (err: any) {
      message.error(err?.error?.message || err?.message || 'Failed to add customer');
    }
  };

  return (
    <Modal
      title={
        <Space>
          <UserAddOutlined style={{ color: tokens.primary }} />
          <Text strong>Add New Customer</Text>
        </Space>
      }
      open={open}
      onCancel={() => {
        form.resetFields();
        onClose();
      }}
      footer={null}
      width={640}
      style={{ maxWidth: '95%', top: 20 }}
      destroyOnClose
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleFinish}
        initialValues={{
          type: 'payment_plan',
          planBasis: 'months',
          numMonths: 12,
          startDate: dayjs(),
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
          label="Address / Residential Location"
          rules={[{ required: true, message: 'Address is required' }]}
        >
          <Input placeholder="Full residential or postal address" />
        </Form.Item>

        <Form.Item
          name="propertyId"
          label={<span><HomeOutlined style={{ marginRight: 6 }} />Associated Property / Plot</span>}
          rules={[{ required: true, message: 'Please select a property' }]}
        >
          <Select
            placeholder="Select property"
            showSearch
            optionFilterProp="children"
            loading={propertiesLoading}
          >
            {properties.map((prop: any) => (
              <Option key={prop.id} value={prop.id}>
                {prop.houseNumber || 'Plot'} - {prop.offerNumber} (GHS {(prop.priceMinor / 100).toLocaleString()})
              </Option>
            ))}
          </Select>
        </Form.Item>

        <Form.Item name="type" label="Customer Payment Type" rules={[{ required: true }]}>
          <Select
            onChange={(val) => {
              if (val === 'fully_paid') {
                form.setFieldsValue({ totalAmount: undefined, downPayment: undefined });
              }
            }}
          >
            <Option value="payment_plan">Installment Payment Plan</Option>
            <Option value="fully_paid">Outright / Fully Paid</Option>
          </Select>
        </Form.Item>

        <Form.Item shouldUpdate={(prev, cur) => prev.type !== cur.type || prev.planBasis !== cur.planBasis} noStyle>
          {({ getFieldValue }) => {
            if (getFieldValue('type') !== 'payment_plan') return null;
            const planBasis = getFieldValue('planBasis') || 'months';
            return (
              <div style={{ background: '#f8fafc', padding: 16, borderRadius: 8, marginBottom: 16, border: '1px solid #e2e8f0' }}>
                <Text strong style={{ display: 'block', marginBottom: 12 }}>Payment Plan Terms</Text>
                <Row gutter={[16, 0]}>
                  <Col xs={24} sm={12}>
                    <Form.Item
                      name="totalAmount"
                      label="Total Amount (GHS)"
                      rules={[{ required: true, message: 'Total amount is required' }]}
                    >
                      <InputNumber min={0} style={{ width: '100%' }} placeholder="e.g. 150000" />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12}>
                    <Form.Item name="downPayment" label="Initial Deposit / Down Payment (GHS)">
                      <InputNumber min={0} style={{ width: '100%' }} placeholder="e.g. 30000" />
                    </Form.Item>
                  </Col>
                </Row>

                <Row gutter={[16, 0]}>
                  <Col xs={24} sm={12}>
                    <Form.Item name="planBasis" label="Plan Duration Basis">
                      <Select>
                        <Option value="months">Fixed Number of Months</Option>
                        <Option value="monthly">Fixed Monthly Installment</Option>
                      </Select>
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12}>
                    {planBasis === 'months' ? (
                      <Form.Item
                        name="numMonths"
                        label="Number of Months"
                        rules={[{ required: true, message: 'Required' }]}
                      >
                        <InputNumber min={1} max={120} style={{ width: '100%' }} placeholder="e.g. 12" />
                      </Form.Item>
                    ) : (
                      <Form.Item
                        name="monthlyAmount"
                        label="Monthly Installment (GHS)"
                        rules={[{ required: true, message: 'Required' }]}
                      >
                        <InputNumber min={1} style={{ width: '100%' }} placeholder="e.g. 10000" />
                      </Form.Item>
                    )}
                  </Col>
                </Row>

                <Form.Item name="startDate" label="Plan Start Date">
                  <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
                </Form.Item>
              </div>
            );
          }}
        </Form.Item>

        <Form.Item style={{ marginBottom: 0, textAlign: 'right', marginTop: 16 }}>
          <Space>
            <Button onClick={() => { form.resetFields(); onClose(); }}>Cancel</Button>
            <Button type="primary" htmlType="submit" loading={createCustomer.isPending} icon={<PlusOutlined />}>
              Create Customer
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </Modal>
  );
};
