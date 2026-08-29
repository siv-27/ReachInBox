import app from './app';
import { config } from './config/env';
import { prisma } from './config/database';
import { redisConnection } from './config/redis';

const port = config.port || 5000;

const server = app.listen(port, () => {
  console.log(`[Server] Running on http://localhost:${port}`);
});

async function gracefulShutdown(signal: string) {
  console.log(`[Server] Received ${signal}. Starting graceful shutdown...`);

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
