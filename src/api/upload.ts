// src/api/upload.ts
import { useMutation } from '@tanstack/react-query';
import { erpClient } from './client';

export const useUploadImageMutation = () => {
  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('image', file);
      
      const response = await erpClient.post<{ success: boolean; url: string }>('/api/upload/image', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      
      const resData = (response as any).data || response;
      return resData; // returns { success: boolean, url: string }
    },
  });
};

export const useUploadFileMutation = () => {
  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await erpClient.post<{ success: boolean; url: string }>('/api/upload/file', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      
      const resData = (response as any).data || response;
      return resData; // returns { success: boolean, url: string }
    },
  });
};
