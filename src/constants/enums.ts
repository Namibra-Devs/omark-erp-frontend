// src/constants/enums.ts
import type { 
  Role, ProspectSource, ProspectStatus, InteractionChannel, 
  AppointmentSource, AppointmentStatus, CustomerType, 
  PaymentPlanStatus, PaymentMethod, ProgressBand, 
  NotificationType, NotificationStatus 
} from '@/types';

export const roleLabels: Record<Role, string> = {
  admin: 'Administrator',
  marketing_staff: 'Marketing Staff',
  marketing_director: 'Marketing Director',
  customer_service: 'Customer Service',
  secretary: 'Secretary',
  accounts: 'Accounts',
};

export const prospectSourceLabels: Record<ProspectSource, string> = {
  marketing: 'Marketing',
  customer_service: 'Customer Service',
};

export const prospectStatusLabels: Record<ProspectStatus, string> = {
  new: 'New',
  meeting_scheduled: 'Meeting Scheduled',
  meeting_completed: 'Meeting Completed',
  suspended: 'Suspended',
  postponed: 'Postponed',
  canceled: 'Canceled',
  purchased: 'Purchased',
};

export const prospectStatusColors: Record<ProspectStatus, string> = {
  new: 'blue',
  meeting_scheduled: 'cyan',
  meeting_completed: 'green',
  suspended: 'orange',
  postponed: 'gold',
  canceled: 'red',
  purchased: 'purple',
};

export const interactionChannelLabels: Record<InteractionChannel, string> = {
  call: 'Call',
  sms: 'SMS',
  whatsapp: 'WhatsApp',
  in_person: 'In Person',
  email: 'Email',
  social_media: 'Social Media',
  other: 'Other',
};

export const appointmentSourceLabels: Record<AppointmentSource, string> = {
  staff: 'Staff Created',
  website: 'Website Booking',
};

export const appointmentStatusLabels: Record<AppointmentStatus, string> = {
  scheduled: 'Scheduled',
  completed: 'Completed',
  canceled: 'Canceled',
  no_show: 'No Show',
};

export const appointmentStatusColors: Record<AppointmentStatus, string> = {
  scheduled: 'blue',
  completed: 'green',
  canceled: 'red',
  no_show: 'orange',
};

export const customerTypeLabels: Record<CustomerType, string> = {
  payment_plan: 'Payment Plan',
  fully_paid: 'Fully Paid',
};

export const paymentPlanStatusLabels: Record<PaymentPlanStatus, string> = {
  active: 'Active',
  completed: 'Completed',
  defaulted: 'Defaulted',
  cancelled: 'Cancelled',
};

export const paymentPlanStatusColors: Record<PaymentPlanStatus, string> = {
  active: 'green',
  completed: 'blue',
  defaulted: 'red',
  cancelled: 'default',
};

export const paymentMethodLabels: Record<PaymentMethod, string> = {
  cash: 'Cash',
  bank_transfer: 'Bank Transfer',
  mobile_money: 'Mobile Money',
  cheque: 'Cheque',
  other: 'Other',
};

export const progressBandLabels: Record<ProgressBand, string> = {
  red: 'Starting Out',
  yellow: 'Making Progress',
  light_green: 'Nearly There',
  green: 'Almost/Fully Complete',
};

export const notificationTypeLabels: Record<NotificationType, string> = {
  contribution_due_soon: 'Due Soon',
  contribution_overdue: 'Overdue',
};

export const notificationStatusLabels: Record<NotificationStatus, string> = {
  pending: 'Pending',
  sent: 'Sent',
  failed: 'Failed',
};

export const notificationStatusColors: Record<NotificationStatus, string> = {
  pending: 'blue',
  sent: 'green',
  failed: 'red',
};