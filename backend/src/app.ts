import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { errorMiddleware } from './middleware/errorMiddleware';
import { prisma } from './config/database';
import { config } from './config/env';
import { checkRedisHealth } from './config/redis';
import authRoutes from './routes/authRoutes';
import emailRoutes from './routes/emailRoutes';
import slackRoutes from './routes/slackRoutes';
import queueRoutes from './routes/queueRoutes';

const app = express();

// Configure CORS to only allow our frontend, enabling cookie credentials exchange.
app.use(cors({
  origin: config.frontendUrl,
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Auth routes
app.use('/api/auth', authRoutes);

// Email scheduling routes (Phase 4)
app.use('/api/emails', emailRoutes);

// Slack integration routes (Phase 6)
app.use('/api/slack', slackRoutes);

// Queue dashboard routes (Phase 8)
app.use('/api/queue', queueRoutes);

// Development-only: Phase 3 test queue route (not used for production email flow)
if (process.env.NODE_ENV !== 'production') {
  import('./routes/testQueueRoutes').then((mod) => {
    app.use('/api/test', mod.default);
    console.log('[App] Test queue route loaded (development only)');
  });
}

// Health route checking database and Redis connectivity
app.get('/health', async (req, res, next) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    const redisHealthy = await checkRedisHealth();

    res.json({
      status: 'ok',
      database: 'connected',
      redis: redisHealthy ? 'connected' : 'disconnected',
      bullmq: redisHealthy ? 'ready' : 'unavailable',
    });
  } catch (error) {
    next(error);
  }
});

// Centralized error handler
app.use(errorMiddleware);

export default app;
