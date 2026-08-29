/**
 * Phase 5 - Comprehensive Rate Limiting and Concurrency Test Suite
 */
import { Queue } from 'bullmq';
import jwt from 'jsonwebtoken';
import { prisma } from './config/database';
import { createRedisConnection, redisConnection } from './config/redis';
import { config } from './config/env';
import { queueConfig } from './queue/queueConfig';

function log(msg: string) {
  const ts = new Date().toISOString().substr(11, 12);
  console.log(`[${ts}] ${msg}`);
}

async function createTestUser() {
  const user = await prisma.user.upsert({
    where: { googleId: 'test-phase5-user' },
    update: {},
    create: {
      googleId: 'test-phase5-user',
      name: 'Phase5 Test User',
      email: 'phase5test@example.com',
    },
  });
  log(`Test user: id=${user.id} email=${user.email}`);
  return user;
}

function makeToken(userId: string): string {
  return jwt.sign({ userId }, config.jwtSecret, { expiresIn: '1h' });
}

async function apiCall(method: string, path: string, token: string, body?: any) {
  const url = `http://localhost:5000${path}`;
  const opts: any = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Cookie': `token=${token}`,
    },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  const data: any = await res.json();
  return { status: res.status, data };
}

/**
 * Pings database and Redis periodically during waits to prevent firewalls from dropping idle sockets
 */
async function keepAliveWait(ms: number) {
  const interval = 2000;
  const steps = Math.ceil(ms / interval);
  for (let i = 0; i < steps; i++) {
    await new Promise((resolve) => setTimeout(resolve, interval));
    try {
      await prisma.$queryRaw`SELECT 1`;
      await redisConnection.ping();
    } catch (e) {
      // Ignore temporary connection failures
    }
  }
}

