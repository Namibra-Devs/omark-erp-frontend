// src/api/customerDocuments.ts
//
// React Query API hooks for Customer Documents & Portal Delivery
// Supports real-time upload, metadata editing, portal visibility toggling,
// and resilient local fallback with event synchronization.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient, { unwrapData, unwrapList, type ListResult } from '@/api/client';
import type { ApiResponse } from '@/types';
import { recordSystemEvent } from '@/utils/activityNotificationEngine';

export type CustomerDocumentCategory =
  | 'sales_agreement'
  | 'deed'
  | 'site_plan'
  | 'identity'
  | 'receipt'
  | 'offer_letter'
  | 'other';

export interface CustomerDocument {
  id: string;
  customerId: string;
  customerName?: string;
  title: string;
  category: CustomerDocumentCategory;
  fileName: string;
  fileSize: number; // in bytes
  fileType: string; // MIME type, e.g. application/pdf, image/jpeg
  fileUrl: string; // HTTPS URL or Base64 Data URI
  description?: string;
  uploadedByStaffId?: string;
  uploadedByStaffName?: string;
  uploadedAt: string; // ISO 8601 string
  visibleToCustomer: boolean;
  status: 'active' | 'archived';
  version?: number;
}

export interface CustomerDocumentsListParams {
  customerId?: string;
  category?: CustomerDocumentCategory | 'all';
  visibleToCustomerOnly?: boolean;
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface UploadCustomerDocumentPayload {
  customerId: string;
  customerName?: string;
  title: string;
  category: CustomerDocumentCategory;
  file: File;
  description?: string;
  visibleToCustomer?: boolean;
  uploadedByStaffId?: string;
  uploadedByStaffName?: string;
}

export interface UpdateCustomerDocumentPayload {
  title?: string;
  category?: CustomerDocumentCategory;
  description?: string;
  visibleToCustomer?: boolean;
  status?: 'active' | 'archived';
}

export const documentCategoryMeta: Record<
  CustomerDocumentCategory,
  { label: string; color: string; iconEmoji: string }
> = {
  sales_agreement: { label: 'Sales Agreement', color: 'blue', iconEmoji: '📄' },
  deed: { label: 'Deed of Assignment', color: 'purple', iconEmoji: '📑' },
  site_plan: { label: 'Cadastral Site Plan', color: 'geekblue', iconEmoji: '🗺️' },
  identity: { label: 'Identity Verification', color: 'cyan', iconEmoji: '🪪' },
  receipt: { label: 'Payment Receipt', color: 'green', iconEmoji: '🧾' },
  offer_letter: { label: 'Offer Letter', color: 'orange', iconEmoji: '✉️' },
  other: { label: 'General Document', color: 'default', iconEmoji: '📁' },
};

export const formatBytes = (bytes: number, decimals = 1): string => {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
};

export const downloadFile = (
  fileOrUrl: string | { fileUrl: string; fileName: string },
  maybeName?: string
): void => {
  try {
    const fileUrl = typeof fileOrUrl === 'string' ? fileOrUrl : fileOrUrl.fileUrl;
    const fileName =
      typeof fileOrUrl === 'string'
        ? maybeName || 'download'
        : fileOrUrl.fileName || maybeName || 'download';

    const link = document.createElement('a');
    link.href = fileUrl;
    link.download = fileName || 'download';
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (err) {
    console.error('Download failed:', err);
    const fileUrl = typeof fileOrUrl === 'string' ? fileOrUrl : fileOrUrl.fileUrl;
    window.open(fileUrl, '_blank');
  }
};

// ── Local Storage Store & Seed Data ─────────────────────────────────────────

const STORAGE_KEY = 'omark_customer_documents_store';

const SEED_DOCUMENTS: CustomerDocument[] = [
  {
    id: 'doc-seed-1',
    customerId: 'cust-kwesi-mensah',
    customerName: 'Kwesi Mensah',
    title: 'Final Executed Sales Agreement — Plot 42 East Legon Hills',
    category: 'sales_agreement',
    fileName: 'Executed_Sales_Agreement_Plot42.pdf',
    fileSize: 1420500, // ~1.4 MB
    fileType: 'application/pdf',
    fileUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
    description: 'Fully countersigned contract of sale with certified plot boundary schedule.',
    uploadedByStaffId: 'staff-legal-1',
    uploadedByStaffName: 'Legal & Deeds Team',
    uploadedAt: new Date(Date.now() - 86400000 * 5).toISOString(),
    visibleToCustomer: true,
    status: 'active',
  },
  {
    id: 'doc-seed-2',
    customerId: 'cust-kwesi-mensah',
    customerName: 'Kwesi Mensah',
    title: 'Certified Cadastral Site Plan & Lands Commission Barcode',
    category: 'site_plan',
    fileName: 'Certified_Cadastral_SitePlan_42EL.pdf',
    fileSize: 2840000, // ~2.8 MB
    fileType: 'application/pdf',
    fileUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
    description: 'Surveyor general registered cadastral survey with verified pillar coordinates.',
    uploadedByStaffId: 'staff-survey-1',
    uploadedByStaffName: 'Kwame Mensah (Survey Ops)',
    uploadedAt: new Date(Date.now() - 86400000 * 3).toISOString(),
    visibleToCustomer: true,
    status: 'active',
  },
  {
    id: 'doc-seed-3',
    customerId: 'cust-kwesi-mensah',
    customerName: 'Kwesi Mensah',
    title: 'Initial 30% Downpayment Official Receipt & Allocation Note',
    category: 'receipt',
    fileName: 'Official_Receipt_GHS150000.pdf',
    fileSize: 620000, // ~620 KB
    fileType: 'application/pdf',
    fileUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
    description: 'Official cashier stamp confirming wire receipt of initial deposit.',
    uploadedByStaffId: 'staff-accounts-1',
    uploadedByStaffName: 'Accounts Department',
    uploadedAt: new Date(Date.now() - 86400000 * 8).toISOString(),
    visibleToCustomer: true,
    status: 'active',
  },
];

export const getStoredCustomerDocuments = (): CustomerDocument[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED_DOCUMENTS));
      return SEED_DOCUMENTS;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : SEED_DOCUMENTS;
  } catch {
    return SEED_DOCUMENTS;
  }
};

