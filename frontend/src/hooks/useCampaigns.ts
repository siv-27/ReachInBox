import { useState, useEffect, useCallback } from 'react';
import { campaignService, type EmailRecord } from '../services/campaignService';

export function useCampaigns() {
  const [scheduledEmails, setScheduledEmails] = useState<EmailRecord[]>([]);
  const [sentEmails, setSentEmails] = useState<EmailRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEmailsData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [scheduled, sent] = await Promise.all([
        campaignService.getScheduledEmails(),
        campaignService.getSentEmails(),
      ]);
      setScheduledEmails(scheduled);
      setSentEmails(sent);
    } catch (err: any) {
      console.error('[useCampaigns] Failed to fetch emails:', err);
      setError(err.response?.data?.message || 'Failed to load emails.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEmailsData();
  }, [fetchEmailsData]);

  return {
    scheduledEmails,
    sentEmails,
    loading,
    error,
    refreshEmails: fetchEmailsData,
  };
}
