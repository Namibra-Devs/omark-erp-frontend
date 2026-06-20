// src/pages/marketing/ProspectDetailPage.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, Row, Col, Typography, Tag, Button, Space, Timeline, Modal, Form, Input, Select, DatePicker, message, Descriptions, Badge, Spin, Empty } from 'antd';
import { 
  ArrowLeftOutlined, 
  PhoneOutlined, 
  MailOutlined, 
  HomeOutlined,
  ClockCircleOutlined,
  PlusOutlined,
  EditOutlined,
  WhatsAppOutlined,
  UserOutlined
} from '@ant-design/icons';
import { useAuth } from '@/contexts/AuthContext';
import { StatusTag } from '@/components/shared/StatusTag';
import { PhoneInput } from '@/components/shared/PhoneInput';
import { PageHeader } from '@/components/shared/PageHeader';
import { prospectStatusLabels, interactionChannelLabels } from '@/constants/enums';
import type { Prospect, ProspectStatus, Interaction } from '@/types';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;
const { Option } = Select;

// Complete mock data for all prospects
const allMockProspects: Record<string, Prospect> = {
  '1': {
    id: '1',
    firstName: 'John',
    lastName: 'Doe',
    address: '123 Main St, Accra, Ghana',
    phoneNumber: '+233241234567',
    source: 'marketing',
    assignedUserId: '2',
    status: 'meeting_scheduled',
    reasonForContact: 'Interested in buying a 3-bedroom property in Accra',
    notes: 'Follow up next week. He is looking for a 3-bedroom house in the Accra area. Budget around GHS 500,000 - 600,000.',
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-01-16T14:30:00Z',
  },
  '2': {
    id: '2',
    firstName: 'Sarah',
    lastName: 'Smith',
    address: '456 Independence Ave, Kumasi, Ghana',
    phoneNumber: '+233241234568',
    source: 'marketing',
    assignedUserId: '2',
    status: 'meeting_completed',
    reasonForContact: 'Wants to view luxury properties in Kumasi',
    notes: 'Meeting completed. She is interested in a 4-bedroom house with a pool.',
    createdAt: '2024-01-14T09:30:00Z',
    updatedAt: '2024-01-15T16:20:00Z',
  },
  '3': {
    id: '3',
    firstName: 'Michael',
    lastName: 'Johnson',
    address: '789 Liberation Rd, Tema, Ghana',
    phoneNumber: '+233241234569',
    source: 'marketing',
    assignedUserId: '2',
    status: 'new',
    reasonForContact: 'Ready to purchase a property in Tema',
    notes: 'Interested in property #102. Has pre-approval for mortgage.',
    createdAt: '2024-01-13T14:20:00Z',
    updatedAt: '2024-01-13T14:20:00Z',
  },
  '4': {
    id: '4',
    firstName: 'Emma',
    lastName: 'Williams',
    address: '321 Castle Rd, Cape Coast, Ghana',
    phoneNumber: '+233241234570',
    source: 'marketing',
    assignedUserId: '2',
    status: 'suspended',
    reasonForContact: 'Was interested in beachfront properties',
    notes: 'Try reaching out again next month. She had family emergency.',
    createdAt: '2024-01-12T11:15:00Z',
    updatedAt: '2024-01-12T11:15:00Z',
  },
  '5': {
    id: '5',
    firstName: 'James',
    lastName: 'Brown',
    address: '654 Ocean Dr, Takoradi, Ghana',
    phoneNumber: '+233241234571',
    source: 'marketing',
    assignedUserId: '2',
    status: 'postponed',
    reasonForContact: 'Wants to see more options in Takoradi',
    notes: 'Postponed to next month due to work travel.',
    createdAt: '2024-01-11T16:45:00Z',
    updatedAt: '2024-01-11T16:45:00Z',
  },
  '6': {
    id: '6',
    firstName: 'Lisa',
    lastName: 'Taylor',
    address: '987 Park Ave, Accra, Ghana',
    phoneNumber: '+233241234572',
    source: 'marketing',
    assignedUserId: '2',
    status: 'canceled',
    reasonForContact: 'Found another property elsewhere',
    notes: 'Canceled due to alternative purchase in another area.',
    createdAt: '2024-01-10T13:00:00Z',
    updatedAt: '2024-01-10T13:00:00Z',
  },
  '7': {
    id: '7',
    firstName: 'David',
    lastName: 'Wilson',
    address: '147 Green St, Kumasi, Ghana',
    phoneNumber: '+233241234573',
    source: 'marketing',
    assignedUserId: '2',
    status: 'purchased',
    reasonForContact: 'Bought a property in Kumasi',
    notes: 'Successfully converted to customer. Purchased a 3-bedroom house.',
    createdAt: '2024-01-09T08:30:00Z',
    updatedAt: '2024-01-09T08:30:00Z',
  },
};

