// src/components/bonus/BonusRulesModal.tsx
import React, { useState } from 'react';
import {
  Modal, Table, Switch, InputNumber, Button, Space, Tag, Typography,
  message, Card, Alert, Divider, Form, Input, Select, Popconfirm, Row, Col
} from 'antd';
import {
  SettingOutlined, TrophyOutlined, PlusOutlined, DeleteOutlined,
  DollarOutlined, CheckCircleOutlined, InfoCircleOutlined
} from '@ant-design/icons';
import {
  useBonusRules,
  bonusTypeLabels,
  type BonusRule,
  type BonusType,
  type BonusEventType,
} from '@/mock/bonusRules';
import { roleLabels } from '@/constants/enums';
import { tokens } from '@/constants/tokens';

const { Text, Title, Paragraph } = Typography;
const { Option } = Select;
const { TextArea } = Input;

interface BonusRulesModalProps {
  open: boolean;
  onClose: () => void;
}

export const BonusRulesModal: React.FC<BonusRulesModalProps> = ({ open, onClose }) => {
  const { rules, addRule, updateRule, deleteRule } = useBonusRules();
  const [editingAmounts, setEditingAmounts] = useState<Record<string, number>>({});
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [rolesDropdownOpen, setRolesDropdownOpen] = useState(false);
  const [form] = Form.useForm();

  const handleToggle = (rule: BonusRule, checked: boolean) => {
    try {
      updateRule(rule.id, { isActive: checked });
      message.success(`${rule.name} ${checked ? 'enabled' : 'disabled'}`);
    } catch (err: any) {
      message.error(err.message || 'Failed to update rule');
    }
  };

  const handleAmountChange = (ruleId: string, val: number | null) => {
    if (val !== null && val >= 0) {
      setEditingAmounts((prev) => ({ ...prev, [ruleId]: val }));
    }
  };

  const handleSaveAmount = (rule: BonusRule) => {
    const newAmount = editingAmounts[rule.id];
    if (newAmount === undefined || newAmount === rule.amountGHS) return;
    try {
      updateRule(rule.id, { amountGHS: newAmount });
      message.success(`Updated ${rule.name} to GH₵ ${newAmount.toFixed(2)}`);
      setEditingAmounts((prev) => {
        const next = { ...prev };
        delete next[rule.id];
        return next;
      });
    } catch (err: any) {
      message.error(err.message || 'Failed to update rule');
    }
  };

  const handleCreateRule = (values: any) => {
    try {
      addRule({
        bonusType: values.bonusType,
        eventType: values.eventType || 'custom',
        name: values.name,
        amountGHS: values.amountGHS,
        applicableRoles: values.applicableRoles || ['marketing_staff', 'customer_service'],
        isActive: true,
        description: values.description,
        criteria: values.criteria,
      });
      message.success('New bonus rule created successfully');
      setCreateModalOpen(false);
      form.resetFields();
    } catch (err: any) {
      message.error('Failed to create bonus rule');
    }
  };

  const columns = [
    {
      title: 'Bonus Rule & Type',
      key: 'name',
      render: (_: any, record: BonusRule) => {
        const typeInfo = bonusTypeLabels[record.bonusType] || bonusTypeLabels.custom;
        return (
          <div>
            <Space align="center">
              <span style={{ fontSize: 16 }}>{typeInfo.icon}</span>
              <Text strong style={{ fontSize: 14 }}>{record.name}</Text>
              <Tag color={typeInfo.color} style={{ fontSize: 11, borderRadius: 10 }}>
                {typeInfo.label}
              </Tag>
            </Space>
            <Paragraph type="secondary" style={{ fontSize: 12, margin: '4px 0 0 0' }}>
              {record.description}
            </Paragraph>
            {record.criteria && (
              <div style={{ marginTop: 2 }}>
                <Text type="secondary" style={{ fontSize: 11, color: '#8c8c8c' }}>
                  <strong>Criteria:</strong> {record.criteria}
                </Text>
              </div>
            )}
          </div>
        );
      },
    },
    {
      title: 'Applicable Roles',
      key: 'roles',
      width: 200,
      render: (_: any, record: BonusRule) => (
        <Space wrap size={[4, 4]}>
          {record.applicableRoles.map((r) => (
            <Tag key={r} color="blue" style={{ fontSize: 11 }}>
              {roleLabels[r as keyof typeof roleLabels] || r}
            </Tag>
          ))}
        </Space>
      ),
    },
    {
      title: 'Bonus Payout (GH₵)',
      key: 'amount',
      width: 170,
      render: (_: any, record: BonusRule) => {
        const currentEdit = editingAmounts[record.id] ?? record.amountGHS;
        const isModified = editingAmounts[record.id] !== undefined && editingAmounts[record.id] !== record.amountGHS;

        return (
          <Space direction="vertical" size={2}>
            <Space>
              <InputNumber
                min={0}
                max={100000}
                precision={2}
                prefix="GH₵"
                value={currentEdit}
                onChange={(val) => handleAmountChange(record.id, val)}
                style={{ width: 110 }}
              />
              {isModified && (
                <Button size="small" type="primary" onClick={() => handleSaveAmount(record)}>
                  Save
                </Button>
              )}
            </Space>
            <Text type="secondary" style={{ fontSize: 11 }}>
              Per qualifying event
            </Text>
          </Space>
        );
      },
    },
    {
      title: 'Active',
      key: 'status',
      width: 80,
      align: 'center' as const,
      render: (_: any, record: BonusRule) => (
        <Switch
          checked={record.isActive}
          onChange={(checked) => handleToggle(record, checked)}
          checkedChildren="ON"
          unCheckedChildren="OFF"
        />
      ),
    },
    {
      title: '',
      key: 'actions',
      width: 50,
      render: (_: any, record: BonusRule) => (
        <Popconfirm title="Delete this bonus rule?" onConfirm={() => deleteRule(record.id)}>
          <Button type="text" danger size="small" icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
  ];

  return (
    <>
      <Modal
        title={
          <Space>
            <SettingOutlined style={{ color: tokens.primary, fontSize: 18 }} />
            <Text strong style={{ fontSize: 16 }}>Rule-Based Staff Bonus & Incentive Settings</Text>
          </Space>
        }
        open={open}
        onCancel={onClose}
        footer={[
          <Button key="add" icon={<PlusOutlined />} onClick={() => setCreateModalOpen(true)}>
            Add New Bonus Rule
          </Button>,
          <Button key="close" type="primary" onClick={onClose}>
            Done
          </Button>,
        ]}
        width={860}
        style={{ maxWidth: '95%', top: 24 }}
      >
        <Alert
          message="Rule-Based Automated Staff Incentives"
          description="Bonuses in Omark ERP are strictly rule-based (Sales, Project Completion, Attendance, Punctuality, and Productivity). Qualifying activities logged across the system automatically accrue to staff records."
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />

        <Table
          columns={columns}
          dataSource={rules}
          rowKey="id"
          pagination={false}
          size="middle"
          scroll={{ x: 700 }}
        />
      </Modal>

      {/* Modal to Create New Rule */}
      <Modal
        title="Create New Bonus Rule"
        open={createModalOpen}
        onCancel={() => setCreateModalOpen(false)}
        footer={null}
        width={560}
      >
        <Form form={form} layout="vertical" onFinish={handleCreateRule}>
          <Form.Item name="name" label="Rule Name" rules={[{ required: true, message: 'Enter rule name' }]}>
            <Input placeholder="e.g. Land Documentation Bonus" />
          </Form.Item>

          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="bonusType" label="Bonus Category" rules={[{ required: true }]}>
                <Select placeholder="Select type">
                  {Object.entries(bonusTypeLabels).map(([k, v]) => (
                    <Option key={k} value={k}>
                      {v.icon} {v.label}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="amountGHS" label="Payout Amount (GH₵)" rules={[{ required: true }]}>
                <InputNumber min={0} prefix="GH₵" style={{ width: '100%' }} placeholder="250.00" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="applicableRoles" label="Eligible Staff Roles" rules={[{ required: true, message: 'Please select eligible roles' }]}>
            <Select
              mode="multiple"
              placeholder="Select eligible roles..."
              open={rolesDropdownOpen}
              onDropdownVisibleChange={setRolesDropdownOpen}
              maxTagCount="responsive"
              dropdownRender={(menu) => (
                <div>
                  {menu}
                  <Divider style={{ margin: '6px 0' }} />
                  <div style={{ padding: '4px 8px 6px', display: 'flex', justifyContent: 'flex-end' }}>
                    <Button
                      type="primary"
                      size="small"
                      icon={<CheckCircleOutlined />}
                      onClick={() => setRolesDropdownOpen(false)}
                      style={{ fontSize: 12, height: 26 }}
                    >
                      Done
                    </Button>
                  </div>
                </div>
              )}
            >
              {Object.entries(roleLabels).map(([role, label]) => (
                <Option key={role} value={role}>
                  {label}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item name="description" label="Description" rules={[{ required: true }]}>
            <TextArea rows={2} placeholder="Explain why and when this bonus is awarded..." />
          </Form.Item>

          <Form.Item name="criteria" label="Specific Qualification Criteria">
            <Input placeholder="e.g. 100% attendance, zero late records" />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setCreateModalOpen(false)}>Cancel</Button>
              <Button type="primary" htmlType="submit">
                Create Rule
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};
