import { useState, useEffect, useCallback } from 'react';
import { queueService, type QueueJob, type PaginationData } from '../services/queueService';

export function useQueue(activeTab: string) {
  const [queueStats, setQueueStats] = useState<{
    waiting: number;
    active: number;
    delayed: number;
    completed: number;
    failed: number;
  }>({ waiting: 0, active: 0, delayed: 0, completed: 0, failed: 0 });

  const [selectedQueueStatus, setSelectedQueueStatus] = useState<string>('active');
  const [queueJobs, setQueueJobs] = useState<QueueJob[]>([]);
  const [queuePagination, setQueuePagination] = useState<PaginationData>({ page: 1, limit: 10, total: 0 });
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [sseConnected, setSseConnected] = useState<boolean>(false);

  const fetchQueueJobs = useCallback(async (status: string, pageNum: number) => {
    setLoading(true);
    try {
      const data = await queueService.getQueueJobs(status, pageNum);
      setQueueJobs(data.jobs);
      setQueuePagination(data.pagination);
      setError(null);
    } catch (err: any) {
      console.error('[useQueue] Failed to fetch queue jobs:', err);
      setError(err.response?.data?.message || 'Failed to retrieve queue jobs list.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'queue') {
      fetchQueueJobs(selectedQueueStatus, queuePagination.page);
    }
  }, [activeTab, selectedQueueStatus, queuePagination.page, fetchQueueJobs]);

  useEffect(() => {
    if (activeTab !== 'queue') return;

    const eventSource = queueService.createQueueEventsStream();
    setSseConnected(false);

    eventSource.onopen = () => {
      setSseConnected(true);
      setError(null);
    };

    eventSource.onmessage = (e) => {
      try {
        const payload = JSON.parse(e.data);
        if (payload.type === 'stats') {
          setQueueStats(payload.stats);
        } else if (payload.type === 'event') {
          fetchQueueJobs(selectedQueueStatus, queuePagination.page);
        }
      } catch (err) {
        console.error('[useQueue] SSE parser failed:', err);
      }
    };

    eventSource.onerror = () => {
      setSseConnected(false);
      setError('Reconnecting to live queue event stream...');
    };

    return () => {
      eventSource.close();
    };
  }, [activeTab, selectedQueueStatus, queuePagination.page, fetchQueueJobs]);

  const handleQueueStatusChange = (status: string) => {
    setSelectedQueueStatus(status);
    setQueuePagination({ page: 1, limit: 10, total: 0 });
  };

  return {
    queueStats,
    selectedQueueStatus,
    queueJobs,
    queuePagination,
    loading,
    error,
    sseConnected,
    handleQueueStatusChange,
    setQueuePagination,
    refreshQueueJobs: () => fetchQueueJobs(selectedQueueStatus, queuePagination.page),
  };
}
