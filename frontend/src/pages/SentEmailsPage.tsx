import React, { useState, useEffect } from 'react';
import { Search, ExternalLink } from 'lucide-react';
import { Card } from '../components/Card/Card';
import { Input } from '../components/Input/Input';
import { Table, type Column } from '../components/Table/Table';
import { StatusBadge } from '../components/Badge/StatusBadge';
import { campaignService, type EmailRecord } from '../services/campaignService';

export interface SentEmailsPageProps {
  sentEmails: EmailRecord[];
  loading: boolean;
}

export const SentEmailsPage: React.FC<SentEmailsPageProps> = ({ sentEmails, loading }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[] | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);

  const executeSearch = async (query: string) => {
    if (!query.trim()) {
      setSearchResults(null);
      return;
    }
    setSearchLoading(true);
    try {
      const results = await campaignService.searchEmails(query);
      setSearchResults(results);
    } catch (err) {
      console.error('[SentEmailsPage] Search error:', err);
    } finally {
      setSearchLoading(false);
    }
  };

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      executeSearch(searchQuery);
    }, 400);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  const searchColumns: Column<any>[] = [
    {
      key: 'recipientEmail',
      header: 'Recipient',
      render: (item) => <span className="font-semibold text-[#292524]">{item.recipientEmail}</span>,
    },
    {
      key: 'subject',
      header: 'Subject',
      render: (item) => <span className="text-[#78716C] truncate max-w-xs block">{item.subject}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (item) => <StatusBadge status={item.status} />,
    },
    {
      key: 'details',
      header: 'Details',
      render: () => (
        <span className="text-xs text-[#78716C]">Indexed in search</span>
      ),
    },
  ];

  const sentColumns: Column<EmailRecord>[] = [
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
      key: 'sentAt',
      header: 'Dispatched',
      render: (item) => (
        <span className="text-[#A8A29E]">
          {item.status === 'SENT'
            ? item.sentAt
              ? new Date(item.sentAt).toLocaleString()
              : 'N/A'
            : item.failedAt
            ? new Date(item.failedAt).toLocaleString()
            : 'N/A'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (item) => <StatusBadge status={item.status} />,
    },
    {
      key: 'previewUrl',
      header: 'Details',
      render: (item) =>
        item.status === 'SENT' ? (
          item.previewUrl ? (
            <a
              href={item.previewUrl}
              target="_blank"
              rel="noreferrer"
              className="text-[#C2410C] font-semibold hover:underline inline-flex items-center gap-1 text-xs"
            >
              <span>Ethereal Preview</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          ) : (
            <span className="text-[#78716C] text-xs">Sent (no url)</span>
          )
        ) : (
          <span className="text-[#B91C1C] text-xs truncate max-w-[120px] block" title={item.error || ''}>
            {item.error || 'SMTP Error'}
          </span>
        ),
    },
  ];

  return (
    <Card className="space-y-6">
      <div className="space-y-1">
        <h3 className="text-lg font-bold text-[#292524]">Outreach Log & Full-Text Search</h3>
        <p className="text-xs text-[#78716C]">
          Query recipient, sender, subject, and body terms via the real-time Elasticsearch search index.
        </p>
      </div>

      <Input
        leftIcon={<Search className="w-5 h-5 text-[#A8A29E]" />}
        placeholder="Search query (e.g. gmail.com, invoice, partnership)..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
      />

      {searchLoading ? (
        <div className="py-12 text-center text-sm text-[#A8A29E]">Querying search index...</div>
      ) : searchQuery.trim() ? (
        <Table
          columns={searchColumns}
          data={searchResults || []}
          keyExtractor={(item) => item.id}
          emptyText="No emails found matching your query."
        />
      ) : (
        <Table
          columns={sentColumns}
          data={sentEmails}
          keyExtractor={(item) => item.id}
          isLoading={loading}
          emptyText="No sent emails yet."
        />
      )}
    </Card>
  );
};
