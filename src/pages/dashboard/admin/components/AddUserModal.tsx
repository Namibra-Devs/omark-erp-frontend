// src/pages/dashboard/admin/components/AddUserModal.tsx
import React, { useState } from 'react';
import {
  Modal, Form, Input, Select, Row, Col, Button, Tag, Typography, Avatar, Divider, message,
} from 'antd';
import {
  UserOutlined, MailOutlined, LockOutlined, TeamOutlined,
  CheckCircleFilled, ArrowRightOutlined, ArrowLeftOutlined,
  CrownOutlined, CustomerServiceOutlined, AuditOutlined,
  SolutionOutlined, DollarCircleOutlined, BarChartOutlined,
} from '@ant-design/icons';
import { PhoneInput } from '@/components/shared/PhoneInput';

const { Text, Title } = Typography;

// ── Role definitions with icon + colour ────────────────────────────────────
const ROLES = [
  {
    value: 'admin',
    label: 'Administrator',
    icon: <CrownOutlined />,
    color: '#f5222d',
    bg: '#fff1f0',
    border: '#ffa39e',
    desc: 'Full system access',
  },
  {
    value: 'marketing_director',
    label: 'Marketing Director',
    icon: <BarChartOutlined />,
    color: '#722ed1',
    bg: '#f9f0ff',
    border: '#d3adf7',
    desc: 'Manage campaigns & team',
  },
  {
    value: 'marketing_staff',
    label: 'Marketing Staff',
    icon: <SolutionOutlined />,
    color: '#1890ff',
    bg: '#e6f7ff',
    border: '#91d5ff',
    desc: 'Prospects & outreach',
  },
  {
    value: 'customer_service',
    label: 'Customer Service',
    icon: <CustomerServiceOutlined />,
    color: '#13c2c2',
    bg: '#e6fffb',
    border: '#87e8de',
    desc: 'Customer support',
  },
  {
    value: 'secretary',
    label: 'Secretary',
    icon: <AuditOutlined />,
    color: '#fa8c16',
    bg: '#fff7e6',
    border: '#ffd591',
    desc: 'Admin & documentation',
  },
  {
    value: 'accounts',
    label: 'Accounts',
    icon: <DollarCircleOutlined />,
    color: '#52c41a',
    bg: '#f6ffed',
    border: '#b7eb8f',
    desc: 'Finance & payments',
  },
];

// ── Department auto-fill by role ───────────────────────────────────────────
const DEPT_BY_ROLE: Record<string, string> = {
  admin: 'Administration',
  secretary: 'Administration',
  marketing_staff: 'Marketing',
  marketing_director: 'Marketing',
  customer_service: 'Customer Service',
  accounts: 'Finance',
};

// ── Step indicator ─────────────────────────────────────────────────────────
const StepDot: React.FC<{ step: number; current: number; label: string }> = ({
  step, current, label,
}) => {
  const done = current > step;
  const active = current === step;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: done ? 16 : 13,
          fontWeight: 700,
          transition: 'all 0.3s ease',
          background: done ? '#52c41a' : active ? '#6366f1' : '#f0f0f0',
          color: done || active ? '#fff' : '#bbb',
          boxShadow: active ? '0 0 0 4px #6366f120' : 'none',
        }}
      >
        {done ? <CheckCircleFilled /> : step}
      </div>
      <Text
        style={{
          fontSize: 11,
          fontWeight: active ? 600 : 400,
          color: active ? '#6366f1' : done ? '#52c41a' : '#bbb',
          whiteSpace: 'nowrap',
          transition: 'color 0.3s',
        }}
      >
        {label}
      </Text>
    </div>
  );
};

const StepBar: React.FC<{ current: number }> = ({ current }) => (
  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center', gap: 0, marginBottom: 28 }}>
    {(['Personal Info', 'Role & Access', 'Security'] as const).map((label, i) => (
      <React.Fragment key={i}>
        <StepDot step={i + 1} current={current} label={label} />
        {i < 2 && (
          <div
            style={{
              flex: 1,
              height: 2,
              marginTop: 15,
              background: current > i + 1 ? '#52c41a' : '#f0f0f0',
              transition: 'background 0.4s ease',
              maxWidth: 80,
            }}
          />
        )}
      </React.Fragment>
    ))}
  </div>
);

