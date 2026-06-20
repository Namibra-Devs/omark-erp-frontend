// src/components/shared/StatusTag.tsx
import React from 'react';
import { Tag } from 'antd';
import {
  prospectStatusLabels,
  prospectStatusColors,
  appointmentStatusLabels,
  appointmentStatusColors,
  paymentPlanStatusLabels,
  paymentPlanStatusColors,
  notificationStatusLabels,
  notificationStatusColors,
} from '@/constants/enums';

interface StatusTagProps {
  status: string;
  type?: 'prospect' | 'appointment' | 'paymentPlan' | 'notification';
}

export const StatusTag: React.FC<StatusTagProps> = ({ status, type = 'prospect' }) => {
  let label: string;
  let color: string;

  switch (type) {
    case 'appointment':
      label = appointmentStatusLabels[status as keyof typeof appointmentStatusLabels] || status;
      color = appointmentStatusColors[status as keyof typeof appointmentStatusColors] || 'default';
      break;
    case 'paymentPlan':
      label = paymentPlanStatusLabels[status as keyof typeof paymentPlanStatusLabels] || status;
      color = paymentPlanStatusColors[status as keyof typeof paymentPlanStatusColors] || 'default';
      break;
    case 'notification':
      label = notificationStatusLabels[status as keyof typeof notificationStatusLabels] || status;
      color = notificationStatusColors[status as keyof typeof notificationStatusColors] || 'default';
      break;
    default:
      label = prospectStatusLabels[status as keyof typeof prospectStatusLabels] || status;
      color = prospectStatusColors[status as keyof typeof prospectStatusColors] || 'default';
  }

  return <Tag color={color}>{label}</Tag>;
};