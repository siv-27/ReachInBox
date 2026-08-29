import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/authMiddleware';
import { emailQueue } from '../queue/emailQueue';
import { queueConfig } from '../queue/queueConfig';
import { QueueEvents } from 'bullmq';
import { createRedisConnection } from '../config/redis';
import { prisma } from '../config/database';

export class QueueController {
  /**
   * Fetch aggregate job counts for the email-queue
   */
  static async getStats(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const counts = await emailQueue.getJobCounts('waiting', 'active', 'delayed', 'completed', 'failed');
      res.json({
        status: 'ok',
        stats: {
          waiting: counts.waiting || 0,
          active: counts.active || 0,
          delayed: counts.delayed || 0,
          completed: counts.completed || 0,
          failed: counts.failed || 0,
        },
      });
    } catch (error: any) {
      console.error('[QueueController] Failed to fetch queue stats:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to retrieve queue statistics. Redis may be temporarily unavailable.',
        error: error.message,
      });
    }
  }

  /**
   * Fetch paginated list of jobs for a specific status
   */
  static async getJobs(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const status = String(req.query.status || 'active');
      const page = parseInt(String(req.query.page || '1'), 10);
      const limit = parseInt(String(req.query.limit || '20'), 10);

      const pageNum = isNaN(page) || page < 1 ? 1 : page;
      const limitNum = isNaN(limit) || limit < 1 ? 20 : limit;

      const allowedStatuses = ['waiting', 'active', 'delayed', 'completed', 'failed'];
      if (!allowedStatuses.includes(status)) {
        res.status(400).json({
          status: 'error',
          message: `Invalid queue status parameter. Allowed values: ${allowedStatuses.join(', ')}`,
        });
        return;
      }

      const start = (pageNum - 1) * limitNum;
      const end = start + limitNum - 1;

      // Fetch jobs from BullMQ
      const jobs = await emailQueue.getJobs([status as any], start, end, true);

      // Fetch aggregate total for this state to calculate pagination
      const counts = await emailQueue.getJobCounts(status as any);
      const total = counts[status] || 0;

      // Extract emailIds to do a bulk database lookup for recipient/subject details
      const emailIds = jobs.map((job) => job.data?.emailId).filter(Boolean);
      const dbEmails = emailIds.length > 0
        ? await prisma.email.findMany({ where: { id: { in: emailIds } } })
        : [];
      
      const emailMap = new Map(dbEmails.map((email) => [email.id, email]));

      // Format jobs safely without exposing sensitive variables
      const formattedJobs = jobs.map((job) => {
        const emailId = job.data?.emailId;
        const dbEmail = emailId ? emailMap.get(emailId) : null;

        return {
          id: job.id,
          emailId,
          recipient: dbEmail?.recipient || job.data?.recipient || 'unknown',
          subject: dbEmail?.subject || job.data?.subject || 'unknown',
          status: dbEmail?.status || job.name,
          attempts: job.attemptsMade,
          maxAttempts: job.opts.attempts || 1,
          failedReason: job.failedReason || null,
          timestamp: job.timestamp,
          processedOn: job.processedOn || null,
          finishedOn: job.finishedOn || null,
        };
      });

      res.json({
        status: 'ok',
        jobs: formattedJobs,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
        },
      });
    } catch (error: any) {
      console.error('[QueueController] Failed to fetch queue jobs:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to retrieve queue jobs list.',
        error: error.message,
      });
    }
  }

  /**
   * Server-Sent Events (SSE) stream for real-time dashboard events and aggregates
   */
  static async eventStream(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    let queueEvents: QueueEvents | null = null;
    let sseConnectionActive = true;

    try {
      // Set headers for Server-Sent Events
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders();

      console.log('[QueueController] SSE client connected to event stream.');

      // Helper to push queue statistics
      const sendStats = async () => {
        if (!sseConnectionActive) return;
        try {
          const counts = await emailQueue.getJobCounts('waiting', 'active', 'delayed', 'completed', 'failed');
          res.write(`data: ${JSON.stringify({
            type: 'stats',
            stats: {
              waiting: counts.waiting || 0,
              active: counts.active || 0,
              delayed: counts.delayed || 0,
              completed: counts.completed || 0,
              failed: counts.failed || 0,
            }
          })}\n\n`);
        } catch (err: any) {
          console.error('[QueueController] Failed to send stats on SSE stream:', err.message);
        }
      };

      // Send initial stats immediately
      await sendStats();

      // Instantiate localized QueueEvents listener using a fresh Redis connection to avoid blocking pool sockets
      queueEvents = new QueueEvents(queueConfig.name, {
        connection: createRedisConnection(),
      });

      // Handlers for worker transitions
      const handleTransition = async (event: string, data: any) => {
        if (!sseConnectionActive) return;
        try {
          res.write(`data: ${JSON.stringify({
            type: 'event',
            event,
            data: {
              jobId: data.jobId,
              failedReason: data.failedReason || null,
            }
          })}\n\n`);
          // Trigger a stats refresh to update aggregates
          await sendStats();
        } catch (err) {
          // Client might have disconnected during write
        }
      };

      queueEvents.on('waiting', (data) => handleTransition('waiting', data));
      queueEvents.on('active', (data) => handleTransition('active', data));
      queueEvents.on('completed', (data) => handleTransition('completed', data));
      queueEvents.on('failed', (data) => handleTransition('failed', data));
      queueEvents.on('delayed', (data) => handleTransition('delayed', data));

      // Handle client connection drop
      req.on('close', async () => {
        console.log('[QueueController] SSE client disconnected.');
        sseConnectionActive = false;
        
        if (queueEvents) {
          try {
            queueEvents.removeAllListeners();
            await queueEvents.close();
            console.log('[QueueController] Local QueueEvents connection closed safely.');
          } catch (err) {
            console.error('[QueueController] Error closing QueueEvents connection:', err);
          }
        }
      });
    } catch (error: any) {
      console.error('[QueueController] Event stream exception:', error);
      res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
      res.end();

      if (queueEvents) {
        try {
          queueEvents.removeAllListeners();
          await queueEvents.close();
        } catch (e) {}
      }
    }
  }
}
