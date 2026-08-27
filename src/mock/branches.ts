// src/mock/branches.ts
//
// ⚠️ PROTOTYPE / MOCK DATA — NOT BACKED BY A REAL API ⚠️
//
// The branch/multi-tenancy feature has no backend support yet: no
// endpoints, no `branchId` on any entity, no branch-aware auth. Everything
// in this file is static sample data so the intended UX can be built and
// demoed now. Every screen that reads from here must visibly say so (see
// <MockDataBanner /> in src/components/shared/MockDataBanner.tsx) — never
// let this data render indistinguishably from something real.
//
// When real branch endpoints exist, this whole file should be deleted and
// replaced with actual API hooks (src/api/branches.ts, following the same
// pattern as every other module in src/api/).
//
// Branch codes (HQ / KMA / TKD / TAM) are a guess at short abbreviations
// for the four sample branches below, following the pattern from the spec
// examples (KMA-SALE-2026-001, ACC-INV-2026-014, HQ-PAY-2026-003) — confirm
// the real code scheme with the business before this goes live.
//
// `propertyType` is also a prototype-only concept: the real Property model
// (src/api/properties.ts) has no type field at all today, so the list below
// is invented purely to make the "filter by property type" spec demoable.

export interface Branch {
  id: string;
  code: string;
  name: string;
  location: string;
  managerName: string;
  phone: string;
  staffCount: number;
  createdAt: string;
}

export interface BranchMetrics {
  branchId: string;
  salesThisMonth: number;
  revenueMinor: number;
  targetRevenueMinor: number;
  attendanceRatePercent: number;
  expensesMinor: number;
  projectProgressPercent: number;
  stockMovement: { in: number; out: number };
}

export interface TopStaffEntry {
  id: string;
  name: string;
  branchId: string;
  role: string;
  metric: string;
}

export interface BranchDepartment {
  id: string;
  name: string;
}

export const mockPropertyTypes: string[] = [
  'Residential Land',
  'Commercial Land',
  'Apartment',
  'Office Space',
  'Warehouse',
];

export interface BranchLead {
  id: string;
  branchId: string;
  code: string;
  name: string;
  phone: string;
  source: string;
  time: string;
  date: string;
  departmentId: string;
  handledBy: string;
}

export interface BranchAppointment {
  id: string;
  branchId: string;
  code: string;
  clientName: string;
  time: string;
  date: string;
  departmentId: string;
  handledBy: string;
  status: 'scheduled' | 'completed' | 'canceled';
}

export interface BranchPayment {
  id: string;
  branchId: string;
  code: string;
  customerName: string;
  amountMinor: number;
  method: string;
  time: string;
  date: string;
  departmentId: string;
  receivedBy: string;
  projectId?: string;
}

export interface BranchTask {
  id: string;
  branchId: string;
  title: string;
  assignee: string;
  dueDate: string;
  date: string;
  departmentId: string;
  priority: 'high' | 'medium' | 'low';
}

export interface BranchAttendanceEntry {
  id: string;
  branchId: string;
  staffName: string;
  status: 'present' | 'late' | 'absent' | 'on_leave';
  checkInTime?: string;
}

export interface BranchExpenseEntry {
  id: string;
  branchId: string;
  code: string;
  category: string;
  amountMinor: number;
  date: string;
  departmentId: string;
}

export interface BranchDocument {
  id: string;
  branchId: string;
  code: string;
  title: string;
  submittedBy: string;
  status: 'pending' | 'approved' | 'rejected';
  date: string;
  departmentId: string;
  propertyType: string;
  projectId?: string;
  amountMinor?: number;
}

export interface BranchProject {
  id: string;
  branchId: string;
  code: string;
  name: string;
  progressPercent: number;
  status: 'on_track' | 'at_risk' | 'delayed';
  dueDate: string;
  propertyType: string;
}

/** BRANCHCODE-TYPE-YEAR-### — e.g. KMA-SALE-2026-001 */
export const generateRecordCode = (branchCode: string, typeCode: string, sequence: number, year = new Date().getFullYear()): string =>
  `${branchCode}-${typeCode}-${year}-${String(sequence).padStart(3, '0')}`;

// Every branch-scoped transaction/record must carry its own `branchId` field
// (not just live inside a `{ [branchId]: T[] }` bucket) so it stays
// self-describing and logically separated from other branches' data even
// once flattened/queried outside that bucket. This derives it from the map
// key automatically, so the seed data below doesn't have to repeat it by
// hand on every single entry (and can't drift out of sync with its bucket).
const attachBranchId = <T>(map: Record<string, T[]>): Record<string, (T & { branchId: string })[]> =>
  Object.fromEntries(
    Object.entries(map).map(([branchId, items]) => [branchId, items.map((item) => ({ ...item, branchId }))])
  );

