// src/mock/governance.ts
//
// ⚠️ PROTOTYPE / MOCK DATA — NOT BACKED BY A REAL API ⚠️
//
// Models the HQ/branch governance rules from the spec:
//   - Head office owns the master pricing and templates
//   - Branches handle daily operations
//   - Branch managers approve local activities within limits
//   - Head office approves major financial and legal actions
//   - All transactions are tagged by branch (see generateRecordCode in
//     src/mock/branches.ts)
//   - All documents and payroll records are branch-aware (payroll itself
//     lives in src/mock/payroll.ts)
//
// None of this exists on the real backend — no pricing-template endpoint,
// no approval-limit config. This file is sample data so the intended
// workflow can be demoed. Delete it and wire up real endpoints when they
// exist.

export interface PricingTemplate {
  id: string;
  code: string;
  propertyType: string;
  name: string;
  basePriceMinor: number;
  unit: string;
  updatedAt: string;
}

/** Owned by Head Office — branches can view but not edit these. */
export const mockPricingTemplates: PricingTemplate[] = [
  { id: 'price-1', code: 'HQ-PRICE-2026-001', propertyType: 'Residential Land', name: 'Standard Residential Plot', basePriceMinor: 45_000_00 * 100, unit: 'per plot', updatedAt: '2026-06-01' },
  { id: 'price-2', code: 'HQ-PRICE-2026-002', propertyType: 'Commercial Land', name: 'Standard Commercial Plot', basePriceMinor: 90_000_00 * 100, unit: 'per plot', updatedAt: '2026-06-01' },
  { id: 'price-3', code: 'HQ-PRICE-2026-003', propertyType: 'Apartment', name: '2-Bedroom Apartment Template', basePriceMinor: 350_000_00 * 100, unit: 'per unit', updatedAt: '2026-05-15' },
  { id: 'price-4', code: 'HQ-PRICE-2026-004', propertyType: 'Office Space', name: 'Office Suite Template', basePriceMinor: 6_500_00 * 100, unit: 'per sqm / yr', updatedAt: '2026-04-20' },
  { id: 'price-5', code: 'HQ-PRICE-2026-005', propertyType: 'Warehouse', name: 'Warehouse Bay Template', basePriceMinor: 12_000_00 * 100, unit: 'per sqm / yr', updatedAt: '2026-03-10' },
];

export interface ApprovalLimit {
  branchId: string;
  branchManagerName: string;
  /** Above this, an expense needs Head Office sign-off. `null` = HQ itself, no ceiling. */
  expenseApprovalLimitMinor: number | null;
  /** Above this, a document/invoice/deed needs Head Office sign-off. `null` = HQ itself. */
  documentApprovalLimitMinor: number | null;
}

export const mockApprovalLimits: ApprovalLimit[] = [
  { branchId: 'branch-accra-hq', branchManagerName: 'Kindo Original', expenseApprovalLimitMinor: null, documentApprovalLimitMinor: null },
  { branchId: 'branch-kumasi', branchManagerName: 'Ama Boateng', expenseApprovalLimitMinor: 5_000_00 * 100, documentApprovalLimitMinor: 10_000_00 * 100 },
  { branchId: 'branch-takoradi', branchManagerName: 'Kwesi Mensah', expenseApprovalLimitMinor: 3_000_00 * 100, documentApprovalLimitMinor: 8_000_00 * 100 },
  { branchId: 'branch-tamale', branchManagerName: 'Fatima Iddrisu', expenseApprovalLimitMinor: 2_000_00 * 100, documentApprovalLimitMinor: 6_000_00 * 100 },
];

export const getApprovalLimit = (branchId: string): ApprovalLimit =>
  mockApprovalLimits.find((a) => a.branchId === branchId) ?? {
    branchId,
    branchManagerName: 'Unassigned',
    expenseApprovalLimitMinor: 0,
    documentApprovalLimitMinor: 0,
  };

/** HQ owns final approval on its own branch, so it never needs escalation to itself. */
export const documentRequiresHQApproval = (branchId: string, amountMinor: number | undefined): boolean => {
  if (branchId === 'branch-accra-hq' || amountMinor === undefined) return false;
  const limit = getApprovalLimit(branchId).documentApprovalLimitMinor;
  return limit === null ? false : amountMinor > limit;
};

export const expenseRequiresHQApproval = (branchId: string, amountMinor: number): boolean => {
  if (branchId === 'branch-accra-hq') return false;
  const limit = getApprovalLimit(branchId).expenseApprovalLimitMinor;
  return limit === null ? false : amountMinor > limit;
};

