// src/pages/portal/PortalLoginPage.tsx
// ⚠️ PROTOTYPE — see src/mock/portalAuth.ts and src/mock/customerPortalCache.ts.
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Button, Card, Form, Input, Tag, Typography } from 'antd';
import { LockOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import { PhoneInput } from '@/components/shared/PhoneInput';
import { tokens } from '@/constants/tokens';
import { useCustomerPortalAuth } from '@/contexts/CustomerPortalAuthContext';
import { lookupPortalCustomer, activatePortalAccount, verifyPortalPassword, type PortalLookupResult } from '@/mock/portalAuth';

const { Title, Text } = Typography;

export const PortalLoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { setSessionCustomerId } = useCustomerPortalAuth();
  const [phoneForm] = Form.useForm();
  const [passwordForm] = Form.useForm();
  const [lookup, setLookup] = useState<Exclude<PortalLookupResult, { status: 'not_found' }> | null>(null);
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);

  const handlePhoneSubmit = (values: { phoneNumber: string }) => {
    setError(undefined);
    const result = lookupPortalCustomer(values.phoneNumber);
    if (result.status === 'not_found') {
      setError("We couldn't find a customer record with that phone number. Please contact your account manager.");
      return;
    }
    setLookup(result);
  };

  const handleActivate = (values: { password: string; confirmPassword: string }) => {
    if (!lookup || lookup.status !== 'needs_activation') return;
    setLoading(true);
    activatePortalAccount(lookup.customer, values.password);
    setSessionCustomerId(lookup.customer.id);
    setLoading(false);
    navigate('/portal');
  };

  const handleLogin = (values: { password: string }) => {
    if (!lookup) return;
    setLoading(true);
    const ok = verifyPortalPassword(lookup.customer.id, values.password);
    setLoading(false);
    if (!ok) {
      setError('Incorrect password. Please try again.');
      return;
    }
    setSessionCustomerId(lookup.customer.id);
    navigate('/portal');
  };

  const reset = () => {
    setLookup(null);
    setError(undefined);
    phoneForm.resetFields();
    passwordForm.resetFields();
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f2f5', padding: 16 }}>
      <Card style={{ width: 420, borderRadius: 12 }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <Title level={3} style={{ color: tokens.primary, marginBottom: 0 }}>Omark Customer Portal</Title>
          <Text type="secondary">Track your property, payments and complaints</Text>
          <div style={{ marginTop: 8 }}>
            <Tag color="gold">Preview</Tag>
          </div>
        </div>

        {error && <Alert type="error" message={error} showIcon style={{ marginBottom: 16 }} />}

        {!lookup && (
          <Form form={phoneForm} layout="vertical" onFinish={handlePhoneSubmit}>
            <Form.Item
              name="phoneNumber"
              label="Phone Number"
              rules={[{ required: true, message: 'Please enter the phone number on your account' }]}
            >
              <PhoneInput placeholder="+233 XX XXX XXXX" />
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType="submit" block style={{ backgroundColor: tokens.primary, height: 42 }}>
                Continue
              </Button>
            </Form.Item>
          </Form>
        )}

        {lookup && lookup.status === 'needs_activation' && (
          <>
            <Alert
              type="info"
              showIcon
              icon={<SafetyCertificateOutlined />}
              message={`Welcome, ${lookup.customer.firstName}!`}
              description="This is your first time here — set a password to access your portal."
              style={{ marginBottom: 16 }}
            />
            <Form form={passwordForm} layout="vertical" onFinish={handleActivate}>
              <Form.Item
                name="password"
                label="Create Password"
                rules={[{ required: true, message: 'Password is required' }, { min: 6, message: 'At least 6 characters' }]}
              >
                <Input.Password prefix={<LockOutlined />} placeholder="Min. 6 characters" />
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
                <Input.Password prefix={<LockOutlined />} placeholder="Repeat password" />
              </Form.Item>
              <Form.Item>
                <Button type="primary" htmlType="submit" loading={loading} block style={{ backgroundColor: tokens.primary, height: 42 }}>
                  Activate Account
                </Button>
              </Form.Item>
              <Button type="link" block onClick={reset}>Use a different phone number</Button>
            </Form>
          </>
        )}

        {lookup && lookup.status === 'has_account' && (
          <>
            <Text style={{ display: 'block', marginBottom: 16 }}>
              Welcome back, <strong>{lookup.customer.firstName}</strong>.
            </Text>
            <Form form={passwordForm} layout="vertical" onFinish={handleLogin}>
              <Form.Item name="password" label="Password" rules={[{ required: true, message: 'Please enter your password' }]}>
                <Input.Password prefix={<LockOutlined />} placeholder="Enter your password" />
              </Form.Item>
              <Form.Item>
                <Button type="primary" htmlType="submit" loading={loading} block style={{ backgroundColor: tokens.primary, height: 42 }}>
                  Sign In
                </Button>
              </Form.Item>
              <Button type="link" block onClick={reset}>Use a different phone number</Button>
            </Form>
          </>
        )}

        <Text type="secondary" style={{ fontSize: 11, display: 'block', textAlign: 'center', marginTop: 16 }}>
          Preview feature — property and payment figures shown here are a snapshot from our records, not live.
        </Text>
      </Card>
    </div>
  );
};
