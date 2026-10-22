// src/api/uploads.ts
import { useMutation } from '@tanstack/react-query';
import apiClient, { unwrapData } from '@/api/client';
import type { ApiResponse } from '@/types';

export interface UploadFileResponse {
  url: string;
  publicId?: string;
  mimeType?: string;
  sizeBytes?: number;
  originalName?: string;
}

export function useUploadFileMutation() {
  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);

      try {
        const res = await apiClient.post<ApiResponse<UploadFileResponse>>('/upload', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });
        const data = unwrapData(res);
        if (data && (data.url || (data as any).fileUrl || (data as any).path)) {
          return {
            ...data,
            url: data.url || (data as any).fileUrl || (data as any).path,
          };
        }
        return data;
      } catch (err: any) {
        // Fallback to /uploads if /upload fails
        try {
          const res2 = await apiClient.post<ApiResponse<UploadFileResponse>>('/uploads', formData, {
            headers: {
              'Content-Type': 'multipart/form-data',
            },
          });
          const data2 = unwrapData(res2);
          if (data2 && (data2.url || (data2 as any).fileUrl || (data2 as any).path)) {
            return {
              ...data2,
              url: data2.url || (data2 as any).fileUrl || (data2 as any).path,
            };
          }
          return data2;
        } catch {
          throw err;
        }
      }
    },
  });
}
