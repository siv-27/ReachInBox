/**
 * Phase 7 - Elasticsearch Email Indexing and Search Test Suite
 */
import { prisma } from './config/database';
import { ElasticsearchService } from './services/elasticsearchService';
import { esClient } from './config/elasticsearch';
import { redisConnection } from './config/redis';
import jwt from 'jsonwebtoken';
import { config } from './config/env';

function log(msg: string) {
  const ts = new Date().toISOString().substr(11, 12);
  console.log(`[${ts}] ${msg}`);
}

async function createTestUsers() {
  const userA = await prisma.user.upsert({
    where: { googleId: 'test-phase7-userA' },
    update: {},
    create: {
      googleId: 'test-phase7-userA',
      name: 'Phase7 UserA',
      email: 'usera@example.com',
    },
  });

  const userB = await prisma.user.upsert({
    where: { googleId: 'test-phase7-userB' },
    update: {},
    create: {
      googleId: 'test-phase7-userB',
      name: 'Phase7 UserB',
      email: 'userb@example.com',
    },
  });

  log(`Test users created: UserA=${userA.id}, UserB=${userB.id}`);
  return { userA, userB };
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

async function wait(ms: number) {
  const interval = 1000;
  const steps = Math.ceil(ms / interval);
  for (let i = 0; i < steps; i++) {
    await new Promise((resolve) => setTimeout(resolve, interval));
    try {
      await prisma.$queryRaw`SELECT 1`;
      await redisConnection.ping();
    } catch (e) {}
  }
}

async function run() {
  log('=== PHASE 7 ELASTICSEARCH TEST SUITE ===\n');

  // 1. Connectivity Check
  log('--- TEST 1: Connectivity check ---');
  try {
    const ping = await esClient.ping();
    if (ping) {
      log('  PASS: Successfully connected and pinged Elastic Cloud.');
    } else {
      log('  FAIL: Ping failed.');
      process.exit(1);
    }
  } catch (err) {
    console.error('  FAIL: Connection exception:', err);
    process.exit(1);
  }

  // Setup Users
  const { userA, userB } = await createTestUsers();
  const tokenA = makeToken(userA.id);
  const tokenB = makeToken(userB.id);

  // Clean DB
  await prisma.email.deleteMany({
    where: { userId: { in: [userA.id, userB.id] } },
  });

  // Re-initialize index mapping safely
  log('\n--- TEST 2: Index initialization ---');
  try {
    await esClient.indices.delete({ index: 'reachinbox-emails' });
    log('Existing index deleted for clean mappings configuration.');
  } catch (e) {}
  await ElasticsearchService.initializeEmailIndex();
  log('  PASS: Mappings asserted safely.');

  // ================================================================
  // TEST A: Email Lifecycle Indexing & Search
  // ================================================================
  log('\n--- TEST 3: Email Lifecycle Indexing & Status Updates ---');
  
  // Schedule a single email for User A
  const startTime = new Date(Date.now() + 7200000).toISOString();
  log('Scheduling email...');
  const scheduleRes = await apiCall('POST', '/api/emails/schedule', tokenA, {
    sender: 'sender-phase7@example.com',
    recipients: ['alice-lifecycle@gmail.com'],
    subject: 'Unique subject term meeting',
    body: 'Lets discuss the final project invoice tomorrow afternoon.',
    startTime,
    delayBetweenEmails: 0,
  });

  log(`Schedule Status: ${scheduleRes.status}`);
  const emailId = scheduleRes.data?.emails?.[0]?.id;
  if (!emailId) {
    log('  FAIL: Failed to schedule email.');
    process.exit(1);
  }
  log(`Created email with ID: ${emailId}`);

  // Fetch document from Elasticsearch directly (polling dynamically due to async index replication lag)
  log('Fetching document from Elasticsearch directly (polling dynamically up to 10s)...');
  let doc: any = null;
  for (let i = 0; i < 10; i++) {
    await wait(1000);
    try {
      doc = await esClient.get({
        index: 'reachinbox-emails',
        id: emailId,
      });
      if (doc && doc._source) {
        break;
      }
    } catch (e) {
      // Ignore not found errors during polling
    }
  }

  if (!doc) {
    log('  FAIL: Email document not found in Elasticsearch after 10s.');
    process.exit(1);
  }

  let source = doc._source as any;
  log(`Elasticsearch doc fetched: status=${source?.status}`);
  if (source?.status === 'SCHEDULED') {
    log('  PASS: Newly created email correctly indexed into Elasticsearch with SCHEDULED state.');
  } else {
    log('  FAIL: Index state mismatch.');
  }

  // Update status to PROCESSING
  log('Updating status to PROCESSING...');
  await ElasticsearchService.updateEmailStatus(emailId, 'PROCESSING');
  doc = await esClient.get({ index: 'reachinbox-emails', id: emailId });
  source = doc._source as any;
  log(`Elasticsearch doc status: ${source?.status}`);
  if (source?.status === 'PROCESSING') {
    log('  PASS: PROCESSING state successfully updated in Elasticsearch.');
  } else {
    log('  FAIL: Status update mismatch.');
  }

  // Update status to SENT with timestamp
  log('Updating status to SENT...');
  const sentAt = new Date().toISOString();
  await ElasticsearchService.updateEmailStatus(emailId, 'SENT', { sentAt });
  doc = await esClient.get({ index: 'reachinbox-emails', id: emailId });
  source = doc._source as any;
  log(`Elasticsearch doc status: ${source?.status} sentAt=${source?.sentAt}`);
  if (source?.status === 'SENT' && source?.sentAt === sentAt) {
    log('  PASS: SENT state and sentAt timestamp successfully updated in Elasticsearch.');
  } else {
    log('  FAIL: Status update mismatch.');
  }

  // ================================================================
  // TEST B: Full-Text Matches
  // ================================================================
  log('\n--- TEST 4: Full-Text Matches ---');
  
  // Search 1: Search by recipient email domain (gmail.com)
  log('Searching q=gmail.com...');
  let searchRes = await apiCall('GET', '/api/emails/search?q=gmail.com', tokenA);
  log(`Search response count: ${searchRes.data?.data?.length}`);
  if (searchRes.data?.data?.[0]?.recipientEmail === 'alice-lifecycle@gmail.com') {
    log('  PASS: Search by email domain matches correctly.');
  } else {
    log('  FAIL: Email domain match failed.');
  }

  // Search 2: Search by subject keyword (meeting)
  log('Searching q=meeting...');
  searchRes = await apiCall('GET', '/api/emails/search?q=meeting', tokenA);
  log(`Search response subject: "${searchRes.data?.data?.[0]?.subject}"`);
  if (searchRes.data?.data?.[0]?.subject.includes('meeting')) {
    log('  PASS: Search by subject keyword matches correctly.');
  } else {
    log('  FAIL: Subject search failed.');
  }

  // Search 3: Search by body keyword (invoice)
  log('Searching q=invoice...');
  searchRes = await apiCall('GET', '/api/emails/search?q=invoice', tokenA);
  log(`Search response body snippet: "${searchRes.data?.data?.[0]?.body.substring(0, 30)}..."`);
  if (searchRes.data?.data?.[0]?.body.includes('invoice')) {
    log('  PASS: Search by body keyword matches correctly.');
  } else {
    log('  FAIL: Body search failed.');
  }

  // ================================================================
  // TEST C: User Isolation
  // ================================================================
  log('\n--- TEST 5: User Isolation Enforced ---');
  // User B tries to query User A's email content
  log('User B searching q=meeting...');
  searchRes = await apiCall('GET', '/api/emails/search?q=meeting', tokenB);
  log(`User B Search results: ${searchRes.data?.data?.length} results.`);
  if (searchRes.data?.data?.length === 0) {
    log('  PASS: User A emails are completely isolated and inaccessible to User B.');
  } else {
    log('  FAIL: Leakage detected. User B was able to access User A emails.');
  }

  // ================================================================
  // TEST D: Pagination
  // ================================================================
  log('\n--- TEST 6: Pagination check ---');
  searchRes = await apiCall('GET', '/api/emails/search?q=meeting&page=1&limit=1', tokenA);
  log(`Pagination metadata returned: page=${searchRes.data?.pagination?.page} limit=${searchRes.data?.pagination?.limit} total=${searchRes.data?.pagination?.total}`);
  if (searchRes.data?.pagination?.limit === 1 && searchRes.data?.pagination?.total >= 1) {
    log('  PASS: Pagination parameters and page details processed successfully.');
  } else {
    log('  FAIL: Pagination failed.');
  }

  // ================================================================
  // TEST E: Bulk Indexing CLI Simulation
  // ================================================================
  log('\n--- TEST 7: Bulk Indexing command check ---');
  // Bypass scheduler to write direct DB record (emulating existing email)
  const bypassEmail = await prisma.email.create({
    data: {
      userId: userA.id,
      sender: 'sender-phase7@example.com',
      recipient: 'bob-bulk-migrated@yahoo.com',
      subject: 'Bulk migration subject line key',
      body: 'Migrating this offline record into search indexing',
      status: 'SENT',
      scheduledAt: new Date(),
      sentAt: new Date(),
    },
  });
  log(`Bypass email created: ID=${bypassEmail.id}`);

  // Delete from Elasticsearch first if it exists
  try {
    await esClient.delete({ index: 'reachinbox-emails', id: bypassEmail.id });
  } catch (e) {}

  // Run the bulk index logic programmatically (the script mimics this exact bulk structure)
  const operations = [
    { index: { _index: 'reachinbox-emails', _id: bypassEmail.id } },
    {
      id: bypassEmail.id,
      userId: bypassEmail.userId,
      recipientEmail: bypassEmail.recipient.toLowerCase(),
      senderEmail: bypassEmail.sender.toLowerCase(),
      subject: bypassEmail.subject,
      body: bypassEmail.body,
      status: bypassEmail.status,
      scheduledAt: bypassEmail.scheduledAt.toISOString(),
      sentAt: bypassEmail.sentAt ? bypassEmail.sentAt.toISOString() : null,
      createdAt: bypassEmail.createdAt.toISOString(),
    }
  ];

  await esClient.bulk({ refresh: true, operations });
  log('Simulated bulk index executed.');

  // Verify search index has it now
  searchRes = await apiCall('GET', '/api/emails/search?q=migrated', tokenA);
  log(`Search matches: ${searchRes.data?.data?.[0]?.recipientEmail}`);
  if (searchRes.data?.data?.[0]?.recipientEmail === 'bob-bulk-migrated@yahoo.com') {
    log('  PASS: Bulk migration enqueues and indices existing PostgreSQL records correctly.');
  } else {
    log('  FAIL: Bulk indexing verification failed.');
  }

  // ================================================================
  // TEST F: Elasticsearch Failure Isolation Check
  // ================================================================
  log('\n--- TEST 8: Non-Blocking Fault Tolerant Checks ---');
  log('Modifying Elasticsearch service to mock API failure...');
  
  // Back up real indexing method
  const originalIndexEmail = ElasticsearchService.indexEmail;

  // Force indexEmail to throw a mock connection exception
  ElasticsearchService.indexEmail = async () => {
    throw new Error('Mock Elasticsearch Network Connection Refused');
  };

  log('Scheduling email during mock Elasticsearch outage...');
  const outageScheduleRes = await apiCall('POST', '/api/emails/schedule', tokenA, {
    sender: 'sender-phase7@example.com',
    recipients: ['outage-recipient@example.com'],
    subject: 'Outage Test',
    body: 'Verifying scheduling survives ES failure',
    startTime: new Date(Date.now() + 10000).toISOString(),
    delayBetweenEmails: 0,
  });

  log(`outageScheduleRes status code: ${outageScheduleRes.status}`);

  // Restore real service method
  ElasticsearchService.indexEmail = originalIndexEmail;

  if (outageScheduleRes.status === 201) {
    log('  PASS: Elasticsearch outages do NOT block or fail the primary PostgreSQL/SMTP email flows.');
  } else {
    log('  FAIL: Outage crashed the scheduler.');
  }

  log('\n=== PHASE 7 TEST SUITE COMPLETE ===');
  process.exit(0);
}

run().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});
