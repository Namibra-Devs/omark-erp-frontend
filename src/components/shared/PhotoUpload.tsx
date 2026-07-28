// src/components/shared/PhotoUpload.tsx
// ⚠️ PROTOTYPE — see src/mock/photos.ts. Stored locally only.
import React, { useState } from 'react';
import { Avatar, Upload, message, Spin } from 'antd';
import { UserOutlined, CameraOutlined } from '@ant-design/icons';
import type { UploadProps } from 'antd';
import { fileToResizedDataUrl, setPhoto, usePhoto, type PhotoEntityType } from '@/mock/photos';

interface PhotoUploadProps {
  entityType: PhotoEntityType;
  entityId: string | undefined;
  size?: number;
  editable?: boolean;
}

export const PhotoUpload: React.FC<PhotoUploadProps> = ({ entityType, entityId, size = 72, editable = true }) => {
  const photo = usePhoto(entityType, entityId);
  const [uploading, setUploading] = useState(false);

  const beforeUpload: UploadProps['beforeUpload'] = async (file) => {
    if (!entityId) return Upload.LIST_IGNORE;
    if (!file.type.startsWith('image/')) {
      message.error('Please choose an image file');
      return Upload.LIST_IGNORE;
    }
    if (file.size > 8 * 1024 * 1024) {
      message.error('Image must be under 8MB');
      return Upload.LIST_IGNORE;
    }
    setUploading(true);
    try {
      const dataUrl = await fileToResizedDataUrl(file);
      setPhoto(entityType, entityId, dataUrl);
      message.success('Photo updated');
    } catch {
      message.error('Could not process that image');
    } finally {
      setUploading(false);
    }
    return Upload.LIST_IGNORE;
  };

  const avatar = (
    <Avatar
      size={size}
      src={photo}
      icon={!photo ? <UserOutlined /> : undefined}
      style={{ backgroundColor: photo ? undefined : '#bfbfbf' }}
    />
  );

  if (!editable) return avatar;

  return (
    <Upload accept="image/*" showUploadList={false} beforeUpload={beforeUpload} disabled={uploading}>
      <div style={{ position: 'relative', cursor: 'pointer', width: size, height: size }}>
        {uploading ? (
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
  /** Controlled data-URL value — antd Form.Item wires this up automatically via value/onChange. */
  value?: string;
  onChange?: (dataUrl: string | undefined) => void;
  size?: number;
}

/**
 * Same picker UI as PhotoUpload, but for "add new X" forms where the
 * entity doesn't have a real id yet. Holds the picked image as a data URL
 * in the form's own state instead of writing straight to the photo store —
 * the caller should call setPhoto(type, newId, value) once the entity is
 * actually created.
 */
export const PendingPhotoUpload: React.FC<PendingPhotoUploadProps> = ({ value, onChange, size = 72 }) => {
  const [uploading, setUploading] = useState(false);

  const beforeUpload: UploadProps['beforeUpload'] = async (file) => {
    if (!file.type.startsWith('image/')) {
      message.error('Please choose an image file');
      return Upload.LIST_IGNORE;
    }
    if (file.size > 8 * 1024 * 1024) {
      message.error('Image must be under 8MB');
      return Upload.LIST_IGNORE;
    }
    setUploading(true);
    try {
      const dataUrl = await fileToResizedDataUrl(file);
      onChange?.(dataUrl);
    } catch {
      message.error('Could not process that image');
    } finally {
      setUploading(false);
    }
    return Upload.LIST_IGNORE;
  };

  return (
    <Upload accept="image/*" showUploadList={false} beforeUpload={beforeUpload} disabled={uploading}>
      <div style={{ position: 'relative', cursor: 'pointer', width: size, height: size }}>
        {uploading ? (
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
