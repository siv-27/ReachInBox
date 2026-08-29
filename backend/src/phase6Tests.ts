/**
 * Phase 6 - Slack Integration and Live Rate-Limit Notifications Test Suite
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
    where: { googleId: 'test-phase6-user' },
    update: {},
    create: {
      googleId: 'test-phase6-user',
      name: 'Phase6 Test User',
      email: 'phase6test@example.com',
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
    redirect: 'manual', // Do not automatically follow redirects so we can inspect headers
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  
  let data: any = null;
  const contentType = res.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    data = await res.json();
  }
  
  return { 
    status: res.status, 
    data, 
    headers: res.headers 
  };
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
  log('=== PHASE 6 TEST SUITE ===\n');

  // Setup
  const user = await createTestUser();
  const token = makeToken(user.id);

  // Clean up previous test connections and emails
  await prisma.slackConnection.deleteMany({ where: { userId: user.id } });
  await prisma.email.deleteMany({ where: { userId: user.id } });

  const qConn = createRedisConnection();
  const queue = new Queue(queueConfig.name, { connection: qConn });
  
  log('Clearing Redis rate-limits and keys...');
  const keys = await redisConnection.keys('email_rate_limit:*');
  const alertKeys = await redisConnection.keys('slack_alert_sent:*');
  for (const k of [...keys, ...alertKeys]) {
    await redisConnection.del(k);
  }
  await redisConnection.del('email_scheduler:next_allowed_send_time');
  await queue.drain(true);

  // ================================================================
  // TEST 1: OAuth Redirection Check
  // ================================================================
  log('\n--- TEST 1: Slack Connect OAuth Redirect ---');
  const r1 = await apiCall('GET', '/api/slack/connect', token);
  log(`Connect API status: ${r1.status}`);
  const redirectUrl = r1.headers.get('location');
  log(`Redirect URL: ${redirectUrl || 'none'}`);

  if (r1.status === 302 && redirectUrl && redirectUrl.startsWith('https://slack.com/oauth/v2/authorize')) {
    const urlObj = new URL(redirectUrl);
    const clientId = urlObj.searchParams.get('client_id');
    const scope = urlObj.searchParams.get('scope');
    const state = urlObj.searchParams.get('state');

    log(`  client_id present: ${!!clientId}`);
    log(`  scope requested: ${scope}`);
    log(`  state present: ${!!state}`);

    if (clientId && scope?.includes('chat:write') && state) {
      log('  PASS: Slack OAuth redirection URL generated correctly with strict CSRF state.');
    } else {
      log('  FAIL: Missing OAuth params.');
    }
  } else {
    log('  FAIL: Connect API did not redirect properly.');
  }

  // ================================================================
  // TEST 2: Status API (Disconnected State)
  // ================================================================
  log('\n--- TEST 2: Status API (Disconnected) ---');
  const r2 = await apiCall('GET', '/api/slack/status', token);
  log(`Status status: ${r2.status} connected: ${r2.data?.connected}`);
  if (r2.status === 200 && r2.data?.connected === false) {
    log('  PASS: Connection status correctly reports disconnected.');
  } else {
    log('  FAIL: Status should be disconnected.');
  }

  // ================================================================
  // TEST 3: Connection Callback simulation and Status Check
  // ================================================================
  log('\n--- TEST 3: Connection Storage & Status Check ---');
  
  // Directly write a connection to DB under the user ID to simulate callback success
  const testAccessToken = 'xoxb-dummy-test-token-to-verify-slack-alert-dispatches';
  const testTeamId = 'T_TEST_TEAM_ID';
  const testChannelId = 'C_TEST_CHANNEL_ID';

  await prisma.slackConnection.create({
    data: {
      userId: user.id,
      teamId: testTeamId,
      accessToken: testAccessToken,
      channelId: testChannelId,
    },
  });

  const r3 = await apiCall('GET', '/api/slack/status', token);
  log(`Status connected: ${r3.data?.connected} teamId: ${r3.data?.teamId} channelId: ${r3.data?.channelId}`);
  if (r3.status === 200 && r3.data?.connected === true && r3.data?.teamId === testTeamId) {
    log('  PASS: Slack workspace connection metadata successfully stored and queried.');
  } else {
    log('  FAIL: Connection check failed.');
  }

  // ================================================================
  // TEST 4: Rate Limit Alert and Revoked Token Handling
  // ================================================================
  log('\n--- TEST 4: Slack Notifications & Safe Token Revocations ---');
  log('Setting MAX_EMAILS_PER_HOUR=1. Email 1 succeeds. Email 2 will trigger rate limit, attempt Slack post, fail safely on dummy credentials, and clean up connection.');

  const startTime = new Date(Date.now() + 8000).toISOString(); 
  const r4 = await apiCall('POST', '/api/emails/schedule', token, {
    sender: 'senderA@example.com',
    recipients: ['recipient1@example.com', 'recipient2@example.com'], // 2 recipients to exceed limit=1
    subject: 'Slack Alert Test',
    body: 'Triggering Slack notifications on rate limit thresholds',
    startTime,
    delayBetweenEmails: 100,
  });

  log(`Schedule status: ${r4.status} count: ${r4.data?.count}`);

  log('Waiting 15s for worker execution...');
  await keepAliveWait(15000);

  // Retrieve emails
  const dbSentCount = await prisma.email.count({
    where: { userId: user.id, status: 'SENT' },
  });
  const dbScheduledCount = await prisma.email.count({
    where: { userId: user.id, status: 'SCHEDULED' },
  });

  log(`DB records stats: SENT=${dbSentCount} SCHEDULED=${dbScheduledCount}`);
  
  // Verify that the second job rescheduled successfully
  if (dbSentCount === 1 && dbScheduledCount === 1) {
    log('  PASS: Throttled email rescheduled successfully without failing the job on SMTP/Slack failures.');
  } else {
    log('  FAIL: Job state mismatched.');
  }

  // Verify that the Redis atomic alert lock key got created in Upstash
  const hourWindow = new Date().toISOString().substring(0, 13);
  const alertLockKey = `slack_alert_sent:sendera@example.com:${hourWindow}`;
  const alertLockExists = await redisConnection.exists(alertLockKey);
  log(`Redis alert lock key "${alertLockKey}" exists: ${!!alertLockExists}`);
  if (alertLockExists) {
    log('  PASS: Redis atomic alert lock successfully acquired, preventing channel spamming.');
  } else {
    log('  FAIL: Alert lock not found.');
  }

  // Verify that the connection was deleted due to token invalidation (xoxb-dummy-test-token)
  const afterConnection = await prisma.slackConnection.findFirst({
    where: { userId: user.id },
  });
  log(`Slack Connection in DB after invalid credentials error: ${afterConnection ? 'still exists' : 'purged (deleted)'}`);
  if (!afterConnection) {
    log('  PASS: Unusable/revoked Slack credentials safely cleaned up automatically.');
  } else {
    log('  FAIL: Invalid token connection should have been deleted.');
  }

  // ================================================================
  // TEST 5: Slack Disconnect API
  // ================================================================
  log('\n--- TEST 5: Slack Disconnect API ---');
  // Add a connection back so we can test disconnect
  await prisma.slackConnection.upsert({
    where: { userId_teamId: { userId: user.id, teamId: testTeamId } },
    update: { accessToken: testAccessToken },
    create: { userId: user.id, teamId: testTeamId, accessToken: testAccessToken },
  });

  const r5 = await apiCall('POST', '/api/slack/disconnect', token);
  log(`Disconnect API status: ${r5.status}`);
  const finalStatus = await apiCall('GET', '/api/slack/status', token);
  log(`Final status connected: ${finalStatus.data?.connected}`);

  if (r5.status === 200 && finalStatus.data?.connected === false) {
    log('  PASS: Disconnect API successfully purged the Slack connection.');
  } else {
    log('  FAIL: Disconnect failed.');
  }

  // Cleanup
  await queue.close();
  await qConn.quit();
  log('\n=== PHASE 6 TEST SUITE COMPLETE ===');
  await prisma.$disconnect();
  process.exit(0);
}

run().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});
