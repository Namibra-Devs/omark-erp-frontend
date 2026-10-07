import React, { useState, useMemo } from 'react';
import {
  Card,
  Row,
  Col,
  Typography,
  Statistic,
  Progress,
  Tag,
  Button,
  Space,
  Modal,
  Form,
  InputNumber,
  message,
  Table,
  Tooltip,
} from 'antd';
import {
  PieChartOutlined,
  SettingOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  CloseCircleOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  ShopOutlined,
  ToolOutlined,
  SafetyCertificateOutlined,
  TeamOutlined,
  FileDoneOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useExpensesQuery, type ExpenseEntity } from '@/api/expenses';
import { tokens } from '@/constants/tokens';

const { Title, Text } = Typography;

const BUDGETS_STORAGE_KEY = 'omark_departmental_budgets';

interface DepartmentBudgetConfig {
  id: string;
  name: string;
  icon: string;
  monthlyBudgetGHS: number;
  categories: string[];
}

const DEFAULT_BUDGET_CONFIGS: DepartmentBudgetConfig[] = [
  {
    id: 'marketing',
    name: 'Marketing & Sales',
    icon: 'ShopOutlined',
    monthlyBudgetGHS: 25000,
    categories: ['marketing', 'promotion', 'branding', 'hospitality', 'client hospitality', 'advertising', 'sales'],
  },
  {
    id: 'operations',
    name: 'Operations & Site Works',
    icon: 'ToolOutlined',
    monthlyBudgetGHS: 35000,
    categories: ['fuel', 'power', 'power & fuel', 'transport', 'transport & fuel', 'maintenance', 'site maintenance', 'construction', 'security'],
  },
  {
    id: 'admin',
    name: 'Administration & Office',
    icon: 'FileDoneOutlined',
    monthlyBudgetGHS: 15000,
    categories: ['office supplies', 'utilities', 'amenities', 'stationery', 'internet', 'cleaning', 'admin'],
  },
  {
    id: 'legal',
    name: 'Legal, Land & Compliance',
    icon: 'SafetyCertificateOutlined',
    monthlyBudgetGHS: 20000,
    categories: ['legal', 'documentation', 'legal & documentation', 'permits', 'titling', 'survey', 'compliance'],
  },
  {
    id: 'hr',
    name: 'HR, Staff Welfare & Allowances',
    icon: 'TeamOutlined',
    monthlyBudgetGHS: 10000,
    categories: ['welfare', 'staff welfare', 'training', 'allowances', 'uniforms', 'medical', 'per diem'],
  },
];

function getStoredBudgetConfigs(): DepartmentBudgetConfig[] {
  try {
    const raw = localStorage.getItem(BUDGETS_STORAGE_KEY);
    if (!raw) return DEFAULT_BUDGET_CONFIGS;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_BUDGET_CONFIGS;
  } catch {
    return DEFAULT_BUDGET_CONFIGS;
  }
}

function saveStoredBudgetConfigs(configs: DepartmentBudgetConfig[]) {
  try {
    localStorage.setItem(BUDGETS_STORAGE_KEY, JSON.stringify(configs));
  } catch {}
}

