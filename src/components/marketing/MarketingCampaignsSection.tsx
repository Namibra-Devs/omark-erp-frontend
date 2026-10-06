// src/components/marketing/MarketingCampaignsSection.tsx
import React, { useState } from 'react';
import {
  Card,
  Row,
  Col,
  Table,
  Tag,
  Button,
  Space,
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  DatePicker,
  Progress,
  Typography,
  Tooltip,
  Badge,
  message,
  Popconfirm,
} from 'antd';
import {
  RocketOutlined,
  PlusOutlined,
  DollarOutlined,
  TeamOutlined,
  RiseOutlined,
  CheckCircleOutlined,
  PauseCircleOutlined,
  ClockCircleOutlined,
  DeleteOutlined,
  EditOutlined,
  EnvironmentOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  type MarketingCampaign,
  type MarketingChannel,
  type CampaignStatus,
  CHANNEL_CONFIG,
  saveCampaign,
  updateCampaign,
  deleteCampaign,
} from '@/utils/marketingCampaignsStorage';
import { tokens } from '@/constants/tokens';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

export interface MarketingCampaignsSectionProps {
  campaigns: MarketingCampaign[];
  onRefresh: () => void;
}

export const MarketingCampaignsSection: React.FC<MarketingCampaignsSectionProps> = ({
  campaigns,
  onRefresh,
}) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<MarketingCampaign | null>(null);
  const [form] = Form.useForm();

  const handleOpenAdd = () => {
    setEditingCampaign(null);
    form.resetFields();
    form.setFieldsValue({
      status: 'active',
      channel: 'social_media',
      startDate: dayjs(),
      endDate: dayjs().add(30, 'day'),
      budgetGHS: 5000,
      spendGHS: 0,
      leadsAcquired: 0,
      conversions: 0,
    });
    setModalOpen(true);
  };

  const handleOpenEdit = (camp: MarketingCampaign) => {
    setEditingCampaign(camp);
    form.resetFields();
    form.setFieldsValue({
      name: camp.name,
      channel: camp.channel,
      status: camp.status,
      budgetGHS: camp.budgetGHS,
      spendGHS: camp.spendGHS,
      startDate: dayjs(camp.startDate),
      endDate: dayjs(camp.endDate),
      leadsAcquired: camp.leadsAcquired,
      conversions: camp.conversions,
      targetAudience: camp.targetAudience,
      targetLocation: camp.targetLocation,
      description: camp.description,
    });
    setModalOpen(true);
  };

  const handleDelete = (id: string) => {
    deleteCampaign(id);
    message.success('Campaign removed successfully');
    onRefresh();
  };

  const handleToggleStatus = (camp: MarketingCampaign) => {
    const nextStatus: CampaignStatus = camp.status === 'active' ? 'paused' : 'active';
    updateCampaign(camp.id, { status: nextStatus });
    message.success(`Campaign marked as ${nextStatus}`);
    onRefresh();
  };

  const handleFinish = (values: any) => {
    const channel = values.channel as MarketingChannel;
    const channelLabel = CHANNEL_CONFIG[channel]?.label || channel;
    const budgetGHS = values.budgetGHS || 0;
    const spendGHS = values.spendGHS || 0;
    const leadsAcquired = values.leadsAcquired || 0;
    const conversions = values.conversions || 0;
    const conversionRate =
      leadsAcquired > 0 ? Math.round((conversions / leadsAcquired) * 1000) / 10 : 0;
    const cplGHS =
      leadsAcquired > 0 ? Math.round((spendGHS / leadsAcquired) * 100) / 100 : 0;

    if (editingCampaign) {
      updateCampaign(editingCampaign.id, {
        name: values.name,
        channel,
        channelLabel,
        status: values.status,
        budgetGHS,
        spendGHS,
        startDate: values.startDate.format('YYYY-MM-DD'),
        endDate: values.endDate.format('YYYY-MM-DD'),
        leadsAcquired,
        conversions,
        conversionRate,
        cplGHS,
        targetAudience: values.targetAudience || 'Target Diaspora & Local Buyers',
        targetLocation: values.targetLocation || 'Greater Accra',
        description: values.description,
      });
      message.success('Campaign updated successfully');
    } else {
      const newCamp: MarketingCampaign = {
        id: `camp-${Date.now()}`,
        name: values.name,
        channel,
        channelLabel,
        status: values.status,
        budgetGHS,
        spendGHS,
        startDate: values.startDate.format('YYYY-MM-DD'),
        endDate: values.endDate.format('YYYY-MM-DD'),
        leadsAcquired,
        conversions,
        conversionRate,
        cplGHS,
        targetAudience: values.targetAudience || 'Target Diaspora & Local Buyers',
        targetLocation: values.targetLocation || 'Greater Accra',
        description: values.description,
        createdAt: new Date().toISOString(),
      };
      saveCampaign(newCamp);
      message.success('New marketing campaign launched!');
    }

    setModalOpen(false);
    form.resetFields();
    onRefresh();
  };

  const columns: any[] = [
    {
      title: 'Campaign Name & Channel',
      key: 'name',
      render: (_: any, r: MarketingCampaign) => {
        const cfg = CHANNEL_CONFIG[r.channel] || { color: '#1890ff', icon: '📢' };
        return (
          <Space direction="vertical" size={2}>
            <Text strong style={{ fontSize: 13 }}>{r.name}</Text>
            <Space size={4}>
              <Tag color={cfg.color} style={{ fontSize: 11 }}>
                {cfg.icon} {r.channelLabel || cfg.label}
              </Tag>
              {r.targetLocation && (
                <Text type="secondary" style={{ fontSize: 11 }}>
                  <EnvironmentOutlined /> {r.targetLocation}
                </Text>
              )}
            </Space>
          </Space>
        );
      },
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 110,
      render: (st: CampaignStatus, r: MarketingCampaign) => {
        const color =
          st === 'active' ? 'green' : st === 'paused' ? 'orange' : st === 'upcoming' ? 'blue' : 'default';
        const label =
          st === 'active' ? 'Active' : st === 'paused' ? 'Paused' : st === 'upcoming' ? 'Upcoming' : 'Ended';
        return (
          <Tag
            color={color}
            style={{ cursor: 'pointer' }}
            onClick={() => handleToggleStatus(r)}
          >
            {label}
          </Tag>
        );
      },
    },
    {
      title: 'Budget & Spend',
      key: 'budget',
      width: 170,
      render: (_: any, r: MarketingCampaign) => {
        const percent = r.budgetGHS > 0 ? Math.min(100, Math.round((r.spendGHS / r.budgetGHS) * 100)) : 0;
        return (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
              <span>₵{r.spendGHS.toLocaleString()} spent</span>
              <span style={{ color: '#8c8c8c' }}>₵{r.budgetGHS.toLocaleString()}</span>
            </div>
            <Progress
              percent={percent}
              size="small"
              strokeColor={percent > 90 ? '#ff4d4f' : '#1890ff'}
              showInfo={false}
            />
          </div>
        );
      },
    },
    {
      title: 'Leads Acquired',
      dataIndex: 'leadsAcquired',
      key: 'leads',
      width: 120,
      align: 'right',
      render: (v: number) => (
        <Text strong style={{ color: '#1890ff', fontSize: 14 }}>
          {v.toLocaleString()}
        </Text>
      ),
    },
    {
      title: 'Cost per Lead',
      dataIndex: 'cplGHS',
      key: 'cpl',
      width: 120,
      align: 'right',
      render: (v: number) => `₵${(v || 0).toFixed(2)}`,
    },
    {
      title: 'Conversions',
      key: 'conversions',
      width: 130,
      align: 'right',
      render: (_: any, r: MarketingCampaign) => (
        <Space direction="vertical" size={0} style={{ textAlign: 'right', width: '100%' }}>
          <Text strong style={{ color: '#52c41a' }}>
            {r.conversions} Sales
          </Text>
          <Text type="secondary" style={{ fontSize: 11 }}>
            {r.conversionRate}% rate
          </Text>
        </Space>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 100,
      align: 'center',
      render: (_: any, r: MarketingCampaign) => (
        <Space size={4}>
          <Tooltip title="Edit Campaign">
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleOpenEdit(r)}
            />
          </Tooltip>
          <Popconfirm
            title="Delete Campaign?"
            description="Are you sure you want to remove this campaign record?"
            onConfirm={() => handleDelete(r.id)}
            okText="Delete"
            cancelText="Cancel"
            okButtonProps={{ danger: true }}
          >
            <Button type="text" danger size="small" icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Card
      title={
        <Space>
          <RocketOutlined style={{ color: tokens.primary }} />
          <span>Active Marketing Campaigns & Acquisition Channels</span>
          <Badge
            count={campaigns.filter((c) => c.status === 'active').length}
            style={{ backgroundColor: '#52c41a' }}
          />
        </Space>
      }
      extra={
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={handleOpenAdd}
          style={{ background: tokens.primary, borderColor: tokens.primary }}
        >
          Launch Campaign
        </Button>
      }
      style={{
        borderRadius: 12,
        boxShadow: '0 2px 10px rgba(0,0,0,0.03)',
        border: '1px solid #f0f0f0',
        marginBottom: 24,
      }}
    >
      <Table
        dataSource={campaigns}
        columns={columns}
        rowKey="id"
        pagination={{ pageSize: 6 }}
        size="small"
        scroll={{ x: 860 }}
      />

      {/* Launch / Edit Campaign Modal */}
      <Modal
        title={
          <Space>
            <RocketOutlined style={{ color: tokens.primary }} />
            <span>{editingCampaign ? 'Edit Marketing Campaign' : 'Launch New Marketing Campaign'}</span>
          </Space>
        }
        open={modalOpen}
        onCancel={() => {
          setModalOpen(false);
          form.resetFields();
        }}
        footer={null}
        width={620}
        style={{ top: 20 }}
      >
        <Form form={form} layout="vertical" onFinish={handleFinish}>
          <Form.Item
            name="name"
            label="Campaign Name / Headline"
            rules={[{ required: true, message: 'Please enter campaign name' }]}
          >
            <Input placeholder="e.g., Highway Mega-Billboard or Q4 Diaspora Roadshow" />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="channel"
                label="Acquisition Channel"
                rules={[{ required: true, message: 'Please select channel' }]}
              >
                <Select placeholder="Select channel">
                  {Object.entries(CHANNEL_CONFIG).map(([key, cfg]) => (
                    <Option key={key} value={key}>
                      {cfg.icon} {cfg.label}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="status"
                label="Campaign Status"
                rules={[{ required: true }]}
              >
                <Select>
                  <Option value="active">Active</Option>
                  <Option value="upcoming">Upcoming</Option>
                  <Option value="paused">Paused</Option>
                  <Option value="completed">Completed</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="budgetGHS"
                label="Total Budget (GHS / ₵)"
                rules={[{ required: true, message: 'Enter budget' }]}
              >
                <InputNumber style={{ width: '100%' }} min={100} prefix="₵" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="spendGHS" label="Current Spend (GHS / ₵)">
                <InputNumber style={{ width: '100%' }} min={0} prefix="₵" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="startDate"
                label="Start Date"
                rules={[{ required: true, message: 'Select start date' }]}
              >
                <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="endDate"
                label="End Date"
                rules={[{ required: true, message: 'Select end date' }]}
              >
                <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="leadsAcquired" label="Prospects / Leads Acquired">
                <InputNumber style={{ width: '100%' }} min={0} placeholder="e.g. 50" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="conversions" label="Converted Sales">
                <InputNumber style={{ width: '100%' }} min={0} placeholder="e.g. 8" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="targetLocation" label="Target Location / Territory">
                <Input placeholder="e.g., Airport Residential / Accra / Diaspora UK" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="targetAudience" label="Target Audience Demographics">
                <Input placeholder="e.g., Diaspora Investors, High Net Worth" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="description" label="Campaign Objectives & Placement Details">
            <Input.TextArea rows={2} placeholder="Brief summary of marketing assets and target deliverables" />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setModalOpen(false)}>Cancel</Button>
              <Button type="primary" htmlType="submit">
                {editingCampaign ? 'Save Changes' : 'Launch Campaign'}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};
