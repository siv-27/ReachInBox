import { prisma } from '../config/database';
import { SchedulerService } from '../services/schedulerService';
import { emailQueue } from '../queue/emailQueue';

async function testCampaign() {
  console.log('=== TEST SMALL OUTREACH CAMPAIGN ===');

  // 1. Get or create test user
  let user = await prisma.user.findFirst();
  if (!user) {
    user = await prisma.user.create({
      data: {
        googleId: 'test-google-id-' + Date.now(),
        name: 'Test Campaign User',
        email: 'testuser@example.com',
      },
    });
  }

  const recipients = ['testrecip1@example.com', 'testrecip2@example.com', 'testrecip3@example.com'];
  const delayMs = 30000; // 30 seconds send stagger
  const startTime = new Date(Date.now() + 2000).toISOString();

  console.log(`[Campaign] Scheduling ${recipients.length} emails with launch time in 2s, stagger = 30s...`);

  const scheduled = await SchedulerService.scheduleEmails({
    userId: user.id,
    sender: 'testsender@example.com',
    recipients,
    subject: 'Small Campaign Test - ReachInbox',
    body: 'Hello, this is a test email verifying BullMQ queue flow and status updates.',
    startTime,
    delayBetweenEmails: delayMs,
  });

  console.log(`PASS: Created ${scheduled.length} email records in PostgreSQL and queued jobs in BullMQ.`);
  scheduled.forEach((item, idx) => {
    console.log(`  Email [${idx + 1}]: ID=${item.id}, Recipient=${item.recipient}, Status=${item.status}`);
  });

  // Check BullMQ Job Counts
  const counts = await emailQueue.getJobCounts();
  console.log('[BullMQ Queue State]:', counts);

  console.log('=== TEST CAMPAIGN CREATION COMPLETE ===');
  await prisma.$disconnect();
}

testCampaign().catch((err) => {
  console.error('Test campaign exception:', err);
  process.exit(1);
});
