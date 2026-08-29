import { prisma } from '../config/database';
import { SchedulerService } from '../services/schedulerService';
import { startEmailWorker } from '../queue/emailWorker';
import { redisConnection } from '../config/redis';

async function testSingle() {
  console.log('=== TEST SINGLE EMAIL DISPATCH & STATUS TRANSITION ===');

  let user = await prisma.user.findFirst();
  if (!user) {
    user = await prisma.user.create({
      data: {
        googleId: 'test-single-id-' + Date.now(),
        name: 'Single Test User',
        email: 'singleuser@example.com',
      },
    });
  }

  const launchTime = new Date(Date.now() + 2000).toISOString();
  console.log(`[1] Scheduling email for launch time: ${launchTime} (2s in future)...`);

  const scheduled = await SchedulerService.scheduleEmails({
    userId: user.id,
    sender: 'sender@example.com',
    recipients: ['sivaswetha482@gmail.com'],
    subject: 'ReachInbox Scheduler Test - Single Dispatch',
    body: 'Verifying end-to-end status transition from SCHEDULED -> PROCESSING -> SENT.',
    startTime: launchTime,
    delayBetweenEmails: 0,
  });

  const emailId = scheduled[0].id;
  console.log(`PASS: Scheduled email created with ID: ${emailId}`);

  console.log('[2] Starting worker...');
  const worker = startEmailWorker();

  console.log('Waiting 6 seconds for dispatch...');
  await new Promise((resolve) => setTimeout(resolve, 6000));

  const updatedRecord = await prisma.email.findUnique({
    where: { id: emailId },
  });

  console.log('[3] Final status check:');
  console.log(`  Email ID: ${updatedRecord?.id}`);
  console.log(`  Recipient: ${updatedRecord?.recipient}`);
  console.log(`  Status: ${updatedRecord?.status}`);
  console.log(`  SentAt: ${updatedRecord?.sentAt ? updatedRecord.sentAt.toISOString() : 'none'}`);
  console.log(`  Preview URL: ${updatedRecord?.previewUrl || 'none'}`);

  if (updatedRecord?.status === 'SENT') {
    console.log('=== SUCCESS: Email transitioned to SENT! ===');
  } else {
    console.log(`Status is currently ${updatedRecord?.status}`);
  }

  await worker.close();
  await prisma.$disconnect();
  await redisConnection.quit();
}

testSingle().catch((err) => {
  console.error('Test exception:', err);
  process.exit(1);
});