export const DepartmentalBudgetVarianceCard: React.FC = () => {
  const { data: expensesData, isLoading: expensesLoading } = useExpensesQuery();
  const rawExpenses: ExpenseEntity[] = expensesData?.items ?? [];

  const [budgetConfigs, setBudgetConfigs] = useState<DepartmentBudgetConfig[]>(getStoredBudgetConfigs);
  const [configModal, setConfigModal] = useState(false);
  const [form] = Form.useForm();

  // ── Compute Departmental Spend & Variance for Current Month ─────────────
  const { departmentStats, totalBudgetGHS, totalSpentGHS, overallVarianceGHS, overallUtilization } = useMemo(() => {
    const currentMonthKey = dayjs().format('YYYY-MM');

    // Only approved expenses
    const approvedExpenses = rawExpenses.filter((e) => e.status === 'approved');

    // Filter to current month (or fallback to recent if few recorded this month)
    let currentMonthExpenses = approvedExpenses.filter((e) => {
      const date = e.incurredOn || e.createdAt;
      return date && dayjs(date).format('YYYY-MM') === currentMonthKey;
    });

    if (currentMonthExpenses.length === 0) {
      currentMonthExpenses = approvedExpenses;
    }

    let overallBudget = 0;
    let overallSpendMinor = 0;

    const stats = budgetConfigs.map((dept) => {
      overallBudget += dept.monthlyBudgetGHS;

      // Match expenses belonging to this department
      const deptExpenses = currentMonthExpenses.filter((e) => {
        const cat = (e.category || '').toLowerCase();
        const desc = (e.description || '').toLowerCase();
        return dept.categories.some((kw) => cat.includes(kw) || desc.includes(kw));
      });

      const spentMinor = deptExpenses.reduce((sum, e) => sum + (e.amountMinor || 0), 0);
      overallSpendMinor += spentMinor;
      const spentGHS = Math.round(spentMinor / 100);

      const varianceGHS = dept.monthlyBudgetGHS - spentGHS;
      const utilization =
        dept.monthlyBudgetGHS > 0 ? Math.round((spentGHS / dept.monthlyBudgetGHS) * 100) : 0;

      let status: 'on_track' | 'near_limit' | 'over_budget' = 'on_track';
      if (utilization >= 100) status = 'over_budget';
      else if (utilization >= 75) status = 'near_limit';

      return {
        id: dept.id,
        name: dept.name,
        icon: dept.icon,
        budgetGHS: dept.monthlyBudgetGHS,
        spentGHS,
        varianceGHS,
        utilization,
        status,
        txnCount: deptExpenses.length,
      };
    });

    const totalSpent = Math.round(overallSpendMinor / 100);
    const overallVar = overallBudget - totalSpent;
    const overallUtil = overallBudget > 0 ? Math.round((totalSpent / overallBudget) * 100) : 0;

    return {
      departmentStats: stats,
      totalBudgetGHS: overallBudget,
      totalSpentGHS: totalSpent,
      overallVarianceGHS: overallVar,
      overallUtilization: overallUtil,
    };
  }, [rawExpenses, budgetConfigs]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleOpenConfig = () => {
    const initial: Record<string, number> = {};
    budgetConfigs.forEach((d) => {
      initial[d.id] = d.monthlyBudgetGHS;
    });
    form.setFieldsValue(initial);
    setConfigModal(true);
  };

  const handleSaveConfig = (values: Record<string, number>) => {
    const updated = budgetConfigs.map((d) => ({
      ...d,
      monthlyBudgetGHS: Number(values[d.id]) || d.monthlyBudgetGHS,
    }));
    setBudgetConfigs(updated);
    saveStoredBudgetConfigs(updated);
    message.success('Departmental monthly budgets updated successfully!');
    setConfigModal(false);
  };

  const renderDeptIcon = (iconName: string) => {
    switch (iconName) {
      case 'ShopOutlined':
        return <ShopOutlined style={{ color: '#1677ff', fontSize: 16 }} />;
      case 'ToolOutlined':
        return <ToolOutlined style={{ color: '#fa8c16', fontSize: 16 }} />;
      case 'FileDoneOutlined':
        return <FileDoneOutlined style={{ color: '#722ed1', fontSize: 16 }} />;
      case 'SafetyCertificateOutlined':
        return <SafetyCertificateOutlined style={{ color: '#13c2c2', fontSize: 16 }} />;
      default:
        return <TeamOutlined style={{ color: '#52c41a', fontSize: 16 }} />;
    }
  };

  return (
    <Card
      title={
        <Space>
          <PieChartOutlined style={{ color: tokens.primary }} />
          <span>Departmental Budget vs. Actual Variance</span>
        </Space>
      }
      extra={
        <Button size="small" icon={<SettingOutlined />} onClick={handleOpenConfig}>
          Configure Budgets
        </Button>
      }
      style={{ borderRadius: 10, marginBottom: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}
    >
      {/* ── Summary Overview Bar ────────────────────────────────────────── */}
      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={24} sm={8}>
          <div style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
            <Text type="secondary" style={{ fontSize: 12 }}>Total Monthly Allocation</Text>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#1e293b', marginTop: 4 }}>
              GH₵ {totalBudgetGHS.toLocaleString()}
            </div>
            <Text type="secondary" style={{ fontSize: 11 }}>Across 5 operational departments</Text>
          </div>
        </Col>
        <Col xs={24} sm={8}>
          <div style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
            <Text type="secondary" style={{ fontSize: 12 }}>Actual Incurred Spend</Text>
            <div style={{ fontSize: 20, fontWeight: 700, color: overallUtilization >= 100 ? '#ff4d4f' : tokens.primary, marginTop: 4 }}>
              GH₵ {totalSpentGHS.toLocaleString()}
            </div>
            <Text type="secondary" style={{ fontSize: 11 }}>
              Overall Utilization: <strong>{overallUtilization}%</strong>
            </Text>
          </div>
        </Col>
        <Col xs={24} sm={8}>
          <div style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
            <Text type="secondary" style={{ fontSize: 12 }}>Net Budget Variance</Text>
            <div
              style={{
                fontSize: 20,
                fontWeight: 700,
                color: overallVarianceGHS >= 0 ? '#52c41a' : '#ff4d4f',
                marginTop: 4,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              {overallVarianceGHS >= 0 ? <ArrowDownOutlined /> : <ArrowUpOutlined />}
              GH₵ {Math.abs(overallVarianceGHS).toLocaleString()}
            </div>
            <Text type="secondary" style={{ fontSize: 11 }}>
              {overallVarianceGHS >= 0 ? 'Favorable (Under Budget)' : 'Over Budget Deficit'}
            </Text>
          </div>
        </Col>
      </Row>

      {/* ── Departmental Rows ───────────────────────────────────────────── */}
      <Table
        dataSource={departmentStats}
        rowKey="id"
        pagination={false}
        size="small"
        columns={[
          {
            title: 'Department',
            dataIndex: 'name',
            key: 'name',
            render: (name: string, record: any) => (
              <Space>
                {renderDeptIcon(record.icon)}
                <div>
                  <Text strong style={{ fontSize: 13, display: 'block' }}>{name}</Text>
                  <Text type="secondary" style={{ fontSize: 11 }}>{record.txnCount} expenses approved</Text>
                </div>
              </Space>
            ),
          },
          {
            title: 'Monthly Budget',
            dataIndex: 'budgetGHS',
            key: 'budgetGHS',
            align: 'right' as const,
            render: (val: number) => (
              <Text strong style={{ fontSize: 13 }}>
                GH₵ {val.toLocaleString()}
              </Text>
            ),
          },
          {
            title: 'Actual Spend',
            dataIndex: 'spentGHS',
            key: 'spentGHS',
            align: 'right' as const,
            render: (val: number, record: any) => (
              <Text
                strong
                style={{
                  fontSize: 13,
                  color: record.status === 'over_budget' ? '#ff4d4f' : record.status === 'near_limit' ? '#faad14' : '#1e293b',
                }}
              >
                GH₵ {val.toLocaleString()}
              </Text>
            ),
          },
          {
            title: 'Budget Variance',
            dataIndex: 'varianceGHS',
            key: 'varianceGHS',
            align: 'right' as const,
            render: (val: number) => {
              const isUnder = val >= 0;
              return (
                <div>
                  <Tag color={isUnder ? 'green' : 'red'} style={{ fontWeight: 600 }}>
                    {isUnder ? `+GH₵ ${val.toLocaleString()} remaining` : `-GH₵ ${Math.abs(val).toLocaleString()} exceeded`}
                  </Tag>
                </div>
              );
            },
          },
          {
            title: 'Utilization %',
            key: 'utilization',
            width: 200,
            render: (_: any, record: any) => {
              let strokeColor = '#52c41a';
              if (record.utilization >= 100) strokeColor = '#ff4d4f';
              else if (record.utilization >= 75) strokeColor = '#faad14';

              return (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 2 }}>
                    <span>{record.utilization}%</span>
                    {record.status === 'over_budget' && <Text type="danger" style={{ fontWeight: 600 }}>OVER BUDGET</Text>}
                    {record.status === 'near_limit' && <Text style={{ color: '#d97706', fontWeight: 600 }}>NEAR LIMIT</Text>}
                    {record.status === 'on_track' && <Text type="secondary">On Track</Text>}
                  </div>
                  <Progress
                    percent={Math.min(record.utilization, 100)}
                    strokeColor={strokeColor}
                    showInfo={false}
                    size="small"
                  />
                </div>
              );
            },
          },
        ]}
      />

      {/* ── Budget Configuration Modal ─────────────────────────────────── */}
      <Modal
        title={
          <Space>
            <SettingOutlined style={{ color: tokens.primary }} />
            <span>Configure Monthly Departmental Budgets</span>
          </Space>
        }
        open={configModal}
        onCancel={() => setConfigModal(false)}
        footer={null}
        width={520}
      >
        <Text type="secondary" style={{ display: 'block', marginBottom: 16, fontSize: 13 }}>
          Set monthly expense caps for each operational department in Ghana Cedis (GH₵). These thresholds trigger real-time utilization alerts on the Accounts Dashboard.
        </Text>

        <Form form={form} layout="vertical" onFinish={handleSaveConfig}>
          {budgetConfigs.map((dept) => (
            <Form.Item
              key={dept.id}
              name={dept.id}
              label={
                <Space>
                  {renderDeptIcon(dept.icon)}
                  <span>{dept.name}</span>
                </Space>
              }
              rules={[{ required: true, message: 'Please enter budget amount' }]}
            >
              <InputNumber
                style={{ width: '100%' }}
                prefix="GH₵"
                precision={0}
                min={1000}
                placeholder="25000"
              />
            </Form.Item>
          ))}

          <Form.Item style={{ marginBottom: 0 }}>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={() => setConfigModal(false)}>Cancel</Button>
              <Button type="primary" htmlType="submit">
                Save Budget Caps
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};