async function run() {
  log('=== PHASE 5 TEST SUITE ===\n');

  // Setup
  const user = await createTestUser();
  const token = makeToken(user.id);

  // Clean up any previous test emails
  await prisma.email.deleteMany({ where: { userId: user.id } });

  // Clear Redis rate limit keys to ensure a clean slate
  const qConn = createRedisConnection();
  const queue = new Queue(queueConfig.name, { connection: qConn });
  
  log('Clearing Redis rate-limit and delay keys...');
  const keys = await redisConnection.keys('email_rate_limit:*');
  for (const k of keys) {
    await redisConnection.del(k);
  }
  await redisConnection.del('email_scheduler:next_allowed_send_time');
  await queue.drain(true);

  // Print active limits from configuration
  log(`Configuration Limits:`);
  log(`  WORKER_CONCURRENCY: ${config.workerConcurrency}`);
  log(`  MIN_DELAY_BETWEEN_EMAILS_MS: ${config.minDelayBetweenEmailsMs}ms`);
  log(`  MAX_EMAILS_PER_HOUR: ${config.maxEmailsPerHour}`);

  // ================================================================
  // TEST A: Concurrency and Minimum Send Delay
  // ================================================================
  log('\n--- TEST A: Concurrency & Minimum Send Delay ---');
  log(`Scheduling 3 emails close together. The minimum delay (${config.minDelayBetweenEmailsMs}ms) must stagger them, even if processed concurrently.`);
  
  const startTime = new Date(Date.now() + 8000).toISOString(); 
  const r = await apiCall('POST', '/api/emails/schedule', token, {
    sender: 'senderA@example.com',
    recipients: ['rec1@example.com', 'rec2@example.com', 'rec3@example.com'],
    subject: 'Concurrency & Delay Test',
    body: 'Testing send staggers and delay locks',
    startTime,
    delayBetweenEmails: 0,
  });

  log(`Schedule 3 emails: status=${r.status} count=${r.data.count}`);

  log('Waiting for worker to process the emails (polling dynamically up to 30s)...');
  let testAPassed = false;
  for (let i = 0; i < 15; i++) {
    await keepAliveWait(2000);
    const count = await prisma.email.count({
      where: { userId: user.id, subject: 'Concurrency & Delay Test', status: 'SENT' }
    });
    if (count === 3) {
      testAPassed = true;
      break;
    }
  }

  // Retrieve processed emails
  const emails = await prisma.email.findMany({
    where: { userId: user.id, subject: 'Concurrency & Delay Test' },
    orderBy: { sentAt: 'asc' },
  });

  log(`DB records sent state:`);
  for (const e of emails) {
    log(`  ${e.recipient} status=${e.status} sentAt=${e.sentAt?.toISOString()}`);
  }

  if (testAPassed && emails.length === 3) {
    const diff1 = emails[1].sentAt!.getTime() - emails[0].sentAt!.getTime();
    const diff2 = emails[2].sentAt!.getTime() - emails[1].sentAt!.getTime();
    log(`  Delay between send 1 and 2: ${diff1}ms`);
    log(`  Delay between send 2 and 3: ${diff2}ms`);

    const expectedDelay = config.minDelayBetweenEmailsMs - 250;
    if (diff1 >= expectedDelay && diff2 >= expectedDelay) {
      log('  PASS: Minimum delay stagger was strictly enforced across concurrent worker passes.');
    } else {
      log('  FAIL: Sends occurred too close together.');
    }
  } else {
    log('  FAIL: Not all emails were sent successfully in time.');
  }

  // ================================================================
  // TEST B: Hourly Rate Limit & Rescheduling
  // ================================================================
  log('\n--- TEST B: Hourly Rate Limit & Rescheduling ---');
  log(`The max emails per hour limit is ${config.maxEmailsPerHour}. We will schedule enough emails to exceed it, verifying excess jobs are rescheduled rather than failed.`);

  // Cleanup DB of Test A emails so we can count Test B separately
  await prisma.email.deleteMany({ where: { userId: user.id } });
  await queue.drain(true);
  
  // Reset rate limits keys
  const keys2 = await redisConnection.keys('email_rate_limit:*');
  for (const k of keys2) {
    await redisConnection.del(k);
  }
  await redisConnection.del('email_scheduler:next_allowed_send_time');

  // Let's schedule (MAX_EMAILS_PER_HOUR + 1) emails for senderA
  const targetCount = config.maxEmailsPerHour + 1;
  const recipients = [];
  for (let i = 1; i <= targetCount; i++) {
    recipients.push(`exceed${i}@example.com`);
  }

  log(`Scheduling ${targetCount} emails for senderA@example.com (limit is ${config.maxEmailsPerHour})...`);
  const r2 = await apiCall('POST', '/api/emails/schedule', token, {
    sender: 'senderA@example.com',
    recipients,
    subject: 'Rate Limit Test',
    body: 'Testing hourly limit thresholds',
    startTime: new Date(Date.now() + 8000).toISOString(),
    delayBetweenEmails: 100,
  });

  log(`Schedule status=${r2.status} count=${r2.data.count}`);

  log('Waiting for worker to process what it can (polling dynamically up to 40s)...');
  for (let i = 0; i < 20; i++) {
    await keepAliveWait(2000);
    const sent = await prisma.email.count({
      where: { userId: user.id, sender: 'senderA@example.com', status: 'SENT' }
    });
    if (sent === config.maxEmailsPerHour) {
      break;
    }
  }

  // Retrieve current database stats
  const dbSentCount = await prisma.email.count({
    where: { userId: user.id, sender: 'senderA@example.com', status: 'SENT' },
  });
  const dbScheduledCount = await prisma.email.count({
    where: { userId: user.id, sender: 'senderA@example.com', status: 'SCHEDULED' },
  });

  log(`Database Stats:`);
  log(`  Emails SENT: ${dbSentCount} (Expected: ${config.maxEmailsPerHour})`);
  log(`  Emails still SCHEDULED: ${dbScheduledCount} (Expected: 1)`);

  if (dbSentCount === config.maxEmailsPerHour && dbScheduledCount === 1) {
    log('  PASS: Hourly rate limit enforced. Excess email remains in SCHEDULED state.');
  } else {
    log('  FAIL: Rate limiting counts mismatched.');
  }

  // Verify the rescheduled job exists in BullMQ delayed state
  const delayedJobs = await queue.getDelayed();
  const rescheduledJob = delayedJobs.find(j => j.id?.startsWith('email-'));
  log(`BullMQ delayed queue count: ${delayedJobs.length}`);
  if (rescheduledJob) {
    const delayRemaining = rescheduledJob.opts.delay || 0;
    log(`  Rescheduled Job ID: ${rescheduledJob.id}`);
    log(`  Delay configured: ${delayRemaining}ms (~${Math.round(delayRemaining / 60000)} minutes remaining)`);
    if (delayRemaining > 0 && delayRemaining <= 3600000) {
      log('  PASS: Throttled email successfully rescheduled into the next hour window.');
    } else {
      log('  FAIL: Reschedule delay invalid.');
    }
  } else {
    log('  FAIL: No rescheduled job found in delayed queue.');
  }

  // ================================================================
  // TEST C: Multiple Senders Isolation
  // ================================================================
  log('\n--- TEST C: Multiple Senders Isolation ---');
  log('senderA@example.com is currently fully rate-limited. senderB@example.com should still be allowed to send emails instantly.');

  const r3 = await apiCall('POST', '/api/emails/schedule', token, {
    sender: 'senderB@example.com',
    recipients: ['senderb-recipient@example.com'],
    subject: 'Sender B Isolation Test',
    body: 'This should deliver immediately despite senderA limits',
    startTime: new Date(Date.now() + 5000).toISOString(),
    delayBetweenEmails: 0,
  });

  log(`Schedule senderB status=${r3.status} count=${r3.data.count}`);
  
  log('Waiting dynamically up to 15s for worker to process senderB...');
  for (let i = 0; i < 8; i++) {
    await keepAliveWait(2000);
    const count = await prisma.email.count({
      where: { userId: user.id, sender: 'senderB@example.com', status: 'SENT' }
    });
    if (count === 1) {
      break;
    }
  }

  const senderBEmail = await prisma.email.findFirst({
    where: { userId: user.id, sender: 'senderB@example.com' },
  });

  log(`senderB email status in DB: ${senderBEmail?.status}`);
  if (senderBEmail?.status === 'SENT') {
    log('  PASS: Multiple senders maintain isolated hourly limits successfully.');
  } else {
    log('  FAIL: senderB was incorrectly throttled or failed.');
  }

  // Cleanup
  await queue.close();
  await qConn.quit();
  log('\n=== PHASE 5 TEST SUITE COMPLETE ===');
  await prisma.$disconnect();
  process.exit(0);
}

run().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});
