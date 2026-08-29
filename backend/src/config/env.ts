import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  databaseUrl: process.env.DATABASE_URL || '',
  directUrl: process.env.DIRECT_URL || '',
  redisUrl: process.env.REDIS_URL || '',
  elasticsearchUrl: process.env.ELASTICSEARCH_URL || '',
  elasticsearchApiKey: process.env.ELASTICSEARCH_API_KEY || '',
  googleClientId: process.env.GOOGLE_CLIENT_ID || '',
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
  googleCallbackUrl: process.env.GOOGLE_CALLBACK_URL || '',
  jwtSecret: process.env.JWT_SECRET || 'fallback-secret-key-change-in-prod',
  etherealHost: process.env.ETHEREAL_HOST || '',
  etherealPort: parseInt(process.env.ETHEREAL_PORT || '587', 10),
  etherealUser: process.env.ETHEREAL_USER || '',
  etherealPassword: process.env.ETHEREAL_PASSWORD || '',
  slackClientId: process.env.SLACK_CLIENT_ID || '',
  slackClientSecret: process.env.SLACK_CLIENT_SECRET || '',
  slackRedirectUri: process.env.SLACK_REDIRECT_URI || '',
  workerConcurrency: parseInt(process.env.WORKER_CONCURRENCY || '5', 10),
  minDelayBetweenEmailsMs: parseInt(process.env.MIN_DELAY_BETWEEN_EMAILS_MS || '2000', 10),
  maxEmailsPerHour: parseInt(process.env.MAX_EMAILS_PER_HOUR || '200', 10),
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
};