export const mockBranches: Branch[] = [
  {
    id: 'branch-accra-hq',
    code: 'HQ',
    name: 'Accra Head Office',
    location: 'Airport Residential Area, Accra',
    managerName: 'Kindo Original',
    phone: '+233 20 111 2222',
    staffCount: 18,
    createdAt: '2023-01-10T09:00:00.000Z',
  },
  {
    id: 'branch-kumasi',
    code: 'KMA',
    name: 'Kumasi Branch',
    location: 'Adum, Kumasi',
    managerName: 'Ama Boateng',
    phone: '+233 24 333 4444',
    staffCount: 9,
    createdAt: '2023-06-01T09:00:00.000Z',
  },
  {
    id: 'branch-takoradi',
    code: 'TKD',
    name: 'Takoradi Branch',
    location: 'Market Circle, Takoradi',
    managerName: 'Kwesi Mensah',
    phone: '+233 26 555 6666',
    staffCount: 6,
    createdAt: '2024-02-15T09:00:00.000Z',
  },
  {
    id: 'branch-tamale',
    code: 'TAM',
    name: 'Tamale Branch',
    location: 'Central Market, Tamale',
    managerName: 'Fatima Iddrisu',
    phone: '+233 27 777 8888',
    staffCount: 5,
    createdAt: '2024-09-20T09:00:00.000Z',
  },
];

export const mockBranchDepartments: BranchDepartment[] = [
  { id: 'dept-marketing', name: 'Marketing' },
  { id: 'dept-customer-service', name: 'Customer Service' },
  { id: 'dept-secretariat', name: 'Secretariat' },
  { id: 'dept-finance', name: 'Finance & Accounts' },
  { id: 'dept-admin', name: 'Administration' },
];

// One color per department, shared across every branch/head-office screen
// so the same department reads consistently everywhere it appears —
// item tags, breakdown tables, charts.
export const DEPARTMENT_COLOR: Record<string, string> = {
  'dept-marketing': 'blue',
  'dept-customer-service': 'cyan',
  'dept-secretariat': 'purple',
  'dept-finance': 'green',
  'dept-admin': 'orange',
};

export const departmentName = (departmentId: string): string =>
  mockBranchDepartments.find((d) => d.id === departmentId)?.name ?? departmentId;

export const mockBranchMetrics: Record<string, BranchMetrics> = {
  'branch-accra-hq': {
    branchId: 'branch-accra-hq',
    salesThisMonth: 34,
    revenueMinor: 48_500_00 * 100,
    targetRevenueMinor: 55_000_00 * 100,
    attendanceRatePercent: 96,
    expensesMinor: 6_200_00 * 100,
    projectProgressPercent: 72,
    stockMovement: { in: 120, out: 98 },
  },
  'branch-kumasi': {
    branchId: 'branch-kumasi',
    salesThisMonth: 19,
    revenueMinor: 22_100_00 * 100,
    targetRevenueMinor: 25_000_00 * 100,
    attendanceRatePercent: 91,
    expensesMinor: 3_400_00 * 100,
    projectProgressPercent: 58,
    stockMovement: { in: 64, out: 51 },
  },
  'branch-takoradi': {
    branchId: 'branch-takoradi',
    salesThisMonth: 8,
    revenueMinor: 9_800_00 * 100,
    targetRevenueMinor: 15_000_00 * 100,
    attendanceRatePercent: 84,
    expensesMinor: 2_100_00 * 100,
    projectProgressPercent: 34,
    stockMovement: { in: 30, out: 22 },
  },
  'branch-tamale': {
    branchId: 'branch-tamale',
    salesThisMonth: 5,
    revenueMinor: 5_600_00 * 100,
    targetRevenueMinor: 12_000_00 * 100,
    attendanceRatePercent: 79,
    expensesMinor: 1_500_00 * 100,
    projectProgressPercent: 21,
    stockMovement: { in: 18, out: 15 },
  },
};

