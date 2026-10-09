// src/utils/paymentNotificationService.ts
import apiClient from '@/api/client';
import { recordSystemEvent } from '@/utils/activityNotificationEngine';
import { message } from 'antd';

export interface PaymentReceiptSMSParams {
  customerPhone?: string;
  customerName?: string;
  amountMinor: number;
  remainingBalanceMinor?: number;
  propertyName?: string;
  reference?: string;
  method?: string;
  installmentOrdinal?: string;
  recordedBy?: string;
}

export interface SendSMSResult {
  success: boolean;
  message: string;
  recipient?: string;
}

export function normalizePhoneNumber(phone: string): string {
  let cleaned = phone.trim().replace(/[\s\-\(\)]/g, '');
  if (cleaned.startsWith('0') && cleaned.length === 10) {
    cleaned = '+233' + cleaned.substring(1);
  } else if (!cleaned.startsWith('+') && cleaned.startsWith('233')) {
    cleaned = '+' + cleaned;
  }
  return cleaned;
}

/**
 * Automatically dispatches an SMS receipt to a customer whenever a payment is completed or recorded.
 */
export async function dispatchPaymentReceiptSMS(params: PaymentReceiptSMSParams): Promise<SendSMSResult> {
  const {
    customerPhone,
    customerName = 'Valued Customer',
    amountMinor,
    remainingBalanceMinor,
    propertyName,
    reference,
    method = 'bank_transfer',
    installmentOrdinal,
    recordedBy,
  } = params;

  if (!customerPhone || !customerPhone.trim()) {
    console.warn('[PaymentSMS] Customer phone number not provided. Skipping automatic SMS dispatch.');
    return {
      success: false,
      message: 'Customer phone number not available.',
    };
  }

  const cleanPhone = normalizePhoneNumber(customerPhone);
  const amountGHS = (amountMinor / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const balanceGHS = remainingBalanceMinor !== undefined
    ? (remainingBalanceMinor / 100).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : undefined;

  const installmentText = installmentOrdinal ? ` (${installmentOrdinal} installment)` : '';
  const refText = reference ? ` Ref: ${reference}.` : '';
  const balanceText = balanceGHS !== undefined ? ` Remaining Balance: GH₵${balanceGHS}.` : '';
  const propertyText = propertyName ? ` for ${propertyName}` : '';

  const smsText = `Dear ${customerName}, your payment of GH₵${amountGHS}${propertyText}${installmentText} has been received successfully.${refText}${balanceText} Thank you for choosing Omark Real Estate!`.trim();

  let sent = false;
  let deliveryError: string | null = null;

  // 1. Primary broadcast endpoint /notifications/send-sms
  try {
    const res = await apiClient.post('/notifications/send-sms', {
      audience: 'custom',
      message: smsText.slice(0, 480),
      messageText: smsText.slice(0, 480),
      phoneNumbers: [cleanPhone],
      recipientPhoneNumbers: [cleanPhone],
      recipients: [cleanPhone],
      senderId: 'OMARK ESTATES',
    });
    const resData = res.data?.data || res.data;
    if (resData && typeof resData.sent === 'number') {
      sent = resData.sent > 0;
      if (!sent && resData.failed > 0) {
        deliveryError = 'SMS provider could not deliver message to this number.';
      }
    } else {
      sent = true;
    }
  } catch (errPrimary: any) {
    const primaryMsg = errPrimary?.response?.data?.error?.message || errPrimary?.response?.data?.message || errPrimary?.message;
    console.warn('[PaymentSMS] Primary /notifications/send-sms returned error, attempting test route:', primaryMsg);

    // 2. Fallback to direct /notifications/test endpoint
    try {
      await apiClient.post('/notifications/test', {
        phoneNumber: cleanPhone,
        message: smsText.slice(0, 160),
      });
      sent = true;
    } catch (errSecondary: any) {
      deliveryError = primaryMsg || errSecondary?.response?.data?.message || errSecondary?.message || 'Gateway error';
      console.warn('[PaymentSMS] Backend SMS gateway returned error:', deliveryError);
    }
  }

  // Record in-app notification and audit trail regardless of gateway delivery status
  recordSystemEvent({
    title: `Payment Receipt SMS: GH₵${amountGHS}`,
    details: `Automated SMS prompt sent to ${customerName} (${cleanPhone})${refText} Amount: GH₵${amountGHS}. ${balanceText}`,
    category: 'payment',
    type: 'success',
    actorName: recordedBy || 'System',
    link: '/payment-plans',
    meta: {
      phone: cleanPhone,
      amountMinor,
      reference,
      method,
    },
  });

  if (sent) {
    message.success(`Automated SMS payment receipt dispatched to ${cleanPhone}`);
  } else if (deliveryError) {
    message.warning(`Payment recorded, but SMS could not be sent to ${cleanPhone} (${deliveryError})`);
  }

  return {
    success: sent,
    message: smsText,
    recipient: cleanPhone,
  };
}
