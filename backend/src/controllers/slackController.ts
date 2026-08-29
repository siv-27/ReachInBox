import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthenticatedRequest } from '../middleware/authMiddleware';
import { prisma } from '../config/database';
import { config } from '../config/env';
import { SlackService } from '../services/slackService';

export class SlackController {
  /**
   * Initiate Slack OAuth Redirection
   */
  static connect(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ message: 'Unauthorized: User context not found' });
        return;
      }

      // Safe diagnostic logging — never logs the client secret
      console.log('[SlackController] Slack Client ID exists:', !!config.slackClientId);
      console.log('[SlackController] Slack Client ID length:', config.slackClientId.length);
      console.log('[SlackController] Slack Redirect URI:', config.slackRedirectUri);

      if (!config.slackClientId) {
        console.error('[SlackController] FATAL: SLACK_CLIENT_ID is empty — OAuth will fail.');
        res.status(500).json({ message: 'Slack integration is not configured. Contact support.' });
        return;
      }

      // Generate a signed JWT token for the state parameter to prevent CSRF attacks
      const state = jwt.sign({ userId }, config.jwtSecret, { expiresIn: '15m' });

      // Request chat:write scope to post alerts, and incoming-webhook to get a channel selection
      const slackAuthUrl = 'https://slack.com/oauth/v2/authorize?' + new URLSearchParams({
        client_id: config.slackClientId,
        scope: 'chat:write,incoming-webhook',
        redirect_uri: config.slackRedirectUri,
        state,
      }).toString();

      console.log('[SlackController] Redirecting to Slack OAuth (client_id present, secret masked)');
      res.redirect(slackAuthUrl);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Slack OAuth Callback
   */
  static async callback(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    const { code, state, error: slackError } = req.query;

    if (slackError) {
      console.warn('[SlackController] OAuth error returned from Slack:', slackError);
      res.redirect(`${config.frontendUrl}/?error=slack_access_denied`);
      return;
    }

    if (!code || !state) {
      res.status(400).json({ message: 'Bad Request: Missing code or state parameters' });
      return;
    }

    try {
      // 1. Verify CSRF state token and retrieve userId
      let userId: string;
      try {
        const decoded = jwt.verify(String(state), config.jwtSecret) as { userId: string };
        userId = decoded.userId;
      } catch (err) {
        res.status(400).json({ message: 'Invalid or expired state parameter' });
        return;
      }

      // 2. Exchange code for access token
      const oauthResult = await SlackService.exchangeCode(String(code));
      if (!oauthResult.ok || !oauthResult.accessToken || !oauthResult.teamId) {
        console.error('[SlackController] OAuth exchange failed:', oauthResult.error);
        res.redirect(`${config.frontendUrl}/?error=slack_auth_failed`);
        return;
      }

      // 3. Save connection details securely in PostgreSQL (upserting per user)
      await prisma.slackConnection.upsert({
        where: {
          userId_teamId: {
            userId,
            teamId: oauthResult.teamId,
          },
        },
        update: {
          accessToken: oauthResult.accessToken,
          channelId: oauthResult.channelId,
        },
        create: {
          userId,
          teamId: oauthResult.teamId,
          accessToken: oauthResult.accessToken,
          channelId: oauthResult.channelId,
        },
      });

      console.log(`[SlackController] Successfully connected Slack team ${oauthResult.teamId} for user ${userId}`);

      // Redirect user back to the frontend dashboard
      res.redirect(`${config.frontendUrl}/`);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get Slack Connection Status
   */
  static async getStatus(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
      }

      const connection = await prisma.slackConnection.findFirst({
        where: { userId },
      });

      if (!connection) {
        res.json({ connected: false });
        return;
      }

      res.json({
        connected: true,
        teamId: connection.teamId,
        channelId: connection.channelId || 'general',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Disconnect Slack Connection
   */
  static async disconnect(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
      }

      await prisma.slackConnection.deleteMany({
        where: { userId },
      });

      console.log(`[SlackController] Successfully disconnected Slack for user ${userId}`);
      res.json({ status: 'ok', message: 'Slack disconnected successfully' });
    } catch (error) {
      next(error);
    }
  }
}