export const mockTopStaff: TopStaffEntry[] = [
  { id: 'staff-1', name: 'Jawaad Ismael', branchId: 'branch-accra-hq', role: 'Marketing Staff', metric: '14 deals closed' },
  { id: 'staff-2', name: 'Ama Boateng', branchId: 'branch-kumasi', role: 'Branch Manager', metric: '9 deals closed' },
  { id: 'staff-3', name: 'Sarah Mensah', branchId: 'branch-accra-hq', role: 'Customer Service', metric: '98% response rate' },
  { id: 'staff-4', name: 'Kwesi Mensah', branchId: 'branch-takoradi', role: 'Branch Manager', metric: '6 deals closed' },
];

// ── Today's branch-level activity (sample) ──────────────────────────────
// Dates span the last few days (relative to a 2026-07-26 "today") so the
// date-range filter has something real to narrow down.

export const mockBranchLeads: Record<string, BranchLead[]> = attachBranchId<Omit<BranchLead, 'branchId'>>({
  'branch-accra-hq': [
    { id: 'lead-hq-1', code: generateRecordCode('HQ', 'LEAD', 1), name: 'Kwabena Owusu', phone: '+233 24 111 0001', source: 'Website', time: '08:42', date: '2026-07-26', departmentId: 'dept-marketing', handledBy: 'Jawaad Ismael' },
    { id: 'lead-hq-2', code: generateRecordCode('HQ', 'LEAD', 2), name: 'Efua Asante', phone: '+233 20 111 0002', source: 'Referral', time: '10:15', date: '2026-07-26', departmentId: 'dept-marketing', handledBy: 'Jawaad Ismael' },
    { id: 'lead-hq-3', code: generateRecordCode('HQ', 'LEAD', 3), name: 'Yaw Darko', phone: '+233 27 111 0003', source: 'Walk-in', time: '13:05', date: '2026-07-25', departmentId: 'dept-customer-service', handledBy: 'Sarah Mensah' },
  ],
  'branch-kumasi': [
    { id: 'lead-kma-1', code: generateRecordCode('KMA', 'LEAD', 1), name: 'Adwoa Frimpong', phone: '+233 24 222 0001', source: 'Referral', time: '09:20', date: '2026-07-26', departmentId: 'dept-marketing', handledBy: 'Ama Boateng' },
    { id: 'lead-kma-2', code: generateRecordCode('KMA', 'LEAD', 2), name: 'Kojo Antwi', phone: '+233 20 222 0002', source: 'Social Media', time: '11:47', date: '2026-07-24', departmentId: 'dept-marketing', handledBy: 'Ama Boateng' },
  ],
  'branch-takoradi': [
    { id: 'lead-tkd-1', code: generateRecordCode('TKD', 'LEAD', 1), name: 'Ama Quaye', phone: '+233 26 333 0001', source: 'Walk-in', time: '10:02', date: '2026-07-26', departmentId: 'dept-customer-service', handledBy: 'Efua Baiden' },
  ],
  'branch-tamale': [
    { id: 'lead-tam-1', code: generateRecordCode('TAM', 'LEAD', 1), name: 'Sulemana Abdul', phone: '+233 27 444 0001', source: 'Referral', time: '12:30', date: '2026-07-23', departmentId: 'dept-marketing', handledBy: 'Fatima Iddrisu' },
  ],
});

export const mockBranchAppointments: Record<string, BranchAppointment[]> = attachBranchId<Omit<BranchAppointment, 'branchId'>>({
  'branch-accra-hq': [
    { id: 'appt-hq-1', code: generateRecordCode('HQ', 'APPT', 1), clientName: 'Kwabena Owusu', time: '09:00', date: '2026-07-26', departmentId: 'dept-customer-service', handledBy: 'Sarah Mensah', status: 'completed' },
    { id: 'appt-hq-2', code: generateRecordCode('HQ', 'APPT', 2), clientName: 'Nana Yeboah', time: '14:30', date: '2026-07-26', departmentId: 'dept-customer-service', handledBy: 'Sarah Mensah', status: 'scheduled' },
    { id: 'appt-hq-3', code: generateRecordCode('HQ', 'APPT', 3), clientName: 'Abena Serwaa', time: '16:00', date: '2026-07-25', departmentId: 'dept-marketing', handledBy: 'Jawaad Ismael', status: 'scheduled' },
  ],
  'branch-kumasi': [
    { id: 'appt-kma-1', code: generateRecordCode('KMA', 'APPT', 1), clientName: 'Adwoa Frimpong', time: '11:00', date: '2026-07-26', departmentId: 'dept-marketing', handledBy: 'Ama Boateng', status: 'completed' },
    { id: 'appt-kma-2', code: generateRecordCode('KMA', 'APPT', 2), clientName: 'Yaw Boadi', time: '15:00', date: '2026-07-24', departmentId: 'dept-customer-service', handledBy: 'Yaw Boadi', status: 'scheduled' },
  ],
  'branch-takoradi': [
    { id: 'appt-tkd-1', code: generateRecordCode('TKD', 'APPT', 1), clientName: 'Ama Quaye', time: '10:30', date: '2026-07-26', departmentId: 'dept-customer-service', handledBy: 'Efua Baiden', status: 'scheduled' },
  ],
  'branch-tamale': [
    { id: 'appt-tam-1', code: generateRecordCode('TAM', 'APPT', 1), clientName: 'Sulemana Abdul', time: '13:00', date: '2026-07-23', departmentId: 'dept-marketing', handledBy: 'Fatima Iddrisu', status: 'canceled' },
  ],
});

