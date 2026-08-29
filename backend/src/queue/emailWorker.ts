import { Worker, Job } from 'bullmq';
import { createRedisConnection } from '../config/redis';
import { queueConfig } from './queueConfig';
import { EmailJobData, emailQueue } from './emailQueue';
import { prisma } from '../config/database';
import { EmailService } from '../services/emailService';
import { RateLimitService } from '../services/rateLimitService';
import { SlackService } from '../services/slackService';
import { config } from '../config/env';
import { ElasticsearchService } from '../services/elasticsearchService';

/**
 * Real email sender job processor with concurrent-safe rate limiting,
 * send delay throttling, idempotency gates, and retry policies.
 */
export async function sendEmailProcessor(job: Job<EmailJobData>): Promise<void> {
  const { emailId } = job.data;
  console.log(`[EmailWorker] Job received: ${job.id} (attempt ${job.attemptsMade + 1}) for email ID: ${emailId}`);

  // Fetch the email record from PostgreSQL to inspect current state
  let email;
  try {
    email = await prisma.email.findUnique({
      where: { id: emailId },
    });
  } catch (dbErr: any) {
    console.error(`[EmailWorker] Database query failed for email ${emailId}:`, dbErr.message);
    throw dbErr; // Let BullMQ retry when database connection recovers
  }

  if (!email) {
    console.warn(`[EmailWorker] Job aborted. Email record not found in database for ID: ${emailId}`);
    return;
  }

  // Idempotency: only process if status is SCHEDULED
  if (email.status !== 'SCHEDULED') {
    console.log(`[EmailWorker] Idempotency: Email ${emailId} is in status ${email.status}. Skipping.`);
    return;
  }

  // 1. Run Rate Limiting / Send Throttling check (atomic Redis Lua gate)
  const limitResult = await RateLimitService.checkAndReserve(email.sender);
  
  if (!limitResult.allowed) {
    const delay = limitResult.rescheduleDelayMs || 5000;
    console.log(`[EmailWorker] Email ${emailId} is throttled due to ${limitResult.reason}. Rescheduling in ${delay}ms...`);
    
    // If throttled due to reaching the hourly rate limit, fire a Slack alert (deduplicated via Redis)
    if (limitResult.reason === 'RATE_LIMIT') {
      try {
        const locked = await RateLimitService.acquireAlertLock(email.sender);
        if (locked) {
          console.log(`[EmailWorker] Sender ${email.sender} hit hourly quota. Initiating Slack notification dispatcher.`);
          SlackService.postMessage(email.userId, email.sender, config.maxEmailsPerHour).catch((err) => {
            console.error('[EmailWorker] Slack notification dispatcher failed:', err);
          });
        }
      } catch (err) {
        console.error('[EmailWorker] Slack alert lock check failed (ignored):', err);
      }
    }

    // Reschedule in BullMQ using a unique jobId suffix to prevent removeOnComplete collisions
    await emailQueue.add(
      'send-email',
      {
        emailId: email.id,
        recipient: email.recipient,
        subject: email.subject,
        scheduledAt: email.scheduledAt.toISOString(),
      },
      {
        jobId: `email-${email.id}-r-${Date.now()}`,
        delay,
      }
    );
    return; // Complete current job; rescheduled delayed job will pick it up later
  }

  // 2. Acquired rate limit slots! Transition PostgreSQL status from SCHEDULED to PROCESSING.
  console.log(`[EmailWorker] Updating email ${emailId}: SCHEDULED -> PROCESSING`);
  let updateResult;
  try {
    updateResult = await prisma.email.updateMany({
      where: {
        id: emailId,
        status: 'SCHEDULED',
      },
      data: {
        status: 'PROCESSING',
      },
    });
  } catch (dbErr: any) {
    console.error(`[EmailWorker] Database status update to PROCESSING failed for email ${emailId}:`, dbErr.message);
    await RateLimitService.releaseSlot(email.sender).catch(() => {});
    throw dbErr;
  }

  if (updateResult.count === 0) {
    console.warn(`[EmailWorker] Idempotency: Email ${emailId} was claimed concurrently. Releasing slot.`);
    await RateLimitService.releaseSlot(email.sender).catch(() => {});
    return;
  }

  // Update in Elasticsearch (non-blocking async call)
  ElasticsearchService.updateEmailStatus(emailId, 'PROCESSING').catch(() => {});

  // Calculate if this is the final attempt allowed by BullMQ
  const maxAttempts = job.opts.attempts || queueConfig.defaultJobOptions.attempts;
  const isFinalAttempt = (job.attemptsMade + 1) >= maxAttempts;

  try {
    // 3. Dispatch the email via SMTP provider
    console.log(`[EmailWorker] Dispatching email ${emailId} to ${email.recipient}`);
    const sendResult = await EmailService.sendEmail(
      email.sender,
      email.recipient,
      email.subject,
      email.body
    );

    console.log(`[EmailWorker] Email sent successfully to ${email.recipient}`);

    // 4. Mark the email as SENT in PostgreSQL
    await prisma.email.update({
      where: { id: emailId },
      data: {
        status: 'SENT',
        sentAt: new Date(),
        messageId: sendResult.messageId,
        previewUrl: sendResult.previewUrl,
        error: null,
      },
    });

    console.log(`[EmailWorker] Email status updated: PROCESSING -> SENT`);

    // Update in Elasticsearch (non-blocking async call)
    ElasticsearchService.updateEmailStatus(emailId, 'SENT', { sentAt: new Date().toISOString() }).catch(() => {});

    console.log(`[EmailWorker] Job ${job.id} completed successfully. Preview URL: ${sendResult.previewUrl || 'none'}`);
  } catch (error: any) {
    const isRateLimited = error.message?.includes('429') || error.message?.toLowerCase().includes('rate limit');
    console.error(`[EmailWorker] Error sending email ${emailId} (attempt ${job.attemptsMade + 1}):`, error.message);

    // Revert the reserved rate-limit slot since the send failed
    console.log(`[EmailWorker] Releasing rate limit slot for sender ${email.sender} due to exception.`);
    await RateLimitService.releaseSlot(email.sender).catch(() => {});

    if (isFinalAttempt) {
      // Final attempt failed: transition PostgreSQL status permanently to FAILED
      await prisma.email.update({
        where: { id: emailId },
        data: {
          status: 'FAILED',
          failedAt: new Date(),
          error: error.message || 'SMTP sending failed permanently',
        },
      }).catch((dbErr) => console.error('[EmailWorker] Failed to update status to FAILED:', dbErr));

      // Update in Elasticsearch (non-blocking async call)
      ElasticsearchService.updateEmailStatus(emailId, 'FAILED', { sentAt: null }).catch(() => {});

      console.log(`[EmailWorker] Email ${emailId} status updated: PROCESSING -> FAILED after max retries.`);
    } else {
      // Temporary failure (including 429 rate limit): reset status to SCHEDULED for worker retry backoff
      const errDetail = isRateLimited
        ? `Rate limited by provider (attempt ${job.attemptsMade + 1}/${maxAttempts}): ${error.message}`
        : `Temporary SMTP error: ${error.message || 'SMTP failed'}`;

      await prisma.email.update({
        where: { id: emailId },
        data: {
          status: 'SCHEDULED',
          error: errDetail,
        },
      }).catch((dbErr) => console.error('[EmailWorker] Failed to update status to SCHEDULED:', dbErr));

      // Update in Elasticsearch (non-blocking async call)
      ElasticsearchService.updateEmailStatus(emailId, 'SCHEDULED').catch(() => {});

      console.log(`[EmailWorker] Email ${emailId} reset to SCHEDULED state for worker retry.`);
    }

    // Rethrow error so BullMQ handles exponential backoff delay before next retry
    throw error;
  }
}

/**
 * Instantiate and start the worker process
 */
export function startEmailWorker() {
  const worker = new Worker<EmailJobData>(
    queueConfig.name,
    sendEmailProcessor,
    {
      connection: createRedisConnection(),
      concurrency: queueConfig.concurrency,
    }
  );

  worker.on('ready', () => {
    console.log(`[EmailWorker] Connected. Queue: ${queueConfig.name}. Concurrency: ${queueConfig.concurrency}`);
  });

  worker.on('active', (job) => {
    console.log(`[EmailWorker] Job active: ${job.id}`);
  });

  worker.on('completed', (job) => {
    console.log(`[EmailWorker] Job completed: ${job.id}`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[EmailWorker] Job failed: ${job?.id}. Error: ${err?.message}`);
  });

  return worker;
}
