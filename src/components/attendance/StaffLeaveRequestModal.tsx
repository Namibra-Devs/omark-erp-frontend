// src/components/attendance/StaffLeaveRequestModal.tsx
//
// Modal for staff members to submit a formal leave request.
// Governance Rule: Leave must be approved by a manager before days are marked as On Leave.

import React, { useState } from 'react';
import {
  Modal,
  Form,
  Select,
  DatePicker,
  Input,
  Alert,
  Space,
  Typography,
  Tag,
  message
} from 'antd';
import { CalendarOutlined, FileProtectOutlined } from '@ant-design/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useSubmitLeaveRequestMutation, type LeaveType } from '@/api/attendance';
import dayjs from 'dayjs';

const { Text } = Typography;
const { Option } = Select;
const { RangePicker } = DatePicker;

interface StaffLeaveRequestModalProps {
  open: boolean;
  onClose: () => void;
  branchId?: string;
  branchName?: string;
}

export const StaffLeaveRequestModal: React.FC<StaffLeaveRequestModalProps> = ({
  open,
  onClose,
  branchId = 'branch-accra-hq',
  branchName = 'Accra Head Office',
}) => {
  const { user } = useAuth();
  const [form] = Form.useForm();
  const submitMutation = useSubmitLeaveRequestMutation();
  const [calculatedDays, setCalculatedDays] = useState<number>(1);

  const handleSubmit = async (values: any) => {
    if (!user) return;
    try {
      const [start, end] = values.dateRange;
      const startDate = start.format('YYYY-MM-DD');
      const endDate = end.format('YYYY-MM-DD');

      await submitMutation.mutateAsync({
        userId: user.id,
        staffName: user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Staff Member',
        staffRole: user.role || 'staff',
        branchId,
        branchName,
        leaveType: values.leaveType as LeaveType,
        startDate,
        endDate,
        reason: values.reason.trim(),
      });

      message.success('Leave request submitted successfully! Awaiting manager approval.');
      form.resetFields();
      onClose();
    } catch (err: any) {
      message.error(err?.message || 'Failed to submit leave request');
    }
  };

  return (
    <Modal
      title={
        <Space align="center">
          <CalendarOutlined style={{ color: '#722ed1', fontSize: 20 }} />
          <span style={{ fontSize: 16, fontWeight: 700, color: '#1e293b' }}>
            Submit Official Staff Leave Application
          </span>
        </Space>
      }
      open={open}
      onCancel={onClose}
      onOk={() => form.submit()}
      okText="Submit for Manager Approval"
      confirmLoading={submitMutation.isPending}
      width={520}
    >
      <div style={{ paddingTop: 8 }}>
        <Alert
          type="info"
          showIcon
          icon={<FileProtectOutlined style={{ color: '#722ed1' }} />}
          style={{ marginBottom: 16, borderRadius: 8 }}
          message="Leave Approval Policy"
          description="Submitted leave requests remain in Pending status. Days will only be marked as 'On Leave' in the attendance register once officially approved by your Branch Manager."
        />

        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{
            leaveType: 'annual',
            dateRange: [dayjs().add(1, 'day'), dayjs().add(3, 'day')],
          }}
        >
          <Form.Item
            label="Leave Type"
            name="leaveType"
            rules={[{ required: true, message: 'Please select a leave category' }]}
          >
            <Select size="large">
              <Option value="annual">🏖️ Annual / Vacation Leave</Option>
              <Option value="sick">🏥 Sick & Medical Leave</Option>
              <Option value="casual">🕊️ Casual / Personal Leave</Option>
              <Option value="maternity">👶 Maternity / Paternity Leave</Option>
              <Option value="bereavement">🕯️ Compassionate / Bereavement Leave</Option>
            </Select>
          </Form.Item>

          <Form.Item
            label="Leave Date Duration"
            name="dateRange"
            rules={[{ required: true, message: 'Please specify the start and end dates' }]}
          >
            <RangePicker
              size="large"
              style={{ width: '100%' }}
              onChange={(dates) => {
                if (dates && dates[0] && dates[1]) {
                  const days = Math.max(1, dates[1].diff(dates[0], 'day') + 1);
                  setCalculatedDays(days);
                }
              }}
            />
          </Form.Item>

          <div style={{ background: '#f8fafc', padding: '10px 14px', borderRadius: 8, marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                Total Days Requested:
              </Text>
              <Tag color="purple" style={{ fontWeight: 700, fontSize: 13, padding: '2px 10px' }}>
                {calculatedDays} Calendar Day{calculatedDays > 1 ? 's' : ''}
              </Tag>
            </div>
          </div>

          <Form.Item
            label="Reason & Work Handover Details"
            name="reason"
            rules={[
              { required: true, message: 'Please provide a detailed reason and handover plan' },
              { min: 5, message: 'Reason must be at least 5 characters' },
            ]}
          >
            <Input.TextArea
              rows={3}
              placeholder="E.g. Scheduled annual holiday trip; active client follow-ups handed over to Sarah..."
            />
          </Form.Item>
        </Form>
      </div>
    </Modal>
  );
};