export const mockBranchPayments: Record<string, BranchPayment[]> = attachBranchId<Omit<BranchPayment, 'branchId'>>({
  'branch-accra-hq': [
    { id: 'pay-hq-1', code: generateRecordCode('HQ', 'PAY', 3), customerName: 'John Mensah', amountMinor: 5_000_00 * 100, method: 'Bank Transfer', time: '09:12', date: '2026-07-26', departmentId: 'dept-finance', receivedBy: 'Kindo Original', projectId: 'proj-hq-1' },
    { id: 'pay-hq-2', code: generateRecordCode('HQ', 'PAY', 4), customerName: 'Grace Owusu', amountMinor: 1_200_00 * 100, method: 'Mobile Money', time: '11:40', date: '2026-07-25', departmentId: 'dept-finance', receivedBy: 'Kindo Original', projectId: 'proj-hq-2' },
  ],
  'branch-kumasi': [
    { id: 'pay-kma-1', code: generateRecordCode('KMA', 'PAY', 1), customerName: 'Kofi Asare', amountMinor: 2_500_00 * 100, method: 'Cash', time: '10:05', date: '2026-07-26', departmentId: 'dept-finance', receivedBy: 'Ama Boateng', projectId: 'proj-kma-1' },
  ],
  'branch-takoradi': [
    { id: 'pay-tkd-1', code: generateRecordCode('TKD', 'PAY', 1), customerName: 'Efua Baiden', amountMinor: 800_00 * 100, method: 'Mobile Money', time: '14:20', date: '2026-07-24', departmentId: 'dept-finance', receivedBy: 'Kwesi Mensah', projectId: 'proj-tkd-1' },
  ],
  'branch-tamale': [],
});

export const mockBranchTasks: Record<string, BranchTask[]> = attachBranchId<Omit<BranchTask, 'branchId'>>({
  'branch-accra-hq': [
    { id: 'task-hq-1', title: 'Follow up with 3 overdue payment plans', assignee: 'Sarah Mensah', dueDate: 'Today', date: '2026-07-26', departmentId: 'dept-customer-service', priority: 'high' },
    { id: 'task-hq-2', title: 'Prepare weekly revenue report', assignee: 'Kindo Original', dueDate: 'Tomorrow', date: '2026-07-27', departmentId: 'dept-finance', priority: 'medium' },
  ],
  'branch-kumasi': [
    { id: 'task-kma-1', title: 'Site visit for new property listing', assignee: 'Ama Boateng', dueDate: 'Today', date: '2026-07-26', departmentId: 'dept-marketing', priority: 'high' },
  ],
  'branch-takoradi': [
    { id: 'task-tkd-1', title: 'Submit expense receipts for June', assignee: 'Kwesi Mensah', dueDate: 'Overdue', date: '2026-07-22', departmentId: 'dept-finance', priority: 'high' },
    { id: 'task-tkd-2', title: 'Update staff attendance register', assignee: 'Kwesi Mensah', dueDate: 'Today', date: '2026-07-26', departmentId: 'dept-admin', priority: 'low' },
  ],
  'branch-tamale': [
    { id: 'task-tam-1', title: 'Onboard new customer service hire', assignee: 'Fatima Iddrisu', dueDate: 'This week', date: '2026-07-28', departmentId: 'dept-admin', priority: 'medium' },
  ],
});

