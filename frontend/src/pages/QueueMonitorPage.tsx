import React from 'react';
import { Card } from '../components/Card/Card';
import { MetricCard } from '../components/Card/MetricCard';
import { Table, type Column } from '../components/Table/Table';
import { Button } from '../components/Button/Button';
import type { QueueJob, PaginationData } from '../services/queueService';
import { ChevronLeft, ChevronRight, Activity } from 'lucide-react';

export interface QueueMonitorPageProps {
  queueStats: {
    waiting: number;
    active: number;
    delayed: number;
    completed: number;
    failed: number;
  };
  selectedQueueStatus: string;
  queueJobs: QueueJob[];
  queuePagination: PaginationData;
  loading: boolean;
  error: string | null;
  sseConnected: boolean;
  onStatusChange: (status: string) => void;
  onPageChange: (page: number) => void;
}

export const QueueMonitorPage: React.FC<QueueMonitorPageProps> = ({
  queueStats,
  selectedQueueStatus,
  queueJobs,
  queuePagination,
  loading,
  error,
  sseConnected,
  onStatusChange,
  onPageChange,
}) => {
  const totalPages = Math.ceil(queuePagination.total / queuePagination.limit) || 1;

  const columns: Column<QueueJob>[] = [
    {
      key: 'id',
      header: 'Job ID',
      render: (item) => <span className="font-mono text-xs text-[#292524]">{item.id}</span>,
    },
    {
      key: 'recipient',
      header: 'Recipient',
      render: (item) => <span className="font-semibold text-[#292524]">{item.recipient}</span>,
    },
    {
      key: 'subject',
      header: 'Subject',
      render: (item) => <span className="text-[#78716C] truncate max-w-xs block">{item.subject}</span>,
    },
    {
      key: 'attempts',
      header: 'Attempts',
      render: (item) => (
        <span className="text-xs font-semibold text-[#78716C]">
          {item.attempts} / {item.maxAttempts}
        </span>
      ),
    },
    {
      key: 'timestamp',
      header: 'Created / Processed',
      render: (item) => (
        <span className="text-xs text-[#A8A29E]">
          {item.finishedOn
            ? new Date(item.finishedOn).toLocaleString()
            : item.processedOn
            ? new Date(item.processedOn).toLocaleString()
            : new Date(item.timestamp).toLocaleString()}
        </span>
      ),
    },
    {
      key: 'failedReason',
      header: 'Status / Error',
      render: (item) =>
        item.failedReason ? (
          <span className="text-xs text-[#B91C1C] truncate max-w-[150px] block" title={item.failedReason}>
            {item.failedReason}
          </span>
        ) : (
          <span className="text-xs font-bold text-[#7A8450] uppercase">{selectedQueueStatus}</span>
        ),
    },
  ];

  return (
    <Card className="space-y-6">
      <div className="space-y-1">
        <h3 className="text-lg font-bold text-[#292524]">BullMQ Live Dashboard</h3>
        <p className="text-xs text-[#78716C]">
          Real-time queue visibility inside your active email scheduler. State changes are pushed dynamically via SSE.
        </p>
      </div>

      {error && (
        <div className="bg-[#FFF7ED] border border-[#FFEDD5] text-[#C2410C] p-4 rounded-lg text-sm flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[#C2410C] inline-block animate-pulse shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Aggregate Metric Buttons */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        {(['waiting', 'active', 'delayed', 'completed', 'failed'] as const).map((state) => (
          <MetricCard
            key={state}
            label={state}
            value={queueStats[state] ?? 0}
            onClick={() => onStatusChange(state)}
            isSelected={selectedQueueStatus === state}
          />
        ))}
      </div>

      {/* Connection Indicator */}
      <div className="flex items-center justify-between">
        <h4 className="font-bold text-[#292524] capitalize flex items-center gap-2">
          <Activity className="w-4 h-4 text-[#C2410C]" />
          <span>{selectedQueueStatus} Jobs</span>
        </h4>
        <div className="flex items-center gap-2 text-xs text-[#78716C]">
          <span
            className={`w-2 h-2 rounded-full ${
              sseConnected ? 'bg-[#7A8450] animate-pulse' : 'bg-[#CA8A04] animate-pulse'
            }`}
          />
          <span>{sseConnected ? 'Live Connection Active' : 'Connecting stream...'}</span>
        </div>
      </div>

      {/* Job Table */}
      <Table
        columns={columns}
        data={queueJobs}
        keyExtractor={(item) => item.id}
        isLoading={loading}
        emptyText={`No ${selectedQueueStatus} jobs found.`}
      />

      {/* Pagination Footer */}
      {queuePagination.total > 0 && (
        <div className="flex items-center justify-between pt-4 border-t border-[#EEE7DF] text-xs text-[#78716C]">
          <span>
            Showing page {queuePagination.page} of {totalPages} ({queuePagination.total} total jobs)
          </span>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={queuePagination.page <= 1}
              onClick={() => onPageChange(queuePagination.page - 1)}
              leftIcon={<ChevronLeft className="w-4 h-4" />}
            >
              Previous
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={queuePagination.page >= totalPages}
              onClick={() => onPageChange(queuePagination.page + 1)}
              rightIcon={<ChevronRight className="w-4 h-4" />}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
};
