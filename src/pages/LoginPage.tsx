// src/pages/LoginPage.tsx
import React, { useState, useEffect } from 'react';
import { Form, Input, Button, Card, Alert, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { tokens } from '@/constants/tokens';

const { Title, Text } = Typography;


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
        accounts: '/accounts/dashboard',
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

      </Card>
    </div>
  );
};