export const saveStoredCustomerDocuments = (docs: CustomerDocument[]): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(docs));
    window.dispatchEvent(new CustomEvent('omark-customer-documents-changed'));
  } catch (err) {
    console.warn('Failed to save customer documents to storage:', err);
  }
};

// ── Query Keys ──────────────────────────────────────────────────────────────

export const customerDocumentsKeys = {
  all: ['customer-documents'] as const,
  lists: () => [...customerDocumentsKeys.all, 'list'] as const,
  list: (params?: CustomerDocumentsListParams) => [...customerDocumentsKeys.lists(), params ?? {}] as const,
  details: () => [...customerDocumentsKeys.all, 'detail'] as const,
  detail: (id: string) => [...customerDocumentsKeys.details(), id] as const,
};

// ── Query Hooks ─────────────────────────────────────────────────────────────

export function useCustomerDocumentsQuery(params?: CustomerDocumentsListParams) {
  return useQuery({
    queryKey: customerDocumentsKeys.list(params),
    queryFn: async (): Promise<ListResult<CustomerDocument>> => {
      let serverDocs: CustomerDocument[] = [];
      try {
        const url = params?.customerId ? `/customers/${params.customerId}/documents` : '/documents';
        const res = await apiClient.get<ApiResponse<CustomerDocument[]>>(url, { params });
        const list = unwrapList(res);
        serverDocs = Array.isArray(list) ? list : (list as any)?.items || [];
      } catch {
        // Fall back to local storage
      }

      const localDocs = getStoredCustomerDocuments();
      const map = new Map<string, CustomerDocument>();
      localDocs.forEach((d) => map.set(d.id, d));
      serverDocs.forEach((d) => map.set(d.id, d));

      let all = Array.from(map.values()).filter((d) => d.status !== 'archived');

      if (params?.customerId) {
        all = all.filter((d) => d.customerId === params.customerId);
      }

      if (params?.visibleToCustomerOnly) {
        all = all.filter((d) => d.visibleToCustomer !== false);
      }

      if (params?.category && params.category !== 'all') {
        all = all.filter((d) => d.category === params.category);
      }

      if (params?.search) {
        const q = params.search.toLowerCase();
        all = all.filter(
          (d) =>
            d.title.toLowerCase().includes(q) ||
            d.fileName.toLowerCase().includes(q) ||
            (d.description && d.description.toLowerCase().includes(q)) ||
            (d.customerName && d.customerName.toLowerCase().includes(q))
        );
      }

      // Sort newest first
      all.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());

      return {
        items: all,
        total: all.length,
        page: params?.page || 1,
        pageSize: params?.pageSize || 50,
        totalPages: Math.ceil(all.length / (params?.pageSize || 50)) || 1,
      };
    },
  });
}

