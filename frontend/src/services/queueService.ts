import api from './api';
import { getBackendUrl } from '../config/env';

export interface QueueJob {
  id: string;
  emailId: string;
  recipient: string;
  subject: string;
  status: string;
  attempts: number;
  maxAttempts: number;
  failedReason: string | null;
  timestamp: number;
  processedOn: number | null;
  finishedOn: number | null;
}

export interface PaginationData {
  page: number;
  limit: number;
  total: number;
}

export interface QueueJobsResponse {
  jobs: QueueJob[];
  pagination: PaginationData;
}

export const queueService = {
  getQueueJobs: async (status: string, page = 1, limit = 10): Promise<QueueJobsResponse> => {
    const res = await api.get(`/api/queue/jobs?status=${status}&page=${page}&limit=${limit}`);
    return res.data;
  },

  createQueueEventsStream: (): EventSource => {
    const backendUrl = getBackendUrl();
    return new EventSource(`${backendUrl}/api/queue/events`, {
      withCredentials: true,
    });
  },
};
