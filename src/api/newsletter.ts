// src/api/newsletter.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { erpClient } from './client';
import type { 
  NewsletterSubscriberEntity, 
  SubscribeDto, 
  SendNewsletterDto 
} from '@/types/api';

export const useSubscribeNewsletterMutation = () => {
  return useMutation({
    mutationFn: async (data: SubscribeDto) => {
      const response = await erpClient.post<{ success: boolean; message: string }>('/api/newsletter/subscribe', data);
      return (response as any).data || response;
    },
  });
};

export const useUnsubscribeNewsletterMutation = () => {
  return useMutation({
    mutationFn: async (token: string) => {
      const response = await erpClient.get<{ success: boolean; message: string }>(`/api/newsletter/unsubscribe?token=${token}`);
      return (response as any).data || response;
    },
  });
};

export const useNewsletterSubscribersQuery = () => {
  return useQuery({
    queryKey: ['newsletter', 'subscribers'],
    queryFn: async () => {
      const response = await erpClient.get<{ success: boolean; data: NewsletterSubscriberEntity[] }>('/api/newsletter/subscribers');
      const resData = (response as any).data || response;
      return resData.data;
    },
  });
};

export const useSendNewsletterMutation = () => {
  return useMutation({
    mutationFn: async (data: SendNewsletterDto) => {
      const response = await erpClient.post<{ success: boolean; message: string }>('/api/newsletter/send', data);
      return (response as any).data || response;
    },
  });
};

export const useDeleteNewsletterSubscriberMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const response = await erpClient.delete<{ success: boolean }>(`/api/newsletter/subscribers/${id}`);
      return (response as any).data || response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['newsletter', 'subscribers'] });
    },
  });
};
