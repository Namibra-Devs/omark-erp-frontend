// src/utils/marketingCampaignsStorage.ts
import dayjs from 'dayjs';
import type { Prospect } from '@/types';

export type MarketingChannel =
  | 'billboard'
  | 'social_media'
  | 'property_expo'
  | 'search_ads'
  | 'radio_tv'
  | 'print_flyer'
  | 'referral';

export type CampaignStatus = 'active' | 'upcoming' | 'completed' | 'paused';
export type TaskPriority = 'urgent' | 'high' | 'medium' | 'low';
export type TaskStatus = 'pending' | 'in_progress' | 'completed';

export interface MarketingCampaign {
  id: string;
  name: string;
  channel: MarketingChannel;
  channelLabel: string;
  status: CampaignStatus;
  budgetGHS: number;
  spendGHS: number;
  startDate: string;
  endDate: string;
  leadsAcquired: number;
  conversions: number;
  conversionRate: number; // percentage, e.g. 16.5
  cplGHS: number; // cost per lead in GHS
  targetAudience: string;
  targetLocation: string;
  branchId?: string;
  branchName?: string;
  description?: string;
  assignedLeadId?: string;
  assignedLeadName?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface MarketingTask {
  id: string;
  title: string;
  description: string;
  assignedStaffId: string;
  assignedStaffName: string;
  assignedStaffRole: string;
  priority: TaskPriority;
  status: TaskStatus;
  dueDate: string;
  progressPercent: number;
  campaignId?: string;
  campaignName?: string;
  createdAt: string;
  completedAt?: string;
}

export const CAMPAIGNS_STORAGE_KEY = 'omark_marketing_campaigns_store';
export const TASKS_STORAGE_KEY = 'omark_marketing_tasks_store';

export const CHANNEL_CONFIG: Record<
  MarketingChannel,
  { label: string; color: string; bg: string; icon: string }
> = {
  billboard: { label: 'Mega-Billboard & Outdoor', color: '#fa8c16', bg: '#fff7e6', icon: '🌆' },
  social_media: { label: 'Social Media & Reels', color: '#1890ff', bg: '#e6f7ff', icon: '📱' },
  property_expo: { label: 'Property Expo & Roadshow', color: '#722ed1', bg: '#f9f0ff', icon: '🏛️' },
  search_ads: { label: 'Google Search & SEO Ads', color: '#52c41a', bg: '#f6ffed', icon: '🔍' },
  radio_tv: { label: 'Radio & Media Broadcast', color: '#eb2f96', bg: '#fff0f6', icon: '📻' },
  print_flyer: { label: 'Brochures & Print Media', color: '#13c2c2', bg: '#e6fffb', icon: '📑' },
  referral: { label: 'Client Referral Program', color: '#faad14', bg: '#fffbe6', icon: '🤝' },
};

export const DEFAULT_CAMPAIGNS: MarketingCampaign[] = [
  {
    id: 'camp-001',
    name: 'Airport Bypass Highway LED Mega-Billboard',
    channel: 'billboard',
    channelLabel: 'Mega-Billboard & Outdoor',
    status: 'active',
    budgetGHS: 25000,
    spendGHS: 18500,
    startDate: dayjs().subtract(45, 'day').format('YYYY-MM-DD'),
    endDate: dayjs().add(45, 'day').format('YYYY-MM-DD'),
    leadsAcquired: 86,
    conversions: 14,
    conversionRate: 16.3,
    cplGHS: 215.12,
    targetAudience: 'High-Net-Worth Diaspora & Airport Commuters',
    targetLocation: 'Airport Residential / Spintex Expressway, Accra',
    branchName: 'Accra Central',
    description: 'Double-sided illuminated mega-billboard showcasing prime gated communities with title deeds.',
    createdAt: dayjs().subtract(45, 'day').toISOString(),
  },
  {
    id: 'camp-002',
    name: 'Q4 Diaspora Property Expo & Virtual Roadshow',
    channel: 'property_expo',
    channelLabel: 'Property Expo & Roadshow',
    status: 'active',
    budgetGHS: 20000,
    spendGHS: 14200,
    startDate: dayjs().subtract(20, 'day').format('YYYY-MM-DD'),
    endDate: dayjs().add(25, 'day').format('YYYY-MM-DD'),
    leadsAcquired: 64,
    conversions: 11,
    conversionRate: 17.2,
    cplGHS: 221.88,
    targetAudience: 'UK, US & Canada Diaspora Community Buyers',
    targetLocation: 'Virtual Stream + Accra International Conference Centre',
    branchName: 'Accra Central',
    description: 'Live interactive plot reservation webinar and exhibition stand for overseas buyers.',
    createdAt: dayjs().subtract(20, 'day').toISOString(),
  },
  {
    id: 'camp-003',
    name: 'Targeted Instagram & Facebook Reels (Gated Plots)',
    channel: 'social_media',
    channelLabel: 'Social Media & Reels',
    status: 'active',
    budgetGHS: 12000,
    spendGHS: 9400,
    startDate: dayjs().subtract(30, 'day').format('YYYY-MM-DD'),
    endDate: dayjs().add(30, 'day').format('YYYY-MM-DD'),
    leadsAcquired: 112,
    conversions: 16,
    conversionRate: 14.3,
    cplGHS: 83.93,
    targetAudience: 'Young Corporate Executives & Business Owners (Ages 28-52)',
    targetLocation: 'Greater Accra, Kumasi & Takoradi Metro',
    branchName: 'Kumasi Main',
    description: 'High-definition 4K drone flythrough video reels highlighting site security, roads & water.',
    createdAt: dayjs().subtract(30, 'day').toISOString(),
  },
  {
    id: 'camp-004',
    name: 'Google Search High-Intent Luxury Land Ads',
    channel: 'search_ads',
    channelLabel: 'Google Search & SEO Ads',
    status: 'active',
    budgetGHS: 8000,
    spendGHS: 5600,
    startDate: dayjs().subtract(15, 'day').format('YYYY-MM-DD'),
    endDate: dayjs().add(45, 'day').format('YYYY-MM-DD'),
    leadsAcquired: 48,
    conversions: 9,
    conversionRate: 18.8,
    cplGHS: 116.67,
    targetAudience: 'Buyers actively querying "titled land for sale Accra / Kumasi"',
    targetLocation: 'National & Diaspora Search Networks',
    branchName: 'Kumasi Main',
    description: 'PPC search campaigns linking to verified land deed guarantee landing pages.',
    createdAt: dayjs().subtract(15, 'day').toISOString(),
  },
  {
    id: 'camp-005',
    name: 'Executive Radio Drive-Time Sponsorship (Citi / Joy FM)',
    channel: 'radio_tv',
    channelLabel: 'Radio & Media Broadcast',
    status: 'upcoming',
    budgetGHS: 15000,
    spendGHS: 3000,
    startDate: dayjs().add(5, 'day').format('YYYY-MM-DD'),
    endDate: dayjs().add(35, 'day').format('YYYY-MM-DD'),
    leadsAcquired: 0,
    conversions: 0,
    conversionRate: 0,
    cplGHS: 0,
    targetAudience: 'Commuters & Business Executives tuning into morning drive shows',
    targetLocation: 'Nationwide Broadcast',
    branchName: 'Accra Central',
    description: '60-second corporate endorsement audio spots on title security and guaranteed indenture delivery.',
    createdAt: dayjs().toISOString(),
  },
  {
    id: 'camp-006',
    name: 'Kumasi Showroom Luxury Plot Launch Event',
    channel: 'print_flyer',
    channelLabel: 'Brochures & Print Media',
    status: 'completed',
    budgetGHS: 16000,
    spendGHS: 15800,
    startDate: dayjs().subtract(60, 'day').format('YYYY-MM-DD'),
    endDate: dayjs().subtract(10, 'day').format('YYYY-MM-DD'),
    leadsAcquired: 76,
    conversions: 19,
    conversionRate: 25.0,
    cplGHS: 207.89,
    targetAudience: 'Local Investors & Commercial Real Estate Buyers',
    targetLocation: 'Kumasi Showroom & Surrounding Environs',
    branchName: 'Kumasi Main',
    description: 'Executive print brochures, VIP breakfast cocktail, and on-site inspection convoy.',
    createdAt: dayjs().subtract(60, 'day').toISOString(),
  },
];

export const DEFAULT_TASKS: MarketingTask[] = [
  {
    id: 'task-001',
    title: 'Audit & Inspect Airport Bypass Billboard Lighting & Vinyl Tension',
    description: 'Conduct on-site night inspection of lighting spotlights and ensure zero vinyl fraying along highway.',
    assignedStaffId: 'staff-mkt-1',
    assignedStaffName: 'Kwame Mensah',
    assignedStaffRole: 'marketing_staff',
    priority: 'high',
    status: 'in_progress',
    dueDate: dayjs().add(2, 'day').format('YYYY-MM-DD'),
    progressPercent: 65,
    campaignId: 'camp-001',
    campaignName: 'Airport Bypass Highway LED Mega-Billboard',
    createdAt: dayjs().subtract(3, 'day').toISOString(),
  },
  {
    id: 'task-002',
    title: 'Finalize Q4 Diaspora Expo Roll-up Banners & Digital Catalogues',
    description: 'Coordinate printing of 6 luxury roll-up banners and prepare USB flash drives containing digital plot maps.',
    assignedStaffId: 'staff-mkt-2',
    assignedStaffName: 'Abena Osei',
    assignedStaffRole: 'marketing_staff',
    priority: 'urgent',
    status: 'in_progress',
    dueDate: dayjs().add(4, 'day').format('YYYY-MM-DD'),
    progressPercent: 80,
    campaignId: 'camp-002',
    campaignName: 'Q4 Diaspora Property Expo & Virtual Roadshow',
    createdAt: dayjs().subtract(5, 'day').toISOString(),
  },
  {
    id: 'task-003',
    title: 'Produce 1,500 High-Gloss Gated Community Brochures & Site Plans',
    description: 'Review color accuracy with Accra printing press and distribute 500 copies each to Kumasi & Accra offices.',
    assignedStaffId: 'staff-mkt-1',
    assignedStaffName: 'Kwame Mensah',
    assignedStaffRole: 'marketing_staff',
    priority: 'high',
    status: 'pending',
    dueDate: dayjs().add(6, 'day').format('YYYY-MM-DD'),
    progressPercent: 20,
    campaignId: 'camp-006',
    campaignName: 'Kumasi Showroom Luxury Plot Launch Event',
    createdAt: dayjs().subtract(2, 'day').toISOString(),
  },
  {
    id: 'task-004',
    title: 'Deploy Sponsored Video Ads for Phase 2 Hilltop Plots',
    description: 'Set up ad creatives on Meta Ads Manager targeting London, New York, and Toronto demographic segments.',
    assignedStaffId: 'staff-mkt-3',
    assignedStaffName: 'Kofi Boateng',
    assignedStaffRole: 'marketing_staff',
    priority: 'medium',
    status: 'in_progress',
    dueDate: dayjs().add(3, 'day').format('YYYY-MM-DD'),
    progressPercent: 50,
    campaignId: 'camp-003',
    campaignName: 'Targeted Instagram & Facebook Reels (Gated Plots)',
    createdAt: dayjs().subtract(4, 'day').toISOString(),
  },
  {
    id: 'task-005',
    title: 'Follow up with 20 VIP Diaspora Inquiries from Facebook Ads',
    description: 'Schedule one-on-one Zoom virtual plot tours and send deed policy documentation via WhatsApp.',
    assignedStaffId: 'dir-mkt',
    assignedStaffName: 'Marketing Director',
    assignedStaffRole: 'marketing_director',
    priority: 'urgent',
    status: 'in_progress',
    dueDate: dayjs().add(1, 'day').format('YYYY-MM-DD'),
    progressPercent: 75,
    campaignId: 'camp-003',
    campaignName: 'Targeted Instagram & Facebook Reels (Gated Plots)',
    createdAt: dayjs().subtract(1, 'day').toISOString(),
  },
  {
    id: 'task-006',
    title: 'Re-target Unconverted Inquiries with New Flexible 12-Month Payment Plan',
    description: 'Send personalized email campaign and SMS alert detailing 0% interest payment installments for 20 plots.',
    assignedStaffId: 'dir-mkt',
    assignedStaffName: 'Marketing Director',
    assignedStaffRole: 'marketing_director',
    priority: 'medium',
    status: 'completed',
    dueDate: dayjs().subtract(1, 'day').format('YYYY-MM-DD'),
    progressPercent: 100,
    campaignId: 'camp-004',
    campaignName: 'Google Search High-Intent Luxury Land Ads',
    createdAt: dayjs().subtract(8, 'day').toISOString(),
    completedAt: dayjs().subtract(1, 'day').toISOString(),
  },
];

// ── Local Storage Accessors ───────────────────────────────────────────────────

export function getStoredCampaigns(): MarketingCampaign[] {
  try {
    const raw = localStorage.getItem(CAMPAIGNS_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(CAMPAIGNS_STORAGE_KEY, JSON.stringify(DEFAULT_CAMPAIGNS));
      return DEFAULT_CAMPAIGNS;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_CAMPAIGNS;
  } catch (err) {
    console.warn('[Marketing Campaigns] Failed to parse stored campaigns:', err);
    return DEFAULT_CAMPAIGNS;
  }
}

export function saveCampaign(campaign: MarketingCampaign): void {
  try {
    const list = getStoredCampaigns();
    const idx = list.findIndex((c) => c.id === campaign.id);
    let updated: MarketingCampaign[];
    if (idx >= 0) {
      updated = [...list];
      updated[idx] = { ...updated[idx], ...campaign, updatedAt: new Date().toISOString() };
    } else {
      updated = [campaign, ...list];
    }
    localStorage.setItem(CAMPAIGNS_STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent('omark-marketing-campaigns-updated', { detail: updated }));
  } catch (err) {
    console.warn('[Marketing Campaigns] Failed to save campaign:', err);
  }
}

export function updateCampaign(id: string, updates: Partial<MarketingCampaign>): void {
  const list = getStoredCampaigns();
  const idx = list.findIndex((c) => c.id === id);
  if (idx >= 0) {
    list[idx] = { ...list[idx], ...updates, updatedAt: new Date().toISOString() };
    localStorage.setItem(CAMPAIGNS_STORAGE_KEY, JSON.stringify(list));
    window.dispatchEvent(new CustomEvent('omark-marketing-campaigns-updated', { detail: list }));
  }
}

export function deleteCampaign(id: string): void {
  const list = getStoredCampaigns();
  const filtered = list.filter((c) => c.id !== id);
  localStorage.setItem(CAMPAIGNS_STORAGE_KEY, JSON.stringify(filtered));
  window.dispatchEvent(new CustomEvent('omark-marketing-campaigns-updated', { detail: filtered }));
}

export function getStoredTasks(): MarketingTask[] {
  try {
    const raw = localStorage.getItem(TASKS_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(DEFAULT_TASKS));
      return DEFAULT_TASKS;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_TASKS;
  } catch (err) {
    console.warn('[Marketing Tasks] Failed to parse stored tasks:', err);
    return DEFAULT_TASKS;
  }
}

export function saveTask(task: MarketingTask): void {
  try {
    const list = getStoredTasks();
    const idx = list.findIndex((t) => t.id === task.id);
    let updated: MarketingTask[];
    if (idx >= 0) {
      updated = [...list];
      updated[idx] = { ...updated[idx], ...task };
    } else {
      updated = [task, ...list];
    }
    localStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent('omark-marketing-tasks-updated', { detail: updated }));
  } catch (err) {
    console.warn('[Marketing Tasks] Failed to save task:', err);
  }
}

export function updateTask(id: string, updates: Partial<MarketingTask>): void {
  const list = getStoredTasks();
  const idx = list.findIndex((t) => t.id === id);
  if (idx >= 0) {
    list[idx] = { ...list[idx], ...updates };
    localStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(list));
    window.dispatchEvent(new CustomEvent('omark-marketing-tasks-updated', { detail: list }));
  }
}

