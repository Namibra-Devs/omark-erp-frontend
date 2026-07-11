// src/pages/LoginPage.tsx
import React, { useState, useEffect } from 'react';
import { Form, Input, Button, Card, Alert, Typography, Divider, Space, Tag, message } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { tokens } from '@/constants/tokens';
import { roleLabels } from '@/constants/enums';

const { Title, Text } = Typography;

// ── Demo accounts with role information ────────────────────────────────────
const DEMO_ACCOUNTS = [
  { 
    email: 'admin@omark.com', 
    password: 'Admin@1234',
    role: 'admin', 
    label: 'Administrator',
    color: 'red'
  },
  { 
    email: 'director@omark.com', 
    password: 'Director@1234',
    role: 'marketing_director', 
    label: 'Marketing Director',
    color: 'purple'
  },
  { 
    email: 'marketing@omark.com', 
    password: 'Marketing@1234',
    role: 'marketing_staff', 
    label: 'Marketing Staff',
    color: 'blue'
  },
  { 
    email: 'cs@omark.com', 
    password: 'CS@1234',
    role: 'customer_service', 
    label: 'Customer Service',
    color: 'green'
  },
  { 
    email: 'secretary@omark.com', 
    password: 'Secretary@1234',
    role: 'secretary', 
    label: 'Secretary',
    color: 'orange'
  },
  { 
    email: 'accounts@omark.com', 
    password: 'Accounts@1234',
    role: 'accounts', 
    label: 'Accounts',
    color: 'cyan'
  },
];

export const LoginPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [form] = Form.useForm();
  const { login, user } = useAuth();
  const navigate = useNavigate();
  
  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      const defaultRoutes: Record<string, string> = {
        admin: '/admin/dashboard',
        marketing_staff: '/marketing/prospects',
        marketing_director: '/marketing/overview',
        customer_service: '/cs/prospects',
        secretary: '/dashboard',
        accounts: '/dashboard',
      };
      navigate(defaultRoutes[user.role] || '/');
    }
  }, [user, navigate]);
  
  const onFinish = async (values: { email: string; password: string }) => {
    setLoading(true);
    setError(undefined);
    try {
      await login(values.email, values.password);
    } catch (err: any) {
      console.error('Login error:', err);
      const errorMessage = err?.response?.data?.message || err?.message || 'Login failed. Please try again.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // ── Quick login handler ──────────────────────────────────────────────────
  const handleQuickLogin = (account: typeof DEMO_ACCOUNTS[0]) => {
    // Set form values directly
    form.setFieldsValue({
      email: account.email,
      password: account.password,
    });
    
    // Auto-submit the form
    form.submit();
    
    message.info(`Logging in as ${account.label}...`);
  };

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
     
      padding: '20px',
    }}>
      <Card 
        style={{ 
          width: 450, 
          maxWidth: '100%',
          boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
          borderRadius: 16,
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <Title level={2} style={{ color: tokens.primary, marginBottom: 8 }}>
            Omark Real Estate
          </Title>
          <Text type="secondary">Enterprise Resource Planning</Text>
        </div>
        
        {error && (
          <Alert
            message={error}
            type="error"
            showIcon
            closable
            onClose={() => setError(undefined)}
            style={{ marginBottom: 24 }}
          />
        )}
        
        <Form
          form={form}
          name="login"
          onFinish={onFinish}
          layout="vertical"
          size="large"
        >
          <Form.Item
            name="email"
            label="Email Address"
            rules={[
              { required: true, message: 'Please enter your email' },
              { type: 'email', message: 'Please enter a valid email' },
            ]}
          >
            <Input placeholder="admin@omark.com" />
          </Form.Item>
          
          <Form.Item
            name="password"
            label="Password"
            rules={[{ required: true, message: 'Please enter your password' }]}
          >
            <Input.Password placeholder="Enter your password" />
          </Form.Item>
          
          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              block
              style={{ 
                backgroundColor: tokens.primary, 
                height: 42,
                borderRadius: 8,
                fontWeight: 600,
              }}
            >
              Sign In
            </Button>
          </Form.Item>
        </Form>
        
        <Divider style={{ margin: '16px 0 24px' }}>
          <Text type="secondary" style={{ fontSize: 13 }}>Quick Login - Select Your Role</Text>
        </Divider>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {DEMO_ACCOUNTS.map((account) => (
            <Button
              key={account.email}
              block
              style={{ 
                textAlign: 'left',
                height: 'auto',
                padding: '10px 16px',
                border: '1px solid #e8e8e8',
                borderRadius: 8,
                transition: 'all 0.3s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = account.color;
                e.currentTarget.style.background = '#fafafa';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#e8e8e8';
                e.currentTarget.style.background = 'transparent';
              }}
              onClick={() => handleQuickLogin(account)}
            >
              <Space direction="vertical" size={2} style={{ width: '100%' }}>
                <Space>
                  <Tag color={account.color} style={{ fontWeight: 600 }}>
                    {account.label}
                  </Tag>
                  <Text strong>{account.email}</Text>
                </Space>
                <Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>
                  Role: {roleLabels[account.role as keyof typeof roleLabels] || account.role}
                </Text>
              </Space>
            </Button>
          ))}
        </div>

        <div style={{ marginTop: 24, textAlign: 'center' }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Default password for all demo accounts: <Text code>password</Text>
          </Text>
        </div>
      </Card>
    </div>
  );
};