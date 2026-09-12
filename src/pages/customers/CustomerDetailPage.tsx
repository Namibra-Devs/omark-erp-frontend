// src/pages/customers/CustomerDetailPage.tsx
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, useSearchParams, useLocation } from 'react-router-dom';
import {
  Card, Row, Col, Typography, Tag, Button, Space, Tabs, Table,
  Descriptions, Avatar, Badge, Progress, Timeline, Modal, Form,
  Input, Select, DatePicker, message, Divider, Empty, Spin,
  Statistic, List, Tooltip, Popconfirm, InputNumber, Alert,
  Upload, Switch
} from 'antd';
import {
  ArrowLeftOutlined,
  PhoneOutlined,
  MailOutlined,
  HomeOutlined,
  UserOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  DollarOutlined,
  BankOutlined,
  FileOutlined,
  DownloadOutlined,
  PrinterOutlined,
  ShareAltOutlined,
  EnvironmentOutlined,
  IdcardOutlined,
  ReloadOutlined,
  CreditCardOutlined,
  UploadOutlined,
  InboxOutlined,
  FilePdfOutlined,
  FileImageOutlined,
  FileWordOutlined,
  EyeOutlined,
  GlobalOutlined,
  LockOutlined,
  SearchOutlined
} from '@ant-design/icons';
import { useAuth } from '@/contexts/AuthContext';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatusTag } from '@/components/shared/StatusTag';
import { MoneyText } from '@/components/shared/MoneyText';
import { PhotoUpload } from '@/components/shared/PhotoUpload';
import { ProgressCell } from '@/components/shared/ProgressCell';
import { tokens } from '@/constants/tokens';
import { useDeedPolicyQuery } from '@/api/deedPolicy';
import { useCustomerQuery } from '@/api/customers';
import { usePaymentPlanQuery, useInstallmentsQuery } from '@/api/paymentPlans';
import { usePropertyQuery } from '@/api/properties';
import {
  useRecordPaymentMutation,
  usePaystackInitializeMutation,
  usePaystackVerifyMutation,
  getPaymentMethodConfig,
} from '@/api/payments';
import { useDeedsQuery, useGenerateDeedMutation } from '@/api/deeds';
import {
  useCustomerDocumentsQuery,
  useUploadCustomerDocumentMutation,
  useUpdateCustomerDocumentMutation,
  useDeleteCustomerDocumentMutation,
  documentCategoryMeta,
  formatBytes,
  downloadFile,
  CustomerDocument,
  CustomerDocumentCategory,
} from '@/api/customerDocuments';
import { printDeedWithPhoto } from '@/components/shared/printDeedWithPhoto';
import { cacheCustomerDetail } from '@/utils/customerPortalCache';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import advancedFormat from 'dayjs/plugin/advancedFormat';

dayjs.extend(relativeTime);
dayjs.extend(advancedFormat);

