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

      const res = await apiClient.post<ApiResponse<UploadFileResponse>>('/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return unwrapData(res);
    },
  });
}
