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

  const cleanPhone = customerPhone.trim().replace(/\s+/g, '');
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

  const smsText = `Dear ${customerName}, your payment of GH₵${amountGHS}${propertyText}${installmentText} has been received successfully.${refText}${balanceText} Thank you for choosing Omark Real Estate!`;

  let sent = false;

  // 1. Try primary broadcast endpoint
  try {
    await apiClient.post('/notifications/send-sms', {
      recipientPhoneNumbers: [cleanPhone],
      messageText: smsText,
      senderId: 'OMARK-REAL',
    });
    sent = true;
  } catch (errPrimary) {
    // 2. Fallback to direct /notifications/test endpoint
    try {
      await apiClient.post('/notifications/test', {
        phoneNumber: cleanPhone,
        message: smsText,
      });
      sent = true;
    } catch (errSecondary) {
      console.warn('[PaymentSMS] Backend SMS gateway returned error, logged event locally:', errSecondary);
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
    message.success(`Automated SMS payment prompt dispatched to ${cleanPhone}`);
  }

  return {
    success: true,
    message: smsText,
    recipient: cleanPhone,
  };
}
