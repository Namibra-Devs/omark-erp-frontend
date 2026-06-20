
export type Role = 
  | 'admin' 
  | 'marketing_staff' 
  | 'marketing_director' 
  | 'customer_service' 
  | 'secretary' 
  | 'accounts';

export type ProspectSource = 'marketing' | 'customer_service';
export type ProspectStatus = 
  | 'new' 
  | 'meeting_scheduled' 
  | 'meeting_completed' 
  | 'suspended' 
  | 'postponed' 
  | 'canceled' 
  | 'purchased';
export type InteractionChannel = 
  | 'call' 
  | 'sms' 
  | 'whatsapp' 
  | 'in_person' 
  | 'email' 
  | 'social_media' 
  | 'other';
export type AppointmentSource = 'staff' | 'website';
export type AppointmentStatus = 'scheduled' | 'completed' | 'canceled' | 'no_show';
export type CustomerType = 'payment_plan' | 'fully_paid';
export type PaymentPlanStatus = 'active' | 'completed' | 'defaulted' | 'cancelled';
export type PaymentMethod = 'cash' | 'bank_transfer' | 'mobile_money' | 'cheque' | 'other';
export type ProgressBand = 'red' | 'yellow' | 'light_green' | 'green';
export type NotificationType = 'contribution_due_soon' | 'contribution_overdue';
export type NotificationStatus = 'pending' | 'sent' | 'failed';

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  role: Role;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Prospect {
  id: string;
  firstName: string;
  lastName: string;
  address: string;
  phoneNumber: string;
  source: ProspectSource;
  assignedUserId: string;
  status: ProspectStatus;
  reasonForContact: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Interaction {
  id: string;
  prospectId: string;
  channel: InteractionChannel;
  occurredAt: string;
  response: string;
  loggedByUserId: string;
  createdAt: string;
}

export interface Appointment {
  id: string;
  prospectId?: string;
  customerId?: string;
  source: AppointmentSource;
  scheduledFor: string;
  status: AppointmentStatus;
  feedback?: string;
  createdByUserId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Customer {
  id: string;
  prospectId: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  address: string;
  type: CustomerType;
  propertyId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Property {
  id: string;
  houseNumber: string;
  offerNumber: string;
  priceMinor: number;
  currency: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentPlan {
  id: string;
  customerId: string;
  propertyId: string;
  totalAmountMinor: number;
  downPaymentMinor: number;
  balanceMinor: number;
  numMonths: number;
  monthlyAmountMinor: number;
  currency: string;
  startDate: string;
  status: PaymentPlanStatus;
  progressPercent: number;
  progressBand: ProgressBand;
  createdAt: string;
  updatedAt: string;
}

export interface Installment {
  id: string;
  paymentPlanId: string;
  sequence: number;
  dueDate: string;
  expectedAmountMinor: number;
  isPaid: boolean;
  paidAt?: string;
}

export interface Payment {
  id: string;
  paymentPlanId: string;
  amountMinor: number;
  currency: string;
  paidOn: string;
  method: PaymentMethod;
  reference?: string;
  recordedByUserId: string;
  createdAt: string;
}

export interface Deed {
  id: string;
  customerId: string;
  propertyId: string;
  witnesses: { name: string; contact: string }[];
  businessContacts: string;
  documentUrl: string;
  generatedByUserId: string;
  generatedAt: string;
  createdAt: string;
}

export interface NotificationLog {
  id: string;
  customerId: string;
  phoneNumber: string;
  type: NotificationType;
  messageBody: string;
  status: NotificationStatus;
  providerMessageId?: string;
  sentAt?: string;
  createdAt: string;
}

export interface ApiResponse<T> {
  data: T;
  meta?: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: { field: string; message: string }[];
  };
}