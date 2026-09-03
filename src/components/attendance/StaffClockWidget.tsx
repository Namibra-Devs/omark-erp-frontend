// src/components/attendance/StaffClockWidget.tsx
//
// Compact header & dashboard attendance pill showing real-time clock state and quick actions.

import React, { useState, useEffect } from 'react';
import { Button, Tag, Space, Tooltip } from 'antd';
import {
  ClockCircleOutlined,
  CheckCircleOutlined,
  LoginOutlined,
  LogoutOutlined,
  FieldTimeOutlined
} from '@ant-design/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useTodayAttendanceQuery } from '@/api/attendance';
import { ClockInOutModal } from './ClockInOutModal';
import dayjs from 'dayjs';

interface StaffClockWidgetProps {
  compact?: boolean;
}

export const StaffClockWidget: React.FC<StaffClockWidgetProps> = ({ compact = false }) => {
  const { user } = useAuth();
  const { data: todayRecord, isLoading } = useTodayAttendanceQuery(user?.id);
  const [modalOpen, setModalOpen] = useState(false);
  const [elapsedMinutes, setElapsedMinutes] = useState(0);

  // Live timer for active shift duration
  useEffect(() => {
    if (todayRecord?.clockInTime && !todayRecord.clockOutTime) {
      const calculateDuration = () => {
        const inTime = dayjs(todayRecord.clockInTime);
        const mins = Math.max(0, dayjs().diff(inTime, 'minute'));
        setElapsedMinutes(mins);
      };
      calculateDuration();
      const interval = setInterval(calculateDuration, 60000);
      return () => clearInterval(interval);
    }
  }, [todayRecord]);

  if (!user || isLoading) return null;

  const isClockedIn = Boolean(todayRecord?.clockInTime && !todayRecord.clockOutTime);
  const isClockedOut = Boolean(todayRecord?.clockInTime && todayRecord.clockOutTime);

  const formatElapsed = (minutes: number) => {
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hrs === 0) return `${mins}m`;
    return `${hrs}h ${mins}m`;
  };

  return (
    <>
      <div style={{ display: 'inline-flex', alignItems: 'center' }}>
        {isClockedIn ? (
          <Tooltip title={`Clocked in at ${dayjs(todayRecord?.clockInTime).format('hh:mm A')} · Click to Clock Out`}>
            <Button
              type="primary"
              size={compact ? 'small' : 'middle'}
              style={{
                background: '#52c41a',
                borderColor: '#52c41a',
                borderRadius: 20,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontWeight: 600,
                boxShadow: '0 2px 6px rgba(82, 196, 26, 0.25)',
              }}
              icon={<ClockCircleOutlined />}
              onClick={() => setModalOpen(true)}
            >
              <span>Clocked In: {dayjs(todayRecord?.clockInTime).format('hh:mm A')}</span>
              <Tag
                color="white"
                style={{
                  color: '#237804',
                  fontWeight: 700,
                  margin: 0,
                  borderRadius: 10,
                  fontSize: 11,
                }}
              >
                {formatElapsed(elapsedMinutes)}
              </Tag>
            </Button>
          </Tooltip>
        ) : isClockedOut ? (
          <Tooltip title={`Shift completed (${Math.round((todayRecord?.workDurationMinutes || 0) / 60 * 10) / 10}h worked) · Click to view details`}>
            <Button
              size={compact ? 'small' : 'middle'}
              style={{
                borderRadius: 20,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                borderColor: '#b7eb8f',
                background: '#f6ffed',
                color: '#389e0d',
                fontWeight: 600,
              }}
              icon={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
              onClick={() => setModalOpen(true)}
            >
              <span>Shift Complete: {dayjs(todayRecord?.clockOutTime).format('hh:mm A')}</span>
            </Button>
          </Tooltip>
        ) : (
          <Tooltip title="You have not clocked in today. Click to Clock In with GPS & QR verification">
            <Button
              size={compact ? 'small' : 'middle'}
              style={{
                borderRadius: 20,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                background: '#fffbe6',
                borderColor: '#ffe58f',
                color: '#d46b08',
                fontWeight: 600,
                boxShadow: '0 2px 4px rgba(250, 173, 20, 0.15)',
              }}
              icon={<LoginOutlined />}
              onClick={() => setModalOpen(true)}
            >
              <span>Clock In</span>
            </Button>
          </Tooltip>
        )}
      </div>

      {modalOpen && (
        <ClockInOutModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          todayRecord={todayRecord}
        />
      )}
    </>
  );
};