const { Title, Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;

export const CustomerDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'overview');
  const [recordPaymentModal, setRecordPaymentModal] = useState(false);
  const [paystackModal, setPaystackModal] = useState(false);
  const [generateDeedModal, setGenerateDeedModal] = useState(false);
  const [form] = Form.useForm();
  const [paystackForm] = Form.useForm();
  const [deedForm] = Form.useForm();
  const [witnesses, setWitnesses] = useState<{ name: string; contact: string }[]>([
    { name: '', contact: '' },
    { name: '', contact: '' },
  ]);

  // ── Customer Documents State & Hooks ─────────────────────────────────────
  const {
    data: customerDocsData,
    isLoading: customerDocsLoading,
    refetch: refetchCustomerDocs,
  } = useCustomerDocumentsQuery({ customerId: id });

  const customerDocs: CustomerDocument[] = customerDocsData?.items ?? [];

  const uploadDocMutation = useUploadCustomerDocumentMutation();
  const updateDocMutation = useUpdateCustomerDocumentMutation();
  const deleteDocMutation = useDeleteCustomerDocumentMutation();

  const [uploadDocModalOpen, setUploadDocModalOpen] = useState(false);
  const [uploadDocForm] = Form.useForm();
  const [selectedDocFile, setSelectedDocFile] = useState<File | null>(null);
  const [previewDoc, setPreviewDoc] = useState<CustomerDocument | null>(null);
  const [docSearch, setDocSearch] = useState('');
  const [docCategoryFilter, setDocCategoryFilter] = useState<string>('all');
  const [docVisibilityFilter, setDocVisibilityFilter] = useState<'all' | 'visible' | 'hidden'>('all');

  const paystackVerifyAttempted = useRef(false);
  const { data: deedPolicy } = useDeedPolicyQuery();

  // ── API Queries ────────────────────────────────────────────────────────────
  const {
    data: customerData,
    isLoading: customerLoading,
    error: customerError,
    refetch: refetchCustomer
  } = useCustomerQuery(id || '');

  const customer = customerData as any;

  // The real backend embeds the customer's active payment plan on the customer
  // detail response (`customer.plan`). Payment-plan-scoped endpoints (record
  // payment / Paystack initialize & verify / installments) need the plan's own
  // `id` — not the customer id — so we read it from there.
  const planId: string | undefined = customer?.plan?.id;

  const {
    data: paymentPlanData,
    isLoading: paymentPlanLoading,
    refetch: refetchPaymentPlan
  } = usePaymentPlanQuery(planId);

  const {
    data: installmentsData,
    isLoading: installmentsLoading,
    refetch: refetchInstallments
  } = useInstallmentsQuery(planId);

  const {
    data: propertyData,
    isLoading: propertyLoading
  } = usePropertyQuery(customer?.propertyId || '');

  const {
    data: deedsData,
    isLoading: deedsLoading,
    refetch: refetchDeeds,
  } = useDeedsQuery({ customerId: id, pageSize: 50 }, !!id);

  // ── API Mutations ──────────────────────────────────────────────────────────
  const recordPayment = useRecordPaymentMutation(planId ?? '');
  const paystackInitialize = usePaystackInitializeMutation(planId ?? '');
  const paystackVerify = usePaystackVerifyMutation(planId ?? '');
  const generateDeed = useGenerateDeedMutation();

  // ── Extract Data ──────────────────────────────────────────────────────────
  // Prefer the dedicated payment-plan detail fetch (it may carry `installments`
  // / `recentPayments` embedded by the backend); fall back to the plan summary
  // already embedded on the customer response while that fetch is in flight.
  const paymentPlan = (paymentPlanData ?? customer?.plan ?? null) as any;
  const installments = installmentsData ?? paymentPlan?.installments ?? [];
  // There is no standalone GET /payments (list) endpoint on the real API — the
  // only "payment history" available is whatever the backend chooses to embed
  // on the payment plan detail response.
  const recentPayments = (paymentPlanData as any)?.recentPayments ?? paymentPlan?.payments ?? [];
  const property = propertyData as any;
  const deeds = deedsData?.items ?? [];

  const isFullyPaid = customer?.type === 'fully_paid' || paymentPlan?.status === 'completed';

  // Customer Portal (prototype) has no public/customer-authenticated way to
  // read this data — see src/mock/customerPortalCache.ts. Piggyback on this
  // already-authenticated fetch to enrich the cache with the fuller detail
  // (installments, payment history) that the customers list doesn't carry.
  useEffect(() => {
    if (customer?.id) {
      cacheCustomerDetail(
        customer,
        property || undefined,
        paymentPlan || undefined,
        installments,
        recentPayments
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customer?.id, paymentPlan, installments, recentPayments, property]);

  // ── Paystack return-redirect verification ────────────────────────────────
  // Paystack redirects the customer back to this page with a `?reference=` (or
  // `?trxref=`) query param after checkout. Detect it, verify the payment
  // server-side, refresh the plan, and strip the param so it doesn't re-fire.
  useEffect(() => {
    const reference = searchParams.get('reference') || searchParams.get('trxref');
    if (!reference || !planId || paystackVerifyAttempted.current) {
      return;
    }
    paystackVerifyAttempted.current = true;

    paystackVerify.mutateAsync({ reference })
      .then(() => {
        message.success('Payment verified successfully!');
        refetchPaymentPlan();
        refetchInstallments();
        refetchCustomer();
      })
      .catch((error: any) => {
        message.error(
          error?.error?.message || error?.response?.data?.message || error?.message || 'Failed to verify Paystack payment'
        );
      })
      .finally(() => {
        navigate(location.pathname, { replace: true });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planId, searchParams]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleRecordPayment = async (values: any) => {
    if (!planId) {
      message.error('This customer has no active payment plan.');
      return;
    }
    try {
      await recordPayment.mutateAsync({
        amountMinor: Math.round(values.amountGHS * 100),
        paidOn: values.paidOn.toISOString(),
        method: values.method,
        reference: values.reference || undefined,
      });

      message.success('Payment recorded successfully!');
      setRecordPaymentModal(false);
      form.resetFields();

      // Refresh data
      refetchPaymentPlan();
      refetchInstallments();
      refetchCustomer();
    } catch (error: any) {
      message.error(
        error?.error?.message || error?.response?.data?.message || error?.message || 'Failed to record payment'
      );
    }
  };

  const handlePaystackPay = async (values: any) => {
    if (!planId) {
      message.error('This customer has no active payment plan.');
      return;
    }
    try {
      const result = await paystackInitialize.mutateAsync({
        amountMinor: Math.round(values.amountGHS * 100),
        email: values.email,
      });

      message.success('Redirecting to Paystack checkout...');
      setPaystackModal(false);
      paystackForm.resetFields();
      window.location.href = result.authorizationUrl;
    } catch (error: any) {
      message.error(
        error?.error?.message || error?.response?.data?.message || error?.message || 'Failed to initialize Paystack payment'
      );
    }
  };

  // ── Witness management (Generate Deed modal) ─────────────────────────────
  const addWitness = () => {
    setWitnesses([...witnesses, { name: '', contact: '' }]);
  };

  const removeWitness = (index: number) => {
    if (witnesses.length <= 1) {
      message.warning('At least 1 witness is required');
      return;
    }
    setWitnesses(witnesses.filter((_, i) => i !== index));
  };

  const updateWitness = (index: number, field: 'name' | 'contact', value: string) => {
    const next = [...witnesses];
    next[index] = { ...next[index], [field]: value };
    setWitnesses(next);
  };

  const resetDeedForm = () => {
    deedForm.resetFields();
    setWitnesses(Array.from({ length: deedPolicy?.defaultWitnessCount ?? 2 }, () => ({ name: '', contact: '' })));
  };

  const openGenerateDeedModal = () => {
    setWitnesses(Array.from({ length: deedPolicy?.defaultWitnessCount ?? 2 }, () => ({ name: '', contact: '' })));
    deedForm.setFieldsValue({ businessContacts: deedPolicy?.businessContacts });
    setGenerateDeedModal(true);
  };

  const handleGenerateDeed = async (values: any) => {
    const validWitnesses = witnesses.filter(w => w.name.trim() && w.contact.trim());
    if (validWitnesses.length < 1) {
      message.error('At least 1 witness (name and contact) is required');
      return;
    }
    try {
      await generateDeed.mutateAsync({
        customerId: id || '',
        propertyId: customer?.propertyId || '',
        witnesses: validWitnesses,
        businessContacts: values.businessContacts,
      });

      message.success('Deed generated successfully!');
      setGenerateDeedModal(false);
      resetDeedForm();
      refetchDeeds();
    } catch (error: any) {
      message.error(
        error?.error?.message || error?.response?.data?.message || error?.message || 'Failed to generate deed'
      );
    }
  };

  // There's no server-generated payment-plan statement endpoint (unlike
  // deeds, which are generated server-side) — this builds a printable
  // statement client-side and hands off to the browser's print-to-PDF,
  // rather than leaving the button as a dead stub.
  const handleGeneratePlanPdf = () => {
    if (!paymentPlan || !customer) return;

    const rows = installments
      .map((i: any) => `
        <tr>
          <td>${i.sequence}</td>
          <td>${dayjs(i.dueDate).format('MMM DD, YYYY')}</td>
          <td>GHS ${(i.expectedAmountMinor / 100).toLocaleString()}</td>
          <td>${i.isPaid ? 'Paid' : 'Pending'}</td>
          <td>${i.paidAt ? dayjs(i.paidAt).format('MMM DD, YYYY') : '—'}</td>
        </tr>
      `)
      .join('');

    const html = `
      <!doctype html>
      <html>
      <head>
        <meta charset="utf-8" />
        <title>Payment Plan Statement — ${customer.firstName} ${customer.lastName}</title>
        <style>
          body { font-family: Arial, Helvetica, sans-serif; padding: 32px; color: #1a1a2e; }
          h1 { font-size: 20px; margin-bottom: 2px; }
          .muted { color: #666; font-size: 12px; margin-bottom: 20px; }
          .summary div { margin-bottom: 4px; font-size: 13px; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #ddd; padding: 8px; font-size: 12.5px; text-align: left; }
          th { background: #f5f5f5; }
        </style>
      </head>
      <body>
        <h1>Omark Real Estate — Payment Plan Statement</h1>
        <div class="muted">Generated ${dayjs().format('MMMM DD, YYYY HH:mm')}</div>
        <div class="summary">
          <div><strong>Customer:</strong> ${customer.firstName} ${customer.lastName}</div>
          <div><strong>Phone:</strong> ${customer.phoneNumber}</div>
          ${property ? `<div><strong>Property:</strong> ${property.houseNumber} — ${property.offerNumber}</div>` : ''}
          <div><strong>Total Amount:</strong> GHS ${(paymentPlan.totalAmountMinor / 100).toLocaleString()}</div>
          <div><strong>Down Payment:</strong> GHS ${(paymentPlan.downPaymentMinor / 100).toLocaleString()}</div>
          <div><strong>Balance:</strong> GHS ${(paymentPlan.balanceMinor / 100).toLocaleString()}</div>
          <div><strong>Status:</strong> ${paymentPlan.status}</div>
        </div>
        <table>
          <thead><tr><th>#</th><th>Due Date</th><th>Amount</th><th>Status</th><th>Paid On</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <script>window.onload = function () { window.print(); };</script>
      </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      message.error('Please allow pop-ups for this site to generate the PDF');
      return;
    }
    printWindow.document.write(html);
    printWindow.document.close();
  };

  const handleDownloadDeed = async (deedId: string) => {
    try {
      message.loading({ content: 'Preparing download...', key: 'deed-download', duration: 0 });
      await printDeedWithPhoto(deedId, customer.id, `${customer.firstName} ${customer.lastName}`);
      message.success({ content: 'Deed opened in a new tab!', key: 'deed-download' });
    } catch (error: any) {
      message.error({ content: error?.message || 'Failed to download deed', key: 'deed-download' });
    }
  };

  // ── Loading state ─────────────────────────────────────────────────────────
  if (customerLoading || paymentPlanLoading || propertyLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <Spin size="large" tip="Loading customer details..." />
      </div>
    );
  }

  // ── Error state ───────────────────────────────────────────────────────────
  if (customerError || !customer) {
    return (
      <div style={{ padding: 24 }}>
        <Alert
          message="Error Loading Customer"
          description="There was an error loading the customer details. Please try again."
          type="error"
          showIcon
          action={
            <Button size="small" type="primary" onClick={() => refetchCustomer()}>
              Retry
            </Button>
          }
        />
        <Button
          type="primary"
          onClick={() => navigate('/customers')}
          style={{ marginTop: 16 }}
        >
          Back to Customers
        </Button>
      </div>
    );
  }

  // ── Installments columns ──────────────────────────────────────────────────
  const installmentsColumns = [
    {
      title: '#',
      dataIndex: 'sequence',
      key: 'sequence',
      width: 80
    },
    {
      title: 'Due Date',
      dataIndex: 'dueDate',
      key: 'dueDate',
      render: (date: string) => dayjs(date).format('MMMM DD, YYYY'),
      sorter: (a: any, b: any) => dayjs(a.dueDate).unix() - dayjs(b.dueDate).unix(),
    },
    {
      title: 'Expected Amount',
      dataIndex: 'expectedAmountMinor',
      key: 'expectedAmountMinor',
      render: (value: number) => <MoneyText minor={value} />,
      sorter: (a: any, b: any) => a.expectedAmountMinor - b.expectedAmountMinor,
    },
    {
      title: 'Status',
      dataIndex: 'isPaid',
      key: 'isPaid',
      render: (isPaid: boolean, record: any) => (
        <Tag color={isPaid ? 'green' : 'red'}>
          {isPaid ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
          {isPaid ? ' Paid' : ' Pending'}
        </Tag>
      ),
      filters: [
        { text: 'Paid', value: true },
        { text: 'Pending', value: false },
      ],
      onFilter: (value: any, record: any) => record.isPaid === value,
    },
    {
      title: 'Paid Date',
      dataIndex: 'paidAt',
      key: 'paidAt',
      render: (date: string) => date ? dayjs(date).format('MMMM DD, YYYY') : '-',
    },
  ];

  // ── Payments columns ──────────────────────────────────────────────────────
  const paymentsColumns = [
    {
      title: 'Date',
      dataIndex: 'paidOn',
      key: 'paidOn',
      render: (date: string) => dayjs(date).format('MMMM DD, YYYY HH:mm'),
      sorter: (a: any, b: any) => dayjs(a.paidOn).unix() - dayjs(b.paidOn).unix(),
    },
    {
      title: 'Amount',
      dataIndex: 'amountMinor',
      key: 'amountMinor',
      render: (value: number) => <MoneyText minor={value} />,
      sorter: (a: any, b: any) => a.amountMinor - b.amountMinor,
    },
    {
      title: 'Method',
      dataIndex: 'method',
      key: 'method',
      render: (method: any) => {
        const config = getPaymentMethodConfig(method);
        return <Tag color={config.color}>{config.label}</Tag>;
      },
    },
    {
      title: 'Reference',
      dataIndex: 'reference',
      key: 'reference',
      render: (ref: string) => ref || '-',
    },
    {
      title: 'Recorded By',
      dataIndex: 'recordedByUserId',
      key: 'recordedByUserId',
      render: (recordedByUserId: string) => recordedByUserId || 'Unknown',
    },
  ];

  // ── Customer Documents Handlers & Columns ─────────────────────────────────
  const handleUploadDocument = async (values: any) => {
    if (!selectedDocFile) {
      message.error('Please select or drop a file to upload');
      return;
    }
    const customerFullName = `${customer?.firstName || ''} ${customer?.lastName || ''}`.trim() || 'Customer';
    try {
      await uploadDocMutation.mutateAsync({
        customerId: id || '',
        customerName: customerFullName,
        title: values.title,
        category: values.category as CustomerDocumentCategory,
        file: selectedDocFile,
        description: values.description,
        visibleToCustomer: values.visibleToCustomer !== false,
        uploadedByStaffId: user?.id,
        uploadedByStaffName: user?.name || user?.email || 'Staff Member',
      });
      message.success('Document uploaded successfully and synchronized with customer portal!');
      setUploadDocModalOpen(false);
      uploadDocForm.resetFields();
      setSelectedDocFile(null);
      refetchCustomerDocs();
    } catch (error: any) {
      message.error(error?.message || 'Failed to upload document');
    }
  };

  const handleToggleDocVisibility = async (doc: CustomerDocument, checked: boolean) => {
    try {
      await updateDocMutation.mutateAsync({
        id: doc.id,
        payload: {
          visibleToCustomer: checked,
        },
      });
      message.success(
        checked
          ? `"${doc.title}" is now visible to the customer in their portal`
          : `"${doc.title}" is now hidden from the customer portal`
      );
      refetchCustomerDocs();
    } catch (error: any) {
      message.error('Failed to update document visibility');
    }
  };

  const handleDeleteDoc = async (docId: string) => {
    try {
      await deleteDocMutation.mutateAsync(docId);
      message.success('Document removed successfully');
      refetchCustomerDocs();
    } catch (error: any) {
      message.error('Failed to delete document');
    }
  };

  const getDocFileIcon = (fileType?: string, fileName?: string) => {
    const type = (fileType || '').toLowerCase();
    const name = (fileName || '').toLowerCase();
    if (type.includes('pdf') || name.endsWith('.pdf')) {
      return <FilePdfOutlined style={{ fontSize: 24, color: '#f5222d' }} />;
    }
    if (type.includes('image') || name.match(/\.(png|jpe?g|webp|gif|svg)$/)) {
      return <FileImageOutlined style={{ fontSize: 24, color: '#52c41a' }} />;
    }
    if (type.includes('word') || name.match(/\.(doc|docx)$/)) {
      return <FileWordOutlined style={{ fontSize: 24, color: '#1677ff' }} />;
    }
    return <FileOutlined style={{ fontSize: 24, color: '#fa8c16' }} />;
  };

  const documentColumns = [
    {
      title: 'Document',
      key: 'document',
      render: (_: any, record: CustomerDocument) => (
        <Space align="start" size={12}>
          <div style={{ marginTop: 2 }}>{getDocFileIcon(record.fileType, record.fileName)}</div>
          <div>
            <Text strong style={{ fontSize: 14 }}>{record.title}</Text>
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {record.fileName} · {formatBytes(record.fileSize)}
              </Text>
            </div>
            {record.description && (
              <Text type="secondary" style={{ fontSize: 12, display: 'block', maxWidth: 300 }}>
                {record.description}
              </Text>
            )}
          </div>
        </Space>
      ),
    },
    {
      title: 'Category',
      dataIndex: 'category',
      key: 'category',
      width: 175,
      render: (category: CustomerDocumentCategory) => {
        const meta = documentCategoryMeta[category] || documentCategoryMeta.other;
        return (
          <Tag color={meta.color} style={{ fontSize: 12, padding: '2px 8px' }}>
            <span style={{ marginRight: 4 }}>{meta.iconEmoji}</span>
            {meta.label}
          </Tag>
        );
      },
      filters: Object.entries(documentCategoryMeta).map(([cat, meta]) => ({
        text: meta.label,
        value: cat,
      })),
      onFilter: (value: any, record: CustomerDocument) => record.category === value,
    },
    {
      title: 'Customer Portal Visibility',
      key: 'visibleToCustomer',
      width: 180,
      render: (_: any, record: CustomerDocument) => (
        <Space direction="vertical" size={2}>
          <Switch
            checked={record.visibleToCustomer}
            loading={updateDocMutation.isPending}
            onChange={(checked) => handleToggleDocVisibility(record, checked)}
            checkedChildren={<Space size={4}><GlobalOutlined /> Visible</Space>}
            unCheckedChildren={<Space size={4}><LockOutlined /> Hidden</Space>}
          />
          <Text type="secondary" style={{ fontSize: 11 }}>
            {record.visibleToCustomer ? 'Available in Portal' : 'Restricted (Staff Only)'}
          </Text>
        </Space>
      ),
      filters: [
        { text: 'Visible to Customer', value: true },
        { text: 'Hidden (Staff Only)', value: false },
      ],
      onFilter: (value: any, record: CustomerDocument) => record.visibleToCustomer === value,
    },
    {
      title: 'Uploaded',
      key: 'uploaded',
      width: 170,
      render: (_: any, record: CustomerDocument) => (
        <div>
          <div>{dayjs(record.uploadedAt).format('MMM DD, YYYY')}</div>
          <Text type="secondary" style={{ fontSize: 12 }}>
            by {record.uploadedByStaffName || 'Staff'}
          </Text>
        </div>
      ),
      sorter: (a: CustomerDocument, b: CustomerDocument) =>
        dayjs(a.uploadedAt).unix() - dayjs(b.uploadedAt).unix(),
      defaultSortOrder: 'descend' as const,
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 130,
      render: (_: any, record: CustomerDocument) => (
        <Space size="small">
          <Tooltip title="Preview">
            <Button
              size="small"
              icon={<EyeOutlined />}
              onClick={() => setPreviewDoc(record)}
            />
          </Tooltip>
          <Tooltip title="Download">
            <Button
              size="small"
              icon={<DownloadOutlined />}
              onClick={() => downloadFile(record)}
            />
          </Tooltip>
          <Popconfirm
            title="Delete Document"
            description="Are you sure you want to delete this document? It will also be removed from the customer portal."
            okText="Delete"
            okButtonProps={{ danger: true }}
            cancelText="Cancel"
            onConfirm={() => handleDeleteDoc(record.id)}
          >
            <Tooltip title="Delete">
              <Button
                size="small"
                danger
                icon={<DeleteOutlined />}
                loading={deleteDocMutation.isPending}
              />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const filteredCustomerDocs = customerDocs.filter((doc) => {
    if (docSearch) {
      const q = docSearch.toLowerCase();
      const match =
        doc.title.toLowerCase().includes(q) ||
        doc.fileName.toLowerCase().includes(q) ||
        (doc.description && doc.description.toLowerCase().includes(q));
      if (!match) return false;
    }
    if (docCategoryFilter !== 'all' && doc.category !== docCategoryFilter) {
      return false;
    }
    if (docVisibilityFilter === 'visible' && !doc.visibleToCustomer) {
      return false;
    }
    if (docVisibilityFilter === 'hidden' && doc.visibleToCustomer) {
      return false;
    }
    return true;
  });

  return (
    <div style={{ maxWidth: '100%', overflowX: 'hidden', padding: '0 8px' }}>
      <PageHeader
        title={`${customer.firstName} ${customer.lastName}`}
        actions={[
          {
            label: 'Back',
            onClick: () => navigate('/customers'),
            icon: <ArrowLeftOutlined />,
          },
          {
            label: 'Upload Document',
            onClick: () => {
              uploadDocForm.resetFields();
              uploadDocForm.setFieldsValue({
                visibleToCustomer: true,
                category: 'sales_agreement',
              });
              setSelectedDocFile(null);
              setUploadDocModalOpen(true);
            },
            icon: <UploadOutlined />,
          },
          {
            label: 'Generate Deed',
            onClick: () => openGenerateDeedModal(),
            icon: <FileOutlined />,
          },
          {
            label: 'Refresh',
            onClick: () => {
              refetchCustomer();
              refetchPaymentPlan();
              refetchInstallments();
              refetchCustomerDocs();
              message.success('Refreshed!');
            },
            icon: <ReloadOutlined />,
          },
        ]}
      />

      {/* Customer Info Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} lg={16}>
          <Card>
            <Row gutter={[16, 16]} align="middle">
              <Col xs={24} sm={10} md={8}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <PhotoUpload entityType="customer" entityId={customer.id} size={64} />
                  <div>
                    <Title level={4} style={{ margin: 0, fontSize: 18, wordBreak: 'break-word' }}>
                      {customer.firstName} {customer.lastName}
                    </Title>
                    <Tag color={isFullyPaid ? 'green' : 'blue'} style={{ marginTop: 4 }}>
                      {isFullyPaid ? 'Fully Paid' : 'Payment Plan'}
                    </Tag>
                  </div>
                </div>
              </Col>
              <Col xs={24} sm={14} md={16}>
                <Descriptions column={{ xs: 1, sm: 2, md: 2 }} size="small">
                  <Descriptions.Item label={<PhoneOutlined />}>
                    <a href={`tel:${customer.phoneNumber}`}>{customer.phoneNumber}</a>
                  </Descriptions.Item>
                  <Descriptions.Item label={<EnvironmentOutlined />}>
                    {customer.address}
                  </Descriptions.Item>
                  <Descriptions.Item label="Sales Code">
                    {customer.code ? <Tag color="geekblue">{customer.code}</Tag> : 'N/A'}
                  </Descriptions.Item>
                  <Descriptions.Item label="Property">
                    {property ? `${property.houseNumber} - ${property.offerNumber}` : customer.propertyId || 'N/A'}
                  </Descriptions.Item>
                  <Descriptions.Item label="Joined">
                    {dayjs(customer.createdAt).format('MMMM DD, YYYY')}
                  </Descriptions.Item>
                </Descriptions>
              </Col>
            </Row>
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card bodyStyle={{ padding: '24px 16px' }}>
            <Row gutter={[8, 12]} style={{ textAlign: 'center' }}>
              <Col xs={8}>
                <Text type="secondary" style={{ fontSize: 12 }}>Total Paid</Text>
                <div style={{ fontSize: 17, fontWeight: 'bold', marginTop: 4, wordBreak: 'break-word' }}>
                  {paymentPlan ? (
                    <MoneyText minor={paymentPlan.totalAmountMinor - paymentPlan.balanceMinor} />
                  ) : 'GHS 0.00'}
                </div>
              </Col>
              <Col xs={8}>
                <Text type="secondary" style={{ fontSize: 12 }}>Balance</Text>
                <div style={{ fontSize: 17, fontWeight: 'bold', marginTop: 4, color: paymentPlan?.balanceMinor > 0 ? '#ff4d4f' : '#52c41a', wordBreak: 'break-word' }}>
                  {paymentPlan ? (
                    <MoneyText minor={paymentPlan.balanceMinor} />
                  ) : 'GHS 0.00'}
                </div>
              </Col>
              <Col xs={8}>
                <Text type="secondary" style={{ fontSize: 12 }}>Progress</Text>
                <div style={{ fontSize: 17, fontWeight: 'bold', marginTop: 4 }}>
                  {isFullyPaid ? '100%' : paymentPlan ? `${paymentPlan.progressPercent}%` : '0%'}
                </div>
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>

      {/* Tabs */}
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        style={{ maxWidth: '100%' }}
        items={[
          {
            key: 'overview',
            label: 'Overview',
            children: (
              <Row gutter={[16, 16]}>
                <Col xs={24} lg={12}>
                  <Card title="Payment Plan Details">
                    {isFullyPaid ? (
                      <div style={{ textAlign: 'center', padding: '20px' }}>
                        <CheckCircleOutlined style={{ fontSize: 48, color: '#52c41a' }} />
                        <Title level={4} style={{ marginTop: 16 }}>Fully Paid</Title>
                        <Text type="secondary">This customer has fully paid for their property</Text>
                      </div>
                    ) : paymentPlan ? (
                      <div>
                        <div style={{ marginBottom: 16 }}>
                          <ProgressCell percent={paymentPlan.progressPercent} band={paymentPlan.progressBand} />
                        </div>
                        <Descriptions column={{ xs: 1, sm: 2, md: 2 }} size="small" bordered>
                          <Descriptions.Item label="Total Amount" span={2}>
                            <MoneyText minor={paymentPlan.totalAmountMinor} />
                          </Descriptions.Item>
                          <Descriptions.Item label="Down Payment">
                            <MoneyText minor={paymentPlan.downPaymentMinor} />
                          </Descriptions.Item>
                          <Descriptions.Item label="Balance">
                            <MoneyText minor={paymentPlan.balanceMinor} />
                          </Descriptions.Item>
                          <Descriptions.Item label="Monthly Amount">
                            <MoneyText minor={paymentPlan.monthlyAmountMinor} />
                          </Descriptions.Item>
                          <Descriptions.Item label="Duration">
                            {paymentPlan.numMonths} months
                          </Descriptions.Item>
                          <Descriptions.Item label="Start Date">
                            {dayjs(paymentPlan.startDate).format('MMMM DD, YYYY')}
                          </Descriptions.Item>
                          <Descriptions.Item label="Status" span={2}>
                            <StatusTag status={paymentPlan.status} type="paymentPlan" />
                          </Descriptions.Item>
                          <Descriptions.Item label="Next Payment" span={2}>
                            {installments.filter((i: any) => !i.isPaid).length > 0 ? (
                              <>
                                <Text strong>
                                  {dayjs(installments.filter((i: any) => !i.isPaid)[0].dueDate).format('MMMM DD, YYYY')}
                                </Text>
                                <br />
                                <Text type="secondary">
                                  Amount: <MoneyText minor={installments.filter((i: any) => !i.isPaid)[0].expectedAmountMinor} />
                                </Text>
                              </>
                            ) : (
                              <Text type="secondary">All installments paid</Text>
                            )}
                          </Descriptions.Item>
                        </Descriptions>
                        <div style={{ marginTop: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <Button
                            type="primary"
                            icon={<DownloadOutlined />}
                            onClick={handleGeneratePlanPdf}
                          >
                            Generate PDF Statement
                          </Button>
                          <Button
                            icon={<FileOutlined />}
                            onClick={() => openGenerateDeedModal()}
                          >
                            Generate Deed
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Empty description="No payment plan found" />
                    )}
                  </Card>
                </Col>
                <Col xs={24} lg={12}>
                  <Card title="Property Details">
                    {property ? (
                      <Descriptions column={1} size="small" bordered>
                        <Descriptions.Item label="House Number">
                          <Text strong>{property.houseNumber}</Text>
                        </Descriptions.Item>
                        <Descriptions.Item label="Offer Number">
                          {property.offerNumber}
                        </Descriptions.Item>
                        <Descriptions.Item label="Price">
                          <MoneyText minor={property.priceMinor} />
                        </Descriptions.Item>
                        <Descriptions.Item label="Description">
                          {property.description || 'No description'}
                        </Descriptions.Item>
                        <Descriptions.Item label="Added">
                          {dayjs(property.createdAt).format('MMMM DD, YYYY')}
                        </Descriptions.Item>
                      </Descriptions>
                    ) : (
                      <Empty description="No property assigned" />
                    )}
                  </Card>
                </Col>
              </Row>
            ),
          },
          {
            key: 'installments',
            label: `Installments (${installments.filter((i: any) => !i.isPaid).length} pending)`,
            children: (
              <Card>
                <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                  <Space wrap>
                    <Text type="secondary">
                      Total: {installments.length} installments
                    </Text>
                    <Text type="secondary">
                      Paid: {installments.filter((i: any) => i.isPaid).length}
                    </Text>
                    <Text type="secondary">
                      Pending: {installments.filter((i: any) => !i.isPaid).length}
                    </Text>
                  </Space>
                </div>
                <Spin spinning={installmentsLoading}>
                  <Table
                    columns={installmentsColumns}
                    dataSource={installments}
                    rowKey="id"
                    scroll={{ x: 650 }}
                    pagination={{ pageSize: 10, responsive: true }}
                    locale={{ emptyText: paymentPlan ? 'No installments found' : 'No payment plan attached' }}
                  />
                </Spin>
              </Card>
            ),
          },
          {
            key: 'payments',
            label: `Payments (${recentPayments.length})`,
            children: (
              <Card>
                <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                  <Space wrap>
                    <Text type="secondary">
                      Total Payments: {recentPayments.length}
                    </Text>
                    <Text type="secondary">
                      Total Amount: <MoneyText minor={recentPayments.reduce((sum: number, p: any) => sum + p.amountMinor, 0)} />
                    </Text>
                  </Space>
                </div>
                <Spin spinning={paymentPlanLoading}>
                  <Table
                    columns={paymentsColumns}
                    dataSource={recentPayments}
                    rowKey="id"
                    scroll={{ x: 650 }}
                    pagination={{ pageSize: 10, responsive: true }}
                    locale={{
                      emptyText: 'No payment history to show. The API does not expose a full payment history endpoint — only the most recent payments embedded in the payment plan (if any) appear here.'
                    }}
                  />
                </Spin>
              </Card>
            ),
          },
          {
            key: 'deeds',
            label: 'Deeds',
            children: (
              <Card>
                <div style={{ marginBottom: 16 }}>
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={() => openGenerateDeedModal()}
                  >
                    Generate Deed
                  </Button>
                </div>
                <Spin spinning={deedsLoading}>
                  {deeds.length > 0 ? (
                    <List
                      dataSource={deeds}
                      renderItem={(deed: any) => (
                        <List.Item
                          style={{ flexWrap: 'wrap', gap: 12 }}
                          actions={[
                            <Button key="download" icon={<DownloadOutlined />} onClick={() => handleDownloadDeed(deed.id)}>
                              Download
                            </Button>,
                          ]}
                        >
                          <List.Item.Meta
                            avatar={<FileOutlined style={{ fontSize: 20, color: tokens.primary }} />}
                            title={`Deed #${deed.id.slice(0, 8)}`}
                            description={`Generated ${dayjs(deed.generatedAt).format('MMMM DD, YYYY')} · ${deed.witnesses?.length ?? 0} witness(es)`}
                          />
                        </List.Item>
                      )}
                    />
                  ) : (
                    <Empty description="No deeds generated yet">
                      <Button type="primary" onClick={() => openGenerateDeedModal()}>
                        Generate First Deed
                      </Button>
                    </Empty>
                  )}
                </Spin>
              </Card>
            ),
          },
          {
            key: 'documents',
            label: (
              <span>
                <FileOutlined style={{ marginRight: 6 }} />
                Documents
                <Badge
                  count={customerDocs.length}
                  style={{
                    marginLeft: 6,
                    backgroundColor: customerDocs.length > 0 ? tokens.primary : '#d9d9d9',
                  }}
                />
              </span>
            ),
            children: (
              <Card>
                <div
                  style={{
                    marginBottom: 16,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 12,
                  }}
                >
                  <Space wrap style={{ flex: 1, minWidth: 260 }}>
                    <Input
                      placeholder="Search documents..."
                      prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
                      value={docSearch}
                      onChange={(e) => setDocSearch(e.target.value)}
                      allowClear
                      style={{ width: '100%', maxWidth: 220, minWidth: 150 }}
                    />
                    <Select
                      value={docCategoryFilter}
                      onChange={setDocCategoryFilter}
                      style={{ width: '100%', maxWidth: 200, minWidth: 150 }}
                    >
                      <Option value="all">All Categories</Option>
                      {Object.entries(documentCategoryMeta).map(([cat, meta]) => (
                        <Option key={cat} value={cat}>
                          {meta.iconEmoji} {meta.label}
                        </Option>
                      ))}
                    </Select>
                    <Select
                      value={docVisibilityFilter}
                      onChange={setDocVisibilityFilter}
                      style={{ width: '100%', maxWidth: 190, minWidth: 150 }}
                    >
                      <Option value="all">All Visibility</Option>
                      <Option value="visible">Visible in Customer Portal</Option>
                      <Option value="hidden">Hidden (Staff Only)</Option>
                    </Select>
                  </Space>

                  <Button
                    type="primary"
                    icon={<UploadOutlined />}
                    onClick={() => {
                      uploadDocForm.resetFields();
                      uploadDocForm.setFieldsValue({
                        visibleToCustomer: true,
                        category: 'sales_agreement',
                      });
                      setSelectedDocFile(null);
                      setUploadDocModalOpen(true);
                    }}
                  >
                    Upload Document
                  </Button>
                </div>

                <Spin spinning={customerDocsLoading}>
                  <Table
                    columns={documentColumns}
                    dataSource={filteredCustomerDocs}
                    rowKey="id"
                    scroll={{ x: 700 }}
                    pagination={{ pageSize: 10, responsive: true }}
                    locale={{
                      emptyText: (
                        <Empty
                          description="No documents uploaded for this customer yet"
                          image={Empty.PRESENTED_IMAGE_SIMPLE}
                        >
                          <Button
                            type="primary"
                            icon={<UploadOutlined />}
                            onClick={() => {
                              uploadDocForm.resetFields();
                              uploadDocForm.setFieldsValue({
                                visibleToCustomer: true,
                                category: 'sales_agreement',
                              });
                              setSelectedDocFile(null);
                              setUploadDocModalOpen(true);
                            }}
                          >
                            Upload First Document
                          </Button>
                        </Empty>
                      ),
                    }}
                  />
                </Spin>
              </Card>
            ),
          },
        ]}
      />

      {/* Generate Deed Modal */}
      <Modal
        title={
          <Space>
            <FileOutlined style={{ color: tokens.primary }} />
            <Text strong>Generate Deed</Text>
          </Space>
        }
        open={generateDeedModal}
        onCancel={() => {
          setGenerateDeedModal(false);
          resetDeedForm();
        }}
        footer={null}
        width={600}
        style={{ maxWidth: '95%', top: 20 }}
        bodyStyle={{ padding: '16px', maxHeight: '70vh', overflowY: 'auto' }}
      >
        <Form form={deedForm} layout="vertical" onFinish={handleGenerateDeed}>
          <Alert
            message={`Generating deed for ${customer.firstName} ${customer.lastName}`}
            description={
              property ? (
                <>
                  Property: {property.houseNumber} - {property.offerNumber}
                  <br />
                  Price: <MoneyText minor={property.priceMinor} />
                </>
              ) : 'No property assigned'
            }
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />

          <Tag color="gold" style={{ marginBottom: 16 }}>
            Business Contacts pre-filled from Company Deed Policy — editable below
          </Tag>

          <Divider>Witnesses ({deedPolicy?.defaultWitnessCount ?? 2} required by policy, minimum 1)</Divider>

          {witnesses.map((witness, index) => (
            <Row key={index} gutter={[8, 8]} style={{ marginBottom: 8 }} align="middle">
              <Col xs={24} sm={10}>
                <Form.Item
                  label={index === 0 ? 'Witness Name' : ''}
                  required={index === 0}
                  style={{ marginBottom: 0 }}
                >
                  <Input
                    placeholder="Full name"
                    value={witness.name}
                    onChange={(e) => updateWitness(index, 'name', e.target.value)}
                    prefix={<UserOutlined />}
                  />
                </Form.Item>
              </Col>
              <Col xs={19} sm={10}>
                <Form.Item
                  label={index === 0 ? 'Contact' : ''}
                  required={index === 0}
                  style={{ marginBottom: 0 }}
                >
                  <Input
                    placeholder="Phone number"
                    value={witness.contact}
                    onChange={(e) => updateWitness(index, 'contact', e.target.value)}
                    prefix={<PhoneOutlined />}
                  />
                </Form.Item>
              </Col>
              <Col xs={5} sm={4} style={{ textAlign: 'right' }}>
                <Form.Item label={index === 0 ? ' ' : ''} style={{ marginBottom: 0 }}>
                  <Button
                    type="text"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => removeWitness(index)}
                    disabled={witnesses.length <= 1}
                  />
                </Form.Item>
              </Col>
            </Row>
          ))}

          <Button
            type="dashed"
            onClick={addWitness}
            icon={<PlusOutlined />}
            block
            style={{ marginTop: 8, marginBottom: 16 }}
          >
            Add Witness
          </Button>

          <Form.Item
            name="businessContacts"
            label="Business Contacts"
            rules={[{ required: true, message: 'Business contacts are required' }]}
          >
            <TextArea
              rows={3}
              placeholder="Enter business contact information (e.g., Omark Real Estate Ltd. - Accra Office, Phone: +233 20 123 4567)"
            />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button
                type="primary"
                htmlType="submit"
                loading={generateDeed.isPending}
              >
                Generate Deed
              </Button>
              <Button onClick={() => {
                setGenerateDeedModal(false);
                resetDeedForm();
              }}>
                Cancel
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Upload Customer Document Modal */}
      <Modal
        title={
          <Space>
            <UploadOutlined style={{ color: tokens.primary }} />
            <Text strong>Upload Document for Customer</Text>
          </Space>
        }
        open={uploadDocModalOpen}
        onCancel={() => {
          setUploadDocModalOpen(false);
          uploadDocForm.resetFields();
          setSelectedDocFile(null);
        }}
        footer={null}
        width={600}
        style={{ maxWidth: '95vw', top: 20 }}
        destroyOnClose
      >
        <Form
          form={uploadDocForm}
          layout="vertical"
          initialValues={{
            category: 'sales_agreement',
            visibleToCustomer: true,
          }}
          onFinish={handleUploadDocument}
        >
          <Alert
            message={`Uploading document for ${customer.firstName} ${customer.lastName}`}
            description="Documents marked as visible to customer will automatically appear in their Customer Portal account in real-time."
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />

          <Form.Item
            name="title"
            label="Document Title"
            rules={[{ required: true, message: 'Please enter a document title' }]}
          >
            <Input placeholder="e.g. Sales Agreement - House 42, Land Title Deed, etc." />
          </Form.Item>

          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item
                name="category"
                label="Category"
                rules={[{ required: true, message: 'Please select category' }]}
              >
                <Select placeholder="Select document category">
                  {Object.entries(documentCategoryMeta).map(([cat, meta]) => (
                    <Option key={cat} value={cat}>
                      {meta.iconEmoji} {meta.label}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                name="visibleToCustomer"
                label="Customer Portal Visibility"
                valuePropName="checked"
                extra="Customer can view and download this file from portal"
              >
                <Switch
                  checkedChildren={<Space size={2}><GlobalOutlined /> Visible</Space>}
                  unCheckedChildren={<Space size={2}><LockOutlined /> Hidden</Space>}
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item label="Upload File (PDF, Images, Word docs up to 25MB)" required>
            <Upload.Dragger
              name="file"
              multiple={false}
              maxCount={1}
              accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.webp"
              beforeUpload={(file) => {
                if (file.size > 25 * 1024 * 1024) {
                  message.error('File size exceeds the 25MB limit.');
                  return Upload.LIST_IGNORE;
                }
                setSelectedDocFile(file);
                // Auto-fill title if empty
                const currentTitle = uploadDocForm.getFieldValue('title');
                if (!currentTitle) {
                  const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
                  uploadDocForm.setFieldsValue({ title: nameWithoutExt });
                }
                return false;
              }}
              onRemove={() => {
                setSelectedDocFile(null);
              }}
              fileList={selectedDocFile ? [selectedDocFile as any] : []}
            >
              <p className="ant-upload-drag-icon">
                <InboxOutlined style={{ fontSize: 36, color: tokens.primary }} />
              </p>
              <p className="ant-upload-text">Click or drag file to this area to upload</p>
              <p className="ant-upload-hint">
                Supported: PDF, Word (DOC/DOCX), Excel (XLS/XLSX), Images (PNG/JPG). Max: 25MB
              </p>
            </Upload.Dragger>
          </Form.Item>

          <Form.Item name="description" label="Notes / Description (Optional)">
            <TextArea
              rows={3}
              placeholder="Add optional notes, version details, or instructions..."
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button
                onClick={() => {
                  setUploadDocModalOpen(false);
                  uploadDocForm.resetFields();
                  setSelectedDocFile(null);
                }}
              >
                Cancel
              </Button>
              <Button
                type="primary"
                htmlType="submit"
                loading={uploadDocMutation.isPending}
                icon={<UploadOutlined />}
                disabled={!selectedDocFile}
              >
                Upload & Share
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Document Preview Modal */}
      <Modal
        title={
          previewDoc && (
            <Space>
              {getDocFileIcon(previewDoc.fileType, previewDoc.fileName)}
              <div>
                <Text strong>{previewDoc.title}</Text>
                <div>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {previewDoc.fileName} · {formatBytes(previewDoc.fileSize)}
                  </Text>
                </div>
              </div>
            </Space>
          )
        }
        open={!!previewDoc}
        onCancel={() => setPreviewDoc(null)}
        width={850}
        style={{ maxWidth: '95vw', top: 20 }}
        footer={[
          <Button key="close" onClick={() => setPreviewDoc(null)}>
            Close
          </Button>,
          <Button
            key="download"
            type="primary"
            icon={<DownloadOutlined />}
            onClick={() => previewDoc && downloadFile(previewDoc)}
          >
            Download
          </Button>,
        ]}
      >
        {previewDoc && (
          <div style={{ minHeight: 350, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            {previewDoc.fileType.includes('pdf') || previewDoc.fileName.toLowerCase().endsWith('.pdf') ? (
              <iframe
                src={previewDoc.fileUrl}
                title={previewDoc.title}
                style={{ width: '100%', height: 'clamp(350px, 60vh, 550px)', border: 'none', borderRadius: 8 }}
              />
            ) : previewDoc.fileType.includes('image') || previewDoc.fileName.match(/\.(png|jpe?g|webp|gif)$/i) ? (
              <img
                src={previewDoc.fileUrl}
                alt={previewDoc.title}
                style={{ maxWidth: '100%', maxHeight: '550px', objectFit: 'contain', borderRadius: 8 }}
              />
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                <FileOutlined style={{ fontSize: 64, color: tokens.primary, marginBottom: 16 }} />
                <Title level={4}>{previewDoc.title}</Title>
                <Text type="secondary" style={{ display: 'block', marginBottom: 20 }}>
                  This file format ({previewDoc.fileType || previewDoc.fileName.split('.').pop()}) cannot be rendered directly in-browser.
                  Click below to download and view it locally.
                </Text>
                <Button
                  type="primary"
                  icon={<DownloadOutlined />}
                  onClick={() => downloadFile(previewDoc)}
                  size="large"
                >
                  Download {previewDoc.fileName}
                </Button>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};
