import React, { useState, useEffect } from 'react';
import {
  Card,
  Row,
  Col,
  Switch,
  Slider,
  InputNumber,
  TimePicker,
  Button,
  Space,
  Typography,
  Tag,
  Divider,
  Table,
  Badge,
  Alert,
  Tooltip,
  Modal,
  message,
  Popconfirm,
  Tabs,
  Input
} from 'antd';
import {
  ThunderboltOutlined,
  CompassOutlined,
  BellOutlined,
  FieldTimeOutlined,
  BarChartOutlined,
  CheckCircleOutlined,
  SyncOutlined,
  SaveOutlined,
  RocketOutlined,
  SafetyCertificateOutlined,
  AlertOutlined,
  HistoryOutlined,
  InfoCircleOutlined,
  EnvironmentOutlined,
  LockOutlined,
  TeamOutlined,
  SendOutlined,
  AimOutlined,
  ClockCircleOutlined
} from '@ant-design/icons';
import {
  useAttendanceAutomationConfigQuery,
  useUpdateAttendanceAutomationConfigMutation,
  useAutomationExecutionLogsQuery,
  useTriggerAutomationJobMutation,
  type AttendanceAutomationConfig,
  type AutomationExecutionLog
} from '@/api/attendance';
import {
  getBranchGeofences,
  updateBranchGeofenceRadius,
  updateBranchGeofenceDetails,
  calculateGpsDistanceMeters,
  type BranchGeofence
} from '@/mock/staffAttendance';
import dayjs from 'dayjs';

const { Title, Text, Paragraph } = Typography;

