import { prisma } from '../config/database';
import { emailQueue } from '../queue/emailQueue';
import { ElasticsearchService } from './elasticsearchService';

export interface ScheduleEmailInput {
  userId: string;
  sender: string;
  recipients: string[];
  subject: string;
  body: string;
  startTime: string; // ISO date string
  delayBetweenEmails: number; // in milliseconds
}

export class SchedulerService {
  /**
   * Staggers and schedules email records in PostgreSQL and queues BullMQ delayed jobs
   */
  static async scheduleEmails(input: ScheduleEmailInput) {
    const { userId, sender, recipients, subject, body, startTime, delayBetweenEmails } = input;
    const baseScheduledTime = new Date(startTime).getTime();

    // 1. Create all Email records in PostgreSQL inside a transaction.
    // This guarantees that either all recipients get records or none (preventing partial database creation).
    const dbEmails = await prisma.$transaction(
      recipients.map((recipient, index) => {
        const scheduledTime = new Date(baseScheduledTime + index * delayBetweenEmails);
        return prisma.email.create({
          data: {
            userId,
            sender,
            recipient,
            subject,
            body,
            status: 'SCHEDULED',
            scheduledAt: scheduledTime,
          },
        });
      })
    );

    const scheduledEmails = [];

    // 2. Queue corresponding delayed jobs in BullMQ storing original recipient details in job payload.
    for (const email of dbEmails) {
      // Calculate delay in milliseconds. If already due, queue with delay 0 (immediate execution).
      const delay = Math.max(0, new Date(email.scheduledAt).getTime() - Date.now());
      
      console.log(`[SchedulerService] Scheduling email ${email.id}:`);
      console.log(`  Recipient: ${email.recipient}`);
      console.log(`  ScheduledAt: ${email.scheduledAt.toISOString()}`);
      console.log(`  Current Date.now(): ${new Date().toISOString()}`);
      console.log(`  Calculated BullMQ Delay: ${delay} ms`);

      try {
        const job = await emailQueue.add(
          'send-email',
          {
            emailId: email.id,
            recipient: email.recipient,
            subject: email.subject,
            scheduledAt: email.scheduledAt.toISOString(),
          },
          {
            jobId: `email-${email.id}`, // Deterministic job ID for idempotency/duplicate avoidance
            delay,
          }
        );

        // Update the Email record with the successfully generated BullMQ job ID
        const updatedEmail = await prisma.email.update({
          where: { id: email.id },
          data: { bullmqJobId: job.id },
        });

        // Index in Elasticsearch (non-blocking async call)
        ElasticsearchService.indexEmail(updatedEmail).catch(() => {});

        scheduledEmails.push(updatedEmail);
      } catch (error) {
        console.error(`[SchedulerService] Critical: Failed to queue BullMQ job for email ID: ${email.id}`, error);
        
        // Update database status of the failed queue attempt
        const failedEmail = await prisma.email.update({
          where: { id: email.id },
          data: {
            status: 'FAILED',
            error: 'Failed to queue job in Redis',
            failedAt: new Date(),
          },
        });

        // Index in Elasticsearch (non-blocking async call)
        ElasticsearchService.indexEmail(failedEmail).catch(() => {});

        scheduledEmails.push(failedEmail);
      }
    }

    return scheduledEmails;
  }

  /**
   * Safe recovery mechanism: Finds past-due emails in SCHEDULED state (scheduledAt <= now)
   * and enqueues them for immediate execution (delay = 0).
   */
  static async recoverStaleScheduledEmails(): Promise<number> {
    try {
      const now = new Date();
      const staleEmails = await prisma.email.findMany({
        where: {
          status: 'SCHEDULED',
          scheduledAt: {
            lte: now,
          },
        },
        take: 50,
      });

      if (staleEmails.length === 0) {
        return 0;
      }

      console.log(`[SchedulerRecovery] Found ${staleEmails.length} past-due scheduled emails. Queueing for immediate execution...`);

      let enqueuedCount = 0;
      for (const email of staleEmails) {
        try {
          const job = await emailQueue.add(
            'send-email',
            {
              emailId: email.id,
              recipient: email.recipient,
              subject: email.subject,
              scheduledAt: email.scheduledAt.toISOString(),
            },
            {
              jobId: `email-${email.id}-recover-${Date.now()}`,
              delay: 0, // Process immediately
            }
          );

          await prisma.email.update({
            where: { id: email.id },
            data: { bullmqJobId: job.id },
          }).catch(() => {});

          enqueuedCount++;
          console.log(`[SchedulerRecovery] Enqueued past-due email ${email.id} (recipient: ${email.recipient})`);
        } catch (err: any) {
          console.error(`[SchedulerRecovery] Failed to enqueue past-due email ${email.id}:`, err.message);
        }
      }

      return enqueuedCount;
    } catch (error: any) {
      console.error('[SchedulerRecovery] Exception during stale email recovery:', error.message);
      return 0;
    }
  }
}
