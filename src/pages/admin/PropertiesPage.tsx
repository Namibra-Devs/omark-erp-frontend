// src/pages/admin/PropertiesPage.tsx
import React, { useState } from 'react';
import {
  Card, Table, Button, Space, Modal, Form, Input, InputNumber,
  Select, message, Typography, Row, Col, Popconfirm,
  Tooltip, Avatar, Spin, Alert
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined,
  SearchOutlined, ReloadOutlined, HomeOutlined
} from '@ant-design/icons';
import {
  usePropertiesQuery,
  useCreatePropertyMutation,
  useUpdatePropertyMutation,
  useDeletePropertyMutation,
  type Property,
} from '@/api/properties';
import { PageHeader } from '@/components/shared/PageHeader';
import { MoneyText } from '@/components/shared/MoneyText';
import { tokens } from '@/constants/tokens';

const { Text } = Typography;
const { TextArea } = Input;

export const PropertiesPage: React.FC = () => {
  const [searchText, setSearchText] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProperty, setEditingProperty] = useState<Property | null>(null);
  const [form] = Form.useForm();

  // ── API Queries ────────────────────────────────────────────────────────────
  const {
    data: propertiesData,
    isLoading,
    error,
    refetch,
    isFetching
  } = usePropertiesQuery({
    q: searchText || undefined,
  });

  const createProperty = useCreatePropertyMutation();
  const updateProperty = useUpdatePropertyMutation();
  const deleteProperty = useDeletePropertyMutation();

  const properties: Property[] = propertiesData?.items ?? [];
  const total = propertiesData?.total ?? properties.length;

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleAddProperty = async (values: any) => {
    try {
      const payload = {
        houseNumber: values.houseNumber,
        offerNumber: values.offerNumber,
        priceMinor: Math.round(values.price * 100),
        currency: values.currency || 'GHS',
        description: values.description,
      };

      await createProperty.mutateAsync(payload);

      message.success('Property added successfully!');
      setModalOpen(false);
      form.resetFields();
    } catch (error: any) {
      message.error(error?.response?.data?.message || error?.message || 'Failed to add property');
    }
  };

  const handleEditProperty = async (values: any) => {
    if (!editingProperty) return;

    try {
      const payload = {
        houseNumber: values.houseNumber,
        offerNumber: values.offerNumber,
        priceMinor: Math.round(values.price * 100),
        description: values.description,
      };

      await updateProperty.mutateAsync({
        id: editingProperty.id,
        payload
      });

      message.success('Property updated successfully!');
      setModalOpen(false);
      setEditingProperty(null);
      form.resetFields();
    } catch (error: any) {
      message.error(error?.response?.data?.message || error?.message || 'Failed to update property');
    }
  };

  const handleDeleteProperty = async (id: string) => {
    try {
      await deleteProperty.mutateAsync(id);
      message.success('Property deleted successfully!');
    } catch (error: any) {
      message.error(error?.response?.data?.message || error?.message || 'Failed to delete property');
    }
  };

  const handleEditClick = (property: Property) => {
    setEditingProperty(property);
    form.setFieldsValue({
      houseNumber: property.houseNumber,
      offerNumber: property.offerNumber,
      price: property.priceMinor / 100,
      currency: property.currency,
      description: property.description,
    });
    setModalOpen(true);
  };

  // ── Table Columns ─────────────────────────────────────────────────────────
  const columns = [
    {
      title: 'Property',
      key: 'property',
      width: 220,
      render: (_: any, record: Property) => (
        <Space>
          <Avatar
            icon={<HomeOutlined />}
            style={{ backgroundColor: tokens.primary }}
          />
          <div>
            <Text strong>{record.houseNumber}</Text>
            <br />
            <Text type="secondary" style={{ fontSize: 12 }}>
              {record.offerNumber}
            </Text>
          </div>
        </Space>
      ),
    },
    {
      title: 'Price',
      dataIndex: 'priceMinor',
      key: 'priceMinor',
      render: (value: number, record: Property) => <MoneyText minor={value} currency={record.currency} />,
      sorter: (a: Property, b: Property) => a.priceMinor - b.priceMinor,
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      render: (description?: string) => description || 'N/A',
    },
    {
      title: 'Created',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: string) => date ? new Date(date).toLocaleDateString() : 'N/A',
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 180,
      fixed: 'right' as const,
      render: (_: any, record: Property) => (
        <Space>
          <Tooltip title="Edit">
            <Button
              icon={<EditOutlined />}
              onClick={() => handleEditClick(record)}
            />
          </Tooltip>
          <Popconfirm
            title="Delete Property"
            description={`Are you sure you want to delete ${record.houseNumber}?`}
            onConfirm={() => handleDeleteProperty(record.id)}
            okText="Yes"
            cancelText="No"
          >
            <Tooltip title="Delete">
              <Button danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // ── Loading State ─────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
        <Spin size="large" tip="Loading properties..." />
      </div>
    );
  }

  // ── Error State ───────────────────────────────────────────────────────────
  if (error) {
    return (
      <div style={{ padding: 24 }}>
        <Alert
          message="Error Loading Properties"
          description="There was an error loading the properties. Please try again."
          type="error"
          showIcon
          action={
            <Button size="small" type="primary" onClick={() => refetch()}>
              Retry
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '100%', overflow: 'hidden', padding: '0 4px' }}>
      <PageHeader
        title="Properties"
        actions={[
          {
            label: 'Add Property',
            onClick: () => {
              setEditingProperty(null);
              form.resetFields();
              setModalOpen(true);
            },
            icon: <PlusOutlined />,
          },
          {
            label: 'Refresh',
            onClick: () => refetch(),
            icon: <ReloadOutlined />,
          },
        ]}
      />

      <Card>
        <div style={{ marginBottom: 16, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <Input
            placeholder="Search by house number or offer number"
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 300 }}
            allowClear
          />
          <Text type="secondary" style={{ marginLeft: 'auto', alignSelf: 'center' }}>
            Total: {total} properties
          </Text>
        </div>

        <Table
          columns={columns}
          dataSource={properties}
          rowKey="id"
          loading={isFetching}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `Total ${total} properties`,
          }}
          locale={{
            emptyText: 'No properties found. Click "Add Property" to create one.'
          }}
        />
      </Card>

      {/* Add/Edit Property Modal */}
      <Modal
        title={
          <Space>
            <HomeOutlined style={{ color: tokens.primary }} />
            <Text strong>
              {editingProperty ? 'Edit Property' : 'Add New Property'}
            </Text>
          </Space>
        }
        open={modalOpen}
        onCancel={() => {
          setModalOpen(false);
          setEditingProperty(null);
          form.resetFields();
        }}
        footer={null}
        width={600}
        style={{ top: 20 }}
        bodyStyle={{ maxHeight: '70vh', overflowY: 'auto' }}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={editingProperty ? handleEditProperty : handleAddProperty}
          initialValues={{
            currency: 'GHS',
          }}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="houseNumber"
                label="House Number"
                rules={[{ required: true, message: 'House number is required' }]}
              >
                <Input placeholder="e.g., H-102" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="offerNumber"
                label="Offer Number"
                rules={[{ required: true, message: 'Offer number is required' }]}
              >
                <Input placeholder="e.g., OF-2024-001" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="price"
                label="Price (GHS)"
                rules={[{ required: true, message: 'Price is required' }]}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  min={0}
                  step={1000}
                  placeholder="e.g., 150000"
                  prefix="GHS"
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="currency"
                label="Currency"
              >
                <Input placeholder="e.g., GHS" disabled={!!editingProperty} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="description"
            label="Description"
          >
            <TextArea rows={3} placeholder="Describe the property" />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button
                type="primary"
                htmlType="submit"
                loading={createProperty.isPending || updateProperty.isPending}
              >
                {editingProperty ? 'Update Property' : 'Add Property'}
              </Button>
              <Button
                onClick={() => {
                  setModalOpen(false);
                  setEditingProperty(null);
                  form.resetFields();
                }}
              >
                Cancel
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
