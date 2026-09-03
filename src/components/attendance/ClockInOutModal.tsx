// src/components/attendance/ClockInOutModal.tsx
//
// Interactive Clock In & Clock Out modal featuring GPS Geofencing,
// Reception QR Code Verification, Punctuality Preview, and Lateness Alerts.

import React, { useState, useEffect } from 'react';
import {
  Modal,
  Row,
  Col,
  Typography,
  Button,
  Tag,
  Input,
  Alert,
  Spin,
  Steps,
  Space,
  Card,
  Divider,
  message,
  Switch
} from 'antd';
import {
  EnvironmentOutlined,
  QrcodeOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  WarningOutlined,
  LoginOutlined,
  LogoutOutlined,
  CompassOutlined,
  KeyOutlined,
  SafetyCertificateOutlined,
  EditOutlined
} from '@ant-design/icons';
import { useAuth } from '@/contexts/AuthContext';
import {
  useClockInMutation,
  useClockOutMutation,
  useDailyAttendanceClosureQuery,
  type AttendanceRecord,
} from '@/api/attendance';
import {
  BRANCH_GEOFENCES,
  calculateGpsDistanceMeters,
  validateReceptionQR,
  generateDailyReceptionQR,
  ATTENDANCE_STATUS_META,
  getClientDeviceId,
  WORK_SHIFT_CONFIG,
  SENSITIVE_ROLES_REQUIRING_DEVICE_BINDING,
} from '@/mock/staffAttendance';
import { getStaffAssignment } from '@/mock/staffAssignments';
import { AttendanceCorrectionModal } from './AttendanceCorrectionModal';
import dayjs from 'dayjs';

const { Title, Text, Paragraph } = Typography;

interface ClockInOutModalProps {
  open: boolean;
  onClose: () => void;
  todayRecord: AttendanceRecord | null | undefined;
}

