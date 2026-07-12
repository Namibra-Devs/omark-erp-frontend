// src/components/shared/LogInteractionModal.tsx
// "After each call, the marketer notes what happened... so nothing is ever
// forgotten and any colleague can pick up where another left off."
// POST /prospects/{prospectId}/interactions — shared by marketing and
// customer service prospect screens.
import React from 'react';
import { Modal, Form, Select, DatePicker, Input, Button, Space, message } from 'antd';
import dayjs from 'dayjs';
import { useLogInteractionMutation } from '@/api/prospects';
import { interactionChannelLabels } from '@/constants/enums';
import type { Prospect, InteractionChannel } from '@/types';

const { Option } = Select;
const { TextArea } = Input;

interface LogInteractionModalProps {
  open: boolean;
  prospect: Prospect | null;
  onClose: () => void;
  onLogged?: () => void;
}

export const LogInteractionModal: React.FC<LogInteractionModalProps> = ({
  open,
  prospect,
  onClose,
  onLogged,
}) => {
  const [form] = Form.useForm();
  const logInteraction = useLogInteractionMutation();

  const handleClose = () => {
    form.resetFields();
    onClose();
  };

  const handleFinish = async (values: { channel: InteractionChannel; occurredAt: dayjs.Dayjs; response: string }) => {
    if (!prospect) return;
    try {
      await logInteraction.mutateAsync({
        prospectId: prospect.id,
        channel: values.channel,
        occurredAt: values.occurredAt.toISOString(),
        response: values.response,
      });
      message.success('Interaction logged!');
      handleClose();
      onLogged?.();
    } catch (error: any) {
      message.error(error?.error?.message || error?.message || 'Failed to log interaction');
    }
  };

  if (!prospect) return null;

  return (
    <Modal
      title={`Log Interaction — ${prospect.firstName} ${prospect.lastName}`}
      open={open}
      onCancel={handleClose}
      footer={null}
      width={500}
      style={{ maxWidth: '95%', top: 20 }}
      bodyStyle={{ padding: '16px' }}
      destroyOnClose
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleFinish}
        initialValues={{ occurredAt: dayjs() }}
      >
        <Form.Item
          name="channel"
          label="Channel"
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
          label="When"
          rules={[{ required: true, message: 'Please select when this happened' }]}
        >
          <DatePicker showTime format="YYYY-MM-DD HH:mm" style={{ width: '100%' }} />
        </Form.Item>

        <Form.Item
          name="response"
          label="What happened"
          rules={[{ required: true, message: 'Please describe what happened' }]}
        >
          <TextArea
            rows={4}
            placeholder='e.g. "Monday he will come to the office"'
            maxLength={1000}
            showCount
          />
        </Form.Item>

        <Form.Item style={{ marginTop: 8 }}>
          <Space wrap>
            <Button type="primary" htmlType="submit" loading={logInteraction.isPending}>
              Log Interaction
            </Button>
            <Button onClick={handleClose}>Cancel</Button>
          </Space>
        </Form.Item>
      </Form>
    </Modal>
  );
};
