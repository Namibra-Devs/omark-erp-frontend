// src/components/shared/PhotoUpload.tsx
import React, { useState, useEffect } from 'react';
import { Avatar, Upload, message, Spin, Dropdown, Space, Popconfirm } from 'antd';
import { UserOutlined, CameraOutlined, DeleteOutlined, UploadOutlined } from '@ant-design/icons';
import type { UploadProps, MenuProps } from 'antd';
import { useUploadFileMutation } from '@/api/uploads';
import { getEntityPhoto, setEntityPhoto, removeEntityPhoto } from '@/utils/userPhotoStorage';

export type PhotoEntityType = 'staff' | 'customer' | 'property' | 'prospect' | 'user';

interface PhotoUploadProps {
  entityType: PhotoEntityType;
  entityId: string | undefined;
  size?: number;
  editable?: boolean;
  src?: string;
  onPhotoChange?: (url: string | undefined) => void;
}

export const PhotoUpload: React.FC<PhotoUploadProps> = ({
  entityType,
  entityId,
  size = 72,
  editable = true,
  src,
  onPhotoChange,
}) => {
  const uploadFile = useUploadFileMutation();
  const [photoUrl, setPhotoUrl] = useState<string | undefined>(() => src || getEntityPhoto(entityType, entityId));

  // Sync with prop changes and storage
  useEffect(() => {
    const stored = getEntityPhoto(entityType, entityId);
    setPhotoUrl(src || stored);
  }, [src, entityType, entityId]);

  // Listen for real-time global avatar changes
  useEffect(() => {
    const handleAvatarChange = (e: Event) => {
      const customEvent = e as CustomEvent<{ entityType: string; entityId: string; photoUrl: string | undefined }>;
      if (customEvent.detail && customEvent.detail.entityId === entityId) {
        setPhotoUrl(customEvent.detail.photoUrl);
      }
    };

    window.addEventListener('omark-avatar-changed', handleAvatarChange);
    return () => {
      window.removeEventListener('omark-avatar-changed', handleAvatarChange);
    };
  }, [entityId]);

  const processUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      message.error('Please choose an image file (PNG, JPG, JPEG, WEBP)');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      message.error('Image must be under 10MB');
      return;
    }

    try {
      let finalUrl = '';
      try {
        const res = await uploadFile.mutateAsync(file);
        if (res?.url) finalUrl = res.url;
      } catch {
        // Fallback: Client-side Base64 Data URL so it is always persistent even if offline/mock
        finalUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(new Error('Failed to read image file'));
          reader.readAsDataURL(file);
        });
      }

      if (finalUrl) {
        setPhotoUrl(finalUrl);
        setEntityPhoto(entityType, entityId, finalUrl);
        onPhotoChange?.(finalUrl);
        message.success('Profile photo updated successfully!');
      }
    } catch (err: any) {
      message.error(err?.error?.message || err?.message || 'Failed to upload photo');
    }
  };

  const beforeUpload: UploadProps['beforeUpload'] = async (file) => {
    await processUpload(file as File);
    return Upload.LIST_IGNORE;
  };

  const handleRemovePhoto = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    removeEntityPhoto(entityType, entityId);
    setPhotoUrl(undefined);
    onPhotoChange?.(undefined);
    message.info('Profile photo removed');
  };

  const currentPhoto = photoUrl || src || getEntityPhoto(entityType, entityId);

  const avatar = (
    <Avatar
      size={size}
      src={currentPhoto}
      icon={!currentPhoto ? <UserOutlined /> : undefined}
      style={{
        backgroundColor: currentPhoto ? undefined : '#2E5E8C',
        color: '#fff',
        fontWeight: 600,
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        border: '2px solid #fff',
      }}
    />
  );

  if (!editable) return avatar;

  const menuItems: MenuProps['items'] = [
    {
      key: 'upload',
      label: (
        <Upload accept="image/*" showUploadList={false} beforeUpload={beforeUpload} disabled={uploadFile.isPending}>
          <Space>
            <UploadOutlined />
            <span>Upload New Photo</span>
          </Space>
        </Upload>
      ),
    },
    ...(currentPhoto
      ? [
          {
            type: 'divider' as const,
          },
          {
            key: 'remove',
            danger: true,
            icon: <DeleteOutlined />,
            label: 'Remove Photo',
            onClick: () => handleRemovePhoto(),
          },
        ]
      : []),
  ];

  return (
    <Dropdown menu={{ items: menuItems }} trigger={['click']} placement="bottomLeft">
      <div style={{ position: 'relative', cursor: 'pointer', width: size, height: size, display: 'inline-block' }}>
        {uploadFile.isPending ? (
          <div
            style={{
              width: size,
              height: size,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#f0f0f0',
              border: '2px solid #fff',
            }}
          >
            <Spin size="small" />
          </div>
        ) : (
          avatar
        )}
        <div
          style={{
            position: 'absolute',
            bottom: -2,
            right: -2,
            width: Math.max(22, Math.round(size * 0.3)),
            height: Math.max(22, Math.round(size * 0.3)),
            borderRadius: '50%',
            background: '#2E5E8C',
            border: '2px solid #fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontSize: Math.max(11, Math.round(size * 0.15)),
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
          }}
          title="Change profile photo"
        >
          <CameraOutlined />
        </div>
      </div>
    </Dropdown>
  );
};

interface PendingPhotoUploadProps {
  value?: string;
  onChange?: (url: string | undefined) => void;
  size?: number;
}

export const PendingPhotoUpload: React.FC<PendingPhotoUploadProps> = ({ value, onChange, size = 72 }) => {
  const uploadFile = useUploadFileMutation();

  const beforeUpload: UploadProps['beforeUpload'] = async (file) => {
    if (!file.type.startsWith('image/')) {
      message.error('Please choose an image file');
      return Upload.LIST_IGNORE;
    }
    if (file.size > 10 * 1024 * 1024) {
      message.error('Image must be under 10MB');
      return Upload.LIST_IGNORE;
    }
    try {
      let finalUrl = '';
      try {
        const res = await uploadFile.mutateAsync(file);
        if (res?.url) finalUrl = res.url;
      } catch {
        finalUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(new Error('Failed to read image'));
          reader.readAsDataURL(file);
        });
      }

      if (finalUrl) {
        onChange?.(finalUrl);
        message.success('Photo uploaded');
      }
    } catch (err: any) {
      message.error(err?.error?.message || err?.message || 'Could not process that image');
    }
    return Upload.LIST_IGNORE;
  };

  return (
    <Upload accept="image/*" showUploadList={false} beforeUpload={beforeUpload} disabled={uploadFile.isPending}>
      <div style={{ position: 'relative', cursor: 'pointer', width: size, height: size }}>
        {uploadFile.isPending ? (
          <div
            style={{
              width: size,
              height: size,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#f0f0f0',
            }}
          >
            <Spin size="small" />
          </div>
        ) : (
          <Avatar
            size={size}
            src={value}
            icon={!value ? <UserOutlined /> : undefined}
            style={{ backgroundColor: value ? undefined : '#2E5E8C', color: '#fff' }}
          />
        )}
        <div
          style={{
            position: 'absolute',
            bottom: -2,
            right: -2,
            width: 24,
            height: 24,
            borderRadius: '50%',
            background: '#2E5E8C',
            border: '2px solid #fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontSize: 11,
          }}
        >
          <CameraOutlined />
        </div>
      </div>
    </Upload>
  );
};

