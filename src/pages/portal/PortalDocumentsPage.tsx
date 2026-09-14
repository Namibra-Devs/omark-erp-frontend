// src/pages/portal/PortalDocumentsPage.tsx
//
// Customer Portal Documents View
// Displays verified property records, agreements, cadastral site plans,
// and payment receipts delivered to the customer by Omark Real Estate staff.

import React, { useState, useMemo } from 'react';
import {
  Card,
  Col,
  Empty,
  Input,
  Modal,
  Row,
  Space,
  Spin,
  Tag,
  Typography,
  Button,
  Tooltip,
  message,
} from 'antd';
import {
  FileTextOutlined,
  SearchOutlined,
  DownloadOutlined,
  EyeOutlined,
  FilePdfOutlined,
  FileImageOutlined,
  FileWordOutlined,
  FolderOpenOutlined,
  CheckCircleOutlined,
  CalendarOutlined,
  InfoCircleOutlined,
  FileProtectOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { tokens } from '@/constants/tokens';
import { useCustomerPortalAuth } from '@/contexts/CustomerPortalAuthContext';
import {
  useCustomerDocumentsQuery,
  documentCategoryMeta,
  formatBytes,
  downloadFile,
  getStoredCustomerDocuments,
  saveStoredCustomerDocuments,
  type CustomerDocument,
  type CustomerDocumentCategory,
} from '@/api/customerDocuments';
import { LandPurchaseAgreementView } from '@/components/paymentPlan/LandPurchaseAgreementView';

const { Title, Text, Paragraph } = Typography;

export const PortalDocumentsPage: React.FC = () => {
  const { customer } = useCustomerPortalAuth();
  const [selectedCategory, setSelectedCategory] = useState<CustomerDocumentCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [previewDoc, setPreviewDoc] = useState<CustomerDocument | null>(null);

  const { data: documentsData, isLoading } = useCustomerDocumentsQuery({
    customerId: customer?.id,
    visibleToCustomerOnly: true,
  });

  const allDocuments = documentsData?.items ?? [];

  // Filter documents based on category and search query
  const filteredDocuments = useMemo(() => {
    return allDocuments.filter((doc) => {
      const matchesCategory = selectedCategory === 'all' || doc.category === selectedCategory;
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        doc.title.toLowerCase().includes(q) ||
        doc.fileName.toLowerCase().includes(q) ||
        (doc.description && doc.description.toLowerCase().includes(q));

      return matchesCategory && matchesSearch;
    });
  }, [allDocuments, selectedCategory, searchQuery]);

  const getFileIcon = (fileType: string, category: CustomerDocumentCategory) => {
    if (fileType?.includes('pdf') || category === 'deed' || category === 'sales_agreement') {
      return <FilePdfOutlined style={{ fontSize: 28, color: '#ff4d4f' }} />;
    }
    if (fileType?.includes('image') || category === 'site_plan') {
      return <FileImageOutlined style={{ fontSize: 28, color: '#1890ff' }} />;
    }
    if (fileType?.includes('word') || fileType?.includes('officedocument')) {
      return <FileWordOutlined style={{ fontSize: 28, color: '#2b579a' }} />;
    }
    return <FileTextOutlined style={{ fontSize: 28, color: tokens.primary }} />;
  };

  const handleDownload = (doc: CustomerDocument) => {
    downloadFile(doc.fileUrl, doc.fileName);
  };

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <Spin size="large" tip="Loading your property documents..." />
      </div>
    );
  }

  const handleAcknowledgeAgreement = () => {
    if (!previewDoc || !previewDoc.metadata?.agreementData) return;
    const updatedDoc: CustomerDocument = {
      ...previewDoc,
      metadata: {
        ...previewDoc.metadata,
        agreementData: {
          ...previewDoc.metadata.agreementData,
          acknowledgedByCustomer: true,
          acknowledgedAt: new Date().toISOString(),
        },
      },
    };
    const stored = getStoredCustomerDocuments();
    const next = stored.map((d) => (d.id === previewDoc.id ? updatedDoc : d));
    saveStoredCustomerDocuments(next);
    setPreviewDoc(updatedDoc);
    message.success('Agreement successfully signed and acknowledged!');
  };

  return (
    <div>
      {/* Header Bar */}
      <div style={{ marginBottom: 20 }}>
        <Title level={3} style={{ fontSize: 'clamp(20px, 4vw, 26px)', marginBottom: 4 }}>
          <FileTextOutlined style={{ color: tokens.primary, marginRight: 8 }} />
          My Property Documents
        </Title>
        <Text type="secondary" style={{ fontSize: 14 }}>
          Access and download your verified contracts of sale, site plans, deeds of assignment, and official payment receipts.
        </Text>
      </div>

      {/* Filter and Search Bar */}
      <Card style={{ marginBottom: 20, borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <Row gutter={[16, 12]} align="middle">
          <Col xs={24} md={10}>
            <Input
              placeholder="Search documents by title or description..."
              prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              allowClear
              size="middle"
              style={{ borderRadius: 8 }}
            />
          </Col>
          <Col xs={24} md={14}>
            <Space wrap size={[6, 8]}>
              <Tag.CheckableTag
                checked={selectedCategory === 'all'}
                onChange={() => setSelectedCategory('all')}
                style={{ padding: '4px 10px', fontSize: 13, borderRadius: 6 }}
              >
                All ({allDocuments.length})
              </Tag.CheckableTag>
              <Tag.CheckableTag
                checked={selectedCategory === 'sales_agreement'}
                onChange={() => setSelectedCategory('sales_agreement')}
                style={{ padding: '4px 10px', fontSize: 13, borderRadius: 6 }}
              >
                📄 Agreements ({allDocuments.filter((d) => d.category === 'sales_agreement').length})
              </Tag.CheckableTag>
              <Tag.CheckableTag
                checked={selectedCategory === 'deed'}
                onChange={() => setSelectedCategory('deed')}
                style={{ padding: '4px 10px', fontSize: 13, borderRadius: 6 }}
              >
                📑 Deeds ({allDocuments.filter((d) => d.category === 'deed').length})
              </Tag.CheckableTag>
              <Tag.CheckableTag
                checked={selectedCategory === 'site_plan'}
                onChange={() => setSelectedCategory('site_plan')}
                style={{ padding: '4px 10px', fontSize: 13, borderRadius: 6 }}
              >
                🗺️ Site Plans ({allDocuments.filter((d) => d.category === 'site_plan').length})
              </Tag.CheckableTag>
              <Tag.CheckableTag
                checked={selectedCategory === 'receipt'}
                onChange={() => setSelectedCategory('receipt')}
                style={{ padding: '4px 10px', fontSize: 13, borderRadius: 6 }}
              >
                🧾 Receipts ({allDocuments.filter((d) => d.category === 'receipt').length})
              </Tag.CheckableTag>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* Documents Grid */}
      {filteredDocuments.length > 0 ? (
        <Row gutter={[16, 16]}>
          {filteredDocuments.map((doc) => {
            const meta = documentCategoryMeta[doc.category] || documentCategoryMeta.other;
            const isAgreement = doc.category === 'sales_agreement' || Boolean(doc.metadata?.agreementData);

            return (
              <Col xs={24} sm={12} lg={8} key={doc.id}>
                <Card
                  hoverable
                  style={{
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    borderRadius: 12,
                    border: '1px solid #e2e8f0',
                    transition: 'all 0.2s ease',
                  }}
                  bodyStyle={{
                    padding: 16,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    flex: 1,
                  }}
                >
                  <div>
                    {/* Header Row */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                      <Space align="start">
                        {getFileIcon(doc.fileType, doc.category)}
                        <div>
                          <Tag color={meta.color} style={{ borderRadius: 6, fontWeight: 500, fontSize: 11, margin: 0 }}>
                            {meta.iconEmoji} {meta.label}
                          </Tag>
                        </div>
                      </Space>
                      {doc.metadata?.agreementData?.acknowledgedByCustomer ? (
                        <Tag color="green" icon={<CheckCircleOutlined />} style={{ borderRadius: 6, fontSize: 11 }}>
                          Signed
                        </Tag>
                      ) : isAgreement ? (
                        <Tag color="orange" icon={<InfoCircleOutlined />} style={{ borderRadius: 6, fontSize: 11 }}>
                          Ready to Sign
                        </Tag>
                      ) : (
                        <Tag color="green" icon={<CheckCircleOutlined />} style={{ borderRadius: 6, fontSize: 11 }}>
                          Verified
                        </Tag>
                      )}
                    </div>

                    {/* Document Title */}
                    <Title level={5} style={{ fontSize: 15, margin: '4px 0 8px 0', lineHeight: 1.4, color: '#0f172a' }}>
                      {doc.title}
                    </Title>

                    {/* Description */}
                    {doc.description && (
                      <Paragraph
                        type="secondary"
                        ellipsis={{ rows: 2 }}
                        style={{ fontSize: 13, marginBottom: 12, color: '#64748b' }}
                      >
                        {doc.description}
                      </Paragraph>
                    )}

                    {/* Meta info */}
                    <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 16 }}>
                      <Space direction="vertical" size={4}>
                        <div>
                          <CalendarOutlined style={{ marginRight: 6 }} />
                          {dayjs(doc.uploadedAt).format('MMM D, YYYY')}
                        </div>
                        {doc.uploadedByStaffName && (
                          <div>Issued by: {doc.uploadedByStaffName}</div>
                        )}
                      </Space>
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 12 }}>
                    <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                      <Button
                        type="primary"
                        icon={<EyeOutlined />}
                        style={{ backgroundColor: tokens.primary }}
                        onClick={() => setPreviewDoc(doc)}
                      >
                        {isAgreement ? 'View & Sign Contract' : 'Preview'}
                      </Button>
                      {doc.fileUrl ? (
                        <Tooltip title="Download File">
                          <Button
                            icon={<DownloadOutlined />}
                            onClick={() => handleDownload(doc)}
                          />
                        </Tooltip>
                      ) : (
                        <Tooltip title="Print / PDF View">
                          <Button
                            icon={<FileProtectOutlined />}
                            onClick={() => setPreviewDoc(doc)}
                          />
                        </Tooltip>
                      )}
                    </Space>
                  </div>
                </Card>
              </Col>
            );
          })}
        </Row>
      ) : (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <Text strong style={{ fontSize: 16, display: 'block', marginBottom: 6 }}>
                No documents found
              </Text>
              <Text type="secondary" style={{ fontSize: 13 }}>
                {searchQuery || selectedCategory !== 'all'
                  ? 'Try adjusting your search query or selected category filter.'
                  : 'Official property documents and signed agreements will appear here once delivered.'}
              </Text>
            </div>
          }
        />
      )}

      {/* Document Preview Modal */}
      <Modal
        title={
          previewDoc ? (
            <Space align="center">
              {getFileIcon(previewDoc.fileType, previewDoc.category)}
              <div>
                <Text strong style={{ fontSize: 16 }}>
                  {previewDoc.title}
                </Text>
                <Text type="secondary" style={{ display: 'block', fontSize: 12 }}>
                  {previewDoc.fileName} {previewDoc.fileSize ? `· ${formatBytes(previewDoc.fileSize)}` : ''}
                </Text>
              </div>
            </Space>
          ) : (
            'Document Preview'
          )
        }
        open={Boolean(previewDoc)}
        onCancel={() => setPreviewDoc(null)}
        width={previewDoc?.metadata?.agreementData ? 950 : 850}
        style={{ top: 20 }}
        footer={[
          <Button key="close" onClick={() => setPreviewDoc(null)}>
            Close
          </Button>,
          previewDoc?.fileUrl ? (
            <Button
              key="download"
              type="primary"
              icon={<DownloadOutlined />}
              style={{ backgroundColor: tokens.primary }}
              onClick={() => previewDoc && handleDownload(previewDoc)}
            >
              Download Document
            </Button>
          ) : null,
        ]}
      >
        {previewDoc && (
          <div style={{ minHeight: 450, maxHeight: '75vh', overflowY: 'auto' }}>
            {previewDoc.metadata?.agreementData ? (
              <LandPurchaseAgreementView
                data={previewDoc.metadata.agreementData}
                isCustomerView={true}
                onAcknowledge={handleAcknowledgeAgreement}
              />
            ) : previewDoc.fileType?.startsWith('image/') || previewDoc.fileName?.match(/\.(jpg|jpeg|png|webp)$/i) ? (
              <div style={{ textAlign: 'center' }}>
                <img
                  src={previewDoc.fileUrl}
                  alt={previewDoc.title}
                  style={{
                    maxWidth: '100%',
                    maxHeight: 550,
                    objectFit: 'contain',
                    borderRadius: 8,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                  }}
                />
              </div>
            ) : previewDoc.fileType?.includes('pdf') || previewDoc.fileName?.endsWith('.pdf') ? (
              <iframe
                src={previewDoc.fileUrl}
                title={previewDoc.title}
                style={{
                  width: '100%',
                  height: 550,
                  border: '1px solid #e2e8f0',
                  borderRadius: 8,
                }}
              />
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                <FileTextOutlined style={{ fontSize: 64, color: tokens.primary, marginBottom: 16 }} />
                <Title level={4}>Preview not directly embeddable for this format</Title>
                <Paragraph type="secondary" style={{ maxWidth: 400, margin: '0 auto 20px auto' }}>
                  This document format ({previewDoc.fileName}) can be downloaded to your device for viewing with your local applications.
                </Paragraph>
                <Button
                  type="primary"
                  size="large"
                  icon={<DownloadOutlined />}
                  style={{ backgroundColor: tokens.primary }}
                  onClick={() => handleDownload(previewDoc)}
                >
                  Download {previewDoc.fileName}
                </Button>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};
