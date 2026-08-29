import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/authMiddleware';
import { SchedulerService } from '../services/schedulerService';
import { ElasticsearchService } from '../services/elasticsearchService';
import { prisma } from '../config/database';

/**
 * Standard RFC 5322 email regex check
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export class EmailController {
  /**
   * Schedule emails for one or more recipients
   */
  static async schedule(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { sender, recipients, subject, body, startTime, delayBetweenEmails } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({ message: 'Unauthorized: User context not found' });
        return;
      }

      const errors: Record<string, string> = {};

      // Input validations
      if (!sender || typeof sender !== 'string' || !isValidEmail(sender)) {
        errors.sender = 'Invalid sender email address';
      }

      let sanitizedRecipients: string[] = [];
      if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
        errors.recipients = 'Recipients must be a non-empty array';
      } else {
        // Trim, filter empty, and remove duplicate recipient emails
        const rawList = recipients.map((r) => String(r).trim()).filter(Boolean);
        const uniqueSet = new Set<string>();
        const invalidRecipients: string[] = [];

        for (const email of rawList) {
          if (isValidEmail(email)) {
            uniqueSet.add(email);
          } else {
            invalidRecipients.push(email);
          }
        }

        if (invalidRecipients.length > 0) {
          errors.recipients = `Malformed recipient email address(es): ${invalidRecipients.join(', ')}`;
        } else if (uniqueSet.size === 0) {
          errors.recipients = 'No valid email addresses provided';
        } else {
          sanitizedRecipients = Array.from(uniqueSet);
        }
      }

      if (subject === undefined || subject === null || String(subject).trim() === '') {
        errors.subject = 'Subject is required';
      }

      if (body === undefined || body === null || String(body).trim() === '') {
        errors.body = 'Body is required';
      }

      if (!startTime || isNaN(Date.parse(startTime))) {
        errors.startTime = 'Invalid start time format';
      } else {
        const parsedScheduledDate = new Date(startTime);
        const now = new Date();
        const delayMs = parsedScheduledDate.getTime() - now.getTime();

        console.log('[EmailController] Timezone & Schedule Diagnostics:');
        console.log(`  Frontend scheduled time: ${startTime}`);
        console.log(`  Backend parsed scheduled time: ${parsedScheduledDate.toISOString()}`);
        console.log(`  Current server time: ${now.toISOString()}`);
        console.log(`  Calculated launch delay: ${delayMs} ms`);
        console.log(`  Server Timezone offset: ${now.getTimezoneOffset()} minutes`);

        if (delayMs < -5000) {
          res.status(400).json({
            message: 'Start time must be in the future',
            errors: { startTime: 'Start time must be in the future' }
          });
          return;
        }
      }

      const delayMs = parseInt(String(delayBetweenEmails !== undefined ? delayBetweenEmails : 0), 10);
      if (isNaN(delayMs) || delayMs < 0) {
        errors.delayBetweenEmails = 'Delay between emails must be a non-negative number';
      }

      if (Object.keys(errors).length > 0) {
        res.status(400).json({
          message: 'Validation failed',
          errors,
        });
        return;
      }

      // Execute Scheduler Service
      const scheduled = await SchedulerService.scheduleEmails({
        userId,
        sender,
        recipients: sanitizedRecipients,
        subject,
        body,
        startTime,
        delayBetweenEmails: delayMs,
      });

      res.status(201).json({
        message: 'Emails scheduled successfully',
        count: scheduled.length,
        emails: scheduled.map((email) => ({
          id: email.id,
          recipient: email.recipient,
          sender: email.sender,
          subject: email.subject,
          scheduledAt: email.scheduledAt,
          status: email.status,
          createdAt: email.createdAt,
        })),
        scheduled: scheduled.map((email, index) => ({
          id: email.id,
          jobId: email.bullmqJobId,
          delay: index * delayMs,
          recipient: email.recipient,
          scheduledAt: email.scheduledAt.toISOString(),
        })),
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get SCHEDULED and PROCESSING emails for the authenticated user
   */
  static async getScheduled(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
      }

      const emails = await prisma.email.findMany({
        where: {
          userId,
          status: {
            in: ['SCHEDULED', 'PROCESSING'],
          },
        },
        orderBy: {
          scheduledAt: 'asc',
        },
      });

      res.json({
        status: 'ok',
        emails: emails.map((email) => ({
          id: email.id,
          recipient: email.recipient,
          sender: email.sender,
          subject: email.subject,
          scheduledAt: email.scheduledAt,
          status: email.status,
          createdAt: email.createdAt,
        })),
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get SENT and FAILED emails for the authenticated user
   */
  static async getSent(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
      }

      const emails = await prisma.email.findMany({
        where: {
          userId,
          status: {
            in: ['SENT', 'FAILED'],
          },
        },
        orderBy: {
          updatedAt: 'desc',
        },
      });

      res.json({
        status: 'ok',
        emails: emails.map((email) => ({
          id: email.id,
          recipient: email.recipient,
          sender: email.sender,
          subject: email.subject,
          sentAt: email.sentAt,
          failedAt: email.failedAt,
          status: email.status,
          previewUrl: email.previewUrl,
          error: email.error,
        })),
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Search user emails via Elasticsearch
   */
  static async search(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
      }

      const query = String(req.query.q || '');
      const page = parseInt(String(req.query.page || '1'), 10);
      const limit = parseInt(String(req.query.limit || '20'), 10);

      const pageNum = isNaN(page) || page < 1 ? 1 : page;
      const limitNum = isNaN(limit) || limit < 1 ? 20 : limit;

      const { data, total } = await ElasticsearchService.searchEmails(userId, query, pageNum, limitNum);

      res.json({
        data,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
        },
      });
    } catch (error) {
      next(error);
    }
  }
}
