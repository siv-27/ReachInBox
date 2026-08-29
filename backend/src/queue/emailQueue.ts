import { Queue } from 'bullmq';
import { createRedisConnection } from '../config/redis';
import { queueConfig } from './queueConfig';

export interface EmailJobData {
  emailId: string;
  recipient?: string;
  subject?: string;
  scheduledAt?: string;
}

export const emailQueue = new Queue<EmailJobData>(queueConfig.name, {
  connection: createRedisConnection(),
  defaultJobOptions: queueConfig.defaultJobOptions,
});

console.log(`[Queue] ${queueConfig.name} initialized successfully`);
