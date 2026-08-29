import React from 'react';
import { Plus, Bell, CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react';
import { Card } from '../components/Card/Card';
import { MetricCard } from '../components/Card/MetricCard';
import { Button } from '../components/Button/Button';
import { useAuth } from '../hooks/useAuth';
import type { EmailRecord } from '../services/campaignService';
import type { SlackStatusResponse } from '../services/slackService';

export interface DashboardOverviewProps {
  scheduledEmails: EmailRecord[];
  sentEmails: EmailRecord[];
  slackStatus: SlackStatusResponse | null;
  slackLoading: boolean;
  onOpenCompose: () => void;
  onConnectSlack: () => void;
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({
  scheduledEmails,
  sentEmails,
  slackStatus,
  slackLoading,
  onOpenCompose,
  onConnectSlack,
}) => {
  const { user } = useAuth();

  const scheduledCount = scheduledEmails.filter((e) => e.status === 'SCHEDULED').length;
  const activeCount = scheduledEmails.filter((e) => e.status === 'PROCESSING').length;
  const sentCount = sentEmails.filter((e) => e.status === 'SENT').length;
  const failedCount = sentEmails.filter((e) => e.status === 'FAILED').length;

  return (
    <div className="space-y-8">
      {/* Greeting Banner */}
      <Card className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        <div className="text-left space-y-1">
          <h3 className="text-2xl font-bold text-[#292524]">
            Welcome back, {user?.name?.split(' ')[0] || 'User'}!
          </h3>
          <p className="text-[#78716C] text-sm">
            Your Google OAuth session is active. Create new campaigns and inspect scheduled outreach statistics.
          </p>
        </div>
        <Button leftIcon={<Plus className="w-4 h-4" />} onClick={onOpenCompose}>
          Compose New Email
        </Button>
      </Card>

      {/* Aggregate Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Scheduled"
          value={scheduledCount}
          textColor="text-[#D97706]"
          bgDotColor="bg-[#D97706]"
        />
        <MetricCard
          label="Active"
          value={activeCount}
          textColor="text-[#EA580C]"
          bgDotColor="bg-[#EA580C]"
        />
        <MetricCard
          label="Sent"
          value={sentCount}
          textColor="text-[#7A8450]"
          bgDotColor="bg-[#7A8450]"
        />
        <MetricCard
          label="Failed"
          value={failedCount}
          textColor="text-[#B91C1C]"
          bgDotColor="bg-[#B91C1C]"
        />
      </div>

      {/* Workspace Notifications */}
      <Card className="space-y-4">
        <div className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-[#C2410C]" />
          <h4 className="font-bold text-lg text-[#292524]">Workspace Notifications</h4>
        </div>
        <p className="text-sm text-[#78716C]">
          Connect Slack to receive real-time warnings whenever outreach dispatches reach hourly staggers.
        </p>

        {slackLoading ? (
          <div className="text-sm text-[#A8A29E]">Retrieving Slack details...</div>
        ) : slackStatus?.connected ? (
          <div className="bg-[#FFF7ED] border border-[#FFEDD5] rounded-lg p-4 flex justify-between items-center text-sm">
            <div className="flex items-center gap-2 text-[#7A8450] font-semibold">
              <CheckCircle2 className="w-5 h-5" />
              <span>Slack Workspace Connected</span>
            </div>
            <span className="text-xs text-[#78716C]">
              Channel: #{slackStatus.channelId || 'general'}
            </span>
          </div>
        ) : (
          <div className="bg-[#FFFCF8] border border-[#E7E0D8] p-5 rounded-lg text-center space-y-3">
            <div className="flex items-center justify-center gap-2 text-xs text-[#78716C]">
              <AlertTriangle className="w-4 h-4 text-[#D97706]" />
              <span>No Slack workspace currently linked.</span>
            </div>
            <Button size="sm" onClick={onConnectSlack} leftIcon={<ShieldCheck className="w-4 h-4" />}>
              Connect Slack Workspace
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
};
