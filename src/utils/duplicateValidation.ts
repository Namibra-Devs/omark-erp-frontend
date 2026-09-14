// src/utils/duplicateValidation.ts
/**
 * System-Wide Duplicate Prevention & Rejection Engine
 *
 * Enforces strict uniqueness constraints across customers, prospects, and staff users
 * for Phone Numbers / Contacts, Email Addresses, and Full Names.
 *
 * Provides:
 * 1. Normalizers for Ghana and international phone numbers, emails, and full names.
 * 2. Cross-entity conflict detection (Customers <-> Prospects <-> Users).
 * 3. TanStack Query cache inspection to check against live loaded state.
 * 4. Inline Ant Design form validation rules (flags fields red with conflict details as user types).
 * 5. Hard pre-submission assertion guards (prevents modal submission & API mutation).
 */

import type { QueryClient } from '@tanstack/react-query';
import type { Customer, Prospect } from '@/types';
import type { UserEntity } from '@/api/users';

// ── Normalization Utilities ────────────────────────────────────────────────

/**
 * Strips all non-digit characters from a phone string.
 */
export function extractPhoneDigits(phone?: string | null): string {
  if (!phone) return '';
  return String(phone).replace(/\D/g, '');
}

/**
 * Normalizes a phone number to a standard canonical format.
 * Intelligently handles Ghana formats:
 * - 0241234567 -> 233241234567
 * - +233241234567 -> 233241234567
 * - 00233241234567 -> 233241234567
 * - 241234567 (9 digits) -> 233241234567
 */
export function normalizePhone(phone?: string | null): string {
  const digits = extractPhoneDigits(phone);
  if (!digits) return '';

  // 00233...
  if (digits.startsWith('00233') && digits.length === 14) {
    return '233' + digits.slice(5);
  }
  // 233... (standard GH country code + 9 digits = 12 digits)
  if (digits.startsWith('233') && digits.length === 12) {
    return digits;
  }
  // 0... (standard GH local prefix + 9 digits = 10 digits)
  if (digits.startsWith('0') && digits.length === 10) {
    return '233' + digits.slice(1);
  }
  // 9 digits (local GH number without leading zero)
  if (digits.length === 9) {
    return '233' + digits;
  }

  return digits;
}

/**
 * Checks if two phone numbers refer to the same contact.
 * Compares canonical representations and last-9-digits suffixes for Ghana numbers.
 */
export function arePhonesDuplicate(phone1?: string | null, phone2?: string | null): boolean {
  if (!phone1 || !phone2) return false;

  const d1 = extractPhoneDigits(phone1);
  const d2 = extractPhoneDigits(phone2);

  // Require at least 7 digits to prevent false positives on partial input
  if (d1.length < 7 || d2.length < 7) return false;

  const n1 = normalizePhone(phone1);
  const n2 = normalizePhone(phone2);

  if (n1 && n2 && n1 === n2) return true;

  // Suffix matching for Ghana and international numbers (last 9 digits)
  if (d1.length >= 9 && d2.length >= 9) {
    const s1 = d1.slice(-9);
    const s2 = d2.slice(-9);
    if (s1 === s2) return true;
  }

  return false;
}

/**
 * Normalizes an email address: trimmed, lowercase.
 */
export function normalizeEmail(email?: string | null): string {
  if (!email) return '';
  return String(email).trim().toLowerCase();
}

/**
 * Checks if two emails match.
 */
export function areEmailsDuplicate(email1?: string | null, email2?: string | null): boolean {
  if (!email1 || !email2) return false;
  const e1 = normalizeEmail(email1);
  const e2 = normalizeEmail(email2);
  if (!e1 || !e2) return false;
  return e1 === e2;
}

/**
 * Normalizes a single name fragment (first, last, or combined).
 */
