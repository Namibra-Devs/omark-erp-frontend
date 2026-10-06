// src/components/marketing/MarketingTasksSection.tsx
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
  CheckSquareOutlined,
  PlusOutlined,
  UserOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  DeleteOutlined,
  FireOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  type MarketingTask,
  type TaskPriority,
  type TaskStatus,
  saveTask,
  updateTask,
  deleteTask,
} from '@/utils/marketingCampaignsStorage';
import { tokens } from '@/constants/tokens';

const { Title, Text } = Typography;
const { Option } = Select;

export interface MarketingTasksSectionProps {
  tasks: MarketingTask[];
  teamMembers: Array<{ id: string; name: string; role?: string }>;
  onRefresh: () => void;
}

export const MarketingTasksSection: React.FC<MarketingTasksSectionProps> = ({
  tasks,
  teamMembers,
  onRefresh,
}) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | TaskStatus>('all');
  const [form] = Form.useForm();

  const handleOpenAdd = () => {
    form.resetFields();
    form.setFieldsValue({
      priority: 'high',
      dueDate: dayjs().add(5, 'day'),
      progressPercent: 0,
      assignedStaffId: teamMembers[0]?.id || '',
    });
    setModalOpen(true);
  };

  const handleStatusChange = (taskId: string, newStatus: TaskStatus) => {
    updateTask(taskId, {
      status: newStatus,
      progressPercent: newStatus === 'completed' ? 100 : newStatus === 'in_progress' ? 50 : 0,
      completedAt: newStatus === 'completed' ? new Date().toISOString() : undefined,
    });
    message.success(`Task status updated to ${newStatus.replace('_', ' ')}`);
    onRefresh();
  };

  const handleDelete = (id: string) => {
    deleteTask(id);
    message.success('Marketing task deleted');
    onRefresh();
  };

  const handleFinish = (values: any) => {
    const member = teamMembers.find((m) => m.id === values.assignedStaffId);
    const newTask: MarketingTask = {
      id: `task-${Date.now()}`,
      title: values.title,
      description: values.description || '',
      assignedStaffId: values.assignedStaffId,
      assignedStaffName: member?.name || values.assignedStaffName || 'Marketing Executive',
      assignedStaffRole: member?.role || 'Marketing Executive',
      priority: values.priority as TaskPriority,
      status: 'pending',
      dueDate: values.dueDate.format('YYYY-MM-DD'),
      progressPercent: 0,
      campaignName: values.campaignName,
      createdAt: new Date().toISOString(),
    };

    saveTask(newTask);
    message.success('Marketing task assigned successfully!');
    setModalOpen(false);
    form.resetFields();
    onRefresh();
  };

  const filteredTasks = tasks.filter((t) => {
    if (statusFilter === 'all') return true;
    return t.status === statusFilter;
  });

  const columns: any[] = [
    {
      title: 'Task Title & Deliverables',
      key: 'title',
      render: (_: any, r: MarketingTask) => (
        <Space direction="vertical" size={2}>
          <Text strong style={{ fontSize: 13 }}>{r.title}</Text>
          {r.description && (
            <Text type="secondary" style={{ fontSize: 11 }} ellipsis>
              {r.description}
            </Text>
          )}
          {r.campaignName && (
            <Tag color="cyan" style={{ fontSize: 10 }}>
              Campaign: {r.campaignName}
            </Tag>
          )}
        </Space>
      ),
    },
    {
      title: 'Assigned To',
      key: 'assignee',
      width: 170,
      render: (_: any, r: MarketingTask) => (
        <Space size={6}>
          <UserOutlined style={{ color: tokens.primary }} />
          <div>
            <div style={{ fontWeight: 600, fontSize: 12 }}>{r.assignedStaffName}</div>
            <div style={{ fontSize: 10, color: '#8c8c8c' }}>{r.assignedStaffRole}</div>
          </div>
        </Space>
      ),
    },
    {
      title: 'Priority',
      dataIndex: 'priority',
      key: 'priority',
      width: 100,
      render: (p: TaskPriority) => {
        const color =
          p === 'urgent' ? 'red' : p === 'high' ? 'orange' : p === 'medium' ? 'blue' : 'default';
        return (
          <Tag color={color} style={{ textTransform: 'capitalize' }}>
            {p === 'urgent' ? <FireOutlined /> : null} {p}
          </Tag>
        );
      },
    },
    {
      title: 'Due Date',
      dataIndex: 'dueDate',
      key: 'dueDate',
      width: 130,
      render: (d: string, r: MarketingTask) => {
        const isPast = dayjs(d).isBefore(dayjs(), 'day') && r.status !== 'completed';
        return (
          <Space size={4}>
            <ClockCircleOutlined style={{ color: isPast ? '#ff4d4f' : '#8c8c8c' }} />
            <Text style={{ color: isPast ? '#cf1322' : undefined, fontSize: 12 }} strong={isPast}>
              {dayjs(d).format('DD MMM YYYY')}
            </Text>
          </Space>
        );
      },
    },
    {
      title: 'Progress',
      key: 'progress',
      width: 130,
      render: (_: any, r: MarketingTask) => (
        <Progress
          percent={r.progressPercent || (r.status === 'completed' ? 100 : r.status === 'in_progress' ? 50 : 0)}
          size="small"
          status={r.status === 'completed' ? 'success' : 'normal'}
        />
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 130,
      render: (st: TaskStatus, r: MarketingTask) => {
        return (
          <Select
            size="small"
            value={st}
            onChange={(val) => handleStatusChange(r.id, val)}
            style={{ width: 120 }}
          >
            <Option value="pending">Pending</Option>
            <Option value="in_progress">In Progress</Option>
            <Option value="completed">Completed</Option>
          </Select>
        );
      },
    },
    {
      title: 'Action',
      key: 'action',
      width: 60,
      align: 'center',
      render: (_: any, r: MarketingTask) => (
        <Popconfirm
          title="Delete task?"
          onConfirm={() => handleDelete(r.id)}
          okText="Yes"
          cancelText="No"
        >
          <Button type="text" danger size="small" icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
  ];

  return (
    <Card
      title={
        <Space wrap>
          <CheckSquareOutlined style={{ color: tokens.primary }} />
          <span>Assigned Marketing Tasks & Campaign Deliverables</span>
          <Badge
            count={tasks.filter((t) => t.status !== 'completed').length}
            style={{ backgroundColor: '#1890ff' }}
          />
        </Space>
      }
      extra={
        <Space wrap>
          <Select
            size="small"
            value={statusFilter}
            onChange={setStatusFilter}
            style={{ width: 130 }}
          >
            <Option value="all">All Tasks ({tasks.length})</Option>
            <Option value="pending">Pending</Option>
            <Option value="in_progress">In Progress</Option>
            <Option value="completed">Completed</Option>
          </Select>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleOpenAdd}
            style={{ background: tokens.primary, borderColor: tokens.primary }}
          >
            Assign Task
          </Button>
        </Space>
      }
      style={{
        borderRadius: 12,
        boxShadow: '0 2px 10px rgba(0,0,0,0.03)',
        border: '1px solid #f0f0f0',
        marginBottom: 24,
      }}
    >
      <Table
        dataSource={filteredTasks}
        columns={columns}
        rowKey="id"
        pagination={{ pageSize: 6 }}
        size="small"
        scroll={{ x: 800 }}
      />

      {/* Assign Task Modal */}
      <Modal
        title={
          <Space>
            <CheckSquareOutlined style={{ color: tokens.primary }} />
            <span>Assign Marketing Task</span>
          </Space>
        }
        open={modalOpen}
        onCancel={() => {
          setModalOpen(false);
          form.resetFields();
        }}
        footer={null}
        width={540}
        style={{ top: 20 }}
      >
        <Form form={form} layout="vertical" onFinish={handleFinish}>
          <Form.Item
            name="title"
            label="Task Title / Action Item"
            rules={[{ required: true, message: 'Please enter task title' }]}
          >
            <Input placeholder="e.g., Set up Airport Highway Billboard Lighting or Follow up 25 Expo Leads" />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="assignedStaffId"
                label="Assignee (Marketing Staff)"
                rules={[{ required: true, message: 'Select staff' }]}
              >
                <Select placeholder="Select staff member">
                  {teamMembers.map((m) => (
                    <Option key={m.id} value={m.id}>
                      {m.name}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="priority"
                label="Task Priority"
                rules={[{ required: true }]}
              >
                <Select>
                  <Option value="urgent">Urgent (Immediate)</Option>
                  <Option value="high">High</Option>
                  <Option value="medium">Medium</Option>
                  <Option value="low">Low</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="dueDate"
                label="Due Date"
                rules={[{ required: true, message: 'Select due date' }]}
              >
                <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="campaignName" label="Associated Campaign (Optional)">
                <Input placeholder="e.g., Airport Highway LED Billboard" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="description" label="Detailed Instructions & Requirements">
            <Input.TextArea rows={3} placeholder="Provide context, required collateral, or milestone deliverables" />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setModalOpen(false)}>Cancel</Button>
              <Button type="primary" htmlType="submit">
                Assign Task
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};
