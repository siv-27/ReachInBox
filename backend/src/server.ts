import app from './app';
import { config } from './config/env';
import { prisma } from './config/database';
import { redisConnection } from './config/redis';
import { startEmailWorker } from './queue/emailWorker';
import { SchedulerService } from './services/schedulerService';

const port = config.port || 5000;

// Initialize BullMQ worker inside the server process unless explicitly disabled
let workerInstance: ReturnType<typeof startEmailWorker> | null = null;
if (process.env.DISABLE_SERVER_WORKER !== 'true') {
  console.log('[Server] Initializing embedded BullMQ Email Worker...');
  workerInstance = startEmailWorker();
}

// Run stale scheduled email recovery check on startup
SchedulerService.recoverStaleScheduledEmails().catch((err) => {
  console.error('[Server] Initial stale email recovery error:', err.message);
});

// Periodic stale scheduled email recovery check (every 30 seconds)
const recoveryInterval = setInterval(() => {
  SchedulerService.recoverStaleScheduledEmails().catch((err) => {
    console.error('[Server] Periodic stale email recovery error:', err.message);
  });
}, 30000);

const server = app.listen(port, () => {
  console.log(`[Server] Running on http://localhost:${port}`);
});

async function gracefulShutdown(signal: string) {
  console.log(`[Server] Received ${signal}. Starting graceful shutdown...`);

  clearInterval(recoveryInterval);

  if (workerInstance) {
    try {
      await workerInstance.close();
      console.log('[Server] Email Worker closed safely');
    } catch (err) {
      console.error('[Server] Worker shutdown error:', err);
    }
  }

  server.close(async () => {
    console.log('[Server] HTTP server closed');
    try {
      // Disconnect Redis
      await redisConnection.quit();
      console.log('[Server] Redis connection closed');

      // Disconnect Prisma
      await prisma.$disconnect();
      console.log('[Server] Database connection closed');

      process.exit(0);
    } catch (error) {
      console.error('[Server] Error during graceful shutdown:', error);
      process.exit(1);
    }
  });
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