export function normalizeNameFragment(fragment?: string | null): string {
  if (!fragment) return '';
  return String(fragment).trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Checks if two full names are duplicate.
 * Catches exact matches, inverted orders (Kwame Mensah vs Mensah Kwame), and token sets.
 */
export function areNamesDuplicate(
  first1?: string | null,
  last1?: string | null,
  first2?: string | null,
  last2?: string | null
): boolean {
  const f1 = normalizeNameFragment(first1);
  const l1 = normalizeNameFragment(last1);
  const f2 = normalizeNameFragment(first2);
  const l2 = normalizeNameFragment(last2);

  // Must have at least one valid name string
  if ((!f1 && !l1) || (!f2 && !l2)) return false;

  const full1 = `${f1} ${l1}`.trim();
  const full2 = `${f2} ${l2}`.trim();

  // Exact full name match
  if (full1 && full2 && full1 === full2) return true;

  // Inverted name match (First/Last swapped)
  const inv1 = `${l1} ${f1}`.trim();
  if (inv1 && full2 && inv1 === full2) return true;

  // Token set matching (e.g. if multi-part names are rearranged)
  const tokens1 = full1.split(' ').filter(Boolean).sort();
  const tokens2 = full2.split(' ').filter(Boolean).sort();
  if (tokens1.length >= 2 && tokens1.length === tokens2.length) {
    if (tokens1.every((t, idx) => t === tokens2[idx])) {
      return true;
    }
  }

  return false;
}

// ── Conflict Definitions ───────────────────────────────────────────────────

export type ConflictTarget = 'customer' | 'prospect' | 'user';
export type ConflictField = 'phoneNumber' | 'email' | 'name';

export interface DuplicateConflict {
  field: ConflictField;
  target: ConflictTarget;
  matchedRecord: {
    id?: string;
    fullName: string;
    phoneNumber?: string;
    email?: string;
  };
  message: string;
}

// ── Query Cache Scraping ───────────────────────────────────────────────────

export function getCustomersFromCache(queryClient: QueryClient): Customer[] {
  const queries = queryClient.getQueriesData<any>({ queryKey: ['customers'] });
  const map = new Map<string, Customer>();

  for (const [, data] of queries) {
    if (!data) continue;
    if (Array.isArray(data)) {
      for (const item of data) {
        if (item && item.id) map.set(item.id, item);
      }
    } else if (data.items && Array.isArray(data.items)) {
      for (const item of data.items) {
        if (item && item.id) map.set(item.id, item);
      }
    }
  }

  return Array.from(map.values());
}

export function getProspectsFromCache(queryClient: QueryClient): Prospect[] {
  const queries = queryClient.getQueriesData<any>({ queryKey: ['prospects'] });
  const map = new Map<string, Prospect>();

  for (const [, data] of queries) {
    if (!data) continue;
    if (Array.isArray(data)) {
      for (const item of data) {
        if (item && item.id) map.set(item.id, item);
      }
    } else if (data.items && Array.isArray(data.items)) {
      for (const item of data.items) {
        if (item && item.id) map.set(item.id, item);
      }
    }
  }

  return Array.from(map.values());
}

export function getUsersFromCache(queryClient: QueryClient): UserEntity[] {
  const queries = queryClient.getQueriesData<any>({ queryKey: ['users'] });
  const map = new Map<string, UserEntity>();

  for (const [, data] of queries) {
    if (!data) continue;
    if (Array.isArray(data)) {
      for (const item of data) {
        if (item && item.id) map.set(item.id, item);
      }
    } else if (data.items && Array.isArray(data.items)) {
      for (const item of data.items) {
        if (item && item.id) map.set(item.id, item);
      }
    }
  }

  return Array.from(map.values());
}

// ── Conflict Checkers ──────────────────────────────────────────────────────

export interface CheckCustomerInput {
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  email?: string;
  excludeId?: string;
}

/**
 * Checks for duplicates when adding or updating a Customer.
 * Checks against existing customers (phone, name, email) and existing prospects (phone, email).
 */
export function checkCustomerConflicts(
  input: CheckCustomerInput,
  options: {
    existingCustomers?: Customer[];
    existingProspects?: Prospect[];
  }
): DuplicateConflict[] {
  const conflicts: DuplicateConflict[] = [];
  const { firstName, lastName, phoneNumber, email, excludeId } = input;
  const customers = options.existingCustomers || [];
  const prospects = options.existingProspects || [];

  // 1. Check against existing customers
  for (const c of customers) {
    if (excludeId && c.id === excludeId) continue;
    const cFullName = `${c.firstName || ''} ${c.lastName || ''}`.trim() || 'Unnamed Customer';

    // Phone duplicate check
    if (phoneNumber && c.phoneNumber && arePhonesDuplicate(phoneNumber, c.phoneNumber)) {
      conflicts.push({
        field: 'phoneNumber',
        target: 'customer',
        matchedRecord: {
          id: c.id,
          fullName: cFullName,
          phoneNumber: c.phoneNumber,
        },
        message: `A customer already exists with this phone number: ${cFullName} (${c.phoneNumber})`,
      });
    }

    // Name duplicate check
    if (firstName && lastName && c.firstName && c.lastName && areNamesDuplicate(firstName, lastName, c.firstName, c.lastName)) {
      conflicts.push({
        field: 'name',
        target: 'customer',
        matchedRecord: {
          id: c.id,
          fullName: cFullName,
          phoneNumber: c.phoneNumber,
        },
        message: `A customer already exists with the name "${cFullName}" (${c.phoneNumber || 'No phone'})`,
      });
    }

    // Email duplicate check (if both have email)
    if (email && (c as any).email && areEmailsDuplicate(email, (c as any).email)) {
      conflicts.push({
        field: 'email',
        target: 'customer',
        matchedRecord: {
          id: c.id,
          fullName: cFullName,
          email: (c as any).email,
        },
        message: `A customer already exists with this email: ${cFullName} (${(c as any).email})`,
      });
    }
  }

  // 2. Cross-check against existing prospects
  for (const p of prospects) {
    const pFullName = `${p.firstName || ''} ${p.lastName || ''}`.trim() || 'Unnamed Prospect';

    if (phoneNumber && p.phoneNumber && arePhonesDuplicate(phoneNumber, p.phoneNumber)) {
      conflicts.push({
        field: 'phoneNumber',
        target: 'prospect',
        matchedRecord: {
          id: p.id,
          fullName: pFullName,
          phoneNumber: p.phoneNumber,
        },
        message: `This phone number belongs to an existing prospect: ${pFullName} (${p.phoneNumber}). Use "Convert Prospect" instead of adding a duplicate.`,
      });
    }

    if (email && (p as any).email && areEmailsDuplicate(email, (p as any).email)) {
      conflicts.push({
        field: 'email',
        target: 'prospect',
        matchedRecord: {
          id: p.id,
          fullName: pFullName,
          email: (p as any).email,
        },
        message: `This email belongs to an existing prospect: ${pFullName} (${(p as any).email}).`,
      });
    }
  }

  return conflicts;
}

export interface CheckProspectInput {
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  email?: string;
  excludeId?: string;
}

/**
 * Checks for duplicates when adding or updating a Prospect.
 * Checks against existing prospects (phone, name, email) and existing customers (phone, email, name).
 */
export function checkProspectConflicts(
  input: CheckProspectInput,
  options: {
    existingProspects?: Prospect[];
    existingCustomers?: Customer[];
  }
): DuplicateConflict[] {
  const conflicts: DuplicateConflict[] = [];
  const { firstName, lastName, phoneNumber, email, excludeId } = input;
  const prospects = options.existingProspects || [];
  const customers = options.existingCustomers || [];

  // 1. Check against existing prospects
  for (const p of prospects) {
    if (excludeId && p.id === excludeId) continue;
    const pFullName = `${p.firstName || ''} ${p.lastName || ''}`.trim() || 'Unnamed Prospect';

    if (phoneNumber && p.phoneNumber && arePhonesDuplicate(phoneNumber, p.phoneNumber)) {
      conflicts.push({
        field: 'phoneNumber',
        target: 'prospect',
        matchedRecord: {
          id: p.id,
          fullName: pFullName,
          phoneNumber: p.phoneNumber,
        },
        message: `A prospect already exists with this phone number: ${pFullName} (${p.phoneNumber})`,
      });
    }

    if (firstName && lastName && p.firstName && p.lastName && areNamesDuplicate(firstName, lastName, p.firstName, p.lastName)) {
      conflicts.push({
        field: 'name',
        target: 'prospect',
        matchedRecord: {
          id: p.id,
          fullName: pFullName,
          phoneNumber: p.phoneNumber,
        },
        message: `A prospect already exists with the name "${pFullName}" (${p.phoneNumber || 'No phone'})`,
      });
    }

    if (email && (p as any).email && areEmailsDuplicate(email, (p as any).email)) {
      conflicts.push({
        field: 'email',
        target: 'prospect',
        matchedRecord: {
          id: p.id,
          fullName: pFullName,
          email: (p as any).email,
        },
        message: `A prospect already exists with this email: ${pFullName} (${(p as any).email})`,
      });
    }
  }

  // 2. Cross-check against existing customers
  for (const c of customers) {
    const cFullName = `${c.firstName || ''} ${c.lastName || ''}`.trim() || 'Unnamed Customer';

    if (phoneNumber && c.phoneNumber && arePhonesDuplicate(phoneNumber, c.phoneNumber)) {
      conflicts.push({
        field: 'phoneNumber',
        target: 'customer',
        matchedRecord: {
          id: c.id,
          fullName: cFullName,
          phoneNumber: c.phoneNumber,
        },
        message: `This contact is already registered as an active Customer: ${cFullName} (${c.phoneNumber}).`,
      });
    }

    if (email && (c as any).email && areEmailsDuplicate(email, (c as any).email)) {
      conflicts.push({
        field: 'email',
        target: 'customer',
        matchedRecord: {
          id: c.id,
          fullName: cFullName,
          email: (c as any).email,
        },
        message: `This email is already registered to an active Customer: ${cFullName} (${(c as any).email}).`,
      });
    }
  }

  return conflicts;
}

export interface CheckUserInput {
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  email?: string;
  excludeId?: string;
}

/**
 * Checks for duplicates when adding or updating a User/Staff member.
 */
export function checkUserConflicts(
  input: CheckUserInput,
  options: {
    existingUsers?: UserEntity[];
  }
): DuplicateConflict[] {
  const conflicts: DuplicateConflict[] = [];
  const { firstName, lastName, phoneNumber, email, excludeId } = input;
  const users = options.existingUsers || [];

  for (const u of users) {
    if (excludeId && u.id === excludeId) continue;
    const uFullName = `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.name || 'Staff Member';
    const userPhone = typeof u.phone === 'string' ? u.phone : u.phone?.number || u.phoneNumber;

    // Email duplicate check (Strict for users)
    if (email && u.email && areEmailsDuplicate(email, u.email)) {
      conflicts.push({
        field: 'email',
        target: 'user',
        matchedRecord: {
          id: u.id,
          fullName: uFullName,
          email: u.email,
        },
        message: `A staff account already exists with this email: ${uFullName} (${u.email})`,
      });
    }

    // Phone duplicate check
    if (phoneNumber && userPhone && arePhonesDuplicate(phoneNumber, userPhone)) {
      conflicts.push({
        field: 'phoneNumber',
        target: 'user',
        matchedRecord: {
          id: u.id,
          fullName: uFullName,
          phoneNumber: userPhone,
        },
        message: `A staff account already exists with this phone number: ${uFullName} (${userPhone})`,
      });
    }

    // Full name duplicate check
    if (firstName && lastName && u.firstName && u.lastName && areNamesDuplicate(firstName, lastName, u.firstName, u.lastName)) {
      conflicts.push({
        field: 'name',
        target: 'user',
        matchedRecord: {
          id: u.id,
          fullName: uFullName,
          email: u.email,
        },
        message: `A staff account already exists with the name "${uFullName}" (${u.email})`,
      });
    }
  }

  return conflicts;
}

// ── Hard Pre-Submission Assertion Guards ───────────────────────────────────

export class DuplicateRejectionError extends Error {
  public conflicts: DuplicateConflict[];
  constructor(conflicts: DuplicateConflict[]) {
    const summary = conflicts.map((c) => c.message).join(' | ');
    super(`Duplicate Rejected: ${summary}`);
    this.name = 'DuplicateRejectionError';
    this.conflicts = conflicts;
  }
}

export function assertNoCustomerDuplicates(
  input: CheckCustomerInput,
  options: { existingCustomers?: Customer[]; existingProspects?: Prospect[] }
): void {
  const conflicts = checkCustomerConflicts(input, options);
  if (conflicts.length > 0) {
    throw new DuplicateRejectionError(conflicts);
  }
}

export function assertNoProspectDuplicates(
  input: CheckProspectInput,
  options: { existingProspects?: Prospect[]; existingCustomers?: Customer[] }
): void {
  const conflicts = checkProspectConflicts(input, options);
  if (conflicts.length > 0) {
    throw new DuplicateRejectionError(conflicts);
  }
}

export function assertNoUserDuplicates(
  input: CheckUserInput,
  options: { existingUsers?: UserEntity[] }
): void {
  const conflicts = checkUserConflicts(input, options);
  if (conflicts.length > 0) {
    throw new DuplicateRejectionError(conflicts);
  }
}

// ── Inline Ant Design Validation Rule Creators ────────────────────────────

/**
 * Creates an Ant Design validator rule for phone number fields.
 * Validates in real time and highlights the input red with the conflict explanation.
 */
export function createDuplicatePhoneRule(options: {
  entityType: 'customer' | 'prospect' | 'user';
  getExistingCustomers?: () => Customer[];
  getExistingProspects?: () => Prospect[];
  getExistingUsers?: () => UserEntity[];
  excludeId?: string;
}) {
  return {
    validator: async (_: any, value: string) => {
      if (!value) return Promise.resolve();
      const digits = extractPhoneDigits(value);
      // Only check once user has entered at least 8 digits
      if (digits.length < 8) return Promise.resolve();

      if (options.entityType === 'customer') {
        const conflicts = checkCustomerConflicts(
          { phoneNumber: value, excludeId: options.excludeId },
          {
            existingCustomers: options.getExistingCustomers?.(),
            existingProspects: options.getExistingProspects?.(),
          }
        );
        const phoneConflict = conflicts.find((c) => c.field === 'phoneNumber');
        if (phoneConflict) {
          return Promise.reject(new Error(phoneConflict.message));
        }
      } else if (options.entityType === 'prospect') {
        const conflicts = checkProspectConflicts(
          { phoneNumber: value, excludeId: options.excludeId },
          {
            existingProspects: options.getExistingProspects?.(),
            existingCustomers: options.getExistingCustomers?.(),
          }
        );
        const phoneConflict = conflicts.find((c) => c.field === 'phoneNumber');
        if (phoneConflict) {
          return Promise.reject(new Error(phoneConflict.message));
        }
      } else if (options.entityType === 'user') {
        const conflicts = checkUserConflicts(
          { phoneNumber: value, excludeId: options.excludeId },
          {
            existingUsers: options.getExistingUsers?.(),
          }
        );
        const phoneConflict = conflicts.find((c) => c.field === 'phoneNumber');
        if (phoneConflict) {
          return Promise.reject(new Error(phoneConflict.message));
        }
      }

      return Promise.resolve();
    },
  };
}

/**
 * Creates an Ant Design validator rule for email fields.
 */
export function createDuplicateEmailRule(options: {
  entityType: 'customer' | 'prospect' | 'user';
  getExistingCustomers?: () => Customer[];
  getExistingProspects?: () => Prospect[];
  getExistingUsers?: () => UserEntity[];
  excludeId?: string;
}) {
  return {
    validator: async (_: any, value: string) => {
      if (!value || !value.trim()) return Promise.resolve();
      const trimmed = value.trim();
      if (!trimmed.includes('@') || trimmed.length < 5) return Promise.resolve();

      if (options.entityType === 'customer') {
        const conflicts = checkCustomerConflicts(
          { email: trimmed, excludeId: options.excludeId },
          {
            existingCustomers: options.getExistingCustomers?.(),
            existingProspects: options.getExistingProspects?.(),
          }
        );
        const emailConflict = conflicts.find((c) => c.field === 'email');
        if (emailConflict) {
          return Promise.reject(new Error(emailConflict.message));
        }
      } else if (options.entityType === 'prospect') {
        const conflicts = checkProspectConflicts(
          { email: trimmed, excludeId: options.excludeId },
          {
            existingProspects: options.getExistingProspects?.(),
            existingCustomers: options.getExistingCustomers?.(),
          }
        );
        const emailConflict = conflicts.find((c) => c.field === 'email');
        if (emailConflict) {
          return Promise.reject(new Error(emailConflict.message));
        }
      } else if (options.entityType === 'user') {
        const conflicts = checkUserConflicts(
          { email: trimmed, excludeId: options.excludeId },
          {
            existingUsers: options.getExistingUsers?.(),
          }
        );
        const emailConflict = conflicts.find((c) => c.field === 'email');
        if (emailConflict) {
          return Promise.reject(new Error(emailConflict.message));
        }
      }

      return Promise.resolve();
    },
  };
}

/**
 * Creates an Ant Design validator rule for first name or last name fields.
 * Re-validates when both name fields are populated.
 */
export function createDuplicateNameRule(options: {
  entityType: 'customer' | 'prospect' | 'user';
  isFirstName: boolean;
  getOtherName: () => string | undefined;
  getExistingCustomers?: () => Customer[];
  getExistingProspects?: () => Prospect[];
  getExistingUsers?: () => UserEntity[];
  excludeId?: string;
}) {
  return {
    validator: async (_: any, value: string) => {
      if (!value || !value.trim()) return Promise.resolve();
      const other = options.getOtherName();
      if (!other || !other.trim()) return Promise.resolve();

      const firstName = options.isFirstName ? value.trim() : other.trim();
      const lastName = options.isFirstName ? other.trim() : value.trim();

      if (options.entityType === 'customer') {
        const conflicts = checkCustomerConflicts(
          { firstName, lastName, excludeId: options.excludeId },
          {
            existingCustomers: options.getExistingCustomers?.(),
            existingProspects: options.getExistingProspects?.(),
          }
        );
        const nameConflict = conflicts.find((c) => c.field === 'name');
        if (nameConflict) {
          return Promise.reject(new Error(nameConflict.message));
        }
      } else if (options.entityType === 'prospect') {
        const conflicts = checkProspectConflicts(
          { firstName, lastName, excludeId: options.excludeId },
          {
            existingProspects: options.getExistingProspects?.(),
            existingCustomers: options.getExistingCustomers?.(),
          }
        );
        const nameConflict = conflicts.find((c) => c.field === 'name');
        if (nameConflict) {
          return Promise.reject(new Error(nameConflict.message));
        }
      } else if (options.entityType === 'user') {
        const conflicts = checkUserConflicts(
          { firstName, lastName, excludeId: options.excludeId },
          {
            existingUsers: options.getExistingUsers?.(),
          }
        );
        const nameConflict = conflicts.find((c) => c.field === 'name');
        if (nameConflict) {
          return Promise.reject(new Error(nameConflict.message));
        }
      }

      return Promise.resolve();
    },
  };
}
