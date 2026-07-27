// src/mock/photos.ts
//
// ⚠️ PROTOTYPE — local-only, not backed by a real API. ⚠️
// There is no file-upload endpoint anywhere in the real API (no multipart
// support at all — grep the codebase, it isn't there). Photos are resized
// client-side and kept as data URLs in localStorage, keyed by
// `${entityType}:${entityId}`. This is fine for a demo but will not scale
// or sync across devices — replace with a real upload endpoint + CDN URL
// before this ships.
import { useEffect, useState } from 'react';

const STORAGE_KEY = 'omark_mock_photos';
const MAX_DIMENSION = 256;

export type PhotoEntityType = 'customer' | 'staff';

type PhotoMap = Record<string, string>;

const keyFor = (entityType: PhotoEntityType, entityId: string) => `${entityType}:${entityId}`;

const load = (): PhotoMap => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore malformed storage
  }
  return {};
};

const save = (map: PhotoMap) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // localStorage quota exceeded — photos are best-effort in this prototype
  }
  window.dispatchEvent(new Event('omark-photos-changed'));
};

export const getPhoto = (entityType: PhotoEntityType, entityId: string): string | undefined =>
  load()[keyFor(entityType, entityId)];

export const setPhoto = (entityType: PhotoEntityType, entityId: string, dataUrl: string) => {
  const map = load();
  map[keyFor(entityType, entityId)] = dataUrl;
  save(map);
};

export const removePhoto = (entityType: PhotoEntityType, entityId: string) => {
  const map = load();
  delete map[keyFor(entityType, entityId)];
  save(map);
};

/** Resizes/compresses an image file client-side before it goes anywhere near localStorage. */
export const fileToResizedDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Could not decode image'));
      img.onload = () => {
        const scale = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Canvas not supported'));
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });

export const usePhoto = (entityType: PhotoEntityType, entityId: string | undefined) => {
  const [photo, setPhotoState] = useState<string | undefined>(() => (entityId ? getPhoto(entityType, entityId) : undefined));

  useEffect(() => {
    const refresh = () => setPhotoState(entityId ? getPhoto(entityType, entityId) : undefined);
    refresh();
    window.addEventListener('omark-photos-changed', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('omark-photos-changed', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, [entityType, entityId]);

  return photo;
};
