// src/components/paymentPlan/RecordPaymentModal.tsx
import React, { useState, useEffect, useMemo } from 'react';
import {
  Modal,
  Form,
  Input,
  InputNumber,
  DatePicker,
  Select,
  Button,
  Space,
  Typography,
  Tag,
  Divider,
  Row,
  Col,
  Alert,
  message,
} from 'antd';
import {
  DollarOutlined,
  CalendarOutlined,
  UserOutlined,
  PhoneOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  SafetyCertificateOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useQueryClient } from '@tanstack/react-query';
import { paymentPlansKeys, usePaymentPlansQuery, usePaymentPlanQuery, useInstallmentsQuery } from '@/api/paymentPlans';
import { useCustomersQuery, useCustomerQuery } from '@/api/customers';
import { usePropertiesQuery } from '@/api/properties';
import { recordPlanPaymentWithBackend, isValidServerId } from '@/api/paymentPlansPersistence';
import {
  buildPaymentPlanSchedule,
  getOrdinal,
  type ScheduleInstallmentRow,
} from '@/utils/paymentPlanSchedule';
import { PaymentReceiptModal, type PaymentReceiptData } from './PaymentReceiptModal';
import { tokens } from '@/constants/tokens';
import type { PaymentPlan, PaymentMethod } from '@/types';

const { Text, Title } = Typography;
const { Option } = Select;

export interface RecordPaymentModalProps {
  open: boolean;
  onClose: () => void;
  /** Direct PaymentPlan object, if available */
  plan?: PaymentPlan | null;
  /** Customer entity or defaulter record */
  customer?: any | null;
  /** Optional customer name override */
  customerName?: string;
  /** Optional customer phone override */
  customerPhone?: string;
  /** Optional property name override */
  propertyName?: string;
  /** Specific installment sequence, if chosen from schedule */
  targetSequence?: number;
  /** Initial amount in GHS, if specified */
  initialAmountGHS?: number;
  /** Callback fired on successful payment */
  onSuccess?: (receiptData: PaymentReceiptData) => void;
}

