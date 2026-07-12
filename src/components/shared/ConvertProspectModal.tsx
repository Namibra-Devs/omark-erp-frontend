// src/components/shared/ConvertProspectModal.tsx
// The "single action" that turns a purchasing prospect into a customer —
// POST /prospects/{id}/convert. Shared by the marketing and customer
// service prospect screens since the flow is identical for both.
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal, Form, Select, Radio, InputNumber, DatePicker, Button, Space, Alert, message } from 'antd';
import dayjs from 'dayjs';
import { useConvertProspectMutation } from '@/api/prospects';
import { usePropertiesQuery, formatPropertyPrice } from '@/api/properties';
import type { Prospect, CustomerType } from '@/types';

const { Option } = Select;

interface ConvertProspectModalProps {
  open: boolean;
  prospect: Prospect | null;
  onClose: () => void;
  /** Called after a successful conversion, with the new customer's id. */
  onConverted?: (customerId: string) => void;
}

export const ConvertProspectModal: React.FC<ConvertProspectModalProps> = ({
  open,
  prospect,
  onClose,
  onConverted,
}) => {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [customerType, setCustomerType] = useState<CustomerType>('payment_plan');
  const [planBasis, setPlanBasis] = useState<'months' | 'monthly_amount'>('months');

  const { data: propertiesData, isLoading: propertiesLoading } = usePropertiesQuery({ pageSize: 100 });
  const properties = propertiesData?.items ?? [];

  const convertProspect = useConvertProspectMutation();

  const handleClose = () => {
    form.resetFields();
    setCustomerType('payment_plan');
    setPlanBasis('months');
    onClose();
  };

  const handleFinish = async (values: any) => {
    if (!prospect) return;

    try {
      const createPlan =
        customerType === 'payment_plan'
          ? {
              totalAmountMinor: Math.round(values.totalAmount * 100),
              downPaymentMinor: Math.round(values.downPayment * 100),
              planBasis,
              numMonths: planBasis === 'months' ? values.numMonths : undefined,
              monthlyAmountMinor:
                planBasis === 'monthly_amount' ? Math.round(values.monthlyAmount * 100) : undefined,
              startDate: values.startDate.format('YYYY-MM-DD'),
            }
          : undefined;

      const result = await convertProspect.mutateAsync({
        prospectId: prospect.id,
        customerType,
        propertyId: values.propertyId,
        createPlan,
      });

      message.success(`${prospect.firstName} ${prospect.lastName} is now a customer!`);
      handleClose();
      onConverted?.(result.id);
      navigate(`/customers/${result.id}`);
    } catch (error: any) {
      message.error(error?.error?.message || error?.message || 'Failed to convert prospect to customer');
    }
  };

  if (!prospect) return null;

  return (
    <Modal
      title={`Convert ${prospect.firstName} ${prospect.lastName} to Customer`}
      open={open}
      onCancel={handleClose}
      footer={null}
      width={600}
      style={{ maxWidth: '95%', top: 20 }}
      bodyStyle={{ padding: '16px' }}
      destroyOnClose
    >
      <Alert
        type="info"
        showIcon
        message="This is a one-way action"
        description="Once converted, the prospect record becomes a customer and no longer appears in the prospects list. The property, customer type, and payment plan cannot be changed afterwards."
        style={{ marginBottom: 20 }}
      />

      <Form
        form={form}
        layout="vertical"
        onFinish={handleFinish}
        initialValues={{ customerType: 'payment_plan', planBasis: 'months' }}
      >
        <Form.Item
          name="propertyId"
          label="Property Purchased"
          rules={[{ required: true, message: 'Please select the property' }]}
        >
          <Select
            placeholder="Select property"
            showSearch
            loading={propertiesLoading}
            optionFilterProp="children"
          >
            {properties.map((p) => (
              <Option key={p.id} value={p.id}>
                {p.houseNumber} - {p.offerNumber} ({formatPropertyPrice(p.priceMinor, p.currency)})
              </Option>
            ))}
          </Select>
        </Form.Item>

        <Form.Item name="customerType" label="Payment Type" rules={[{ required: true }]}>
          <Radio.Group
            onChange={(e) => setCustomerType(e.target.value)}
            value={customerType}
          >
            <Radio.Button value="payment_plan">Payment Plan</Radio.Button>
            <Radio.Button value="fully_paid">Fully Paid</Radio.Button>
          </Radio.Group>
        </Form.Item>

        {customerType === 'payment_plan' && (
          <>
            <Space.Compact block style={{ marginBottom: 8 }}>
              <Form.Item
                name="totalAmount"
                label="Total Amount (GHS)"
                style={{ width: '50%' }}
                rules={[{ required: true, message: 'Total amount is required' }]}
              >
                <InputNumber min={0} style={{ width: '100%' }} placeholder="e.g. 150000" />
              </Form.Item>
              <Form.Item
                name="downPayment"
                label="Down Payment (GHS)"
                style={{ width: '50%' }}
                rules={[{ required: true, message: 'Down payment is required' }]}
              >
                <InputNumber min={0} style={{ width: '100%' }} placeholder="e.g. 30000" />
              </Form.Item>
            </Space.Compact>

            <Form.Item name="planBasis" label="Plan Basis" rules={[{ required: true }]}>
              <Radio.Group onChange={(e) => setPlanBasis(e.target.value)} value={planBasis}>
                <Radio value="months">Fixed number of months</Radio>
                <Radio value="monthly_amount">Fixed monthly amount</Radio>
              </Radio.Group>
            </Form.Item>

            {planBasis === 'months' ? (
              <Form.Item
                name="numMonths"
                label="Number of Months"
                rules={[{ required: true, message: 'Number of months is required' }]}
              >
                <InputNumber min={1} style={{ width: '100%' }} placeholder="e.g. 24" />
              </Form.Item>
            ) : (
              <Form.Item
                name="monthlyAmount"
                label="Monthly Amount (GHS)"
                rules={[{ required: true, message: 'Monthly amount is required' }]}
              >
                <InputNumber min={0} style={{ width: '100%' }} placeholder="e.g. 3000" />
              </Form.Item>
            )}

            <Form.Item
              name="startDate"
              label="First Installment Date"
              rules={[{ required: true, message: 'Start date is required' }]}
              initialValue={dayjs()}
            >
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
          </>
        )}

        <Form.Item style={{ marginTop: 16 }}>
          <Space wrap>
            <Button type="primary" htmlType="submit" loading={convertProspect.isPending}>
              Convert to Customer
            </Button>
            <Button onClick={handleClose}>Cancel</Button>
          </Space>
        </Form.Item>
      </Form>
    </Modal>
  );
};
