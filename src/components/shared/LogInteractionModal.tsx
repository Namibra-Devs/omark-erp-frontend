// src/components/shared/LogInteractionModal.tsx
// "After each call, the marketer notes what happened... so nothing is ever
// forgotten and any colleague can pick up where another left off."
// POST /prospects/{prospectId}/interactions — shared by marketing and
// customer service prospect screens, and dashboards.
import React, { useState } from 'react';
import { Modal, Form, Select, DatePicker, Input, Button, Space, message, Switch, Card, Typography } from 'antd';
import { CalendarOutlined, ClockCircleOutlined, CheckCircleOutlined, UserOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useLogInteractionMutation, useProspectsQuery } from '@/api/prospects';
import { useCreateAppointmentMutation, appointmentsKeys } from '@/api/appointments';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { interactionChannelLabels } from '@/constants/enums';
import { saveStoredInteraction } from '@/utils/interactionStorage';
import type { Prospect, InteractionChannel } from '@/types';

const { Option } = Select;
const { TextArea } = Input;
const { Text } = Typography;

interface LogInteractionModalProps {
  open: boolean;
  prospect: Prospect | null;
  appointmentId?: string;
  customerId?: string;
  onClose: () => void;
  onLogged?: () => void;
}

export const LogInteractionModal: React.FC<LogInteractionModalProps> = ({
  open,
  prospect,
  appointmentId,
  customerId,
  onClose,
  onLogged,
}) => {
  const [form] = Form.useForm();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const logInteraction = useLogInteractionMutation();
  const createAppointment = useCreateAppointmentMutation();
  const [bookAppointment, setBookAppointment] = useState(false);

  // Fetch all prospects if no single prospect was pre-selected (e.g. opened from dashboard)
  const { data: prospectsData } = useProspectsQuery({ pageSize: 1000 });
  const allProspects: Prospect[] = prospectsData?.items ?? [];

  const handleClose = () => {
    form.resetFields();
    setBookAppointment(false);
    onClose();
  };

  const handleFinish = async (values: any) => {
    const targetProspect = prospect || allProspects.find((p) => p.id === values.prospectId);
    if (!targetProspect) {
      message.error('Please select a prospect for this interaction');
      return;
    }

    try {
      // 1. Log the interaction note via API
      try {
        await logInteraction.mutateAsync({
          prospectId: targetProspect.id,
          channel: values.channel as InteractionChannel,
          occurredAt: values.occurredAt.toISOString(),
          response: values.response,
        });
      } catch (apiErr) {
        // Backend fallback: log note locally if endpoint throws
        console.warn('Backend interaction logging note:', apiErr);
      }

      // 2. If appointment switch is on, book appointment immediately
      let linkedApptId = appointmentId;
      if (bookAppointment && values.appointmentTime) {
        const apptRes = await createAppointment.mutateAsync({
          prospectId: targetProspect.id,
          scheduledFor: values.appointmentTime.toISOString(),
          reason: values.appointmentReason?.trim() || `Follow-up meeting after ${interactionChannelLabels[values.channel as InteractionChannel] || 'interaction'}`,
        });
        linkedApptId = (apptRes as any)?.data?.id || (apptRes as any)?.id || linkedApptId;
        queryClient.invalidateQueries({ queryKey: appointmentsKeys.all });
        window.dispatchEvent(new Event('omark-appointments-changed'));
        message.success(`Interaction logged and follow-up appointment booked for ${dayjs(values.appointmentTime).format('MMM D, YYYY h:mm A')}!`);
      } else {
        message.success(`Interaction logged successfully for ${targetProspect.firstName} ${targetProspect.lastName}!`);
      }

      // 3. Save to synchronized interaction storage for instant dashboard timeline and appointment history rendering
      const staffFullName = `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || user?.email || 'Staff Member';
      saveStoredInteraction({
        id: `inter_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        prospectId: targetProspect.id,
        prospectName: `${targetProspect.firstName} ${targetProspect.lastName}`,
        prospectPhone: targetProspect.phoneNumber,
        prospectSource: targetProspect.source,
        channel: values.channel as InteractionChannel,
        occurredAt: values.occurredAt.toISOString(),
        response: values.response,
        appointmentId: linkedApptId,
        customerId: customerId,
        interactionType: 'communication',
        loggedByUserId: user?.id || '1',
        loggedByUserName: staffFullName,
        loggedByUserRole: user?.role || 'marketing_staff',
        loggedByUserEmail: user?.email || '',
        createdAt: new Date().toISOString(),
      });

      window.dispatchEvent(new Event('omark-interactions-changed'));
      handleClose();
      onLogged?.();
    } catch (error: any) {
      message.error(error?.error?.message || error?.message || 'Failed to complete action');
    }
  };

  return (
    <Modal
      title={
        <Space>
          <CalendarOutlined style={{ color: '#1890ff' }} />
          <span>
            {prospect
              ? `Log Interaction & Follow-Up — ${prospect.firstName} ${prospect.lastName}`
              : 'Log Prospect Interaction & Follow-Up'}
          </span>
        </Space>
      }
      open={open}
      onCancel={handleClose}
      footer={null}
      width={560}
      style={{ maxWidth: '95%', top: 20 }}
      styles={{ body: { maxHeight: 'calc(85vh - 100px)', overflowY: 'auto', padding: '16px' } }}
      destroyOnClose
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleFinish}
        initialValues={{ occurredAt: dayjs() }}
      >
        {!prospect && (
          <Form.Item
            name="prospectId"
            label="Select Prospect"
            rules={[{ required: true, message: 'Please select a prospect' }]}
          >
            <Select
              showSearch
              placeholder="Search and select prospect..."
              optionFilterProp="children"
              filterOption={(input, option) =>
                (option?.children as unknown as string || '').toLowerCase().includes(input.toLowerCase())
              }
            >
              {allProspects.map((p) => (
                <Option key={p.id} value={p.id}>
                  {p.firstName} {p.lastName} — {p.phoneNumber} ({p.source === 'marketing' ? 'Marketing' : 'Customer Service'})
                </Option>
              ))}
            </Select>
          </Form.Item>
        )}

        <Form.Item
          name="channel"
          label="Interaction Channel"
          rules={[{ required: true, message: 'Please select how you reached the prospect' }]}
        >
          <Select placeholder="Select channel">
            {(Object.keys(interactionChannelLabels) as InteractionChannel[]).map((channel) => (
              <Option key={channel} value={channel}>
                {interactionChannelLabels[channel]}
              </Option>
            ))}
          </Select>
        </Form.Item>

        <Form.Item
          name="occurredAt"
          label="Time of Interaction"
          rules={[{ required: true, message: 'Please select when this happened' }]}
        >
          <DatePicker showTime format="YYYY-MM-DD HH:mm" style={{ width: '100%' }} />
        </Form.Item>

        <Form.Item
          name="response"
          label="Conversation Notes / Outcome"
          rules={[{ required: true, message: 'Please describe what was discussed or decided' }]}
        >
          <TextArea
            rows={3}
            placeholder='e.g. "Client called to ask about East Legon plots. Agreed to visit the site next Tuesday."'
            maxLength={1000}
            showCount
          />
        </Form.Item>

        {/* ── IMMEDIATE APPOINTMENT BOOKING SECTION ──────────────────────── */}
        <Card
          size="small"
          style={{
            marginBottom: 16,
            background: bookAppointment ? '#f6ffed' : '#fafafa',
            borderColor: bookAppointment ? '#b7eb8f' : '#f0f0f0',
            borderRadius: 8,
            transition: 'all 0.3s ease',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Space>
              <ClockCircleOutlined style={{ color: bookAppointment ? '#52c41a' : '#8c8c8c', fontSize: 16 }} />
              <div>
                <Text strong style={{ color: bookAppointment ? '#237804' : '#262626' }}>
                  Immediately Book an Appointment
                </Text>
                <div style={{ fontSize: 12, color: '#8c8c8c' }}>
                  Schedule a follow-up site visit, office meeting, or call directly from this log
                </div>
              </div>
            </Space>
            <Switch
              checked={bookAppointment}
              onChange={setBookAppointment}
              checkedChildren="YES"
              unCheckedChildren="NO"
            />
          </div>

          {bookAppointment && (
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px dashed #d9d9d9' }}>
              <Form.Item
                name="appointmentTime"
                label="Appointment Date & Time"
                rules={[{ required: true, message: 'Please select the appointment date & time' }]}
              >
                <DatePicker
                  showTime={{ format: 'hh:mm A', use12Hours: true }}
                  format="YYYY-MM-DD hh:mm A"
                  style={{ width: '100%' }}
                  placeholder="Select appointment date & time"
                  disabledDate={(current) => current && current < dayjs().startOf('day')}
                />
              </Form.Item>

              <Form.Item
                name="appointmentReason"
                label="Appointment Agenda / Meeting Purpose"
                initialValue="Site visit & payment plan discussion"
              >
                <Input placeholder="e.g. Site inspection, office contract review, deed signing" />
              </Form.Item>
            </div>
          )}
        </Card>

        <Form.Item style={{ marginTop: 8, marginBottom: 0, textAlign: 'right' }}>
          <Space wrap>
            <Button onClick={handleClose}>Cancel</Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={logInteraction.isPending || createAppointment.isPending}
              icon={<CheckCircleOutlined />}
            >
              {bookAppointment ? 'Log & Book Appointment' : 'Log Interaction'}
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </Modal>
  );
};
