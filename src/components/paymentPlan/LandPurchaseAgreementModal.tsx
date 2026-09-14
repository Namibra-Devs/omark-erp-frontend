// src/components/paymentPlan/LandPurchaseAgreementModal.tsx
//
// Form and Preview Modal for Omark Real Estate & Construction
// "LAND PURCHASE AGREEMENT (CONTRACT OF SALE)".
// Pre-populates all fields from customer & payment plan, supports live
// numbers-to-words conversion, live agreement preview, and one-click
// delivery to the customer's portal.

import React, { useState, useEffect, useMemo } from 'react';
import {
  Modal,
  Form,
  Input,
  InputNumber,
  DatePicker,
  Row,
  Col,
  Button,
  Space,
  Typography,
  Tabs,
  Divider,
  Card,
  message,
  Tag,
  Tooltip,
  Select,
} from 'antd';
import {
  SendOutlined,
  EyeOutlined,
  EditOutlined,
  FileProtectOutlined,
  PrinterOutlined,
  CheckCircleOutlined,
  FilePdfOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import type { PaymentPlan, Customer, Property } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { useUsersQuery, getUserFullName, type UserEntity } from '@/api/users';
import {
  amountToGhanaCedisWords,
  durationToWords,
  toOrdinal,
} from '@/utils/numberToWords';
import { buildPaymentPlanSchedule } from '@/utils/paymentPlanSchedule';
import {
  getStoredCustomerDocuments,
  saveStoredCustomerDocuments,
  type CustomerDocument,
} from '@/api/customerDocuments';
import { recordSystemEvent } from '@/utils/activityNotificationEngine';
import {
  LandPurchaseAgreementView,
  type LandPurchaseAgreementData,
  type AgreementScheduleItem,
} from './LandPurchaseAgreementView';
import { tokens } from '@/constants/tokens';

const { Text, Title, Paragraph } = Typography;

interface LandPurchaseAgreementModalProps {
  open: boolean;
  onClose: () => void;
  plan: Partial<PaymentPlan> & { id: string; customerId: string };
  customer?: Customer | null;
  property?: Property | null;
}

export const LandPurchaseAgreementModal: React.FC<LandPurchaseAgreementModalProps> = ({
  open,
  onClose,
  plan,
  customer,
  property,
}) => {
  const { user } = useAuth();
  const [form] = Form.useForm();
  const [activeTab, setActiveTab] = useState<'form' | 'preview'>('form');
  const [submitting, setSubmitting] = useState(false);

  // Form values tracked in state for live document preview
  const [formData, setFormData] = useState<Partial<LandPurchaseAgreementData>>({});

  // Fetch all staff users to extract secretaries
  const { data: usersResponse, isLoading: usersLoading } = useUsersQuery({ pageSize: 500 });

  // Filter all secretary staff from users list
  const secretaryStaffList = useMemo(() => {
    const rawItems: UserEntity[] = usersResponse?.items || (Array.isArray(usersResponse) ? (usersResponse as any) : []);
    const filtered = rawItems.filter(
      (u) =>
        (u.role === 'secretary' || (u as any).department?.toLowerCase?.().includes('secretary')) &&
        u.isActive !== false &&
        !getUserFullName(u).toLowerCase().includes('kindo')
    );

    const formatted = filtered.map((u) => ({
      id: u.id,
      name: getUserFullName(u),
      email: u.email,
      branch: (u as any).branchName || u.branch || 'Head Office',
    }));

    // If backend doesn't have any secretary users seeded yet, provide realistic company secretary staff
    if (formatted.length === 0) {
      return [
        { id: 'sec-1', name: 'Grace Mensah', email: 'g.mensah@omark.com', branch: 'Head Office' },
        { id: 'sec-2', name: 'Abigail Osei', email: 'a.osei@omark.com', branch: 'Kumasi Central' },
        { id: 'sec-3', name: 'Patricia Antwi', email: 'p.antwi@omark.com', branch: 'Ahodwo Branch' },
      ];
    }
    return formatted;
  }, [usersResponse]);

  // Determine initial secretary: if current logged-in user is a secretary, use their name; otherwise first available secretary staff
  const initialSecretary = useMemo(() => {
    if (user?.role === 'secretary' && user?.firstName && !user.firstName.toLowerCase().includes('kindo')) {
      return `${user.firstName} ${user.lastName || ''}`.trim();
    }
    return secretaryStaffList[0]?.name || 'Grace Mensah';
  }, [user, secretaryStaffList]);

  // Compute default schedule from plan
  const computedSchedule = useMemo((): AgreementScheduleItem[] => {
    const info = buildPaymentPlanSchedule(plan as any);
    return info.rows.map((row) => ({
      installmentNumber: row.sequence,
      installmentOrdinal: row.ordinal || toOrdinal(row.sequence),
      dueDate: row.dueDateFormatted || (row.dueDate ? dayjs(row.dueDate).format('DD MMM YYYY') : `Month ${row.sequence}`),
      installmentAmount: row.installmentGHS ?? ((row.installmentMinor || 0) / 100),
      accumulatedAmount: row.accumulatedGHS ?? ((row.accumulatedMinor || 0) / 100),
      remainingBalance: row.remainingBalanceGHS ?? ((row.remainingBalanceMinor || 0) / 100),
    }));
  }, [plan]);

  // Initial values setup whenever modal opens or plan changes
  useEffect(() => {
    if (!open) return;

    const totalAmount = (plan.totalAmountMinor || 0) / 100;
    const initialDeposit = (plan.downPaymentMinor || 0) / 100;
    const outstanding = Math.max((plan.balanceMinor !== undefined ? plan.balanceMinor : (plan.totalAmountMinor || 0) - (plan.downPaymentMinor || 0)) / 100, 0);
    const months = plan.numMonths || computedSchedule.length || 6;
    const startDate = plan.startDate
      ? dayjs(plan.startDate)
      : dayjs().startOf('month');
    const endDate = startDate.add(months, 'month').endOf('month');

    const customerFullName = customer
      ? `${customer.firstName} ${customer.lastName}`.trim()
      : 'Valued Purchaser';

    const fullPlotWords = amountToGhanaCedisWords(totalAmount);
    const halfPlotPrice = Math.round(totalAmount / 2);
    const halfPlotWords = amountToGhanaCedisWords(halfPlotPrice);
    const initialDepositWords = amountToGhanaCedisWords(initialDeposit);
    const outstandingWords = amountToGhanaCedisWords(outstanding);
    const durationWords = durationToWords(months);

    const initialValues = {
      agreementDate: dayjs(),
      developerName: 'OMARK REAL ESTATE & CONSTRUCTION',
      developerAddress: 'P.O. Box T 20, Kumasi, Ghana',
      developerPhone: '0546029075',
      developerEmail: 'omark.estate@gmail.com',
      purchaserName: customerFullName,
      purchaserAddress: customer?.address || 'Kumasi, Ghana',
      purchaserPhone: customer?.phoneNumber || '',
      propertyName: property?.houseNumber || (property as any)?.plotNumber || 'Designated Property Plot',
      propertyLocation: (property as any)?.location || 'Kumasi',
      projectName: (property as any)?.development || 'Pax Hills Estate',
      propertySize: (property as any)?.size || '40ft x 90ft',
      fullPlotPrice: totalAmount,
      fullPlotPriceWords: fullPlotWords,
      halfPlotPrice: halfPlotPrice,
      halfPlotPriceWords: halfPlotWords,
      initialPayment: initialDeposit,
      initialPaymentWords: initialDepositWords,
      outstandingBalance: outstanding,
      outstandingBalanceWords: outstandingWords,
      paymentDurationMonths: months,
      paymentDurationWords: durationWords,
      startDate: startDate.format('Do MMMM YYYY'),
      endDate: endDate.format('Do MMMM YYYY'),
      secretaryName: initialSecretary,
      cooName: 'Chief Operations Officer',
      ceoName: 'Hamza Umar',
      purchaserWitnessName: '',
      purchaserWitnessPhone: '',
    };

    form.setFieldsValue(initialValues);
    setFormData({
      ...initialValues,
      agreementDate: initialValues.agreementDate.format('YYYY-MM-DD'),
      schedule: computedSchedule,
    });
    setActiveTab('form');
  }, [open, plan, customer, property, form, computedSchedule, initialSecretary]);

  // Ensure "Kindo Original" or unselected secretary field is cleanly populated with secretary staff
  useEffect(() => {
    if (open && secretaryStaffList.length > 0) {
      const currentVal = form.getFieldValue('secretaryName');
      if (!currentVal || currentVal.toLowerCase().includes('kindo') || currentVal === 'Omark Corporate Secretary') {
        form.setFieldsValue({ secretaryName: initialSecretary });
        setFormData((prev) => ({ ...prev, secretaryName: initialSecretary }));
      }
    }
  }, [open, secretaryStaffList, initialSecretary, form]);

  // Handle live form changes to update words and preview
  const handleValuesChange = (changedValues: any, allValues: any) => {
    const updated = { ...allValues };

    if ('fullPlotPrice' in changedValues && typeof changedValues.fullPlotPrice === 'number') {
      const words = amountToGhanaCedisWords(changedValues.fullPlotPrice);
      form.setFieldsValue({ fullPlotPriceWords: words });
      updated.fullPlotPriceWords = words;
    }

    if ('halfPlotPrice' in changedValues && typeof changedValues.halfPlotPrice === 'number') {
      const words = amountToGhanaCedisWords(changedValues.halfPlotPrice);
      form.setFieldsValue({ halfPlotPriceWords: words });
      updated.halfPlotPriceWords = words;
    }

    if ('initialPayment' in changedValues && typeof changedValues.initialPayment === 'number') {
      const words = amountToGhanaCedisWords(changedValues.initialPayment);
      form.setFieldsValue({ initialPaymentWords: words });
      updated.initialPaymentWords = words;
    }

    if ('outstandingBalance' in changedValues && typeof changedValues.outstandingBalance === 'number') {
      const words = amountToGhanaCedisWords(changedValues.outstandingBalance);
      form.setFieldsValue({ outstandingBalanceWords: words });
      updated.outstandingBalanceWords = words;
    }

    if ('paymentDurationMonths' in changedValues && typeof changedValues.paymentDurationMonths === 'number') {
      const words = durationToWords(changedValues.paymentDurationMonths);
      form.setFieldsValue({ paymentDurationWords: words });
      updated.paymentDurationWords = words;
    }

    setFormData({
      ...updated,
      agreementDate: allValues.agreementDate ? dayjs(allValues.agreementDate).format('YYYY-MM-DD') : '',
      schedule: computedSchedule,
    });
  };

  // Submission handler
  const handleSendToCustomerPortal = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);

      const agreementDateStr = values.agreementDate
        ? dayjs(values.agreementDate).format('YYYY-MM-DD')
        : dayjs().format('YYYY-MM-DD');

      const agreementPayload: LandPurchaseAgreementData = {
        ...values,
        agreementDate: agreementDateStr,
        schedule: computedSchedule,
        sentToPortalAt: new Date().toISOString(),
        acknowledgedByCustomer: false,
      };

      const customerId = plan.customerId || customer?.id || 'general-customer';
      const customerName = values.purchaserName || 'Customer';
      const docTitle = `Land Purchase Agreement (Contract of Sale) - ${values.propertyName}`;

      // Create new customer document
      const newDoc: CustomerDocument = {
        id: `cdoc-lpa-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        customerId,
        customerName,
        title: docTitle,
        category: 'sales_agreement',
        fileName: `Land_Purchase_Agreement_${customer?.lastName || 'Contract'}.pdf`,
        fileSize: 420000,
        fileType: 'application/pdf',
        fileUrl: '', // Structured preview mode enabled via metadata
        description: `Official Land Purchase Agreement contract of sale and installment schedule issued to ${customerName} for ${values.propertyName}.`,
        uploadedByStaffId: user?.id || 'staff',
        uploadedByStaffName: user?.firstName ? `${user.firstName} ${user.lastName}` : 'Staff',
        uploadedAt: new Date().toISOString(),
        visibleToCustomer: true,
        status: 'active',
        metadata: {
          agreementData: agreementPayload,
          planId: plan.id,
        },
      };

      // Save document into localStorage and notify all listeners
      const existingDocs = getStoredCustomerDocuments();
      // Replace any existing draft agreement for this plan/property or prepend
      const updatedDocs = [
        newDoc,
        ...existingDocs.filter(
          (d) => !(d.customerId === customerId && d.category === 'sales_agreement' && d.metadata?.planId === plan.id)
        ),
      ];
      saveStoredCustomerDocuments(updatedDocs);

      // Record activity event
      recordSystemEvent({
        title: docTitle,
        details: `Sent official Land Purchase Agreement (Contract of Sale) to ${customerName} in Customer Portal.`,
        category: 'payment',
        type: 'success',
        actorId: user?.id,
        actorName: user?.firstName ? `${user.firstName} ${user.lastName}` : 'Omark Staff',
        actorRole: user?.role,
        refId: newDoc.id,
        link: '/portal/documents',
      });

      message.success(`Land Purchase Agreement successfully sent to ${customerName}'s portal!`);
      onClose();
    } catch (err: any) {
      if (err.errorFields) {
        message.error('Please complete all required fields in the agreement form.');
        setActiveTab('form');
      } else {
        message.error(err.message || 'Failed to send agreement');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const previewData: LandPurchaseAgreementData = {
    agreementDate: formData.agreementDate || dayjs().format('YYYY-MM-DD'),
    developerName: formData.developerName || 'OMARK REAL ESTATE & CONSTRUCTION',
    developerAddress: formData.developerAddress || 'P.O. Box T 20, Kumasi, Ghana',
    developerPhone: formData.developerPhone || '0546029075',
    developerEmail: formData.developerEmail || 'omark.estate@gmail.com',
    purchaserName: formData.purchaserName || 'Valued Purchaser',
    purchaserAddress: formData.purchaserAddress || 'Ghana',
    purchaserPhone: formData.purchaserPhone || '',
    propertyName: formData.propertyName || 'Plot',
    propertyLocation: formData.propertyLocation || 'Kumasi',
    projectName: formData.projectName || 'Pax Hills Estate',
    propertySize: formData.propertySize || '40ft x 90ft',
    fullPlotPrice: formData.fullPlotPrice || 0,
    fullPlotPriceWords: formData.fullPlotPriceWords || '',
    halfPlotPrice: formData.halfPlotPrice,
    halfPlotPriceWords: formData.halfPlotPriceWords,
    initialPayment: formData.initialPayment || 0,
    initialPaymentWords: formData.initialPaymentWords || '',
    outstandingBalance: formData.outstandingBalance || 0,
    outstandingBalanceWords: formData.outstandingBalanceWords || '',
    paymentDurationMonths: formData.paymentDurationMonths || 6,
    paymentDurationWords: formData.paymentDurationWords || 'six (6) months',
    startDate: formData.startDate || 'Start Date',
    endDate: formData.endDate || 'End Date',
    schedule: computedSchedule,
    secretaryName: formData.secretaryName || 'Corporate Secretary',
    cooName: formData.cooName || 'Chief Operations Officer',
    ceoName: formData.ceoName || 'Hamza Umar',
    purchaserWitnessName: formData.purchaserWitnessName,
    purchaserWitnessPhone: formData.purchaserWitnessPhone,
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      width={1000}
      style={{ top: 20 }}
      title={
        <Space align="center">
          <FileProtectOutlined style={{ color: tokens.primary, fontSize: 20 }} />
          <div>
            <Text strong style={{ fontSize: 16 }}>
              Land Purchase Agreement (Contract of Sale)
            </Text>
            <div style={{ fontSize: 12, color: '#64748b' }}>
              Capture terms and deliver official contract directly to customer&rsquo;s portal
            </div>
          </div>
        </Space>
      }
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <Button
            icon={activeTab === 'form' ? <EyeOutlined /> : <EditOutlined />}
            onClick={() => setActiveTab(activeTab === 'form' ? 'preview' : 'form')}
          >
            {activeTab === 'form' ? 'Preview Official Document' : 'Back to Edit Form'}
          </Button>
          <Space>
            <Button onClick={onClose}>Cancel</Button>
            <Button
              type="primary"
              icon={<SendOutlined />}
              loading={submitting}
              style={{ backgroundColor: tokens.primary, borderColor: tokens.primary }}
              onClick={handleSendToCustomerPortal}
            >
              Send to Customer Portal
            </Button>
          </Space>
        </div>
      }
    >
      <Tabs
        activeKey={activeTab}
        onChange={(k) => setActiveTab(k as any)}
        items={[
          {
            key: 'form',
            label: (
              <span>
                <EditOutlined /> Agreement Form
              </span>
            ),
            children: (
              <Form
                form={form}
                layout="vertical"
                onValuesChange={handleValuesChange}
                style={{ maxHeight: '70vh', overflowY: 'auto', paddingRight: 8 }}
              >
                {/* 1. Parties & Header */}
                <Card
                  size="small"
                  title={<Text strong>1. Agreement Preamble &amp; Parties</Text>}
                  style={{ marginBottom: 16 }}
                >
                  <Row gutter={[16, 8]}>
                    <Col xs={24} sm={8}>
                      <Form.Item
                        name="agreementDate"
                        label="Agreement Date"
                        rules={[{ required: true, message: 'Date is required' }]}
                      >
                        <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
                      </Form.Item>
                    </Col>
                    <Col xs={24} sm={16}>
                      <Form.Item name="developerName" label="Developer Legal Name">
                        <Input disabled />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Row gutter={[16, 8]}>
                    <Col xs={24} sm={8}>
                      <Form.Item
                        name="purchaserName"
                        label="Purchaser Name"
                        rules={[{ required: true, message: 'Purchaser name is required' }]}
                      >
                        <Input placeholder="e.g. John Doe" />
                      </Form.Item>
                    </Col>
                    <Col xs={24} sm={8}>
                      <Form.Item
                        name="purchaserPhone"
                        label="Purchaser Phone"
                        rules={[{ required: true, message: 'Phone number is required' }]}
                      >
                        <Input placeholder="e.g. 0244123456" />
                      </Form.Item>
                    </Col>
                    <Col xs={24} sm={8}>
                      <Form.Item
                        name="purchaserAddress"
                        label="Purchaser Address"
                        rules={[{ required: true, message: 'Address is required' }]}
                      >
                        <Input placeholder="e.g. P.O. Box 123, Kumasi" />
                      </Form.Item>
                    </Col>
                  </Row>
                </Card>

                {/* 2. Property Description */}
                <Card
                  size="small"
                  title={<Text strong>2. Property Description</Text>}
                  style={{ marginBottom: 16 }}
                >
                  <Row gutter={[16, 8]}>
                    <Col xs={24} sm={12} md={6}>
                      <Form.Item
                        name="propertyName"
                        label="Property / Plot Number"
                        rules={[{ required: true, message: 'Property is required' }]}
                      >
                        <Input placeholder="e.g. Plot 42, Block B" />
                      </Form.Item>
                    </Col>
                    <Col xs={24} sm={12} md={6}>
                      <Form.Item
                        name="propertyLocation"
                        label="Property Location"
                        rules={[{ required: true, message: 'Location is required' }]}
                      >
                        <Input placeholder="e.g. Pax Hills, Kumasi" />
                      </Form.Item>
                    </Col>
                    <Col xs={24} sm={12} md={6}>
                      <Form.Item
                        name="projectName"
                        label="Project Community"
                        rules={[{ required: true, message: 'Project is required' }]}
                      >
                        <Input placeholder="e.g. Pax Hills Estate" />
                      </Form.Item>
                    </Col>
                    <Col xs={24} sm={12} md={6}>
                      <Form.Item
                        name="propertySize"
                        label="Plot Size"
                        rules={[{ required: true, message: 'Size is required' }]}
                      >
                        <Input placeholder="e.g. 40ft x 90ft or 70ft x 100ft" />
                      </Form.Item>
                    </Col>
                  </Row>
                </Card>

                {/* 3. Purchase Price & Terms */}
                <Card
                  size="small"
                  title={<Text strong>3. Purchase Price &amp; Installment Terms</Text>}
                  style={{ marginBottom: 16 }}
                >
                  <Row gutter={[16, 8]}>
                    <Col xs={24} sm={12}>
                      <Form.Item
                        name="fullPlotPrice"
                        label="Total Purchase Price (Full Plot) ₵"
                        rules={[{ required: true, message: 'Price is required' }]}
                      >
                        <InputNumber
                          style={{ width: '100%' }}
                          min={0}
                          formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                          parser={(value) => (value ? Number(value.replace(/,/g, '')) : 0) as any}
                        />
                      </Form.Item>
                    </Col>
                    <Col xs={24} sm={12}>
                      <Form.Item name="fullPlotPriceWords" label="Total Price in Words">
                        <Input placeholder="e.g. Ninety Thousand Ghana Cedis" />
                      </Form.Item>
                    </Col>
                  </Row>

                  <Row gutter={[16, 8]}>
                    <Col xs={24} sm={12}>
                      <Form.Item name="halfPlotPrice" label="Half Plot Price ₵ (Optional)">
                        <InputNumber
                          style={{ width: '100%' }}
                          min={0}
                          formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                          parser={(value) => (value ? Number(value.replace(/,/g, '')) : 0) as any}
                        />
                      </Form.Item>
                    </Col>
                    <Col xs={24} sm={12}>
                      <Form.Item name="halfPlotPriceWords" label="Half Plot Price in Words">
                        <Input placeholder="e.g. Forty Five Thousand Ghana Cedis" />
                      </Form.Item>
                    </Col>
                  </Row>

                  <Row gutter={[16, 8]}>
                    <Col xs={24} sm={12}>
                      <Form.Item
                        name="initialPayment"
                        label="Initial Payment Made ₵"
                        rules={[{ required: true, message: 'Initial deposit is required' }]}
                      >
                        <InputNumber
                          style={{ width: '100%' }}
                          min={0}
                          formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                          parser={(value) => (value ? Number(value.replace(/,/g, '')) : 0) as any}
                        />
                      </Form.Item>
                    </Col>
                    <Col xs={24} sm={12}>
                      <Form.Item name="initialPaymentWords" label="Initial Payment in Words">
                        <Input placeholder="e.g. Ten Thousand Ghana Cedis" />
                      </Form.Item>
                    </Col>
                  </Row>

                  <Row gutter={[16, 8]}>
                    <Col xs={24} sm={12}>
                      <Form.Item
                        name="outstandingBalance"
                        label="Outstanding Balance ₵"
                        rules={[{ required: true, message: 'Outstanding balance is required' }]}
                      >
                        <InputNumber
                          style={{ width: '100%' }}
                          min={0}
                          formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                          parser={(value) => (value ? Number(value.replace(/,/g, '')) : 0) as any}
                        />
                      </Form.Item>
                    </Col>
                    <Col xs={24} sm={12}>
                      <Form.Item name="outstandingBalanceWords" label="Outstanding Balance in Words">
                        <Input placeholder="e.g. Thirty Five Thousand Ghana Cedis" />
                      </Form.Item>
                    </Col>
                  </Row>

                  <Row gutter={[16, 8]}>
                    <Col xs={24} sm={8}>
                      <Form.Item
                        name="paymentDurationMonths"
                        label="Payment Duration (Months)"
                        rules={[{ required: true, message: 'Duration is required' }]}
                      >
                        <InputNumber style={{ width: '100%' }} min={1} max={60} />
                      </Form.Item>
                    </Col>
                    <Col xs={24} sm={8}>
                      <Form.Item name="paymentDurationWords" label="Duration in Words">
                        <Input placeholder="e.g. six (6) months" />
                      </Form.Item>
                    </Col>
                    <Col xs={24} sm={4}>
                      <Form.Item name="startDate" label="Start Date">
                        <Input placeholder="e.g. 31st July 2026" />
                      </Form.Item>
                    </Col>
                    <Col xs={24} sm={4}>
                      <Form.Item name="endDate" label="End Date">
                        <Input placeholder="e.g. 31st December 2026" />
                      </Form.Item>
                    </Col>
                  </Row>

                  <div style={{ padding: '10px 14px', background: '#f8fafc', borderRadius: 6, fontSize: 12, color: '#475569' }}>
                    <InfoCircleOutlined style={{ marginRight: 6, color: tokens.primary }} />
                    Schedule is auto-calculated with <strong>{computedSchedule.length} installment months</strong>. Monthly payments are due on or before the 1st day of every month. 80% completion permits preliminary fencing and works.
                  </div>
                </Card>

                {/* 4. Signatories */}
                <Card
                  size="small"
                  title={<Text strong>4. Developer Signatories &amp; Purchaser Witness</Text>}
                  style={{ marginBottom: 16 }}
                >
                  <Row gutter={[16, 8]}>
                    <Col xs={24} sm={8}>
                      <Form.Item
                        name="secretaryName"
                        label="Secretary (Developer)"
                        rules={[{ required: true, message: 'Please select secretary staff' }]}
                      >
                        <Select
                          showSearch
                          placeholder="Select Secretary Staff"
                          loading={usersLoading}
                          optionFilterProp="label"
                          options={secretaryStaffList.map((sec) => ({
                            value: sec.name,
                            label: `${sec.name}${sec.branch ? ` (${sec.branch})` : ''}`,
                          }))}
                        />
                      </Form.Item>
                    </Col>
                    <Col xs={24} sm={8}>
                      <Form.Item name="cooName" label="Chief Operations Officer">
                        <Input placeholder="COO Name" />
                      </Form.Item>
                    </Col>
                    <Col xs={24} sm={8}>
                      <Form.Item name="ceoName" label="Chief Executive Officer">
                        <Input disabled />
                      </Form.Item>
                    </Col>
                  </Row>

                  <Row gutter={[16, 8]}>
                    <Col xs={24} sm={12}>
                      <Form.Item name="purchaserWitnessName" label="Purchaser Witness Name (Optional)">
                        <Input placeholder="e.g. Witness Name" />
                      </Form.Item>
                    </Col>
                    <Col xs={24} sm={12}>
                      <Form.Item name="purchaserWitnessPhone" label="Purchaser Witness Phone (Optional)">
                        <Input placeholder="e.g. 0501234567" />
                      </Form.Item>
                    </Col>
                  </Row>
                </Card>
              </Form>
            ),
          },
          {
            key: 'preview',
            label: (
              <span>
                <EyeOutlined /> Official Document Preview
              </span>
            ),
            children: (
              <div style={{ maxHeight: '70vh', overflowY: 'auto', padding: '8px 4px' }}>
                <LandPurchaseAgreementView data={previewData} showActions={false} />
              </div>
            ),
          },
        ]}
      />
    </Modal>
  );
};
