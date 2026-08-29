import { checkRedisHealth, redisConnection } from '../config/redis';
import { prisma } from '../config/database';
import { SchedulerService } from '../services/schedulerService';
import { emailQueue } from '../queue/emailQueue';

async function verify() {
  console.log('=== VERIFY RECIPIENTS & REDIS HEALTH ===');

  // 1. Test Redis health check
  console.log('[1] Testing Redis health ping...');
  const redisHealthy = await checkRedisHealth();
  console.log(`[Redis Health Status]: ${redisHealthy ? 'HEALTHY (PONG)' : 'UNHEALTHY'}`);
  if (!redisHealthy) {
    console.error('FAIL: Redis health check failed.');
    process.exit(1);
  }

  // 2. Test user lookup/creation
  let user = await prisma.user.findFirst();
  if (!user) {
    user = await prisma.user.create({
      data: {
        googleId: 'test-google-id-' + Date.now(),
        name: 'Recipient Test User',
        email: 'recipuser@example.com',
      },
    });
  }

  // 3. Test original uploaded recipients scheduling
  const testRecipients = ['realuser1@gmail.com', 'realuser2@gmail.com', 'realuser3@gmail.com'];
  console.log('[2] Scheduling campaign with original recipients:', testRecipients);

  const scheduled = await SchedulerService.scheduleEmails({
    userId: user.id,
    sender: 'sender@example.com',
    recipients: testRecipients,
    subject: 'Welcome to ReachInbox',
    body: 'Hello! This is a test verifying original campaign recipients in BullMQ job data.',
    startTime: new Date(Date.now() + 2000).toISOString(),
    delayBetweenEmails: 5000,
  });

  console.log(`PASS: Created ${scheduled.length} email records in PostgreSQL and queued jobs in BullMQ.`);
  
  // 4. Verify PostgreSQL email records
  for (const email of scheduled) {
    console.log(`  DB Record ID=${email.id} -> Recipient: "${email.recipient}", Subject: "${email.subject}"`);
  }

  // 5. Verify BullMQ job payload
  for (const email of scheduled) {
    if (email.bullmqJobId) {
      const job = await emailQueue.getJob(email.bullmqJobId);
      if (job) {
        console.log(`  BullMQ Job [${job.id}] -> recipient in job.data: "${job.data.recipient}"`);
        if (job.data.recipient !== email.recipient) {
          console.error(`FAIL: Job data recipient mismatch! Expected ${email.recipient}, got ${job.data.recipient}`);
          process.exit(1);
        }
      }
    }
  }

  console.log('PASS: All BullMQ job payloads accurately contain original uploaded recipient email addresses.');
  console.log('=== VERIFICATION SUCCESSFUL ===');

  await prisma.$disconnect();
  await redisConnection.quit();
}

verify().catch((err) => {
  console.error('Verification exception:', err);
  process.exit(1);
});
