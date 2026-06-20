// src/pages/LoginPage.tsx
import React, { useState, useEffect } from 'react';
import { Form, Input, Button, Card, Alert, Typography, Divider, Space, Tag } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { tokens } from '@/constants/tokens';
import { roleLabels } from '@/constants/enums';

const { Title, Text } = Typography;

export const LoginPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
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
      setError(err.error?.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Demo accounts with role information
  const demoAccounts = [
    { 
      email: 'admin@omark.com', 
      role: 'admin', 
      label: 'Administrator',
      color: 'red'
    },
    { 
      email: 'director@omark.com', 
      role: 'marketing_director', 
      label: 'Marketing Director',
      color: 'purple'
    },
    { 
      email: 'marketing@omark.com', 
      role: 'marketing_staff', 
      label: 'Marketing Staff',
      color: 'blue'
    },
    { 
      email: 'cs@omark.com', 
      role: 'customer_service', 
      label: 'Customer Service',
      color: 'green'
    },
    { 
      email: 'secretary@omark.com', 
      role: 'secretary', 
      label: 'Secretary',
      color: 'orange'
    },
    { 
      email: 'accounts@omark.com', 
      role: 'accounts', 
      label: 'Accounts',
      color: 'cyan'
    },
  ];
  
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      background: '#f0f2f5',
    }}>
      <Card style={{ width: 450, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <Title level={2} style={{ color: tokens.primary, marginBottom: 8 }}>
            Omark Real Estate
          </Title>
          <Text type="secondary">Enterprise Resource Planning</Text>
        </div>
        
        {/* Demo Mode Alert */}
        <Alert
          message="Demo Mode"
          description="Use any demo account below. Password can be anything."
          type="info"
          showIcon
          style={{ marginBottom: 24 }}
        />
        
        {error && (
          <Alert
            message={error}
            type="error"
            showIcon
            style={{ marginBottom: 24 }}
          />
        )}
        
        <Form
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
            <Input.Password placeholder="Enter any password" />
          </Form.Item>
          
          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              block
              style={{ backgroundColor: tokens.primary, height: 42 }}
            >
              Sign In
            </Button>
          </Form.Item>
        </Form>
        
        <Divider>Quick Login - Select Your Role</Divider>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {demoAccounts.map((account) => (
            <Button
              key={account.email}
              block
              style={{ 
                textAlign: 'left',
                height: 'auto',
                padding: '10px 16px',
                border: '1px solid #d9d9d9'
              }}
              onClick={() => {
                // Fill the form with demo credentials
                const form = document.querySelector('form');
                if (form) {
                  const emailInput = form.querySelector('input[name="email"]') as HTMLInputElement;
                  const passwordInput = form.querySelector('input[name="password"]') as HTMLInputElement;
                  if (emailInput) {
                    emailInput.value = account.email;
                    // Trigger React's change event
                    const event = new Event('input', { bubbles: true });
                    emailInput.dispatchEvent(event);
                  }
                  if (passwordInput) {
                    passwordInput.value = 'password123';
                    const event = new Event('input', { bubbles: true });
                    passwordInput.dispatchEvent(event);
                  }
                }
              }}
            >
              <Space direction="vertical" size={0} style={{ width: '100%' }}>
                <Space>
                  <Tag color={account.color}>{account.label}</Tag>
                  <Text strong>{account.email}</Text>
                </Space>
                <Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>
                  Role: {roleLabels[account.role as keyof typeof roleLabels]}
                </Text>
              </Space>
            </Button>
          ))}
        </div>
      </Card>
    </div>
  );
};