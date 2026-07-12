// src/pages/marketing/ProspectDetailPage.tsx
import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, Row, Col, Typography, Tag, Button, Space, Timeline, Modal, Form, Input, Select, message, Descriptions, Badge, Spin, Empty, Alert, Popconfirm } from 'antd';
import {
  ArrowLeftOutlined,
  PhoneOutlined,
  MailOutlined,
  HomeOutlined,
  ClockCircleOutlined,
  EditOutlined,
  DeleteOutlined,
  WhatsAppOutlined,
  UserOutlined,
  ReloadOutlined
} from '@ant-design/icons';
import { useAuth } from '@/contexts/AuthContext';
import { StatusTag } from '@/components/shared/StatusTag';
import { PageHeader } from '@/components/shared/PageHeader';
import { PhoneInput } from '@/components/shared/PhoneInput';
import { ConvertProspectModal } from '@/components/shared/ConvertProspectModal';
import { LogInteractionModal } from '@/components/shared/LogInteractionModal';
import { DollarOutlined, PlusOutlined } from '@ant-design/icons';
import { prospectStatusLabels, interactionChannelLabels } from '@/constants/enums';
import type { Prospect, ProspectStatus } from '@/types';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import {
  useProspectQuery,
  useInteractionsQuery,
  useUpdateProspectMutation,
  useDeleteProspectMutation
} from '@/api/prospects';

dayjs.extend(relativeTime);

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

