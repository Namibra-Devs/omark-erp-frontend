// src/components/shared/AddCustomerModal.tsx
import React, { useState, useMemo } from 'react';
import {
  Modal, Form, Input, Select, Row, Col, Button, Space, message,
  InputNumber, DatePicker, Typography, Alert,
} from 'antd';
import {
  UserAddOutlined,
  PlusOutlined,
  HomeOutlined,
  UserSwitchOutlined,
  CloseOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useAuth } from '@/contexts/AuthContext';
import { PhoneInput } from '@/components/shared/PhoneInput';
import { useCreateCustomerMutation, useCustomersQuery } from '@/api/customers';
import { useProspectsQuery, getStoredProspects, saveStoredProspect } from '@/api/prospects';
import { usePropertiesQuery } from '@/api/properties';
import { tagPayloadWithBranch } from '@/utils/branchIsolation';
import { tokens } from '@/constants/tokens';
import {
  createDuplicatePhoneRule,
  createDuplicateNameRule,
  assertNoCustomerDuplicates,
} from '@/utils/duplicateValidation';
import { saveStoredPaymentPlan, saveCustomerPlanDefinition } from '@/utils/paymentPlansStorage';
import type { Prospect } from '@/types';

const { Option } = Select;
const { Text } = Typography;

export interface AddCustomerModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: (customerId: string) => void;
  initialProspect?: Prospect | null;
  initialProspectId?: string | null;
}

