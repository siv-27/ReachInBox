import { useState, useEffect, useCallback } from 'react';
import { slackService, type SlackStatusResponse } from '../services/slackService';

export function useSlack() {
  const [slackStatus, setSlackStatus] = useState<SlackStatusResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSlackStatus = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await slackService.getStatus();
      setSlackStatus(data);
    } catch (err: any) {
      console.error('[useSlack] Failed to fetch Slack status:', err);
      setError(err.response?.data?.message || 'Failed to fetch Slack status.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSlackStatus();
  }, [fetchSlackStatus]);

  const disconnect = async () => {
    setLoading(true);
    try {
      await slackService.disconnectSlack();
      setSlackStatus({ connected: false });
    } catch (err: any) {
      console.error('[useSlack] Failed to disconnect Slack:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    slackStatus,
    loading,
    error,
    connectSlack: slackService.connectSlack,
    disconnectSlack: disconnect,
    refreshSlackStatus: fetchSlackStatus,
  };
}
