// src/components/shared/PhotoUpload.tsx
import React, { useState } from 'react';
import { Avatar, Upload, message, Spin } from 'antd';
import { UserOutlined, CameraOutlined } from '@ant-design/icons';
import type { UploadProps } from 'antd';
import { useUploadFileMutation } from '@/api/uploads';

export type PhotoEntityType = 'staff' | 'customer' | 'property' | 'prospect';

interface PhotoUploadProps {
  entityType: PhotoEntityType;
  entityId: string | undefined;
  size?: number;
  editable?: boolean;
  src?: string;
  onPhotoChange?: (url: string) => void;
}

export const PhotoUpload: React.FC<PhotoUploadProps> = ({
  size = 72,
  editable = true,
  src,
  onPhotoChange,
}) => {
  const uploadFile = useUploadFileMutation();
  const [photoUrl, setPhotoUrl] = useState<string | undefined>(src);

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
      const res = await uploadFile.mutateAsync(file);
      if (res?.url) {
        setPhotoUrl(res.url);
        onPhotoChange?.(res.url);
        message.success('Photo uploaded successfully!');
      }
    } catch (err: any) {
      message.error(err?.error?.message || err?.message || 'Photo upload failed');
    }
    return Upload.LIST_IGNORE;
  };

  const currentPhoto = photoUrl || src;

  const avatar = (
    <Avatar
      size={size}
      src={currentPhoto}
      icon={!currentPhoto ? <UserOutlined /> : undefined}
      style={{ backgroundColor: currentPhoto ? undefined : '#bfbfbf' }}
    />
  );

  if (!editable) return avatar;

  return (
    <Upload accept="image/*" showUploadList={false} beforeUpload={beforeUpload} disabled={uploadFile.isPending}>
      <div style={{ position: 'relative', cursor: 'pointer', width: size, height: size }}>
        {uploadFile.isPending ? (
          <div style={{ width: size, height: size, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f0f0' }}>
            <Spin size="small" />
          </div>
        ) : avatar}
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
      const res = await uploadFile.mutateAsync(file);
      if (res?.url) {
        onChange?.(res.url);
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
          <div style={{ width: size, height: size, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f0f0' }}>
            <Spin size="small" />
          </div>
        ) : (
          <Avatar
            size={size}
            src={value}
            icon={!value ? <UserOutlined /> : undefined}
            style={{ backgroundColor: value ? undefined : '#bfbfbf' }}
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