export const ProspectDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { hasRole } = useAuth();

  // Modal state
  const [editModal, setEditModal] = useState(false);
  const [editForm] = Form.useForm();
  const [convertModal, setConvertModal] = useState(false);
  const [logInteractionModal, setLogInteractionModal] = useState(false);

  // API hooks
  const prospectId = id || '';
  const {
    data: prospectData,
    isLoading: isProspectLoading,
    error: prospectError,
    refetch: refetchProspect
  } = useProspectQuery(prospectId);

  const {
    data: interactionsData,
    isLoading: isInteractionsLoading,
    refetch: refetchInteractions
  } = useInteractionsQuery(prospectId);

  const updateProspectMutation = useUpdateProspectMutation();
  const deleteProspectMutation = useDeleteProspectMutation();

  // Extract data
  const prospect = prospectData as any;
  // useInteractionsQuery resolves directly to the interactions array now
  // (see src/api/prospects.ts) — no nested `.data` to unwrap.
  const interactions = interactionsData ?? [];

  const openEditModal = () => {
    editForm.setFieldsValue({
      firstName: prospect.firstName,
      lastName: prospect.lastName,
      address: prospect.address,
      phoneNumber: prospect.phoneNumber,
      status: prospect.status,
      reasonForContact: prospect.reasonForContact,
      notes: prospect.notes,
    });
    setEditModal(true);
  };

  const handleEditProspect = async (values: any) => {
    try {
      await updateProspectMutation.mutateAsync({
        id: prospectId,
        data: {
          firstName: values.firstName,
          lastName: values.lastName,
          address: values.address,
          phoneNumber: values.phoneNumber,
          status: values.status,
          reasonForContact: values.reasonForContact,
          notes: values.notes,
        },
      });
      setEditModal(false);
      editForm.resetFields();
      message.success('Prospect updated successfully!');
      await refetchProspect();
    } catch (err: any) {
      const errorMsg = err?.response?.data?.message || err?.message || 'Failed to update prospect.';
      message.error(errorMsg);
    }
  };

  const handleDeleteProspect = async () => {
    try {
      await deleteProspectMutation.mutateAsync(prospectId);
      message.success('Prospect deleted successfully!');
      navigate('/marketing/prospects');
    } catch (err: any) {
      const errorMsg = err?.response?.data?.message || err?.message || 'Failed to delete prospect.';
      message.error(errorMsg);
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

  // Loading state
  if (isProspectLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <Spin size="large" tip="Loading prospect details..." />
      </div>
    );
  }

  // Error state
  if (prospectError || !prospect) {
    return (
      <div style={{ padding: 24 }}>
        <Alert
          message="Error Loading Prospect"
          description="There was an error loading the prospect details. Please try again."
          type="error"
          showIcon
          action={
            <Button size="small" type="primary" onClick={() => refetchProspect()}>
              Retry
            </Button>
          }
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <PageHeader
          title={`${prospect.firstName} ${prospect.lastName}`}
          actions={[
            {
              label: 'Back',
              onClick: () => navigate('/marketing/prospects'),
              icon: <ArrowLeftOutlined />,
            },
            {
              label: 'Edit Prospect',
              onClick: openEditModal,
              icon: <EditOutlined />,
            },
            ...(prospect.status !== 'purchased'
              ? [
                  {
                    label: 'Convert to Customer',
                    onClick: () => setConvertModal(true),
                    icon: <DollarOutlined />,
                  },
                ]
              : []),
            {
              label: 'Refresh',
              onClick: () => {
                refetchProspect();
                message.success('Refreshed!');
              },
              icon: <ReloadOutlined />,
            },
          ]}
        />
        {hasRole(['admin']) && (
          <Popconfirm
            title="Delete Prospect"
            description={`Are you sure you want to delete ${prospect.firstName} ${prospect.lastName}? This also removes its interactions and appointments.`}
            onConfirm={handleDeleteProspect}
            okText="Yes"
            cancelText="No"
          >
            <Button danger icon={<DeleteOutlined />} style={{ marginBottom: 24 }}>
              Delete (admin only)
            </Button>
          </Popconfirm>
        )}
      </div>

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
              {prospect.email && (
                <Descriptions.Item label="Email">
                  <a href={`mailto:${prospect.email}`}>
                    <MailOutlined /> {prospect.email}
                  </a>
                </Descriptions.Item>
              )}
              <Descriptions.Item label="Address">
                <HomeOutlined /> {prospect.address}
              </Descriptions.Item>
              <Descriptions.Item label="Status">
                <Badge status={getStatusColor(prospect.status)} />
                <StatusTag status={prospect.status} type="prospect" />
              </Descriptions.Item>
              <Descriptions.Item label="Source">
                <Tag color="blue">{prospect.source?.toUpperCase() || 'N/A'}</Tag>
              </Descriptions.Item>
              {prospect.reasonForContact && (
                <Descriptions.Item label="Reason for Contact">
                  <Paragraph ellipsis={{ rows: 2, expandable: true, symbol: 'more' }}>
                    {prospect.reasonForContact}
                  </Paragraph>
                </Descriptions.Item>
              )}
              <Descriptions.Item label="Notes">
                <Paragraph ellipsis={{ rows: 3, expandable: true, symbol: 'more' }}>
                  {prospect.notes || 'No additional notes'}
                </Paragraph>
              </Descriptions.Item>
              <Descriptions.Item label="Created">
                {dayjs(prospect.createdAt).format('MMM DD, YYYY HH:mm')}
              </Descriptions.Item>
              <Descriptions.Item label="Last Updated">
                {dayjs(prospect.updatedAt).format('MMM DD, YYYY HH:mm')}
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>

        {/* Right Column - Interactions */}
        <Col xs={24} lg={12}>
          <Card
            title="Interactions Timeline"
            extra={
              <Button
                type="primary"
                size="small"
                icon={<PlusOutlined />}
                onClick={() => setLogInteractionModal(true)}
              >
                Log Interaction
              </Button>
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
                {interactions.map((interaction: any) => (
                  <Timeline.Item
                    key={interaction.id}
                    dot={<span style={{ color: getChannelColor(interaction.channel) }}>{getChannelIcon(interaction.channel)}</span>}
                    color="blue"
                  >
                    <div style={{ marginBottom: 8, wordBreak: 'break-word' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 4 }}>
                        <Text strong>
                          {interactionChannelLabels[interaction.channel as keyof typeof interactionChannelLabels] || interaction.channel}
                        </Text>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          <ClockCircleOutlined /> {dayjs(interaction.occurredAt).fromNow()}
                        </Text>
                      </div>
                      <Paragraph style={{ margin: '8px 0', wordBreak: 'break-word' }}>
                        {interaction.response}
                      </Paragraph>
                      <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>
                        Logged by: {interaction.loggedBy?.firstName || interaction.loggedBy?.email || `User #${interaction.loggedByUserId}`}
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

      {/* Edit Prospect Modal */}
      <Modal
        title="Edit Prospect"
        open={editModal}
        onCancel={() => {
          setEditModal(false);
          editForm.resetFields();
        }}
        footer={null}
        width={600}
        style={{ maxWidth: '95%', top: 20 }}
        bodyStyle={{ padding: '16px' }}
      >
        <Form form={editForm} layout="vertical" onFinish={handleEditProspect}>
          <Row gutter={[8, 0]}>
            <Col xs={24} sm={12}>
              <Form.Item
                name="firstName"
                label="First Name"
                rules={[{ required: true, message: 'First name is required' }]}
              >
                <Input />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                name="lastName"
                label="Last Name"
                rules={[{ required: true, message: 'Last name is required' }]}
              >
                <Input />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="address"
            label="Address"
            rules={[{ required: true, message: 'Address is required' }]}
          >
            <Input.TextArea rows={2} />
          </Form.Item>

          <Form.Item
            name="phoneNumber"
            label="Phone Number"
            rules={[{ required: true, message: 'Phone number is required' }]}
          >
            <PhoneInput />
          </Form.Item>

          <Form.Item
            name="status"
            label="Status"
            rules={[{ required: true, message: 'Please select a status' }]}
          >
            <Select placeholder="Select status" style={{ width: '100%' }}>
              <Option value="new">New</Option>
              <Option value="meeting_scheduled">Meeting Scheduled</Option>
              <Option value="meeting_completed">Meeting Completed</Option>
              <Option value="suspended">Suspended</Option>
              <Option value="postponed">Postponed</Option>
              <Option value="canceled">Canceled</Option>
              <Option value="purchased">Purchased</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="reasonForContact"
            label="Reason for Contact"
          >
            <Input.TextArea rows={3} />
          </Form.Item>

          <Form.Item
            name="notes"
            label="Additional Notes"
          >
            <Input.TextArea rows={3} />
          </Form.Item>

          <Form.Item>
            <Space wrap>
              <Button type="primary" htmlType="submit" loading={updateProspectMutation.isPending}>
                Save Changes
              </Button>
              <Button onClick={() => {
                setEditModal(false);
                editForm.resetFields();
              }}>Cancel</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <ConvertProspectModal
        open={convertModal}
        prospect={prospect}
        onClose={() => setConvertModal(false)}
      />

      <LogInteractionModal
        open={logInteractionModal}
        prospect={prospect}
        onClose={() => setLogInteractionModal(false)}
        onLogged={() => refetchInteractions()}
      />
    </div>
  );
};