export function deleteTask(id: string): void {
  const list = getStoredTasks();
  const filtered = list.filter((t) => t.id !== id);
  localStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(filtered));
  window.dispatchEvent(new CustomEvent('omark-marketing-tasks-updated', { detail: filtered }));
}

// ── Metrics Aggregation Helper ────────────────────────────────────────────────

export interface MarketingMetricsSummary {
  activeCampaignsCount: number;
  totalCampaignsCount: number;
  totalCampaignBudgetGHS: number;
  totalCampaignSpendGHS: number;
  totalCampaignLeads: number;
  avgCostPerLeadGHS: number;
  avgCampaignConversionRate: number;

  totalProspectsAcquired: number;
  directorProspectsCount: number;
  directorConvertedCount: number;
  directorConversionRate: number;

  overallLeadConversionRate: number;
  conversionFunnel: {
    stage: string;
    count: number;
    percent: number;
    color: string;
  }[];

  tasksTotal: number;
  tasksPending: number;
  tasksInProgress: number;
  tasksCompleted: number;
  tasksUrgent: number;
  tasksCompletionRate: number;
}

export function calculateMarketingMetrics(
  campaigns: MarketingCampaign[],
  tasks: MarketingTask[],
  allProspects: Prospect[],
  directorUserId?: string,
  directorUserName?: string,
  externalTotals?: {
    totalProspects?: number;
    marketingProspects?: number;
    csProspects?: number;
    totalConverted?: number;
  }
): MarketingMetricsSummary {
  const activeCampaigns = campaigns.filter((c) => c.status === 'active');
  const activeCampaignsCount = activeCampaigns.length;
  const totalCampaignsCount = campaigns.length;
  const totalCampaignBudgetGHS = campaigns.reduce((s, c) => s + (c.budgetGHS || 0), 0);
  const totalCampaignSpendGHS = campaigns.reduce((s, c) => s + (c.spendGHS || 0), 0);
  const totalCampaignLeads = campaigns.reduce((s, c) => s + (c.leadsAcquired || 0), 0);

  const avgCostPerLeadGHS =
    totalCampaignLeads > 0 ? Math.round((totalCampaignSpendGHS / totalCampaignLeads) * 100) / 100 : 0;

  const totalConversions = campaigns.reduce((s, c) => s + (c.conversions || 0), 0);
  const avgCampaignConversionRate =
    totalCampaignLeads > 0 ? Math.round((totalConversions / totalCampaignLeads) * 1000) / 10 : 0;

  // Prospects calculations — 100% accurate live data
  const totalProspectsAcquired = Math.max(
    allProspects.length,
    externalTotals?.totalProspects ?? 0
  );

  const directorProspects = allProspects.filter((p) => {
    if (directorUserId && (p.assignedUserId === directorUserId || p.createdByUserId === directorUserId)) {
      return true;
    }
    if (
      directorUserName &&
      ((p.createdByName && p.createdByName.toLowerCase().includes(directorUserName.toLowerCase())) ||
        (p.creator?.name && p.creator.name.toLowerCase().includes(directorUserName.toLowerCase())))
    ) {
      return true;
    }
    // Also include if designated as director assigned staff in raw record
    if ((p as any).assignedStaffRole === 'marketing_director' || (p as any).source === 'director_vip') {
      return true;
    }
    return false;
  });

  const directorProspectsCount = directorProspects.length;
  const directorConverted = directorProspects.filter(
    (p) => p.status === 'purchased' || (p as any).converted || p.status === 'meeting_completed'
  );
  const directorConvertedCount = directorProspects.filter(
    (p) => p.status === 'purchased' || (p as any).converted
  ).length;
  const directorConversionRate =
    directorProspectsCount > 0
      ? Math.round((directorConvertedCount / directorProspectsCount) * 1000) / 10
      : 0;

  // Live Conversion Funnel Stages
  const totalInquiries = totalProspectsAcquired;
  const rawConverted = Math.max(
    allProspects.filter((p) => (p as any).converted || p.status === 'purchased').length,
    externalTotals?.totalConverted ?? 0
  );
  const rawScheduled = allProspects.filter(
    (p) => p.status === 'meeting_scheduled' || p.status === 'meeting_completed'
  ).length;
  const rawContacted = allProspects.filter(
    (p) =>
      p.status !== 'new' ||
      ((p as any).interactionsCount && (p as any).interactionsCount > 0)
  ).length;

  // Ensure logical funnel progression (each stage is bounded by the previous stage)
  const converted = Math.min(rawConverted, totalInquiries);
  const scheduled = Math.min(Math.max(rawScheduled, converted), totalInquiries);
  const contacted = Math.min(Math.max(rawContacted, scheduled), totalInquiries);

  const overallLeadConversionRate =
    totalInquiries > 0 ? Math.round((converted / totalInquiries) * 1000) / 10 : 0;

  const conversionFunnel = [
    {
      stage: '1. Inquiries Acquired',
      count: totalInquiries,
      percent: 100,
      color: '#1890ff',
    },
    {
      stage: '2. Contacted & Qualified',
      count: contacted,
      percent: totalInquiries > 0 ? Math.round((contacted / totalInquiries) * 100) : 0,
      color: '#13c2c2',
    },
    {
      stage: '3. Site Inspections Scheduled',
      count: scheduled,
      percent: totalInquiries > 0 ? Math.round((scheduled / totalInquiries) * 100) : 0,
      color: '#fa8c16',
    },
    {
      stage: '4. Converted to Buyers',
      count: converted,
      percent: totalInquiries > 0 ? Math.round((converted / totalInquiries) * 100) : 0,
      color: '#52c41a',
    },
  ];

  // Tasks
  const tasksTotal = tasks.length;
  const tasksPending = tasks.filter((t) => t.status === 'pending').length;
  const tasksInProgress = tasks.filter((t) => t.status === 'in_progress').length;
  const tasksCompleted = tasks.filter((t) => t.status === 'completed').length;
  const tasksUrgent = tasks.filter((t) => t.priority === 'urgent').length;
  const tasksCompletionRate = tasksTotal > 0 ? Math.round((tasksCompleted / tasksTotal) * 100) : 0;

  return {
    activeCampaignsCount,
    totalCampaignsCount,
    totalCampaignBudgetGHS,
    totalCampaignSpendGHS,
    totalCampaignLeads,
    avgCostPerLeadGHS,
    avgCampaignConversionRate,

    totalProspectsAcquired,
    directorProspectsCount,
    directorConvertedCount,
    directorConversionRate,

    overallLeadConversionRate,
    conversionFunnel,

    tasksTotal,
    tasksPending,
    tasksInProgress,
    tasksCompleted,
    tasksUrgent,
    tasksCompletionRate,
  };
}