export function useCustomerDocumentDetailQuery(id?: string) {
  return useQuery({
    queryKey: customerDocumentsKeys.detail(id ?? ''),
    queryFn: async () => {
      try {
        const res = await apiClient.get<ApiResponse<CustomerDocument>>(`/documents/${id}`);
        const data = unwrapData(res);
        if (data) return data;
      } catch {
        // fallback
      }
      const local = getStoredCustomerDocuments();
      return local.find((d) => d.id === id) || null;
    },
    enabled: Boolean(id),
  });
}

// ── Mutation Hooks ──────────────────────────────────────────────────────────

export function useUploadCustomerDocumentMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: UploadCustomerDocumentPayload): Promise<CustomerDocument> => {
      let fileUrl = '';
      let mimeType = payload.file.type || 'application/octet-stream';
      let sizeBytes = payload.file.size;
      let originalName = payload.file.name;

      // 1. Attempt server upload endpoint
      try {
        const formData = new FormData();
        formData.append('file', payload.file);
        formData.append('customerId', payload.customerId);
        formData.append('category', payload.category);
        formData.append('title', payload.title);

        const uploadRes = await apiClient.post<ApiResponse<any>>('/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        const uploadData = unwrapData(uploadRes);
        if (uploadData?.url) {
          fileUrl = uploadData.url;
        }
      } catch (err) {
        console.warn('Server file upload unavailable, converting to persistent client payload:', err);
      }

      // 2. Client-side Base64 fallback if server URL not provided
      if (!fileUrl) {
        fileUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(new Error('Failed to read file for storage'));
          reader.readAsDataURL(payload.file);
        });
      }

      const newDoc: CustomerDocument = {
        id: `cdoc-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        customerId: payload.customerId,
        customerName: payload.customerName,
        title: payload.title.trim(),
        category: payload.category,
        fileName: originalName,
        fileSize: sizeBytes,
        fileType: mimeType,
        fileUrl,
        description: payload.description?.trim(),
        uploadedByStaffId: payload.uploadedByStaffId,
        uploadedByStaffName: payload.uploadedByStaffName || 'Omark Real Estate Staff',
        uploadedAt: new Date().toISOString(),
        visibleToCustomer: payload.visibleToCustomer ?? true,
        status: 'active',
      };

      // 3. Attempt document record creation in backend
      try {
        const res = await apiClient.post<ApiResponse<CustomerDocument>>(`/customers/${payload.customerId}/documents`, newDoc);
        const serverData = unwrapData(res);
        if (serverData) {
          const existing = getStoredCustomerDocuments();
          saveStoredCustomerDocuments([serverData, ...existing]);
          return serverData;
        }
      } catch {
        // Fallback to local
      }

      const existing = getStoredCustomerDocuments();
      saveStoredCustomerDocuments([newDoc, ...existing]);
      return newDoc;
    },
    onSuccess: (newDoc) => {
      queryClient.invalidateQueries({ queryKey: customerDocumentsKeys.all });

      recordSystemEvent({
        title: 'Customer Document Uploaded',
        details: `${newDoc.title} (${documentCategoryMeta[newDoc.category]?.label || newDoc.category}) uploaded for ${newDoc.customerName || 'Customer'}${
          newDoc.visibleToCustomer ? ' and made available in Portal' : ' (Internal)'
        }`,
        category: 'deed',
        type: 'success',
        link: `/customers/${newDoc.customerId}`,
        refId: newDoc.id,
      });
    },
  });
}

export function useUpdateCustomerDocumentMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: UpdateCustomerDocumentPayload }) => {
      try {
        const res = await apiClient.patch<ApiResponse<CustomerDocument>>(`/documents/${id}`, payload);
        const serverData = unwrapData(res);
        if (serverData) {
          const existing = getStoredCustomerDocuments();
          saveStoredCustomerDocuments(existing.map((d) => (d.id === id ? serverData : d)));
          return serverData;
        }
      } catch {
        // Local fallback
      }

      const existing = getStoredCustomerDocuments();
      const updated = existing.map((d) => (d.id === id ? { ...d, ...payload } : d));
      saveStoredCustomerDocuments(updated);
      return updated.find((d) => d.id === id)!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: customerDocumentsKeys.all });
    },
  });
}

export function useDeleteCustomerDocumentMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      try {
        await apiClient.delete(`/documents/${id}`);
      } catch {
        // Local fallback
      }

      const existing = getStoredCustomerDocuments();
      const filtered = existing.filter((d) => d.id !== id);
      saveStoredCustomerDocuments(filtered);
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: customerDocumentsKeys.all });
    },
  });
}
