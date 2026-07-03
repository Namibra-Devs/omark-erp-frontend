// src/api/jobs.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { erpClient } from './client';
import type { 
  JobEntity, 
  JobApplicationEntity, 
  CreateJobDto, 
  UpdateApplicationStatusDto 
} from '@/types/api';

export interface JobsFilter {
  activeOnly?: boolean;
  department?: string;
  location?: string;
}

export const useJobsQuery = (filter?: JobsFilter) => {
  return useQuery({
    queryKey: ['jobs', filter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filter) {
        if (filter.activeOnly !== undefined) params.append('activeOnly', String(filter.activeOnly));
        if (filter.department !== undefined) params.append('department', filter.department);
        if (filter.location !== undefined) params.append('location', filter.location);
      }
      
      const response = await erpClient.get<{ success: boolean; data: JobEntity[] }>(`/api/jobs?${params}`);
      const resData = (response as any).data || response;
      return resData.data;
    },
  });
};

export const useJobQuery = (id: number) => {
  return useQuery({
    queryKey: ['jobs', id],
    queryFn: async () => {
      const response = await erpClient.get<{ success: boolean; data: JobEntity }>(`/api/jobs/${id}`);
      const resData = (response as any).data || response;
      return resData.data;
    },
    enabled: !!id,
  });
};

export const useCreateJobMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateJobDto) => {
      const response = await erpClient.post<{ success: boolean; data: JobEntity }>('/api/jobs', data);
      const resData = (response as any).data || response;
      return resData.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
    },
  });
};

export const useUpdateJobMutation = (id: number) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<CreateJobDto>) => {
      const response = await erpClient.put<{ success: boolean; data: JobEntity }>(`/api/jobs/${id}`, data);
      const resData = (response as any).data || response;
      return resData.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['jobs', id] });
    },
  });
};

export const useDeleteJobMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const response = await erpClient.delete<{ success: boolean }>(`/api/jobs/${id}`);
      return (response as any).data || response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
    },
  });
};

export const useApplyForJobMutation = (jobId: number) => {
  return useMutation({
    mutationFn: async (data: { fullName: string; email: string; phone: string; coverLetter: string; resumeUrl: string }) => {
      const response = await erpClient.post<{ success: boolean; data: JobApplicationEntity }>(`/api/jobs/${jobId}/apply`, data);
      const resData = (response as any).data || response;
      return resData.data;
    },
  });
};

export const useJobApplicationsQuery = (jobId: number) => {
  return useQuery({
    queryKey: ['jobs', jobId, 'applications'],
    queryFn: async () => {
      const response = await erpClient.get<{ success: boolean; data: JobApplicationEntity[] }>(`/api/jobs/${jobId}/applications`);
      const resData = (response as any).data || response;
      return resData.data;
    },
    enabled: !!jobId,
  });
};

export const useUpdateApplicationStatusMutation = (jobId: number) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ applicationId, data }: { applicationId: number; data: UpdateApplicationStatusDto }) => {
      const response = await erpClient.put<{ success: boolean; data: JobApplicationEntity }>(
        `/api/jobs/applications/${applicationId}/status`,
        data
      );
      const resData = (response as any).data || response;
      return resData.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs', jobId, 'applications'] });
    },
  });
};

export const useExportJobApplications = (jobId: number) => {
  return async () => {
    const response = await erpClient.get(`/api/jobs/${jobId}/applications/export`, {
      responseType: 'blob',
    });
    const blob = new Blob([(response as any).data || response], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `job_${jobId}_applications.csv`);
    document.body.appendChild(link);
    link.click();
    link.parentNode?.removeChild(link);
  };
};
