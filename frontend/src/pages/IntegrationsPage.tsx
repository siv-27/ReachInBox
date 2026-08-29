import React from 'react';
import { Share2, CheckCircle2, ShieldAlert } from 'lucide-react';
import { Card } from '../components/Card/Card';
import { Button } from '../components/Button/Button';
import type { SlackStatusResponse } from '../services/slackService';

export interface IntegrationsPageProps {
  slackStatus: SlackStatusResponse | null;
  slackLoading: boolean;
  onConnectSlack: () => void;
  onDisconnectSlack: () => void;
}

export const IntegrationsPage: React.FC<IntegrationsPageProps> = ({
  slackStatus,
  slackLoading,
  onConnectSlack,
  onDisconnectSlack,
}) => {
  return (
    <Card className="space-y-6">
      <div className="space-y-1">
        <h3 className="text-lg font-bold text-[#292524]">Slack Integration & Live Alerts</h3>
        <p className="text-xs text-[#78716C]">
          Connect your Slack workspace to receive instant notifications whenever send throttling or rate limits are encountered.
        </p>
      </div>

      <div className="border border-[#E7E0D8] rounded-xl p-6 bg-[#FFFCF8] space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#FFEDD5] border border-[#FFEDD5] flex items-center justify-center text-[#C2410C]">
            <Share2 className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-bold text-base text-[#292524]">Slack Workspace OAuth 2.0</h4>
            <p className="text-xs text-[#78716C]">
              Post rate-limit alert notifications directly to your team's designated Slack channels.
            </p>
          </div>
        </div>

        {slackLoading ? (
          <div className="text-sm text-[#A8A29E] py-4">Checking Slack connection state...</div>
        ) : slackStatus?.connected ? (
          <div className="bg-[#FFFFFF] border border-[#E7E0D8] p-5 rounded-lg space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[#7A8450] font-semibold text-sm">
                <CheckCircle2 className="w-5 h-5" />
                <span>Connected to Slack Team: {slackStatus.teamId}</span>
              </div>
              <span className="text-xs text-[#78716C]">
                Channel: #{slackStatus.channelId || 'general'}
              </span>
            </div>
            <div className="pt-3 border-t border-[#EEE7DF] flex justify-end">
              <Button size="sm" variant="outline" onClick={onDisconnectSlack}>
                Disconnect Slack
              </Button>
            </div>
          </div>
        ) : (
          <div className="bg-[#FFFFFF] border border-[#E7E0D8] p-5 rounded-lg text-center space-y-4">
            <div className="flex items-center justify-center gap-2 text-sm text-[#78716C]">
              <ShieldAlert className="w-4 h-4 text-[#D97706]" />
              <span>No Slack workspace connected.</span>
            </div>
            <Button onClick={onConnectSlack}>Connect Slack Workspace</Button>
          </div>
        )}
      </div>
    </Card>
  );
};
