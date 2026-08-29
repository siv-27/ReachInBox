import { prisma } from '../config/database';
import { SchedulerService } from '../services/schedulerService';

async function main() {
  const user = await prisma.user.upsert({
    where: { googleId: 'test-phase7-userA' },
    update: {},
    create: {
      googleId: 'test-phase7-userA',
      name: 'Phase7 UserA',
      email: 'usera@example.com',
    },
  });

  console.log('Scheduling verification job...');
  const scheduled = await SchedulerService.scheduleEmails({
    userId: user.id,
    sender: 'sender-verification@example.com',
    recipients: ['recipient-verification@gmail.com'],
    subject: 'Worker verification check',
    body: 'Verifying that worker processes this job successfully.',
    startTime: new Date().toISOString(),
    delayBetweenEmails: 0,
  });

  console.log(`Verification job scheduled with email ID: ${scheduled[0].id}`);
  await prisma.$disconnect();
  process.exit(0);
}

main().catch(console.error);
