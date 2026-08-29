import { startEmailWorker } from './queue/emailWorker';
import { prisma } from './config/database';
import { redisConnection } from './config/redis';

console.log('[Worker Process] Starting email worker process...');

const worker = startEmailWorker();

async function gracefulShutdown(signal: string) {
  console.log(`[Worker Process] Received ${signal}. Initiating graceful shutdown...`);
  
  try {
    // Stop accepting new jobs and wait for current jobs to complete
    await worker.close();
    console.log('[Worker Process] Worker closed successfully');

    // Close shared redis connections
    await redisConnection.quit();
    console.log('[Worker Process] Redis connection closed');

    // Disconnect Prisma PostgreSQL client
    await prisma.$disconnect();
    console.log('[Worker Process] Database connection closed');

    process.exit(0);
  } catch (error) {
    console.error('[Worker Process] Error during graceful shutdown:', error);
    process.exit(1);
  }
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
