// src/pages/admin/PropertiesPage.tsx
import React, { useState, useEffect } from 'react';
import {
  Card, Table, Button, Space, Modal, Form, Input, InputNumber,
  Select, Tag, message, Typography, Row, Col, Popconfirm,
  Tooltip, Badge, Divider, Avatar, Image, Spin, Alert
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, EyeOutlined,
  SearchOutlined, ReloadOutlined, HomeOutlined, DollarOutlined,
  EnvironmentOutlined, UploadOutlined, PictureOutlined
} from '@ant-design/icons';
import { usePropertiesQuery, useCreatePropertyMutation, useUpdatePropertyMutation, useDeletePropertyMutation } from '@/api/properties';
import { PageHeader } from '@/components/shared/PageHeader';
import { MoneyText } from '@/components/shared/MoneyText';
import { tokens } from '@/constants/tokens';

const { Title, Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;

export const PropertiesPage: React.FC = () => {
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProperty, setEditingProperty] = useState<any>(null);
  const [form] = Form.useForm();
  const [imageUrls, setImageUrls] = useState<string[]>([]);

  // ── API Queries ────────────────────────────────────────────────────────────
  const { 
    data: propertiesData, 
    isLoading, 
    error,
    refetch,
    isFetching
  } = usePropertiesQuery({
    search: searchText || undefined,
    status: statusFilter !== 'all' ? statusFilter : undefined,
  });

  const createProperty = useCreatePropertyMutation();
  const updateProperty = useUpdatePropertyMutation();
  const deleteProperty = useDeletePropertyMutation();

  // ── Extract properties with proper fallback ──────────────────────────────
  // Handle different response structures
  let properties = [];
  let total = 0;

  if (propertiesData) {
    console.log('📊 Raw Properties Data:', propertiesData);
    
    // Check if data is wrapped in a data property
    if (propertiesData.data) {
      const innerData = propertiesData.data;
      if (Array.isArray(innerData)) {
        properties = innerData;
        total = innerData.length;
      } else if (innerData.items) {
        properties = innerData.items;
        total = innerData.total || innerData.items.length;
      } else {
        properties = [innerData];
        total = 1;
      }
    } 
    // Check if it's an array directly
    else if (Array.isArray(propertiesData)) {
      properties = propertiesData;
      total = propertiesData.length;
    }
    // Check if it has items property
    else if (propertiesData.items) {
      properties = propertiesData.items;
      total = propertiesData.total || propertiesData.items.length;
    }
    // Check if it's a single object
    else if (typeof propertiesData === 'object' && propertiesData.id) {
      properties = [propertiesData];
      total = 1;
    }
    
    console.log('📊 Extracted Properties:', properties);
    console.log('📊 Total:', total);
  }

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleAddProperty = async (values: any) => {
    try {
      const payload = {
        houseNumber: values.houseNumber,
        offerNumber: values.offerNumber,
        priceMinor: Math.round(values.price * 100),
        currency: values.currency || 'GHS',
        description: values.description,
        location: values.location,
        bedrooms: values.bedrooms,
        bathrooms: values.bathrooms,
        area: values.area,
        status: values.status || 'available',
        images: imageUrls,
      };

      console.log('📤 Creating property with payload:', payload);

      const result = await createProperty.mutateAsync(payload);
      console.log('✅ Property created:', result);
      
      message.success('Property added successfully!');
      setModalOpen(false);
      form.resetFields();
      setImageUrls([]);
      
      // Force refetch and wait for it to complete
      await refetch();
    } catch (error: any) {
      console.error('❌ Error creating property:', error);
      message.error(error?.message || 'Failed to add property');
    }
  };

  const handleEditProperty = async (values: any) => {
    if (!editingProperty) return;

    try {
      const payload = {
        houseNumber: values.houseNumber,
        offerNumber: values.offerNumber,
        priceMinor: Math.round(values.price * 100),
        currency: values.currency || 'GHS',
        description: values.description,
        location: values.location,
        bedrooms: values.bedrooms,
        bathrooms: values.bathrooms,
        area: values.area,
        status: values.status || 'available',
        images: imageUrls.length > 0 ? imageUrls : editingProperty.images,
      };

      console.log('📤 Updating property with payload:', payload);

      const result = await updateProperty.mutateAsync({
        id: editingProperty.id,
        payload
      });
      console.log('✅ Property updated:', result);
      
      message.success('Property updated successfully!');
      setModalOpen(false);
      setEditingProperty(null);
      form.resetFields();
      setImageUrls([]);
      
      // Force refetch and wait for it to complete
      await refetch();
    } catch (error: any) {
      console.error('❌ Error updating property:', error);
      message.error(error?.message || 'Failed to update property');
    }
  };

  const handleDeleteProperty = async (id: string) => {
    try {
      await deleteProperty.mutateAsync(id);
      message.success('Property deleted successfully!');
      await refetch();
    } catch (error: any) {
      console.error('❌ Error deleting property:', error);
      message.error(error?.message || 'Failed to delete property');
    }
  };

  const handleEditClick = (property: any) => {
    setEditingProperty(property);
    setImageUrls(property.images || []);
    form.setFieldsValue({
      houseNumber: property.houseNumber,
      offerNumber: property.offerNumber,
      price: property.priceMinor / 100,
      currency: property.currency,
      description: property.description,
      location: property.location,
      bedrooms: property.bedrooms,
      bathrooms: property.bathrooms,
      area: property.area,
      status: property.status,
    });
    setModalOpen(true);
  };

  // ── Table Columns ─────────────────────────────────────────────────────────
  const columns = [
    {
      title: 'Property',
      key: 'property',
      width: 200,
      render: (_: any, record: any) => (
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
      title: 'Location',
      dataIndex: 'location',
      key: 'location',
      render: (location: string) => (
        <Space>
          <EnvironmentOutlined />
          {location || 'N/A'}
        </Space>
      ),
    },
    {
      title: 'Price',
      dataIndex: 'priceMinor',
      key: 'priceMinor',
      render: (value: number) => <MoneyText minor={value} />,
      sorter: (a: any, b: any) => a.priceMinor - b.priceMinor,
    },
    {
      title: 'Details',
      key: 'details',
      render: (_: any, record: any) => (
        <Space>
          {record.bedrooms && <Tag color="blue">{record.bedrooms} 🛏️</Tag>}
          {record.bathrooms && <Tag color="cyan">{record.bathrooms} 🚿</Tag>}
          {record.area && <Tag color="green">{record.area} m²</Tag>}
        </Space>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const configs: Record<string, { color: string; label: string }> = {
          available: { color: 'green', label: 'Available' },
          sold: { color: 'red', label: 'Sold' },
          reserved: { color: 'orange', label: 'Reserved' },
          construction: { color: 'blue', label: 'Under Construction' },
        };
        const config = configs[status] || configs.available;
        return <Badge color={config.color} text={config.label} />;
      },
      filters: [
        { text: 'Available', value: 'available' },
        { text: 'Sold', value: 'sold' },
        { text: 'Reserved', value: 'reserved' },
        { text: 'Under Construction', value: 'construction' },
      ],
      onFilter: (value: any, record: any) => record.status === value,
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
      render: (_: any, record: any) => (
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
              setImageUrls([]);
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
          <Select
            value={statusFilter}
            onChange={setStatusFilter}
            style={{ width: 200 }}
          >
            <Option value="all">All Statuses</Option>
            <Option value="available">Available</Option>
            <Option value="sold">Sold</Option>
            <Option value="reserved">Reserved</Option>
            <Option value="construction">Under Construction</Option>
          </Select>
          <Text type="secondary" style={{ marginLeft: 'auto', alignSelf: 'center' }}>
            Total: {total || properties.length} properties
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
          setImageUrls([]);
        }}
        footer={null}
        width={700}
        style={{ top: 20 }}
        bodyStyle={{ maxHeight: '70vh', overflowY: 'auto' }}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={editingProperty ? handleEditProperty : handleAddProperty}
          initialValues={{
            currency: 'GHS',
            status: 'available',
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
                name="status"
                label="Status"
                rules={[{ required: true, message: 'Status is required' }]}
              >
                <Select>
                  <Option value="available">Available</Option>
                  <Option value="sold">Sold</Option>
                  <Option value="reserved">Reserved</Option>
                  <Option value="construction">Under Construction</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="location"
            label="Location"
            rules={[{ required: true, message: 'Location is required' }]}
          >
            <Input placeholder="e.g., Accra, Ghana" />
          </Form.Item>

          <Form.Item
            name="description"
            label="Description"
          >
            <TextArea rows={3} placeholder="Describe the property" />
          </Form.Item>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                name="bedrooms"
                label="Bedrooms"
              >
                <InputNumber
                  style={{ width: '100%' }}
                  min={0}
                  placeholder="0"
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="bathrooms"
                label="Bathrooms"
              >
                <InputNumber
                  style={{ width: '100%' }}
                  min={0}
                  placeholder="0"
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="area"
                label="Area (m²)"
              >
                <InputNumber
                  style={{ width: '100%' }}
                  min={0}
                  placeholder="0"
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="images"
            label="Image URLs (one per line)"
          >
            <TextArea
              rows={3}
              placeholder="Enter image URLs, one per line"
              onChange={(e) => {
                const urls = e.target.value.split('\n').filter(url => url.trim());
                setImageUrls(urls);
              }}
            />
          </Form.Item>

          {imageUrls.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <Text type="secondary">Image Preview:</Text>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                {imageUrls.map((url, index) => (
                  <Image
                    key={index}
                    src={url}
                    width={80}
                    height={80}
                    style={{ objectFit: 'cover', borderRadius: 8 }}
                    fallback="https://via.placeholder.com/80?text=No+Image"
                  />
                ))}
              </div>
            </div>
          )}

          <Divider />

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
                  setImageUrls([]);
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