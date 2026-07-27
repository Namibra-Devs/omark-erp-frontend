// src/pages/branches/components/BranchFilterBar.tsx
// ⚠️ PROTOTYPE — filters run entirely against local mock data (src/mock/branches.ts).
import React from 'react';
import { Button, Card, DatePicker, Select, Space } from 'antd';
import { ClearOutlined, FilterOutlined } from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import type { Branch, BranchDepartment } from '@/mock/branches';

const { RangePicker } = DatePicker;

export interface BranchFilterValues {
  dateRange: [string, string] | null;
  branchId?: string;
  departmentId?: string;
  userName?: string;
  projectId?: string;
  propertyType?: string;
}

export const EMPTY_FILTERS: BranchFilterValues = { dateRange: null };

interface BranchFilterBarProps {
  value: BranchFilterValues;
  onChange: (value: BranchFilterValues) => void;
  branches?: Branch[];
  departments: BranchDepartment[];
  users: { name: string }[];
  projects: { id: string; name: string; code: string }[];
  propertyTypes: string[];
}

export const BranchFilterBar: React.FC<BranchFilterBarProps> = ({
  value,
  onChange,
  branches,
  departments,
  users,
  projects,
  propertyTypes,
}) => {
  const rangeValue: [Dayjs, Dayjs] | null = value.dateRange
    ? [dayjs(value.dateRange[0]), dayjs(value.dateRange[1])]
    : null;

  const activeCount = [
    value.dateRange,
    value.branchId,
    value.departmentId,
    value.userName,
    value.projectId,
    value.propertyType,
  ].filter(Boolean).length;

  return (
    <Card size="small" style={{ marginBottom: 24 }}>
      <Space wrap size={12}>
        <FilterOutlined style={{ color: '#8c8c8c' }} />
        <RangePicker
          value={rangeValue}
          onChange={(dates) =>
            onChange({
              ...value,
              dateRange: dates && dates[0] && dates[1] ? [dates[0].format('YYYY-MM-DD'), dates[1].format('YYYY-MM-DD')] : null,
            })
          }
        />
        {branches && (
          <Select
            allowClear
            placeholder="Branch"
            style={{ width: 160 }}
            value={value.branchId}
            onChange={(v) => onChange({ ...value, branchId: v })}
            options={branches.map((b) => ({ value: b.id, label: b.name }))}
          />
        )}
        <Select
          allowClear
          placeholder="Department"
          style={{ width: 170 }}
          value={value.departmentId}
          onChange={(v) => onChange({ ...value, departmentId: v })}
          options={departments.map((d) => ({ value: d.id, label: d.name }))}
        />
        <Select
          allowClear
          showSearch
          placeholder="User"
          style={{ width: 170 }}
          value={value.userName}
          onChange={(v) => onChange({ ...value, userName: v })}
          options={users.map((u) => ({ value: u.name, label: u.name }))}
          filterOption={(input, option) => (option?.label as string).toLowerCase().includes(input.toLowerCase())}
        />
        <Select
          allowClear
          showSearch
          placeholder="Project"
          style={{ width: 200 }}
          value={value.projectId}
          onChange={(v) => onChange({ ...value, projectId: v })}
          options={projects.map((p) => ({ value: p.id, label: `${p.name} (${p.code})` }))}
          filterOption={(input, option) => (option?.label as string).toLowerCase().includes(input.toLowerCase())}
        />
        <Select
          allowClear
          placeholder="Property Type"
          style={{ width: 170 }}
          value={value.propertyType}
          onChange={(v) => onChange({ ...value, propertyType: v })}
          options={propertyTypes.map((t) => ({ value: t, label: t }))}
        />
        {activeCount > 0 && (
          <Button size="small" icon={<ClearOutlined />} onClick={() => onChange(EMPTY_FILTERS)}>
            Clear ({activeCount})
          </Button>
        )}
      </Space>
    </Card>
  );
};
