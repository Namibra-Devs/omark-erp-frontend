// src/pages/public/BookingPage.tsx
import React from 'react';
import { Typography, Card, Form, Input, DatePicker, Button, message } from 'antd';
import { PhoneInput } from '@/components/shared/PhoneInput';

const { Title, Text } = Typography;

export const BookingPage: React.FC = () => {
  const [form] = Form.useForm();

  const handleSubmit = async (values: any) => {
    try {
      // API call would go here
      console.log('Booking submission:', values);
      message.success('Appointment booked successfully!');
      form.resetFields();
    } catch (error) {
      message.error('Failed to book appointment. Please try again.');
    }
  };

  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      minHeight: '100vh',
      background: '#f0f2f5',
      padding: '20px'
    }}>
      <Card style={{ maxWidth: 600, width: '100%' }}>
        <Title level={2} style={{ textAlign: 'center' }}>Book an Appointment</Title>
        <Text type="secondary" style={{ display: 'block', textAlign: 'center', marginBottom: 24 }}>
          Please fill out the form below and we'll contact you to confirm your appointment
        </Text>
        
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Form.Item
            name="fullName"
            label="Full Name"
            rules={[{ required: true, message: 'Please enter your full name' }]}
          >
            <Input size="large" />
          </Form.Item>
          
          <Form.Item
            name="phoneNumber"
            label="Phone Number"
            rules={[{ required: true, message: 'Please enter your phone number' }]}
          >
            <PhoneInput />
          </Form.Item>
          
          <Form.Item
            name="email"
            label="Email (Optional)"
          >
            <Input type="email" size="large" />
          </Form.Item>
          
          <Form.Item
            name="preferredDate"
            label="Preferred Date & Time"
            rules={[{ required: true, message: 'Please select a preferred date and time' }]}
          >
            <DatePicker showTime format="YYYY-MM-DD HH:mm" style={{ width: '100%' }} size="large" />
          </Form.Item>
          
          <Form.Item
            name="message"
            label="Message / Reason for Appointment"
          >
            <Input.TextArea rows={4} />
          </Form.Item>
          
          <Form.Item>
            <Button type="primary" htmlType="submit" size="large" block>
              Book Appointment
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};