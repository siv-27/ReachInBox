import { useState } from 'react';
import type { TabType } from '../components/Sidebar/Sidebar';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { DashboardOverview } from './DashboardOverview';
import { ScheduledEmailsPage } from './ScheduledEmailsPage';
import { SentEmailsPage } from './SentEmailsPage';
import { QueueMonitorPage } from './QueueMonitorPage';
import { IntegrationsPage } from './IntegrationsPage';

import { useCampaigns } from '../hooks/useCampaigns';
import { useSlack } from '../hooks/useSlack';
import { useQueue } from '../hooks/useQueue';

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [composeOpen, setComposeOpen] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 5000);
  };

  // Custom Hooks
  const { scheduledEmails, sentEmails, loading: emailsLoading, refreshEmails } = useCampaigns();
  const { slackStatus, loading: slackLoading, connectSlack, disconnectSlack } = useSlack();
  const {
    queueStats,
    selectedQueueStatus,
    queueJobs,
    queuePagination,
    loading: queueLoading,
    error: queueError,
    sseConnected,
    handleQueueStatusChange,
    setQueuePagination,
  } = useQueue(activeTab);

  const handleDisconnectSlack = async () => {
    try {
      await disconnectSlack();
      showToast('success', 'Slack workspace disconnected successfully.');
    } catch (err) {
      showToast('error', 'Failed to disconnect Slack.');
    }
  };

  return (
    <DashboardLayout
      activeTab={activeTab}
      onSelectTab={setActiveTab}
      composeOpen={composeOpen}
      onCloseCompose={() => setComposeOpen(false)}
      onComposeSuccess={refreshEmails}
      toast={toast}
      onCloseToast={() => setToast(null)}
      showToast={showToast}
    >
      {activeTab === 'overview' && (
        <DashboardOverview
          scheduledEmails={scheduledEmails}
          sentEmails={sentEmails}
          slackStatus={slackStatus}
          slackLoading={slackLoading}
          onOpenCompose={() => setComposeOpen(true)}
          onConnectSlack={connectSlack}
        />
      )}

      {activeTab === 'scheduled' && (
        <ScheduledEmailsPage scheduledEmails={scheduledEmails} loading={emailsLoading} />
      )}

      {activeTab === 'sent' && (
        <SentEmailsPage sentEmails={sentEmails} loading={emailsLoading} />
      )}

      {activeTab === 'queue' && (
        <QueueMonitorPage
          queueStats={queueStats}
          selectedQueueStatus={selectedQueueStatus}
          queueJobs={queueJobs}
          queuePagination={queuePagination}
          loading={queueLoading}
          error={queueError}
          sseConnected={sseConnected}
          onStatusChange={handleQueueStatusChange}
          onPageChange={(page) => setQueuePagination((prev) => ({ ...prev, page }))}
        />
      )}

      {activeTab === 'integrations' && (
        <IntegrationsPage
          slackStatus={slackStatus}
          slackLoading={slackLoading}
          onConnectSlack={connectSlack}
          onDisconnectSlack={handleDisconnectSlack}
        />
      )}
    </DashboardLayout>
  );
}