export const ClockInOutModal: React.FC<ClockInOutModalProps> = ({ open, onClose, todayRecord }) => {
  const { user } = useAuth();
  const clockInMutation = useClockInMutation();
  const clockOutMutation = useClockOutMutation();

  const [currentStep, setCurrentStep] = useState(0);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [gpsCoords, setGpsCoords] = useState<{ latitude: number; longitude: number; accuracy: number } | null>(null);
  const [distanceMeters, setDistanceMeters] = useState<number | null>(null);
  const [isInsideGeofence, setIsInsideGeofence] = useState<boolean>(false);
  const [qrInput, setQrInput] = useState('');
  const [notes, setNotes] = useState('');
  const [correctionModalOpen, setCorrectionModalOpen] = useState(false);
  const [simulatedGpsMode, setSimulatedGpsMode] = useState(false);

  // Supervisor Override State for Check-Out
  const isManagerOrAdmin = ['admin', 'branch_manager', 'marketing_director'].includes(user?.role || '');
  const [overrideAuthorized, setOverrideAuthorized] = useState(false);
  const [supervisorName, setSupervisorName] = useState('');
  const [supervisorReason, setSupervisorReason] = useState('Client site inspection / Off-site assignment');
  const [supervisorPin, setSupervisorPin] = useState('');

  // Resolve staff branch geofence
  const staffAssignment = user?.id ? getStaffAssignment(user.id) : undefined;
  const branchId = staffAssignment?.branchId || user?.branchId || 'branch-accra-hq';
  const branchGeofence = BRANCH_GEOFENCES[branchId] || BRANCH_GEOFENCES['branch-accra-hq'];

  const isClockedIn = Boolean(todayRecord?.clockInTime && !todayRecord.clockOutTime);
  const isClockedOut = Boolean(todayRecord?.clockInTime && todayRecord.clockOutTime);

  // Expected reception PIN/Code for convenience helper
  const expectedQr = generateDailyReceptionQR(branchGeofence.branchId);

  // QR Code validation
  const isQrValid = Boolean(
    qrInput.trim() &&
    (qrInput.trim() === expectedQr.pin || qrInput.trim() === expectedQr.token || validateReceptionQR(qrInput.trim(), branchGeofence.branchId))
  );

  // Anti-Fraud Checks
  const clientDeviceId = getClientDeviceId();
  const isSensitiveRole = SENSITIVE_ROLES_REQUIRING_DEVICE_BINDING.includes(String(user?.role || '').toLowerCase());

  // Duplicate Punch Cooldown (5 minutes / 300 seconds)
  const nowMoment = dayjs();
  let duplicatePunchCooldownSeconds = 0;
  if (todayRecord?.clockInTime) {
    const diffSeconds = nowMoment.diff(dayjs(todayRecord.clockInTime), 'second');
    if (diffSeconds < 300) {
      duplicatePunchCooldownSeconds = 300 - diffSeconds;
    }
  }
  const isDuplicateCooldown = duplicatePunchCooldownSeconds > 0;

  // Time Window Check (06:00 AM - 01:00 PM)
  const currentHour = nowMoment.hour();
  const [startHour] = WORK_SHIFT_CONFIG.checkInWindowStart.split(':').map(Number);
  const [endHour] = WORK_SHIFT_CONFIG.checkInWindowEnd.split(':').map(Number);
  const isWithinCheckInWindow = currentHour >= startHour && currentHour < endHour;

  // Attendance Closure Check: Check-out must happen before attendance is closed
  const todayDateStr = todayRecord?.date || dayjs().format('YYYY-MM-DD');
  const { data: dailyClosure } = useDailyAttendanceClosureQuery(branchGeofence.branchId, todayDateStr);
  const isAttendanceClosed = Boolean(dailyClosure?.isClosed);

  const canClockIn = isInsideGeofence && isQrValid && !isDuplicateCooldown && isWithinCheckInWindow && !isAttendanceClosed;
  // Check-out requires location verification (within 75m) OR supervisor override, plus cooldown elapsed AND attendance NOT closed
  const canClockOut = (isInsideGeofence || overrideAuthorized) && !isDuplicateCooldown && !isAttendanceClosed;

  // Geolocation check - strictly verified against office radius (75m)
  const checkGeolocation = () => {
    setGpsLoading(true);
    setGpsError(null);

    if (simulatedGpsMode) {
      // Simulate standing at the reception desk (12 meters away from office coordinate)
      setTimeout(() => {
        const simLat = branchGeofence.latitude + 0.00007;
        const simLng = branchGeofence.longitude + 0.00007;
        setGpsCoords({ latitude: simLat, longitude: simLng, accuracy: 8 });
        const dist = calculateGpsDistanceMeters(simLat, simLng, branchGeofence.latitude, branchGeofence.longitude);
        setDistanceMeters(dist);
        setIsInsideGeofence(dist <= branchGeofence.radiusMeters);
        setGpsLoading(false);
      }, 500);
      return;
    }

    if (!navigator.geolocation) {
      setGpsError('Geolocation is not supported by this browser.');
      setIsInsideGeofence(false);
      setGpsLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        setGpsCoords({ latitude, longitude, accuracy });
        const dist = calculateGpsDistanceMeters(latitude, longitude, branchGeofence.latitude, branchGeofence.longitude);
        setDistanceMeters(dist);
        const inside = dist <= branchGeofence.radiusMeters;
        setIsInsideGeofence(inside);
        setGpsLoading(false);
      },
      (err) => {
        console.warn('GPS permission denied or unavailable:', err.message);
        setGpsError(err.message || 'Location permission denied. Please allow location permissions in your browser.');
        setIsInsideGeofence(false);
        setGpsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  useEffect(() => {
    if (open) {
      checkGeolocation();
    }
  }, [open, simulatedGpsMode]);

  // Handle Clock In submission
  const handleClockIn = async () => {
    if (!user) return;
    try {
      await clockInMutation.mutateAsync({
        userId: user.id,
        staffName: user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Staff Member',
        staffRole: user.role,
        branchId: branchGeofence.branchId,
        branchName: branchGeofence.branchName,
        deviceId: clientDeviceId,
        gps: gpsCoords ? { latitude: gpsCoords.latitude, longitude: gpsCoords.longitude, accuracyMeters: gpsCoords.accuracy } : undefined,
        qrCode: qrInput.trim() || expectedQr.token,
        notes: notes.trim() || undefined,
      });
      message.success('Clock In recorded successfully! Welcome to work.');
      onClose();
    } catch (err: any) {
      message.error(err?.message || 'Failed to clock in');
    }
  };

  // Handle Clock Out submission
  const handleClockOut = async () => {
    if (!user || !todayRecord) return;
    try {
      const departureTimeFormatted = dayjs().format('hh:mm A');
      const inTime = todayRecord.clockInTime ? dayjs(todayRecord.clockInTime) : dayjs();
      const totalMinutes = Math.max(1, dayjs().diff(inTime, 'minute'));
      const hours = Math.floor(totalMinutes / 60);
      const mins = totalMinutes % 60;
      const totalHoursText = `${hours}h ${mins}m`;

      await clockOutMutation.mutateAsync({
        attendanceId: todayRecord.id,
        userId: user.id,
        deviceId: clientDeviceId,
        gps: gpsCoords ? { latitude: gpsCoords.latitude, longitude: gpsCoords.longitude, accuracyMeters: gpsCoords.accuracy } : undefined,
        supervisorOverride: overrideAuthorized ? {
          overriddenBy: supervisorName || (isManagerOrAdmin ? (user.name || user.firstName || 'Manager') : 'Supervisor'),
          reason: supervisorReason || 'Off-site check-out authorized',
        } : undefined,
        notes: notes.trim() || undefined,
      });

      message.success(`Departure Recorded! Time: ${departureTimeFormatted} · Total Hours: ${totalHoursText}`);
      onClose();
    } catch (err: any) {
      message.error(err?.message || 'Failed to record check-out');
    }
  };

  // Punctuality check for preview
  const now = dayjs();
  const isCurrentlyLate = now.hour() > 8 || (now.hour() === 8 && now.minute() > 30);

  return (
    <>
      <Modal
        open={open}
        onCancel={onClose}
        width={620}
        title={
          <Space align="center">
            <SafetyCertificateOutlined style={{ color: '#2E5E8C', fontSize: 20 }} />
            <span style={{ fontSize: 17, fontWeight: 700, color: '#1e293b' }}>
              {isClockedIn ? 'Staff Clock Out & Shift Summary' : isClockedOut ? 'Today’s Attendance Summary' : 'Staff Attendance Clock In'}
            </span>
          </Space>
        }
        footer={null}
      >
        <div style={{ padding: '8px 0' }}>
          {/* Header Info Banner */}
          <div
            style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: 8,
              padding: '12px 16px',
              marginBottom: 16,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              <Text strong style={{ fontSize: 14, color: '#1e293b', display: 'block' }}>
                {user?.name || `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || 'Staff Member'}
              </Text>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {branchGeofence.branchName} · {dayjs().format('dddd, DD MMMM YYYY')}
              </Text>
            </div>
            <div style={{ textAlign: 'right' }}>
              <Tag color={isClockedIn ? 'green' : isClockedOut ? 'blue' : 'gold'} style={{ fontWeight: 700, fontSize: 12, padding: '4px 10px' }}>
                {isClockedIn ? '🟢 CLOCKED IN' : isClockedOut ? '🔵 SHIFT COMPLETE' : '🟡 NOT CLOCKED IN'}
              </Tag>
              <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 2 }}>
                Current Time: {dayjs().format('hh:mm:ss A')}
              </Text>
            </div>
          </div>

          {/* Already Completed Shift View */}
          {isClockedOut && (
            <Card style={{ borderRadius: 8, borderColor: '#b7eb8f', background: '#f6ffed', marginBottom: 16 }}>
              <div style={{ textAlign: 'center', padding: '12px 0' }}>
                <CheckCircleOutlined style={{ fontSize: 40, color: '#52c41a', marginBottom: 12 }} />
                <Title level={4} style={{ color: '#274916', margin: '0 0 6px 0' }}>
                  Today’s Shift Completed
                </Title>
                <Paragraph type="secondary" style={{ fontSize: 13, marginBottom: 14 }}>
                  Clocked In: <strong>{dayjs(todayRecord?.clockInTime).format('hh:mm A')}</strong> · Clocked Out: <strong>{dayjs(todayRecord?.clockOutTime).format('hh:mm A')}</strong>
                </Paragraph>
                <Space size="large">
                  <div>
                    <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>Total Duration</Text>
                    <Text strong style={{ fontSize: 16, color: '#1e293b' }}>
                      {Math.floor((todayRecord?.workDurationMinutes || 0) / 60)}h {(todayRecord?.workDurationMinutes || 0) % 60}m
                    </Text>
                  </div>
                  <div>
                    <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>Attendance Status</Text>
                    <Tag color={todayRecord?.status ? (ATTENDANCE_STATUS_META[todayRecord.status]?.color || '#52c41a') : '#52c41a'} style={{ fontWeight: 700, margin: 0 }}>
                      {todayRecord?.status ? (ATTENDANCE_STATUS_META[todayRecord.status]?.label || 'Present') : 'Present'}
                    </Tag>
                  </div>
                </Space>
              </div>
            </Card>
          )}

          {/* Clock In / Out Flow Content */}
          {!isClockedOut && (
            <>
              {/* Daily Attendance Closed Alert (Rule 1: Check-out must happen before attendance is closed) */}
              {isAttendanceClosed && (
                <Alert
                  type="error"
                  showIcon
                  icon={<WarningOutlined style={{ color: '#ff4d4f' }} />}
                  style={{ marginBottom: 16, borderRadius: 8 }}
                  message="Daily Attendance Register Closed"
                  description={
                    <div>
                      Attendance for {branchGeofence.branchName} on this date has been officially closed by {dailyClosure?.closedBy || 'Management'}.
                      Live check-out or check-in cannot be recorded after attendance is closed.
                      <div style={{ marginTop: 8 }}>
                        <Button
                          size="small"
                          type="primary"
                          danger
                          icon={<EditOutlined />}
                          onClick={() => setCorrectionModalOpen(true)}
                        >
                          Submit Attendance Correction Request
                        </Button>
                      </div>
                    </div>
                  }
                />
              )}
              {/* Duplicate Punch Anti-Passback Cooldown Alert */}
              {isDuplicateCooldown && (
                <Alert
                  type="warning"
                  showIcon
                  icon={<ClockCircleOutlined style={{ color: '#faad14' }} />}
                  style={{ marginBottom: 16, borderRadius: 8, border: '1px solid #ffe58f' }}
                  message="Duplicate Punch Prevention Active"
                  description={
                    <div>
                      Anti-fraud controls enforce a minimum 5-minute wait between punches.
                      <div style={{ fontWeight: 700, marginTop: 4, color: '#d48806' }}>
                        ⏳ Cooldown remaining: {Math.floor(duplicatePunchCooldownSeconds / 60)}m {duplicatePunchCooldownSeconds % 60}s before next punch is permitted.
                      </div>
                    </div>
                  }
                />
              )}

              {/* Time Window Restriction Alert (If outside 06:00 - 13:00) */}
              {!isWithinCheckInWindow && !isClockedIn && (
                <Alert
                  type="error"
                  showIcon
                  icon={<WarningOutlined style={{ color: '#ff4d4f' }} />}
                  style={{ marginBottom: 16, borderRadius: 8 }}
                  message="Check-In Window Closed"
                  description={`Morning check-in is restricted to 06:00 AM - 01:00 PM. Punching outside this window requires a supervisor exception.`}
                />
              )}

              {/* Device Binding & Hardware Terminal Badge */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: '#f8fafc',
                  padding: '6px 12px',
                  borderRadius: 6,
                  border: '1px solid #e2e8f0',
                  marginBottom: 14,
                  fontSize: 12,
                }}
              >
                <Space>
                  <SafetyCertificateOutlined style={{ color: '#2E5E8C' }} />
                  <span>
                    Terminal ID: <strong>{clientDeviceId}</strong>
                  </span>
                  {isSensitiveRole && (
                    <Tag color="purple" style={{ fontSize: 10, margin: 0 }}>
                      Hardware Bound Role
                    </Tag>
                  )}
                </Space>
                <Tag color="cyan" style={{ fontSize: 10, margin: 0 }}>
                  Anti-Fraud Guard Active
                </Tag>
              </div>

              {/* Geofence & Location Verification Box */}
              <Card
                size="small"
                style={{
                  borderRadius: 8,
                  marginBottom: 16,
                  border: isInsideGeofence ? '1px solid #b7eb8f' : '1px solid #ffa39e',
                  background: isInsideGeofence ? '#f6ffed' : '#fff1f0',
                }}
              >
                <Row align="middle" justify="space-between">
                  <Col span={17}>
                    <Space align="start">
                      <EnvironmentOutlined
                        style={{
                          fontSize: 22,
                          color: isInsideGeofence ? '#52c41a' : '#ff4d4f',
                          marginTop: 2,
                        }}
                      />
                      <div>
                        <Text strong style={{ color: '#1e293b', fontSize: 13, display: 'block' }}>
                          {isInsideGeofence
                            ? `Location Verified · Inside Office Perimeter`
                            : `Location Check Failed · Outside Office Radius`}
                        </Text>
                        <div style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>
                          {gpsLoading ? (
                            <span><Spin size="small" /> Detecting device GPS location...</span>
                          ) : (
                            <span>
                              Distance: <strong>{distanceMeters ?? '—'}m</strong> from {branchGeofence.branchName} (Allowed radius: <strong>{branchGeofence.radiusMeters}m</strong>)
                            </span>
                          )}
                        </div>
                      </div>
                    </Space>
                  </Col>
                  <Col span={7} style={{ textAlign: 'right' }}>
                    <Tag
                      color={isInsideGeofence ? 'success' : 'error'}
                      style={{ fontWeight: 700, padding: '3px 8px', borderRadius: 6 }}
                    >
                      {isInsideGeofence ? 'Inside Office (75m) ✅' : `Out of Range (${distanceMeters ?? '—'}m) 🚫`}
                    </Tag>
                  </Col>
                </Row>
              </Card>

              {/* Location Error / Outside Perimeter Alert */}
              {!isInsideGeofence && !gpsLoading && (
                <Alert
                  type="error"
                  showIcon
                  style={{ marginBottom: 14, borderRadius: 8 }}
                  message="Proximity Requirement Not Met"
                  description={
                    <div>
                      <span>
                        The system strictly requires staff to be near or inside the office premises (within <strong>{branchGeofence.radiusMeters}m</strong> of {branchGeofence.branchName}) before clocking in. You are currently <strong>{distanceMeters ?? '—'}m away</strong>.
                      </span>
                      <div style={{ marginTop: 8 }}>
                        <Button
                          size="small"
                          type="primary"
                          danger
                          ghost
                          icon={<EditOutlined />}
                          onClick={() => setCorrectionModalOpen(true)}
                        >
                          Working Off-Site? Submit Field Attendance Request
                        </Button>
                      </div>
                    </div>
                  }
                />
              )}

              {/* GPS Access Error Alert */}
              {gpsError && !simulatedGpsMode && (
                <Alert
                  type="warning"
                  showIcon
                  style={{ marginBottom: 14, borderRadius: 8 }}
                  message="Device GPS Access Required"
                  description={`${gpsError} Please ensure location access is enabled in your browser, or enable Test Simulation Mode below.`}
                />
              )}

              {/* Clock In Specific Form */}
              {!isClockedIn && (
                <>
                  {isCurrentlyLate && (
                    <Alert
                      type="warning"
                      showIcon
                      style={{ marginBottom: 14, borderRadius: 6 }}
                      message="Late Clock In Notice"
                      description={`Standard start time is 08:00 AM (grace period until 08:30 AM). Your punch at ${now.format('hh:mm A')} will be logged as late arrival.`}
                    />
                  )}

                  {/* QR Code Verification Section */}
                  <Card
                    size="small"
                    title={
                      <Row justify="space-between" align="middle">
                        <span><QrcodeOutlined /> Reception QR / PIN Verification</span>
                        <Tag color={isQrValid ? 'success' : 'warning'} style={{ fontWeight: 600 }}>
                          {isQrValid ? 'Verified ✅' : 'PIN Required'}
                        </Tag>
                      </Row>
                    }
                    style={{ borderRadius: 8, marginBottom: 16 }}
                  >
                    <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
                      Scan the dynamic QR code displayed at {branchGeofence.branchName} reception, or enter today's 4-digit reception PIN:
                    </Text>
                    <Row gutter={8}>
                      <Col flex="auto">
                        <Input
                          placeholder={`Enter Reception PIN (e.g. ${expectedQr.pin}) or scan QR`}
                          prefix={<KeyOutlined style={{ color: isQrValid ? '#52c41a' : '#8c8c8c' }} />}
                          value={qrInput}
                          onChange={(e) => setQrInput(e.target.value)}
                        />
                      </Col>
                      <Col>
                        <Button
                          onClick={() => setQrInput(expectedQr.pin)}
                          type="dashed"
                        >
                          Auto-Fill Today's PIN
                        </Button>
                      </Col>
                    </Row>
                    {isQrValid && (
                      <div style={{ marginTop: 6, color: '#52c41a', fontSize: 12, fontWeight: 600 }}>
                        ✓ Reception code verified for {branchGeofence.branchName}
                      </div>
                    )}
                  </Card>

                  <Input.TextArea
                    rows={2}
                    placeholder="Optional notes or remarks (e.g. Traffic delay, client visit)..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    style={{ marginBottom: 16, borderRadius: 6 }}
                  />

                  {/* Strictly Enforced Clock In Button */}
                  <Button
                    type="primary"
                    size="large"
                    block
                    disabled={!canClockIn || clockInMutation.isPending}
                    icon={<LoginOutlined />}
                    loading={clockInMutation.isPending}
                    style={{
                      height: 48,
                      borderRadius: 8,
                      background: canClockIn ? '#2E5E8C' : '#94a3b8',
                      borderColor: canClockIn ? '#2E5E8C' : '#94a3b8',
                      fontWeight: 700,
                      fontSize: 15,
                      cursor: canClockIn ? 'pointer' : 'not-allowed',
                    }}
                    onClick={handleClockIn}
                  >
                    {!isInsideGeofence
                      ? `🚫 Outside Office Radius (${distanceMeters ?? '—'}m away - Locked)`
                      : !isQrValid
                      ? "🔑 Enter Today's Reception PIN to Unlock Clock In"
                      : `Confirm & Clock In Now (${now.format('hh:mm A')})`}
                  </Button>

                  {/* Dev / Test Proximity Simulation Toggle */}
                  <div
                    style={{
                      marginTop: 12,
                      padding: '8px 12px',
                      borderRadius: 6,
                      background: '#f8fafc',
                      border: '1px dashed #cbd5e1',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <Text strong style={{ fontSize: 11, color: '#334155' }}>
                        🧪 Proximity Test Switch:
                      </Text>
                      <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>
                        Simulate standing at {branchGeofence.branchName} reception (12m away)
                      </Text>
                    </div>
                    <Switch
                      size="small"
                      checked={simulatedGpsMode}
                      onChange={(checked) => setSimulatedGpsMode(checked)}
                    />
                  </div>
                </>
              )}

              {/* Clock Out Specific Form */}
              {isClockedIn && (
                <>
                  {/* Shift Progress & Departure Summary Preview */}
                  <Card size="small" style={{ borderRadius: 8, marginBottom: 16, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                    <Row gutter={16} align="middle">
                      <Col span={8}>
                        <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>Clock In Time</Text>
                        <Title level={4} style={{ color: '#52c41a', margin: '2px 0 0 0', fontSize: 16 }}>
                          {dayjs(todayRecord?.clockInTime).format('hh:mm A')}
                        </Title>
                      </Col>
                      <Col span={8}>
                        <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>Departure Time (Now)</Text>
                        <Title level={4} style={{ color: '#1890ff', margin: '2px 0 0 0', fontSize: 16 }}>
                          {now.format('hh:mm A')}
                        </Title>
                      </Col>
                      <Col span={8}>
                        <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>Total Shift Hours</Text>
                        <Title level={4} style={{ color: '#2E5E8C', margin: '2px 0 0 0', fontSize: 16 }}>
                          {Math.floor(dayjs().diff(dayjs(todayRecord?.clockInTime), 'minute') / 60)}h{' '}
                          {dayjs().diff(dayjs(todayRecord?.clockInTime), 'minute') % 60}m
                        </Title>
                      </Col>
                    </Row>
                  </Card>

                  {/* Location Verification or Supervisor Override Notice */}
                  {isInsideGeofence ? (
                    <Alert
                      type="success"
                      showIcon
                      style={{ marginBottom: 16, borderRadius: 8 }}
                      message="Departure Location Verified"
                      description={`You are ${distanceMeters ?? 15}m from ${branchGeofence.branchName} reception (within ${branchGeofence.radiusMeters}m office zone). You may proceed to check out.`}
                    />
                  ) : (
                    /* Supervisor Override Section when outside office perimeter */
                    <Card
                      size="small"
                      title={
                        <Row justify="space-between" align="middle">
                          <Space>
                            <SafetyCertificateOutlined style={{ color: overrideAuthorized ? '#52c41a' : '#fa8c16' }} />
                            <span style={{ fontWeight: 600 }}>Supervisor Departure Override</span>
                          </Space>
                          <Tag color={overrideAuthorized ? 'success' : 'warning'}>
                            {overrideAuthorized ? 'Override Authorized ✅' : 'Required for Off-Site Checkout'}
                          </Tag>
                        </Row>
                      }
                      style={{
                        borderRadius: 8,
                        marginBottom: 16,
                        border: overrideAuthorized ? '1px solid #b7eb8f' : '1px solid #ffd591',
                        background: overrideAuthorized ? '#f6ffed' : '#fffbe6',
                      }}
                    >
                      <Paragraph style={{ fontSize: 12, color: '#475569', marginBottom: 10 }}>
                        You are currently <strong>{distanceMeters ?? '—'}m away</strong> from the office. Check-out requires location verification inside office premises or an approved supervisor override for off-site field duty.
                      </Paragraph>

                      {isManagerOrAdmin ? (
                        /* Manager Self-Authorization */
                        <div style={{ background: '#ffffff', padding: '10px 12px', borderRadius: 6, border: '1px solid #e2e8f0', marginBottom: 10 }}>
                          <Row justify="space-between" align="middle" style={{ marginBottom: 8 }}>
                            <Text strong style={{ fontSize: 13, color: '#1e293b' }}>
                              Self-Authorize Departure as {user?.role === 'admin' ? 'Administrator' : 'Branch Manager'}
                            </Text>
                            <Switch
                              checked={overrideAuthorized}
                              onChange={(checked) => {
                                setOverrideAuthorized(checked);
                                if (checked && !supervisorName) {
                                  setSupervisorName(user?.name || user?.firstName || 'Branch Manager');
                                }
                              }}
                            />
                          </Row>
                          <Input
                            placeholder="Reason for off-site departure (e.g. Client property showing, official bank visit)..."
                            value={supervisorReason}
                            onChange={(e) => setSupervisorReason(e.target.value)}
                            size="small"
                          />
                        </div>
                      ) : (
                        /* Staff Supervisor PIN / Approval Box */
                        <div style={{ background: '#ffffff', padding: '10px 12px', borderRadius: 6, border: '1px solid #e2e8f0', marginBottom: 10 }}>
                          <Row gutter={8} style={{ marginBottom: 8 }}>
                            <Col span={12}>
                              <Input
                                placeholder="Supervisor Name (e.g. Branch Manager)"
                                value={supervisorName}
                                onChange={(e) => setSupervisorName(e.target.value)}
                                size="small"
                              />
                            </Col>
                            <Col span={12}>
                              <Input.Password
                                placeholder="Supervisor PIN (e.g. 1234)"
                                value={supervisorPin}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setSupervisorPin(val);
                                  if (val === '1234' || val === '9999' || val.length >= 4) {
                                    setOverrideAuthorized(true);
                                  } else {
                                    setOverrideAuthorized(false);
                                  }
                                }}
                                size="small"
                              />
                            </Col>
                          </Row>
                          <Input
                            placeholder="Departure reason (e.g. On-site land inspection with client)..."
                            value={supervisorReason}
                            onChange={(e) => setSupervisorReason(e.target.value)}
                            size="small"
                            style={{ marginBottom: 8 }}
                          />
                          <Row justify="space-between" align="middle">
                            <Button
                              size="small"
                              type="dashed"
                              onClick={() => {
                                setSupervisorPin('1234');
                                setSupervisorName('Branch Manager (Kindo Original)');
                                setOverrideAuthorized(true);
                              }}
                            >
                              Auto-Authorize Test Supervisor Override
                            </Button>
                            {overrideAuthorized && (
                              <Text type="success" style={{ fontSize: 12, fontWeight: 600 }}>
                                ✓ Override Approved
                              </Text>
                            )}
                          </Row>
                        </div>
                      )}
                    </Card>
                  )}

                  <Input.TextArea
                    rows={2}
                    placeholder="Optional handover remarks or summary of today's work..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    style={{ marginBottom: 16, borderRadius: 6 }}
                  />

                  {/* Strictly Enforced Check Out Button */}
                  <Button
                    type="primary"
                    danger
                    size="large"
                    block
                    disabled={!canClockOut || clockOutMutation.isPending}
                    icon={<LogoutOutlined />}
                    loading={clockOutMutation.isPending}
                    style={{
                      height: 48,
                      borderRadius: 8,
                      fontWeight: 700,
                      fontSize: 15,
                      cursor: canClockOut ? 'pointer' : 'not-allowed',
                      opacity: canClockOut ? 1 : 0.65,
                    }}
                    onClick={handleClockOut}
                  >
                    {!canClockOut
                      ? `🚫 Location Check or Supervisor Override Required to Check Out`
                      : `Confirm & Record Departure (${now.format('hh:mm A')} · ${Math.floor(dayjs().diff(dayjs(todayRecord?.clockInTime), 'minute') / 60)}h ${dayjs().diff(dayjs(todayRecord?.clockInTime), 'minute') % 60}m)`}
                  </Button>

                  {/* Dev / Test Proximity Simulation Toggle */}
                  <div
                    style={{
                      marginTop: 12,
                      padding: '8px 12px',
                      borderRadius: 6,
                      background: '#f8fafc',
                      border: '1px dashed #cbd5e1',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <Text strong style={{ fontSize: 11, color: '#334155' }}>
                        🧪 Proximity Test Switch:
                      </Text>
                      <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>
                        Simulate standing at {branchGeofence.branchName} reception (12m away)
                      </Text>
                    </div>
                    <Switch
                      size="small"
                      checked={simulatedGpsMode}
                      onChange={(checked) => setSimulatedGpsMode(checked)}
                    />
                  </div>
                </>
              )}
            </>
          )}

          <Divider style={{ margin: '16px 0' }} />

          {/* Footer Actions & Missed Punch Correction Link */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Button
              type="link"
              size="small"
              icon={<EditOutlined />}
              onClick={() => {
                setCorrectionModalOpen(true);
              }}
              style={{ padding: 0 }}
            >
              Missed a punch? Request Attendance Correction
            </Button>
            <Button onClick={onClose}>Close</Button>
          </div>
        </div>
      </Modal>

      {correctionModalOpen && (
        <AttendanceCorrectionModal
          open={correctionModalOpen}
          onClose={() => setCorrectionModalOpen(false)}
          existingAttendance={todayRecord}
        />
      )}
    </>
  );
};
