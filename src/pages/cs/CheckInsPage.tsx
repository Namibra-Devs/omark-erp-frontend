// src/pages/cs/CheckInsPage.tsx
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Card, Row, Col, Typography, Statistic, Table, Tag, Space, Button,
  Modal, Form, Input, Select, DatePicker, message, Tooltip, Popconfirm,
  Drawer, Descriptions, Badge, Divider, Alert, AutoComplete, QRCode, Avatar,
  Segmented
} from 'antd';
import {
  UserAddOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  SearchOutlined,
  PlusOutlined,
  LogoutOutlined,
  EyeOutlined,
  EditOutlined,
  DeleteOutlined,
  CalendarOutlined,
  FilterOutlined,
  IdcardOutlined,
  PrinterOutlined,
  ExportOutlined,
  PhoneOutlined,
  MailOutlined,
  TeamOutlined,
  EnvironmentOutlined,
  InfoCircleOutlined,
  TagOutlined,
  SendOutlined,
  WhatsAppOutlined,
  ShareAltOutlined,
  QrcodeOutlined,
  TikTokOutlined,
  FacebookOutlined,
  InstagramOutlined,
  YoutubeOutlined,
  ClearOutlined,
  ReloadOutlined,
  MessageOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { useAuth } from '@/contexts/AuthContext';
import { PageHeader } from '@/components/shared/PageHeader';
import { useUsersQuery, getUserFullName } from '@/api/users';
import { useBranchesQuery } from '@/api/branches';
import { getUserBranchId, getBranchCanonicalKey } from '@/utils/branchIsolation';
import { tokens } from '@/constants/tokens';
import { PhoneInput } from '@/components/shared/PhoneInput';
import { markSeen } from '@/utils/seenTracker';
import {
  useCheckIns,
  visitorCategoryLabels,
  checkInStatusLabels,
  type CheckInRecord,
  type CheckInStatus,
  type VisitorCategory,
} from '@/utils/visitorCheckIns';

dayjs.extend(relativeTime);

const { Text, Title, Paragraph } = Typography;
const { Option } = Select;
const { TextArea } = Input;

/** Helper to format elapsed or total visit duration */
const formatDuration = (checkInTime: string, checkOutTime?: string): string => {
  if (!checkInTime) return '—';
  const start = dayjs(checkInTime);
  const end = checkOutTime ? dayjs(checkOutTime) : dayjs();
  const diffMinutes = Math.max(0, end.diff(start, 'minute'));
  if (diffMinutes < 1) return '< 1m';
  if (diffMinutes < 60) return `${diffMinutes}m`;
  const hours = Math.floor(diffMinutes / 60);
  const mins = diffMinutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
};

/** Helper to extract initials for visitor avatar */
const getInitials = (name: string): string => {
  if (!name) return 'V';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

/** Deterministic pastel/primary background color for avatar based on visitor name */
const getAvatarColor = (name: string): string => {
  const colors = ['#2E5E8C', '#1890ff', '#52c41a', '#722ed1', '#d46b08', '#08979c', '#c41d7f', '#13c2c2'];
  let hash = 0;
  for (let i = 0; i < (name || '').length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};

export const CheckInsPage: React.FC = () => {
  const { user, hasRole } = useAuth();
  const currentBranchId = getUserBranchId(user);
  const { data: branches = [] } = useBranchesQuery();
  const { data: usersData } = useUsersQuery();
  const staffList = usersData?.items ?? [];

  // Active branch selector: default to 'all' so no check-ins are hidden
  const [selectedBranchId, setSelectedBranchId] = useState<string>('all');
  const [justAddedId, setJustAddedId] = useState<string | null>(null);
  const [passPreviewMode, setPassPreviewMode] = useState<'card' | 'thermal'>('card');

  const {
    records,
    addCheckIn,
    updateCheckIn,
    checkOutVisitor,
    deleteCheckIn,
  } = useCheckIns(selectedBranchId, branches);

  // Clear unread badge counter when viewing check-ins page
  useEffect(() => {
    if (user?.id) {
      markSeen('check-ins', user.id);
    }
  }, [user?.id, records]);

  // ── Filters & Search State ────────────────────────────────────────────────
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<CheckInStatus | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = useState<VisitorCategory | 'all'>('all');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'weekly' | 'monthly' | 'yearly' | 'custom'>('all');
  const [customDateRange, setCustomDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);

  // ── Responsive Drawer Width ───────────────────────────────────────────────
  const [drawerWidth, setDrawerWidth] = useState<number>(500);
  useEffect(() => {
    const updateDrawerWidth = () => {
      if (typeof window !== 'undefined') {
        setDrawerWidth(Math.min(520, window.innerWidth - 20));
      }
    };
    updateDrawerWidth();
    window.addEventListener('resize', updateDrawerWidth);
    return () => window.removeEventListener('resize', updateDrawerWidth);
  }, []);

  // ── Filter Clear / Reset Helper ───────────────────────────────────────────
  const isFiltered = Boolean(
    searchText ||
    statusFilter !== 'all' ||
    categoryFilter !== 'all' ||
    dateFilter !== 'all' ||
    selectedBranchId !== 'all'
  );

  const resetAllFilters = () => {
    setSearchText('');
    setStatusFilter('all');
    setCategoryFilter('all');
    setDateFilter('all');
    setCustomDateRange(null);
    setSelectedBranchId('all');
  };

  // ── Modals & Drawers ──────────────────────────────────────────────────────
  const [checkInModalOpen, setCheckInModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<CheckInRecord | null>(null);
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<CheckInRecord | null>(null);
  const [checkOutModalOpen, setCheckOutModalOpen] = useState(false);
  const [recordToCheckOut, setRecordToCheckOut] = useState<CheckInRecord | null>(null);
  const [visitorPassModalOpen, setVisitorPassModalOpen] = useState(false);
  const [recordForPass, setRecordForPass] = useState<CheckInRecord | null>(null);

  const [form] = Form.useForm();
  const [editForm] = Form.useForm();
  const [checkOutForm] = Form.useForm();

  // ── Filter records by Search, Category, Status, and Date ──────────────────
  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      // Search
      if (searchText) {
        const query = searchText.toLowerCase();
        const matchesName = r.visitorName.toLowerCase().includes(query);
        const matchesPhone = r.phoneNumber.toLowerCase().includes(query);
        const matchesCode = r.code.toLowerCase().includes(query);
        const matchesPurpose = r.purpose.toLowerCase().includes(query);
        const matchesHost = (r.hostStaffName || '').toLowerCase().includes(query);
        const matchesBadge = (r.badgeNumber || '').toLowerCase().includes(query);
        if (!matchesName && !matchesPhone && !matchesCode && !matchesPurpose && !matchesHost && !matchesBadge) {
          return false;
        }
      }

      // Status
      if (statusFilter !== 'all' && r.status !== statusFilter) {
        return false;
      }

      // Category
      if (categoryFilter !== 'all' && r.category !== categoryFilter) {
        return false;
      }

      // Date
      if (dateFilter !== 'all') {
        const itemDate = dayjs(r.checkInTime || r.createdAt);
        const now = dayjs();
        if (dateFilter === 'today' && !itemDate.isSame(now, 'day')) {
          return false;
        }
        if (dateFilter === 'weekly' && !itemDate.isSame(now, 'week')) {
          return false;
        }
        if (dateFilter === 'monthly' && !itemDate.isSame(now, 'month')) {
          return false;
        }
        if (dateFilter === 'yearly' && !itemDate.isSame(now, 'year')) {
          return false;
        }
        if (dateFilter === 'custom' && customDateRange && customDateRange[0] && customDateRange[1]) {
          const start = customDateRange[0].startOf('day');
          const end = customDateRange[1].endOf('day');
          if (itemDate.isBefore(start) || itemDate.isAfter(end)) {
            return false;
          }
        }
      }

      return true;
    });
  }, [records, searchText, statusFilter, categoryFilter, dateFilter, customDateRange]);

  // ── Key Statistics ────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const today = dayjs();
    const todayRecords = records.filter((r) => dayjs(r.checkInTime || r.createdAt).isSame(today, 'day'));
    const onPremises = records.filter((r) => r.status === 'in_premises').length;
    const inLobby = records.filter((r) => r.status === 'waiting').length;
    const completedToday = todayRecords.filter((r) => r.status === 'completed').length;
    const totalThisMonth = records.filter((r) => dayjs(r.checkInTime || r.createdAt).isSame(today, 'month')).length;

    return {
      onPremises,
      inLobby,
      completedToday,
      totalThisMonth,
      totalRecorded: records.length,
    };
  }, [records]);

  // ── Official Visitor Pass SMS Generator ──────────────────────────────────
  const generateSmsPassText = (_record: CheckInRecord) => {
    return `Thank you for visiting Omark Real Estate & Construction

We appreciate your time and trust

Omark renders the following services:
Genuine Land Documentation
Building and Construction
Architectural Services
Project Management
Genuine Land Sales
Reach out to US:
Tiktok: omark.group.of.companies
Facebook: Omark Prop
Instagram: omark_real_estate
YouTube: @omark2
call or whatsapp: 054 602 9075`;
  };

  // ── Visitor Pass SMS Dispatch Handler ───────────────────────────────────────
  const handleSendPassToVisitor = (record: CheckInRecord | null) => {
    if (!record) return;

    const summaryText = generateSmsPassText(record);
    const cleanPhone = record.phoneNumber.replace(/[^\d+]/g, '');
    const smsUrl = `sms:${cleanPhone}?body=${encodeURIComponent(summaryText)}`;

    try {
      window.location.href = smsUrl;
    } catch (e) {
      window.open(smsUrl, '_self');
    }

    message.success(`Opening SMS to send pass to ${record.visitorName} (${cleanPhone || record.phoneNumber})...`);
  };

  // ── Print 80mm Thermal / Standard Pass Handler (Strictly 1 Page Guarantee) ──
  const handlePrintThermalPass = (record: CheckInRecord | null, mode: 'card' | 'thermal' = passPreviewMode) => {
    if (!record) return;
    setRecordForPass(record);

    setTimeout(() => {
      const isThermal = mode === 'thermal';
      const elementId = isThermal ? 'thermal-receipt-slip' : 'visitor-pass-print-card';
      const slipElement = document.getElementById(elementId);
      if (!slipElement) {
        window.print();
        return;
      }

      // Create isolated hidden iframe for pure 1-page printing
      const iframeId = '__omark_thermal_receipt_print_frame__';
      let iframe = document.getElementById(iframeId) as HTMLIFrameElement | null;
      if (iframe) {
        iframe.remove();
      }

      iframe = document.createElement('iframe');
      iframe.id = iframeId;
      iframe.style.position = 'fixed';
      iframe.style.top = '-9999px';
      iframe.style.left = '-9999px';
      iframe.style.width = isThermal ? '72mm' : '210mm';
      iframe.style.height = isThermal ? '160mm' : '297mm';
      iframe.style.border = '0';
      iframe.style.opacity = '0';
      iframe.style.pointerEvents = 'none';
      document.body.appendChild(iframe);

      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!doc) {
        window.print();
        return;
      }

      doc.open();
      doc.write(`<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Visitor Pass - ${record.code}</title>
    <style>
      @page {
        size: ${isThermal ? 'auto' : 'portrait'};
        margin: ${isThermal ? '0' : '8mm'};
      }
      * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      html, body {
        width: ${isThermal ? '72mm' : '100%'};
        max-width: ${isThermal ? '72mm' : '194mm'};
        margin: 0 auto;
        padding: 0;
        background: #ffffff;
        color: #000000;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      }
      .print-content-wrapper {
        width: 100%;
        max-width: ${isThermal ? '70mm' : '190mm'};
        margin: 0 auto;
        padding: ${isThermal ? '1.5mm 1mm 1.5mm 1mm' : '0'};
        page-break-inside: avoid;
        break-inside: avoid;
        page-break-after: avoid;
        break-after: avoid;
      }
      img {
        max-width: 100%;
        height: auto;
      }
    </style>
  </head>
  <body>
    <div class="print-content-wrapper">
      ${slipElement.innerHTML}
    </div>
  </body>
</html>`);
      doc.close();

      setTimeout(() => {
        try {
          iframe?.contentWindow?.focus();
          iframe?.contentWindow?.print();
        } catch (err) {
          window.print();
        } finally {
          setTimeout(() => {
            iframe?.remove();
          }, 3000);
        }
      }, 150);
    }, 60);
  };

  // ── Check-in Submission ───────────────────────────────────────────────────
  const handleCheckInSubmit = async (values: any) => {
    try {
      const hostStaff = staffList.find((s) => s.id === values.hostStaffId);
      const hostStaffName = hostStaff ? getUserFullName(hostStaff) : values.customHostStaff;
      const receptionistName = user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : 'Front Desk';
      const branchId = values.branchId || (selectedBranchId !== 'all' ? selectedBranchId : (currentBranchId || branches[0]?.id || 'b2'));

      const newRecord = addCheckIn({
        branchId,
        visitorName: values.visitorName.trim(),
        phoneNumber: values.phoneNumber.trim(),
        email: values.email?.trim() || undefined,
        category: values.category,
        purpose: values.purpose.trim(),
        hostStaffId: values.hostStaffId,
        hostStaffName: hostStaffName || undefined,
        hostDepartment: values.hostDepartment || undefined,
        checkInTime: new Date().toISOString(),
        status: values.status || 'in_premises',
        badgeNumber: values.badgeNumber?.trim() || undefined,
        notes: values.notes?.trim() || undefined,
        handledByUserId: user?.id,
        handledByName: receptionistName,
      });

      // Clear any conflicting active filters so the new visitor is guaranteed visible at the top
      setSearchText('');
      setStatusFilter('all');
      setCategoryFilter('all');
      setDateFilter('all');
      setCustomDateRange(null);
      setSelectedBranchId('all');

      setJustAddedId(newRecord.id);
      setTimeout(() => setJustAddedId(null), 15000);

      message.success(`Client ${values.visitorName} checked in successfully! Pass created.`);
      setCheckInModalOpen(false);
      form.resetFields();

      // Automatically open the enlarged Visitor Pass modal
      setRecordForPass(newRecord);
      setVisitorPassModalOpen(true);
    } catch (err: any) {
      message.error(err.message || 'Failed to check in visitor');
    }
  };

  // ── Check-out Handler ─────────────────────────────────────────────────────
  const handleQuickCheckOut = (record: CheckInRecord) => {
    setRecordToCheckOut(record);
    checkOutForm.setFieldsValue({ notes: record.notes || '' });
    setCheckOutModalOpen(true);
  };

  const confirmCheckOut = (values: any) => {
    if (!recordToCheckOut) return;
    try {
      checkOutVisitor(recordToCheckOut.id, values.notes);
      message.success(`${recordToCheckOut.visitorName} has been checked out.`);
      setCheckOutModalOpen(false);
      setRecordToCheckOut(null);
    } catch (err: any) {
      message.error(err.message || 'Check out failed');
    }
  };

  // ── Edit Record Handler ───────────────────────────────────────────────────
  const handleEditClick = (record: CheckInRecord) => {
    setEditingRecord(record);
    editForm.setFieldsValue({
      branchId: record.branchId,
      visitorName: record.visitorName,
      phoneNumber: record.phoneNumber,
      email: record.email,
      category: record.category,
      purpose: record.purpose,
      hostStaffId: record.hostStaffId,
      hostDepartment: record.hostDepartment,
      status: record.status,
      badgeNumber: record.badgeNumber,
      notes: record.notes,
    });
  };

  const handleEditSubmit = (values: any) => {
    if (!editingRecord) return;
    try {
      const hostStaff = staffList.find((s) => s.id === values.hostStaffId);
      const hostStaffName = hostStaff ? getUserFullName(hostStaff) : editingRecord.hostStaffName;

      updateCheckIn(editingRecord.id, {
        ...values,
        hostStaffName,
      });
      message.success('Check-in details updated.');
      setEditingRecord(null);
    } catch (err: any) {
      message.error(err.message || 'Failed to update record');
    }
  };

  // ── Columns ───────────────────────────────────────────────────────────────
  const columns = [
    {
      title: 'Visitor & Identity',
      key: 'visitor',
      width: 250,
      onHeaderCell: () => ({ style: { whiteSpace: 'nowrap' as const } }),
      sorter: (a: CheckInRecord, b: CheckInRecord) => a.visitorName.localeCompare(b.visitorName),
      render: (_: any, record: CheckInRecord) => {
        const avatarBg = getAvatarColor(record.visitorName);
        const initials = getInitials(record.visitorName);
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 220 }}>
            <Avatar
              style={{
                backgroundColor: avatarBg,
                verticalAlign: 'middle',
                fontWeight: 700,
                fontSize: 13,
                boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
                flexShrink: 0,
              }}
              size={36}
            >
              {initials}
            </Avatar>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <Text strong style={{ fontSize: 13, color: '#1a365d', wordBreak: 'break-word' }}>
                  {record.visitorName}
                </Text>
                {record.badgeNumber && (
                  <Tag color="geekblue" style={{ fontSize: 10, padding: '0 4px', borderRadius: 4, margin: 0 }}>
                    🏷️ {record.badgeNumber}
                  </Tag>
                )}
                {record.id === justAddedId && (
                  <Tag color="success" style={{ fontSize: 10, padding: '0 5px', borderRadius: 4, margin: 0, fontWeight: 700 }}>
                    ✨ NEW
                  </Tag>
                )}
              </div>
              <div style={{ marginTop: 2 }}>
                <Text code style={{ fontSize: 11, color: '#595959', background: '#f5f5f5', border: '1px solid #e8e8e8', padding: '1px 5px', borderRadius: 4 }}>
                  {record.code}
                </Text>
              </div>
            </div>
          </div>
        );
      },
    },
    {
      title: 'Contact & Category',
      key: 'contact',
      width: 210,
      onHeaderCell: () => ({ style: { whiteSpace: 'nowrap' as const } }),
      sorter: (a: CheckInRecord, b: CheckInRecord) => a.category.localeCompare(b.category),
      render: (_: any, record: CheckInRecord) => {
        const catConfig = visitorCategoryLabels[record.category] || { label: record.category, color: 'default' };
        const cleanPhone = (record.phoneNumber || '').replace(/[^\d+]/g, '');
        return (
          <div style={{ minWidth: 180 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <PhoneOutlined style={{ color: '#1890ff', fontSize: 12 }} />
              <a
                href={`tel:${record.phoneNumber}`}
                onClick={(e) => e.stopPropagation()}
                style={{ fontSize: 12, color: '#262626', fontWeight: 500 }}
              >
                {record.phoneNumber}
              </a>
              {cleanPhone && (
                <Tooltip title="Send SMS">
                  <a
                    href={`sms:${cleanPhone}`}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleSendPassToVisitor(record);
                    }}
                    style={{ color: '#1890ff', fontSize: 13, display: 'inline-flex', alignItems: 'center' }}
                  >
                    <MessageOutlined />
                  </a>
                </Tooltip>
              )}
            </div>
            {record.email && (
              <div style={{ fontSize: 11, color: '#8c8c8c', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                <MailOutlined style={{ fontSize: 10 }} />
                <span style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {record.email}
                </span>
              </div>
            )}
            <div style={{ marginTop: 4 }}>
              <Tag color={catConfig.color} style={{ fontSize: 11, borderRadius: 4, margin: 0 }}>
                {catConfig.label}
              </Tag>
            </div>
          </div>
        );
      },
    },
    {
      title: 'Branch Location',
      key: 'branch',
      width: 160,
      onHeaderCell: () => ({ style: { whiteSpace: 'nowrap' as const } }),
      sorter: (a: CheckInRecord, b: CheckInRecord) => (a.branchId || '').localeCompare(b.branchId || ''),
      render: (_: any, record: CheckInRecord) => {
        const branchObj = branches.find(
          (b: any) => b.id === record.branchId || b.branchCode === record.branchId || b.name === record.branchId
        );
        const canon = getBranchCanonicalKey(record.branchId);
        const name = branchObj?.name || (canon === 'kumasi' ? 'Kumasi Main' : 'Accra Central');
        return (
          <div style={{ minWidth: 130 }}>
            <Tag color="blue" icon={<EnvironmentOutlined />} style={{ borderRadius: 6, fontWeight: 500, padding: '2px 8px', margin: 0 }}>
              {name}
            </Tag>
            {branchObj?.branchCode && (
              <div style={{ fontSize: 11, color: '#8c8c8c', marginTop: 2 }}>
                Code: <strong>{branchObj.branchCode}</strong>
              </div>
            )}
          </div>
        );
      },
    },
    {
      title: 'Purpose & Host Staff',
      key: 'purpose',
      width: 280,
      onHeaderCell: () => ({ style: { whiteSpace: 'nowrap' as const } }),
      render: (_: any, record: CheckInRecord) => (
        <div style={{ minWidth: 250, maxWidth: 300, whiteSpace: 'normal', wordBreak: 'normal' }}>
          <Text strong style={{ display: 'block', fontSize: 13, color: '#262626', wordBreak: 'break-word', whiteSpace: 'normal' }}>
            {record.purpose}
          </Text>
          <div style={{ marginTop: 3, fontSize: 12, display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
            <span style={{ color: '#8c8c8c' }}>👤 Host: </span>
            <span style={{ color: '#1890ff', fontWeight: 600 }}>
              {record.hostStaffName || 'General Reception'}
            </span>
            {record.hostDepartment && (
              <Tag color="default" style={{ fontSize: 10, borderRadius: 4, padding: '0 4px', margin: 0 }}>
                {record.hostDepartment}
              </Tag>
            )}
          </div>
          {record.notes && (
            <div
              style={{
                fontSize: 11,
                color: '#8c8c8c',
                fontStyle: 'italic',
                marginTop: 3,
                maxWidth: 260,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
              title={record.notes}
            >
              📝 {record.notes}
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Check-In & Duration',
      key: 'times',
      width: 230,
      onHeaderCell: () => ({ style: { whiteSpace: 'nowrap' as const } }),
      sorter: (a: CheckInRecord, b: CheckInRecord) => dayjs(b.checkInTime).valueOf() - dayjs(a.checkInTime).valueOf(),
      defaultSortOrder: 'descend' as const,
      render: (_: any, record: CheckInRecord) => {
        const checkIn = dayjs(record.checkInTime);
        const checkOut = record.checkOutTime ? dayjs(record.checkOutTime) : null;
        const isOnPremises = record.status === 'in_premises' || record.status === 'waiting';
        const durationStr = formatDuration(record.checkInTime, record.checkOutTime);
        const diffMinutes = dayjs().diff(checkIn, 'minute');

        return (
          <div style={{ minWidth: 190 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
              <span style={{ color: '#237804', fontWeight: 600 }}>🟢 In:</span>
              <strong style={{ color: '#262626' }}>{checkIn.format('h:mm A')}</strong>
              <Text type="secondary" style={{ fontSize: 11 }}>({checkIn.format('MMM D')})</Text>
            </div>
            {checkOut && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, marginTop: 2 }}>
                <span style={{ color: '#cf1322', fontWeight: 600 }}>🔴 Out:</span>
                <strong style={{ color: '#595959' }}>{checkOut.format('h:mm A')}</strong>
              </div>
            )}
            <div style={{ marginTop: 4 }}>
              {isOnPremises ? (
                diffMinutes > 120 ? (
                  <Tag color="error" style={{ fontSize: 11, borderRadius: 10, padding: '0 8px', fontWeight: 600 }}>
                    ⚠️ {durationStr} (Extended)
                  </Tag>
                ) : diffMinutes > 60 ? (
                  <Tag color="warning" style={{ fontSize: 11, borderRadius: 10, padding: '0 8px' }}>
                    ⏳ {durationStr} on site
                  </Tag>
                ) : (
                  <Tag color="processing" style={{ fontSize: 11, borderRadius: 10, padding: '0 8px' }}>
                    ⏳ {durationStr} on site
                  </Tag>
                )
              ) : (
                <Tag color="default" style={{ fontSize: 11, borderRadius: 10, padding: '0 8px' }}>
                  ⏱️ Visit: {durationStr}
                </Tag>
              )}
            </div>
          </div>
        );
      },
    },
    {
      title: 'Status',
      key: 'status',
      width: 150,
      onHeaderCell: () => ({ style: { whiteSpace: 'nowrap' as const } }),
      sorter: (a: CheckInRecord, b: CheckInRecord) => a.status.localeCompare(b.status),
      render: (_: any, record: CheckInRecord) => {
        const statusConfig = checkInStatusLabels[record.status] || { label: record.status, color: 'default' };
        let tagColor = 'default';
        let iconPrefix = '⚪ ';
        if (record.status === 'in_premises') {
          tagColor = 'success';
          iconPrefix = '🟢 ';
        } else if (record.status === 'waiting') {
          tagColor = 'warning';
          iconPrefix = '⏳ ';
        } else if (record.status === 'completed') {
          tagColor = 'blue';
          iconPrefix = '✅ ';
        }

        return (
          <div style={{ minWidth: 120 }}>
            <Tag color={tagColor} style={{ fontSize: 12, padding: '3px 10px', borderRadius: 6, fontWeight: 600 }}>
              {iconPrefix}
              {statusConfig.label}
            </Tag>
          </div>
        );
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 220,
      fixed: 'right' as const,
      onHeaderCell: () => ({ style: { whiteSpace: 'nowrap' as const } }),
      render: (_: any, record: CheckInRecord) => (
        <div style={{ minWidth: 190 }}>
          <Space size="small" onClick={(e) => e.stopPropagation()}>
            {(record.status === 'in_premises' || record.status === 'waiting') && (
              <Tooltip title="Check Out Visitor">
                <Button
                  type="primary"
                  size="small"
                  icon={<LogoutOutlined />}
                  style={{ background: '#52c41a', borderColor: '#52c41a', borderRadius: 6, fontWeight: 600 }}
                  onClick={() => handleQuickCheckOut(record)}
                >
                  Check Out
                </Button>
              </Tooltip>
            )}
            <Tooltip title="View Pass">
              <Button
                type="text"
                size="small"
                icon={<IdcardOutlined style={{ color: '#2E5E8C' }} />}
                onClick={() => {
                  setRecordForPass(record);
                  setVisitorPassModalOpen(true);
                }}
              />
            </Tooltip>
            <Tooltip title="Send SMS">
              <Button
                type="text"
                size="small"
                icon={<MessageOutlined style={{ color: '#1890ff' }} />}
                onClick={() => handleSendPassToVisitor(record)}
              />
            </Tooltip>
            <Tooltip title="View Details">
              <Button
                type="text"
                size="small"
                icon={<EyeOutlined />}
                onClick={() => {
                  setSelectedRecord(record);
                  setDetailDrawerOpen(true);
                }}
              />
            </Tooltip>
            <Tooltip title="Edit Record">
              <Button
                type="text"
                size="small"
                icon={<EditOutlined />}
                onClick={() => handleEditClick(record)}
              />
            </Tooltip>
            {hasRole(['admin', 'branch_manager']) && (
              <Popconfirm
                title="Delete check-in record?"
                description="Are you sure you want to permanently remove this record?"
                onConfirm={() => {
                  deleteCheckIn(record.id);
                  message.success('Record removed');
                }}
                okText="Yes, Delete"
                cancelText="Cancel"
              >
                <Tooltip title="Delete">
                  <Button type="text" danger size="small" icon={<DeleteOutlined />} />
                </Tooltip>
              </Popconfirm>
            )}
          </Space>
        </div>
      ),
    },
  ];

  // Active states for KPI filter toggles
  const isPremisesActive = statusFilter === 'in_premises';
  const isLobbyActive = statusFilter === 'waiting';
  const isCompletedActive = statusFilter === 'completed' && dateFilter === 'today';
  const isMonthActive = dateFilter === 'monthly';

  return (
    <div style={{ maxWidth: '100%', padding: '0 4px' }}>
      <PageHeader
        title="Client & Visitor Check-Ins"
        actions={[
          {
            label: 'Check In Client / Visitor',
            onClick: () => {
              const defaultBranch = selectedBranchId !== 'all' ? selectedBranchId : (currentBranchId || branches[0]?.id || 'b2');
              form.setFieldsValue({
                branchId: defaultBranch,
                category: 'customer',
                status: 'in_premises',
              });
              setCheckInModalOpen(true);
            },
            icon: <PlusOutlined />,
          },
        ]}
      />

      {/* ── INTERACTIVE METRIC STAT CARDS ────────────────────────────────── */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card
            hoverable
            onClick={() => setStatusFilter(isPremisesActive ? 'all' : 'in_premises')}
            style={{
              borderRadius: 12,
              cursor: 'pointer',
              borderLeft: '4px solid #52c41a',
              boxShadow: isPremisesActive ? '0 0 0 2px #52c41a, 0 4px 12px rgba(82, 196, 26, 0.18)' : '0 2px 8px rgba(0,0,0,0.04)',
              transition: 'all 0.25s ease',
              background: isPremisesActive ? '#f6ffed' : '#ffffff',
            }}
          >
            <Statistic
              title={
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 600, color: '#595959' }}>Currently on Premises</span>
                  {isPremisesActive && <Tag color="success" style={{ margin: 0, fontSize: 10 }}>FILTERED</Tag>}
                </div>
              }
              value={stats.onPremises}
              prefix={<EnvironmentOutlined style={{ color: '#52c41a' }} />}
              valueStyle={{ color: '#52c41a', fontWeight: 700 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card
            hoverable
            onClick={() => setStatusFilter(isLobbyActive ? 'all' : 'waiting')}
            style={{
              borderRadius: 12,
              cursor: 'pointer',
              borderLeft: '4px solid #faad14',
              boxShadow: isLobbyActive ? '0 0 0 2px #faad14, 0 4px 12px rgba(250, 173, 20, 0.18)' : '0 2px 8px rgba(0,0,0,0.04)',
              transition: 'all 0.25s ease',
              background: isLobbyActive ? '#fffbe6' : '#ffffff',
            }}
          >
            <Statistic
              title={
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 600, color: '#595959' }}>Waiting in Reception</span>
                  {isLobbyActive && <Tag color="warning" style={{ margin: 0, fontSize: 10 }}>FILTERED</Tag>}
                </div>
              }
              value={stats.inLobby}
              prefix={<ClockCircleOutlined style={{ color: '#faad14' }} />}
              valueStyle={{ color: '#faad14', fontWeight: 700 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card
            hoverable
            onClick={() => {
              if (isCompletedActive) {
                setStatusFilter('all');
                setDateFilter('all');
              } else {
                setStatusFilter('completed');
                setDateFilter('today');
              }
            }}
            style={{
              borderRadius: 12,
              cursor: 'pointer',
              borderLeft: '4px solid #1890ff',
              boxShadow: isCompletedActive ? '0 0 0 2px #1890ff, 0 4px 12px rgba(24, 144, 255, 0.18)' : '0 2px 8px rgba(0,0,0,0.04)',
              transition: 'all 0.25s ease',
              background: isCompletedActive ? '#e6f7ff' : '#ffffff',
            }}
          >
            <Statistic
              title={
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 600, color: '#595959' }}>Checked Out Today</span>
                  {isCompletedActive && <Tag color="processing" style={{ margin: 0, fontSize: 10 }}>FILTERED</Tag>}
                </div>
              }
              value={stats.completedToday}
              prefix={<CheckCircleOutlined style={{ color: '#1890ff' }} />}
              valueStyle={{ color: '#1890ff', fontWeight: 700 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card
            hoverable
            onClick={() => setDateFilter(isMonthActive ? 'all' : 'monthly')}
            style={{
              borderRadius: 12,
              cursor: 'pointer',
              borderLeft: '4px solid #722ed1',
              boxShadow: isMonthActive ? '0 0 0 2px #722ed1, 0 4px 12px rgba(114, 46, 209, 0.18)' : '0 2px 8px rgba(0,0,0,0.04)',
              transition: 'all 0.25s ease',
              background: isMonthActive ? '#f9f0ff' : '#ffffff',
            }}
          >
            <Statistic
              title={
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 600, color: '#595959' }}>Total This Month</span>
                  {isMonthActive && <Tag color="purple" style={{ margin: 0, fontSize: 10 }}>FILTERED</Tag>}
                </div>
              }
              value={stats.totalThisMonth}
              prefix={<TeamOutlined style={{ color: '#722ed1' }} />}
              valueStyle={{ color: '#722ed1', fontWeight: 700 }}
            />
          </Card>
        </Col>
      </Row>

      {/* ── TWO-TIER STRUCTURED FILTER & COMMAND BAR ──────────────────────── */}
      <Card
        style={{
          marginBottom: 16,
          borderRadius: 12,
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
          border: '1px solid #f0f0f0',
        }}
        bodyStyle={{ padding: '16px 20px' }}
      >
        {/* Row 1: Search & Quick Status Filter Pills */}
        <Row gutter={[16, 12]} align="middle" justify="space-between">
          <Col xs={24} md={10} lg={9}>
            <Input
              placeholder="Search visitor, phone, purpose, badge..."
              prefix={<SearchOutlined style={{ color: '#8c8c8c' }} />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear
              size="middle"
              style={{ borderRadius: 8 }}
            />
          </Col>
          <Col xs={24} md={14} lg={15}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
              <Text type="secondary" style={{ fontSize: 12, marginRight: 4 }}>
                Status:
              </Text>
              <Button
                size="small"
                type={statusFilter === 'all' ? 'primary' : 'default'}
                onClick={() => setStatusFilter('all')}
                style={{ borderRadius: 16, fontSize: 12 }}
              >
                All ({records.length})
              </Button>
              <Button
                size="small"
                type={statusFilter === 'in_premises' ? 'primary' : 'default'}
                onClick={() => setStatusFilter(statusFilter === 'in_premises' ? 'all' : 'in_premises')}
                style={{
                  borderRadius: 16,
                  fontSize: 12,
                  borderColor: statusFilter === 'in_premises' ? undefined : '#b7eb8f',
                  color: statusFilter === 'in_premises' ? undefined : '#237804',
                }}
              >
                🟢 On Premises ({stats.onPremises})
              </Button>
              <Button
                size="small"
                type={statusFilter === 'waiting' ? 'primary' : 'default'}
                onClick={() => setStatusFilter(statusFilter === 'waiting' ? 'all' : 'waiting')}
                style={{
                  borderRadius: 16,
                  fontSize: 12,
                  borderColor: statusFilter === 'waiting' ? undefined : '#ffe58f',
                  color: statusFilter === 'waiting' ? undefined : '#d48806',
                }}
              >
                ⏳ In Reception ({stats.inLobby})
              </Button>
              <Button
                size="small"
                type={statusFilter === 'completed' ? 'primary' : 'default'}
                onClick={() => setStatusFilter(statusFilter === 'completed' ? 'all' : 'completed')}
                style={{
                  borderRadius: 16,
                  fontSize: 12,
                  borderColor: statusFilter === 'completed' ? undefined : '#91d5ff',
                  color: statusFilter === 'completed' ? undefined : '#096dd9',
                }}
              >
                ✅ Checked Out
              </Button>
            </div>
          </Col>
        </Row>

        <Divider style={{ margin: '12px 0' }} />

        {/* Row 2: Secondary Dropdowns & Actions */}
        <Row gutter={[12, 12]} align="middle">
          <Col xs={24} sm={12} md={6} lg={5}>
            <Select
              style={{ width: '100%' }}
              placeholder="Category"
              value={categoryFilter}
              onChange={setCategoryFilter}
              size="middle"
            >
              <Option value="all">👥 All Categories</Option>
              <Option value="customer">Existing Customer</Option>
              <Option value="prospect">Prospective Client</Option>
              <Option value="inquiry">General Inquiry</Option>
              <Option value="contractor">Vendor / Contractor</Option>
              <Option value="legal_survey">Legal / Surveyor</Option>
              <Option value="vip">VIP Guest</Option>
              <Option value="other">Other</Option>
            </Select>
          </Col>
          <Col xs={24} sm={12} md={6} lg={4}>
            <Select
              style={{ width: '100%' }}
              value={dateFilter}
              onChange={(val) => {
                setDateFilter(val);
                if (val !== 'custom') setCustomDateRange(null);
              }}
              size="middle"
              prefix={<CalendarOutlined style={{ color: '#8c8c8c' }} />}
            >
              <Option value="all">📅 All Dates</Option>
              <Option value="today">☀️ Today</Option>
              <Option value="weekly">📆 This Week</Option>
              <Option value="monthly">🗓️ This Month</Option>
              <Option value="yearly">📊 This Year</Option>
              <Option value="custom">🎯 Custom Range</Option>
            </Select>
          </Col>
          {dateFilter === 'custom' && (
            <Col xs={24} sm={12} md={8} lg={6}>
              <DatePicker.RangePicker
                style={{ width: '100%' }}
                value={customDateRange}
                onChange={(dates: any) => setCustomDateRange(dates)}
                format="YYYY-MM-DD"
              />
            </Col>
          )}
          <Col xs={24} sm={12} md={6} lg={dateFilter === 'custom' ? 4 : 5}>
            <Select
              style={{ width: '100%' }}
              value={selectedBranchId}
              onChange={setSelectedBranchId}
              size="middle"
            >
              <Option value="all">🏢 All Branches ({records.length})</Option>
              {branches.map((b: any) => (
                <Option key={b.id} value={b.id}>
                  {b.name}
                </Option>
              ))}
            </Select>
          </Col>
          <Col xs={24} sm={12} md={6} lg={dateFilter === 'custom' ? 5 : 4}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap' }}>
              {isFiltered && (
                <Button
                  size="middle"
                  icon={<ClearOutlined />}
                  onClick={resetAllFilters}
                  style={{ borderRadius: 6 }}
                >
                  Reset Filters
                </Button>
              )}
              <Tag color="blue" style={{ fontSize: 12, padding: '4px 10px', borderRadius: 6, margin: 0 }}>
                {filteredRecords.length} {filteredRecords.length === 1 ? 'record' : 'records'}
              </Tag>
            </div>
          </Col>
        </Row>
      </Card>

      {/* ── DATA TABLE ───────────────────────────────────────────────────── */}
      <Card
        style={{
          borderRadius: 12,
          overflow: 'hidden',
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
          border: '1px solid #f0f0f0',
        }}
        bodyStyle={{ padding: 0 }}
      >
        {/* Table Toolbar Header */}
        <div
          style={{
            padding: '14px 20px',
            background: '#fafafa',
            borderBottom: '1px solid #f0f0f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 10,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Text strong style={{ fontSize: 15, color: '#1a365d' }}>
              Visitor Log & Activity Stream
            </Text>
            <Badge
              count={filteredRecords.length}
              overflowCount={9999}
              style={{
                backgroundColor: '#2E5E8C',
                fontSize: 12,
                fontWeight: 600,
              }}
            />
            {isFiltered && (
              <Tag color="orange" style={{ fontSize: 11, borderRadius: 4, margin: 0 }}>
                Filtered from {records.length} records
              </Tag>
            )}
          </div>
          <Space size={8}>
            <Tooltip title="Print current visitor activity sheet">
              <Button
                size="small"
                icon={<PrinterOutlined />}
                onClick={() => window.print()}
                style={{ borderRadius: 6 }}
              >
                Print Log
              </Button>
            </Tooltip>
            <Button
              type="primary"
              size="small"
              icon={<PlusOutlined />}
              onClick={() => {
                const defaultBranch = selectedBranchId !== 'all' ? selectedBranchId : (currentBranchId || branches[0]?.id || 'b2');
                form.setFieldsValue({
                  branchId: defaultBranch,
                  category: 'customer',
                  status: 'in_premises',
                });
                setCheckInModalOpen(true);
              }}
              style={{ borderRadius: 6 }}
            >
              + Check In Visitor
            </Button>
          </Space>
        </div>

        <Table
          columns={columns}
          dataSource={filteredRecords}
          rowKey="id"
          size="middle"
          scroll={{ x: 1500 }}
          onRow={(record) => ({
            onClick: (e: any) => {
              // Ignore clicks on buttons, links, or popconfirm actions
              if (e.target.closest('button') || e.target.closest('a') || e.target.closest('.ant-popconfirm')) {
                return;
              }
              setSelectedRecord(record);
              setDetailDrawerOpen(true);
            },
            style: {
              cursor: 'pointer',
              background:
                record.status === 'in_premises'
                  ? 'rgba(82, 196, 26, 0.02)'
                  : record.status === 'waiting'
                  ? 'rgba(250, 173, 20, 0.02)'
                  : undefined,
            },
          })}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50', '100'],
            showTotal: (total, range) => `Showing ${range[0]}-${range[1]} of ${total} visitors`,
          }}
          locale={{
            emptyText: (
              <div style={{ padding: '40px 16px', textAlign: 'center' }}>
                <TeamOutlined style={{ fontSize: 44, color: '#bfbfbf', marginBottom: 12 }} />
                <Paragraph style={{ color: '#595959', fontSize: 14, marginBottom: 8 }}>
                  No check-in records found matching your active filters.
                </Paragraph>
                {isFiltered ? (
                  <Button type="primary" size="small" icon={<ClearOutlined />} onClick={resetAllFilters} style={{ borderRadius: 6 }}>
                    Clear All Filters
                  </Button>
                ) : (
                  <Button
                    type="primary"
                    size="small"
                    icon={<PlusOutlined />}
                    onClick={() => {
                      const defaultBranch = selectedBranchId !== 'all' ? selectedBranchId : (currentBranchId || branches[0]?.id || 'b2');
                      form.setFieldsValue({
                        branchId: defaultBranch,
                        category: 'customer',
                        status: 'in_premises',
                      });
                      setCheckInModalOpen(true);
                    }}
                    style={{ borderRadius: 6 }}
                  >
                    Check In New Client / Visitor
                  </Button>
                )}
              </div>
            ),
          }}
        />
      </Card>

      {/* ── CHECK IN CLIENT MODAL ─────────────────────────────────────────── */}
      <Modal
        title={
          <Space>
            <UserAddOutlined style={{ color: tokens.primary }} />
            <span>Front Desk Client & Visitor Check-In</span>
          </Space>
        }
        open={checkInModalOpen}
        onCancel={() => {
          setCheckInModalOpen(false);
          form.resetFields();
        }}
        footer={null}
        width={640}
        style={{ top: 20, maxWidth: 'calc(100vw - 24px)' }}
        styles={{ body: { maxHeight: 'calc(85vh - 120px)', overflowY: 'auto', padding: '16px 20px' } }}
        destroyOnClose
      >
        <Alert
          message="Record incoming client or visitor arriving at the branch premises."
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
        <Form form={form} layout="vertical" onFinish={handleCheckInSubmit}>
          <Row gutter={12}>
            <Col xs={24} sm={12}>
              <Form.Item
                name="visitorName"
                label="Client / Visitor Full Name"
                rules={[{ required: true, message: 'Please enter visitor name' }]}
              >
                <Input placeholder="e.g. Kwame Mensah" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                name="phoneNumber"
                label="Phone Number"
                rules={[{ required: true, message: 'Please enter phone number' }]}
              >
                <PhoneInput />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={12}>
            <Col xs={24} sm={12}>
              <Form.Item
                name="category"
                label="Visitor Category"
                initialValue="customer"
                rules={[{ required: true, message: 'Please select visitor category' }]}
              >
                <Select>
                  <Option value="customer">Existing Customer</Option>
                  <Option value="prospect">Prospective Client (New)</Option>
                  <Option value="inquiry">General Inquiry</Option>
                  <Option value="contractor">Vendor / Contractor</Option>
                  <Option value="legal_survey">Legal / Surveyor</Option>
                  <Option value="vip">VIP Guest</Option>
                  <Option value="other">Other</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="email" label="Email Address (Optional)">
                <Input placeholder="e.g. client@email.com" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="purpose"
            label="Purpose of Visit"
            rules={[{ required: true, message: 'Please specify the visit purpose' }]}
          >
            <AutoComplete
              placeholder="Select from common options or type purpose..."
              options={[
                { value: 'Deed of Assignment Documentation & Signatures' },
                { value: 'Payment Submission & Receipt Collection' },
                { value: 'Site Visit / Plot Inspection Inquiries' },
                { value: 'Payment Plan Statement Follow-up' },
                { value: 'Meeting with Branch Manager' },
                { value: 'Meeting with Marketing Director / Staff' },
                { value: 'Complaint / Customer Support Resolution' },
                { value: 'Contractor / Construction Bill Submission' },
              ]}
              filterOption={(inputValue, option) =>
                (option?.value?.toUpperCase().indexOf(inputValue.toUpperCase()) ?? -1) !== -1
              }
            />
          </Form.Item>

          <Row gutter={12}>
            <Col xs={24} sm={14}>
              <Form.Item name="hostStaffId" label="Person to See (Host Staff)">
                <Select
                  allowClear
                  showSearch
                  placeholder="Select staff member to visit"
                  optionFilterProp="children"
                >
                  {staffList.map((s) => (
                    <Option key={s.id} value={s.id}>
                      {getUserFullName(s)} ({s.role?.replace('_', ' ')})
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} sm={10}>
              <Form.Item name="hostDepartment" label="Department to Visit">
                <Select allowClear placeholder="Select department">
                  <Option value="Administration">Administration & Secretary</Option>
                  <Option value="Accounts & Finance">Accounts & Finance</Option>
                  <Option value="Marketing & Sales">Marketing & Sales</Option>
                  <Option value="Customer Service">Customer Service</Option>
                  <Option value="Operations">Operations & Survey</Option>
                  <Option value="Executive Management">Executive Management</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={12}>
            <Col xs={24} sm={12}>
              <Form.Item
                name="branchId"
                label="Branch Location"
                rules={[{ required: true, message: 'Please select branch location' }]}
              >
                <Select placeholder="Select branch">
                  {branches.length > 0 ? (
                    branches.map((b: any) => (
                      <Option key={b.id} value={b.id}>
                        {b.name} ({b.branchCode || 'Branch'})
                      </Option>
                    ))
                  ) : (
                    <>
                      <Option value="b2">Accra Branch (Spintex)</Option>
                      <Option value="b1">Kumasi Branch (Head Office)</Option>
                    </>
                  )}
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="badgeNumber" label="Visitor Pass / Badge # (Optional)">
                <Input placeholder="e.g. VIS-014" prefix={<IdcardOutlined />} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={12}>
            <Col xs={24} sm={12}>
              <Form.Item name="status" label="Initial Status" initialValue="in_premises">
                <Select>
                  <Option value="in_premises">🟢 In Premises / Meeting</Option>
                  <Option value="waiting">⏳ Waiting in Lobby</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="notes" label="Additional Notes / Remarks">
            <TextArea rows={2} placeholder="Any specific instructions, requested files, or notes..." />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setCheckInModalOpen(false)}>Cancel</Button>
              <Button type="primary" htmlType="submit" icon={<UserAddOutlined />}>
                Record Check-In
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* ── QUICK CHECK OUT MODAL ─────────────────────────────────────────── */}
      <Modal
        title={
          <Space>
            <LogoutOutlined style={{ color: '#52c41a' }} />
            <span>Check Out: {recordToCheckOut?.visitorName}</span>
          </Space>
        }
        open={checkOutModalOpen}
        onCancel={() => setCheckOutModalOpen(false)}
        footer={null}
        width={480}
        style={{ top: 24, maxWidth: 'calc(100vw - 24px)' }}
        styles={{ body: { maxHeight: 'calc(80vh - 100px)', overflowY: 'auto', padding: '16px 20px' } }}
        destroyOnClose
      >
        <Form form={checkOutForm} layout="vertical" onFinish={confirmCheckOut}>
          <Paragraph>
            Confirm departure for <strong>{recordToCheckOut?.visitorName}</strong> ({recordToCheckOut?.code}).
          </Paragraph>
          <Form.Item name="notes" label="Visit Outcome / Closing Remarks (Optional)">
            <TextArea rows={3} placeholder="e.g. Completed deed signatures, receipt issued, meeting concluded smoothly." />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setCheckOutModalOpen(false)}>Cancel</Button>
              <Button type="primary" htmlType="submit" style={{ background: '#52c41a', borderColor: '#52c41a' }}>
                Confirm Check-Out
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* ── EDIT CHECK-IN MODAL ───────────────────────────────────────────── */}
      <Modal
        title="Edit Check-In Details"
        open={Boolean(editingRecord)}
        onCancel={() => setEditingRecord(null)}
        footer={null}
        width={620}
        style={{ top: 20, maxWidth: 'calc(100vw - 24px)' }}
        styles={{ body: { maxHeight: 'calc(85vh - 120px)', overflowY: 'auto', padding: '16px 20px' } }}
        destroyOnClose
      >
        <Form form={editForm} layout="vertical" onFinish={handleEditSubmit}>
          <Row gutter={12}>
            <Col xs={24} sm={12}>
              <Form.Item name="visitorName" label="Visitor Name" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="phoneNumber" label="Phone" rules={[{ required: true }]}>
                <PhoneInput />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col xs={24} sm={12}>
              <Form.Item name="category" label="Category">
                <Select>
                  <Option value="customer">Existing Customer</Option>
                  <Option value="prospect">Prospective Client</Option>
                  <Option value="inquiry">General Inquiry</Option>
                  <Option value="contractor">Vendor / Contractor</Option>
                  <Option value="legal_survey">Legal / Surveyor</Option>
                  <Option value="vip">VIP Guest</Option>
                  <Option value="other">Other</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="status" label="Status">
                <Select>
                  <Option value="in_premises">On Premises</Option>
                  <Option value="waiting">Waiting in Lobby</Option>
                  <Option value="completed">Checked Out</Option>
                  <Option value="canceled">Canceled</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col xs={24} sm={12}>
              <Form.Item name="branchId" label="Branch Location">
                <Select placeholder="Select branch">
                  {branches.length > 0 ? (
                    branches.map((b: any) => (
                      <Option key={b.id} value={b.id}>
                        {b.name} ({b.branchCode || 'Branch'})
                      </Option>
                    ))
                  ) : (
                    <>
                      <Option value="b2">Accra Branch (Spintex)</Option>
                      <Option value="b1">Kumasi Branch (Head Office)</Option>
                    </>
                  )}
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="badgeNumber" label="Badge / Pass #">
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="purpose" label="Purpose of Visit" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="notes" label="Notes">
            <TextArea rows={2} />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setEditingRecord(null)}>Cancel</Button>
              <Button type="primary" htmlType="submit">Save Changes</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* ── VISITOR DETAIL DRAWER ─────────────────────────────────────────── */}
      <Drawer
        title={
          <Space>
            <IdcardOutlined style={{ color: tokens.primary }} />
            <span>Visitor Check-In Details</span>
          </Space>
        }
        open={detailDrawerOpen}
        onClose={() => setDetailDrawerOpen(false)}
        width={drawerWidth}
      >
        {selectedRecord && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <Title level={4} style={{ margin: 0 }}>{selectedRecord.visitorName}</Title>
              <Text type="secondary">{selectedRecord.code}</Text>
              <div style={{ marginTop: 8 }}>
                <Tag color={checkInStatusLabels[selectedRecord.status]?.color || 'default'} style={{ fontSize: 13, padding: '2px 10px' }}>
                  {checkInStatusLabels[selectedRecord.status]?.label}
                </Tag>
                <Tag color={visitorCategoryLabels[selectedRecord.category]?.color || 'default'} style={{ fontSize: 13, padding: '2px 10px' }}>
                  {visitorCategoryLabels[selectedRecord.category]?.label}
                </Tag>
              </div>
            </div>

            <Divider />

            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="Phone Number">{selectedRecord.phoneNumber}</Descriptions.Item>
              <Descriptions.Item label="Branch Location">
                {(() => {
                  const bObj = branches.find((b: any) => b.id === selectedRecord.branchId || b.name === selectedRecord.branchId || b.branchCode === selectedRecord.branchId);
                  return bObj?.name || (getBranchCanonicalKey(selectedRecord.branchId) === 'kumasi' ? 'Kumasi Main' : 'Accra Central');
                })()}
              </Descriptions.Item>
              {selectedRecord.email && (
                <Descriptions.Item label="Email">{selectedRecord.email}</Descriptions.Item>
              )}
              {selectedRecord.badgeNumber && (
                <Descriptions.Item label="Badge / Pass #">{selectedRecord.badgeNumber}</Descriptions.Item>
              )}
              <Descriptions.Item label="Purpose of Visit">{selectedRecord.purpose}</Descriptions.Item>
              <Descriptions.Item label="Person / Staff to See">{selectedRecord.hostStaffName || 'General Desk'}</Descriptions.Item>
              {selectedRecord.hostDepartment && (
                <Descriptions.Item label="Department">{selectedRecord.hostDepartment}</Descriptions.Item>
              )}
              <Descriptions.Item label="Check-In Time">
                {dayjs(selectedRecord.checkInTime).format('MMM D, YYYY — h:mm A')}
              </Descriptions.Item>
              {selectedRecord.checkOutTime && (
                <Descriptions.Item label="Check-Out Time">
                  {dayjs(selectedRecord.checkOutTime).format('MMM D, YYYY — h:mm A')}
                </Descriptions.Item>
              )}
              <Descriptions.Item label="Front Desk Handled By">
                {selectedRecord.handledByName || 'Receptionist'}
              </Descriptions.Item>
              {selectedRecord.notes && (
                <Descriptions.Item label="Notes & Remarks">{selectedRecord.notes}</Descriptions.Item>
              )}
            </Descriptions>

            <div style={{ marginTop: 24, textAlign: 'right' }}>
              <Button
                block
                icon={<PrinterOutlined />}
                style={{ marginBottom: 8 }}
                onClick={() => {
                  setRecordForPass(selectedRecord);
                  setVisitorPassModalOpen(true);
                }}
              >
                Print / Send Visitor Pass
              </Button>
              {(selectedRecord.status === 'in_premises' || selectedRecord.status === 'waiting') && (
                <Button
                  type="primary"
                  block
                  icon={<LogoutOutlined />}
                  style={{ background: '#52c41a', borderColor: '#52c41a', marginBottom: 8 }}
                  onClick={() => {
                    setDetailDrawerOpen(false);
                    handleQuickCheckOut(selectedRecord);
                  }}
                >
                  Check Out This Visitor
                </Button>
              )}
              <Button block onClick={() => setDetailDrawerOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Drawer>

      {/* ── ENLARGED VISITOR CHECK-IN PASS MODAL ───────────────────────── */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingRight: 24 }}>
            <Space>
              <IdcardOutlined style={{ color: tokens.primary, fontSize: 18 }} />
              <span style={{ fontWeight: 700, fontSize: 16 }}>Official Visitor Check-In Pass</span>
            </Space>
            {recordForPass && (
              <Tag color="geekblue" style={{ fontSize: 12, fontWeight: 700, borderRadius: 4, padding: '2px 8px' }}>
                {recordForPass.code}
              </Tag>
            )}
          </div>
        }
        open={visitorPassModalOpen}
        onCancel={() => {
          setVisitorPassModalOpen(false);
          setRecordForPass(null);
        }}
        width={760}
        style={{ top: 20, maxWidth: 'calc(100vw - 24px)' }}
        styles={{ body: { maxHeight: 'calc(85vh - 120px)', overflowY: 'auto', padding: '16px 22px' } }}
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
            <Button
              onClick={() => {
                setVisitorPassModalOpen(false);
                setRecordForPass(null);
              }}
            >
              Close
            </Button>
            <Space size="middle">
              <Tooltip title="Print">
                <Button
                  icon={<PrinterOutlined />}
                  style={{
                    background: '#000000',
                    color: '#ffffff',
                    borderColor: '#000000',
                    borderRadius: 6,
                    fontWeight: 600,
                  }}
                  onClick={() => handlePrintThermalPass(recordForPass, passPreviewMode)}
                >
                  Print
                </Button>
              </Tooltip>
              <Tooltip title="Send SMS">
                <Button
                  type="primary"
                  icon={<MessageOutlined />}
                  style={{
                    background: '#1890ff',
                    borderColor: '#1890ff',
                    borderRadius: 6,
                    fontWeight: 600,
                  }}
                  onClick={() => handleSendPassToVisitor(recordForPass)}
                >
                  Send SMS
                </Button>
              </Tooltip>
            </Space>
          </div>
        }
      >
        {recordForPass && (
          <div>
            {/* View Switcher: Standard Card vs 80mm Thermal Receipt */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}>
              <Segmented
                size="large"
                value={passPreviewMode}
                onChange={(val) => setPassPreviewMode(val as 'card' | 'thermal')}
                options={[
                  { label: '🪪 VIP Visitor Pass (Full Card)', value: 'card' },
                  { label: '🧾 80mm Thermal Receipt (CN811-U)', value: 'thermal' },
                ]}
              />
            </div>

            {passPreviewMode === 'card' ? (
              <div
                id="visitor-pass-print-card"
                style={{
                  background: '#ffffff',
                  border: '2px solid #2E5E8C',
                  borderRadius: 16,
                  padding: '24px 28px',
                  boxShadow: '0 8px 30px rgba(46,94,140,0.08)',
                }}
              >
                {/* Top Logo */}
                <div style={{ textAlign: 'center', marginBottom: 12 }}>
                  <img
                    src="/images/logo.webp"
                    alt="Omark Real Estate & Construction"
                    style={{ maxHeight: 68, maxWidth: 260, objectFit: 'contain', display: 'block', margin: '0 auto' }}
                  />
                </div>

                {/* Header / Thank You & Appreciation */}
                <div style={{ textAlign: 'center', borderBottom: '2px solid #2E5E8C', paddingBottom: 14, marginBottom: 18 }}>
                  <div style={{ fontSize: 19, fontWeight: 800, color: '#1a365d', letterSpacing: 0.3, lineHeight: 1.3 }}>
                    Thank you for visiting Omark Real Estate & Construction
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#c49a45', marginTop: 4, letterSpacing: 0.5, fontStyle: 'italic' }}>
                    We appreciate your time and trust
                  </div>
                </div>

                {/* Pass Title & QR Code */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', padding: '16px 20px', borderRadius: 12, border: '1px solid #334155' }}>
                  <div>
                    <Tag color="#0284c7" style={{ fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 4 }}>
                      GATE CLEARANCE PASS
                    </Tag>
                    <div style={{ fontSize: 22, fontWeight: 900, color: '#38bdf8', marginTop: 6, letterSpacing: 1.5, fontFamily: 'monospace' }}>
                      {recordForPass.code}
                    </div>
                    {recordForPass.badgeNumber && (
                      <div style={{ fontSize: 13, color: '#94a3b8', fontWeight: 700, marginTop: 2 }}>
                        Badge No: {recordForPass.badgeNumber}
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign: 'center', background: '#ffffff', padding: 8, borderRadius: 8, border: '1px solid #d9d9d9' }}>
                    <QRCode type="svg" value={recordForPass.code} size={88} bordered={false} />
                  </div>
                </div>

                {/* Visitor & Visit Information Grid */}
                <Descriptions size="small" column={{ xs: 1, sm: 2 }} bordered style={{ marginBottom: 18 }}>
                  <Descriptions.Item label={<Text strong>Visitor Name</Text>} span={2}>
                    <Text strong style={{ fontSize: 15, color: '#2E5E8C' }}>{recordForPass.visitorName}</Text>
                  </Descriptions.Item>
                  <Descriptions.Item label="Contact Phone">
                    <Text strong>{recordForPass.phoneNumber}</Text>
                  </Descriptions.Item>
                  <Descriptions.Item label="Category">
                    <Tag color={visitorCategoryLabels[recordForPass.category]?.color || 'blue'} style={{ fontSize: 12, fontWeight: 600 }}>
                      {visitorCategoryLabels[recordForPass.category]?.label || recordForPass.category}
                    </Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="Person to See" span={2}>
                    <Text strong style={{ fontSize: 13, color: '#1890ff' }}>
                      {recordForPass.hostStaffName || 'General Reception'}
                    </Text>
                    {recordForPass.hostDepartment ? ` (${recordForPass.hostDepartment})` : ''}
                  </Descriptions.Item>
                  <Descriptions.Item label="Visit Purpose" span={2}>
                    <Text style={{ fontSize: 13 }}>{recordForPass.purpose}</Text>
                  </Descriptions.Item>
                  <Descriptions.Item label="Check-In Time">
                    <Text strong>{dayjs(recordForPass.checkInTime).format('MMM D, YYYY · h:mm A')}</Text>
                  </Descriptions.Item>
                  <Descriptions.Item label="Branch Location">
                    {(() => {
                      const bObj = branches.find((b: any) => b.id === recordForPass.branchId || b.name === recordForPass.branchId || b.branchCode === recordForPass.branchId);
                      return bObj?.name || (getBranchCanonicalKey(recordForPass.branchId) === 'kumasi' ? 'Kumasi Main' : 'Accra Central');
                    })()}
                  </Descriptions.Item>
                  <Descriptions.Item label="Issued By" span={2}>
                    <Text type="secondary">{recordForPass.handledByName || 'Front Desk Reception'}</Text>
                  </Descriptions.Item>
                </Descriptions>

                {/* Services Rendered by Omark */}
                <div
                  style={{
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: 10,
                    padding: '14px 16px',
                    marginBottom: 16,
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#1a365d', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <CheckCircleOutlined style={{ color: '#52c41a' }} />
                    <span>Omark renders the following services:</span>
                  </div>
                  <Row gutter={[12, 6]}>
                    {[
                      'Genuine Land Documentation',
                      'Building and Construction',
                      'Architectural Services',
                      'Project Management',
                      'Genuine Land Sales',
                    ].map((service, idx) => (
                      <Col xs={24} sm={12} key={idx}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#334155' }}>
                          <span style={{ color: '#c49a45', fontWeight: 'bold' }}>•</span>
                          <span style={{ fontWeight: 600 }}>{service}</span>
                        </div>
                      </Col>
                    ))}
                  </Row>
                </div>

                {/* Reach out to US Section */}
                <div
                  style={{
                    background: '#f0f7ff',
                    border: '1px solid #bae0ff',
                    borderRadius: 10,
                    padding: '14px 16px',
                    marginBottom: 16,
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#003eb3', marginBottom: 10 }}>
                    Reach out to US:
                  </div>
                  <Row gutter={[12, 10]}>
                    <Col xs={24} sm={12}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                        <TikTokOutlined style={{ color: '#000000', fontSize: 15 }} />
                        <span style={{ color: '#595959' }}>Tiktok:</span>
                        <Text strong style={{ color: '#262626' }}>omark.group.of.companies</Text>
                      </div>
                    </Col>
                    <Col xs={24} sm={12}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                        <FacebookOutlined style={{ color: '#1877F2', fontSize: 15 }} />
                        <span style={{ color: '#595959' }}>Facebook:</span>
                        <Text strong style={{ color: '#262626' }}>Omark Prop</Text>
                      </div>
                    </Col>
                    <Col xs={24} sm={12}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                        <InstagramOutlined style={{ color: '#E1306C', fontSize: 15 }} />
                        <span style={{ color: '#595959' }}>Instagram:</span>
                        <Text strong style={{ color: '#262626' }}>omark_real_estate</Text>
                      </div>
                    </Col>
                    <Col xs={24} sm={12}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                        <YoutubeOutlined style={{ color: '#FF0000', fontSize: 15 }} />
                        <span style={{ color: '#595959' }}>YouTube:</span>
                        <Text strong style={{ color: '#262626' }}>@omark2</Text>
                      </div>
                    </Col>
                    <Col xs={24}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          fontSize: 13,
                          marginTop: 6,
                          background: '#ffffff',
                          padding: '8px 14px',
                          borderRadius: 8,
                          border: '1px solid #91d5ff',
                        }}
                      >
                        <WhatsAppOutlined style={{ color: '#25D366', fontSize: 17 }} />
                        <PhoneOutlined style={{ color: '#096dd9', fontSize: 15 }} />
                        <span style={{ color: '#595959', fontWeight: 500 }}>call or whatsapp:</span>
                        <a href="tel:0546029075" style={{ fontWeight: 800, color: '#096dd9', textDecoration: 'none', fontSize: 14 }}>
                          054 602 9075
                        </a>
                      </div>
                    </Col>
                  </Row>
                </div>

                {/* Security & Premises Safety Notice */}
                <div
                  style={{
                    background: '#f6ffed',
                    border: '1px solid #b7eb8f',
                    borderRadius: 8,
                    padding: '9px 14px',
                    fontSize: 12,
                    color: '#389e0d',
                    textAlign: 'center',
                  }}
                >
                  🔒 <strong>Premises Policy:</strong> Please wear visitor badge visibly at all times. Return pass upon checkout.
                </div>
              </div>
            ) : (
              /* ── 80mm ESC/POS THERMAL RECEIPT PREVIEW (CN811-U) ── */
              <div style={{ background: '#f1f5f9', border: '1px solid #e2e8f0', padding: '24px 16px', borderRadius: 14, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <PrinterOutlined style={{ color: '#2E5E8C' }} />
                  <span>Live 80mm ESC/POS Roll Preview (CN811-U)</span>
                </div>
                <div
                  style={{
                    width: '320px',
                    background: '#ffffff',
                    color: '#000000',
                    padding: '16px 16px 20px 16px',
                    boxShadow: '0 10px 30px rgba(0,0,0,0.12)',
                    borderRadius: 4,
                    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
                    fontSize: '10.5px',
                    lineHeight: 1.35,
                    borderBottom: '4px dashed #94a3b8',
                  }}
                >
                  {/* Top Logo */}
                  <div style={{ textAlign: 'center', marginBottom: 6 }}>
                    <img
                      src="/images/logo.webp"
                      alt="Omark Real Estate & Construction"
                      style={{ maxHeight: 44, maxWidth: 175, objectFit: 'contain', display: 'block', margin: '0 auto', filter: 'contrast(125%)' }}
                    />
                  </div>

                  <div style={{ textAlign: 'center', fontWeight: 900, fontSize: '13px', letterSpacing: '0.4px', lineHeight: 1.25, textTransform: 'uppercase' }}>
                    OMARK REAL ESTATE &amp; CONSTRUCTION
                  </div>
                  <div style={{ textAlign: 'center', fontSize: '10.5px', fontWeight: 700, marginTop: 2, lineHeight: 1.25, color: '#111111' }}>
                    Thank you for visiting Omark Real Estate &amp; Construction
                  </div>
                  <div style={{ textAlign: 'center', fontSize: '10px', fontStyle: 'italic', marginTop: 1, color: '#444444' }}>
                    We appreciate your time and trust
                  </div>

                  {/* Double Receipt Divider */}
                  <div style={{ borderTop: '2px solid #000000', borderBottom: '1px solid #000000', height: 3, margin: '6px 0' }} />

                  {/* Clearance Badge Box */}
                  <div style={{ textAlign: 'center', border: '1.5px solid #000000', borderRadius: 6, padding: '4px 6px', margin: '4px 0 6px 0', background: '#fafafa' }}>
                    <div style={{ fontWeight: 900, fontSize: '11px', letterSpacing: '0.8px' }}>
                      ★ VISITOR GATE PASS ★
                    </div>
                    <div style={{ fontWeight: 900, fontSize: '16px', letterSpacing: '1.5px', fontFamily: 'monospace, monospace', marginTop: 1 }}>
                      {recordForPass.code}
                    </div>
                    {recordForPass.badgeNumber && (
                      <div style={{ fontWeight: 700, fontSize: '10px', marginTop: 1 }}>
                        BADGE NO: {recordForPass.badgeNumber}
                      </div>
                    )}
                  </div>

                  {/* QR Code + Core Visitor Details side-by-side */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '6px 0' }}>
                    <div style={{ flexShrink: 0, width: 72, height: 72, border: '1px solid #000000', padding: 2, borderRadius: 4, background: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <QRCode type="svg" value={recordForPass.code} size={68} color="#000000" bordered={false} />
                    </div>
                    <div style={{ flex: 1, fontSize: '10.5px', lineHeight: 1.35, minWidth: 0 }}>
                      <div><strong>VISITOR:</strong> <span style={{ fontWeight: 700 }}>{recordForPass.visitorName}</span></div>
                      <div><strong>PHONE  :</strong> {recordForPass.phoneNumber}</div>
                      <div><strong>CAT    :</strong> {visitorCategoryLabels[recordForPass.category]?.label || recordForPass.category}</div>
                      <div><strong>HOST   :</strong> {recordForPass.hostStaffName || 'General Reception'}</div>
                      <div><strong>TIME   :</strong> {dayjs(recordForPass.checkInTime).format('MMM D · h:mm A')}</div>
                      <div>
                        <strong>BRANCH :</strong>{' '}
                        {(() => {
                          const bObj = branches.find((b: any) => b.id === recordForPass.branchId || b.name === recordForPass.branchId || b.branchCode === recordForPass.branchId);
                          return bObj?.name || (getBranchCanonicalKey(recordForPass.branchId) === 'kumasi' ? 'Kumasi Main' : 'Accra Central');
                        })()}
                      </div>
                    </div>
                  </div>

                  {/* Purpose Box */}
                  <div style={{ fontSize: '10.5px', lineHeight: 1.3, background: '#f5f5f5', border: '1px dashed #777777', borderRadius: 4, padding: '4px 8px', margin: '4px 0' }}>
                    <strong>PURPOSE:</strong> {recordForPass.purpose}
                  </div>

                  {/* Services Section */}
                  <div style={{ borderTop: '1px dashed #000000', margin: '6px 0' }} />
                  <div style={{ fontSize: '10px', lineHeight: 1.35 }}>
                    <div style={{ fontWeight: 800, textAlign: 'center', letterSpacing: '0.4px', marginBottom: 3, textTransform: 'uppercase' }}>
                      ── OMARK SERVICES ──
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 4, margin: '1px 0' }}>
                      <span>✔ Land Documentation</span>
                      <span>✔ Building &amp; Construction</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 4, margin: '1px 0' }}>
                      <span>✔ Architectural Services</span>
                      <span>✔ Project Management</span>
                    </div>
                    <div style={{ textAlign: 'center', marginTop: 1, fontWeight: 600 }}>
                      ✔ Genuine Land Sales
                    </div>
                  </div>

                  {/* Reach Out To Us Section */}
                  <div style={{ borderTop: '1px dashed #000000', margin: '6px 0' }} />
                  <div style={{ fontSize: '10px', lineHeight: 1.35 }}>
                    <div style={{ fontWeight: 800, textAlign: 'center', letterSpacing: '0.4px', marginBottom: 2, textTransform: 'uppercase' }}>
                      ── REACH OUT TO US ──
                    </div>
                    <div style={{ textAlign: 'center', fontWeight: 900, fontSize: '12px', padding: '3px 6px', border: '1.5px solid #000000', borderRadius: 5, margin: '2px 0 4px 0', background: '#fafafa' }}>
                      📞 Call / WhatsApp: 054 602 9075
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9.5px', margin: '1px 0' }}>
                      <span>TikTok: omark.group.of.companies</span>
                      <span>FB: Omark Prop</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9.5px' }}>
                      <span>IG: omark_real_estate</span>
                      <span>YouTube: @omark2</span>
                    </div>
                  </div>

                  {/* Footer Notice & Tear Strip */}
                  <div style={{ borderTop: '1px dashed #000000', margin: '6px 0' }} />
                  <div style={{ textAlign: 'center', fontSize: '9px', lineHeight: 1.3, color: '#222222' }}>
                    <div>Notice: Please wear pass visibly · Return upon checkout</div>
                    <div style={{ fontWeight: 800, fontSize: '10px', marginTop: 2, letterSpacing: '0.5px' }}>
                      *** HAVE A PRODUCTIVE VISIT ***
                    </div>
                    <div style={{ marginTop: 4, fontSize: '8.5px', letterSpacing: '2px', color: '#666666' }}>
                      - - - - - [ TEAR HERE ] - - - - -
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* ── DEDICATED 80mm ESC/POS THERMAL RECEIPT FOR BROWSER PRINT ─────── */}
      {typeof document !== 'undefined' && recordForPass && createPortal(
        <div id="thermal-receipt-slip" className="thermal-receipt-container">
          {/* Top Logo */}
          <div style={{ textAlign: 'center', marginBottom: 5 }}>
            <img
              src="/images/logo.webp"
              alt="Omark Real Estate & Construction"
              style={{ maxHeight: 44, maxWidth: 175, objectFit: 'contain', display: 'block', margin: '0 auto', filter: 'contrast(125%)' }}
            />
          </div>

          <div style={{ textAlign: 'center', fontWeight: 900, fontSize: '13px', letterSpacing: '0.4px', lineHeight: 1.25, textTransform: 'uppercase' }}>
            OMARK REAL ESTATE &amp; CONSTRUCTION
          </div>
          <div style={{ textAlign: 'center', fontSize: '10.5px', fontWeight: 700, marginTop: '2px', lineHeight: 1.25, color: '#111111' }}>
            Thank you for visiting Omark Real Estate &amp; Construction
          </div>
          <div style={{ textAlign: 'center', fontSize: '10px', fontStyle: 'italic', marginTop: '1px', color: '#444444' }}>
            We appreciate your time and trust
          </div>

          {/* Double Receipt Divider */}
          <div style={{ borderTop: '2px solid #000000', borderBottom: '1px solid #000000', height: 3, margin: '6px 0' }} />

          {/* Clearance Badge Box */}
          <div style={{ textAlign: 'center', border: '1.5px solid #000000', borderRadius: 6, padding: '4px 6px', margin: '4px 0 6px 0', background: '#fafafa' }}>
            <div style={{ fontWeight: 900, fontSize: '11px', letterSpacing: '0.8px' }}>
              ★ VISITOR GATE PASS ★
            </div>
            <div style={{ fontWeight: 900, fontSize: '16px', letterSpacing: '1.5px', fontFamily: 'monospace, monospace', marginTop: 1 }}>
              {recordForPass.code}
            </div>
            {recordForPass.badgeNumber && (
              <div style={{ fontWeight: 700, fontSize: '10px', marginTop: 1 }}>
                BADGE NO: {recordForPass.badgeNumber}
              </div>
            )}
          </div>

          {/* QR Code + Core Visitor Details side-by-side */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '6px 0' }}>
            <div style={{ flexShrink: 0, width: 72, height: 72, border: '1px solid #000000', padding: 2, borderRadius: 4, background: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <QRCode type="svg" value={recordForPass.code} size={68} color="#000000" bordered={false} />
            </div>
            <div style={{ flex: 1, fontSize: '10.5px', lineHeight: 1.35, minWidth: 0 }}>
              <div><strong>VISITOR:</strong> <span style={{ fontWeight: 700 }}>{recordForPass.visitorName}</span></div>
              <div><strong>PHONE  :</strong> {recordForPass.phoneNumber}</div>
              <div><strong>CAT    :</strong> {visitorCategoryLabels[recordForPass.category]?.label || recordForPass.category}</div>
              <div><strong>HOST   :</strong> {recordForPass.hostStaffName || 'General Reception'}</div>
              <div><strong>TIME   :</strong> {dayjs(recordForPass.checkInTime).format('MMM D · h:mm A')}</div>
              <div>
                <strong>BRANCH :</strong>{' '}
                {(() => {
                  const bObj = branches.find((b: any) => b.id === recordForPass.branchId || b.name === recordForPass.branchId || b.branchCode === recordForPass.branchId);
                  return bObj?.name || (getBranchCanonicalKey(recordForPass.branchId) === 'kumasi' ? 'Kumasi Main' : 'Accra Central');
                })()}
              </div>
            </div>
          </div>

          {/* Purpose Box */}
          <div style={{ fontSize: '10.5px', lineHeight: 1.3, background: '#f5f5f5', border: '1px dashed #777777', borderRadius: 4, padding: '4px 8px', margin: '4px 0' }}>
            <strong>PURPOSE:</strong> {recordForPass.purpose}
          </div>

          {/* Services Section */}
          <div style={{ borderTop: '1px dashed #000000', margin: '6px 0' }} />
          <div style={{ fontSize: '10px', lineHeight: 1.35 }}>
            <div style={{ fontWeight: 800, textAlign: 'center', letterSpacing: '0.4px', marginBottom: 3, textTransform: 'uppercase' }}>
              ── OMARK SERVICES ──
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 4, margin: '1px 0' }}>
              <span>✔ Land Documentation</span>
              <span>✔ Building &amp; Construction</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 4, margin: '1px 0' }}>
              <span>✔ Architectural Services</span>
              <span>✔ Project Management</span>
            </div>
            <div style={{ textAlign: 'center', marginTop: 1, fontWeight: 600 }}>
              ✔ Genuine Land Sales
            </div>
          </div>

          {/* Reach Out To Us Section */}
          <div style={{ borderTop: '1px dashed #000000', margin: '6px 0' }} />
          <div style={{ fontSize: '10px', lineHeight: 1.35 }}>
            <div style={{ fontWeight: 800, textAlign: 'center', letterSpacing: '0.4px', marginBottom: 2, textTransform: 'uppercase' }}>
              ── REACH OUT TO US ──
            </div>
            <div style={{ textAlign: 'center', fontWeight: 900, fontSize: '12px', padding: '3px 6px', border: '1.5px solid #000000', borderRadius: 5, margin: '2px 0 4px 0', background: '#fafafa' }}>
              📞 Call / WhatsApp: 054 602 9075
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9.5px', margin: '1px 0' }}>
              <span>TikTok: omark.group.of.companies</span>
              <span>FB: Omark Prop</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9.5px' }}>
              <span>IG: omark_real_estate</span>
              <span>YouTube: @omark2</span>
            </div>
          </div>

          {/* Footer Notice & Tear Strip */}
          <div style={{ borderTop: '1px dashed #000000', margin: '6px 0' }} />
          <div style={{ textAlign: 'center', fontSize: '9px', lineHeight: 1.3, color: '#222222' }}>
            <div>Notice: Please wear pass visibly · Return upon checkout</div>
            <div style={{ fontWeight: 800, fontSize: '10px', marginTop: 2, letterSpacing: '0.5px' }}>
              *** HAVE A PRODUCTIVE VISIT ***
            </div>
            <div style={{ marginTop: 4, fontSize: '8.5px', letterSpacing: '2px', color: '#666666' }}>
              - - - - - [ TEAR HERE ] - - - - -
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