// Mock interactions for each prospect
const allMockInteractions: Record<string, Interaction[]> = {
  '1': [
    {
      id: '1-1',
      prospectId: '1',
      channel: 'call',
      occurredAt: '2024-01-16T14:30:00Z',
      response: 'Had a great conversation. He is very interested and wants to view properties next week. Specifically interested in properties in East Legon.',
      loggedByUserId: '2',
      createdAt: '2024-01-16T14:30:00Z',
    },
    {
      id: '1-2',
      prospectId: '1',
      channel: 'whatsapp',
      occurredAt: '2024-01-15T09:00:00Z',
      response: 'Sent property listings via WhatsApp. He replied saying he likes two of them and wants to schedule viewings.',
      loggedByUserId: '2',
      createdAt: '2024-01-15T09:00:00Z',
    },
    {
      id: '1-3',
      prospectId: '1',
      channel: 'email',
      occurredAt: '2024-01-14T11:15:00Z',
      response: 'Sent initial property brochure and pricing information via email. He acknowledged receipt and said he would review.',
      loggedByUserId: '2',
      createdAt: '2024-01-14T11:15:00Z',
    },
  ],
  '2': [
    {
      id: '2-1',
      prospectId: '2',
      channel: 'call',
      occurredAt: '2024-01-15T16:20:00Z',
      response: 'Meeting completed successfully. She is very interested in the luxury properties we showed her.',
      loggedByUserId: '2',
      createdAt: '2024-01-15T16:20:00Z',
    },
    {
      id: '2-2',
      prospectId: '2',
      channel: 'whatsapp',
      occurredAt: '2024-01-14T10:00:00Z',
      response: 'Sent photos of available luxury properties. She responded positively.',
      loggedByUserId: '2',
      createdAt: '2024-01-14T10:00:00Z',
    },
  ],
  '3': [
    {
      id: '3-1',
      prospectId: '3',
      channel: 'call',
      occurredAt: '2024-01-13T14:20:00Z',
      response: 'Initial contact. He is ready to purchase and has pre-approval for mortgage.',
      loggedByUserId: '2',
      createdAt: '2024-01-13T14:20:00Z',
    },
  ],
  '4': [
    {
      id: '4-1',
      prospectId: '4',
      channel: 'call',
      occurredAt: '2024-01-12T11:15:00Z',
      response: 'Spoke with her briefly. She had a family emergency and asked to pause the process.',
      loggedByUserId: '2',
      createdAt: '2024-01-12T11:15:00Z',
    },
  ],
  '5': [
    {
      id: '5-1',
      prospectId: '5',
      channel: 'email',
      occurredAt: '2024-01-11T16:45:00Z',
      response: 'Sent options for properties in Takoradi. He said he will review when back from travel.',
      loggedByUserId: '2',
      createdAt: '2024-01-11T16:45:00Z',
    },
  ],
  '6': [
    {
      id: '6-1',
      prospectId: '6',
      channel: 'call',
      occurredAt: '2024-01-10T13:00:00Z',
      response: 'She informed us she found another property and is canceling the process.',
      loggedByUserId: '2',
      createdAt: '2024-01-10T13:00:00Z',
    },
  ],
  '7': [
    {
      id: '7-1',
      prospectId: '7',
      channel: 'call',
      occurredAt: '2024-01-09T08:30:00Z',
      response: 'Successfully converted to customer! He purchased a 3-bedroom house in Kumasi.',
      loggedByUserId: '2',
      createdAt: '2024-01-09T08:30:00Z',
    },
  ],
};

