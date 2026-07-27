// src/mock/portalAuth.ts
//
// ⚠️ PROTOTYPE — local-only, not a real authentication system. ⚠️
// The real API has no customer-facing auth endpoint at all (only staff
// roles can log in). This "activate with your phone number, then set a
// password" flow is entirely client-side: the password is compared in
// plain text against a localStorage record. It is good enough to demo the
// customer portal end to end, but must be replaced with a real customer
// auth endpoint (hashed passwords, server-issued session) before this ships.
import { findCachedCustomerByPhone, type CachedCustomerRecord } from '@/mock/customerPortalCache';

const ACCOUNTS_KEY = 'omark_mock_portal_accounts';
const SESSION_KEY = 'omark_mock_portal_session';

interface PortalAccount {
  customerId: string;
  phoneNumber: string;
  password: string;
  createdAt: string;
}

type AccountMap = Record<string, PortalAccount>;

const loadAccounts = (): AccountMap => {
  try {
    const raw = localStorage.getItem(ACCOUNTS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore malformed storage
  }
  return {};
};

const saveAccounts = (map: AccountMap) => localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(map));

export type PortalLookupResult =
  | { status: 'not_found' }
  | { status: 'needs_activation'; customer: CachedCustomerRecord }
  | { status: 'has_account'; customer: CachedCustomerRecord };

/** Step 1 of login: does this phone number match a cached customer, and do they have a portal password yet? */
export const lookupPortalCustomer = (phoneNumber: string): PortalLookupResult => {
  const customer = findCachedCustomerByPhone(phoneNumber);
  if (!customer) return { status: 'not_found' };
  const account = loadAccounts()[customer.id];
  return account ? { status: 'has_account', customer } : { status: 'needs_activation', customer };
};

export const activatePortalAccount = (customer: CachedCustomerRecord, password: string) => {
  const accounts = loadAccounts();
  accounts[customer.id] = {
    customerId: customer.id,
    phoneNumber: customer.phoneNumber,
    password,
    createdAt: new Date().toISOString(),
  };
  saveAccounts(accounts);
  localStorage.setItem(SESSION_KEY, customer.id);
};

export const verifyPortalPassword = (customerId: string, password: string): boolean => {
  const account = loadAccounts()[customerId];
  if (!account) return false;
  const ok = account.password === password;
  if (ok) localStorage.setItem(SESSION_KEY, customerId);
  return ok;
};

export const getPortalSessionCustomerId = (): string | null => localStorage.getItem(SESSION_KEY);

export const clearPortalSession = () => localStorage.removeItem(SESSION_KEY);
