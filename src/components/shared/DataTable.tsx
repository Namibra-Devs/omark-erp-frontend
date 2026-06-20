
import React from 'react';
import { Table, Spin, Empty, Result, Button, TablePaginationConfig } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useQuery } from '@tanstack/react-query';
import type { ApiResponse } from '@/types';

interface DataTableProps<T> {
  queryKey: unknown[];
  queryFn: () => Promise<ApiResponse<T[]>>;
  columns: ColumnsType<T>;
  onRow?: (record: T) => React.HTMLAttributes<HTMLElement>;
  rowKey?: string | ((record: T) => string);
}

export function DataTable<T extends { id: string }>({
  queryKey,
  queryFn,
  columns,
  onRow,
  rowKey = 'id',
}: DataTableProps<T>) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey,
    queryFn,
  });
  
  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Spin size="large" />
      </div>
    );
  }
  
  if (error) {
    const apiError = error as { error?: { message: string } };
    return (
      <Result
        status="error"
        title="Failed to load data"
        subTitle={apiError.error?.message || 'Please try again'}
        extra={
          <Button type="primary" onClick={() => refetch()}>
            Retry
          </Button>
        }
      />
    );
  }
  
  const tableData = data?.data || [];
  const meta = data?.meta;
  
  if (tableData.length === 0) {
    return <Empty description="No prospects found. Add your first prospect." />;
  }
  
  const paginationConfig: TablePaginationConfig = meta ? {
    current: meta.page,
    pageSize: meta.pageSize,
    total: meta.total,
    showSizeChanger: true,
    showTotal: (total) => `Total ${total} items`,
  } : false;
  
  return (
    <Table
      columns={columns}
      dataSource={tableData}
      rowKey={rowKey}
      pagination={paginationConfig}
      loading={isLoading}
      onRow={onRow}
    />
  );
}