export const mockBranchAttendance: Record<string, BranchAttendanceEntry[]> = attachBranchId<Omit<BranchAttendanceEntry, 'branchId'>>({
  'branch-accra-hq': [
    { id: 'att-hq-1', staffName: 'Kindo Original', status: 'present', checkInTime: '08:01' },
    { id: 'att-hq-2', staffName: 'Sarah Mensah', status: 'present', checkInTime: '08:10' },
    { id: 'att-hq-3', staffName: 'Jawaad Ismael', status: 'late', checkInTime: '09:24' },
    { id: 'att-hq-4', staffName: 'Nana Adjei', status: 'on_leave' },
  ],
  'branch-kumasi': [
    { id: 'att-kma-1', staffName: 'Ama Boateng', status: 'present', checkInTime: '07:55' },
    { id: 'att-kma-2', staffName: 'Yaw Boadi', status: 'present', checkInTime: '08:05' },
    { id: 'att-kma-3', staffName: 'Akosua Darko', status: 'absent' },
  ],
  'branch-takoradi': [
    { id: 'att-tkd-1', staffName: 'Kwesi Mensah', status: 'present', checkInTime: '08:15' },
    { id: 'att-tkd-2', staffName: 'Efua Baiden', status: 'late', checkInTime: '09:40' },
  ],
  'branch-tamale': [
    { id: 'att-tam-1', staffName: 'Fatima Iddrisu', status: 'present', checkInTime: '08:00' },
    { id: 'att-tam-2', staffName: 'Sulemana Abdul', status: 'absent' },
  ],
});

export const mockBranchExpenses: Record<string, BranchExpenseEntry[]> = attachBranchId<Omit<BranchExpenseEntry, 'branchId'>>({
  'branch-accra-hq': [
    { id: 'exp-hq-1', code: generateRecordCode('HQ', 'EXP', 1), category: 'Utilities', amountMinor: 1_800_00 * 100, date: '2026-07-26', departmentId: 'dept-finance' },
    { id: 'exp-hq-2', code: generateRecordCode('HQ', 'EXP', 2), category: 'Office Supplies', amountMinor: 640_00 * 100, date: '2026-07-25', departmentId: 'dept-admin' },
  ],
  'branch-kumasi': [
    { id: 'exp-kma-1', code: generateRecordCode('KMA', 'EXP', 1), category: 'Staff Transport', amountMinor: 350_00 * 100, date: '2026-07-26', departmentId: 'dept-admin' },
  ],
  'branch-takoradi': [
    { id: 'exp-tkd-1', code: generateRecordCode('TKD', 'EXP', 1), category: 'Utilities', amountMinor: 420_00 * 100, date: '2026-07-26', departmentId: 'dept-finance' },
  ],
  'branch-tamale': [
    { id: 'exp-tam-1', code: generateRecordCode('TAM', 'EXP', 1), category: 'Office Rent', amountMinor: 900_00 * 100, date: '2026-07-21', departmentId: 'dept-finance' },
  ],
});

export const mockBranchDocuments: Record<string, BranchDocument[]> = attachBranchId<Omit<BranchDocument, 'branchId'>>({
  'branch-accra-hq': [
    { id: 'doc-hq-1', code: generateRecordCode('HQ', 'INV', 14), title: 'Property invoice — Kwabena Owusu', submittedBy: 'Sarah Mensah', status: 'pending', date: '2026-07-26', departmentId: 'dept-finance', propertyType: 'Apartment', projectId: 'proj-hq-1', amountMinor: 5_000_00 * 100 },
    { id: 'doc-hq-2', code: generateRecordCode('HQ', 'DOC', 15), title: 'Deed of purchase — Grace Owusu', submittedBy: 'Kindo Original', status: 'pending', date: '2026-07-25', departmentId: 'dept-secretariat', propertyType: 'Residential Land', projectId: 'proj-hq-2', amountMinor: 62_000_00 * 100 },
  ],
  'branch-kumasi': [
    { id: 'doc-kma-1', code: generateRecordCode('KMA', 'INV', 3), title: 'Payment plan invoice — Kofi Asare', submittedBy: 'Ama Boateng', status: 'pending', date: '2026-07-26', departmentId: 'dept-finance', propertyType: 'Residential Land', projectId: 'proj-kma-1', amountMinor: 2_500_00 * 100 },
  ],
  'branch-takoradi': [
    { id: 'doc-tkd-1', code: generateRecordCode('TKD', 'DOC', 5), title: 'Expense approval — June receipts', submittedBy: 'Kwesi Mensah', status: 'pending', date: '2026-07-24', departmentId: 'dept-admin', propertyType: 'Commercial Land', projectId: 'proj-tkd-1', amountMinor: 420_00 * 100 },
  ],
  'branch-tamale': [
    { id: 'doc-tam-1', code: generateRecordCode('TAM', 'INV', 1), title: 'Deposit invoice — Sulemana Abdul', submittedBy: 'Fatima Iddrisu', status: 'pending', date: '2026-07-23', departmentId: 'dept-finance', propertyType: 'Warehouse', projectId: 'proj-tam-1', amountMinor: 15_000_00 * 100 },
  ],
});

