// src/pages/marketing/ProspectDetailPage.tsx
import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, Row, Col, Typography, Tag, Button, Space, Timeline, Modal, Form, Input, Select, DatePicker, message, Descriptions, Badge, Spin, Empty, InputNumber, Radio } from 'antd';
import { 
  ArrowLeftOutlined, 
  PhoneOutlined, 
  MailOutlined, 
  HomeOutlined,
  ClockCircleOutlined,
  PlusOutlined,
  EditOutlined,
  WhatsAppOutlined,
  UserOutlined,
  CheckOutlined
} from '@ant-design/icons';
import { useAuth } from '@/contexts/AuthContext';
import { StatusTag } from '@/components/shared/StatusTag';
import { PhoneInput } from '@/components/shared/PhoneInput';
import { PageHeader } from '@/components/shared/PageHeader';
import { prospectStatusLabels, interactionChannelLabels } from '@/constants/enums';
import type { Prospect, ProspectStatus, Interaction } from '@/types';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { 
  useProspect, 
  useInteractions, 
  useLogInteraction, 
  useUpdateProspect, 
  useConvertProspect 
} from '@/api/prospects';
import { useProperties } from '@/api/properties';

dayjs.extend(relativeTime);

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;
const { Option } = Select;

export const ProspectDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  // Modals state
  const [logModal, setLogModal] = useState(false);
  const [statusModal, setStatusModal] = useState(false);
  const [convertModal, setConvertModal] = useState(false);
  const [convertType, setConvertType] = useState<'fully_paid' | 'payment_plan'>('fully_paid');

  const [form] = Form.useForm();
  const [statusForm] = Form.useForm();
  const [convertForm] = Form.useForm();

  // API hooks
  const prospectId = id || '';
  const { data: prospect, isLoading: isProspectLoading } = useProspect(prospectId);
  const { data: interactionsResponse, isLoading: isInteractionsLoading } = useInteractions(prospectId);
  const { data: properties } = useProperties();

  const logInteractionMutation = useLogInteraction(prospectId);
  const updateProspectMutation = useUpdateProspect();
  const convertProspectMutation = useConvertProspect(prospectId);

  const interactions = (interactionsResponse as any)?.data || interactionsResponse || [];

  const handleLogInteraction = async (values: any) => {
    try {
      await logInteractionMutation.mutateAsync({
        channel: values.channel,
        occurredAt: values.occurredAt.toISOString(),
        response: values.response,
        loggedByUserId: user?.id || '2',
      });
      setLogModal(false);
      form.resetFields();
      message.success('Interaction logged successfully!');
    } catch (err: any) {
      console.error('Failed to log interaction:', err);
      message.error(err.error?.message || 'Failed to log interaction.');
    }
  };

  const handleStatusUpdate = async (values: { status: ProspectStatus }) => {
    try {
      await updateProspectMutation.mutateAsync({
        id: prospectId,
        data: { status: values.status },
      });
      setStatusModal(false);
      statusForm.resetFields();
      message.success(`Status updated to ${prospectStatusLabels[values.status]}`);
    } catch (err: any) {
      console.error('Failed to update status:', err);
      message.error(err.error?.message || 'Failed to update status.');
    }
  };

  const handleConvert = async (values: any) => {
    try {
      const convertPayload: any = {
        type: values.type,
        propertyId: values.propertyId,
      };

      if (values.type === 'payment_plan') {
        convertPayload.plan = {
          totalAmountMinor: Math.round((values.totalAmount || 0) * 100),
          downPaymentMinor: Math.round((values.downPayment || 0) * 100),
          numMonths: values.numMonths,
          startDate: values.startDate ? values.startDate.format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD'),
        };
      }

      const newCustomer = await convertProspectMutation.mutateAsync(convertPayload);
      setConvertModal(false);
      convertForm.resetFields();
      message.success('Prospect converted to customer successfully!');
      // Redirect to customer detail page
      if (newCustomer && newCustomer.id) {
        navigate(`/customers/${newCustomer.id}`);
      } else {
        navigate('/customers');
      }
    } catch (err: any) {
      console.error('Conversion failed:', err);
      message.error(err.error?.message || 'Failed to convert prospect to customer.');
    }
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

  if (isProspectLoading) {
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

  const isPurchased = prospect.status === 'purchased';

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
          ...(!isPurchased ? [
            {
              label: 'Convert to Customer',
              onClick: () => setConvertModal(true),
              icon: <CheckOutlined />,
              type: 'primary' as any,
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
          ] : []),
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
              !isPurchased && (
                <Button type="primary" size="small" onClick={() => setLogModal(true)}>
                  <PlusOutlined /> Log
                </Button>
              )
            }
            style={{ marginBottom: 16, height: '100%' }}
            bodyStyle={{ padding: '16px', maxHeight: '500px', overflowY: 'auto' }}
          >
            {isInteractionsLoading ? (
              <div style={{ textAlign: 'center', padding: '20px' }}>
                <Spin size="small" />
              </div>
            ) : interactions.length > 0 ? (
              <Timeline>
                {interactions.map((interaction: Interaction) => (
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
            initialValue={dayjs()}
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
              <Button type="primary" htmlType="submit" loading={logInteractionMutation.isPending}>
                Log Interaction
              </Button>
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
            initialValue={prospect.status}
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
              <Button type="primary" htmlType="submit" loading={updateProspectMutation.isPending}>
                Update Status
              </Button>
              <Button onClick={() => {
                setStatusModal(false);
                statusForm.resetFields();
              }}>Cancel</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Convert to Customer Modal */}
      <Modal
        title="Convert Prospect to Customer"
        open={convertModal}
        onCancel={() => {
          setConvertModal(false);
          convertForm.resetFields();
        }}
        footer={null}
        width={550}
        style={{ maxWidth: '95%', top: 20 }}
        bodyStyle={{ padding: '16px' }}
      >
        <Form 
          form={convertForm} 
          layout="vertical" 
          onFinish={handleConvert}
          initialValues={{ type: 'fully_paid' }}
          onValuesChange={(changed) => {
            if (changed.type) {
              setConvertType(changed.type);
            }
          }}
        >
          <Form.Item
            name="type"
            label="Customer Class"
            rules={[{ required: true }]}
          >
            <Radio.Group optionType="button" buttonStyle="solid">
              <Radio value="fully_paid">Fully Paid</Radio>
              <Radio value="payment_plan">Payment Plan</Radio>
            </Radio.Group>
          </Form.Item>

          <Form.Item
            name="propertyId"
            label="Select Property"
            rules={[{ required: true, message: 'Please select a property' }]}
          >
            <Select placeholder="Choose property" showSearch optionFilterProp="children">
              {properties?.map((prop) => (
                <Option key={prop.id} value={prop.id}>
                  {prop.houseNumber} - {prop.offerNumber} (GHS {(prop.priceMinor / 100).toLocaleString()})
                </Option>
              ))}
            </Select>
          </Form.Item>

          {convertType === 'payment_plan' && (
            <>
              <Row gutter={8}>
                <Col span={12}>
                  <Form.Item
                    name="totalAmount"
                    label="Contract Price (GHS)"
                    rules={[{ required: true, message: 'Price is required' }]}
                  >
                    <InputNumber min={1} style={{ width: '100%' }} placeholder="150,000" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name="downPayment"
                    label="Down Payment (GHS)"
                    rules={[{ required: true, message: 'Down payment is required' }]}
                  >
                    <InputNumber min={0} style={{ width: '100%' }} placeholder="30,000" />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={8}>
                <Col span={12}>
                  <Form.Item
                    name="numMonths"
                    label="Plan Duration (Months)"
                    rules={[{ required: true, message: 'Duration is required' }]}
                  >
                    <InputNumber min={1} max={120} style={{ width: '100%' }} placeholder="12" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name="startDate"
                    label="Start Date"
                    rules={[{ required: true, message: 'Start date is required' }]}
                    initialValue={dayjs()}
                  >
                    <DatePicker style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
              </Row>
            </>
          )}

          <Form.Item style={{ marginTop: 24 }}>
            <Space wrap>
              <Button type="primary" htmlType="submit" loading={convertProspectMutation.isPending}>
                Convert Prospect
              </Button>
              <Button onClick={() => {
                setConvertModal(false);
                convertForm.resetFields();
              }}>Cancel</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};