// src/pages/public/BookingPage.tsx
import React, { useState } from 'react';
import { Typography, Card, Form, Input, DatePicker, Button, message, Alert, Spin, Space } from 'antd';
import { CheckCircleOutlined, ClockCircleOutlined, PhoneOutlined, MailOutlined } from '@ant-design/icons';
import { PhoneInput } from '@/components/shared/PhoneInput';
import { usePublicBookAppointmentMutation } from '@/api/appointments';
import dayjs from 'dayjs';

const { Title, Text, Paragraph } = Typography;

export const BookingPage: React.FC = () => {
  const [form] = Form.useForm();
  const [bookingComplete, setBookingComplete] = useState(false);
  const [bookingData, setBookingData] = useState<any>(null);
  
  const bookAppointment = usePublicBookAppointmentMutation();

  const handleSubmit = async (values: any) => {
    try {
      // The API only accepts a single free-text `reason` field — fold the
      // property-interest and message fields into it since both are useful
      // context for the customer service team, but neither is a real,
      // separately-stored field on the backend.
      const reasonParts = [
        values.propertyInterest ? `Property interest: ${values.propertyInterest}` : null,
        values.message || null,
      ].filter(Boolean);

      const payload = {
        fullName: values.fullName,
        phoneNumber: values.phoneNumber,
        email: values.email || undefined,
        scheduledFor: values.preferredDate.toISOString(),
        reason: reasonParts.length > 0 ? reasonParts.join('\n\n') : undefined,
      };

      const result = await bookAppointment.mutateAsync(payload);

      // Store booking data for success screen
      setBookingData({
        ...result,
        fullName: values.fullName,
        phoneNumber: values.phoneNumber,
        email: values.email,
        preferredDate: values.preferredDate,
      });

      setBookingComplete(true);
      message.success('Appointment booked successfully!');
    } catch (error: any) {
      message.error(error?.message || 'Failed to book appointment. Please try again.');
    }
  };

  // Reset booking
  const handleBookAnother = () => {
    setBookingComplete(false);
    setBookingData(null);
    form.resetFields();
  };

  // If booking is complete, show success screen
  if (bookingComplete) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: '20px'
      }}>
        <Card style={{ maxWidth: 500, width: '100%', textAlign: 'center' }}>
          <div style={{ marginBottom: 24 }}>
            <CheckCircleOutlined style={{ fontSize: 64, color: '#52c41a' }} />
          </div>
          
          <Title level={2} style={{ color: '#52c41a', marginBottom: 8 }}>
            Appointment Confirmed!
          </Title>
          
          <Paragraph type="secondary" style={{ fontSize: 16, marginBottom: 24 }}>
            We've received your appointment request. Our team will contact you shortly to confirm the details.
          </Paragraph>

          <div style={{ 
            background: '#f5f7fa', 
            padding: 16, 
            borderRadius: 8, 
            textAlign: 'left',
            marginBottom: 24
          }}>
            <Space direction="vertical" size="small" style={{ width: '100%' }}>
              <div>
                <Text strong>Booking Reference:</Text>
                <Text code style={{ marginLeft: 8 }}>
                  {bookingData?.confirmationCode || bookingData?.id || 'N/A'}
                </Text>
              </div>
              <div>
                <Text strong>Name:</Text>
                <Text style={{ marginLeft: 8 }}>{bookingData?.fullName}</Text>
              </div>
              <div>
                <Text strong>Phone:</Text>
                <Text style={{ marginLeft: 8 }}>{bookingData?.phoneNumber}</Text>
              </div>
              {bookingData?.email && (
                <div>
                  <Text strong>Email:</Text>
                  <Text style={{ marginLeft: 8 }}>{bookingData?.email}</Text>
                </div>
              )}
              <div>
                <Text strong>Preferred Date:</Text>
                <Text style={{ marginLeft: 8 }}>
                  {bookingData?.preferredDate 
                    ? dayjs(bookingData.preferredDate).format('MMMM DD, YYYY HH:mm')
                    : 'N/A'}
                </Text>
              </div>
            </Space>
          </div>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
            <Button 
              type="primary" 
              size="large"
              onClick={handleBookAnother}
            >
              Book Another Appointment
            </Button>
            <Button 
              size="large"
              onClick={() => window.location.href = '/'}
            >
              Back to Home
            </Button>
          </div>

          <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid #f0f0f0' }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              <ClockCircleOutlined /> You will receive a confirmation call within 24 hours
            </Text>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '20px'
    }}>
      <Card style={{ maxWidth: 600, width: '100%', boxShadow: '0 8px 32px rgba(0,0,0,0.1)' }}>
        <Title level={2} style={{ textAlign: 'center' }}>
          <PhoneOutlined style={{ marginRight: 8, color: '#667eea' }} />
          Book an Appointment
        </Title>
        
        <Text type="secondary" style={{ display: 'block', textAlign: 'center', marginBottom: 24 }}>
          Please fill out the form below and we'll contact you to confirm your appointment
        </Text>

        <Alert
          message="Free Consultation"
          description="Book a free consultation with our property experts. We'll help you find the perfect property."
          type="info"
          showIcon
          style={{ marginBottom: 24 }}
        />
        
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          size="large"
        >
          <Form.Item
            name="fullName"
            label="Full Name"
            rules={[
              { required: true, message: 'Please enter your full name' },
              { min: 2, message: 'Name must be at least 2 characters' }
            ]}
          >
            <Input 
              placeholder="Enter your full name" 
              prefix={<UserOutlined style={{ color: '#bfbfbf' }} />}
            />
          </Form.Item>
          
          <Form.Item
            name="phoneNumber"
            label="Phone Number"
            rules={[
              { required: true, message: 'Please enter your phone number' },
              { pattern: /^[+]?[(]?[0-9]{3}[)]?[-\s.]?[0-9]{3}[-\s.]?[0-9]{4,6}$/, message: 'Please enter a valid phone number' }
            ]}
            extra="We'll call you to confirm your appointment"
          >
            <PhoneInput />
          </Form.Item>
          
          <Form.Item
            name="email"
            label="Email Address (Optional)"
            rules={[
              { type: 'email', message: 'Please enter a valid email address' }
            ]}
          >
            <Input 
              type="email" 
              placeholder="Enter your email address"
              prefix={<MailOutlined style={{ color: '#bfbfbf' }} />}
            />
          </Form.Item>
          
          <Form.Item
            name="preferredDate"
            label="Preferred Date & Time"
            rules={[
              { required: true, message: 'Please select a preferred date and time' },
              { 
                validator: (_, value) => {
                  if (value && value.isBefore(dayjs())) {
                    return Promise.reject('Please select a future date and time');
                  }
                  return Promise.resolve();
                }
              }
            ]}
            extra="Please select a date at least 24 hours in advance"
          >
            <DatePicker 
              showTime 
              format="YYYY-MM-DD HH:mm" 
              style={{ width: '100%' }}
              placeholder="Select date and time"
              disabledDate={(current) => {
                // Disable past dates
                return current && current < dayjs().startOf('day');
              }}
            />
          </Form.Item>

          <Form.Item
            name="propertyInterest"
            label="Property Interest (Optional)"
          >
            <Input 
              placeholder="e.g., 3-bedroom house in Accra"
              prefix={<HomeOutlined style={{ color: '#bfbfbf' }} />}
            />
          </Form.Item>
          
          <Form.Item
            name="message"
            label="Message / Reason for Appointment (Optional)"
          >
            <Input.TextArea 
              rows={4} 
              placeholder="Tell us what you're looking for or any specific questions..."
              maxLength={500}
              showCount
            />
          </Form.Item>

          <div style={{ 
            background: '#f5f7fa', 
            padding: 12, 
            borderRadius: 8, 
            marginBottom: 16,
            border: '1px solid #e8e8e8'
          }}>
            <Space direction="vertical" size={4}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                <CheckCircleOutlined style={{ color: '#52c41a' }} /> Free consultation
              </Text>
              <Text type="secondary" style={{ fontSize: 12 }}>
                <CheckCircleOutlined style={{ color: '#52c41a' }} /> No obligations
              </Text>
              <Text type="secondary" style={{ fontSize: 12 }}>
                <CheckCircleOutlined style={{ color: '#52c41a' }} /> Professional property advice
              </Text>
            </Space>
          </div>
          
          <Form.Item>
            <Button 
              type="primary" 
              htmlType="submit" 
              size="large" 
              block
              loading={bookAppointment.isPending}
              icon={<PhoneOutlined />}
            >
              {bookAppointment.isPending ? 'Booking...' : 'Book Appointment'}
            </Button>
          </Form.Item>

          <div style={{ textAlign: 'center' }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              By booking, you agree to our terms and conditions. We respect your privacy.
            </Text>
          </div>
        </Form>
      </Card>
    </div>
  );
};

// Add missing imports
import { UserOutlined, HomeOutlined } from '@ant-design/icons';