export const RecordPaymentModal: React.FC<RecordPaymentModalProps> = ({
  open,
  onClose,
  plan: propPlan,
  customer,
  customerName: propCustomerName,
  customerPhone: propCustomerPhone,
  propertyName: propPropertyName,
  targetSequence,
  initialAmountGHS,
  onSuccess,
}) => {
  const queryClient = useQueryClient();
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [customAmountEntered, setCustomAmountEntered] = useState<number | null>(null);

  // Receipt modal state
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [receiptData, setReceiptData] = useState<PaymentReceiptData | null>(null);

  // Load auxiliary data to resolve relations if needed
  const { data: plansData } = usePaymentPlansQuery({ pageSize: 100 });
  const { data: customersData } = useCustomersQuery({ pageSize: 100 });
  const { data: propertiesData } = usePropertiesQuery({ pageSize: 100 });

  const custId = customer?.customerId || customer?.id;
  const isCustValidServerId = Boolean(open && custId && isValidServerId(custId));
  const { data: customerDetail } = useCustomerQuery(isCustValidServerId ? custId : '');

  const propertyMap = useMemo(() => {
    const map: Record<string, any> = {};
    (propertiesData?.items || []).forEach((p) => {
      map[p.id] = p;
    });
    return map;
  }, [propertiesData]);

  // Resolve the active PaymentPlan
  const resolvedPlan = useMemo<PaymentPlan | null>(() => {
    if (propPlan) return propPlan;

    if (!customer) return null;

    // Check if customer already has a plan object attached
    if (customer.plan && typeof customer.plan === 'object') return customer.plan;
    if (customer.paymentPlan && typeof customer.paymentPlan === 'object') return customer.paymentPlan;
    if (customerDetail?.plan && typeof customerDetail.plan === 'object') return customerDetail.plan;
    if (customer.rawPlan && typeof customer.rawPlan === 'object') return customer.rawPlan;

    const currentCustId = customer.customerId || customer.id;
    if (!currentCustId) return null;

    // Find in plans query
    const found = (plansData?.items || []).find(
      (p) => p.customerId === currentCustId || (customer.planId && p.id === customer.planId)
    );
    if (found) return found;

    // If customer has a real backend planId, prioritize it over synthetic ID
    const explicitPlanId =
      (customer.planId && isValidServerId(customer.planId) ? customer.planId : null) ||
      (typeof customer.plan === 'string' && isValidServerId(customer.plan) ? customer.plan : null) ||
      (typeof customer.paymentPlan === 'string' && isValidServerId(customer.paymentPlan) ? customer.paymentPlan : null);

    // Synthetic fallback plan for isolated customer records
    const totalAmountMinor = customer.totalAmountMinor || customer.overdueAmountMinor || 35000000;
    const balanceMinor = customer.balanceMinor !== undefined
      ? customer.balanceMinor
      : (customer.overdueAmountMinor || totalAmountMinor);
    const numMonths = customer.numMonths || 6;
    const monthlyAmountMinor = customer.monthlyAmountMinor || Math.round(balanceMinor / Math.max(numMonths, 1));

    return {
      id: explicitPlanId || customer.planId || `plan-${currentCustId}`,
      customerId: currentCustId,
      propertyId: customer.propertyId || '',
      totalAmountMinor,
      downPaymentMinor: customer.downPaymentMinor || 0,
      balanceMinor,
      numMonths,
      monthlyAmountMinor,
      currency: 'GHS',
      startDate: customer.startDate || dayjs().subtract(1, 'month').format('YYYY-MM-DD'),
      status: 'active',
      progressPercent: Math.max(0, Math.min(100, Math.round(((totalAmountMinor - balanceMinor) / totalAmountMinor) * 100))),
      progressBand: 'yellow',
      createdAt: customer.createdAt || new Date().toISOString(),
      updatedAt: customer.updatedAt || new Date().toISOString(),
    };
  }, [propPlan, customer, customerDetail, plansData]);

  const resolvedPlanId = resolvedPlan?.id || '';
  const isRealBackendPlan = Boolean(open && resolvedPlanId && isValidServerId(resolvedPlanId));

  const { data: livePlanData } = usePaymentPlanQuery(isRealBackendPlan ? resolvedPlanId : undefined);
  const { data: liveInstallmentsData } = useInstallmentsQuery(isRealBackendPlan ? resolvedPlanId : undefined);

  const activePlan = useMemo(() => {
    if (!resolvedPlan) return null;
    if (!livePlanData) return resolvedPlan;
    return {
      ...resolvedPlan,
      ...livePlanData,
      balanceMinor: livePlanData.balanceMinor !== undefined ? livePlanData.balanceMinor : resolvedPlan.balanceMinor,
      status: livePlanData.status || resolvedPlan.status,
    };
  }, [resolvedPlan, livePlanData]);

  const resolvedInstallments = useMemo(() => {
    if (liveInstallmentsData && liveInstallmentsData.length > 0) return liveInstallmentsData;
    if (livePlanData?.installments && livePlanData.installments.length > 0) return livePlanData.installments;
    return [];
  }, [liveInstallmentsData, livePlanData]);

  const resolvedPayments = useMemo(() => {
    if (livePlanData?.recentPayments && livePlanData.recentPayments.length > 0) {
      return livePlanData.recentPayments;
    }
    return [];
  }, [livePlanData]);

  // Compute schedule for the plan
  const scheduleInfo = useMemo(() => {
    if (!activePlan) return null;
    return buildPaymentPlanSchedule(activePlan, resolvedInstallments, resolvedPayments);
  }, [activePlan, resolvedInstallments, resolvedPayments]);

  // Resolve target installment row
  const targetRow = useMemo<ScheduleInstallmentRow | null>(() => {
    if (!scheduleInfo || !scheduleInfo.rows.length) return null;

    if (targetSequence !== undefined) {
      const match = scheduleInfo.rows.find((r) => r.sequence === targetSequence);
      if (match) return match;
    }

    // Default: find first overdue unpaid row, or next due row, or first row
    return (
      scheduleInfo.rows.find((r) => r.isOverdue && !r.isPaid) ||
      scheduleInfo.nextDueRow ||
      scheduleInfo.rows[0]
    );
  }, [scheduleInfo, targetSequence]);

  // Resolve Customer Info
  const customerInfo = useMemo(() => {
    const custId = resolvedPlan?.customerId || customer?.customerId || customer?.id;
    const matchedCustomer = (customersData?.items || []).find((c) => c.id === custId);

    const name =
      propCustomerName ||
      customer?.name ||
      customer?.customerName ||
      (customer?.firstName ? `${customer.firstName} ${customer.lastName || ''}`.trim() : null) ||
      (customerDetail?.firstName ? `${customerDetail.firstName} ${customerDetail.lastName || ''}`.trim() : null) ||
      (matchedCustomer ? `${matchedCustomer.firstName} ${matchedCustomer.lastName}`.trim() : null) ||
      (resolvedPlan as any)?.customerName ||
      'Valued Customer';

    const phone =
      propCustomerPhone ||
      customer?.phone ||
      customer?.phoneNumber ||
      customerDetail?.phoneNumber ||
      matchedCustomer?.phoneNumber ||
      (resolvedPlan as any)?.customerPhone ||
      '';

    const propId = resolvedPlan?.propertyId || customer?.propertyId || customerDetail?.propertyId || matchedCustomer?.propertyId;
    const prop = propId ? propertyMap[propId] : null;
    const propertyName =
      propPropertyName ||
      customer?.propertyName ||
      prop?.houseNumber ||
      prop?.title ||
      (resolvedPlan as any)?.propertyName ||
      'Assigned Property';

    return { customerId: custId, name, phone, propertyName };
  }, [resolvedPlan, customer, customerDetail, propCustomerName, propCustomerPhone, propPropertyName, customersData, propertyMap]);

  // Compute expected amount
  const expectedGHS = useMemo(() => {
    if (!targetRow) return 0;
    if (initialAmountGHS !== undefined && initialAmountGHS > 0) return initialAmountGHS;
    return targetRow.isPartiallyPaid && targetRow.deficitGHS > 0
      ? targetRow.deficitGHS
      : targetRow.installmentGHS;
  }, [targetRow, initialAmountGHS]);

  // Initialize form when opened
  useEffect(() => {
    if (open && targetRow) {
      const defaultAmt = Number(expectedGHS.toFixed(2));
      setCustomAmountEntered(defaultAmt);
      setSubmitError(null);
      form.setFieldsValue({
        amountGHS: defaultAmt,
        paidOn: dayjs(),
        method: 'bank_transfer',
        reference: `REC-${Date.now().toString().slice(-6)}`,
        notes: '',
      });
    } else if (!open) {
      form.resetFields();
      setCustomAmountEntered(null);
      setSubmitError(null);
    }
  }, [open, targetRow, expectedGHS, form]);

  const currentAmt = customAmountEntered !== null ? customAmountEntered : expectedGHS;
  const isOver = currentAmt > expectedGHS + 0.009;
  const isUnder = currentAmt < expectedGHS - 0.009 && currentAmt > 0;
  const surplus = isOver ? currentAmt - expectedGHS : 0;
  const deficit = isUnder ? expectedGHS - currentAmt : 0;
  const totalBalance = scheduleInfo ? scheduleInfo.currentBalanceGHS : 0;
  const newOutstanding = Math.max(0, totalBalance - currentAmt);

  const handleSubmit = async (values: any) => {
    const planToRecord = activePlan || resolvedPlan;
    if (!planToRecord || !targetRow) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const amountGHS = values.amountGHS !== undefined && values.amountGHS !== null ? values.amountGHS : expectedGHS;
      const amountMinor = Math.round(amountGHS * 100);
      const paidOn = values.paidOn ? values.paidOn.toISOString() : new Date().toISOString();
      const method: PaymentMethod = values.method || 'bank_transfer';
      const reference = values.reference || `REC-${Date.now().toString().slice(-6)}`;

      const result = await recordPlanPaymentWithBackend(
        planToRecord,
        {
          amountMinor,
          paidOn,
          method,
          reference,
          sequence: targetRow.sequence,
          installmentOrdinal: targetRow.ordinal,
          notes: values.notes,
        },
        {
          customerId: customerInfo.customerId,
          name: customerInfo.name,
          phone: customerInfo.phone,
          propertyName: customerInfo.propertyName,
        }
      );

      // Invalidate queries for instant UI reactivity across app
      queryClient.invalidateQueries({ queryKey: paymentPlansKeys.all });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['secretary-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['accounts-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['payments'] });

      // Feedback message
      if (result.isOverpayment) {
        message.success(
          `Payment of GH₵ ${amountGHS.toFixed(2)} stored to database! GH₵ ${(result.surplusAppliedMinor / 100).toFixed(2)} surplus advance dynamically applied to future installments. Remaining balance: GH₵ ${(result.newBalanceMinor / 100).toFixed(2)}.`
        );
      } else if (result.isPartialPayment) {
        message.warning(
          `Partial payment of GH₵ ${amountGHS.toFixed(2)} stored to database. GH₵ ${(result.deficitRolledOverMinor / 100).toFixed(2)} deficit rolled forward into subsequent installment. Remaining balance: GH₵ ${(result.newBalanceMinor / 100).toFixed(2)}.`
        );
      } else {
        message.success(
          `Payment of GH₵ ${amountGHS.toFixed(2)} stored to database successfully! Remaining balance: GH₵ ${(result.newBalanceMinor / 100).toFixed(2)}.`
        );
      }

      const receiptPayload: PaymentReceiptData = {
        receiptNumber: result.receiptNumber || reference,
        customerName: customerInfo.name,
        customerPhone: customerInfo.phone,
        propertyName: customerInfo.propertyName,
        amountPaidGHS: amountGHS,
        paymentDate: dayjs(paidOn).format('YYYY-MM-DD'),
        paymentMethod: method,
        reference,
        planId: planToRecord.id,
        installmentOrdinal: result.installmentOrdinal || targetRow.ordinal,
        installmentSequence: result.sequence || targetRow.sequence,
        expectedAmountGHS: targetRow.installmentGHS,
        isPartialPayment: result.isPartialPayment,
        isOverpayment: result.isOverpayment,
        deficitRolledOverGHS: result.deficitRolledOverMinor / 100,
        surplusAppliedGHS: result.surplusAppliedMinor / 100,
        newOutstandingBalanceGHS: result.newBalanceMinor / 100,
        totalContractGHS: (planToRecord.totalAmountMinor || 0) / 100,
      };

      setReceiptData(receiptPayload);
      if (onSuccess) {
        onSuccess(receiptPayload);
      }

      onClose();
      form.resetFields();
      setCustomAmountEntered(null);
      setSubmitError(null);
      setReceiptModalOpen(true);
    } catch (err: any) {
      const errorMsg =
        err?.response?.data?.error?.message ||
        err?.response?.data?.message ||
        err?.message ||
        'Failed to record payment';
      setSubmitError(errorMsg);
      message.error(errorMsg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Modal
        title={
          <Space>
            <DollarOutlined style={{ color: tokens.primary }} />
            <Text strong>
              Record Payment — {targetRow?.ordinal || 'Scheduled'} Installment (Dynamic Recalculation Engine)
            </Text>
          </Space>
        }
        open={open}
        maskClosable={!submitting}
        closable={!submitting}
        onCancel={() => {
          if (!submitting) {
            onClose();
            form.resetFields();
            setCustomAmountEntered(null);
            setSubmitError(null);
          }
        }}
        footer={null}
        width={580}
        style={{ maxWidth: '95%', top: 24 }}
        destroyOnClose
      >
        {submitError && (
          <Alert
            type="error"
            showIcon
            message="Payment Failed"
            description={submitError}
            style={{ marginBottom: 16 }}
            closable
            onClose={() => setSubmitError(null)}
          />
        )}
        {targetRow && (
          <Form
            form={form}
            layout="vertical"
            onFinish={handleSubmit}
            initialValues={{
              amountGHS: expectedGHS,
              paidOn: dayjs(),
              method: 'bank_transfer',
              reference: `REC-${Date.now().toString().slice(-6)}`,
            }}
          >
            {/* Customer & Contract Context Header */}
            <div
              style={{
                background: targetRow.isOverdue ? '#fff2f0' : '#f8fafc',
                border: `1px solid ${targetRow.isOverdue ? '#ffccc7' : '#e2e8f0'}`,
                borderRadius: 8,
                padding: '12px 14px',
                marginBottom: 14,
              }}
            >
              <Space direction="vertical" size={4} style={{ width: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text type="secondary">Customer & Property:</Text>
                  <Text strong>
                    {customerInfo.name}
                    {customerInfo.propertyName ? ` • ${customerInfo.propertyName}` : ''}
                  </Text>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text type="secondary">Customer SMS Contact:</Text>
                  {customerInfo.phone ? (
                    <Tag color="green" style={{ margin: 0 }}>
                      <PhoneOutlined style={{ marginRight: 4 }} />
                      {customerInfo.phone} • SMS Receipt Enabled
                    </Tag>
                  ) : (
                    <Tag color="warning" style={{ margin: 0 }}>
                      <ExclamationCircleOutlined style={{ marginRight: 4 }} />
                      No contact number registered
                    </Tag>
                  )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text type="secondary">Installment Sequence:</Text>
                  <Text strong>
                    {targetRow.sequence} ({targetRow.ordinal})
                  </Text>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text type="secondary">Due Date:</Text>
                  <Text strong style={{ color: targetRow.isOverdue ? '#cf1322' : undefined }}>
                    {targetRow.dueDateFormatted} {targetRow.isOverdue ? '(Overdue Defaulter)' : ''}
                  </Text>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text type="secondary">Base Monthly Installment:</Text>
                  <Text>
                    GH₵ {targetRow.baseInstallmentGHS.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Text>
                </div>

                {targetRow.surplusAppliedGHS > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#16a34a' }}>
                    <Text type="secondary" style={{ color: '#16a34a' }}>Surplus Advance Applied:</Text>
                    <Text strong style={{ color: '#16a34a' }}>
                      -GH₵ {targetRow.surplusAppliedGHS.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </Text>
                  </div>
                )}

                {targetRow.deficitGHS > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#d97706' }}>
                    <Text type="secondary" style={{ color: '#d97706' }}>Unpaid Deficit Rollover:</Text>
                    <Text strong style={{ color: '#d97706' }}>
                      +GH₵ {targetRow.deficitGHS.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </Text>
                  </div>
                )}

                <Divider style={{ margin: '6px 0' }} />

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text strong>Net Due for this Installment:</Text>
                  <Text strong style={{ fontSize: 16, color: '#1677ff' }}>
                    GH₵ {expectedGHS.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Text>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text type="secondary">Current Outstanding Balance:</Text>
                  <Text strong>
                    GH₵ {totalBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Text>
                </div>
              </Space>
            </div>

            {/* Dynamic Real-Time Recalculation Alert */}
            {isUnder && (
              <Alert
                type="warning"
                showIcon
                style={{ marginBottom: 14, borderRadius: 8 }}
                message={<span style={{ fontWeight: 700 }}>⚠️ Underpayment / Partial Payment Detected</span>}
                description={
                  <div style={{ fontSize: 12, marginTop: 4 }}>
                    <div>
                      • Credited & Deducted: <strong>GH₵ {currentAmt.toFixed(2)}</strong> (Installment marked as <Tag color="orange" style={{ margin: '0 4px' }}>Partially Paid</Tag>)
                    </div>
                    <div>
                      • Unpaid Deficit Rolled Forward: <strong style={{ color: '#d97706' }}>GH₵ {deficit.toFixed(2)}</strong>
                    </div>
                    <div style={{ marginTop: 4, fontStyle: 'italic', color: '#b45309' }}>
                      &rarr; Dynamic Amortization: Deficit of GH₵ {deficit.toFixed(2)} will automatically roll over into subsequent monthly installment(s).
                    </div>
                    <div style={{ marginTop: 4, fontWeight: 600 }}>• Total Outstanding Balance: GH₵ {newOutstanding.toFixed(2)}</div>
                  </div>
                }
              />
            )}

            {isOver && (
              <Alert
                type="success"
                showIcon
                style={{ marginBottom: 14, borderRadius: 8 }}
                message={<span style={{ fontWeight: 700 }}>✨ Overpayment / Pre-payment Detected</span>}
                description={
                  <div style={{ fontSize: 12, marginTop: 4 }}>
                    <div>
                      • Credited & Deducted: <strong>GH₵ {currentAmt.toFixed(2)}</strong> (Installment marked as <Tag color="green" style={{ margin: '0 4px' }}>Paid</Tag>)
                    </div>
                    <div>
                      • Surplus Advance: <strong style={{ color: '#16a34a' }}>GH₵ {surplus.toFixed(2)}</strong>
                    </div>
                    <div style={{ marginTop: 4, fontStyle: 'italic', color: '#15803d' }}>
                      &rarr; Dynamic Amortization: Surplus of GH₵ {surplus.toFixed(2)} will automatically apply against future scheduled installment(s), dynamically reducing upcoming payments.
                    </div>
                    <div style={{ marginTop: 4, fontWeight: 600 }}>• Total Outstanding Balance: GH₵ {newOutstanding.toFixed(2)}</div>
                  </div>
                }
              />
            )}

            {!isOver && !isUnder && (
              <Alert
                type="info"
                showIcon
                style={{ marginBottom: 14, borderRadius: 8 }}
                message={<span style={{ fontWeight: 700 }}>✅ Exact Scheduled Installment</span>}
                description={
                  <div style={{ fontSize: 12, marginTop: 4 }}>
                    <div>• Full installment of <strong>GH₵ {currentAmt.toFixed(2)}</strong> will be credited and deducted.</div>
                    <div style={{ fontWeight: 600, marginTop: 4 }}>• Total Outstanding Balance: GH₵ {newOutstanding.toFixed(2)}</div>
                  </div>
                }
              />
            )}

            {/* Quick Amount Presets */}
            <div style={{ marginBottom: 14 }}>
              <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>
                Quick Amount Presets:
              </Text>
              <Space wrap size={6}>
                <Button
                  size="small"
                  onClick={() => {
                    const val = Number(expectedGHS.toFixed(2));
                    form.setFieldsValue({ amountGHS: val });
                    setCustomAmountEntered(val);
                  }}
                >
                  Exact (GH₵ {expectedGHS.toFixed(2)})
                </Button>
                <Button
                  size="small"
                  onClick={() => {
                    const half = Number((expectedGHS / 2).toFixed(2));
                    form.setFieldsValue({ amountGHS: half });
                    setCustomAmountEntered(half);
                  }}
                >
                  50% Partial (GH₵ {(expectedGHS / 2).toFixed(2)})
                </Button>
                {totalBalance >= 5000 && expectedGHS !== 5000 && (
                  <Button
                    size="small"
                    onClick={() => {
                      form.setFieldsValue({ amountGHS: 5000 });
                      setCustomAmountEntered(5000);
                    }}
                  >
                    Custom GH₵ 5,000.00
                  </Button>
                )}
                <Button
                  size="small"
                  type="dashed"
                  onClick={() => {
                    const full = Number(totalBalance.toFixed(2));
                    form.setFieldsValue({ amountGHS: full });
                    setCustomAmountEntered(full);
                  }}
                >
                  Clear Balance (GH₵ {totalBalance.toFixed(2)})
                </Button>
              </Space>
            </div>

            {/* Amount Field */}
            <Form.Item
              name="amountGHS"
              label="Amount Paid (GHS / GH₵) — Enter Any Custom Amount"
              rules={[{ required: true, message: 'Payment amount is required' }]}
              extra="Dynamic engine automatically recalculates balances: underpayments carry deficit forward; overpayments reduce future scheduled installments."
            >
              <InputNumber
                style={{ width: '100%' }}
                prefix="GH₵"
                precision={2}
                min={0.01}
                placeholder="e.g. 5000.00"
                onChange={(val) => setCustomAmountEntered(val ?? null)}
              />
            </Form.Item>

            {/* Payment Date & Method */}
            <Row gutter={12}>
              <Col span={12}>
                <Form.Item
                  name="paidOn"
                  label="Payment Date"
                  rules={[{ required: true, message: 'Please select payment date' }]}
                >
                  <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="method"
                  label="Payment Method"
                  rules={[{ required: true, message: 'Please select payment method' }]}
                >
                  <Select placeholder="Select method">
                    <Option value="bank_transfer">Bank Transfer</Option>
                    <Option value="mobile_money">Mobile Money</Option>
                    <Option value="cash">Cash</Option>
                    <Option value="cheque">Cheque</Option>
                    <Option value="other">Other</Option>
                  </Select>
                </Form.Item>
              </Col>
            </Row>

            <Form.Item name="reference" label="Reference / Transaction Number">
              <Input placeholder="e.g., MTN-192849204 or Bank TXN ref" />
            </Form.Item>

            <Form.Item name="notes" label="Notes (Optional)">
              <Input.TextArea rows={2} placeholder="Optional payment remarks or customer notes" />
            </Form.Item>

            <Form.Item style={{ marginBottom: 0, marginTop: 16 }}>
              <Space wrap style={{ width: '100%', justifyContent: 'flex-end' }}>
                <Button
                  disabled={submitting}
                  onClick={() => {
                    onClose();
                    form.resetFields();
                    setCustomAmountEntered(null);
                    setSubmitError(null);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={submitting}
                  disabled={submitting}
                  style={{ backgroundColor: '#1677ff', fontWeight: 600 }}
                >
                  Confirm & Record Payment
                </Button>
              </Space>
            </Form.Item>
          </Form>
        )}
      </Modal>

      {/* Official Payment Receipt Modal */}
      <PaymentReceiptModal
        open={receiptModalOpen}
        onClose={() => setReceiptModalOpen(false)}
        receipt={receiptData}
      />
    </>
  );
};
