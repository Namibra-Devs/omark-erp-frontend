// src/pages/portal/PortalLoginPage.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Button, Card, Form, Input, Typography, message } from 'antd';
import { LockOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import { PhoneInput } from '@/components/shared/PhoneInput';
import { tokens } from '@/constants/tokens';
import { usePortalActivateMutation, usePortalLoginMutation, usePortalRequestOtpMutation, usePortalVerifyOtpMutation } from '@/api/portal';

const { Title, Text } = Typography;

export const PortalLoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [step, setStep] = useState<'phone' | 'password' | 'otp'>('phone');
  const [error, setError] = useState<string>();

  const activateMutation = usePortalActivateMutation();
  const loginMutation = usePortalLoginMutation();
  const requestOtpMutation = usePortalRequestOtpMutation();
  const verifyOtpMutation = usePortalVerifyOtpMutation();

  const handlePhoneSubmit = async (values: { phoneNumber: string }) => {
    setError(undefined);
    setPhoneNumber(values.phoneNumber);
    try {
      await requestOtpMutation.mutateAsync({ phoneNumber: values.phoneNumber });
      message.success('OTP sent to your phone');
      setStep('otp');
    } catch {
      setStep('password');
    }
  };

  const handleOtpVerify = async (values: { code: string }) => {
    try {
      const res = await verifyOtpMutation.mutateAsync({ phoneNumber, code: values.code });
      if (res?.token) {
        localStorage.setItem('portal_token', res.token);
        navigate('/portal');
      }
    } catch (err: any) {
      setError(err?.error?.message || err?.message || 'OTP verification failed');
    }
  };

  const handleLogin = async (values: { password: string }) => {
    try {
      const res = await loginMutation.mutateAsync({ phoneNumber, password: values.password });
      if (res?.token) {
        localStorage.setItem('portal_token', res.token);
        navigate('/portal');
      }
    } catch (err: any) {
      try {
        const activateRes = await activateMutation.mutateAsync({ phoneNumber, password: values.password });
        if (activateRes?.token) {
          localStorage.setItem('portal_token', activateRes.token);
          navigate('/portal');
        }
      } catch (activateErr: any) {
        setError(activateErr?.error?.message || err?.error?.message || err?.message || 'Authentication failed');
      }
    }
  };

  const reset = () => {
    setStep('phone');
    setError(undefined);
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f2f5', padding: 12 }}>
      <Card style={{ width: '100%', maxWidth: 420, borderRadius: 16, boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <Title level={3} style={{ color: tokens.primary, marginBottom: 4, fontSize: 'clamp(20px, 5vw, 24px)' }}>
            Omark Customer Portal
          </Title>
          <Text type="secondary" style={{ fontSize: 13 }}>Track your property, payments and statements</Text>
        </div>

        {error && <Alert type="error" message={error} showIcon style={{ marginBottom: 16 }} />}

        {step === 'phone' && (
          <Form layout="vertical" onFinish={handlePhoneSubmit}>
            <Form.Item
              name="phoneNumber"
              label="Phone Number"
              rules={[{ required: true, message: 'Please enter your account phone number' }]}
            >
              <PhoneInput placeholder="+233 XX XXX XXXX" />
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType="submit" block loading={requestOtpMutation.isPending} style={{ backgroundColor: tokens.primary, height: 44, borderRadius: 8, fontSize: 15, fontWeight: 600 }}>
                Continue
              </Button>
            </Form.Item>
          </Form>
        )}

        {step === 'otp' && (
          <Form layout="vertical" onFinish={handleOtpVerify}>
            <Alert
              type="info"
              showIcon
              icon={<SafetyCertificateOutlined />}
              message="Verification Code Sent"
              description={`Enter the OTP code sent to ${phoneNumber}`}
              style={{ marginBottom: 16 }}
            />
            <Form.Item name="code" label="OTP Code" rules={[{ required: true, message: 'Please enter the 6-digit code' }]}>
              <Input placeholder="123456" maxLength={6} style={{ textAlign: 'center', fontSize: 20, letterSpacing: 6, height: 44 }} />
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType="submit" loading={verifyOtpMutation.isPending} block style={{ backgroundColor: tokens.primary, height: 44, borderRadius: 8, fontSize: 15, fontWeight: 600 }}>
                Verify & Enter Portal
              </Button>
            </Form.Item>
            <Button type="link" block onClick={reset}>Use a different phone number</Button>
          </Form>
        )}

        {step === 'password' && (
          <Form layout="vertical" onFinish={handleLogin}>
            <Form.Item name="password" label="Account Password" rules={[{ required: true, message: 'Please enter your password' }]}>
              <Input.Password prefix={<LockOutlined />} placeholder="Enter your password" style={{ height: 44 }} />
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType="submit" loading={loginMutation.isPending || activateMutation.isPending} block style={{ backgroundColor: tokens.primary, height: 44, borderRadius: 8, fontSize: 15, fontWeight: 600 }}>
                Sign In / Activate Account
              </Button>
            </Form.Item>
            <Button type="link" block onClick={reset}>Use a different phone number</Button>
          </Form>
        )}
      </Card>
    </div>
  );
};
