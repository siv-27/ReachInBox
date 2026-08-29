import { prisma } from '../config/database';
import { SchedulerService } from '../services/schedulerService';
import { startEmailWorker } from '../queue/emailWorker';
import { redisConnection } from '../config/redis';

async function testEndToEnd() {
  console.log('=== END-TO-END SCHEDULED EMAIL TEST ===');

  // 1. Recover any past-due scheduled emails
  console.log('[1] Running stale scheduled email recovery check...');
  const recoveredCount = await SchedulerService.recoverStaleScheduledEmails();
  console.log(`[Stale Recovery]: Re-enqueued ${recoveredCount} past-due scheduled emails.`);

  // 2. Lookup/create test user
  let user = await prisma.user.findFirst();
  if (!user) {
    user = await prisma.user.create({
      data: {
        googleId: 'test-e2e-id-' + Date.now(),
        name: 'E2E Test User',
        email: 'e2euser@example.com',
      },
    });
  }

  // 3. Schedule a new email 5 seconds in the future
  const launchTime = new Date(Date.now() + 5000).toISOString();
  console.log(`[2] Scheduling new campaign for launch time: ${launchTime} (5 seconds in the future)...`);

  const scheduled = await SchedulerService.scheduleEmails({
    userId: user.id,
    sender: 'sender@example.com',
    recipients: ['e2etestrecip@example.com'],
    subject: 'ReachInbox Scheduler Test',
    body: 'Hello, this is an automated end-to-end scheduled email dispatch test.',
    startTime: launchTime,
    delayBetweenEmails: 1000,
  });

  const targetEmailId = scheduled[0].id;
  console.log(`PASS: Scheduled email created in DB with ID: ${targetEmailId}`);

  // 4. Start BullMQ worker process and wait for dispatch
  console.log('[3] Starting BullMQ Email Worker to process scheduled execution...');
  const worker = startEmailWorker();

  console.log('Waiting 8 seconds for scheduled launch time to pass...');
  await new Promise((resolve) => setTimeout(resolve, 8000));

  // 5. Inspect final PostgreSQL status
  const updatedRecord = await prisma.email.findUnique({
    where: { id: targetEmailId },
  });

  console.log('[4] Verifying final PostgreSQL status:');
  console.log(`  Email ID: ${updatedRecord?.id}`);
  console.log(`  Recipient: ${updatedRecord?.recipient}`);
  console.log(`  ScheduledAt: ${updatedRecord?.scheduledAt.toISOString()}`);
  console.log(`  SentAt: ${updatedRecord?.sentAt ? updatedRecord.sentAt.toISOString() : 'none'}`);
  console.log(`  Status: ${updatedRecord?.status}`);
  console.log(`  Preview URL: ${updatedRecord?.previewUrl || 'none'}`);

  if (updatedRecord?.status !== 'SENT') {
    console.error(`FAIL: Email status is ${updatedRecord?.status}, expected SENT.`);
    await worker.close();
    process.exit(1);
  }

  console.log('PASS: Email status transitioned from SCHEDULED -> PROCESSING -> SENT successfully!');
  console.log('=== END-TO-END TEST SUCCESSFUL ===');

  await worker.close();
  await prisma.$disconnect();
  await redisConnection.quit();
}

testEndToEnd().catch((err) => {
  console.error('E2E Test exception:', err);
  process.exit(1);
});
