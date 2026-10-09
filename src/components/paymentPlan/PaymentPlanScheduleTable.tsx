// src/components/paymentPlan/PaymentPlanScheduleTable.tsx
import React, { useState, useMemo } from 'react';
import {
  Table,
  Tag,
  Button,
  Space,
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  DatePicker,
  Radio,
  Checkbox,
  Tooltip,
  Typography,
  Card,
  Popconfirm,
  message,
  Divider,
  Segmented,
  Row,
  Col,
  Alert,
} from 'antd';
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  WarningOutlined,
  DollarOutlined,
  ThunderboltOutlined,
  InfoCircleOutlined,
  OrderedListOutlined,
  ExclamationCircleOutlined,
  HistoryOutlined,
  EyeOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useQueryClient } from '@tanstack/react-query';
import apiClient from '@/api/client';
import { paymentPlansKeys, usePaymentPlanQuery, useInstallmentsQuery } from '@/api/paymentPlans';
import { recordPlanPaymentWithBackend } from '@/api/paymentPlansPersistence';
import { dispatchPaymentReceiptSMS } from '@/utils/paymentNotificationService';
import type { PaymentPlan, Installment, PaymentMethod } from '@/types';
import {
  buildPaymentPlanSchedule,
  recordLocalInstallmentPayment,
  usePaymentPlanScheduleListener,
  getOrdinal,
  type ScheduleInstallmentRow,
  type PlanPaymentTransaction,
} from '@/utils/paymentPlanSchedule';
import { PaymentReceiptModal, type PaymentReceiptData } from './PaymentReceiptModal';
import { tokens } from '@/constants/tokens';

const { Text, Title, Paragraph } = Typography;
const { Option } = Select;

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface PaymentPlanScheduleTableProps {
  plan: Partial<PaymentPlan> & { id: string };
  installments?: Installment[];
  customerName?: string;
  customerPhone?: string;
  propertyName?: string;
  onRecordPayment?: (values: {
    sequence: number;
    amountMinor: number;
    paidOn: string;
    method: PaymentMethod | string;
    reference?: string;
  }) => Promise<any> | void;
  readOnly?: boolean;
  compact?: boolean;
  defaultSort?: 'priority' | 'sequence';
}

