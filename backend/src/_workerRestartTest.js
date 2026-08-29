const jwt = require('jsonwebtoken');
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  const u = await p.user.findFirst({where:{googleId:'test-phase4-user'}});
  const t = jwt.sign({userId:u.id}, process.env.JWT_SECRET, {expiresIn:'1h'});
  
  console.log('=== TEST 5: WORKER RESTART ===');
  
  // Schedule email 25s in the future
  const startTime = new Date(Date.now() + 25000).toISOString();
  console.log('Step 1: Scheduling email at ' + startTime);
  
  let r = await fetch('http://localhost:5000/api/emails/schedule', {
    method: 'POST',
    headers: {'Content-Type': 'application/json', Cookie: 'token=' + t},
    body: JSON.stringify({
      sender: 'restart@test.com',
      recipients: ['restart-recipient@test.com'],
      subject: 'Worker Restart Test',
      body: 'This email should survive a worker restart',
      startTime: startTime,
      delayBetweenEmails: 0,
    }),
  });
  const data = await r.json();
  console.log('Step 2: Email scheduled. id=' + data.scheduled[0].id + ' jobId=' + data.scheduled[0].jobId);
  
  // Check DB state
  const email = await p.email.findUnique({where:{id:data.scheduled[0].id}});
  console.log('Step 3: DB status=' + email.status + ' scheduledAt=' + email.scheduledAt.toISOString());
  
  console.log('\nNOW: Stop the worker process, wait 30 seconds, then restart it.');
  console.log('The email should be processed after the worker restarts.');
  console.log('Email ID to check: ' + data.scheduled[0].id);
  
  await p.$disconnect();
}
main().catch(e => console.error(e));
