// src/utils/portalAuth.ts
import { findCachedCustomerByPhone, type CachedCustomerRecord } from '@/utils/customerPortalCache';

const PORTAL_SESSION_KEY = 'omark_portal_session_customer_id';

export const getPortalSessionCustomerId = (): string | null => {
  return localStorage.getItem(PORTAL_SESSION_KEY) || localStorage.getItem('portal_customer_id');
};

export const setPortalSessionCustomerId = (customerId: string) => {
  localStorage.setItem(PORTAL_SESSION_KEY, customerId);
  localStorage.setItem('portal_customer_id', customerId);
};

export const clearPortalSession = () => {
  localStorage.removeItem(PORTAL_SESSION_KEY);
  localStorage.removeItem('portal_customer_id');
};

export const findCustomerForPortal = (phone: string): CachedCustomerRecord | undefined => {
  return findCachedCustomerByPhone(phone);
};