export const AttendanceAutomationsView: React.FC = () => {
  const { data: configData, isLoading: configLoading } = useAttendanceAutomationConfigQuery();
  const { data: logsData = [], isLoading: logsLoading } = useAutomationExecutionLogsQuery();
  const updateConfigMutation = useUpdateAttendanceAutomationConfigMutation();
  const triggerJobMutation = useTriggerAutomationJobMutation();

  const [formState, setFormState] = useState<AttendanceAutomationConfig | null>(null);
  const [activeTabKey, setActiveTabKey] = useState<string>('geofencing');
  const [geofencesMap, setGeofencesMap] = useState<Record<string, BranchGeofence>>(() => getBranchGeofences());

  // Edit Coordinates Modal state
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<BranchGeofence | null>(null);
  const [editLat, setEditLat] = useState<number>(0);
  const [editLng, setEditLng] = useState<number>(0);
  const [editRadius, setEditRadius] = useState<number>(75);
  const [editAddress, setEditAddress] = useState<string>('');
  const [isLocating, setIsLocating] = useState<boolean>(false);

  // Test GPS Distance Tool state
  const [testModalOpen, setTestModalOpen] = useState(false);
  const [testBranch, setTestBranch] = useState<BranchGeofence | null>(null);
  const [testLat, setTestLat] = useState<number>(5.6037);
  const [testLng, setTestLng] = useState<number>(-0.1870);
  const [testResult, setTestResult] = useState<{ distanceMeters: number; isWithin: boolean } | null>(null);

  useEffect(() => {
    if (configData) {
      setFormState(JSON.parse(JSON.stringify(configData)));
    }
  }, [configData]);

  const refreshGeofences = () => {
    setGeofencesMap(getBranchGeofences());
  };

  useEffect(() => {
    window.addEventListener('omark-attendance-changed', refreshGeofences);
    return () => {
      window.removeEventListener('omark-attendance-changed', refreshGeofences);
    };
  }, []);

  if (configLoading || !formState) {
    return (
      <Card style={{ borderRadius: 12, textAlign: 'center', padding: '60px 0' }}>
        <SyncOutlined spin style={{ fontSize: 32, color: '#2E5E8C' }} />
        <Paragraph style={{ marginTop: 16, color: '#64748b' }}>
          Loading Attendance Automation & Policy Rules Engine...
        </Paragraph>
      </Card>
    );
  }

  const handleSaveConfig = async () => {
    try {
      await updateConfigMutation.mutateAsync(formState);
      refreshGeofences();
      message.success('Attendance automation configuration saved and synchronized!');
    } catch {
      message.error('Failed to save automation settings.');
    }
  };

  const handleTriggerJob = async (jobType: 'geofencing' | 'reminders' | 'shift_rules' | 'analytics' | 'all') => {
    try {
      const res = await triggerJobMutation.mutateAsync({
        jobType,
        triggeredBy: 'Administrator Console',
      });
      refreshGeofences();
      message.success(`Automation Job Executed: ${res.title}`);
    } catch {
      message.error('Failed to execute automation job.');
    }
  };

  const handleBranchRadiusChange = (branchId: string, radiusMeters: number) => {
    updateBranchGeofenceRadius(branchId, radiusMeters);
    refreshGeofences();
    message.success(`Updated perimeter radius for ${geofencesMap[branchId]?.branchName || 'Branch'} to ${radiusMeters}m`);
  };

  const handleOpenEditModal = (branch: BranchGeofence) => {
    setEditingBranch(branch);
    setEditLat(branch.latitude);
    setEditLng(branch.longitude);
    setEditRadius(branch.radiusMeters || 75);
    setEditAddress(branch.address || '');
    setEditModalOpen(true);
  };

  const handleSaveBranchDetails = () => {
    if (!editingBranch) return;
    if (isNaN(editLat) || isNaN(editLng)) {
      message.error('Please enter valid numeric latitude and longitude coordinates.');
      return;
    }
    updateBranchGeofenceDetails(editingBranch.branchId, {
      latitude: Number(editLat),
      longitude: Number(editLng),
      radiusMeters: Number(editRadius),
      address: editAddress,
    });
    refreshGeofences();
    setEditModalOpen(false);
    message.success(`Saved GPS coordinates and perimeter for ${editingBranch.branchName}!`);
  };

  const handleAutoDetectCurrentLocation = () => {
    if (!navigator.geolocation) {
      message.error('Geolocation is not supported by your browser.');
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setIsLocating(false);
        const lat = Number(position.coords.latitude.toFixed(6));
        const lng = Number(position.coords.longitude.toFixed(6));
        setEditLat(lat);
        setEditLng(lng);
        message.success(`Auto-detected your current device location: ${lat}, ${lng} (Accuracy: ±${Math.round(position.coords.accuracy)}m)`);
      },
      (error) => {
        setIsLocating(false);
        message.warning(`Could not auto-detect location: ${error.message}. You can enter coordinates manually or copy from Google Maps.`);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleRunDistanceTest = () => {
    if (!testBranch) return;
    const dist = calculateGpsDistanceMeters(testLat, testLng, testBranch.latitude, testBranch.longitude);
    setTestResult({
      distanceMeters: dist,
      isWithin: dist <= testBranch.radiusMeters,
    });
  };

  // ── Multi-Branch Geofences Table Data ──────────────────────────────────────
  const uniqueBranchesList: BranchGeofence[] = [
    geofencesMap['branch-accra-hq'] || geofencesMap['b2'],
    geofencesMap['branch-kumasi'] || geofencesMap['b1'],
    geofencesMap['branch-takoradi'] || geofencesMap['b3'],
    geofencesMap['branch-tamale'] || geofencesMap['b4'],
    geofencesMap['branch-wa'] || geofencesMap['wa'],
  ].filter(Boolean);

  const geofenceTableColumns = [
    {
      title: 'Branch Office Location',
      key: 'branch',
      width: 250,
      render: (_: any, record: BranchGeofence) => (
        <Space align="start" size={12}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: '#e0f2fe',
              color: '#0284c7',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 20,
              marginTop: 2,
              flexShrink: 0,
            }}
          >
            <EnvironmentOutlined />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Text strong style={{ fontSize: 14, color: '#0f172a' }}>
                {record.branchName}
              </Text>
            </div>
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 2 }}>
              {record.address}
            </Text>
          </div>
        </Space>
      ),
    },
    {
      title: 'GPS Center Coordinates',
      key: 'coordinates',
      width: 230,
      render: (_: any, record: BranchGeofence) => (
        <Space direction="vertical" size={4}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <Tag color="geekblue" style={{ borderRadius: 6, margin: 0, fontSize: 12 }}>
              Lat: {record.latitude.toFixed(6)}
            </Tag>
            <Tag color="cyan" style={{ borderRadius: 6, margin: 0, fontSize: 12 }}>
              Lng: {record.longitude.toFixed(6)}
            </Tag>
          </div>
          <Space size={8}>
            <Button
              type="link"
              size="small"
              icon={<EnvironmentOutlined />}
              href={`https://www.google.com/maps?q=${record.latitude},${record.longitude}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ padding: 0, fontSize: 11 }}
            >
              View on Google Maps
            </Button>
            <Button
              type="link"
              size="small"
              onClick={() => handleOpenEditModal(record)}
              style={{ padding: 0, fontSize: 11, color: '#0284c7' }}
            >
              Edit GPS
            </Button>
          </Space>
        </Space>
      ),
    },
    {
      title: 'Perimeter Boundary Radius',
      key: 'radius',
      width: 320,
      render: (_: any, record: BranchGeofence) => (
        <div style={{ paddingRight: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <Space align="center" size={6}>
              <Text strong style={{ fontSize: 13 }}>
                Radius:
              </Text>
              <InputNumber
                min={30}
                max={250}
                step={5}
                size="small"
                value={record.radiusMeters}
                onChange={(val) => handleBranchRadiusChange(record.branchId, Number(val) || 75)}
                style={{ width: 75 }}
                addonAfter="m"
              />
            </Space>
            <Tag
              color={record.radiusMeters <= 75 ? 'cyan' : record.radiusMeters <= 120 ? 'blue' : 'purple'}
              style={{ borderRadius: 6, fontWeight: 600, margin: 0 }}
            >
              {record.radiusMeters <= 75 ? 'Strict Office (≤75m)' : record.radiusMeters <= 120 ? 'Standard Compound' : 'Extended Campus'}
            </Tag>
          </div>
          <Slider
            min={30}
            max={250}
            step={5}
            value={record.radiusMeters}
            onChange={(val) => handleBranchRadiusChange(record.branchId, val)}
            marks={{
              30: '30m',
              100: '100m',
              175: '175m',
              250: '250m',
            }}
          />
        </div>
      ),
    },
    {
      title: 'Security & Status',
      key: 'security',
      width: 190,
      render: () => (
        <Space direction="vertical" size={4}>
          <Tag color="success" icon={<CheckCircleOutlined />} style={{ borderRadius: 6, fontWeight: 600 }}>
            Active & Enforcing
          </Tag>
          <Tag color="purple" icon={<LockOutlined />} style={{ borderRadius: 6, fontSize: 11 }}>
            Anti-Mock GPS Active
          </Tag>
        </Space>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 200,
      render: (_: any, record: BranchGeofence) => (
        <Space size={8}>
          <Button
            size="small"
            type="primary"
            ghost
            icon={<AimOutlined />}
            onClick={() => handleOpenEditModal(record)}
            style={{ borderRadius: 6 }}
          >
            Edit Coordinates
          </Button>
          <Button
            size="small"
            icon={<CompassOutlined />}
            onClick={() => {
              setTestBranch(record);
              setTestLat(record.latitude);
              setTestLng(record.longitude);
              setTestResult(null);
              setTestModalOpen(true);
            }}
            style={{ borderRadius: 6 }}
          >
            Test
          </Button>
        </Space>
      ),
    },
  ];

  // ── Logs Table Columns ────────────────────────────────────────────────────
  const logColumns = [
    {
      title: 'Timestamp',
      dataIndex: 'timestamp',
      key: 'timestamp',
      width: 170,
      render: (val: string) => (
        <Space direction="vertical" size={0}>
          <Text strong style={{ fontSize: 13, color: '#1e293b' }}>
            {dayjs(val).format('DD MMM YYYY')}
          </Text>
          <Text type="secondary" style={{ fontSize: 11 }}>
            {dayjs(val).format('hh:mm:ss A')}
          </Text>
        </Space>
      ),
    },
    {
      title: 'Automation Domain',
      dataIndex: 'jobType',
      key: 'jobType',
      width: 160,
      render: (type: string) => {
        switch (type) {
          case 'geofencing':
            return <Tag color="cyan" icon={<CompassOutlined />}>📍 Geofencing</Tag>;
          case 'reminders':
            return <Tag color="gold" icon={<BellOutlined />}>⏰ Reminders</Tag>;
          case 'shift_rules':
            return <Tag color="purple" icon={<FieldTimeOutlined />}>⚖️ Shift Rules</Tag>;
          case 'analytics':
            return <Tag color="blue" icon={<BarChartOutlined />}>📊 Analytics</Tag>;
          default:
            return <Tag color="green" icon={<ThunderboltOutlined />}>⚡ Full Suite</Tag>;
        }
      },
    },
    {
      title: 'Execution Title & Action Details',
      dataIndex: 'title',
      key: 'title',
      render: (title: string, record: AutomationExecutionLog) => (
        <div>
          <div style={{ fontWeight: 700, color: '#1e293b', fontSize: 13 }}>{title}</div>
          <Text type="secondary" style={{ fontSize: 12 }}>{record.details}</Text>
        </div>
      ),
    },
    {
      title: 'Impact',
      dataIndex: 'impactCount',
      key: 'impactCount',
      width: 120,
      align: 'center' as const,
      render: (count: number) => (
        <Badge count={`${count} records`} style={{ backgroundColor: '#2E5E8C', fontWeight: 600 }} />
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      align: 'center' as const,
      render: (status: string) => (
        <Tag color="success" icon={<CheckCircleOutlined />} style={{ fontWeight: 600 }}>
          {status}
        </Tag>
      ),
    },
    {
      title: 'Triggered By',
      dataIndex: 'triggeredBy',
      key: 'triggeredBy',
      width: 180,
      render: (val: string) => (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {val}
        </Text>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* ── TOP HERO BANNER & QUICK ACTIONS ─────────────────────────────── */}
      <Card
        style={{
          borderRadius: 14,
          background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
          color: '#ffffff',
          border: 'none',
          boxShadow: '0 8px 24px rgba(15, 23, 42, 0.25)',
        }}
      >
        <Row align="middle" justify="space-between" gutter={[16, 16]}>
          <Col xs={24} md={16}>
            <Space align="center" size={14}>
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 12,
                  background: 'linear-gradient(135deg, #2E5E8C 0%, #0284c7 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 26,
                  color: '#ffffff',
                  boxShadow: '0 4px 14px rgba(2, 132, 199, 0.4)',
                }}
              >
                <ThunderboltOutlined />
              </div>
              <div>
                <Title level={4} style={{ color: '#ffffff', margin: 0, fontWeight: 800 }}>
                  Attendance Automations & Policy Rules Engine
                </Title>
                <Text style={{ color: '#94a3b8', fontSize: 13 }}>
                  Autonomous background services for precision geofencing, targeted staff notifications, shift cutoffs, and punctuality analytics.
                </Text>
              </div>
            </Space>
          </Col>

          <Col xs={24} md={8} style={{ textAlign: 'right' }}>
            <Space wrap>
              <Button
                icon={<SaveOutlined />}
                onClick={handleSaveConfig}
                loading={updateConfigMutation.isPending}
                style={{ borderRadius: 8, fontWeight: 600 }}
              >
                Save Settings
              </Button>
              <Popconfirm
                title="Execute Full Automation Suite?"
                description="This will synchronize all geofences, dispatch punch reminders to unclocked staff, enforce shift cutoffs, and calculate punctuality scores."
                onConfirm={() => handleTriggerJob('all')}
                okText="Run All Now"
              >
                <Button
                  type="primary"
                  icon={<RocketOutlined />}
                  loading={triggerJobMutation.isPending}
                  style={{
                    borderRadius: 8,
                    fontWeight: 700,
                    background: 'linear-gradient(135deg, #0284c7 0%, #2E5E8C 100%)',
                    border: 'none',
                    boxShadow: '0 4px 12px rgba(2, 132, 199, 0.4)',
                  }}
                >
                  Run Full Suite Now
                </Button>
              </Popconfirm>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* ── MAIN DOMAIN TABS (SPACIOUS, UN-CRAMPED LAYOUT) ─────────────── */}
      <Tabs
        activeKey={activeTabKey}
        onChange={setActiveTabKey}
        type="card"
        size="large"
        items={[
          {
            key: 'geofencing',
            label: (
              <Space>
                <CompassOutlined style={{ color: '#0284c7' }} />
                <span>1. Geofencing & Office Perimeters</span>
              </Space>
            ),
            children: (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {/* Global Geofencing Policy Card */}
                <Card
                  title={
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Space>
                        <SafetyCertificateOutlined style={{ color: '#0284c7', fontSize: 20 }} />
                        <span style={{ fontWeight: 700, fontSize: 16 }}>Global Geofencing Policy Settings</span>
                      </Space>
                      <Switch
                        checked={formState.geofencing.enabled}
                        onChange={(checked) =>
                          setFormState({
                            ...formState,
                            geofencing: { ...formState.geofencing, enabled: checked },
                          })
                        }
                        checkedChildren="Active"
                        unCheckedChildren="Off"
                      />
                    </div>
                  }
                  extra={
                    <Button
                      type="primary"
                      ghost
                      size="small"
                      icon={<SyncOutlined />}
                      loading={triggerJobMutation.isPending}
                      onClick={() => handleTriggerJob('geofencing')}
                    >
                      Sync All Geofences Now
                    </Button>
                  }
                  style={{ borderRadius: 12 }}
                >
                  <Row gutter={[24, 24]}>
                    <Col xs={24} md={12}>
                      <div style={{ padding: '16px', background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                          <Text strong style={{ fontSize: 14 }}>Default Geofence Perimeter Radius</Text>
                          <Space size={6}>
                            <InputNumber
                              min={30}
                              max={200}
                              step={5}
                              size="small"
                              value={formState.geofencing.radiusMeters}
                              onChange={(val) =>
                                setFormState({
                                  ...formState,
                                  geofencing: { ...formState.geofencing, radiusMeters: Number(val) || 75 },
                                })
                              }
                              style={{ width: 80 }}
                              addonAfter="m"
                            />
                            <Tag color="cyan" style={{ fontWeight: 700, fontSize: 12, margin: 0 }}>
                              {formState.geofencing.radiusMeters}m
                            </Tag>
                          </Space>
                        </div>

                        {/* Quick preset selector buttons to eliminate label overlap */}
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                          {[
                            { label: '30m (Min)', val: 30 },
                            { label: '50m (Strict)', val: 50 },
                            { label: '75m (Standard)', val: 75 },
                            { label: '100m', val: 100 },
                            { label: '150m', val: 150 },
                            { label: '200m (Campus)', val: 200 },
                          ].map((p) => (
                            <Button
                              key={p.val}
                              size="small"
                              type={formState.geofencing.radiusMeters === p.val ? 'primary' : 'default'}
                              onClick={() =>
                                setFormState({
                                  ...formState,
                                  geofencing: { ...formState.geofencing, radiusMeters: p.val },
                                })
                              }
                              style={{ borderRadius: 6, fontSize: 11 }}
                            >
                              {p.label}
                            </Button>
                          ))}
                        </div>

                        <Slider
                          min={30}
                          max={200}
                          step={5}
                          value={formState.geofencing.radiusMeters}
                          onChange={(val) =>
                            setFormState({
                              ...formState,
                              geofencing: { ...formState.geofencing, radiusMeters: val },
                            })
                          }
                          marks={{
                            30: '30m',
                            100: '100m',
                            200: '200m',
                          }}
                        />
                        <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 12 }}>
                          Staff must be physically within this boundary radius from the branch office coordinates to record check-in and check-out.
                        </Text>
                      </div>
                    </Col>

                    <Col xs={24} md={12}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '16px', background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <Text strong style={{ display: 'block', fontSize: 13 }}>Strict Mock Location & GPS Spoof Auto-Lock</Text>
                            <Text type="secondary" style={{ fontSize: 11 }}>
                              Instantly blocks simulated GPS devices, flags fraud attempt, and alerts management.
                            </Text>
                          </div>
                          <Switch
                            checked={formState.geofencing.strictMockLocationBlock}
                            onChange={(checked) =>
                              setFormState({
                                ...formState,
                                geofencing: { ...formState.geofencing, strictMockLocationBlock: checked },
                              })
                            }
                          />
                        </div>

                        <Divider style={{ margin: 0 }} />

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <Text strong style={{ display: 'block', fontSize: 13 }}>Auto-Prompt Clock-in on Office Arrival</Text>
                            <Text type="secondary" style={{ fontSize: 11 }}>
                              Automatically prompts staff when entering branch perimeter before 08:30 AM.
                            </Text>
                          </div>
                          <Switch
                            checked={formState.geofencing.autoPromptOnArrival}
                            onChange={(checked) =>
                              setFormState({
                                ...formState,
                                geofencing: { ...formState.geofencing, autoPromptOnArrival: checked },
                              })
                            }
                          />
                        </div>

                        <Divider style={{ margin: 0 }} />

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <Text strong style={{ display: 'block', fontSize: 13 }}>Geofence Re-Sync Sentinel Interval</Text>
                            <Text type="secondary" style={{ fontSize: 11 }}>
                              Daemon health check frequency for re-verifying branch coordinates.
                            </Text>
                          </div>
                          <InputNumber
                            min={5}
                            max={120}
                            addonAfter="mins"
                            value={formState.geofencing.autoGeoResyncIntervalMinutes}
                            onChange={(val) =>
                              setFormState({
                                ...formState,
                                geofencing: {
                                  ...formState.geofencing,
                                  autoGeoResyncIntervalMinutes: Number(val) || 15,
                                },
                              })
                            }
                            style={{ width: 120 }}
                          />
                        </div>
                      </div>
                    </Col>
                  </Row>
                </Card>

                {/* GPS Coordinates How-To & Geofencing Guide Card */}
                <Alert
                  type="info"
                  showIcon
                  icon={<AimOutlined style={{ fontSize: 20, color: '#0284c7' }} />}
                  style={{ borderRadius: 12, background: '#f0f9ff', border: '1px solid #bae6fd' }}
                  message={
                    <span style={{ fontWeight: 700, fontSize: 14, color: '#0369a1' }}>
                      How GPS Geofencing Coordinates Work & How to Insert Them
                    </span>
                  }
                  description={
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4, fontSize: 12, color: '#334155' }}>
                      <div>
                        <strong>1. Auto-Detect Your Live Location:</strong> When physically at the branch office, click <Text strong style={{ color: '#0284c7' }}>"Edit Coordinates"</Text> on the branch row and click <Text strong style={{ color: '#0284c7' }}>"Detect Current Device Location"</Text>. Your device GPS will automatically populate exact Latitude & Longitude coordinates.
                      </div>
                      <div>
                        <strong>2. Copy from Google Maps:</strong> Open Google Maps $\rightarrow$ right-click the exact branch building $\rightarrow$ click the coordinates (e.g. <Text code>5.6037, -0.1870</Text>) $\rightarrow$ paste them directly into the Latitude and Longitude fields.
                      </div>
                      <div>
                        <strong>3. Straight-Line Proximity Verification:</strong> When staff record arrival or departure, the system calculates their physical distance from the branch center coordinates. If within the configured office perimeter radius, the punch is validated and approved.
                      </div>
                    </div>
                  }
                />

                {/* Multi-Branch Geofencing Perimeter Table */}
                <Card
                  title={
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Space>
                        <EnvironmentOutlined style={{ color: '#0284c7', fontSize: 18 }} />
                        <span style={{ fontWeight: 700, fontSize: 15 }}>
                          Branch Office Geofencing Perimeter & Coordinate Registry
                        </span>
                      </Space>
                      <Tag color="cyan" style={{ borderRadius: 6, fontWeight: 600 }}>
                        {uniqueBranchesList.length} Active Branch Perimeters
                      </Tag>
                    </div>
                  }
                  style={{ borderRadius: 12 }}
                >
                  <div style={{ overflowX: 'auto', maxWidth: '100%' }}>
                    <Table
                      columns={geofenceTableColumns}
                      dataSource={uniqueBranchesList}
                      rowKey="branchId"
                      pagination={false}
                      size="middle"
                      scroll={{ x: 1150 }}
                    />
                  </div>
                </Card>
              </div>
            ),
          },
          {
            key: 'reminders',
            label: (
              <Space>
                <BellOutlined style={{ color: '#eab308' }} />
                <span>2. Reminders & Alerts Dispatch</span>
              </Space>
            ),
            children: (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {/* Targeting Notice Banner */}
                <Alert
                  message="Intelligent Recipient Targeting Active"
                  description="Automated punch reminders and arrival alerts are delivered ONLY to affected staff members based on live attendance status. Staff members who have already clocked in or have approved leave will NOT receive unneeded reminders. Missed punch digests are delivered exclusively to Branch Managers and Admins."
                  type="info"
                  showIcon
                  icon={<TeamOutlined style={{ fontSize: 20 }} />}
                  style={{ borderRadius: 10 }}
                />

                <Row gutter={[20, 20]}>
                  {/* Card 1: Morning Pre-Shift Reminder */}
                  <Col xs={24} md={12}>
                    <Card
                      title={
                        <Space>
                          <ClockCircleOutlined style={{ color: '#0284c7', fontSize: 18 }} />
                          <span style={{ fontWeight: 700, fontSize: 15 }}>Morning Pre-Shift Clock-In Reminder</span>
                        </Space>
                      }
                      extra={
                        <Switch
                          checked={formState.reminders.morningPreShiftReminder}
                          onChange={(checked) =>
                            setFormState({
                              ...formState,
                              reminders: { ...formState.reminders, morningPreShiftReminder: checked },
                            })
                          }
                          checkedChildren="On"
                          unCheckedChildren="Off"
                        />
                      }
                      style={{ borderRadius: 12, height: '100%' }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        <div>
                          <Text type="secondary" style={{ fontSize: 12 }}>Target Audience:</Text>
                          <div style={{ marginTop: 4 }}>
                            <Tag color="orange" style={{ borderRadius: 6, fontWeight: 600 }}>
                              Unpunched Staff Only (No Approved Leave)
                            </Tag>
                          </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <Text strong style={{ display: 'block', fontSize: 13 }}>Scheduled Dispatch Time</Text>
                            <Text type="secondary" style={{ fontSize: 11 }}>
                              Dispatched before standard 08:30 AM grace period cutoff.
                            </Text>
                          </div>
                          <TimePicker
                            format="HH:mm"
                            value={dayjs(`2026-01-01 ${formState.reminders.morningReminderTime}`)}
                            onChange={(_, timeStr) =>
                              setFormState({
                                ...formState,
                                reminders: {
                                  ...formState.reminders,
                                  morningReminderTime: typeof timeStr === 'string' ? timeStr : '07:45',
                                },
                              })
                            }
                            style={{ width: 110 }}
                          />
                        </div>

                        <Divider style={{ margin: '6px 0' }} />

                        <Button
                          type="primary"
                          ghost
                          icon={<SendOutlined />}
                          onClick={() => handleTriggerJob('reminders')}
                          loading={triggerJobMutation.isPending}
                          block
                        >
                          Simulate & Dispatch to Unclocked Staff
                        </Button>
                      </div>
                    </Card>
                  </Col>

                  {/* Card 2: Evening Departure Check-Out Reminder */}
                  <Col xs={24} md={12}>
                    <Card
                      title={
                        <Space>
                          <FieldTimeOutlined style={{ color: '#8b5cf6', fontSize: 18 }} />
                          <span style={{ fontWeight: 700, fontSize: 15 }}>Evening Check-Out Departure Reminder</span>
                        </Space>
                      }
                      extra={
                        <Switch
                          checked={formState.reminders.eveningCheckOutReminder}
                          onChange={(checked) =>
                            setFormState({
                              ...formState,
                              reminders: { ...formState.reminders, eveningCheckOutReminder: checked },
                            })
                          }
                          checkedChildren="On"
                          unCheckedChildren="Off"
                        />
                      }
                      style={{ borderRadius: 12, height: '100%' }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        <div>
                          <Text type="secondary" style={{ fontSize: 12 }}>Target Audience:</Text>
                          <div style={{ marginTop: 4 }}>
                            <Tag color="cyan" style={{ borderRadius: 6, fontWeight: 600 }}>
                              Active Clocked-In Staff Awaiting Departure
                            </Tag>
                          </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <Text strong style={{ display: 'block', fontSize: 13 }}>Scheduled Dispatch Time</Text>
                            <Text type="secondary" style={{ fontSize: 11 }}>
                              Alerts staff before daily register closure at 06:30 PM.
                            </Text>
                          </div>
                          <TimePicker
                            format="HH:mm"
                            value={dayjs(`2026-01-01 ${formState.reminders.eveningReminderTime}`)}
                            onChange={(_, timeStr) =>
                              setFormState({
                                ...formState,
                                reminders: {
                                  ...formState.reminders,
                                  eveningReminderTime: typeof timeStr === 'string' ? timeStr : '16:45',
                                },
                              })
                            }
                            style={{ width: 110 }}
                          />
                        </div>

                        <Divider style={{ margin: '6px 0' }} />

                        <Button
                          icon={<SendOutlined />}
                          onClick={() => handleTriggerJob('reminders')}
                          loading={triggerJobMutation.isPending}
                          block
                        >
                          Dispatch Departure Reminder
                        </Button>
                      </div>
                    </Card>
                  </Col>

                  {/* Card 3: Manager Missed-Punch Alert */}
                  <Col xs={24} md={12}>
                    <Card
                      title={
                        <Space>
                          <AlertOutlined style={{ color: '#ef4444', fontSize: 18 }} />
                          <span style={{ fontWeight: 700, fontSize: 15 }}>Branch Manager Missed-Punch Digest</span>
                        </Space>
                      }
                      extra={
                        <Switch
                          checked={formState.reminders.managerUnpunchedStaffAlert}
                          onChange={(checked) =>
                            setFormState({
                              ...formState,
                              reminders: { ...formState.reminders, managerUnpunchedStaffAlert: checked },
                            })
                          }
                          checkedChildren="On"
                          unCheckedChildren="Off"
                        />
                      }
                      style={{ borderRadius: 12, height: '100%' }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        <div>
                          <Text type="secondary" style={{ fontSize: 12 }}>Target Audience:</Text>
                          <div style={{ marginTop: 4 }}>
                            <Tag color="red" style={{ borderRadius: 6, fontWeight: 600 }}>
                              Delivered strictly to Branch Managers & Admins
                            </Tag>
                          </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <Text strong style={{ display: 'block', fontSize: 13 }}>Morning Briefing Dispatch Time</Text>
                            <Text type="secondary" style={{ fontSize: 11 }}>
                              Sends comprehensive missed-punch summary across branches.
                            </Text>
                          </div>
                          <TimePicker
                            format="HH:mm"
                            value={dayjs(`2026-01-01 ${formState.reminders.managerAlertTime}`)}
                            onChange={(_, timeStr) =>
                              setFormState({
                                ...formState,
                                reminders: {
                                  ...formState.reminders,
                                  managerAlertTime: typeof timeStr === 'string' ? timeStr : '09:15',
                                },
                              })
                            }
                            style={{ width: 110 }}
                          />
                        </div>

                        <Divider style={{ margin: '6px 0' }} />

                        <Button
                          icon={<BellOutlined />}
                          onClick={() => handleTriggerJob('reminders')}
                          loading={triggerJobMutation.isPending}
                          block
                        >
                          Send Manager Briefing Now
                        </Button>
                      </div>
                    </Card>
                  </Col>

                  {/* Card 4: Stale Request Escalation Alert */}
                  <Col xs={24} md={12}>
                    <Card
                      title={
                        <Space>
                          <SafetyCertificateOutlined style={{ color: '#f59e0b', fontSize: 18 }} />
                          <span style={{ fontWeight: 700, fontSize: 15 }}>Stale Request Escalation Sentinel</span>
                        </Space>
                      }
                      extra={
                        <Switch
                          checked={formState.reminders.stalePendingRequestsAlert}
                          onChange={(checked) =>
                            setFormState({
                              ...formState,
                              reminders: { ...formState.reminders, stalePendingRequestsAlert: checked },
                            })
                          }
                          checkedChildren="On"
                          unCheckedChildren="Off"
                        />
                      }
                      style={{ borderRadius: 12, height: '100%' }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        <div>
                          <Text type="secondary" style={{ fontSize: 12 }}>Target Audience:</Text>
                          <div style={{ marginTop: 4 }}>
                            <Tag color="gold" style={{ borderRadius: 6, fontWeight: 600 }}>
                              HR Department & Branch Reviewers
                            </Tag>
                          </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <Text strong style={{ display: 'block', fontSize: 13 }}>Escalation Threshold Hours</Text>
                            <Text type="secondary" style={{ fontSize: 11 }}>
                              Alerts HR if leaves or corrections remain pending &gt; threshold.
                            </Text>
                          </div>
                          <InputNumber
                            min={6}
                            max={72}
                            addonAfter="hrs"
                            value={formState.reminders.staleThresholdHours}
                            onChange={(val) =>
                              setFormState({
                                ...formState,
                                reminders: {
                                  ...formState.reminders,
                                  staleThresholdHours: Number(val) || 24,
                                },
                              })
                            }
                            style={{ width: 110 }}
                          />
                        </div>

                        <Divider style={{ margin: '6px 0' }} />

                        <Button
                          icon={<SyncOutlined />}
                          onClick={() => handleTriggerJob('reminders')}
                          loading={triggerJobMutation.isPending}
                          block
                        >
                          Scan Pending Approvals
                        </Button>
                      </div>
                    </Card>
                  </Col>
                </Row>
              </div>
            ),
          },
          {
            key: 'shift_rules',
            label: (
              <Space>
                <FieldTimeOutlined style={{ color: '#8b5cf6' }} />
                <span>3. Shift Rules & Cutoff Governance</span>
              </Space>
            ),
            children: (
              <Card
                title={
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Space>
                      <FieldTimeOutlined style={{ color: '#8b5cf6', fontSize: 20 }} />
                      <span style={{ fontWeight: 700, fontSize: 16 }}>Shift Policies & Automated Register Cutoff</span>
                    </Space>
                    <Switch
                      checked={formState.shiftRules.enabled}
                      onChange={(checked) =>
                        setFormState({
                          ...formState,
                          shiftRules: { ...formState.shiftRules, enabled: checked },
                        })
                      }
                      checkedChildren="Active"
                      unCheckedChildren="Off"
                    />
                  </div>
                }
                extra={
                  <Button
                    type="primary"
                    ghost
                    size="small"
                    icon={<FieldTimeOutlined />}
                    loading={triggerJobMutation.isPending}
                    onClick={() => handleTriggerJob('shift_rules')}
                  >
                    Enforce Shift Cutoffs
                  </Button>
                }
                style={{ borderRadius: 12 }}
              >
                <Row gutter={[24, 24]}>
                  <Col xs={24} md={12}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 16, background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0' }}>
                      <div>
                        <Text strong style={{ display: 'block', fontSize: 14 }}>Grace Period Tolerance Window</Text>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          Arrivals after 08:00 AM + grace period are tagged Late Arrival (08:30 AM).
                        </Text>
                      </div>
                      <InputNumber
                        min={5}
                        max={60}
                        addonAfter="mins"
                        value={formState.shiftRules.gracePeriodMinutes}
                        onChange={(val) =>
                          setFormState({
                            ...formState,
                            shiftRules: { ...formState.shiftRules, gracePeriodMinutes: Number(val) || 30 },
                          })
                        }
                        style={{ width: 120 }}
                      />
                    </div>
                  </Col>

                  <Col xs={24} md={12}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 16, background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0' }}>
                      <div>
                        <Text strong style={{ display: 'block', fontSize: 14 }}>Half-Day Auto-Classification Threshold</Text>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          Shifts completed with &lt; duration are auto-classified as Half Day.
                        </Text>
                      </div>
                      <InputNumber
                        min={120}
                        max={360}
                        addonAfter="mins"
                        value={formState.shiftRules.halfDayThresholdMinutes}
                        onChange={(val) =>
                          setFormState({
                            ...formState,
                            shiftRules: { ...formState.shiftRules, halfDayThresholdMinutes: Number(val) || 240 },
                          })
                        }
                        style={{ width: 130 }}
                      />
                    </div>
                  </Col>

                  <Col xs={24} md={12}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 16, background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0' }}>
                      <div>
                        <Text strong style={{ display: 'block', fontSize: 14 }}>Early Departure Threshold Cutoff</Text>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          Clock-outs before this time are automatically flagged as Early Departure.
                        </Text>
                      </div>
                      <TimePicker
                        format="HH:mm"
                        value={dayjs(`2026-01-01 ${formState.shiftRules.earlyDepartureThresholdTime}`)}
                        onChange={(_, timeStr) =>
                          setFormState({
                            ...formState,
                            shiftRules: {
                              ...formState.shiftRules,
                              earlyDepartureThresholdTime: typeof timeStr === 'string' ? timeStr : '16:30',
                            },
                          })
                        }
                        style={{ width: 110 }}
                      />
                    </div>
                  </Col>

                  <Col xs={24} md={12}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 16, background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0' }}>
                      <div>
                        <Text strong style={{ display: 'block', fontSize: 14 }}>Automated Daily Register Closure Scheduler</Text>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          Closes branch registers and locks live check-outs at cutoff time.
                        </Text>
                      </div>
                      <Space>
                        <TimePicker
                          format="HH:mm"
                          value={dayjs(`2026-01-01 ${formState.shiftRules.autoCloseTime}`)}
                          onChange={(_, timeStr) =>
                            setFormState({
                              ...formState,
                              shiftRules: {
                                ...formState.shiftRules,
                                autoCloseTime: typeof timeStr === 'string' ? timeStr : '18:30',
                              },
                            })
                          }
                          style={{ width: 100 }}
                        />
                        <Switch
                          checked={formState.shiftRules.autoCloseDailyRegister}
                          onChange={(checked) =>
                            setFormState({
                              ...formState,
                              shiftRules: { ...formState.shiftRules, autoCloseDailyRegister: checked },
                            })
                          }
                        />
                      </Space>
                    </div>
                  </Col>
                </Row>
              </Card>
            ),
          },
          {
            key: 'analytics',
            label: (
              <Space>
                <BarChartOutlined style={{ color: '#0284c7' }} />
                <span>4. Analytics & Punctuality Bonus Pool</span>
              </Space>
            ),
            children: (
              <Card
                title={
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Space>
                      <BarChartOutlined style={{ color: '#0284c7', fontSize: 20 }} />
                      <span style={{ fontWeight: 700, fontSize: 16 }}>Punctuality Scoring & Performance Bonuses</span>
                    </Space>
                    <Switch
                      checked={formState.analytics.enabled}
                      onChange={(checked) =>
                        setFormState({
                          ...formState,
                          analytics: { ...formState.analytics, enabled: checked },
                        })
                      }
                      checkedChildren="Active"
                      unCheckedChildren="Off"
                    />
                  </div>
                }
                extra={
                  <Button
                    type="primary"
                    ghost
                    size="small"
                    icon={<BarChartOutlined />}
                    loading={triggerJobMutation.isPending}
                    onClick={() => handleTriggerJob('analytics')}
                  >
                    Scan Analytics Now
                  </Button>
                }
                style={{ borderRadius: 12 }}
              >
                <Row gutter={[24, 24]}>
                  <Col xs={24} md={12}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 16, background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0' }}>
                      <div>
                        <Text strong style={{ display: 'block', fontSize: 14 }}>Punctuality Bonus Pool Qualification Rate</Text>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          Staff achieving &ge; this on-time percentage qualify for GH₵ 150 monthly bonus.
                        </Text>
                      </div>
                      <Space>
                        <InputNumber
                          min={70}
                          max={100}
                          addonAfter="%"
                          value={formState.analytics.punctualityBonusMinPercent}
                          onChange={(val) =>
                            setFormState({
                              ...formState,
                              analytics: { ...formState.analytics, punctualityBonusMinPercent: Number(val) || 90 },
                            })
                          }
                          style={{ width: 110 }}
                        />
                        <Switch
                          checked={formState.analytics.autoComputePunctualityBonus}
                          onChange={(checked) =>
                            setFormState({
                              ...formState,
                              analytics: { ...formState.analytics, autoComputePunctualityBonus: checked },
                            })
                          }
                        />
                      </Space>
                    </div>
                  </Col>

                  <Col xs={24} md={12}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 16, background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0' }}>
                      <div>
                        <Text strong style={{ display: 'block', fontSize: 14 }}>Chronic Infraction & Repeated Offender Limits</Text>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          Flags staff exceeding late arrival or unexcused absence days per month.
                        </Text>
                      </div>
                      <Space>
                        <InputNumber
                          min={1}
                          max={10}
                          addonAfter="late days"
                          value={formState.analytics.chronicLatenessThresholdDays}
                          onChange={(val) =>
                            setFormState({
                              ...formState,
                              analytics: { ...formState.analytics, chronicLatenessThresholdDays: Number(val) || 3 },
                            })
                          }
                          style={{ width: 130 }}
                        />
                        <InputNumber
                          min={1}
                          max={10}
                          addonAfter="absences"
                          value={formState.analytics.chronicAbsenceThresholdDays}
                          onChange={(val) =>
                            setFormState({
                              ...formState,
                              analytics: { ...formState.analytics, chronicAbsenceThresholdDays: Number(val) || 2 },
                            })
                          }
                          style={{ width: 130 }}
                        />
                      </Space>
                    </div>
                  </Col>
                </Row>
              </Card>
            ),
          },
          {
            key: 'logs',
            label: (
              <Space>
                <HistoryOutlined style={{ color: '#2E5E8C' }} />
                <span>5. Daemon Execution History</span>
                <Badge count={logsData.length} style={{ backgroundColor: '#2E5E8C' }} />
              </Space>
            ),
            children: (
              <Card
                title={
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Space>
                      <HistoryOutlined style={{ color: '#2E5E8C', fontSize: 18 }} />
                      <span style={{ fontWeight: 700 }}>Automation Daemon Execution History & Sentinel Logs</span>
                    </Space>
                    <Button
                      icon={<SyncOutlined />}
                      onClick={() => handleTriggerJob('all')}
                      loading={triggerJobMutation.isPending}
                      size="small"
                    >
                      Trigger Full Scan
                    </Button>
                  </div>
                }
                style={{ borderRadius: 12 }}
              >
                <div style={{ overflowX: 'auto', maxWidth: '100%' }}>
                  <Table
                    columns={logColumns}
                    dataSource={logsData}
                    rowKey="id"
                    loading={logsLoading}
                    pagination={{ pageSize: 8 }}
                    scroll={{ x: 850 }}
                    size="middle"
                  />
                </div>
              </Card>
            ),
          },
        ]}
      />

      {/* ── TEST GPS DISTANCE VERIFICATION MODAL ───────────────────────── */}
      <Modal
        title={
          <Space>
            <AimOutlined style={{ color: '#0284c7' }} />
            <span>GPS Geofence Distance Verification Tool</span>
          </Space>
        }
        open={testModalOpen}
        onCancel={() => setTestModalOpen(false)}
        footer={[
          <Button key="close" onClick={() => setTestModalOpen(false)}>
            Close
          </Button>,
          <Button key="test" type="primary" icon={<AimOutlined />} onClick={handleRunDistanceTest}>
            Calculate Distance
          </Button>,
        ]}
        width={520}
      >
        {testBranch && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Alert
              message={`Testing Perimeter for ${testBranch.branchName}`}
              description={`Office Center Coordinates: Lat ${testBranch.latitude.toFixed(4)}, Lng ${testBranch.longitude.toFixed(4)} · Configured Office Boundary Radius: ${testBranch.radiusMeters}m.`}
              type="info"
              showIcon
            />

            <Row gutter={[16, 16]}>
              <Col span={12}>
                <Text strong style={{ fontSize: 12 }}>Staff Device Latitude</Text>
                <InputNumber
                  style={{ width: '100%', marginTop: 4 }}
                  step={0.0001}
                  value={testLat}
                  onChange={(val) => setTestLat(Number(val))}
                />
              </Col>
              <Col span={12}>
                <Text strong style={{ fontSize: 12 }}>Staff Device Longitude</Text>
                <InputNumber
                  style={{ width: '100%', marginTop: 4 }}
                  step={0.0001}
                  value={testLng}
                  onChange={(val) => setTestLng(Number(val))}
                />
              </Col>
            </Row>

            {testResult && (
              <div
                style={{
                  padding: '16px',
                  borderRadius: 10,
                  background: testResult.isWithin ? '#f0fdf4' : '#fef2f2',
                  border: `1px solid ${testResult.isWithin ? '#86efac' : '#fca5a5'}`,
                  textAlign: 'center',
                }}
              >
                <Text strong style={{ fontSize: 15, color: testResult.isWithin ? '#15803d' : '#b91c1c' }}>
                  {testResult.isWithin ? '✅ WITHIN OFFICE GEOFENCE' : '❌ OUTSIDE OFFICE GEOFENCE'}
                </Text>
                <br />
                <Text style={{ fontSize: 13 }}>
                  Calculated Distance from Branch: <strong>{testResult.distanceMeters} meters</strong> (Perimeter Limit: {testBranch.radiusMeters}m).
                </Text>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* ── EDIT BRANCH GEOFENCE & GPS COORDINATES MODAL ───────────── */}
      <Modal
        title={
          <Space>
            <AimOutlined style={{ color: '#0284c7', fontSize: 18 }} />
            <span>Configure Branch GPS Coordinates & Geofence Perimeter</span>
          </Space>
        }
        open={editModalOpen}
        onCancel={() => setEditModalOpen(false)}
        footer={[
          <Button key="cancel" onClick={() => setEditModalOpen(false)}>
            Cancel
          </Button>,
          <Button key="save" type="primary" icon={<SaveOutlined />} onClick={handleSaveBranchDetails}>
            Save Coordinates & Perimeter
          </Button>,
        ]}
        width={580}
      >
        {editingBranch && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ padding: '12px 16px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
              <Text strong style={{ fontSize: 14, color: '#0f172a' }}>
                {editingBranch.branchName}
              </Text>
              <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>
                Calibrate the exact GPS anchor coordinates and enforce attendance perimeter.
              </Text>
            </div>

            {/* Auto-detect button banner */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px 14px',
                background: '#f0fdf4',
                borderRadius: 8,
                border: '1px solid #bbf7d0',
              }}
            >
              <div>
                <Text strong style={{ color: '#166534', fontSize: 13, display: 'block' }}>
                  Physically at the branch office right now?
                </Text>
                <Text style={{ color: '#15803d', fontSize: 11 }}>
                  Auto-capture high-precision GPS coordinates directly from your device.
                </Text>
              </div>
              <Button
                type="primary"
                icon={<AimOutlined />}
                loading={isLocating}
                onClick={handleAutoDetectCurrentLocation}
                style={{
                  background: '#16a34a',
                  borderColor: '#16a34a',
                  borderRadius: 6,
                  fontWeight: 600,
                  fontSize: 12,
                }}
              >
                Get My Live GPS
              </Button>
            </div>

            {/* Latitude & Longitude inputs */}
            <Row gutter={[16, 16]}>
              <Col span={12}>
                <Text strong style={{ fontSize: 13 }}>Latitude Coordinate</Text>
                <InputNumber
                  style={{ width: '100%', marginTop: 4 }}
                  step={0.000001}
                  precision={6}
                  value={editLat}
                  onChange={(val) => setEditLat(Number(val))}
                  placeholder="e.g. 5.603700"
                />
              </Col>
              <Col span={12}>
                <Text strong style={{ fontSize: 13 }}>Longitude Coordinate</Text>
                <InputNumber
                  style={{ width: '100%', marginTop: 4 }}
                  step={0.000001}
                  precision={6}
                  value={editLng}
                  onChange={(val) => setEditLng(Number(val))}
                  placeholder="e.g. -0.187000"
                />
              </Col>
            </Row>

            {/* Google maps preview button */}
            <div style={{ textAlign: 'right' }}>
              <Button
                type="link"
                size="small"
                icon={<EnvironmentOutlined />}
                href={`https://www.google.com/maps?q=${editLat},${editLng}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ padding: 0, fontSize: 12 }}
              >
                Verify pin on Google Maps ↗
              </Button>
            </div>

            <Divider style={{ margin: '4px 0' }} />

            {/* Perimeter Radius */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <Text strong style={{ fontSize: 13 }}>Office Perimeter Radius</Text>
                <Space size={6}>
                  <InputNumber
                    min={30}
                    max={250}
                    step={5}
                    size="small"
                    value={editRadius}
                    onChange={(val) => setEditRadius(Number(val) || 75)}
                    style={{ width: 80 }}
                    addonAfter="m"
                  />
                  <Tag color="cyan" style={{ fontWeight: 700, margin: 0 }}>
                    {editRadius}m
                  </Tag>
                </Space>
              </div>

              {/* Quick preset selector buttons */}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                {[
                  { label: '30m', val: 30 },
                  { label: '50m (Strict)', val: 50 },
                  { label: '75m (Standard)', val: 75 },
                  { label: '100m', val: 100 },
                  { label: '150m', val: 150 },
                  { label: '250m', val: 250 },
                ].map((p) => (
                  <Button
                    key={p.val}
                    size="small"
                    type={editRadius === p.val ? 'primary' : 'default'}
                    onClick={() => setEditRadius(p.val)}
                    style={{ borderRadius: 6, fontSize: 11 }}
                  >
                    {p.label}
                  </Button>
                ))}
              </div>

              <Slider
                min={30}
                max={250}
                step={5}
                value={editRadius}
                onChange={(val) => setEditRadius(val)}
                marks={{
                  30: '30m',
                  100: '100m',
                  175: '175m',
                  250: '250m',
                }}
              />
              <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 8 }}>
                Staff punches will be strictly verified within {editRadius}m of Lat {editLat.toFixed(4)}, Lng {editLng.toFixed(4)}.
              </Text>
            </div>

            {/* Physical Address input */}
            <div>
              <Text strong style={{ fontSize: 13 }}>Physical Location Address</Text>
              <Input
                style={{ marginTop: 4 }}
                value={editAddress}
                onChange={(e) => setEditAddress(e.target.value)}
                placeholder="e.g. Airport Residential Area, Accra"
              />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
