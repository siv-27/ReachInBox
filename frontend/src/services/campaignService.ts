import api from './api';

export interface ScheduleCampaignPayload {
  sender: string;
  recipients: string[];
  subject: string;
  body: string;
  startTime: string;
  delayBetweenEmails: number;
  hourlyLimit?: number;
}

export interface EmailRecord {
  id: string;
  recipient: string;
  sender: string;
  subject: string;
  body?: string;
  scheduledAt?: string;
  sentAt?: string | null;
  failedAt?: string | null;
  status: 'SCHEDULED' | 'PROCESSING' | 'SENT' | 'FAILED';
  createdAt: string;
  previewUrl?: string | null;
  error?: string | null;
  recipientEmail?: string;
}

export const campaignService = {
  scheduleCampaign: async (payload: ScheduleCampaignPayload) => {
    const res = await api.post('/api/emails/schedule', payload);
    return res.data;
  },

  getScheduledEmails: async () => {
    const res = await api.get('/api/emails/scheduled');
    return res.data.emails || [];
  },

  getSentEmails: async () => {
    const res = await api.get('/api/emails/sent');
    return res.data.emails || [];
  },

  searchEmails: async (query: string, page = 1, limit = 50) => {
    const res = await api.get(`/api/emails/search?q=${encodeURIComponent(query)}&page=${page}&limit=${limit}`);
    return res.data.data || [];
  },
};
