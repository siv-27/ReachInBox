import api from './api';

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
    const backendUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
    window.location.href = `${backendUrl}/api/slack/connect`;
  },

  disconnectSlack: async () => {
    const res = await api.post('/api/slack/disconnect');
    return res.data;
  },
};
