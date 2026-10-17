// src/components/expenses/ExpenseDetailModal.tsx
import React, { useState } from 'react';
import {
  Modal,
  Typography,
  Tag,
  Space,
  Button,
  Row,
  Col,
  Card,
  Descriptions,
  Divider,
  Tooltip,
  Popconfirm,
  Tabs,
  Alert,
  message,
} from 'antd';
import {
  PrinterOutlined,
  FullscreenOutlined,
  FullscreenExitOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  CopyOutlined,
  FileTextOutlined,
  UserOutlined,
  CalendarOutlined,
  ShopOutlined,
  SafetyCertificateOutlined,
  EyeOutlined,
  ApartmentOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import type { ExpenseEntity } from '@/api/expenses';
import { formatExpenseCurrency } from '@/utils/expenseGrouping';
import { resolveFourMainDepartment } from '@/utils/departmentExpenses';
import { FOUR_DEPARTMENT_UI_CONFIG } from './RoleExpenseDashboard';
import { tokens } from '@/constants/tokens';

dayjs.extend(relativeTime);

const { Title, Text, Paragraph } = Typography;

export interface ExpenseDetailModalProps {
  open: boolean;
  onClose: () => void;
  expense: ExpenseEntity | null;
  isAdminOrAccounts?: boolean;
  onApprove?: (id: string) => void;
  onReject?: (expense: ExpenseEntity) => void;
}

export const ExpenseDetailModal: React.FC<ExpenseDetailModalProps> = ({
  open,
  onClose,
  expense,
  isAdminOrAccounts = false,
  onApprove,
  onReject,
}) => {
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'voucher'>('details');

  if (!expense) return null;

  const deptKey = resolveFourMainDepartment(expense);
  const deptConfig = FOUR_DEPARTMENT_UI_CONFIG[deptKey];
  const isApproved = expense.status === 'approved';
  const isPending = expense.status === 'pending';
  const isRejected = expense.status === 'rejected';

  const handleCopyCode = () => {
    const code = expense.code || expense.id;
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(code);
      message.success(`Copied voucher code ${code}`);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      width={isFullScreen ? '98vw' : Math.min(940, typeof window !== 'undefined' ? window.innerWidth - 32 : 940)}
      style={{ top: isFullScreen ? 10 : 36, paddingBottom: 16 }}
      styles={{
        content: {
          padding: 0,
          borderRadius: isFullScreen ? 10 : 16,
          overflow: 'hidden',
          boxShadow: '0 20px 40px rgba(0,0,0,0.18)',
        },
        body: {
          padding: 0,
          maxHeight: isFullScreen ? 'calc(100vh - 80px)' : '82vh',
          overflowY: 'auto',
          backgroundColor: '#f8fafc',
        },
      }}
      footer={null}
      closable={false}
    >
      {/* ── Top Header Banner with Department Gradient ────────────────────── */}
      <div
        style={{
          background: `linear-gradient(135deg, ${deptConfig.accentColor} 0%, #0f172a 100%)`,
          padding: '22px 28px',
          color: '#ffffff',
          position: 'relative',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 14 }}>
          {/* Left: Department & Voucher Details */}
          <div>
            <Space size={8} style={{ marginBottom: 6 }}>
              <Tag
                color={deptConfig.color}
                style={{
                  borderRadius: 12,
                  fontWeight: 700,
                  fontSize: 12,
                  padding: '3px 10px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  backgroundColor: '#ffffff',
                  color: deptConfig.accentColor,
                  border: 'none',
                }}
              >
                {deptConfig.icon}
                {deptConfig.name} Department
              </Tag>

              <Tag
                style={{
                  borderRadius: 12,
                  fontSize: 11,
                  fontWeight: 600,
                  backgroundColor: 'rgba(255,255,255,0.15)',
                  color: '#ffffff',
                  border: '1px solid rgba(255,255,255,0.25)',
                }}
              >
                {expense.type.toUpperCase()} REQUISITION
              </Tag>
            </Space>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
              <Title level={3} style={{ color: '#ffffff', margin: 0, fontWeight: 800, letterSpacing: -0.5 }}>
                {expense.code || `EXP-${expense.id.slice(0, 8).toUpperCase()}`}
              </Title>
              <Tooltip title="Copy voucher code">
                <Button
                  size="small"
                  type="text"
                  icon={<CopyOutlined style={{ color: '#e2e8f0', fontSize: 14 }} />}
                  onClick={handleCopyCode}
                  style={{ borderRadius: 6, background: 'rgba(255,255,255,0.12)' }}
                />
              </Tooltip>
            </div>

            <div style={{ marginTop: 4, color: 'rgba(255,255,255,0.85)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 12 }}>
              <span>
                <CalendarOutlined style={{ marginRight: 5 }} />
                Incurred: <strong>{dayjs(expense.incurredOn).format('MMMM D, YYYY')}</strong>
              </span>
              <span>•</span>
              <span>
                <ShopOutlined style={{ marginRight: 5 }} />
                {expense.branchName || 'Kumasi Main'}
              </span>
            </div>
          </div>

          {/* Right: Giant Amount & Quick Action Buttons */}
          <div style={{ textAlign: 'right' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end', marginBottom: 8 }}>
              <Tooltip title={isFullScreen ? 'Exit fullscreen view' : 'Expand to full screen view'}>
                <Button
                  size="small"
                  icon={isFullScreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
                  onClick={() => setIsFullScreen(!isFullScreen)}
                  style={{
                    borderRadius: 6,
                    background: 'rgba(255,255,255,0.15)',
                    color: '#ffffff',
                    border: '1px solid rgba(255,255,255,0.25)',
                    fontWeight: 600,
                  }}
                >
                  {isFullScreen ? 'Standard Screen' : 'Fullscreen'}
                </Button>
              </Tooltip>

              <Button
                size="small"
                onClick={onClose}
                style={{
                  borderRadius: 6,
                  background: 'rgba(255,255,255,0.2)',
                  color: '#ffffff',
                  border: 'none',
                  fontWeight: 600,
                }}
              >
                Close ✕
              </Button>
            </div>

            <Text style={{ fontSize: 11, textTransform: 'uppercase', color: 'rgba(255,255,255,0.75)', letterSpacing: 1, display: 'block' }}>
              Total Requisition Amount
            </Text>
            <div
              style={{
                fontSize: 28,
                fontWeight: 900,
                color: '#ffffff',
                fontVariantNumeric: 'tabular-nums',
                textShadow: '0 2px 8px rgba(0,0,0,0.3)',
              }}
            >
              {formatExpenseCurrency(expense.amountMinor)}
            </div>

            <div style={{ marginTop: 6, display: 'flex', justifyContent: 'flex-end' }}>
              <Tag
                color={isApproved ? 'success' : isPending ? 'warning' : 'error'}
                icon={isApproved ? <CheckCircleOutlined /> : isPending ? <ClockCircleOutlined /> : <CloseCircleOutlined />}
                style={{
                  fontSize: 12,
                  padding: '4px 12px',
                  borderRadius: 12,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  border: 'none',
                }}
              >
                {expense.status}
              </Tag>
            </div>
          </div>
        </div>

        {/* Tab Toggle Navigation: Details View vs Printable Voucher View */}
        <div style={{ marginTop: 18, borderTop: '1px solid rgba(255,255,255,0.15)', paddingTop: 14 }}>
          <Space size={8}>
            <Button
              type={activeTab === 'details' ? 'primary' : 'default'}
              size="small"
              icon={<EyeOutlined />}
              onClick={() => setActiveTab('details')}
              style={{
                borderRadius: 8,
                fontWeight: 600,
                backgroundColor: activeTab === 'details' ? '#ffffff' : 'rgba(255,255,255,0.12)',
                color: activeTab === 'details' ? deptConfig.accentColor : '#ffffff',
                border: 'none',
              }}
            >
              Comprehensive Record Details
            </Button>
            <Button
              type={activeTab === 'voucher' ? 'primary' : 'default'}
              size="small"
              icon={<PrinterOutlined />}
              onClick={() => setActiveTab('voucher')}
              style={{
                borderRadius: 8,
                fontWeight: 600,
                backgroundColor: activeTab === 'voucher' ? '#ffffff' : 'rgba(255,255,255,0.12)',
                color: activeTab === 'voucher' ? deptConfig.accentColor : '#ffffff',
                border: 'none',
              }}
            >
              Official Voucher & Print View
            </Button>
          </Space>
        </div>
      </div>

      {/* ── Main Modal Content ─────────────────────────────────────────────── */}
      <div style={{ padding: '24px 28px' }}>
        {activeTab === 'details' ? (
          <div>
            {/* 1. Large Screen Full Description Box (Zero Scrolling Limitation) */}
            <Card
              style={{
                borderRadius: 12,
                marginBottom: 20,
                border: '1.5px solid #e2e8f0',
                background: '#ffffff',
                boxShadow: '0 2px 10px rgba(0,0,0,0.03)',
              }}
              bodyStyle={{ padding: 20 }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <Space size={8}>
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 6,
                      background: '#eff6ff',
                      color: tokens.primary,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 14,
                    }}
                  >
                    <FileTextOutlined />
                  </div>
                  <Text strong style={{ fontSize: 15, color: '#0f172a' }}>
                    Complete Purpose & Memo Description
                  </Text>
                </Space>
                <Tag color="geekblue" style={{ borderRadius: 6, fontWeight: 600, margin: 0 }}>
                  Category: {expense.category}
                </Tag>
              </div>

              <div
                style={{
                  padding: '16px 18px',
                  background: '#f8fafc',
                  borderRadius: 10,
                  border: '1px solid #e2e8f0',
                  borderLeft: `4px solid ${tokens.primary}`,
                }}
              >
                <Paragraph
                  style={{
                    fontSize: 14,
                    lineHeight: 1.7,
                    color: '#1e293b',
                    margin: 0,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  {expense.description || 'No detailed memo provided for this expenditure.'}
                </Paragraph>
              </div>
            </Card>

            {/* 2. Structured Information Grid: Submitter, Accounting, and Authorization */}
            <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
              {/* Left Column: Submitter & Corporate Location */}
              <Col xs={24} md={12}>
                <Card
                  title={
                    <Space size={8}>
                      <UserOutlined style={{ color: tokens.primary }} />
                      <span>Submitter & Corporate Attribution</span>
                    </Space>
                  }
                  size="small"
                  style={{ borderRadius: 12, height: '100%', border: '1px solid #e2e8f0' }}
                  bodyStyle={{ padding: 16 }}
                >
                  <Descriptions column={1} size="small" bordered>
                    <Descriptions.Item label="Staff Member">
                      <Text strong style={{ fontSize: 13 }}>
                        {expense.recordedByUserName || 'Staff Member'}
                      </Text>
                    </Descriptions.Item>
                    <Descriptions.Item label="Official Role">
                      <Tag color="purple" style={{ textTransform: 'capitalize', borderRadius: 6 }}>
                        {(expense.recordedByUserRole || 'Staff').replace(/_/g, ' ')}
                      </Tag>
                    </Descriptions.Item>
                    <Descriptions.Item label="Assigned Branch">
                      <Text style={{ fontSize: 13 }}>
                        {expense.branchName || 'Kumasi Main'}
                      </Text>
                    </Descriptions.Item>
                    <Descriptions.Item label="Operational Department">
                      <Tag color={deptConfig.color} style={{ borderRadius: 6, fontWeight: 600 }}>
                        {deptConfig.name}
                      </Tag>
                    </Descriptions.Item>
                  </Descriptions>
                </Card>
              </Col>

              {/* Right Column: Financial & Ledger Breakdown */}
              <Col xs={24} md={12}>
                <Card
                  title={
                    <Space size={8}>
                      <ApartmentOutlined style={{ color: tokens.primary }} />
                      <span>Financial & Accounting Ledger</span>
                    </Space>
                  }
                  size="small"
                  style={{ borderRadius: 12, height: '100%', border: '1px solid #e2e8f0' }}
                  bodyStyle={{ padding: 16 }}
                >
                  <Descriptions column={1} size="small" bordered>
                    <Descriptions.Item label="Total Amount (GHS)">
                      <Text strong style={{ fontSize: 16, color: tokens.primary, fontVariantNumeric: 'tabular-nums' }}>
                        {formatExpenseCurrency(expense.amountMinor)}
                      </Text>
                    </Descriptions.Item>
                    <Descriptions.Item label="Minor Units (Pesewas)">
                      <Text code>{expense.amountMinor.toLocaleString()} pesewas</Text>
                    </Descriptions.Item>
                    <Descriptions.Item label="Disbursement Category">
                      <Tag color="blue">{expense.category}</Tag>
                    </Descriptions.Item>
                    <Descriptions.Item label="Requisition Classification">
                      <Tag color={expense.type === 'internal' ? 'cyan' : 'magenta'}>
                        {expense.type.toUpperCase()} ({expense.type === 'internal' ? 'Internal Operational' : 'External Client/Vendor'})
                      </Tag>
                    </Descriptions.Item>
                  </Descriptions>
                </Card>
              </Col>
            </Row>

            {/* 3. Authorization Trail & Decision Audit */}
            <Card
              title={
                <Space size={8}>
                  <SafetyCertificateOutlined style={{ color: tokens.primary }} />
                  <span>Authorization Trail & Administrative Governance</span>
                </Space>
              }
              size="small"
              style={{
                borderRadius: 12,
                marginBottom: 20,
                border: '1px solid #e2e8f0',
                background: isApproved ? '#f6ffed' : isPending ? '#fffbe6' : '#fff1f0',
              }}
              bodyStyle={{ padding: 18 }}
            >
              <Row gutter={[16, 16]} align="middle">
                <Col xs={24} sm={16}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <Text strong style={{ fontSize: 14 }}>
                      Current Status:
                    </Text>
                    <Tag
                      color={isApproved ? 'success' : isPending ? 'warning' : 'error'}
                      icon={isApproved ? <CheckCircleOutlined /> : isPending ? <ClockCircleOutlined /> : <CloseCircleOutlined />}
                      style={{ fontSize: 13, padding: '4px 12px', borderRadius: 8, fontWeight: 700 }}
                    >
                      {expense.status.toUpperCase()}
                    </Tag>
                  </div>

                  {isApproved && (
                    <div style={{ color: '#27272a', fontSize: 13 }}>
                      ✓ Authorized for corporate disbursement.
                      {expense.decidedAt && (
                        <span style={{ color: '#71717a', marginLeft: 6 }}>
                          Signed off on {dayjs(expense.decidedAt).format('YYYY-MM-DD HH:mm')} ({dayjs(expense.decidedAt).fromNow()}).
                        </span>
                      )}
                    </div>
                  )}

                  {isPending && (
                    <div style={{ color: '#d97706', fontSize: 13 }}>
                      ⏳ This expenditure requisition is pending final review and authorization by an Administrator or Accounts Director.
                    </div>
                  )}

                  {isRejected && (
                    <div style={{ color: '#dc2626', fontSize: 13 }}>
                      ✕ Requisition was declined. Review reason notes below.
                    </div>
                  )}

                  {expense.decisionNote && (
                    <div style={{ marginTop: 10, padding: 10, background: '#ffffff', borderRadius: 8, border: '1px solid #e4e4e7' }}>
                      <Text strong style={{ fontSize: 12, color: '#3f3f46', display: 'block' }}>
                        Administrative Decision Note:
                      </Text>
                      <Text style={{ fontSize: 13, color: '#18181b' }}>{expense.decisionNote}</Text>
                    </div>
                  )}
                </Col>

                {/* Right: Quick Action Buttons for Admins if Pending */}
                <Col xs={24} sm={8} style={{ textAlign: 'right' }}>
                  {isAdminOrAccounts && isPending && (
                    <Space direction="vertical" size={8} style={{ width: '100%' }}>
                      {onApprove && (
                        <Popconfirm
                          title="Authorize Requisition"
                          description={`Confirm authorization of ${formatExpenseCurrency(expense.amountMinor)} for ${expense.recordedByUserName || 'Staff'}?`}
                          onConfirm={() => {
                            onApprove(expense.id);
                            onClose();
                          }}
                          okText="Authorize"
                          okButtonProps={{ type: 'primary', style: { background: '#52c41a' } }}
                        >
                          <Button
                            type="primary"
                            block
                            icon={<CheckCircleOutlined />}
                            style={{ background: '#52c41a', borderColor: '#52c41a', fontWeight: 600, height: 38 }}
                          >
                            Authorize Requisition
                          </Button>
                        </Popconfirm>
                      )}

                      {onReject && (
                        <Button
                          danger
                          block
                          icon={<CloseCircleOutlined />}
                          onClick={() => {
                            onReject(expense);
                            onClose();
                          }}
                          style={{ fontWeight: 600, height: 38 }}
                        >
                          Reject Requisition
                        </Button>
                      )}
                    </Space>
                  )}

                  {isApproved && (
                    <Button
                      type="primary"
                      icon={<PrinterOutlined />}
                      onClick={handlePrint}
                      style={{ background: '#0284c7', borderColor: '#0284c7', fontWeight: 600 }}
                    >
                      Print Payment Voucher
                    </Button>
                  )}
                </Col>
              </Row>
            </Card>

            {/* 4. Timestamp & Verification Audit Trail */}
            <div
              style={{
                padding: '12px 16px',
                background: '#f1f5f9',
                borderRadius: 8,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 8,
                fontSize: 12,
                color: '#64748b',
              }}
            >
              <div>
                System Record ID: <Text code>{expense.id}</Text>
              </div>
              <div>
                Created: {dayjs(expense.createdAt).format('YYYY-MM-DD HH:mm:ss')} • Updated: {dayjs(expense.updatedAt).fromNow()}
              </div>
              <div style={{ fontWeight: 600, color: '#475569' }}>
                OMARK ERP VERIFIED FINANCIAL RECORD
              </div>
            </div>
          </div>
        ) : (
          /* ── Tab 2: Printable Voucher View ──────────────────────────────── */
          <div style={{ maxWidth: 760, margin: '0 auto', background: '#ffffff', padding: 32, borderRadius: 12, border: '1px solid #e2e8f0' }}>
            <div style={{ textAlign: 'center', marginBottom: 24, borderBottom: '2px solid #e2e8f0', paddingBottom: 20 }}>
              <Title level={3} style={{ margin: 0, color: tokens.primary, letterSpacing: -0.5 }}>
                OMARK REAL ESTATE
              </Title>
              <Text type="secondary" style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 1.5, display: 'block', marginTop: 2 }}>
                Official Financial Disbursement Voucher
              </Text>
              <div style={{ marginTop: 10 }}>
                <Tag
                  color={isApproved ? 'success' : isPending ? 'warning' : 'error'}
                  style={{ fontSize: 13, padding: '4px 16px', borderRadius: 14, fontWeight: 700 }}
                >
                  STATUS: {expense.status.toUpperCase()}
                </Tag>
              </div>
            </div>

            <Descriptions column={2} bordered size="middle" style={{ marginBottom: 24 }}>
              <Descriptions.Item label="Voucher No." span={1}>
                <Text strong copyable>{expense.code || expense.id}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Date Incurred" span={1}>
                {dayjs(expense.incurredOn).format('MMMM D, YYYY')}
              </Descriptions.Item>
              <Descriptions.Item label="Operational Department" span={1}>
                <Tag color={deptConfig.color} style={{ fontWeight: 600 }}>{deptConfig.name}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Category" span={1}>
                <Tag color="blue">{expense.category}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Requisition Type" span={1}>
                <Tag color="purple">{expense.type.toUpperCase()}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Branch Location" span={1}>
                {expense.branchName || 'Kumasi Main'}
              </Descriptions.Item>
              <Descriptions.Item label="Submitted By" span={2}>
                <Text strong style={{ fontSize: 14 }}>{expense.recordedByUserName || 'Staff Member'}</Text>
                <div style={{ fontSize: 12, color: '#64748b', textTransform: 'capitalize' }}>
                  Role: {(expense.recordedByUserRole || 'Staff').replace(/_/g, ' ')}
                </div>
              </Descriptions.Item>
              <Descriptions.Item label="Total Disbursement" span={2}>
                <Text strong style={{ fontSize: 22, color: '#0f172a', fontVariantNumeric: 'tabular-nums' }}>
                  {formatExpenseCurrency(expense.amountMinor)}
                </Text>
                <div style={{ fontSize: 12, color: '#64748b' }}>
                  ({expense.amountMinor.toLocaleString()} pesewas)
                </div>
              </Descriptions.Item>
              <Descriptions.Item label="Purpose / Detailed Description" span={2}>
                <Paragraph style={{ margin: 0, fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                  {expense.description || 'No detailed memo provided.'}
                </Paragraph>
              </Descriptions.Item>
              {expense.decisionNote && (
                <Descriptions.Item label="Authorization Notes" span={2}>
                  <Text type="secondary">{expense.decisionNote}</Text>
                </Descriptions.Item>
              )}
            </Descriptions>

            {/* Signature Blocks for Official Audit */}
            <Row gutter={40} style={{ marginTop: 40, paddingTop: 20, borderTop: '1px dashed #cbd5e1' }}>
              <Col span={8}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ borderBottom: '1px solid #94a3b8', height: 40, marginBottom: 8 }} />
                  <Text strong style={{ fontSize: 11, display: 'block' }}>Requisitioner Signature</Text>
                  <Text type="secondary" style={{ fontSize: 10 }}>{expense.recordedByUserName || 'Staff Member'}</Text>
                </div>
              </Col>
              <Col span={8}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ borderBottom: '1px solid #94a3b8', height: 40, marginBottom: 8 }} />
                  <Text strong style={{ fontSize: 11, display: 'block' }}>Internal Audit Verification</Text>
                  <Text type="secondary" style={{ fontSize: 10 }}>Accounts & Finance</Text>
                </div>
              </Col>
              <Col span={8}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ borderBottom: '1px solid #94a3b8', height: 40, marginBottom: 8 }} />
                  <Text strong style={{ fontSize: 11, display: 'block' }}>Managing Director Approval</Text>
                  <Text type="secondary" style={{ fontSize: 10 }}>Executive Administration</Text>
                </div>
              </Col>
            </Row>

            <div style={{ marginTop: 32, textAlign: 'center' }}>
              <Button type="primary" size="large" icon={<PrinterOutlined />} onClick={handlePrint} style={{ borderRadius: 8 }}>
                Print Official Voucher Document
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* ── Modal Footer ─────────────────────────────────────────────────── */}
      <div
        style={{
          padding: '14px 28px',
          background: '#ffffff',
          borderTop: '1px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 10,
        }}
      >
        <Space size={8}>
          <Button icon={<PrinterOutlined />} onClick={handlePrint}>
            Print Voucher
          </Button>
          <Button icon={<CopyOutlined />} onClick={handleCopyCode}>
            Copy Code
          </Button>
        </Space>

        <Space size={8}>
          <Button onClick={() => setIsFullScreen(!isFullScreen)}>
            {isFullScreen ? 'Exit Fullscreen' : 'Expand Fullscreen'}
          </Button>
          <Button type="primary" onClick={onClose} style={{ borderRadius: 6 }}>
            Done
          </Button>
        </Space>
      </div>
    </Modal>
  );
};
