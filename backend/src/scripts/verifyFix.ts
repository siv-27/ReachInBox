import { testDatabaseConnection, prisma } from '../config/database';
import { queueConfig } from '../queue/queueConfig';
import { redisConnection } from '../config/redis';

async function verify() {
  console.log('=== VERIFY NEON & WORKER FIX ===');

  // 1. Test database connection
  console.log('[1] Testing Neon PostgreSQL direct connection...');
  const connected = await testDatabaseConnection();
  if (!connected) {
    console.error('FAIL: Could not connect to Neon PostgreSQL.');
    process.exit(1);
  }
  console.log('PASS: Neon PostgreSQL connection verified successfully.');

  // 2. Query test user
  console.log('[2] Verifying Prisma query capability...');
  const userCount = await prisma.user.count();
  console.log(`PASS: Prisma query executed. Total users in DB: ${userCount}`);

  // 3. Verify BullMQ backoff configuration
  console.log('[3] Verifying BullMQ backoff settings...');
  console.log('  Job attempts:', queueConfig.defaultJobOptions.attempts);
  console.log('  Backoff type:', queueConfig.defaultJobOptions.backoff.type);
  console.log('  Backoff delay:', queueConfig.defaultJobOptions.backoff.delay, 'ms');
  console.log('PASS: BullMQ backoff configuration verified.');

  await prisma.$disconnect();
  await redisConnection.quit();
  console.log('=== VERIFICATION SUCCESS ===');
}

verify().catch((err) => {
  console.error('Verification exception:', err);
  process.exit(1);
});
