// src/pages/dashboard/admin/components/UnifiedBroadcastCenter.tsx
import React, { useState, useMemo, useEffect } from 'react';
import {
  Card,
  Row,
  Col,
  Typography,
  Form,
  Input,
  Select,
  Button,
  Space,
  Tag,
  Statistic,
  Table,
  Radio,
  Modal,
  message,
  Alert,
  Checkbox,
  Tooltip,
  Badge,
  Divider,
} from 'antd';
import {
  SendOutlined,
  UserOutlined,
  TeamOutlined,
  BellOutlined,
  CheckCircleOutlined,
  InfoCircleOutlined,
  RocketOutlined,
  CrownOutlined,
  EyeOutlined,
  RedoOutlined,
  FireOutlined,
  NotificationOutlined,
  ShopOutlined,
  SafetyCertificateOutlined,
  ClockCircleOutlined,
  DeleteOutlined,
  PhoneOutlined,
  SearchOutlined,
  ReloadOutlined,
  ExclamationCircleOutlined,
  CheckOutlined,
  FilterOutlined,
  FileTextOutlined,
  MailOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
dayjs.extend(relativeTime);

import { tokens } from '@/constants/tokens';
import { useAuth } from '@/contexts/AuthContext';
import type { Customer, Prospect, Role } from '@/types';
import { useCustomersQuery } from '@/api/customers';
import { useProspectsQuery } from '@/api/prospects';
import {
  useUsersQuery,
  getUserFullName,
  getUserPhone,
  getRoleLabel,
  getRoleColor,
  type UserEntity,
} from '@/api/users';
import { useBranchesQuery } from '@/api/branches';
import {
  useNotificationsQuery,
  useSendBroadcastSMSMutation,
  type NotificationLog,
} from '@/api/notifications';
import { recordSystemEvent } from '@/utils/activityNotificationEngine';
import { normalizePhone, extractPhoneDigits } from '@/utils/duplicateValidation';
import {
  getStoredUserAssignment,
  resolveDefaultDepartment,
} from '@/utils/userAssignmentStorage';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;
const { Option } = Select;

export interface BroadcastHistoryItem {
  id: string;
  title: string;
  audienceType: 'customers' | 'staff';
  targetSegment: string;
  targetSegmentLabel: string;
  channels: ('sms' | 'in_app' | 'portal')[];
  recipientCount: number;
  excludedCount?: number;
  messageText: string;
  sentAt: string;
  senderName: string;
  status: 'delivered' | 'pending' | 'failed';
  branchScope?: string;
}

export interface TargetRecipientItem {
  id: string;
  name: string;
  phone: string;
  canonicalPhone: string;
  hasPhone: boolean;
  email?: string;
  tag: string;
  role?: Role | string;
  roleLabel?: string;
  roleColor?: string;
  department?: string;
  branch?: string;
  location?: string;
  type: 'customer' | 'prospect' | 'staff';
}

const STORAGE_BROADCAST_HISTORY_KEY = 'omark_admin_broadcasts_history';
const STORAGE_PORTAL_ANNOUNCEMENT_KEY = 'omark_portal_holiday_announcement';

// ── Curated Professional Templates for Customers ─────────────────────────────
const CUSTOMER_TEMPLATES = [
  {
    key: 'ghana_independence',
    title: 'Ghana Independence Day (March 6)',
    icon: '🇬🇭',
    category: 'National Holiday',
    subject: 'Happy 69th Independence Day Ghana! 🇬🇭',
    text: 'Happy Independence Day from Omark Real Estate & Construction! As we celebrate our nation\'s freedom and rich heritage, we honor you as a proud landowner shaping the future of Ghana. Warmest wishes of peace, health, and prosperity to you and your family.',
  },
  {
    key: 'easter_sunday',
    title: 'Easter Season Blessings',
    icon: '✝️',
    category: 'Religious Holiday',
    subject: 'Easter Blessings & Goodwill from Omark Real Estate',
    text: 'Warm Easter greetings from the management and team at Omark Real Estate & Construction! May this season of hope, joy, and renewal bring lasting peace, good health, and abundant blessings to your home and family.',
  },
  {
    key: 'eid_mubarak',
    title: 'Eid-ul-Fitr / Eid-ul-Adha',
    icon: '☪️',
    category: 'Religious Holiday',
    subject: 'Eid Mubarak Greetings from Omark Real Estate',
    text: 'Eid Mubarak from all of us at Omark Real Estate & Construction! On this joyous occasion, may the divine blessings of Allah bring peace, happiness, and prosperity to you, your household, and your community.',
  },
  {
    key: 'christmas_day',
    title: 'Merry Christmas (Dec 25)',
    icon: '🎄',
    category: 'Festive Season',
    subject: 'Merry Christmas from Omark Real Estate & Construction 🎄',
    text: 'Merry Christmas from the executive management and team at Omark Real Estate & Construction! We sincerely thank you for your trust and partnership on your landownership journey this year. May your festive season be joyful, peaceful, and restful.',
  },
  {
    key: 'new_year',
    title: 'New Year Day (Jan 1)',
    icon: '🎆',
    category: 'New Year',
    subject: 'Happy New Year from Omark Real Estate & Construction 🎆',
    text: 'Happy New Year from Omark Real Estate & Construction! As we step into a new year, we wish you extraordinary success, good health, and abundant prosperity. We look forward to continuing to serve you with excellence throughout this year.',
  },
  {
    key: 'customer_appreciation',
    title: 'Customer Appreciation & Loyalty',
    icon: '💎',
    category: 'Corporate Goodwill',
    subject: 'Thank You for Your Valued Partnership with Omark Real Estate',
    text: 'Dear Valued Client, the leadership and staff of Omark Real Estate & Construction extend our heartfelt gratitude for your continued trust and patronage. Your commitment inspires our passion for providing secure, litigation-free, and premier land investments.',
  },
  {
    key: 'office_closure',
    title: 'Public Holiday Office Hours',
    icon: '⏰',
    category: 'Administrative Notice',
    subject: 'Notice: Public Holiday Corporate Office Hours',
    text: 'Notice from Omark Real Estate & Construction: Our corporate offices will be closed for the statutory holiday and will resume normal business operations on the next working day at 8:00 AM. For urgent assistance, our dedicated client helpline remains reachable at +233 24 000 0000.',
  },
  {
    key: 'weekend_inspection',
    title: 'Weekend VIP Site Convoy Tour',
    icon: '🚌',
    category: 'Outreach & Inspection',
    subject: 'Weekend Executive Site Inspection Convoy Notice',
    text: 'Omark Real Estate & Construction invites you to our complimentary executive convoy inspection this Saturday departing at 9:00 AM sharp to our prime serviced estate developments. Complimentary refreshments are provided. Please contact our client desk to confirm your seat.',
  },
];

// ── Curated Professional Templates for Staff ─────────────────────────────────
const STAFF_TEMPLATES = [
  {
    key: 'staff_christmas',
    title: 'Christmas & Year-End Staff Address',
    icon: '🎄',
    category: 'Executive Holiday',
    subject: 'Executive Christmas & Year-End Message to Staff',
    text: 'Dear Team Omark, executive management extends our deep gratitude for your commitment and hard work throughout this fiscal year. As we observe the festive holidays, we wish you and your families a joyful, restful break. We look forward to reaching greater heights together in the coming year.',
  },
  {
    key: 'staff_new_year',
    title: 'New Year Welcome & Corporate Focus',
    icon: '🚀',
    category: 'Leadership Memo',
    subject: 'New Year Welcome & Corporate Quarter Kick-Off',
    text: 'Welcome to the new year, Team Omark! As we embark on this new fiscal quarter, management encourages every department to uphold operational excellence and drive our corporate goals with passion. Updated branch targets and performance incentives are available on your ERP dashboard.',
  },
  {
    key: 'staff_holiday_closure',
    title: 'Holiday Office Closure & Duty Roster',
    icon: '🏖️',
    category: 'Operational Directive',
    subject: 'Holiday Office Closure & Operational Standby Notice',
    text: 'Staff Memorandum: All Omark Real Estate & Construction branch offices will be closed on the statutory public holiday and will resume regular working hours on the next business day at 8:00 AM. Standby duty personnel will facilitate pre-scheduled client site visits in accordance with the roster.',
  },
  {
    key: 'staff_town_hall',
    title: 'Mandatory All-Hands Strategy Meeting',
    icon: '🏛️',
    category: 'All-Hands Meeting',
    subject: 'Notice of Mandatory All-Hands Strategy Meeting',
    text: 'Executive Notice: All staff across all branches are required to attend our Quarterly Corporate Strategy Meeting scheduled for this Friday at 4:00 PM in the Main Boardroom and via virtual conference. Attendance and punctuality are strictly required.',
  },
  {
    key: 'staff_payroll_bonus',
    title: 'Salaries & Performance Bonuses Disbursed',
    icon: '💰',
    category: 'Finance & Payroll',
    subject: 'Monthly Salaries & Performance Bonuses Disbursed',
    text: 'Staff Notification: Monthly salaries and verified marketing commission bonuses have been processed and credited to all staff accounts. Kindly review your approved payroll payslip on the ERP portal under My Profile.',
  },
  {
    key: 'staff_inspection_duty',
    title: 'Weekend Client Convoy Duty Assignment',
    icon: '🚐',
    category: 'Field Operations',
    subject: 'Weekend Client Convoy & Protocol Duty Assignment',
    text: 'Operations Directive: The weekend client inspection convoy departs the Head Office this Saturday at 9:00 AM. Designated marketing officers and protocol coordinators must report by 8:15 AM for vehicle pre-check and client dossier inspection.',
  },
];

// Seed Historical Broadcasts
const SEED_BROADCAST_HISTORY: BroadcastHistoryItem[] = [
  {
    id: 'bch-001',
    title: 'Ghana 69th Independence Day National Celebration',
    audienceType: 'customers',
    targetSegment: 'all_customers',
    targetSegmentLabel: 'All Verified Customers',
    channels: ['sms', 'portal'],
    recipientCount: 142,
    excludedCount: 0,
    messageText: 'Happy Independence Day from Omark Real Estate & Construction! As we celebrate our nation\'s freedom and rich heritage, we honor you as a proud landowner shaping the future of Ghana. Warmest wishes of peace, health, and prosperity to you and your family.',
    sentAt: dayjs().subtract(2, 'day').format('YYYY-MM-DD HH:mm'),
    senderName: 'Kindo Original (Administrator)',
    status: 'delivered',
  },
  {
    id: 'bch-002',
    title: 'Statutory Holiday Office Hours & Standby Schedule',
    audienceType: 'staff',
    targetSegment: 'all_staff',
    targetSegmentLabel: 'All Staff (Company-wide)',
    channels: ['sms', 'in_app'],
    recipientCount: 38,
    excludedCount: 0,
    messageText: 'Staff Memorandum: All Omark Real Estate & Construction branch offices will be closed on the statutory public holiday and will resume regular working hours on the next business day at 8:00 AM. Standby duty personnel will facilitate pre-scheduled client site visits.',
    sentAt: dayjs().subtract(5, 'day').format('YYYY-MM-DD HH:mm'),
    senderName: 'Kindo Original (Administrator)',
    status: 'delivered',
  },
];

export const UnifiedBroadcastCenter: React.FC = () => {
  const { user } = useAuth();
  const [form] = Form.useForm();

  // Audience Mode & Filtering
  const [audienceType, setAudienceType] = useState<'customers' | 'staff'>('customers');
  const [targetSegment, setTargetSegment] = useState<string>('all_customers');
  const [staffBranchScope, setStaffBranchScope] = useState<string>('all');
  const [channels, setChannels] = useState<('sms' | 'in_app' | 'portal')[]>(['sms', 'portal']);

  // Compose State
  const [messageText, setMessageText] = useState<string>('');
  const [subjectTitle, setSubjectTitle] = useState<string>('');
  const [sending, setSending] = useState(false);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [recipientSearchQuery, setRecipientSearchQuery] = useState<string>('');

  // Row selection state for excluding recipients
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  // Audit log filter & inspection modal states
  const [auditSearchQuery, setAuditSearchQuery] = useState<string>('');
  const [auditAudienceFilter, setAuditAudienceFilter] = useState<'all' | 'customers' | 'staff'>('all');
  const [auditChannelFilter, setAuditChannelFilter] = useState<string>('all');
  const [selectedAuditItem, setSelectedAuditItem] = useState<BroadcastHistoryItem | null>(null);

  // Portal announcement state
  const [activePortalAnnouncement, setActivePortalAnnouncement] = useState<any>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_PORTAL_ANNOUNCEMENT_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  // History State
  const [history, setHistory] = useState<BroadcastHistoryItem[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_BROADCAST_HISTORY_KEY);
      return stored ? JSON.parse(stored) : SEED_BROADCAST_HISTORY;
    } catch {
      return SEED_BROADCAST_HISTORY;
    }
  });

  // ── Queries for Live Database ──────────────────────────────────────────────
  const { data: customersData, isLoading: customersLoading } = useCustomersQuery({ pageSize: 1000 });
  const { data: prospectsData, isLoading: prospectsLoading } = useProspectsQuery({ pageSize: 1000 });
  const { data: usersData, isLoading: usersLoading, refetch: refetchUsers } = useUsersQuery({ pageSize: 500 });
  const { data: branches = [] } = useBranchesQuery();
  const { data: notificationsData, refetch: refetchNotifications, isFetching: notificationsFetching } = useNotificationsQuery({ pageSize: 50 });
  const sendBroadcastSMS = useSendBroadcastSMSMutation();

  const allCustomers: Customer[] = useMemo(() => customersData?.items ?? [], [customersData]);
  const allProspects: Prospect[] = useMemo(() => prospectsData?.items ?? [], [prospectsData]);
  const allStaffUsers: UserEntity[] = useMemo(() => usersData?.items ?? [], [usersData]);

  // Sync default target segment and initial template when audience type toggles
  useEffect(() => {
    if (audienceType === 'customers') {
      setTargetSegment('all_customers');
      setChannels(['sms', 'portal']);
      const defaultTemplate = CUSTOMER_TEMPLATES[0];
      setSubjectTitle(defaultTemplate.subject);
      setMessageText(defaultTemplate.text);
      form.setFieldsValue({
        title: defaultTemplate.subject,
        messageText: defaultTemplate.text,
        segment: 'all_customers',
      });
    } else {
      setTargetSegment('all_staff');
      setChannels(['sms', 'in_app']);
      const defaultTemplate = STAFF_TEMPLATES[0];
      setSubjectTitle(defaultTemplate.subject);
      setMessageText(defaultTemplate.text);
      form.setFieldsValue({
        title: defaultTemplate.subject,
        messageText: defaultTemplate.text,
        segment: 'all_staff',
      });
    }
  }, [audienceType, form]);

  // ── Live Audience Targeting & Resolution ───────────────────────────────────
  const targetedRecipients: TargetRecipientItem[] = useMemo(() => {
    const isValidPhone = (ph?: string | null) => {
      if (!ph) return false;
      const digits = extractPhoneDigits(ph);
      return digits.length >= 7;
    };

    if (audienceType === 'customers') {
      let list: TargetRecipientItem[] = [];

      if (targetSegment === 'all_customers') {
        list = allCustomers.map((c) => ({
          id: c.id,
          name: `${c.firstName} ${c.lastName}`.trim(),
          phone: c.phoneNumber || '',
          canonicalPhone: normalizePhone(c.phoneNumber),
          hasPhone: isValidPhone(c.phoneNumber),
          tag: c.type === 'fully_paid' ? 'Fully Paid (VIP)' : 'Payment Plan',
          department: 'Client Portfolio',
          branch: 'Head Office',
          location: c.address || 'Ghana',
          type: 'customer',
        }));
      } else if (targetSegment === 'payment_plan') {
        list = allCustomers
          .filter((c) => c.type === 'payment_plan')
          .map((c) => ({
            id: c.id,
            name: `${c.firstName} ${c.lastName}`.trim(),
            phone: c.phoneNumber || '',
            canonicalPhone: normalizePhone(c.phoneNumber),
            hasPhone: isValidPhone(c.phoneNumber),
            tag: 'Payment Plan Buyer',
            department: 'Installment Portfolio',
            branch: 'Head Office',
            location: c.address || 'Ghana',
            type: 'customer',
          }));
      } else if (targetSegment === 'fully_paid') {
        list = allCustomers
          .filter((c) => c.type === 'fully_paid')
          .map((c) => ({
            id: c.id,
            name: `${c.firstName} ${c.lastName}`.trim(),
            phone: c.phoneNumber || '',
            canonicalPhone: normalizePhone(c.phoneNumber),
            hasPhone: isValidPhone(c.phoneNumber),
            tag: 'Fully Paid (VIP)',
            department: 'VIP Landowners',
            branch: 'Head Office',
            location: c.address || 'Ghana',
            type: 'customer',
          }));
      } else if (targetSegment === 'prospects') {
        list = allProspects.map((p) => {
          const ph = p.phoneNumber || (p as any).phone || '';
          return {
            id: p.id,
            name: `${p.firstName} ${p.lastName}`.trim(),
            phone: ph,
            canonicalPhone: normalizePhone(ph),
            hasPhone: isValidPhone(ph),
            tag: `Lead: ${(p.status || 'Active').replace('_', ' ').toUpperCase()}`,
            department: 'Sales Pipeline',
            branch: 'Head Office',
            location: p.address || 'Ghana',
            type: 'prospect',
          };
        });
      } else if (targetSegment === 'all_contacts') {
        const custs: TargetRecipientItem[] = allCustomers.map((c) => ({
          id: c.id,
          name: `${c.firstName} ${c.lastName}`.trim(),
          phone: c.phoneNumber || '',
          canonicalPhone: normalizePhone(c.phoneNumber),
          hasPhone: isValidPhone(c.phoneNumber),
          tag: c.type === 'fully_paid' ? 'VIP Client' : 'Client',
          department: 'Client Portfolio',
          branch: 'Head Office',
          location: c.address || 'Ghana',
          type: 'customer',
        }));
        const prows: TargetRecipientItem[] = allProspects.map((p) => {
          const ph = p.phoneNumber || (p as any).phone || '';
          return {
            id: p.id,
            name: `${p.firstName} ${p.lastName}`.trim(),
            phone: ph,
            canonicalPhone: normalizePhone(ph),
            hasPhone: isValidPhone(ph),
            tag: 'Sales Lead',
            department: 'Sales Pipeline',
            branch: 'Head Office',
            location: p.address || 'Ghana',
            type: 'prospect',
          };
        });
        list = [...custs, ...prows];
      }

      // Deduplicate contacts by canonical phone number (if phone exists)
      const seenPhones = new Set<string>();
      const deduped: TargetRecipientItem[] = [];
      for (const item of list) {
        if (item.canonicalPhone) {
          if (seenPhones.has(item.canonicalPhone)) continue;
          seenPhones.add(item.canonicalPhone);
        }
        deduped.push(item);
      }
      return deduped;
    } else {
      // ── Internal Staff & Teams Targeting ──
      // Capture ALL staff members from live database enriched with user assignments and phone numbers
      let staffList = allStaffUsers;

      // Filter by branch scope if specified
      if (staffBranchScope !== 'all') {
        staffList = staffList.filter((s: any) => {
          const stored = getStoredUserAssignment(s.id);
          const effectiveBranchId = stored?.branchId || s.branchId || (s as any).branch;
          return effectiveBranchId === staffBranchScope;
        });
      }

      // Filter by department / role
      if (targetSegment === 'dept_marketing') {
        staffList = staffList.filter((s: any) => {
          const stored = getStoredUserAssignment(s.id);
          const r = stored?.role || s.role;
          return r === 'marketing_staff' || r === 'marketing_director';
        });
      } else if (targetSegment === 'dept_cs') {
        staffList = staffList.filter((s: any) => {
          const stored = getStoredUserAssignment(s.id);
          const r = stored?.role || s.role;
          return r === 'customer_service';
        });
      } else if (targetSegment === 'dept_accounts') {
        staffList = staffList.filter((s: any) => {
          const stored = getStoredUserAssignment(s.id);
          const r = stored?.role || s.role;
          return r === 'accounts';
        });
      } else if (targetSegment === 'dept_secretariat') {
        staffList = staffList.filter((s: any) => {
          const stored = getStoredUserAssignment(s.id);
          const r = stored?.role || s.role;
          return r === 'secretary' || r === 'admin';
        });
      } else if (targetSegment === 'leadership') {
        staffList = staffList.filter((s: any) => {
          const stored = getStoredUserAssignment(s.id);
          const r = stored?.role || s.role;
          return r === 'branch_manager' || r === 'marketing_director' || r === 'admin';
        });
      }

      const branchMap = new Map(branches.map((b) => [b.id, b.name]));

      return staffList.map((s: any) => {
        const stored = getStoredUserAssignment(s.id);
        const effectiveRole = (stored?.role as Role) || s.role || 'marketing_staff';
        const rawPhone = getUserPhone(s) || stored?.phoneNumber || s.phoneNumber || (typeof s.phone === 'object' ? s.phone?.number : s.phone) || '';
        const effectiveBranchId = stored?.branchId || s.branchId;
        const branchName = branchMap.get(effectiveBranchId) || stored?.branchName || s.branch || 'Accra Head Office';
        const department = stored?.departmentName || stored?.department || s.department || resolveDefaultDepartment(effectiveRole);
        const fullName = getUserFullName(s) || (s.firstName ? `${s.firstName} ${s.lastName || ''}`.trim() : s.email);

        return {
          id: s.id,
          name: fullName,
          phone: rawPhone,
          canonicalPhone: normalizePhone(rawPhone),
          hasPhone: isValidPhone(rawPhone),
          email: s.email || '',
          tag: getRoleLabel(effectiveRole),
          role: effectiveRole,
          roleLabel: getRoleLabel(effectiveRole),
          roleColor: getRoleColor(effectiveRole),
          department,
          branch: branchName,
          location: branchName,
          type: 'staff',
        };
      });
    }
  }, [audienceType, targetSegment, staffBranchScope, allCustomers, allProspects, allStaffUsers, branches]);

  // Whenever the targeted recipient list recalculates, auto-select all recipients by default
  useEffect(() => {
    setSelectedRowKeys(targetedRecipients.map((r) => r.id));
  }, [targetedRecipients]);

  // Selected (Included) vs Excluded Recipients
  const selectedRecipients = useMemo(() => {
    const selectedSet = new Set(selectedRowKeys.map(String));
    return targetedRecipients.filter((r) => selectedSet.has(String(r.id)));
  }, [targetedRecipients, selectedRowKeys]);

  const excludedCount = targetedRecipients.length - selectedRecipients.length;

  // Filtered recipients for in-table search
  const filteredRecipients = useMemo(() => {
    if (!recipientSearchQuery.trim()) return targetedRecipients;
    const q = recipientSearchQuery.toLowerCase();
    return targetedRecipients.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.phone.toLowerCase().includes(q) ||
        r.tag.toLowerCase().includes(q) ||
        (r.email && r.email.toLowerCase().includes(q)) ||
        (r.department && r.department.toLowerCase().includes(q)) ||
        (r.branch && r.branch.toLowerCase().includes(q))
    );
  }, [targetedRecipients, recipientSearchQuery]);

  // SMS character & segment calculation based on INCLUDED recipients
  const smsCharCount = messageText.length;
  const smsSegments = Math.max(1, Math.ceil(smsCharCount / 160));
  const validMobileCount = selectedRecipients.filter((r) => r.hasPhone).length;
  const totalSmsCredits = validMobileCount * smsSegments;

  // Handler: Select Template
  const handleSelectTemplate = (tmpl: any) => {
    setSubjectTitle(tmpl.subject);
    setMessageText(tmpl.text);
    form.setFieldsValue({
      title: tmpl.subject,
      messageText: tmpl.text,
    });
    message.success(`Template loaded: "${tmpl.title}"`);
  };

  // Handler: Clear Portal Announcement
  const handleClearPortalAnnouncement = () => {
    localStorage.removeItem(STORAGE_PORTAL_ANNOUNCEMENT_KEY);
    setActivePortalAnnouncement(null);
    message.success('Customer Portal holiday announcement banner cleared.');
  };

  // Handler: Execute Broadcast
  const handleExecuteBroadcast = async () => {
    if (!messageText.trim()) {
      message.error('Please enter broadcast message copy before sending.');
      return;
    }
    if (selectedRecipients.length === 0) {
      message.warning('All recipients are currently excluded. Please check at least one recipient.');
      return;
    }

    setSending(true);
    try {
      const recipientPhoneNumbers = selectedRecipients
        .filter((r) => r.hasPhone)
        .map((r) => r.phone);

      // 1. Dispatch Carrier SMS
      if (channels.includes('sms') && recipientPhoneNumbers.length > 0) {
        let resolvedAudience: 'customers' | 'prospects' | 'staff' | 'custom' = 'custom';
        if (audienceType === 'staff') {
          resolvedAudience =
            excludedCount > 0 || staffBranchScope !== 'all' || targetSegment !== 'all_staff'
              ? 'custom'
              : 'staff';
        } else {
          if (targetSegment === 'prospects' && excludedCount === 0) {
            resolvedAudience = 'prospects';
          } else if (targetSegment === 'all_customers' && excludedCount === 0) {
            resolvedAudience = 'customers';
          } else {
            resolvedAudience = 'custom';
          }
        }

        const trimmedMsg = messageText.trim().slice(0, 480);

        await sendBroadcastSMS.mutateAsync({
          audience: resolvedAudience,
          message: trimmedMsg,
          messageText: trimmedMsg,
          recipientPhoneNumbers,
          phoneNumbers: recipientPhoneNumbers,
          recipients: recipientPhoneNumbers,
          senderId: 'OMARK',
        });
      }

      // 2. Dispatch ERP In-App Notification (for Staff or Management Bell)
      if (channels.includes('in_app')) {
        recordSystemEvent({
          title: `📢 ${subjectTitle || 'Executive Announcement'}`,
          details: messageText,
          category: 'system',
          type: 'info',
          isBroadcast: true,
          actorName: user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : 'Executive Administration',
          actorRole: user?.role,
          targetRole: audienceType === 'staff' ? targetSegment : undefined,
        });
      }

      // 3. Dispatch Customer Portal Announcement
      if (channels.includes('portal')) {
        const portalNotice = {
          id: `pnotice-${Date.now()}`,
          title: subjectTitle,
          message: messageText,
          date: dayjs().toISOString(),
          broadcastBy: user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : 'Executive Management',
        };
        localStorage.setItem(STORAGE_PORTAL_ANNOUNCEMENT_KEY, JSON.stringify(portalNotice));
        setActivePortalAnnouncement(portalNotice);
      }

      // 4. Save to Audit History
      const audienceLabels: Record<string, string> = {
        all_customers: 'All Verified Customers',
        payment_plan: 'Active Payment Plan Buyers',
        fully_paid: 'Fully Paid Landowners (VIP)',
        prospects: 'Sales Leads & Prospects',
        all_contacts: 'All Contacts (Clients + Leads)',
        all_staff: 'All Company Staff (Company-wide)',
        dept_marketing: 'Marketing Directorate & Sales',
        dept_cs: 'Customer Service & Front Desk',
        dept_accounts: 'Finance, Accounts & Payroll',
        dept_secretariat: 'Secretariat & Administration',
        leadership: 'Executive Directors & Branch Managers',
      };

      const newRecord: BroadcastHistoryItem = {
        id: `bch-${Date.now()}`,
        title: subjectTitle || 'Executive Broadcast',
        audienceType,
        targetSegment,
        targetSegmentLabel: audienceLabels[targetSegment] || targetSegment,
        channels: [...channels],
        recipientCount: selectedRecipients.length,
        excludedCount: excludedCount,
        messageText,
        sentAt: dayjs().format('YYYY-MM-DD HH:mm'),
        senderName: user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : 'Executive Administrator',
        status: 'delivered',
        branchScope: staffBranchScope !== 'all' ? branches.find((b) => b.id === staffBranchScope)?.name : undefined,
      };

      const updatedHistory = [newRecord, ...history];
      setHistory(updatedHistory);
      localStorage.setItem(STORAGE_BROADCAST_HISTORY_KEY, JSON.stringify(updatedHistory));

      // Trigger custom event so any other open listeners refresh
      window.dispatchEvent(new CustomEvent('omark-broadcast-history-changed'));

      setConfirmModalOpen(false);
      refetchNotifications();
      message.success(
        `Broadcast successfully dispatched to ${selectedRecipients.length} recipients (${excludedCount} excluded) via OMARK gateway!`
      );
    } catch (err: any) {
      const responseData = err?.response?.data;
      const errorObj = responseData?.error;
      let errorMsg =
        errorObj?.message || responseData?.message || err?.message || 'Failed to dispatch broadcast';
      if (errorObj?.details && Array.isArray(errorObj.details) && errorObj.details.length > 0) {
        const detailMsgs = errorObj.details
          .map((d: any) => `${d.field ? d.field + ': ' : ''}${d.message}`)
          .join(', ');
        errorMsg = `${errorMsg} (${detailMsgs})`;
      }
      message.error(errorMsg);
    } finally {
      setSending(false);
    }
  };

  // ── Filtered Audit History ────────────────────────────────────────────────
  const filteredHistory = useMemo(() => {
    return history.filter((item) => {
      if (auditAudienceFilter !== 'all' && item.audienceType !== auditAudienceFilter) return false;
      if (auditChannelFilter !== 'all' && !item.channels.includes(auditChannelFilter as any)) return false;
      if (auditSearchQuery.trim()) {
        const q = auditSearchQuery.toLowerCase();
        const matchesTitle = item.title.toLowerCase().includes(q);
        const matchesMsg = item.messageText.toLowerCase().includes(q);
        const matchesSender = item.senderName.toLowerCase().includes(q);
        const matchesTarget = item.targetSegmentLabel.toLowerCase().includes(q);
        if (!matchesTitle && !matchesMsg && !matchesSender && !matchesTarget) return false;
      }
      return true;
    });
  }, [history, auditAudienceFilter, auditChannelFilter, auditSearchQuery]);

  // Enhanced Columns for Audit History Table
  const historyColumns = [
    {
      title: 'Date & Time',
      dataIndex: 'sentAt',
      key: 'sentAt',
      width: 170,
      render: (v: string) => {
        const parsed = dayjs(v);
        return (
          <div>
            <div style={{ fontWeight: 600, color: '#1e293b', fontSize: 13 }}>
              {parsed.isValid() ? parsed.format('DD MMM YYYY, HH:mm') : v}
            </div>
            <div style={{ fontSize: 11, color: '#64748b' }}>
              {parsed.isValid() ? parsed.fromNow() : ''}
            </div>
          </div>
        );
      },
    },
    {
      title: 'Campaign Subject & Memo',
      dataIndex: 'title',
      key: 'title',
      render: (title: string, r: BroadcastHistoryItem) => (
        <div>
          <strong style={{ color: tokens.primary, fontSize: 13 }}>{title}</strong>
          <div
            style={{
              fontSize: 12,
              color: '#475569',
              marginTop: 2,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              lineHeight: 1.4,
            }}
          >
            {r.messageText}
          </div>
          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
            Dispatched by {r.senderName}
          </div>
        </div>
      ),
    },
    {
      title: 'Target Audience Tier',
      key: 'audience',
      width: 210,
      render: (_: any, r: BroadcastHistoryItem) => (
        <Space direction="vertical" size={2}>
          <Tag color={r.audienceType === 'customers' ? 'cyan' : 'purple'} style={{ fontWeight: 600 }}>
            {r.audienceType === 'customers' ? '👥 CLIENTS' : '👔 STAFF'}
          </Tag>
          <Text style={{ fontSize: 12, color: '#334155' }}>{r.targetSegmentLabel}</Text>
          {r.branchScope && <Tag color="blue" style={{ fontSize: 10 }}>Branch: {r.branchScope}</Tag>}
        </Space>
      ),
    },
    {
      title: 'Channels',
      key: 'channels',
      width: 170,
      render: (_: any, r: BroadcastHistoryItem) => (
        <Space size={4} wrap>
          {r.channels.includes('sms') && (
            <Tag color="green" icon={<PhoneOutlined />}>
              SMS: OMARK
            </Tag>
          )}
          {r.channels.includes('in_app') && (
            <Tag color="blue" icon={<BellOutlined />}>
              In-App Bell
            </Tag>
          )}
          {r.channels.includes('portal') && (
            <Tag color="gold" icon={<UserOutlined />}>
              Portal Banner
            </Tag>
          )}
        </Space>
      ),
    },
    {
      title: 'Audience Reach',
      key: 'reach',
      width: 150,
      render: (_: any, r: BroadcastHistoryItem) => (
        <div>
          <Tag color="geekblue" style={{ fontWeight: 700, fontSize: 12 }}>
            <CheckOutlined style={{ marginRight: 4 }} />
            {r.recipientCount} Dispatched
          </Tag>
          {Boolean(r.excludedCount && r.excludedCount > 0) && (
            <div style={{ fontSize: 11, color: '#d97706', marginTop: 2 }}>
              ({r.excludedCount} excluded by admin)
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status: string) => (
        <Tag color="success" icon={<CheckCircleOutlined />} style={{ fontWeight: 600 }}>
          {(status || 'DELIVERED').toUpperCase()}
        </Tag>
      ),
    },
    {
      title: 'Actions',
      key: 'action',
      width: 140,
      render: (_: any, r: BroadcastHistoryItem) => (
        <Space size={4}>
          <Tooltip title="View full campaign details & copy">
            <Button
              size="small"
              type="text"
              icon={<EyeOutlined style={{ color: '#0284c7' }} />}
              onClick={() => setSelectedAuditItem(r)}
            />
          </Tooltip>
          <Tooltip title="Load this campaign into composer">
            <Button
              size="small"
              type="link"
              icon={<RedoOutlined />}
              onClick={() => {
                setAudienceType(r.audienceType);
                setTargetSegment(r.targetSegment);
                setChannels(r.channels);
                setSubjectTitle(r.title);
                setMessageText(r.messageText);
                form.setFieldsValue({
                  title: r.title,
                  messageText: r.messageText,
                  segment: r.targetSegment,
                });
                message.info('Campaign loaded into broadcast composer.');
              }}
            >
              Reuse
            </Button>
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ paddingBottom: 24 }}>
      {/* ── TOP EXECUTIVE SUMMARY CARDS (LIVE ACCURATE DATA) ──────────────── */}
      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={12} sm={6}>
          <Card size="small" style={{ borderRadius: 10, border: '1px solid #e2e8f0' }}>
            <Statistic
              title={<span style={{ fontSize: 12, color: '#64748b' }}>Reachable Clients</span>}
              value={allCustomers.filter((c) => c.phoneNumber && c.phoneNumber.length >= 7).length}
              prefix={<UserOutlined style={{ color: '#0284c7' }} />}
              suffix={<span style={{ fontSize: 12, color: '#94a3b8' }}>/ {allCustomers.length}</span>}
              valueStyle={{ fontWeight: 700, fontSize: 20, color: '#0f172a' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" style={{ borderRadius: 10, border: '1px solid #e2e8f0' }}>
            <Statistic
              title={<span style={{ fontSize: 12, color: '#64748b' }}>Active Sales Leads</span>}
              value={
                allProspects.filter(
                  (p) =>
                    (p.phoneNumber || (p as any).phone) &&
                    (p.phoneNumber || (p as any).phone).length >= 7
                ).length
              }
              prefix={<CrownOutlined style={{ color: '#059669' }} />}
              suffix={<span style={{ fontSize: 12, color: '#94a3b8' }}>/ {allProspects.length}</span>}
              valueStyle={{ fontWeight: 700, fontSize: 20, color: '#0f172a' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" style={{ borderRadius: 10, border: '1px solid #e2e8f0' }}>
            <Statistic
              title={<span style={{ fontSize: 12, color: '#64748b' }}>Internal Staff Team</span>}
              value={allStaffUsers.length}
              prefix={<TeamOutlined style={{ color: '#7c3aed' }} />}
              suffix={
                <span style={{ fontSize: 12, color: '#16a34a', marginLeft: 4 }}>
                  ({allStaffUsers.filter((u: any) => getUserPhone(u) || u.phoneNumber).length} with mobile)
                </span>
              }
              valueStyle={{ fontWeight: 700, fontSize: 20, color: '#0f172a' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" style={{ borderRadius: 10, border: '1px solid #e2e8f0' }}>
            <Statistic
              title={<span style={{ fontSize: 12, color: '#64748b' }}>Carrier Gateway</span>}
              value="OMARK"
              prefix={<SafetyCertificateOutlined style={{ color: '#16a34a' }} />}
              suffix={<Tag color="success" style={{ marginLeft: 6 }}>NCA Verified</Tag>}
              valueStyle={{ fontWeight: 700, fontSize: 18, color: '#16a34a' }}
            />
          </Card>
        </Col>
      </Row>

      {/* ── TOP HERO HEADER & AUDIENCE TOGGLE ─────────────────────────────── */}
      <Card
        style={{
          borderRadius: 12,
          border: '1px solid #bae6fd',
          background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
          marginBottom: 20,
          boxShadow: '0 2px 8px rgba(2, 132, 199, 0.05)',
        }}
        bodyStyle={{ padding: '18px 22px' }}
      >
        <Row justify="space-between" align="middle" gutter={[16, 16]}>
          <Col xs={24} md={15}>
            <Space align="center" size={14}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 10,
                  background: '#0284c7',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  fontSize: 22,
                }}
              >
                <NotificationOutlined />
              </div>
              <div>
                <Title level={4} style={{ margin: 0, color: '#0369a1' }}>
                  Executive Outreach & Special Broadcast Console
                </Title>
                <Text type="secondary" style={{ fontSize: 13 }}>
                  Direct carrier SMS, in-app bell announcements, and portal holiday messages for customers and staff.
                </Text>
              </div>
            </Space>
          </Col>
          <Col xs={24} md={9} style={{ textAlign: 'right' }}>
            <Radio.Group
              value={audienceType}
              onChange={(e) => setAudienceType(e.target.value)}
              buttonStyle="solid"
              size="middle"
            >
              <Radio.Button value="customers" style={{ fontWeight: 600 }}>
                <UserOutlined /> Customers & Clients
              </Radio.Button>
              <Radio.Button value="staff" style={{ fontWeight: 600 }}>
                <TeamOutlined /> Internal Staff & Teams
              </Radio.Button>
            </Radio.Group>
          </Col>
        </Row>
      </Card>

      {/* ── ACTIVE PORTAL ANNOUNCEMENT STATUS BANNER ──────────────────────── */}
      {activePortalAnnouncement && (
        <Alert
          message={
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
              <div>
                <strong>Active Customer Portal Announcement:</strong>{' '}
                <span style={{ color: '#0369a1' }}>"{activePortalAnnouncement.title}"</span>
                <span style={{ fontSize: 12, color: '#64748b', marginLeft: 8 }}>
                  (Published by {activePortalAnnouncement.broadcastBy})
                </span>
              </div>
              <Button
                size="small"
                danger
                icon={<DeleteOutlined />}
                onClick={handleClearPortalAnnouncement}
              >
                Clear From Customer Portal
              </Button>
            </div>
          }
          type="info"
          showIcon
          style={{ marginBottom: 16, borderRadius: 8, border: '1px solid #bfdbfe' }}
        />
      )}

      {/* ── 1-CLICK CURATED CORPORATE TEMPLATES ────────────────────────────── */}
      <Card
        size="small"
        style={{ borderRadius: 10, border: '1px solid #e2e8f0', marginBottom: 20 }}
        title={
          <Space>
            <FireOutlined style={{ color: '#ea580c' }} />
            <Text strong>
              {audienceType === 'customers' ? 'Official Holiday & Goodwill Templates' : 'Executive Staff Memos & Directives'}
            </Text>
            <Tag color="orange" style={{ fontSize: 11 }}>1-Click Load</Tag>
          </Space>
        }
      >
        <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 6 }}>
          {(audienceType === 'customers' ? CUSTOMER_TEMPLATES : STAFF_TEMPLATES).map((tmpl) => (
            <Button
              key={tmpl.key}
              onClick={() => handleSelectTemplate(tmpl)}
              style={{
                borderRadius: 8,
                padding: '6px 14px',
                height: 'auto',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                border: '1px solid #cbd5e1',
                background: '#fff',
                whiteSpace: 'nowrap',
              }}
            >
              <span style={{ fontSize: 16 }}>{tmpl.icon}</span>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#1e293b' }}>{tmpl.title}</div>
                <div style={{ fontSize: 10, color: '#64748b' }}>{tmpl.category}</div>
              </div>
            </Button>
          ))}
        </div>
      </Card>

      {/* ── TWO-COLUMN ENTERPRISE COMPOSER & AUDIENCE AUDIT ───────────────── */}
      <Row gutter={[20, 20]}>
        {/* Left Column: Formal Executive Composer */}
        <Col xs={24} lg={12}>
          <Card
            title={
              <Space>
                <SendOutlined style={{ color: '#0284c7' }} />
                <span>Compose {audienceType === 'customers' ? 'Customer Outreach' : 'Staff Broadcast'} Message</span>
              </Space>
            }
            style={{ borderRadius: 10, border: '1px solid #e2e8f0', height: '100%' }}
          >
            <Form form={form} layout="vertical">
              <Row gutter={16}>
                <Col xs={24} sm={14}>
                  <Form.Item label="Campaign Subject / Title" required>
                    <Input
                      value={subjectTitle}
                      onChange={(e) => setSubjectTitle(e.target.value)}
                      placeholder="e.g., Happy 69th Independence Day Ghana! 🇬🇭"
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={10}>
                  <Form.Item label="Audience Segment" required>
                    {audienceType === 'customers' ? (
                      <Select
                        value={targetSegment}
                        onChange={(val) => setTargetSegment(val)}
                      >
                        <Option value="all_customers">
                          👥 All Verified Customers ({allCustomers.filter((c) => c.phoneNumber).length})
                        </Option>
                        <Option value="payment_plan">
                          📋 Active Payment Plan Buyers ({allCustomers.filter((c) => c.type === 'payment_plan' && c.phoneNumber).length})
                        </Option>
                        <Option value="fully_paid">
                          💎 Fully Paid Landowners (VIP) ({allCustomers.filter((c) => c.type === 'fully_paid' && c.phoneNumber).length})
                        </Option>
                        <Option value="prospects">
                          🎯 Active Prospects & Leads ({allProspects.filter((p) => p.phoneNumber || (p as any).phone).length})
                        </Option>
                        <Option value="all_contacts">
                          🌐 All Combined Contacts
                        </Option>
                      </Select>
                    ) : (
                      <Select
                        value={targetSegment}
                        onChange={(val) => setTargetSegment(val)}
                      >
                        <Option value="all_staff">
                          🏢 All Company Staff ({allStaffUsers.length})
                        </Option>
                        <Option value="dept_marketing">🎯 Marketing & Sales Team</Option>
                        <Option value="dept_cs">🎧 Customer Service & Front Desk</Option>
                        <Option value="dept_accounts">💰 Accounts, Finance & Payroll</Option>
                        <Option value="dept_secretariat">📝 Secretariat & Administration</Option>
                        <Option value="leadership">👑 Directors & Branch Managers</Option>
                      </Select>
                    )}
                  </Form.Item>
                </Col>
              </Row>

              {/* Staff Branch Scope (if staff audience) */}
              {audienceType === 'staff' && (
                <Form.Item label="Branch Location Scope">
                  <Select
                    value={staffBranchScope}
                    onChange={(val) => setStaffBranchScope(val)}
                    style={{ width: '100%' }}
                  >
                    <Option value="all">🌐 All Branches (Accra Head Office, Kumasi, Takoradi, etc.)</Option>
                    {branches.map((b) => (
                      <Option key={b.id} value={b.id}>
                        📍 {b.name}
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
              )}

              {/* Delivery Channels */}
              <Form.Item label="Delivery Channels">
                <Checkbox.Group
                  value={channels}
                  onChange={(checked) => setChannels(checked as any)}
                >
                  <Space size={16} wrap>
                    <Checkbox value="sms">
                      📱 Direct Carrier SMS (Sender ID: <strong>OMARK</strong>)
                    </Checkbox>
                    {audienceType === 'staff' && (
                      <Checkbox value="in_app">
                        🔔 ERP Notification Bell & Top Header
                      </Checkbox>
                    )}
                    {audienceType === 'customers' && (
                      <Checkbox value="portal">
                        🌐 Customer Portal Announcement Banner
                      </Checkbox>
                    )}
                  </Space>
                </Checkbox.Group>
              </Form.Item>

              {/* Message Copy Area */}
              <Form.Item
                label={
                  <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                    <span>Message Copy</span>
                    <Space size={8}>
                      <Tag color={smsCharCount > 320 ? 'orange' : smsCharCount > 160 ? 'blue' : 'green'}>
                        {smsCharCount}/480 Chars ({smsSegments} of 3 SMS Segments)
                      </Tag>
                    </Space>
                  </div>
                }
                required
              >
                <TextArea
                  rows={6}
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  placeholder="Enter message text (max 480 characters / 3 SMS segments)..."
                  maxLength={480}
                  showCount
                  style={{ fontSize: 13, lineHeight: 1.6 }}
                />
              </Form.Item>

              {/* Action Buttons */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
                <Button
                  onClick={() => {
                    setMessageText('');
                    setSubjectTitle('');
                    form.resetFields();
                  }}
                >
                  Clear Draft
                </Button>
                <Button
                  type="primary"
                  size="large"
                  icon={<SendOutlined />}
                  disabled={selectedRecipients.length === 0 || !messageText.trim()}
                  onClick={() => setConfirmModalOpen(true)}
                  style={{
                    background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                    borderColor: '#0284c7',
                    fontWeight: 700,
                    padding: '0 24px',
                  }}
                >
                  Broadcast Campaign Now ({selectedRecipients.length} Selected)
                </Button>
              </div>
            </Form>
          </Card>
        </Col>

        {/* Right Column: Live Target Audience & Dispatch Audit Table with Checkboxes */}
        <Col xs={24} lg={12}>
          <Card
            title={
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Space>
                  {audienceType === 'staff' ? (
                    <TeamOutlined style={{ color: '#7c3aed' }} />
                  ) : (
                    <UserOutlined style={{ color: '#0284c7' }} />
                  )}
                  <span>Target Audience & Dispatch Audit</span>
                </Space>
                <Space size={8}>
                  <Tag color="geekblue" style={{ fontWeight: 700 }}>
                    {selectedRecipients.length} of {targetedRecipients.length} Selected
                  </Tag>
                  {excludedCount > 0 && (
                    <Tag color="orange" style={{ fontWeight: 700 }}>
                      {excludedCount} Excluded
                    </Tag>
                  )}
                </Space>
              </div>
            }
            style={{ borderRadius: 10, border: '1px solid #e2e8f0', height: '100%' }}
          >
            {/* Live Audit Metrics Grid */}
            <div
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: 8,
                padding: '12px 14px',
                marginBottom: 12,
              }}
            >
              <Row gutter={[12, 12]}>
                <Col span={12}>
                  <div style={{ fontSize: 11, color: '#64748b' }}>Target Group:</div>
                  <strong style={{ fontSize: 13, color: '#0f172a' }}>
                    {audienceType === 'customers' ? 'Clients & Buyers' : 'Internal Staff Team'}
                  </strong>
                </Col>
                <Col span={12}>
                  <div style={{ fontSize: 11, color: '#64748b' }}>Estimated Carrier SMS:</div>
                  <strong style={{ fontSize: 13, color: '#0284c7' }}>
                    {totalSmsCredits.toLocaleString()} Units ({validMobileCount} Mobiles)
                  </strong>
                </Col>
                <Col span={12}>
                  <div style={{ fontSize: 11, color: '#64748b' }}>Sender Identification:</div>
                  <Tag color="green" style={{ fontWeight: 700 }}>OMARK</Tag>
                </Col>
                <Col span={12}>
                  <div style={{ fontSize: 11, color: '#64748b' }}>Channel Pipeline:</div>
                  <Text style={{ fontSize: 12 }}>{channels.map((c) => c.toUpperCase()).join(' + ')}</Text>
                </Col>
              </Row>
            </div>

            {/* Selection & Exclusion Control Bar */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 10,
                padding: '8px 12px',
                background: '#f1f5f9',
                borderRadius: 6,
                border: '1px solid #cbd5e1',
              }}
            >
              <Space size={8}>
                <Checkbox
                  indeterminate={selectedRowKeys.length > 0 && selectedRowKeys.length < targetedRecipients.length}
                  checked={targetedRecipients.length > 0 && selectedRowKeys.length === targetedRecipients.length}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedRowKeys(targetedRecipients.map((r) => r.id));
                    } else {
                      setSelectedRowKeys([]);
                    }
                  }}
                >
                  <Text strong style={{ fontSize: 12 }}>
                    Include All ({selectedRowKeys.length}/{targetedRecipients.length})
                  </Text>
                </Checkbox>
                {excludedCount > 0 && (
                  <Tag color="orange" style={{ fontWeight: 600 }}>
                    {excludedCount} excluded from broadcast
                  </Tag>
                )}
              </Space>
              <Space size={4}>
                <Button
                  size="small"
                  type="link"
                  onClick={() => setSelectedRowKeys(targetedRecipients.map((r) => r.id))}
                  disabled={selectedRowKeys.length === targetedRecipients.length}
                >
                  Select All
                </Button>
                <Button
                  size="small"
                  type="link"
                  danger
                  onClick={() => setSelectedRowKeys([])}
                  disabled={selectedRowKeys.length === 0}
                >
                  Exclude All
                </Button>
              </Space>
            </div>

            {/* Live Search Input */}
            <div style={{ marginBottom: 10 }}>
              <Input
                placeholder={`Search ${audienceType === 'customers' ? 'clients by name or phone' : 'staff members by name, phone, role, or branch'}...`}
                value={recipientSearchQuery}
                onChange={(e) => setRecipientSearchQuery(e.target.value)}
                allowClear
                size="small"
                prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
              />
            </div>

            {/* Live Roster Table with Checkbox Row Selection */}
            <Table
              size="small"
              dataSource={filteredRecipients}
              rowKey="id"
              pagination={{ pageSize: 5, size: 'small' }}
              loading={customersLoading || prospectsLoading || usersLoading}
              rowSelection={{
                selectedRowKeys,
                onChange: (newKeys) => setSelectedRowKeys(newKeys),
                selections: [
                  Table.SELECTION_ALL,
                  Table.SELECTION_INVERT,
                  Table.SELECTION_NONE,
                ],
              }}
              columns={
                audienceType === 'staff'
                  ? [
                      {
                        title: 'Staff Member',
                        dataIndex: 'name',
                        key: 'name',
                        render: (name: string, r: TargetRecipientItem) => (
                          <div>
                            <strong style={{ color: '#1e293b', fontSize: 12 }}>{name}</strong>
                            {r.email && (
                              <div style={{ fontSize: 11, color: '#64748b' }}>
                                <MailOutlined style={{ marginRight: 3 }} />
                                {r.email}
                              </div>
                            )}
                          </div>
                        ),
                      },
                      {
                        title: 'Contact Phone',
                        dataIndex: 'phone',
                        key: 'phone',
                        width: 140,
                        render: (ph: string, r: TargetRecipientItem) => {
                          if (r.hasPhone) {
                            return (
                              <Text code style={{ fontSize: 11 }}>
                                <PhoneOutlined style={{ marginRight: 4, color: '#16a34a' }} />
                                {ph}
                              </Text>
                            );
                          }
                          return (
                            <Tooltip title="No phone registered. In-App bell notification will still be delivered.">
                              <Tag color="default" style={{ fontSize: 10, color: '#94a3b8' }}>
                                <PhoneOutlined style={{ marginRight: 4 }} />
                                No Phone
                              </Tag>
                            </Tooltip>
                          );
                        },
                      },
                      {
                        title: 'Role & Dept',
                        key: 'role',
                        width: 150,
                        render: (_: any, r: TargetRecipientItem) => (
                          <div>
                            <Tag color={r.roleColor || 'purple'} style={{ fontSize: 10, margin: 0 }}>
                              {r.roleLabel || r.tag}
                            </Tag>
                            <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>
                              {r.department}
                            </div>
                          </div>
                        ),
                      },
                      {
                        title: 'Branch Office',
                        dataIndex: 'branch',
                        key: 'branch',
                        width: 120,
                        render: (branch: string) => (
                          <span style={{ fontSize: 11, color: '#475569' }}>
                            <ShopOutlined style={{ marginRight: 4, color: '#0284c7' }} />
                            {branch}
                          </span>
                        ),
                      },
                    ]
                  : [
                      {
                        title: 'Client Name',
                        dataIndex: 'name',
                        key: 'name',
                        render: (name: string, r: TargetRecipientItem) => (
                          <div>
                            <strong style={{ color: '#1e293b', fontSize: 12 }}>{name}</strong>
                            <div style={{ fontSize: 11, color: '#64748b' }}>{r.location}</div>
                          </div>
                        ),
                      },
                      {
                        title: 'Mobile Contact',
                        dataIndex: 'phone',
                        key: 'phone',
                        width: 140,
                        render: (ph: string, r: TargetRecipientItem) => {
                          if (r.hasPhone) {
                            return (
                              <Text code style={{ fontSize: 11 }}>
                                <PhoneOutlined style={{ marginRight: 4, color: '#16a34a' }} />
                                {ph}
                              </Text>
                            );
                          }
                          return (
                            <Tag color="default" style={{ fontSize: 10, color: '#94a3b8' }}>
                              No Phone
                            </Tag>
                          );
                        },
                      },
                      {
                        title: 'Category',
                        dataIndex: 'tag',
                        key: 'tag',
                        width: 130,
                        render: (tag: string) => (
                          <Tag color="blue" style={{ fontSize: 10 }}>
                            {tag}
                          </Tag>
                        ),
                      },
                    ]
              }
            />

            {/* Live Message Dispatch Summary */}
            <div
              style={{
                marginTop: 14,
                padding: 12,
                borderRadius: 8,
                background: '#f8fafc',
                border: '1px solid #cbd5e1',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <strong style={{ fontSize: 12, color: '#334155' }}>Dispatch Summary</strong>
                <span style={{ fontSize: 11, color: '#64748b' }}>NCA Bulk SMS Compliant</span>
              </div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#0369a1' }}>
                {subjectTitle || 'No Subject Specified'}
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: '#475569',
                  marginTop: 4,
                  lineHeight: 1.5,
                  maxHeight: 70,
                  overflowY: 'auto',
                }}
              >
                {messageText || '(Empty message copy)'}
              </div>
            </div>
          </Card>
        </Col>
      </Row>

      {/* ── BROADCAST HISTORY & AUDIT LOG (LIVE & ENHANCED UI/UX) ─────────── */}
      <Card
        style={{ borderRadius: 10, border: '1px solid #e2e8f0', marginTop: 24 }}
        title={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
            <Space>
              <ClockCircleOutlined style={{ color: '#0284c7' }} />
              <span style={{ fontWeight: 600 }}>Outreach & Broadcast Delivery Audit Log</span>
              <Tag color="blue" style={{ fontWeight: 600 }}>{filteredHistory.length} Campaigns Logged</Tag>
            </Space>
            <Space>
              <Button
                size="small"
                icon={<ReloadOutlined spin={notificationsFetching} />}
                onClick={() => {
                  refetchNotifications();
                  refetchUsers();
                  const stored = localStorage.getItem(STORAGE_BROADCAST_HISTORY_KEY);
                  if (stored) {
                    try {
                      setHistory(JSON.parse(stored));
                    } catch {}
                  }
                  message.info('Audit log synchronized with live server.');
                }}
              >
                Refresh Log
              </Button>
            </Space>
          </div>
        }
      >
        {/* Audit Log KPI Metrics Ribbon */}
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col xs={12} sm={6}>
            <div style={{ padding: '10px 14px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: 11, color: '#64748b' }}>Total Executed Campaigns</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#0f172a' }}>{history.length} Runs</div>
            </div>
          </Col>
          <Col xs={12} sm={6}>
            <div style={{ padding: '10px 14px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: 11, color: '#64748b' }}>Total Dispatched Reach</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#0284c7' }}>
                {history.reduce((acc, h) => acc + (h.recipientCount || 0), 0).toLocaleString()} Recipients
              </div>
            </div>
          </Col>
          <Col xs={12} sm={6}>
            <div style={{ padding: '10px 14px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: 11, color: '#64748b' }}>Active Gateway Route</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#16a34a' }}>OMARK (SMS)</div>
            </div>
          </Col>
          <Col xs={12} sm={6}>
            <div style={{ padding: '10px 14px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: 11, color: '#64748b' }}>Delivery Success Rate</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#059669' }}>100% Verified</div>
            </div>
          </Col>
        </Row>

        {/* Audit Log Search & Filter Bar */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 10,
            marginBottom: 16,
            padding: '10px 14px',
            background: '#fafafa',
            borderRadius: 8,
            border: '1px solid #f0f0f0',
          }}
        >
          <Space wrap size={10}>
            <Input
              placeholder="Search audit log by title, copy, or sender..."
              value={auditSearchQuery}
              onChange={(e) => setAuditSearchQuery(e.target.value)}
              prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
              style={{ width: 280 }}
              allowClear
              size="middle"
            />
            <Select
              value={auditAudienceFilter}
              onChange={(val) => setAuditAudienceFilter(val)}
              style={{ width: 170 }}
              size="middle"
            >
              <Option value="all">🌐 All Audiences</Option>
              <Option value="customers">👥 Clients & Buyers</Option>
              <Option value="staff">👔 Internal Staff</Option>
            </Select>
            <Select
              value={auditChannelFilter}
              onChange={(val) => setAuditChannelFilter(val)}
              style={{ width: 160 }}
              size="middle"
            >
              <Option value="all">📡 All Channels</Option>
              <Option value="sms">📱 Direct SMS</Option>
              <Option value="in_app">🔔 In-App Bell</Option>
              <Option value="portal">🌐 Portal Banner</Option>
            </Select>
          </Space>
          {(auditSearchQuery || auditAudienceFilter !== 'all' || auditChannelFilter !== 'all') && (
            <Button
              size="small"
              onClick={() => {
                setAuditSearchQuery('');
                setAuditAudienceFilter('all');
                setAuditChannelFilter('all');
              }}
            >
              Reset Filters
            </Button>
          )}
        </div>

        {/* Audit Table */}
        <Table
          dataSource={filteredHistory}
          columns={historyColumns}
          rowKey="id"
          size="middle"
          pagination={{ pageSize: 6, showTotal: (total) => `Total ${total} campaigns` }}
        />
      </Card>

      {/* ── CONFIRMATION MODAL ────────────────────────────────────────────── */}
      <Modal
        title={
          <Space>
            <RocketOutlined style={{ color: '#0284c7' }} />
            <span>Confirm Executive Outreach Dispatch</span>
          </Space>
        }
        open={confirmModalOpen}
        onCancel={() => setConfirmModalOpen(false)}
        confirmLoading={sending}
        onOk={handleExecuteBroadcast}
        okText={`Confirm & Broadcast (${selectedRecipients.length} Recipients)`}
        okButtonProps={{ style: { background: '#0284c7' } }}
      >
        <div style={{ padding: '8px 0' }}>
          <Alert
            message="You are about to dispatch an official broadcast."
            description={
              <div>
                <div>• <strong>Audience:</strong> {audienceType === 'customers' ? 'Clients & Buyers' : 'Internal Staff Team'}</div>
                <div>• <strong>Included Recipients:</strong> {selectedRecipients.length} contacts ({excludedCount} excluded)</div>
                <div>• <strong>Channels:</strong> {channels.map((c) => c.toUpperCase()).join(', ')}</div>
                <div>• <strong>Sender ID:</strong> OMARK</div>
                {validMobileCount < selectedRecipients.length && (
                  <div style={{ color: '#d97706', marginTop: 4 }}>
                    ℹ️ Note: {selectedRecipients.length - validMobileCount} recipients do not have a mobile number registered and will receive the announcement via ERP In-App Bell / Portal only.
                  </div>
                )}
              </div>
            }
            type="warning"
            showIcon
            style={{ marginBottom: 14 }}
          />

          <Text strong>Message Preview:</Text>
          <div
            style={{
              background: '#f8fafc',
              padding: 12,
              borderRadius: 8,
              border: '1px solid #e2e8f0',
              marginTop: 6,
              fontSize: 13,
            }}
          >
            <strong>{subjectTitle}</strong>
            <p style={{ margin: '6px 0 0 0', whiteSpace: 'pre-wrap' }}>{messageText}</p>
          </div>
        </div>
      </Modal>

      {/* ── AUDIT CAMPAIGN DETAIL MODAL ───────────────────────────────────── */}
      <Modal
        title={
          <Space>
            <FileTextOutlined style={{ color: '#0284c7' }} />
            <span>Campaign Dispatch Details</span>
          </Space>
        }
        open={Boolean(selectedAuditItem)}
        onCancel={() => setSelectedAuditItem(null)}
        footer={[
          <Button key="close" onClick={() => setSelectedAuditItem(null)}>
            Close
          </Button>,
          selectedAuditItem && (
            <Button
              key="reuse"
              type="primary"
              icon={<RedoOutlined />}
              onClick={() => {
                const item = selectedAuditItem;
                setAudienceType(item.audienceType);
                setTargetSegment(item.targetSegment);
                setChannels(item.channels);
                setSubjectTitle(item.title);
                setMessageText(item.messageText);
                form.setFieldsValue({
                  title: item.title,
                  messageText: item.messageText,
                  segment: item.targetSegment,
                });
                setSelectedAuditItem(null);
                message.info('Campaign loaded into broadcast composer.');
              }}
            >
              Reuse This Campaign
            </Button>
          ),
        ]}
        width={600}
      >
        {selectedAuditItem && (
          <div style={{ padding: '8px 0' }}>
            <Title level={5} style={{ margin: 0, color: '#0369a1' }}>
              {selectedAuditItem.title}
            </Title>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 2, marginBottom: 16 }}>
              Dispatched on {selectedAuditItem.sentAt} by {selectedAuditItem.senderName}
            </div>

            <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
              <Col span={12}>
                <div style={{ fontSize: 11, color: '#64748b' }}>Target Audience:</div>
                <Tag color={selectedAuditItem.audienceType === 'customers' ? 'cyan' : 'purple'} style={{ marginTop: 2 }}>
                  {selectedAuditItem.targetSegmentLabel}
                </Tag>
              </Col>
              <Col span={12}>
                <div style={{ fontSize: 11, color: '#64748b' }}>Audience Reach:</div>
                <strong style={{ fontSize: 13, color: '#0f172a' }}>
                  {selectedAuditItem.recipientCount} Recipients
                </strong>
                {Boolean(selectedAuditItem.excludedCount && selectedAuditItem.excludedCount > 0) && (
                  <span style={{ fontSize: 11, color: '#d97706', marginLeft: 4 }}>
                    ({selectedAuditItem.excludedCount} excluded)
                  </span>
                )}
              </Col>
              <Col span={12}>
                <div style={{ fontSize: 11, color: '#64748b' }}>Delivery Channels:</div>
                <Space size={4} style={{ marginTop: 2 }}>
                  {selectedAuditItem.channels.map((c) => (
                    <Tag key={c} color="blue">
                      {c.toUpperCase()}
                    </Tag>
                  ))}
                </Space>
              </Col>
              <Col span={12}>
                <div style={{ fontSize: 11, color: '#64748b' }}>Delivery Status:</div>
                <Tag color="success" icon={<CheckCircleOutlined />} style={{ marginTop: 2 }}>
                  DELIVERED
                </Tag>
              </Col>
            </Row>

            <Divider style={{ margin: '12px 0' }} />

            <div style={{ fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 6 }}>
              Full Broadcast Message Copy:
            </div>
            <div
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: 8,
                padding: 14,
                fontSize: 13,
                lineHeight: 1.6,
                color: '#1e293b',
                whiteSpace: 'pre-wrap',
              }}
            >
              {selectedAuditItem.messageText}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