export const ProspectDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [prospect, setProspect] = useState<Prospect | null>(null);
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [logModal, setLogModal] = useState(false);
  const [statusModal, setStatusModal] = useState(false);
  const [form] = Form.useForm();
  const [statusForm] = Form.useForm();

  useEffect(() => {
    // Simulate API call to fetch prospect by ID
    setLoading(true);
    setTimeout(() => {
      const foundProspect = allMockProspects[id || ''];
      if (foundProspect) {
        setProspect(foundProspect);
        setInteractions(allMockInteractions[id || ''] || []);
      } else {
        setProspect(null);
        setInteractions([]);
      }
      setLoading(false);
    }, 500);
  }, [id]);

  const handleLogInteraction = (values: any) => {
    if (!prospect) return;
    
    const newInteraction: Interaction = {
      id: `${prospect.id}-${Date.now()}`,
      prospectId: prospect.id,
      channel: values.channel,
      occurredAt: values.occurredAt.toISOString(),
      response: values.response,
      loggedByUserId: user?.id || '2',
      createdAt: new Date().toISOString(),
    };
    setInteractions([newInteraction, ...interactions]);
    setLogModal(false);
    form.resetFields();
    message.success('Interaction logged successfully!');
  };

  const handleStatusUpdate = (values: { status: ProspectStatus }) => {
    if (!prospect) return;
    
    setProspect({ ...prospect, status: values.status, updatedAt: new Date().toISOString() });
    setStatusModal(false);
    statusForm.resetFields();
    message.success(`Status updated to ${prospectStatusLabels[values.status]}`);
  };

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case 'call': return <PhoneOutlined />;
      case 'email': return <MailOutlined />;
      case 'whatsapp': return <WhatsAppOutlined />;
      case 'sms': return <span>💬</span>;
      case 'in_person': return <UserOutlined />;
      default: return <UserOutlined />;
    }
  };

  const getChannelColor = (channel: string) => {
    switch (channel) {
      case 'call': return '#1890ff';
      case 'email': return '#faad14';
      case 'whatsapp': return '#25D366';
      case 'sms': return '#722ed1';
      case 'in_person': return '#52c41a';
      default: return '#d9d9d9';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new': return 'processing';
      case 'meeting_scheduled': return 'warning';
      case 'meeting_completed': return 'success';
      case 'suspended': return 'error';
      case 'postponed': return 'warning';
      case 'canceled': return 'error';
      case 'purchased': return 'success';
      default: return 'default';
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <Spin size="large" tip="Loading prospect details..." />
      </div>
    );
  }

  if (!prospect) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Empty 
          description="Prospect not found"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
        <Button 
          type="primary" 
          onClick={() => navigate('/marketing/prospects')}
          style={{ marginTop: 16 }}
        >
          Back to Prospects
        </Button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '100%', overflow: 'hidden', padding: '0 4px' }}>
      <PageHeader
        title={`${prospect.firstName} ${prospect.lastName}`}
        actions={[
          {
            label: 'Back',
            onClick: () => navigate('/marketing/prospects'),
            icon: <ArrowLeftOutlined />,
          },
          {
            label: 'Log Interaction',
            onClick: () => setLogModal(true),
            icon: <PlusOutlined />,
          },
          {
            label: 'Update Status',
            onClick: () => setStatusModal(true),
            icon: <EditOutlined />,
          },
        ]}
      />

      <Row gutter={[16, 16]}>
        {/* Left Column - Prospect Info */}
        <Col xs={24} lg={12}>
          <Card 
            title="Prospect Information" 
            style={{ marginBottom: 16, height: '100%' }}
            bodyStyle={{ padding: '16px' }}
          >
            <Descriptions column={1} bordered size="small" style={{ maxWidth: '100%' }}>
              <Descriptions.Item label="Full Name">
                <Text strong>{prospect.firstName} {prospect.lastName}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Phone">
                <a href={`tel:${prospect.phoneNumber}`}>
                  <PhoneOutlined /> {prospect.phoneNumber}
                </a>
              </Descriptions.Item>
              <Descriptions.Item label="Address">
                <HomeOutlined /> {prospect.address}
              </Descriptions.Item>
              <Descriptions.Item label="Status">
                <Badge status={getStatusColor(prospect.status)} />
                <StatusTag status={prospect.status} type="prospect" />
              </Descriptions.Item>
              <Descriptions.Item label="Source">
                <Tag color="blue">{prospect.source.toUpperCase()}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Reason for Contact">
                <Paragraph ellipsis={{ rows: 2, expandable: true, symbol: 'more' }}>
                  {prospect.reasonForContact}
                </Paragraph>
              </Descriptions.Item>
              <Descriptions.Item label="Notes">
                <Paragraph ellipsis={{ rows: 3, expandable: true, symbol: 'more' }}>
                  {prospect.notes || 'No additional notes'}
                </Paragraph>
              </Descriptions.Item>
              <Descriptions.Item label="Created">
                {dayjs(prospect.createdAt).format('MMM DD, YYYY')}
              </Descriptions.Item>
              <Descriptions.Item label="Last Updated">
                {dayjs(prospect.updatedAt).format('MMM DD, YYYY')}
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>

        {/* Right Column - Interactions */}
        <Col xs={24} lg={12}>
          <Card 
            title="Interactions Timeline" 
            extra={
              <Button type="primary" size="small" onClick={() => setLogModal(true)}>
                <PlusOutlined /> Log
              </Button>
            }
            style={{ marginBottom: 16, height: '100%' }}
            bodyStyle={{ padding: '16px', maxHeight: '500px', overflowY: 'auto' }}
          >
            {interactions.length > 0 ? (
              <Timeline>
                {interactions.map((interaction) => (
                  <Timeline.Item
                    key={interaction.id}
                    dot={<span style={{ color: getChannelColor(interaction.channel) }}>{getChannelIcon(interaction.channel)}</span>}
                    color="blue"
                  >
                    <div style={{ marginBottom: 8, wordBreak: 'break-word' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 4 }}>
                        <Text strong>
                          {interactionChannelLabels[interaction.channel as keyof typeof interactionChannelLabels]}
                        </Text>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          <ClockCircleOutlined /> {dayjs(interaction.occurredAt).fromNow()}
                        </Text>
                      </div>
                      <Paragraph style={{ margin: '8px 0', wordBreak: 'break-word' }}>
                        {interaction.response}
                      </Paragraph>
                      <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>
                        Logged by: User #{interaction.loggedByUserId}
                      </Text>
                    </div>
                  </Timeline.Item>
                ))}
              </Timeline>
            ) : (
              <div style={{ textAlign: 'center', padding: '20px' }}>
                <Text type="secondary">No interactions logged yet</Text>
              </div>
            )}
          </Card>
        </Col>
      </Row>

      {/* Log Interaction Modal */}
      <Modal
        title="Log Interaction"
        open={logModal}
        onCancel={() => {
          setLogModal(false);
          form.resetFields();
        }}
        footer={null}
        width={520}
        style={{ maxWidth: '95%', top: 20 }}
        bodyStyle={{ padding: '16px' }}
      >
        <Form form={form} layout="vertical" onFinish={handleLogInteraction}>
          <Form.Item
            name="channel"
            label="Channel"
            rules={[{ required: true, message: 'Please select a channel' }]}
          >
            <Select placeholder="Select channel" style={{ width: '100%' }}>
              <Option value="call">📞 Call</Option>
              <Option value="whatsapp">💬 WhatsApp</Option>
              <Option value="email">📧 Email</Option>
              <Option value="sms">📱 SMS</Option>
              <Option value="in_person">👤 In Person</Option>
              <Option value="social_media">🌐 Social Media</Option>
              <Option value="other">📝 Other</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="occurredAt"
            label="Date & Time"
            rules={[{ required: true, message: 'Please select date and time' }]}
          >
            <DatePicker showTime format="YYYY-MM-DD HH:mm" style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            name="response"
            label="Response / Notes"
            rules={[{ required: true, message: 'Please enter response' }]}
          >
            <TextArea rows={4} placeholder="Enter interaction details..." />
          </Form.Item>

          <Form.Item>
            <Space wrap>
              <Button type="primary" htmlType="submit">Log Interaction</Button>
              <Button onClick={() => {
                setLogModal(false);
                form.resetFields();
              }}>Cancel</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Update Status Modal */}
      <Modal
        title="Update Status"
        open={statusModal}
        onCancel={() => {
          setStatusModal(false);
          statusForm.resetFields();
        }}
        footer={null}
        width={400}
        style={{ maxWidth: '95%', top: 20 }}
        bodyStyle={{ padding: '16px' }}
      >
        <Form form={statusForm} layout="vertical" onFinish={handleStatusUpdate}>
          <Form.Item
            name="status"
            label="New Status"
            rules={[{ required: true, message: 'Please select a status' }]}
          >
            <Select placeholder="Select new status" style={{ width: '100%' }}>
              <Option value="new">New</Option>
              <Option value="meeting_scheduled">Meeting Scheduled</Option>
              <Option value="meeting_completed">Meeting Completed</Option>
              <Option value="suspended">Suspended</Option>
              <Option value="postponed">Postponed</Option>
              <Option value="canceled">Canceled</Option>
            </Select>
          </Form.Item>

          <Form.Item>
            <Space wrap>
              <Button type="primary" htmlType="submit">Update Status</Button>
              <Button onClick={() => {
                setStatusModal(false);
                statusForm.resetFields();
              }}>Cancel</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};