import React from 'react';
import { Card } from '../components/Card/Card';
import { Table, type Column } from '../components/Table/Table';
import { StatusBadge } from '../components/Badge/StatusBadge';
import type { EmailRecord } from '../services/campaignService';

export interface ScheduledEmailsPageProps {
  scheduledEmails: EmailRecord[];
  loading: boolean;
}

export const ScheduledEmailsPage: React.FC<ScheduledEmailsPageProps> = ({
  scheduledEmails,
  loading,
}) => {
  const columns: Column<EmailRecord>[] = [
    {
      key: 'recipient',
      header: 'Recipient',
      render: (item) => <span className="font-semibold text-[#292524]">{item.recipient}</span>,
    },
    {
      key: 'subject',
      header: 'Subject Line',
      render: (item) => <span className="text-[#78716C] truncate max-w-xs block">{item.subject}</span>,
    },
    {
      key: 'scheduledAt',
      header: 'Scheduled Launch',
      render: (item) => (
        <span className="text-[#A8A29E]">
          {item.scheduledAt ? new Date(item.scheduledAt).toLocaleString() : 'Pending'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (item) => <StatusBadge status={item.status} />,
    },
  ];

  return (
    <Card className="space-y-6">
      <div className="space-y-1">
        <h3 className="text-lg font-bold text-[#292524]">Scheduled Outreaches</h3>
        <p className="text-xs text-[#78716C]">
          Emails queued in Upstash Redis / BullMQ waiting for their scheduled launch time.
        </p>
      </div>

      <Table
        columns={columns}
        data={scheduledEmails}
        keyExtractor={(item) => item.id}
        isLoading={loading}
        emptyText="No scheduled emails currently queued."
      />
    </Card>
  );
};
