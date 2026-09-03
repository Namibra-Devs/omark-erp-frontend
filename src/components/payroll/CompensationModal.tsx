// src/components/payroll/CompensationModal.tsx
import React, { useEffect, useState } from 'react';
import { Modal, Form, Input, InputNumber, Select, Row, Col, Divider, Typography, Space, Button, Alert } from 'antd';
import { DollarOutlined, BankOutlined, TrophyOutlined, PercentageOutlined, CheckCircleOutlined } from '@ant-design/icons';
import {
  type StaffCompensationProfile,
  type SalaryType,
  type PayFrequency,
  type PaymentMethod,
  salaryTypeLabels,
  payFrequencyLabels,
  paymentMethodLabels,
} from '@/mock/staffCompensation';
import { useBonusRules } from '@/mock/bonusRules';

const { Text, Title } = Typography;
const { Option } = Select;
const { TextArea } = Input;

interface CompensationModalProps {
  open: boolean;
  onClose: () => void;
  profile: StaffCompensationProfile | null;
  onSave: (updated: Partial<StaffCompensationProfile>) => void;
}

export const CompensationModal: React.FC<CompensationModalProps> = ({
  open,
  onClose,
  profile,
  onSave,
}) => {
  const [form] = Form.useForm();
  const { rules } = useBonusRules();
  const [bonusDropdownOpen, setBonusDropdownOpen] = useState(false);

  const selectedSalaryType = Form.useWatch('salaryType', form);
  const selectedPaymentMethod = Form.useWatch(['paymentDetails', 'method'], form);

  useEffect(() => {
    if (profile && open) {
      form.setFieldsValue({
        salaryType: profile.salaryType || 'fixed',
        baseSalaryGHS: profile.baseSalaryGHS || 0,
        payFrequency: profile.payFrequency || 'monthly',
        allowances: {
          transportGHS: profile.allowances?.transportGHS || 0,
          housingGHS: profile.allowances?.housingGHS || 0,
          mealGHS: profile.allowances?.mealGHS || 0,
          otherGHS: profile.allowances?.otherGHS || 0,
        },
        deductions: {
          taxSSNITGHS: profile.deductions?.taxSSNITGHS || 0,
          loanRepaymentGHS: profile.deductions?.loanRepaymentGHS || 0,
          advanceDeductionGHS: profile.deductions?.advanceDeductionGHS || 0,
          latenessDeductionGHS: profile.deductions?.latenessDeductionGHS || 0,
          absenceDeductionGHS: profile.deductions?.absenceDeductionGHS || 0,
        },
        commissionPercentage: profile.commissionPercentage || 0,
        commissionFlatGHS: profile.commissionFlatGHS || 0,
        eligibleBonusRuleIds: profile.eligibleBonusRuleIds || [],
        paymentDetails: {
          method: profile.paymentDetails?.method || 'bank_transfer',
          bankName: profile.paymentDetails?.bankName || '',
          accountNumber: profile.paymentDetails?.accountNumber || '',
          accountName: profile.paymentDetails?.accountName || profile.staffName,
          branchName: profile.paymentDetails?.branchName || '',
          momoProvider: profile.paymentDetails?.momoProvider || 'MTN',
          momoNumber: profile.paymentDetails?.momoNumber || '',
        },
        notes: profile.notes || '',
      });
    }
  }, [profile, open, form]);

  const handleSubmit = (values: any) => {
    onSave(values);
    onClose();
  };

  return (
    <Modal
      title={
        <Space>
          <DollarOutlined style={{ color: '#2E5E8C' }} />
          <span>Configure Compensation Profile — {profile?.staffName}</span>
        </Space>
      }
      open={open}
      onCancel={onClose}
      width={740}
      footer={null}
      destroyOnClose
    >
      <Form form={form} layout="vertical" onFinish={handleSubmit}>
        {/* Structure & Base Pay */}
        <div style={{ background: '#f8fafc', padding: 14, borderRadius: 8, marginBottom: 16 }}>
          <Text strong style={{ fontSize: 14, color: '#1e293b', display: 'block', marginBottom: 12 }}>
            💼 Salary Type & Base Frequency
          </Text>
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item
                name="salaryType"
                label="Salary Structure Type"
                rules={[{ required: true, message: 'Please select salary type' }]}
              >
                <Select placeholder="Select structure">
                  {Object.entries(salaryTypeLabels).map(([key, val]) => (
                    <Option key={key} value={key}>
                      <span style={{ fontWeight: 600 }}>{val.label}</span>
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                name="payFrequency"
                label="Pay Frequency"
                rules={[{ required: true, message: 'Select frequency' }]}
              >
                <Select placeholder="Select frequency">
                  {Object.entries(payFrequencyLabels).map(([key, val]) => (
                    <Option key={key} value={key}>
                      {val}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                name="baseSalaryGHS"
                label="Base Salary (GH₵)"
                rules={[{ required: selectedSalaryType !== 'incentive_only', message: 'Enter base salary' }]}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  prefix="GH₵"
                  min={0}
                  step={100}
                  placeholder="e.g. 4500"
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <div style={{ paddingTop: 8 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {salaryTypeLabels[selectedSalaryType as SalaryType]?.desc || 'Standard staff compensation structure'}
                </Text>
              </div>
            </Col>
          </Row>
        </div>

        {/* Allowances Section */}
        <div style={{ background: '#f6ffed', padding: 14, borderRadius: 8, marginBottom: 16, border: '1px solid #b7eb8f' }}>
          <Text strong style={{ fontSize: 14, color: '#237804', display: 'block', marginBottom: 12 }}>
            ➕ Standard Monthly Allowances
          </Text>
          <Row gutter={12}>
            <Col xs={12} sm={6}>
              <Form.Item name={['allowances', 'transportGHS']} label="Transport (GH₵)">
                <InputNumber min={0} style={{ width: '100%' }} placeholder="0.00" />
              </Form.Item>
            </Col>
            <Col xs={12} sm={6}>
              <Form.Item name={['allowances', 'housingGHS']} label="Housing (GH₵)">
                <InputNumber min={0} style={{ width: '100%' }} placeholder="0.00" />
              </Form.Item>
            </Col>
            <Col xs={12} sm={6}>
              <Form.Item name={['allowances', 'mealGHS']} label="Meal (GH₵)">
                <InputNumber min={0} style={{ width: '100%' }} placeholder="0.00" />
              </Form.Item>
            </Col>
            <Col xs={12} sm={6}>
              <Form.Item name={['allowances', 'otherGHS']} label="Other (GH₵)">
                <InputNumber min={0} style={{ width: '100%' }} placeholder="0.00" />
              </Form.Item>
            </Col>
          </Row>
        </div>

        {/* Deductions Section */}
        <div style={{ background: '#fff1f0', padding: 14, borderRadius: 8, marginBottom: 16, border: '1px solid #ffa39e' }}>
          <Text strong style={{ color: '#cf1322', fontSize: 14, display: 'block', marginBottom: 12 }}>
            ➖ Standard Monthly Deductions
          </Text>
          <Row gutter={12}>
            <Col xs={12} sm={8}>
              <Form.Item name={['deductions', 'taxSSNITGHS']} label="SSNIT / Income Tax (GH₵)">
                <InputNumber min={0} style={{ width: '100%' }} placeholder="0.00" />
              </Form.Item>
            </Col>
            <Col xs={12} sm={8}>
              <Form.Item name={['deductions', 'loanRepaymentGHS']} label="Loan Repayment (GH₵)">
                <InputNumber min={0} style={{ width: '100%' }} placeholder="0.00" />
              </Form.Item>
            </Col>
            <Col xs={12} sm={8}>
              <Form.Item name={['deductions', 'advanceDeductionGHS']} label="Advance Recovery (GH₵)">
                <InputNumber min={0} style={{ width: '100%' }} placeholder="0.00" />
              </Form.Item>
            </Col>
          </Row>
        </div>

        {/* Commissions & Eligible Bonuses */}
        <div style={{ background: '#f9f0ff', padding: 14, borderRadius: 8, marginBottom: 16, border: '1px solid #d3adf7' }}>
          <Text strong style={{ color: '#531dab', fontSize: 14, display: 'block', marginBottom: 12 }}>
            🎯 Commission & Rule-Based Incentive Policy
          </Text>
          <Row gutter={16}>
            <Col xs={12} sm={8}>
              <Form.Item name="commissionPercentage" label="Deal Commission (%)">
                <InputNumber min={0} max={100} step={0.5} style={{ width: '100%' }} prefix={<PercentageOutlined />} />
              </Form.Item>
            </Col>
            <Col xs={12} sm={8}>
              <Form.Item name="commissionFlatGHS" label="Flat Commission / Deal (GH₵)">
                <InputNumber min={0} style={{ width: '100%' }} prefix="GH₵" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item name="eligibleBonusRuleIds" label="Eligible Rule Bonuses">
                <Select
                  mode="multiple"
                  placeholder="Select eligible rules"
                  maxTagCount={2}
                  open={bonusDropdownOpen}
                  onDropdownVisibleChange={setBonusDropdownOpen}
                  dropdownRender={(menu) => (
                    <div>
                      {menu}
                      <Divider style={{ margin: '6px 0' }} />
                      <div style={{ padding: '4px 8px 6px', display: 'flex', justifyContent: 'flex-end' }}>
                        <Button
                          type="primary"
                          size="small"
                          icon={<CheckCircleOutlined />}
                          onClick={() => setBonusDropdownOpen(false)}
                          style={{ fontSize: 12, height: 26 }}
                        >
                          Done
                        </Button>
                      </div>
                    </div>
                  )}
                >
                  {rules.map((r) => (
                    <Option key={r.id} value={r.id}>
                      {r.name} (GH₵ {r.amountGHS})
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>
        </div>

        {/* Payment Method & Bank/MoMo Details */}
        <div style={{ background: '#f0f5ff', padding: 14, borderRadius: 8, marginBottom: 16, border: '1px solid #adc6ff' }}>
          <Text strong style={{ color: '#1d39c4', fontSize: 14, display: 'block', marginBottom: 12 }}>
            💳 Disbursement & Payment Method
          </Text>
          <Row gutter={16}>
            <Col xs={24} sm={8}>
              <Form.Item name={['paymentDetails', 'method']} label="Payment Method" rules={[{ required: true }]}>
                <Select>
                  {Object.entries(paymentMethodLabels).map(([k, v]) => (
                    <Option key={k} value={k}>
                      {v.icon} {v.label}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>

            {selectedPaymentMethod === 'bank_transfer' && (
              <>
                <Col xs={24} sm={8}>
                  <Form.Item name={['paymentDetails', 'bankName']} label="Bank Name" rules={[{ required: true, message: 'Bank name required' }]}>
                    <Input placeholder="e.g. GCB Bank, Ecobank" />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={8}>
                  <Form.Item name={['paymentDetails', 'accountNumber']} label="Account Number" rules={[{ required: true, message: 'Account number required' }]}>
                    <Input placeholder="e.g. 1029384756" />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item name={['paymentDetails', 'accountName']} label="Account Holder Name">
                    <Input placeholder="Name on account" />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item name={['paymentDetails', 'branchName']} label="Bank Branch">
                    <Input placeholder="e.g. High Street / Osu" />
                  </Form.Item>
                </Col>
              </>
            )}

            {selectedPaymentMethod === 'momo' && (
              <>
                <Col xs={24} sm={8}>
                  <Form.Item name={['paymentDetails', 'momoProvider']} label="MoMo Network" rules={[{ required: true }]}>
                    <Select>
                      <Option value="MTN">MTN MoMo</Option>
                      <Option value="Telecel">Telecel Cash</Option>
                      <Option value="AT">AT Money</Option>
                    </Select>
                  </Form.Item>
                </Col>
                <Col xs={24} sm={8}>
                  <Form.Item name={['paymentDetails', 'momoNumber']} label="Mobile Number" rules={[{ required: true, message: 'MoMo number required' }]}>
                    <Input placeholder="e.g. 0244123456" />
                  </Form.Item>
                </Col>
              </>
            )}
          </Row>
        </div>

        <Form.Item name="notes" label="HR & Compensation Remarks">
          <TextArea rows={2} placeholder="Optional notes regarding employment contract or bonus terms..." />
        </Form.Item>

        <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
          <Space>
            <Button onClick={onClose}>Cancel</Button>
            <Button type="primary" htmlType="submit">
              Save Compensation Package
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </Modal>
  );
};
