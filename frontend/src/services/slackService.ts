import api from './api';
import { getBackendUrl } from '../config/env';

export interface SlackStatusResponse {
  connected: boolean;
  teamId?: string;
  channelId?: string;
}

export const slackService = {
  getStatus: async (): Promise<SlackStatusResponse> => {
    const res = await api.get('/api/slack/status');
    return res.data;
  },

  connectSlack: () => {
    const backendUrl = getBackendUrl();
    window.location.href = `${backendUrl}/api/slack/connect`;
  },

  disconnectSlack: async () => {
    const res = await api.post('/api/slack/disconnect');
    return res.data;
  },
};
