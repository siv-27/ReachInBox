import { config } from '../config/env';

export const QUEUE_NAME = 'email-queue';

export const queueConfig = {
  name: QUEUE_NAME,
  concurrency: config.workerConcurrency,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 15000, // 15s initial exponential backoff for rate-limit retries
    },
    removeOnComplete: true, // Remove completed jobs from Redis to keep queue clean
    removeOnFail: false,    // Keep failed jobs for status inspection & reporting
  },
};