export const mockBranchProjects: Record<string, BranchProject[]> = attachBranchId<Omit<BranchProject, 'branchId'>>({
  'branch-accra-hq': [
    { id: 'proj-hq-1', code: generateRecordCode('HQ', 'PROJ', 1), name: 'Airport Hills Phase 2', progressPercent: 72, status: 'on_track', dueDate: 'Dec 2026', propertyType: 'Apartment' },
    { id: 'proj-hq-2', code: generateRecordCode('HQ', 'PROJ', 2), name: 'HQ Office Renovation', progressPercent: 40, status: 'at_risk', dueDate: 'Oct 2026', propertyType: 'Office Space' },
  ],
  'branch-kumasi': [
    { id: 'proj-kma-1', code: generateRecordCode('KMA', 'PROJ', 1), name: 'Adum Estate Expansion', progressPercent: 58, status: 'on_track', dueDate: 'Jan 2027', propertyType: 'Residential Land' },
  ],
  'branch-takoradi': [
    { id: 'proj-tkd-1', code: generateRecordCode('TKD', 'PROJ', 1), name: 'Market Circle Showroom', progressPercent: 34, status: 'delayed', dueDate: 'Sep 2026', propertyType: 'Commercial Land' },
  ],
  'branch-tamale': [
    { id: 'proj-tam-1', code: generateRecordCode('TAM', 'PROJ', 1), name: 'Tamale Branch Fit-out', progressPercent: 21, status: 'at_risk', dueDate: 'Nov 2026', propertyType: 'Warehouse' },
  ],
});

export const getBranchMetrics = (branchId: string): BranchMetrics =>
  mockBranchMetrics[branchId] ?? {
    branchId,
    salesThisMonth: 0,
    revenueMinor: 0,
    targetRevenueMinor: 0,
    attendanceRatePercent: 0,
    expensesMinor: 0,
    projectProgressPercent: 0,
    stockMovement: { in: 0, out: 0 },
  };

export const getAllBranchMetrics = (): BranchMetrics[] => mockBranches.map((b) => getBranchMetrics(b.id));

export const getUnderperformingBranches = (): Branch[] => {
  return mockBranches.filter((b) => {
    const m = getBranchMetrics(b.id);
    return m.targetRevenueMinor > 0 && m.revenueMinor / m.targetRevenueMinor < 0.75;
  });
};

export const getBranchLeads = (branchId: string): BranchLead[] => mockBranchLeads[branchId] ?? [];
export const getBranchAppointments = (branchId: string): BranchAppointment[] => mockBranchAppointments[branchId] ?? [];
export const getBranchPayments = (branchId: string): BranchPayment[] => mockBranchPayments[branchId] ?? [];
export const getBranchTasks = (branchId: string): BranchTask[] => mockBranchTasks[branchId] ?? [];
export const getBranchAttendance = (branchId: string): BranchAttendanceEntry[] => mockBranchAttendance[branchId] ?? [];
export const getBranchExpenseEntries = (branchId: string): BranchExpenseEntry[] => mockBranchExpenses[branchId] ?? [];
export const getBranchDocuments = (branchId: string): BranchDocument[] => mockBranchDocuments[branchId] ?? [];
export const getBranchProjects = (branchId: string): BranchProject[] => mockBranchProjects[branchId] ?? [];

/** All staff names known to the prototype, for the "user" filter dropdown. */
export const getAllBranchUsers = (): { name: string; branchId: string }[] => {
  const names = new Map<string, string>();
  mockBranches.forEach((b) => names.set(b.managerName, b.id));
  mockTopStaff.forEach((s) => names.set(s.name, s.branchId));
  Object.entries(mockBranchAttendance).forEach(([branchId, entries]) => {
    entries.forEach((e) => names.set(e.staffName, branchId));
  });
  return Array.from(names.entries()).map(([name, branchId]) => ({ name, branchId }));
};

/** All projects across branches, for the "project" filter dropdown. */
export const getAllBranchProjects = (): BranchProject[] =>
  mockBranches.flatMap((b) => getBranchProjects(b.id));
