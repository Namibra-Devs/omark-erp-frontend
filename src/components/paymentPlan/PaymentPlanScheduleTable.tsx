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
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useQueryClient } from '@tanstack/react-query';
import apiClient from '@/api/client';
import { paymentPlansKeys } from '@/api/paymentPlans';
import { recordPlanPaymentWithBackend } from '@/api/paymentPlansPersistence';
import { dispatchPaymentReceiptSMS } from '@/utils/paymentNotificationService';
import type { PaymentPlan, Installment, PaymentMethod } from '@/types';
import {
  buildPaymentPlanSchedule,
  recordLocalInstallmentPayment,
  usePaymentPlanScheduleListener,
  type ScheduleInstallmentRow,
} from '@/utils/paymentPlanSchedule';
import { tokens } from '@/constants/tokens';

const { Text, Title, Paragraph } = Typography;
const { Option } = Select;

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

  const [recordModalOpen, setRecordModalOpen] = useState(false);
  const [selectedRow, setSelectedRow] = useState<ScheduleInstallmentRow | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();

  // Schedule info computed from plan and installments
  const scheduleInfo = useMemo(() => {
    return buildPaymentPlanSchedule(plan, installments);
  }, [plan, installments]);

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
    form.setFieldsValue({
      amountGHS: row.installmentGHS,
      paidOn: dayjs(),
      method: 'bank_transfer',
      reference: `INST-${row.sequence}-${Date.now().toString().slice(-4)}`,
      notes: `${row.ordinal} installment payment`,
    });
    setRecordModalOpen(true);
  };

  const handleQuickPay = async (row: ScheduleInstallmentRow) => {
    try {
      const amountMinor = row.installmentMinor;
      const paidOn = new Date().toISOString();
      const method = 'bank_transfer';
      const reference = `QUICK-${row.sequence}-${Date.now().toString().slice(-4)}`;

      // 1. Persist permanently to backend database, save local override, and dispatch SMS prompt
      await recordPlanPaymentWithBackend(
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

      message.success(`Recorded payment for ${row.ordinal} installment (₵${row.installmentGHS.toLocaleString()})!`);
    } catch (err: any) {
      message.error(err?.message || 'Failed to record installment payment');
    }
  };

  const handleSubmitPayment = async (values: any) => {
    if (!selectedRow) return;
    setSubmitting(true);
    try {
      const amountMinor = Math.round((values.amountGHS || selectedRow.installmentGHS) * 100);
      const paidOn = values.paidOn ? values.paidOn.toISOString() : new Date().toISOString();
      const method = values.method || 'bank_transfer';
      const reference = values.reference || undefined;

      // 1. Persist permanently to backend database, save local override, and dispatch SMS prompt
      await recordPlanPaymentWithBackend(
        plan,
        {
          amountMinor,
          paidOn,
          method,
          reference,
          sequence: selectedRow.sequence,
          installmentOrdinal: selectedRow.ordinal,
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

      message.success(`Payment recorded successfully for ${selectedRow.ordinal} installment!`);
      setRecordModalOpen(false);
      form.resetFields();
      setSelectedRow(null);
    } catch (err: any) {
      message.error(err?.message || 'Failed to record payment');
    } finally {
      setSubmitting(false);
    }
  };

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
      width: 150,
      align: 'right' as const,
      render: (val: number, record: ScheduleInstallmentRow) => (
        <Text strong style={{ color: record.isOverdue ? '#cf1322' : undefined }}>
          {val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </Text>
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
      width: 120,
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
              Record Payment
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
              <Tag color="green">
                ₵{scheduleInfo.agreementRemainingGHS.toLocaleString('en-US', { minimumFractionDigits: 2 })} Total Liability
              </Tag>
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
          <Text strong style={{ fontSize: 14, letterSpacing: '0.3px', textTransform: 'uppercase' }}>
            {scheduleInfo.planTitleText}
          </Text>

          {/* Sort Mode Controls */}
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
        </div>
      </Card>

      {/* Schedule Table */}
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
              Record Payment — {selectedRow?.ordinal} Installment
            </Text>
          </Space>
        }
        open={recordModalOpen}
        onCancel={() => {
          setRecordModalOpen(false);
          form.resetFields();
          setSelectedRow(null);
        }}
        footer={null}
        width={500}
        style={{ maxWidth: '95%', top: 24 }}
        destroyOnClose
      >
        {selectedRow && (
          <Form
            form={form}
            layout="vertical"
            onFinish={handleSubmitPayment}
            initialValues={{
              amountGHS: selectedRow.installmentGHS,
              paidOn: dayjs(),
              method: 'bank_transfer',
              reference: `INST-${selectedRow.sequence}-${Date.now().toString().slice(-4)}`,
            }}
          >
            <div
              style={{
                background: selectedRow.isOverdue ? '#fff2f0' : '#f5f7fa',
                border: `1px solid ${selectedRow.isOverdue ? '#ffccc7' : '#e8e8e8'}`,
                borderRadius: 6,
                padding: '12px 14px',
                marginBottom: 16,
              }}
            >
              <Space direction="vertical" size={2} style={{ width: '100%' }}>
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
                  <Text type="secondary">Expected Installment:</Text>
                  <Text strong>
                    ₵{selectedRow.installmentGHS.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Text>
                </div>
              </Space>
            </div>

            <Form.Item
              name="amountGHS"
              label="Amount Paid (GHS / ₵)"
              rules={[{ required: true, message: 'Payment amount is required' }]}
            >
              <InputNumber
                style={{ width: '100%' }}
                prefix="₵"
                precision={2}
                min={0.01}
                placeholder="e.g. 5833.33"
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
                  }}
                >
                  Cancel
                </Button>
                <Button type="primary" htmlType="submit" loading={submitting}>
                  Confirm & Record Payment
                </Button>
              </Space>
            </Form.Item>
          </Form>
        )}
      </Modal>
    </div>
  );
};