export const PaymentPlanScheduleTable: React.FC<PaymentPlanScheduleTableProps> = ({
  plan,
  installments = [],
  customerName,
  customerPhone,
  propertyName,
  onRecordPayment,
  readOnly = false,
  compact = false,
  defaultSort,
}) => {
  const queryClient = useQueryClient();
  // Listen for local updates so all instances stay in sync
  usePaymentPlanScheduleListener();

  const isRealUuid = Boolean(plan?.id && UUID_REGEX.test(plan.id));
  const { data: planDetail, refetch: refetchPlanDetail } = usePaymentPlanQuery(isRealUuid ? plan.id : undefined);
  const { data: fetchedInstallments, refetch: refetchInstallments } = useInstallmentsQuery(isRealUuid ? plan.id : undefined);

  const resolvedInstallments = useMemo(() => {
    if (installments && installments.length > 0) return installments;
    if (fetchedInstallments && fetchedInstallments.length > 0) return fetchedInstallments;
    if (planDetail?.installments && planDetail.installments.length > 0) return planDetail.installments;
    return [];
  }, [installments, fetchedInstallments, planDetail]);

  const resolvedPayments = useMemo(() => {
    const list =
      (planDetail as any)?.recentPayments ||
      (planDetail as any)?.payments ||
      (plan as any)?.recentPayments ||
      (plan as any)?.payments ||
      [];
    return Array.isArray(list) ? list : [];
  }, [planDetail, plan]);

  const mergedPlan = useMemo(() => {
    return planDetail ? { ...plan, ...planDetail } : plan;
  }, [plan, planDetail]);

  const [activeTab, setActiveTab] = useState<'schedule' | 'ledger'>('schedule');
  const [recordModalOpen, setRecordModalOpen] = useState(false);
  const [selectedRow, setSelectedRow] = useState<ScheduleInstallmentRow | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [customAmountEntered, setCustomAmountEntered] = useState<number | null>(null);
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [receiptData, setReceiptData] = useState<PaymentReceiptData | null>(null);
  const [form] = Form.useForm();

  // Schedule info computed from plan, installments, and backend payments
  const scheduleInfo = useMemo(() => {
    return buildPaymentPlanSchedule(mergedPlan, resolvedInstallments, resolvedPayments);
  }, [mergedPlan, resolvedInstallments, resolvedPayments]);

  // Sort mode: default to 'priority' if there are overdue/due items, else 'sequence'
  const [sortMode, setSortMode] = useState<'priority' | 'sequence'>(
    defaultSort || (scheduleInfo.hasOverdue ? 'priority' : 'sequence')
  );

  // Sorted rows based on sort mode
  const displayRows = useMemo(() => {
    const list = [...scheduleInfo.rows];
    if (sortMode === 'priority') {
      // Overdue (0) -> Due Today (1) -> Upcoming (2) -> Completed (3), then by sequence
      return list.sort((a, b) => {
        if (a.priorityScore !== b.priorityScore) {
          return a.priorityScore - b.priorityScore;
        }
        return a.sequence - b.sequence;
      });
    }
    // Normal chronological contract order: 1st -> 2nd -> 3rd -> ...
    return list.sort((a, b) => a.sequence - b.sequence);
  }, [scheduleInfo.rows, sortMode]);

  const openRecordModal = (row: ScheduleInstallmentRow) => {
    setSelectedRow(row);
    const defaultAmount = row.isPartiallyPaid && row.deficitGHS > 0 ? row.deficitGHS : row.installmentGHS;
    setCustomAmountEntered(defaultAmount);
    form.setFieldsValue({
      amountGHS: defaultAmount,
      paidOn: dayjs(),
      method: 'bank_transfer',
      reference: `INST-${row.sequence}-${Date.now().toString().slice(-4)}`,
      notes: `${row.ordinal} installment payment`,
    });
    setRecordModalOpen(true);
  };

  const handleQuickPay = async (row: ScheduleInstallmentRow) => {
    try {
      const amountGHS = row.isPartiallyPaid && row.deficitGHS > 0 ? row.deficitGHS : row.installmentGHS;
      const amountMinor = Math.round(amountGHS * 100);
      const paidOn = new Date().toISOString();
      const method = 'bank_transfer';
      const reference = `QUICK-${row.sequence}-${Date.now().toString().slice(-4)}`;

      // 1. Persist permanently to backend database, save local override, and dispatch SMS prompt
      const result = await recordPlanPaymentWithBackend(
        plan,
        {
          amountMinor,
          paidOn,
          method,
          reference,
          sequence: row.sequence,
          installmentOrdinal: row.ordinal,
        },
        {
          name: customerName || (plan as any).customerName || (plan as any).name,
          phone: customerPhone || (plan as any).customerPhone || (plan as any).phone,
          propertyName: propertyName || (plan as any).propertyName,
        }
      );

      // Invalidate queries so that real backend balances and plans refresh across all pages
      queryClient.invalidateQueries({ queryKey: paymentPlansKeys.all });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['secretary-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['accounts-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      refetchPlanDetail();
      refetchInstallments();

      // 2. Call parent callback if provided
      if (onRecordPayment) {
        await onRecordPayment({
          sequence: row.sequence,
          amountMinor,
          paidOn,
          method,
          reference,
        });
      }

      if (result.isOverpayment) {
        message.success(
          `Quick payment for ${row.ordinal} recorded! ₵${(result.surplusAppliedMinor / 100).toFixed(2)} surplus dynamically credited to future installments. Remaining balance: ₵${(result.newBalanceMinor / 100).toFixed(2)}.`
        );
      } else if (result.isPartialPayment) {
        message.warning(
          `Recorded partial payment of ₵${amountGHS.toFixed(2)}. ₵${(result.deficitRolledOverMinor / 100).toFixed(2)} deficit rolled forward into subsequent installment. Remaining balance: ₵${(result.newBalanceMinor / 100).toFixed(2)}.`
        );
      } else {
        message.success(
          `Recorded payment for ${row.ordinal} installment (₵${amountGHS.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})! Remaining balance: ₵${(result.newBalanceMinor / 100).toFixed(2)}.`
        );
      }
    } catch (err: any) {
      message.error(err?.message || 'Failed to record installment payment');
    }
  };

  const handleSubmitPayment = async (values: any) => {
    if (!selectedRow) return;
    setSubmitting(true);
    try {
      const defaultAmt = selectedRow.isPartiallyPaid && selectedRow.deficitGHS > 0 ? selectedRow.deficitGHS : selectedRow.installmentGHS;
      const amountGHS = values.amountGHS !== undefined && values.amountGHS !== null ? values.amountGHS : defaultAmt;
      const amountMinor = Math.round(amountGHS * 100);
      const paidOn = values.paidOn ? values.paidOn.toISOString() : new Date().toISOString();
      const method = values.method || 'bank_transfer';
      const reference = values.reference || `REC-${Date.now().toString().slice(-6)}`;

      // 1. Persist permanently to backend database, save local override, and dispatch SMS prompt
      const result = await recordPlanPaymentWithBackend(
        plan,
        {
          amountMinor,
          paidOn,
          method,
          reference,
          sequence: selectedRow.sequence,
          installmentOrdinal: selectedRow.ordinal,
          notes: values.notes,
        },
        {
          name: customerName || (plan as any).customerName || (plan as any).name,
          phone: customerPhone || (plan as any).customerPhone || (plan as any).phone,
          propertyName: propertyName || (plan as any).propertyName,
        }
      );

      queryClient.invalidateQueries({ queryKey: paymentPlansKeys.all });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['secretary-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['accounts-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      refetchPlanDetail();
      refetchInstallments();

      // 2. Call parent callback if provided
      if (onRecordPayment) {
        await onRecordPayment({
          sequence: selectedRow.sequence,
          amountMinor,
          paidOn,
          method,
          reference,
        });
      }

      if (result.isOverpayment) {
        message.success(
          `Payment of ₵${amountGHS.toFixed(2)} recorded! ₵${(result.surplusAppliedMinor / 100).toFixed(2)} surplus advance dynamically applied to future installments. Remaining balance: ₵${(result.newBalanceMinor / 100).toFixed(2)}.`
        );
      } else if (result.isPartialPayment) {
        message.warning(
          `Partial payment of ₵${amountGHS.toFixed(2)} recorded. ₵${(result.deficitRolledOverMinor / 100).toFixed(2)} deficit rolled forward into subsequent installment. Remaining balance: ₵${(result.newBalanceMinor / 100).toFixed(2)}.`
        );
      } else {
        message.success(
          `Payment of ₵${amountGHS.toFixed(2)} recorded successfully! Remaining balance: ₵${(result.newBalanceMinor / 100).toFixed(2)}.`
        );
      }

      // Prepare receipt data
      setReceiptData({
        receiptNumber: result.receiptNumber || reference,
        customerName: customerName || (plan as any).customerName || (plan as any).name || 'Customer',
        customerPhone: customerPhone || (plan as any).customerPhone,
        propertyName: propertyName || (plan as any).propertyName,
        amountPaidGHS: amountGHS,
        paymentDate: dayjs(paidOn).format('YYYY-MM-DD'),
        paymentMethod: method,
        reference,
        planId: plan.id,
        installmentOrdinal: result.installmentOrdinal || selectedRow.ordinal,
        installmentSequence: result.sequence || selectedRow.sequence,
        expectedAmountGHS: selectedRow.installmentGHS,
        isPartialPayment: result.isPartialPayment,
        isOverpayment: result.isOverpayment,
        deficitRolledOverGHS: result.deficitRolledOverMinor / 100,
        surplusAppliedGHS: result.surplusAppliedMinor / 100,
        newOutstandingBalanceGHS: result.newBalanceMinor / 100,
        totalContractGHS: (plan.totalAmountMinor || scheduleInfo.totalAmountMinor || 0) / 100,
      });

      setRecordModalOpen(false);
      form.resetFields();
      setSelectedRow(null);
      setCustomAmountEntered(null);
      setReceiptModalOpen(true);
    } catch (err: any) {
      message.error(err?.message || 'Failed to record payment');
    } finally {
      setSubmitting(false);
    }
  };

  const ledgerColumns: any[] = [
    {
      title: 'Date & Time',
      dataIndex: 'paidOn',
      key: 'paidOn',
      width: 155,
      render: (val: string) => dayjs(val).format('D MMM YYYY, HH:mm'),
    },
    {
      title: 'Receipt / Ref',
      dataIndex: 'reference',
      key: 'reference',
      width: 145,
      render: (ref: string) => <Text copyable={{ text: ref }} strong>{ref || '—'}</Text>,
    },
    {
      title: 'Target Inst.',
      dataIndex: 'sequence',
      key: 'sequence',
      width: 120,
      align: 'center' as const,
      render: (seq: number) => <Tag color="blue">{seq ? `${getOrdinal(seq)} Installment` : 'General'}</Tag>,
    },
    {
      title: 'Amount Paid (₵)',
      dataIndex: 'amountMinor',
      key: 'amountMinor',
      width: 150,
      align: 'right' as const,
      render: (minor: number) => (
        <Text strong style={{ color: '#52c41a' }}>
          ₵{(minor / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </Text>
      ),
    },
    {
      title: 'Method',
      dataIndex: 'method',
      key: 'method',
      width: 135,
      render: (m: string) => <Tag>{String(m || 'bank_transfer').replace('_', ' ').toUpperCase()}</Tag>,
    },
    {
      title: 'Dynamic Adjustment & Ledger Notes',
      key: 'notes',
      render: (_: any, tx: PlanPaymentTransaction) => {
        const isOver = tx.effect === 'overpayment' || (tx.surplusAppliedMinor || 0) > 0;
        const isUnder = tx.effect === 'underpayment' || (tx.deficitMinor || 0) > 0;
        return (
          <Space direction="vertical" size={2}>
            {isOver && (
              <Tag color="green" icon={<CheckCircleOutlined />}>
                ✨ Surplus Advance: +₵{((tx.surplusAppliedMinor || 0) / 100).toFixed(2)} applied
              </Tag>
            )}
            {isUnder && (
              <Tag color="volcano" icon={<ClockCircleOutlined />}>
                ⚠️ Deficit Rollover: -₵{((tx.deficitMinor || 0) / 100).toFixed(2)} rolled over
              </Tag>
            )}
            {!isOver && !isUnder && (
              <Tag color="blue">✅ Full Installment Settled</Tag>
            )}
            {tx.notes && (
              <Text type="secondary" style={{ fontSize: 11 }}>
                {tx.notes}
              </Text>
            )}
          </Space>
        );
      },
    },
    {
      title: 'Balance After (₵)',
      dataIndex: 'balanceAfterMinor',
      key: 'balanceAfterMinor',
      width: 160,
      align: 'right' as const,
      render: (val?: number) =>
        val !== undefined ? (
          <Text strong>
            ₵{(val / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </Text>
        ) : (
          <Text type="secondary">—</Text>
        ),
    },
    {
      title: 'Receipt',
      key: 'receipt',
      width: 90,
      align: 'center' as const,
      render: (_: any, tx: PlanPaymentTransaction) => (
        <Button
          size="small"
          icon={<EyeOutlined />}
          onClick={() => {
            setReceiptData({
              receiptNumber: tx.reference || `REC-${tx.id}`,
              customerName: customerName || (plan as any).customerName || (plan as any).name || 'Customer',
              customerPhone: customerPhone || (plan as any).customerPhone,
              propertyName: propertyName || (plan as any).propertyName,
              amountPaidGHS: tx.amountMinor / 100,
              paymentDate: dayjs(tx.paidOn).format('YYYY-MM-DD'),
              paymentMethod: String(tx.method),
              reference: tx.reference,
              planId: plan.id,
              installmentOrdinal: tx.sequence ? getOrdinal(tx.sequence) : '1st',
              installmentSequence: tx.sequence || 1,
              expectedAmountGHS: tx.amountMinor / 100,
              isPartialPayment: tx.effect === 'underpayment',
              isOverpayment: tx.effect === 'overpayment',
              deficitRolledOverGHS: (tx.deficitMinor || 0) / 100,
              surplusAppliedGHS: (tx.surplusAppliedMinor || 0) / 100,
              newOutstandingBalanceGHS: (tx.balanceAfterMinor || 0) / 100,
              totalContractGHS: (plan.totalAmountMinor || scheduleInfo.totalAmountMinor || 0) / 100,
            });
            setReceiptModalOpen(true);
          }}
        >
          View
        </Button>
      ),
    },
  ];

  const columns: any[] = [
    {
      title: 'Inst.',
      dataIndex: 'ordinal',
      key: 'ordinal',
      width: 85,
      align: 'center' as const,
      render: (ordinal: string, record: ScheduleInstallmentRow) => {
        return (
          <Space size={4} align="center">
            {record.isOverdue && (
              <Tooltip title="Payment is overdue!">
                <WarningOutlined style={{ color: '#ff4d4f', fontSize: 13 }} />
              </Tooltip>
            )}
            {record.isDueToday && (
              <Tooltip title="Payment is due today">
                <ClockCircleOutlined style={{ color: '#faad14', fontSize: 13 }} />
              </Tooltip>
            )}
            <Text strong style={{ color: record.isOverdue ? '#cf1322' : undefined }}>
              {ordinal}
            </Text>
          </Space>
        );
      },
    },
    {
      title: 'Due Date',
      dataIndex: 'dueDateFormatted',
      key: 'dueDate',
      width: 140,
      render: (dateStr: string, record: ScheduleInstallmentRow) => {
        if (record.isOverdue) {
          return (
            <Text strong style={{ color: '#cf1322' }}>
              {dateStr}
            </Text>
          );
        }
        if (record.isDueToday) {
          return (
            <Text strong style={{ color: '#d48806' }}>
              {dateStr}
            </Text>
          );
        }
        return <Text>{dateStr}</Text>;
      },
    },
    {
      title: 'Installment (₵)',
      dataIndex: 'installmentGHS',
      key: 'installment',
      width: 170,
      align: 'right' as const,
      render: (val: number, record: ScheduleInstallmentRow) => (
        <Space direction="vertical" size={2} align="end">
          <Text strong style={{ color: record.isOverdue ? '#cf1322' : undefined }}>
            {val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </Text>
          {record.deficitMinor > 0 && (
            <Tooltip title={`Includes GH₵ ${record.deficitGHS.toLocaleString('en-US', { minimumFractionDigits: 2 })} unpaid deficit rolled over from partial payment`}>
              <Tag color="volcano" style={{ fontSize: 10, margin: 0, padding: '0 4px' }}>
                +GH₵ {record.deficitGHS.toFixed(0)} deficit
              </Tag>
            </Tooltip>
          )}
          {record.surplusAppliedMinor > 0 && (
            <Tooltip title={`Reduced by GH₵ ${record.surplusAppliedGHS.toLocaleString('en-US', { minimumFractionDigits: 2 })} surplus advance from overpayment`}>
              <Tag color="cyan" style={{ fontSize: 10, margin: 0, padding: '0 4px' }}>
                -GH₵ {record.surplusAppliedGHS.toFixed(0)} surplus
              </Tag>
            </Tooltip>
          )}
        </Space>
      ),
    },
    {
      title: 'Accumulated (₵)',
      dataIndex: 'accumulatedGHS',
      key: 'accumulated',
      width: 160,
      align: 'right' as const,
      render: (val: number) => (
        <Text type="secondary">
          {val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </Text>
      ),
    },
    {
      title: 'Remaining Balance (₵)',
      dataIndex: 'remainingBalanceGHS',
      key: 'remainingBalance',
      width: 180,
      align: 'right' as const,
      render: (val: number, record: ScheduleInstallmentRow) => {
        const isFinal = record.sequence === scheduleInfo.numMonths;
        return (
          <Text strong={isFinal || val === 0} style={{ color: val === 0 ? '#52c41a' : undefined }}>
            {val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </Text>
        );
      },
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 130,
      align: 'center' as const,
      render: (_: any, record: ScheduleInstallmentRow) => {
        if (record.isPaid) {
          return (
            <Tooltip title={record.paidAt ? `Paid on ${dayjs(record.paidAt).format('DD MMM YYYY')}` : 'Paid'}>
              <Tag color="green" icon={<CheckCircleOutlined />}>
                Paid
              </Tag>
            </Tooltip>
          );
        }
        if (record.isPartiallyPaid || record.status === 'partially_paid') {
          return (
            <Tooltip
              title={`Partially Paid: GH₵ ${(record.paidAmountGHS || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} credited. Remaining deficit of GH₵ ${(record.deficitGHS || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} rolled over.`}
            >
              <Tag color="orange" icon={<ClockCircleOutlined />}>
                Partially Paid
              </Tag>
            </Tooltip>
          );
        }
        if (record.isOverdue) {
          return (
            <Tag color="red" icon={<WarningOutlined />}>
              Overdue
            </Tag>
          );
        }
        if (record.isDueToday) {
          return (
            <Tag color="gold" icon={<ClockCircleOutlined />}>
              Due Today
            </Tag>
          );
        }
        return <Tag color="blue">Upcoming</Tag>;
      },
    },
  ];

  // Actions column with Checkbox and Button
  if (!readOnly) {
    columns.push({
      title: 'Actions',
      key: 'actions',
      width: 190,
      fixed: 'right' as const,
      render: (_: any, record: ScheduleInstallmentRow) => {
        if (record.isPaid) {
          return (
            <Space size={8} align="center">
              <Tooltip title={`Paid on ${record.paidAt ? dayjs(record.paidAt).format('DD MMM YYYY') : 'record'}`}>
                <Checkbox checked disabled style={{ cursor: 'default' }} />
              </Tooltip>
              <Text type="secondary" style={{ fontSize: 12 }}>
                Paid {record.paidAt ? dayjs(record.paidAt).format('DD/MM/YY') : ''}
              </Text>
            </Space>
          );
        }

        return (
          <Space size={8} align="center">
            {/* Quick Checkbox Action */}
            <Popconfirm
              title={`Quick Record Payment`}
              description={`Record ₵${record.installmentGHS.toLocaleString('en-US', { minimumFractionDigits: 2 })} for ${record.ordinal} installment?`}
              okText="Yes, Record"
              cancelText="Cancel"
              icon={<ExclamationCircleOutlined style={{ color: tokens.primary }} />}
              onConfirm={() => handleQuickPay(record)}
            >
              <Tooltip title={`Check to quickly record ${record.ordinal} installment payment`}>
                <Checkbox checked={false} />
              </Tooltip>
            </Popconfirm>

            {/* Record Payment Button */}
            <Button
              type={record.isOverdue ? 'primary' : 'default'}
              danger={record.isOverdue}
              size="small"
              icon={<DollarOutlined />}
              onClick={() => openRecordModal(record)}
              style={{
                borderRadius: 4,
                fontSize: 12,
              }}
            >
              {record.isPartiallyPaid ? 'Pay Deficit' : 'Record Payment'}
            </Button>
          </Space>
        );
      },
    });
  }

  return (
    <div style={{ width: '100%' }}>
      {/* Official Agreement Header Card (Matching Screenshot) */}
      <Card
        size="small"
        style={{
          marginBottom: 16,
          background: scheduleInfo.hasOverdue ? '#fffdfd' : '#fcfdff',
          borderColor: scheduleInfo.hasOverdue ? '#ffccc7' : '#e6f4ff',
          borderRadius: 8,
        }}
      >
        <div style={{ marginBottom: 10 }}>
          <Space wrap align="center" style={{ width: '100%', justifyContent: 'space-between' }}>
            <Title level={5} style={{ margin: 0, color: '#1f1f1f' }}>
              Payment Plan Schedule:
            </Title>
            <Space wrap>
              {scheduleInfo.hasOverdue && (
                <Tag color="red" icon={<WarningOutlined />}>
                  {scheduleInfo.overdueCount} Overdue
                </Tag>
              )}
              <Tag color="blue">
                {scheduleInfo.paidCount} of {scheduleInfo.numMonths} Paid
              </Tag>
              <Tag color="cyan">
                ₵{scheduleInfo.totalPaidGHS.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Total Paid
              </Tag>
              <Tag color="green">
                ₵{scheduleInfo.currentBalanceGHS.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Remaining Balance
              </Tag>
              {scheduleInfo.overpaymentCreditGHS > 0 && (
                <Tag color="purple">
                  +₵{scheduleInfo.overpaymentCreditGHS.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Credit Advance
                </Tag>
              )}
            </Space>
          </Space>
        </div>

        <Paragraph style={{ margin: '0 0 8px 0', fontSize: 13.5, lineHeight: 1.6, color: '#262626' }}>
          {scheduleInfo.agreementLeadText}
        </Paragraph>

        <Paragraph style={{ margin: '0 0 12px 0', fontSize: 13, color: '#595959', fontStyle: 'italic' }}>
          {scheduleInfo.agreementDueText}
        </Paragraph>

        <Divider style={{ margin: '8px 0 12px 0' }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          {/* View Tab Switcher: Schedule vs Real-Time Ledger */}
          <Segmented
            value={activeTab}
            onChange={(val) => setActiveTab(val as 'schedule' | 'ledger')}
            options={[
              {
                value: 'schedule',
                label: (
                  <Space size={4}>
                    <OrderedListOutlined />
                    <span>Installment Schedule ({scheduleInfo.rows.length})</span>
                  </Space>
                ),
              },
              {
                value: 'ledger',
                label: (
                  <Space size={4}>
                    <HistoryOutlined />
                    <span>Real-Time Ledger ({scheduleInfo.transactions?.length || 0})</span>
                  </Space>
                ),
              },
            ]}
          />

          {/* Sort Mode Controls (shown when Schedule is active) */}
          {activeTab === 'schedule' && (
            <Radio.Group
              size="small"
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value)}
              buttonStyle="solid"
            >
              <Radio.Button value="priority">
                <Space size={4}>
                  <ThunderboltOutlined style={{ color: scheduleInfo.hasOverdue ? '#ff4d4f' : undefined }} />
                  <span>Overdue First</span>
                  {scheduleInfo.hasOverdue && (
                    <span style={{ color: '#ff4d4f', fontWeight: 'bold' }}>({scheduleInfo.overdueCount})</span>
                  )}
                </Space>
              </Radio.Button>
              <Radio.Button value="sequence">
                <Space size={4}>
                  <OrderedListOutlined />
                  <span>Contract Order (1st - {scheduleInfo.numMonths}th)</span>
                </Space>
              </Radio.Button>
            </Radio.Group>
          )}
        </div>
      </Card>

      {/* Main Content: Schedule Table or Real-Time Ledger Table */}
      {activeTab === 'schedule' ? (
        <Table
          columns={columns}
          dataSource={displayRows}
          rowKey="id"
          pagination={false}
          size={compact ? 'small' : 'middle'}
          scroll={{ x: 920 }}
          rowClassName={(record: ScheduleInstallmentRow) => {
            if (record.isOverdue) return 'payment-plan-overdue-row';
            if (record.isDueToday) return 'payment-plan-due-today-row';
            if (record.isPaid) return 'payment-plan-paid-row';
            return '';
          }}
          bordered
        />
      ) : (
        <Table
          columns={ledgerColumns}
          dataSource={scheduleInfo.transactions}
          rowKey="id"
          pagination={{ pageSize: 8, showTotal: (total) => `Total ${total} ledger entries` }}
          size={compact ? 'small' : 'middle'}
          scroll={{ x: 960 }}
          bordered
        />
      )}

      {/* Embedded CSS for highlighting rows */}
      <style>{`
        .payment-plan-overdue-row {
          background-color: #fff1f0 !important;
        }
        .payment-plan-overdue-row:hover > td {
          background-color: #ffe8e6 !important;
        }
        .payment-plan-due-today-row {
          background-color: #fffbe6 !important;
        }
        .payment-plan-due-today-row:hover > td {
          background-color: #fff1b8 !important;
        }
        .payment-plan-paid-row {
          opacity: 0.88;
        }
      `}</style>

      {/* Record Payment Modal */}
      <Modal
        title={
          <Space>
            <DollarOutlined style={{ color: tokens.primary }} />
            <Text strong>
              Record Payment — {selectedRow?.ordinal} Installment (Dynamic Recalculation Engine)
            </Text>
          </Space>
        }
        open={recordModalOpen}
        onCancel={() => {
          setRecordModalOpen(false);
          form.resetFields();
          setSelectedRow(null);
          setCustomAmountEntered(null);
        }}
        footer={null}
        width={560}
        style={{ maxWidth: '95%', top: 24 }}
        destroyOnClose
      >
        {selectedRow && (() => {
          const expectedGHS = selectedRow.isPartiallyPaid && selectedRow.deficitGHS > 0
            ? selectedRow.deficitGHS
            : selectedRow.installmentGHS;
          const currentAmt = customAmountEntered !== null ? customAmountEntered : expectedGHS;
          const isOver = currentAmt > expectedGHS + 0.009;
          const isUnder = currentAmt < expectedGHS - 0.009 && currentAmt > 0;
          const surplus = isOver ? currentAmt - expectedGHS : 0;
          const deficit = isUnder ? expectedGHS - currentAmt : 0;
          const newOutstanding = Math.max(0, scheduleInfo.currentBalanceGHS - currentAmt);

          return (
            <Form
              form={form}
              layout="vertical"
              onFinish={handleSubmitPayment}
              initialValues={{
                amountGHS: expectedGHS,
                paidOn: dayjs(),
                method: 'bank_transfer',
                reference: `INST-${selectedRow.sequence}-${Date.now().toString().slice(-4)}`,
              }}
            >
              <div
                style={{
                  background: selectedRow.isOverdue ? '#fff2f0' : '#f8fafc',
                  border: `1px solid ${selectedRow.isOverdue ? '#ffccc7' : '#e2e8f0'}`,
                  borderRadius: 8,
                  padding: '12px 14px',
                  marginBottom: 14,
                }}
              >
                <Space direction="vertical" size={3} style={{ width: '100%' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Text type="secondary">Customer & Property:</Text>
                    <Text strong>{customerName || 'Valued Customer'}{propertyName ? ` • ${propertyName}` : ''}</Text>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Text type="secondary">Installment Sequence:</Text>
                    <Text strong>{selectedRow.sequence} ({selectedRow.ordinal})</Text>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Text type="secondary">Due Date:</Text>
                    <Text strong style={{ color: selectedRow.isOverdue ? '#cf1322' : undefined }}>
                      {selectedRow.dueDateFormatted} {selectedRow.isOverdue ? '(Overdue)' : ''}
                    </Text>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Text type="secondary">Base Monthly Installment:</Text>
                    <Text>
                      ₵{selectedRow.baseInstallmentGHS.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </Text>
                  </div>
                  {selectedRow.surplusAppliedGHS > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#16a34a' }}>
                      <Text type="secondary" style={{ color: '#16a34a' }}>Surplus Advance Applied:</Text>
                      <Text strong style={{ color: '#16a34a' }}>
                        -₵{selectedRow.surplusAppliedGHS.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </Text>
                    </div>
                  )}
                  {selectedRow.deficitGHS > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#d97706' }}>
                      <Text type="secondary" style={{ color: '#d97706' }}>Unpaid Deficit Rollover:</Text>
                      <Text strong style={{ color: '#d97706' }}>
                        +₵{selectedRow.deficitGHS.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </Text>
                    </div>
                  )}
                  <Divider style={{ margin: '4px 0' }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Text strong>Net Due for this Installment:</Text>
                    <Text strong style={{ fontSize: 15, color: '#1677ff' }}>
                      ₵{expectedGHS.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </Text>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Text type="secondary">Current Outstanding Balance:</Text>
                    <Text strong>
                      ₵{scheduleInfo.currentBalanceGHS.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </Text>
                  </div>
                </Space>
              </div>

              {/* Dynamic Real-time Recalculation Alert */}
              {isUnder && (
                <Alert
                  type="warning"
                  showIcon
                  style={{ marginBottom: 14, borderRadius: 8 }}
                  message={<span style={{ fontWeight: 700 }}>⚠️ Underpayment / Partial Payment Detected</span>}
                  description={
                    <div style={{ fontSize: 12, marginTop: 4 }}>
                      <div>• Credited & Deducted: <strong>₵{currentAmt.toFixed(2)}</strong> (Installment marked as <Tag color="orange" style={{ margin: '0 4px' }}>Partially Paid</Tag>)</div>
                      <div>• Unpaid Deficit Rolled Forward: <strong style={{ color: '#d97706' }}>₵{deficit.toFixed(2)}</strong></div>
                      <div style={{ marginTop: 4, fontStyle: 'italic', color: '#b45309' }}>
                        &rarr; Dynamic Amortization: Deficit of ₵{deficit.toFixed(2)} will automatically roll over into subsequent monthly installment(s).
                      </div>
                      <div style={{ marginTop: 4, fontWeight: 600 }}>• Total Outstanding Balance: ₵{newOutstanding.toFixed(2)}</div>
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
                      <div>• Credited & Deducted: <strong>₵{currentAmt.toFixed(2)}</strong> (Installment marked as <Tag color="green" style={{ margin: '0 4px' }}>Paid</Tag>)</div>
                      <div>• Surplus Advance: <strong style={{ color: '#16a34a' }}>₵{surplus.toFixed(2)}</strong></div>
                      <div style={{ marginTop: 4, fontStyle: 'italic', color: '#15803d' }}>
                        &rarr; Dynamic Amortization: Surplus of ₵{surplus.toFixed(2)} will automatically apply against future scheduled installment(s), dynamically reducing upcoming payments.
                      </div>
                      <div style={{ marginTop: 4, fontWeight: 600 }}>• Total Outstanding Balance: ₵{newOutstanding.toFixed(2)}</div>
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
                      <div>• Full installment of <strong>₵{currentAmt.toFixed(2)}</strong> will be credited and deducted.</div>
                      <div style={{ fontWeight: 600, marginTop: 4 }}>• Total Outstanding Balance: ₵{newOutstanding.toFixed(2)}</div>
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
                    Exact (₵{expectedGHS.toFixed(2)})
                  </Button>
                  <Button
                    size="small"
                    onClick={() => {
                      const half = Number((expectedGHS / 2).toFixed(2));
                      form.setFieldsValue({ amountGHS: half });
                      setCustomAmountEntered(half);
                    }}
                  >
                    50% Partial (₵{(expectedGHS / 2).toFixed(2)})
                  </Button>
                  {scheduleInfo.currentBalanceGHS >= 5000 && expectedGHS !== 5000 && (
                    <Button
                      size="small"
                      onClick={() => {
                        form.setFieldsValue({ amountGHS: 5000 });
                        setCustomAmountEntered(5000);
                      }}
                    >
                      Custom ₵5,000.00
                    </Button>
                  )}
                  <Button
                    size="small"
                    type="dashed"
                    onClick={() => {
                      const full = Number(scheduleInfo.currentBalanceGHS.toFixed(2));
                      form.setFieldsValue({ amountGHS: full });
                      setCustomAmountEntered(full);
                    }}
                  >
                    Clear Balance (₵{scheduleInfo.currentBalanceGHS.toFixed(2)})
                  </Button>
                </Space>
              </div>

              <Form.Item
                name="amountGHS"
                label="Amount Paid (GHS / ₵) — Enter Any Custom Amount"
                rules={[{ required: true, message: 'Payment amount is required' }]}
                extra="Dynamic engine automatically recalculates balances: underpayments carry deficit forward; overpayments reduce future scheduled installments."
              >
                <InputNumber
                  style={{ width: '100%' }}
                  prefix="₵"
                  precision={2}
                  min={0.01}
                  placeholder="e.g. 5000.00"
                  onChange={(val) => setCustomAmountEntered(val ?? null)}
                />
              </Form.Item>

              <Form.Item
                name="paidOn"
                label="Payment Date"
                rules={[{ required: true, message: 'Please select payment date' }]}
              >
                <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
              </Form.Item>

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

              <Form.Item name="reference" label="Reference / Receipt Number">
                <Input placeholder="e.g., MTN-192849204 or Bank TXN ref" />
              </Form.Item>

              <Form.Item name="notes" label="Notes (Optional)">
                <Input.TextArea rows={2} placeholder="Optional payment remarks" />
              </Form.Item>

              <Form.Item style={{ marginBottom: 0, marginTop: 16 }}>
                <Space wrap style={{ width: '100%', justifyContent: 'flex-end' }}>
                  <Button
                    onClick={() => {
                      setRecordModalOpen(false);
                      form.resetFields();
                      setSelectedRow(null);
                      setCustomAmountEntered(null);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button type="primary" htmlType="submit" loading={submitting} style={{ background: '#1677ff', fontWeight: 600 }}>
                    Confirm & Record Payment
                  </Button>
                </Space>
              </Form.Item>
            </Form>
          );
        })()}
      </Modal>

      {/* Official Payment Receipt Modal */}
      <PaymentReceiptModal
        open={receiptModalOpen}
        onClose={() => setReceiptModalOpen(false)}
        receipt={receiptData}
      />
    </div>
  );
};