// ── Role card picker ───────────────────────────────────────────────────────
const RolePicker: React.FC<{
  value?: string;
  onChange?: (v: string) => void;
}> = ({ value, onChange }) => (
  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
    {ROLES.map((r) => {
      const selected = value === r.value;
      return (
        <div
          key={r.value}
          onClick={() => onChange?.(r.value)}
          style={{
            border: `2px solid ${selected ? r.color : '#e8e8e8'}`,
            borderRadius: 12,
            padding: '12px 14px',
            cursor: 'pointer',
            background: selected ? r.bg : '#fafafa',
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: selected ? r.color : '#efefef',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 16,
              color: selected ? '#fff' : '#aaa',
              transition: 'all 0.2s ease',
              flexShrink: 0,
            }}
          >
            {r.icon}
          </div>
          <div style={{ minWidth: 0 }}>
            <Text
              strong
              style={{
                fontSize: 13,
                color: selected ? r.color : '#333',
                display: 'block',
                lineHeight: 1.3,
              }}
            >
              {r.label}
            </Text>
            <Text type="secondary" style={{ fontSize: 11 }}>
              {r.desc}
            </Text>
          </div>
          {selected && (
            <CheckCircleFilled
              style={{ color: r.color, fontSize: 16, marginLeft: 'auto', flexShrink: 0 }}
            />
          )}
        </div>
      );
    })}
  </div>
);

// ── Preview avatar built from form values ──────────────────────────────────
const UserPreview: React.FC<{ firstName?: string; lastName?: string; role?: string }> = ({
  firstName, lastName, role,
}) => {
  const roleInfo = ROLES.find((r) => r.value === role);
  const initials =
    `${firstName?.[0] ?? ''}${lastName?.[0] ?? ''}`.toUpperCase() || '?';

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 16px',
        background: '#fafafa',
        border: '1px solid #f0f0f0',
        borderRadius: 12,
        marginBottom: 20,
      }}
    >
      <Avatar
        size={44}
        style={{
          background: roleInfo?.color ?? '#6366f1',
          fontWeight: 700,
          fontSize: 16,
        }}
      >
        {initials}
      </Avatar>
      <div>
        <Text strong style={{ display: 'block', fontSize: 15 }}>
          {firstName || lastName
            ? `${firstName ?? ''} ${lastName ?? ''}`.trim()
            : 'New Staff Member'}
        </Text>
        {roleInfo ? (
          <Tag
            style={{
              borderRadius: 20,
              fontSize: 11,
              border: 'none',
              background: roleInfo.bg,
              color: roleInfo.color,
              fontWeight: 600,
            }}
          >
            {roleInfo.icon} {roleInfo.label}
          </Tag>
        ) : (
          <Text type="secondary" style={{ fontSize: 12 }}>No role selected</Text>
        )}
      </div>
    </div>
  );
};

// ── Main modal ─────────────────────────────────────────────────────────────
interface AddUserModalProps {
  open: boolean;
  onCancel: () => void;
  onAdd: (values: any) => void;
  loading?: boolean;
}

