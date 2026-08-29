import { prisma } from '../config/database';
import { config } from '../config/env';

export interface SlackOAuthResult {
  ok: boolean;
  accessToken?: string;
  teamId?: string;
  channelId?: string;
  error?: string;
}

export class SlackService {
  /**
   * Exchange code for Slack Access Token
   */
  static async exchangeCode(code: string): Promise<SlackOAuthResult> {
    try {
      const response = await fetch('https://slack.com/api/oauth.v2.access', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: config.slackClientId,
          client_secret: config.slackClientSecret,
          code,
          redirect_uri: config.slackRedirectUri,
        }).toString(),
      });

      const data: any = await response.json();
      if (!data.ok) {
        return { ok: false, error: data.error || 'Failed to exchange Slack code' };
      }

      return {
        ok: true,
        accessToken: data.access_token,
        teamId: data.team?.id,
        channelId: data.incoming_webhook?.channel_id || data.incoming_webhook?.channel,
      };
    } catch (error: any) {
      console.error('[SlackService] OAuth code exchange exception:', error);
      return { ok: false, error: error.message || 'OAuth network error' };
    }
  }

  /**
   * Post message to a user's connected Slack channel
   */
  static async postMessage(userId: string, senderEmail: string, rateLimitCount: number): Promise<void> {
    // 1. Load connection from DB
    const connection = await prisma.slackConnection.findFirst({
      where: { userId },
    });

    if (!connection || !connection.accessToken) {
      return; // Slack not connected for this user
    }

    // Determine target channel (use configured channelId or fallback to general)
    const channel = connection.channelId || 'general';
    const message = `⚠️ *Rate Limit Alert* ⚠️\nSender account *${senderEmail}* has reached its hourly email quota limit (*${rateLimitCount}* emails/hour) and subsequent emails have been rescheduled.`;

    try {
      const response = await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Authorization': `Bearer ${connection.accessToken}`,
        },
        body: JSON.stringify({
          channel,
          text: message,
        }),
      });

      const data: any = await response.json();
      if (!data.ok) {
        console.warn(`[SlackService] Post message failed for user ${userId}: ${data.error}`);

        // Handle invalid or revoked tokens
        if (data.error === 'invalid_auth' || data.error === 'token_revoked' || data.error === 'account_inactive') {
          console.warn(`[SlackService] Token is invalid or revoked. Purging Slack connection from database for user ${userId}.`);
          await prisma.slackConnection.deleteMany({
            where: { userId },
          });
        }
      } else {
        console.log(`[SlackService] Notification posted to Slack channel ${channel} for user ${userId}`);
      }
    } catch (error) {
      // Slack exceptions must never block the email scheduler or fail email jobs
      console.error('[SlackService] Post notification exception (ignored):', error);
    }
  }
}
