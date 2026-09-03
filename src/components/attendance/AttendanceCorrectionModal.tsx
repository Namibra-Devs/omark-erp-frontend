// src/components/attendance/AttendanceCorrectionModal.tsx
//
// Form for staff members to request attendance corrections (forgot to clock in/out, offsite duty).

import React from 'react';
import { Modal, Form, Input, DatePicker, TimePicker, Button, Typography, Space, Alert, message } from 'antd';
import { EditOutlined, ClockCircleOutlined, SendOutlined } from '@ant-design/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useRequestCorrectionMutation, type AttendanceRecord } from '@/api/attendance';
import dayjs from 'dayjs';

const { Text } = Typography;

interface AttendanceCorrectionModalProps {
  open: boolean;
  onClose: () => void;
  existingAttendance?: AttendanceRecord | null;
  defaultDate?: string;
}

export const AttendanceCorrectionModal: React.FC<AttendanceCorrectionModalProps> = ({
  open,
  onClose,
  existingAttendance,
  defaultDate,
}) => {
  const [form] = Form.useForm();
  const { user } = useAuth();
  const requestMutation = useRequestCorrectionMutation();

  const activeDate = existingAttendance?.date || defaultDate || dayjs().format('YYYY-MM-DD');

  const handleSubmit = async (values: any) => {
    if (!user) return;
    try {
      const dateStr = values.date.format('YYYY-MM-DD');
      const inTime = values.clockInTime
        ? `${dateStr}T${values.clockInTime.format('HH:mm:ss')}.000Z`
        : `${dateStr}T08:00:00.000Z`;
      const outTime = values.clockOutTime
        ? `${dateStr}T${values.clockOutTime.format('HH:mm:ss')}.000Z`
        : `${dateStr}T17:00:00.000Z`;

      await requestMutation.mutateAsync({
        attendanceId: existingAttendance?.id,
        userId: user.id,
        staffName: user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Staff Member',
        branchId: existingAttendance?.branchId || user.branchId || 'branch-accra-hq',
        date: dateStr,
        proposedClockIn: inTime,
        proposedClockOut: outTime,
        reason: values.reason,
      });

      message.success('Attendance correction request submitted to your Supervisor / HR.');
      form.resetFields();
      onClose();
    } catch (err: any) {
      message.error(err?.message || 'Failed to submit correction request');
    }
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      width={540}
      title={
        <Space>
          <EditOutlined style={{ color: '#2E5E8C' }} />
          <span style={{ fontWeight: 700, fontSize: 16 }}>Request Attendance Time Correction</span>
        </Space>
      }
      footer={null}
    >
      <div style={{ padding: '8px 0' }}>
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16, borderRadius: 6 }}
          message="Supervisor Review Required"
          description="Use this form if you forgot to clock in or out, experienced GPS errors, or were on an authorized offsite client assignment."
        />

        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{
            date: dayjs(activeDate),
            clockInTime: existingAttendance?.clockInTime ? dayjs(existingAttendance.clockInTime) : dayjs('08:00', 'HH:mm'),
            clockOutTime: existingAttendance?.clockOutTime ? dayjs(existingAttendance.clockOutTime) : dayjs('17:00', 'HH:mm'),
          }}
        >
          <Form.Item
            name="date"
            label="Attendance Date"
            rules={[{ required: true, message: 'Please select the date' }]}
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            name="clockInTime"
            label="Actual Clock In Time"
            rules={[{ required: true, message: 'Please provide arrival time' }]}
          >
            <TimePicker format="HH:mm" style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            name="clockOutTime"
            label="Actual Clock Out Time"
            rules={[{ required: true, message: 'Please provide departure time' }]}
          >
            <TimePicker format="HH:mm" style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            name="reason"
            label="Reason for Correction / Justification"
            rules={[{ required: true, min: 6, message: 'Please specify the reason (min 6 characters)' }]}
          >
            <Input.TextArea
              rows={3}
              placeholder="e.g. Device battery died at reception, On-site land inspection in Amasaman, GPS network connectivity issue..."
            />
          </Form.Item>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
            <Button onClick={onClose}>Cancel</Button>
            <Button
              type="primary"
              htmlType="submit"
              icon={<SendOutlined />}
              loading={requestMutation.isPending}
              style={{ background: '#2E5E8C', borderColor: '#2E5E8C' }}
            >
              Submit Request
            </Button>
          </div>
        </Form>
      </div>
    </Modal>
  );
};