export const AddUserModal: React.FC<AddUserModalProps> = ({
  open, onCancel, onAdd, loading,
}) => {
  const [form] = Form.useForm();
  const [step, setStep] = useState(1);
  const [preview, setPreview] = useState<{
    firstName?: string; lastName?: string; role?: string;
  }>({});

  const reset = () => {
    form.resetFields();
    setStep(1);
    setPreview({});
  };

  const handleCancel = () => {
    onCancel();
    reset();
  };

  const nextStep = async () => {
    const fieldsPerStep: Record<number, string[]> = {
      1: ['firstName', 'lastName', 'email', 'phoneNumber'],
      2: ['role', 'department'],
    };
    try {
      await form.validateFields(fieldsPerStep[step]);
      const vals = form.getFieldsValue();
      setPreview({ firstName: vals.firstName, lastName: vals.lastName, role: vals.role });
      setStep((s) => s + 1);
    } catch {
      // validation errors managed by antd
    }
  };

  const handleRoleChange = (role: string) => {
    form.setFieldsValue({
      role: role,
      department: DEPT_BY_ROLE[role] ?? '',
    });
    setPreview((p) => ({ ...p, role }));
  };

  const handleFinish = async (values: any) => {
    try {
      console.log('🔍 AddUserModal - Form values received:', values);

      // Build the complete payload with all required fields
      const fullName = `${values.firstName?.trim() || ''} ${values.lastName?.trim() || ''}`.trim();

      const payload = {
        name: fullName,
        firstName: values.firstName?.trim() || '',
        lastName: values.lastName?.trim() || '',
        email: values.email?.trim() || '',
        phone: values.phoneNumber?.trim() || '',
        phoneNumber: values.phoneNumber?.trim() || '',
        password: values.password || '',
        role: values.role || 'marketing_staff',
        department: values.department || 'Marketing',
        isActive: true,
      };

      console.log('📤 AddUserModal - Payload being sent to addUser:', payload);

      // Validate required fields
      if (!payload.firstName) {
        console.error('❌ First name is empty in payload');
        message.error('First name is required');
        return;
      }
      if (!payload.lastName) {
        console.error('❌ Last name is empty in payload');
        message.error('Last name is required');
        return;
      }
      if (!payload.email) {
        console.error('❌ Email is empty in payload');
        message.error('Email is required');
        return;
      }
      if (!payload.phoneNumber) {
        console.error('❌ Phone number is empty in payload');
        message.error('Phone number is required');
        return;
      }
      if (!payload.password || payload.password.length < 8) {
        console.error('❌ Password is invalid:', payload.password);
        message.error('Password must be at least 8 characters');
        return;
      }

      await onAdd(payload);
      reset();
    } catch (error: any) {
      console.error('❌ Error in AddUserModal handleFinish:', error);
      message.error(error?.message || 'Failed to add user');
    }
  };

  // ── Step content ─────────────────────────────────────────────────────────
  // IMPORTANT: all three steps stay mounted at all times. We only toggle
  // visibility with CSS `display`. Previously this used `STEP_CONTENT[step]`
  // rendered inside a `<div key={step}>`, which fully unmounted the
  // Form.Items of steps you'd already filled in — antd's `preserve` flag
  // could not reliably save you from that, so firstName/lastName/email/
  // phoneNumber/role/department were silently missing from the payload by
  // the time step 3 submitted. Keeping every Form.Item mounted guarantees
  // the form store always has every field's value.
  const STEP_CONTENT: Record<number, React.ReactNode> = {
    1: (
      <div style={{ display: step === 1 ? 'block' : 'none' }}>
        <Row gutter={14}>
          <Col span={12}>
            <Form.Item
              name="firstName"
              label="First Name"
              rules={[{ required: true, message: 'First name is required' }]}
            >
              <Input
                prefix={<UserOutlined style={{ color: '#bbb' }} />}
                placeholder="First name"
                onChange={(e) => setPreview((p) => ({ ...p, firstName: e.target.value }))}
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="lastName"
              label="Last Name"
              rules={[{ required: true, message: 'Last name is required' }]}
            >
              <Input
                prefix={<UserOutlined style={{ color: '#bbb' }} />}
                placeholder="Last name"
                onChange={(e) => setPreview((p) => ({ ...p, lastName: e.target.value }))}
              />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item
          name="email"
          label="Email Address"
          rules={[
            { required: true, message: 'Email is required' },
            { type: 'email', message: 'Enter a valid email address' },
          ]}
        >
          <Input
            prefix={<MailOutlined style={{ color: '#bbb' }} />}
            placeholder="user@omark.com"
          />
        </Form.Item>

        <Form.Item
          name="phoneNumber"
          label="Phone Number"
          rules={[{ required: true, message: 'Phone number is required' }]}
        >
          <PhoneInput placeholder="+233 XX XXX XXXX" />
        </Form.Item>
      </div>
    ),

    2: (
      <div style={{ display: step === 2 ? 'block' : 'none' }}>
        <Form.Item
          name="role"
          rules={[{ required: true, message: 'Please select a role' }]}
          style={{ marginBottom: 8 }}
        >
          <RolePicker onChange={handleRoleChange} />
        </Form.Item>

        <Form.Item
          name="department"
          label="Department"
          rules={[{ required: true, message: 'Department is required' }]}
          style={{ marginTop: 12 }}
        >
          <Input
            prefix={<TeamOutlined style={{ color: '#bbb' }} />}
            placeholder="Auto-filled or enter manually"
          />
        </Form.Item>
      </div>
    ),

    3: (
      <div style={{ display: step === 3 ? 'block' : 'none' }}>
        <UserPreview {...preview} />

        <Form.Item
          name="password"
          label="Temporary Password"
          rules={[
            { required: true, message: 'Password is required' },
            { min: 8, message: 'Password must be at least 8 characters' },
          ]}
          extra="The staff member will be prompted to change this on first login."
        >
          <Input.Password
            prefix={<LockOutlined style={{ color: '#bbb' }} />}
            placeholder="Min. 8 characters"
          />
        </Form.Item>

        <Form.Item
          name="confirmPassword"
          label="Confirm Password"
          dependencies={['password']}
          rules={[
            { required: true, message: 'Please confirm your password' },
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (!value || getFieldValue('password') === value) return Promise.resolve();
                return Promise.reject(new Error('Passwords do not match'));
              },
            }),
          ]}
        >
          <Input.Password
            prefix={<LockOutlined style={{ color: '#bbb' }} />}
            placeholder="Repeat password"
          />
        </Form.Item>
      </div>
    ),
  };

  return (
    <Modal
      title={null}
      open={open}
      onCancel={handleCancel}
      footer={null}
      width={580}
      destroyOnHidden={false}
      styles={{
        content: { borderRadius: 16, padding: 0, overflow: 'hidden' },
        body: { padding: 0 },
      }}
    >
      {/* Coloured header band */}
      <div
        style={{
          background: 'linear-gradient(135deg, #04041dff 0%, #06044cff 100%)',
          padding: '20px 28px 16px',
        }}
      >
        <Title level={4} style={{ margin: 0, color: '#fff' }}>
          Add Staff Member
        </Title>
        <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13 }}>
          Step {step} of 3 — {['Personal Info', 'Role & Access', 'Security'][step - 1]}
        </Text>
      </div>

      <div style={{ padding: '24px 28px' }}>
        <StepBar current={step} />

        <Form
          form={form}
          layout="vertical"
          onFinish={handleFinish}
          requiredMark={false}
          preserve={true}
        >
          {/* All three steps are mounted simultaneously — see STEP_CONTENT
              comment above. This div no longer uses `key={step}`, since
              that was forcing a full unmount/remount of previous steps'
              Form.Items and wiping their values from the form store. */}
          <div style={{ animation: 'stepIn 0.25s ease both' }}>
            <style>{`
              @keyframes stepIn {
                from { opacity: 0; transform: translateX(16px); }
                to   { opacity: 1; transform: translateX(0); }
              }
            `}</style>
            {STEP_CONTENT[1]}
            {STEP_CONTENT[2]}
            {STEP_CONTENT[3]}
          </div>

          <Divider style={{ margin: '16px 0' }} />

          {/* Navigation */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Button
              onClick={step === 1 ? handleCancel : () => setStep((s) => s - 1)}
              icon={step > 1 ? <ArrowLeftOutlined /> : undefined}
              style={{ borderRadius: 8 }}
            >
              {step === 1 ? 'Cancel' : 'Back'}
            </Button>

            {step < 3 ? (
              <Button
                type="primary"
                onClick={nextStep}
                icon={<ArrowRightOutlined />}
                style={{ borderRadius: 8, minWidth: 110 }}
              >
                Continue
              </Button>
            ) : (
              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
                icon={<CheckCircleFilled />}
                style={{
                  borderRadius: 8,
                  minWidth: 130,
                  background: '#52c41a',
                  borderColor: '#52c41a',
                  fontWeight: 600,
                }}
              >
                Add Staff
              </Button>
            )}
          </div>
        </Form>
      </div>
    </Modal>
  );
};