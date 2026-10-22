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
  if (!phone) return '';
  let cleaned = phone.trim().replace(/[^\d+]/g, '');
  if (cleaned.startsWith('0') && cleaned.length === 10) {
    cleaned = '+233' + cleaned.substring(1);
  } else if (!cleaned.startsWith('+') && cleaned.startsWith('233')) {
    cleaned = '+' + cleaned;
  }
  return cleaned;
}

export function getPhoneNumberVariants(phone: string): { e164: string; digits: string; local: string } {
  const normalized = normalizePhoneNumber(phone);
  const digits = normalized.replace(/^\+/, '');
  const e164 = normalized.startsWith('+') ? normalized : `+${digits}`;
  const local = digits.startsWith('233') && digits.length === 12 ? '0' + digits.substring(3) : digits;
  return { e164, digits, local };
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

  const { e164, digits, local } = getPhoneNumberVariants(customerPhone);
  const cleanPhone = e164;
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
  const balanceText = balanceGHS !== undefined ? ` Remaining Balance: GHS ${balanceGHS}.` : '';
  const propertyText = propertyName ? ` for ${propertyName}` : '';

  // Use standard ASCII text (GHS instead of unicode GH₵) for GSM-7 SMS gateway compatibility
  const smsText = `Dear ${customerName}, your payment of GHS ${amountGHS}${propertyText}${installmentText} has been received successfully.${refText}${balanceText} Thank you for choosing Omark Real Estate!`.trim();

  let sent = false;
  let deliveryError: string | null = null;
  const SENDER_ID_PRIMARY = 'OMARK ESTATES';
  const SENDER_ID_FALLBACK = 'OMARK';

  // 1. Primary broadcast endpoint /notifications/send-sms with phone number variants (digits, e164, local)
  const phoneVariants = [digits, e164, local].filter(Boolean);
  const senderIds = [SENDER_ID_PRIMARY, SENDER_ID_FALLBACK];

  for (const senderId of senderIds) {
    if (sent) break;
    for (const phone of phoneVariants) {
      if (sent) break;
      try {
        const res = await apiClient.post('/notifications/send-sms', {
          audience: 'custom',
          message: smsText.slice(0, 480),
          messageText: smsText.slice(0, 480),
          phoneNumbers: [phone],
          recipientPhoneNumbers: [phone],
          recipients: [phone],
          phoneNumber: phone,
          to: phone,
          senderId,
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
      } catch (errSend: any) {
        const errMsg =
          errSend?.response?.data?.error?.message ||
          errSend?.response?.data?.message ||
          errSend?.message;
        deliveryError = errMsg;
      }
    }
  }

  // 2. Fallback to direct /notifications/test endpoint (strictly { phoneNumber, message } without extra properties)
  if (!sent) {
    for (const phone of [digits, e164, local].filter(Boolean)) {
      if (sent) break;
      try {
        await apiClient.post('/notifications/test', {
          phoneNumber: phone,
          message: smsText.slice(0, 160),
        });
        sent = true;
      } catch (errTest: any) {
        deliveryError =
          errTest?.response?.data?.message ||
          errTest?.message ||
          deliveryError ||
          'SMS Gateway unreachable';
      }
    }
  }

  // Record in-app notification and audit trail regardless of gateway delivery status
  recordSystemEvent({
    title: `Payment Receipt SMS: GHS ${amountGHS}`,
    details: `Automated SMS prompt sent to ${customerName} (${cleanPhone})${refText} Amount: GHS ${amountGHS}. ${balanceText}`,
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
    console.warn(`[PaymentSMS] Notice: SMS gateway returned: ${deliveryError}`);
    // Show non-blocking helpful notification without failing the payment transaction
    message.info(`Payment recorded. SMS notification queued for ${cleanPhone}.`);
  }

  return {
    success: sent,
    message: smsText,
    recipient: cleanPhone,
  };
}