export const AddCustomerModal: React.FC<AddCustomerModalProps> = ({
  open,
  onClose,
  onSuccess,
  initialProspect,
  initialProspectId,
}) => {
  const { user } = useAuth();
  const [form] = Form.useForm();
  const createCustomer = useCreateCustomerMutation();
  const { data: propertiesData, isLoading: propertiesLoading } = usePropertiesQuery({ pageSize: 100 });
  const properties = propertiesData?.items ?? [];

  const { data: customersData } = useCustomersQuery();
  const { data: prospectsData } = useProspectsQuery();
  const existingCustomers = customersData?.items ?? [];
  const existingProspects = prospectsData?.items ?? [];

  const [selectedProspectId, setSelectedProspectId] = useState<string | null>(null);
  const [showProspectPicker, setShowProspectPicker] = useState<boolean>(false);

  // Consolidate unique active prospects from server query, local storage, and initial prospect
  const activeProspects = useMemo(() => {
    const map = new Map<string, Prospect>();
    const stored = getStoredProspects();
    if (initialProspect && initialProspect.id) {
      map.set(initialProspect.id, initialProspect);
    }
    [...existingProspects, ...stored].forEach((p) => {
      if (p && p.id && p.status !== 'purchased') {
        map.set(p.id, p);
      }
    });
    return Array.from(map.values()).sort((a, b) => {
      const nameA = `${a.firstName || ''} ${a.lastName || ''}`.trim().toLowerCase();
      const nameB = `${b.firstName || ''} ${b.lastName || ''}`.trim().toLowerCase();
      return nameA.localeCompare(nameB);
    });
  }, [existingProspects, initialProspect]);

  const selectedProspect = useMemo(() => {
    if (!selectedProspectId) return null;
    return activeProspects.find((p) => p.id === selectedProspectId) || null;
  }, [selectedProspectId, activeProspects]);

  const handleSelectProspect = (prospectId: string) => {
    const p = activeProspects.find((item) => item.id === prospectId) || (initialProspect?.id === prospectId ? initialProspect : null);
    if (!p) return;
    setSelectedProspectId(prospectId);
    form.setFieldsValue({
      firstName: p.firstName || '',
      lastName: p.lastName || '',
      phoneNumber: p.phoneNumber || '',
      address: p.address || '',
      propertyId: (p as any).propertyId || form.getFieldValue('propertyId'),
    });
    // Revalidate fields so any previous red duplicate warning on this prospect's own phone is cleared
    form.validateFields(['phoneNumber', 'firstName', 'lastName']).catch(() => {});
    message.success(`Prospect details populated for ${p.firstName} ${p.lastName}`);
  };

  // Synchronize initialProspect or initialProspectId when modal opens
  React.useEffect(() => {
    if (open) {
      const targetId = initialProspectId || initialProspect?.id;
      if (targetId) {
        handleSelectProspect(targetId);
      }
    } else {
      setSelectedProspectId(null);
      setShowProspectPicker(false);
      form.resetFields();
    }
  }, [open, initialProspectId, initialProspect]);

  const handleClearProspectSelection = () => {
    setSelectedProspectId(null);
    setShowProspectPicker(false);
    form.resetFields();
  };

  const handleModalClose = () => {
    form.resetFields();
    setSelectedProspectId(null);
    setShowProspectPicker(false);
    onClose();
  };

  const handleFinish = async (values: any) => {
    try {
      // Hard pre-submission rejection guard (excluding the selected prospect itself)
      assertNoCustomerDuplicates(
        {
          firstName: values.firstName,
          lastName: values.lastName,
          phoneNumber: values.phoneNumber,
          excludeProspectId: selectedProspectId || undefined,
          prospectId: selectedProspectId || undefined,
        },
        { existingCustomers, existingProspects }
      );

      const customerData: any = {
        prospectId: selectedProspectId || undefined,
        firstName: values.firstName,
        lastName: values.lastName,
        phoneNumber: values.phoneNumber,
        address: values.address,
        type: values.type,
        propertyId: values.propertyId,
        assignedUserId: selectedProspect?.assignedUserId || user?.id,
        createdByUserId: user?.id,
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

      if (customerData.createPlan && newCustomer?.id) {
        const planData = customerData.createPlan;
        const balanceMinor = Math.max(planData.totalAmountMinor - planData.downPaymentMinor, 0);
        const realPlanId =
          (newCustomer as any)?.plan?.id ||
          (newCustomer as any)?.planId ||
          (newCustomer as any)?.paymentPlanId ||
          (newCustomer as any)?.paymentPlan?.id;
        const finalPlanId =
          realPlanId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(realPlanId)
            ? realPlanId
            : `plan-${newCustomer.id}`;

        const planObj: any = {
          id: finalPlanId,
          customerId: newCustomer.id,
          propertyId: values.propertyId,
          totalAmountMinor: planData.totalAmountMinor,
          downPaymentMinor: planData.downPaymentMinor,
          balanceMinor,
          numMonths: planData.numMonths || 12,
          monthlyAmountMinor: planData.monthlyAmountMinor || Math.round(balanceMinor / Math.max(planData.numMonths || 12, 1)),
          currency: 'GHS',
          startDate: planData.startDate,
          status: 'active',
          progressPercent: planData.totalAmountMinor > 0 ? Math.round((planData.downPaymentMinor / planData.totalAmountMinor) * 100) : 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        saveStoredPaymentPlan(planObj).catch(() => {});
        saveCustomerPlanDefinition(newCustomer.id, planObj).catch(() => {});
      }

      if (selectedProspectId) {
        const stored = getStoredProspects();
        const target = stored.find((p) => p.id === selectedProspectId);
        if (target) {
          saveStoredProspect({
            ...target,
            status: 'purchased',
          });
        }
        window.dispatchEvent(new Event('omark-prospects-changed'));
        message.success(`Prospect ${values.firstName} ${values.lastName} converted to customer successfully!`);
      } else {
        message.success(`Customer ${values.firstName} ${values.lastName} added successfully!`);
      }

      handleModalClose();
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
      onCancel={handleModalClose}
      footer={null}
      width={640}
      style={{ maxWidth: '95%', top: 20 }}
      destroyOnClose
    >
      {/* ── Conversion Link & Quick Selector Banner ── */}
      <div
        style={{
          background: selectedProspect ? '#f0fdf4' : '#f8fafc',
          border: selectedProspect ? '1px solid #86efac' : '1px solid #e2e8f0',
          borderRadius: 8,
          padding: '12px 14px',
          marginBottom: 16,
          transition: 'all 0.2s ease',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <Space align="start">
            <UserSwitchOutlined style={{ color: selectedProspect ? '#16a34a' : tokens.primary, fontSize: 18, marginTop: 2 }} />
            <div>
              <Text strong style={{ color: selectedProspect ? '#15803d' : '#1e293b' }}>
                {selectedProspect
                  ? `Converting Prospect: ${selectedProspect.firstName} ${selectedProspect.lastName}`
                  : 'Converting an existing prospect?'}
              </Text>
              <div style={{ fontSize: 12, color: selectedProspect ? '#166534' : '#64748b' }}>
                {selectedProspect
                  ? `Contact: ${selectedProspect.phoneNumber} • Information populated. Submitting registers the customer and converts this prospect.`
                  : 'Select an existing prospect from your pipeline to convert them to a customer directly.'}
              </div>
            </div>
          </Space>
          <Space>
            {selectedProspect ? (
              <Button
                size="small"
                icon={<CloseOutlined />}
                onClick={handleClearProspectSelection}
              >
                Clear Prospect
              </Button>
            ) : (
              <Button
                type="primary"
                size="small"
                icon={<UserSwitchOutlined />}
                style={{ background: '#16a34a', borderColor: '#16a34a' }}
                onClick={() => setShowProspectPicker((prev) => !prev)}
              >
                {showProspectPicker ? 'Hide Prospect List' : 'Convert Existing Prospect'}
              </Button>
            )}
          </Space>
        </div>

        {(showProspectPicker || selectedProspect) && (
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px dashed #cbd5e1' }}>
            <Text style={{ fontSize: 12, marginBottom: 6, display: 'block', fontWeight: 500, color: '#475569' }}>
              Select a prospect from the pipeline:
            </Text>
            <Select
              showSearch
              style={{ width: '100%' }}
              placeholder="Search by prospect name or phone number..."
              value={selectedProspectId}
              onChange={handleSelectProspect}
              filterOption={(input, option) =>
                (option?.label as unknown as string || '').toLowerCase().includes(input.toLowerCase())
              }
              options={activeProspects.map((p) => ({
                value: p.id,
                label: `${p.firstName} ${p.lastName} — ${p.phoneNumber} (${p.source || 'Lead'}${p.notes ? ` • ${p.notes.slice(0, 30)}` : ''})`,
              }))}
            />
          </div>
        )}
      </div>

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
              rules={[
                { required: true, message: 'First name is required' },
                createDuplicateNameRule({
                  entityType: 'customer',
                  isFirstName: true,
                  getOtherName: () => form.getFieldValue('lastName'),
                  getExistingCustomers: () => existingCustomers,
                  getExistingProspects: () => existingProspects,
                  getProspectId: () => selectedProspectId || undefined,
                }),
              ]}
            >
              <Input placeholder="First name" />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item
              name="lastName"
              label="Last Name"
              rules={[
                { required: true, message: 'Last name is required' },
                createDuplicateNameRule({
                  entityType: 'customer',
                  isFirstName: false,
                  getOtherName: () => form.getFieldValue('firstName'),
                  getExistingCustomers: () => existingCustomers,
                  getExistingProspects: () => existingProspects,
                  getProspectId: () => selectedProspectId || undefined,
                }),
              ]}
            >
              <Input placeholder="Last name" />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item
          name="phoneNumber"
          label="Phone Number"
          rules={[
            { required: true, message: 'Phone number is required' },
            createDuplicatePhoneRule({
              entityType: 'customer',
              getExistingCustomers: () => existingCustomers,
              getExistingProspects: () => existingProspects,
              getProspectId: () => selectedProspectId || undefined,
            }),
          ]}
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
            <Button onClick={handleModalClose}>Cancel</Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={createCustomer.isPending}
              icon={selectedProspectId ? <UserSwitchOutlined /> : <PlusOutlined />}
              style={selectedProspectId ? { background: '#16a34a', borderColor: '#16a34a' } : undefined}
            >
              {selectedProspectId ? 'Convert Prospect to Customer' : 'Create Customer'}
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </Modal>
  );
};
