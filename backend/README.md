# ReachInbox – Full-Stack Email Job Scheduler (Backend)

This is a production-style, persistent email scheduling backend for ReachInbox / Outbox Labs built using Node.js, Express, TypeScript, Neon PostgreSQL, Prisma ORM, BullMQ, and Upstash Redis.

---

## 🚀 Project Overview

The scheduling system is designed for high reliability, persistence across server crashes, concurrency safety, and strict email idempotency.

### Key Features (Phase 6):
* **No Cron Scheduler**: Built entirely using persistent BullMQ delayed jobs backed by Upstash Redis. It does not rely on `node-cron`, `setInterval`, or OS crontabs.
* **PostgreSQL Source of Truth**: Email states and records are managed securely in PostgreSQL, preventing duplication.
* **Strict Idempotency Gate**: Workers use atomic state transitions to prevent duplicate email dispatches.
* **Automatic Retries**: BullMQ manages job retries with exponential backoff on temporary SMTP errors.
* **Real Google OAuth 2.0 Integration**: Uses secure cookie-based JWT sessions.
* **Ethereal SMTP Integration**: Real test emails are sent and sandbox preview URLs are stored in PostgreSQL.
* **Rate Limiting & Send Throttling**: Shares state across distributed instances/workers using Upstash Redis to enforce system-wide send staggers and per-sender hourly limits.
* **Slack Live Notifications**: Integrates real Slack OAuth 2.0 web flow to securely connect workspaces and dispatch live alerts when senders hit rate limits, backed by Redis alert deduplication.

---

## 🛠️ Architecture

```text
React Client
     │
     │ HTTP (Auth / Schedule / Sent APIs)
     ▼
Express API 
     │
     ├── Writes Email (SCHEDULED) ──► Neon PostgreSQL (Source of Truth)
     │
     └── Enqueues Delayed Job ──────► Upstash Redis (BullMQ Queue)
                                           │
                                           ▼
                                    BullMQ Worker (Concurrently processing)
                                           │
                                           ├─► Atomically checks DB (Idempotency check)
                                           │
                                           ├─► Runs Atomic Redis Lua script checks (Rate limits)
                                           │     ├─► System-wide Minimum Send Delay (keep-alive stagger)
                                           │     └─► Per-sender Hourly Limit
                                           │
                                           ├─► If Throttled:
                                           │     ├─► If reason: RATE_LIMIT, checks Slack Alert Gate:
                                           │     │     └─► Redis atomic Alert lock: set NX
                                           │     │           └─► Async posts alert message to connected Slack
                                           │     └─► Reschedules job in BullMQ with delay
                                           │
                                           ├─► If Allowed: Transitions status: SCHEDULED -> PROCESSING
                                           │
                                           ├─► Dispatches via Nodemailer (SMTP Ethereal)
                                           │     └─► On exception: Rolls back Redis rate-limit slot
                                           │
                                           └─► Transitions status: PROCESSING -> SENT (Stores messageId + previewUrl)
```

---

## ⚙️ Setup and Configuration

### 1. Neon PostgreSQL Setup
1. Create a PostgreSQL database on [Neon](https://neon.tech/).
2. Grab the connection string from the dashboard.
3. Configure `DATABASE_URL` in `.env`.

### 2. Upstash Redis Setup
1. Create a Redis instance on [Upstash](https://upstash.com/).
2. Copy the TLS connection URL starting with `rediss://`.
3. Configure `REDIS_URL` in `.env`.

### 3. Ethereal Email Setup
1. Go to [Ethereal Email](https://ethereal.email/) and click **Create Ethereal Account**.
2. Configure SMTP credentials in `.env` (`ETHEREAL_USER`, `ETHEREAL_PASSWORD`).

### 4. Google OAuth 2.0 Setup
1. Go to [Google Cloud Console](https://console.cloud.google.com/).
2. Create a project and setup OAuth Consent Screen with the `email` and `profile` scopes.
3. Create Credentials -> OAuth client ID (Web application).
4. Configure Authorized JavaScript Origins: `http://localhost:5173`, `http://localhost:5000`.
5. Configure Authorized Redirect URIs: `http://localhost:5000/api/auth/google/callback`.
6. Configure Google credentials in `.env`.

### 5. Slack OAuth Setup
1. Create a Slack App in your [Slack Developer Console](https://api.slack.com/apps).
2. Configure Redirect URI under OAuth & Permissions: `http://localhost:5000/api/slack/callback`.
3. Select Bot scopes: `chat:write` (to post messages) and `incoming-webhook` (enabling channel selection dialog).
4. Save client ID and secret in your `.env`.

---

## 📝 Environment Variables (`.env`)

Create a `.env` file in the `backend/` directory based on the following template (see `backend/.env.example`):

```env
PORT=5000
DATABASE_URL=postgresql://neondb_owner:password@host-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require
REDIS_URL=rediss://default:password@host.upstash.io:6379

GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_CALLBACK_URL=http://localhost:5000/api/auth/google/callback
FRONTEND_URL=http://localhost:5173

JWT_SECRET=your-secure-jwt-signing-secret

ETHEREAL_HOST=smtp.ethereal.email
ETHEREAL_PORT=587
ETHEREAL_USER=your-ethereal-user@ethereal.email
ETHEREAL_PASSWORD=your-ethereal-password

SLACK_CLIENT_ID=your-slack-client-id
SLACK_CLIENT_SECRET=your-slack-client-secret
SLACK_REDIRECT_URI=http://localhost:5000/api/slack/callback

WORKER_CONCURRENCY=3
MIN_DELAY_BETWEEN_EMAILS_MS=2000
MAX_EMAILS_PER_HOUR=200
```

---

## 🏃 Running the Application

Ensure you have run `npm install` inside both directories.

### Compile and Start API Server:
```bash
cd backend
npm run dev
```

### Start BullMQ Worker Process:
```bash
cd backend
npm run worker
```

---

## 🧪 Testing Verification

### Run Phase 4 SMTP & OAuth Tests:
```bash
cd backend
npm run build
node dist/phase4Tests.js
```

### Run Phase 5 Throttling & Rate Limiting Tests:
```bash
cd backend
npm run build
$env:MIN_DELAY_BETWEEN_EMAILS_MS=1500; $env:MAX_EMAILS_PER_HOUR=5; node dist/phase5Tests.js
```

### Run Phase 6 Slack OAuth & Notifications Tests:
```bash
cd backend
npm run build
$env:MIN_DELAY_BETWEEN_EMAILS_MS=1500; $env:MAX_EMAILS_PER_HOUR=1; node dist/phase6Tests.js
```

---

## 🔒 Idempotency, Concurrency, and Restart Persistence

### 1. Persistent Scheduling (No Cron)
We do not use cron polling. Scheduling is handled via **BullMQ delayed jobs**. When scheduling, a job is added to Redis with a delay representing the difference between the scheduled time and now:
$$\text{delay} = \text{scheduledAt} - \text{Date.now()}$$
Because Redis is persistent, scheduled delayed jobs survive backend restarts without duplicate creation.

### 2. Idempotency Gate (SCHEDULED $\rightarrow$ PROCESSING)
Before a worker dispatches an email via SMTP, it attempts to atomically change the status of the PostgreSQL record from `SCHEDULED` to `PROCESSING` using an optimistic lock:
```typescript
const updateResult = await prisma.email.updateMany({
  where: { id: emailId, status: 'SCHEDULED' },
  data: { status: 'PROCESSING' }
});
```
If `updateResult.count === 0`, the job is aborted immediately. This protects against racing workers or duplicated jobs.

### 3. Exactly-Once SMTP Delivery Limitation
It is theoretically impossible to guarantee exactly-once delivery across distributed systems during network splits. If a worker successfully dispatches an email via SMTP but crashes/loses power *before* it can write the `SENT` status update back to PostgreSQL, the job will fail in BullMQ, trigger a retry, and result in a duplicate send. We minimize this window by updating the DB immediately following the Nodemailer response.

### 4. DB-First Consistency Trade-off
We write the email record to PostgreSQL as `SCHEDULED` *first*, and then queue the job in BullMQ. If the BullMQ enqueue fails, we catch the exception and immediately mark the database record as `FAILED` (with error details) so that no phantom scheduled emails are displayed on the frontend.

---

## ⚡ Rate Limiting & Concurrency

### 1. Worker Concurrency (`WORKER_CONCURRENCY`)
The number of parallel jobs a worker processes concurrently is configurable (default: `3`). The worker parses `WORKER_CONCURRENCY` and instantiates the BullMQ `Worker` with the defined concurrency factor.

### 2. Minimum Send Delay (`MIN_DELAY_BETWEEN_EMAILS_MS`)
To prevent hammering the SMTP server, a minimum delay is enforced between individual dispatches. This delay is coordinate-locked system-wide via Upstash Redis. If Worker A and Worker B try to send emails at the same time, the second worker will get deferred and rescheduled.

### 3. Hourly Rate Limit (`MAX_EMAILS_PER_HOUR`)
Enforces a configurable hourly limit on the number of emails dispatched per sender (e.g. `200` per hour). Counters are tracked in Redis per-sender and per-hour-window (e.g. `email_rate_limit:sender@example.com:2026-08-29T10`). 

### 4. Atomic Lua Rate check
To prevent race conditions where concurrent workers bypass the hourly limit, a unified **Redis Lua script** executes atomically:
1. It retrieves the next allowed system-wide send time. If not elapsed, it returns a `DELAY` code.
2. It retrieves the sender's current hourly counter. If exceeded, it returns a `RATE_LIMIT` code.
3. If both are satisfied, it atomically increments the hourly counter, registers a **2-hour TTL** (to prevent unbounded Redis growth), locks the next allowed send time, and returns success.

### 5. Rescheduling Throttled Jobs
When a job is throttled due to delay or rate limiting, **it is never dropped or marked FAILED**. Instead, the worker calculates the remaining delay (until the next allowed stagger or the start of the next hourly window) and adds a new delayed job to BullMQ using a unique timestamp suffix (`email-${email.id}-r-${Date.now()}`) to prevent completed-job-cleanups from deleting the new job.

### 6. SMTP Failure Slot Rollback
If an email fails during the Nodemailer SMTP send phase, the worker catches the exception, releases/decrements the reserved rate limit slot in Redis, and reverts the database record back to `SCHEDULED` so that subsequent BullMQ retry attempts do not permanently leak the sender's hourly quota.

---

## 💬 Slack Integration & Alerting

### 1. Secure Connection Persistence
When a user connects their Slack workspace via OAuth 2.0, the backend retrieves a bot token `xoxb-...` and target channel ID from the Slack API. These values are saved per-user in Neon PostgreSQL (`SlackConnection` model).

### 2. Redis Atomic Alert Deduplication Lock
To avoid spamming Slack channels when multiple emails are throttled simultaneously, we implement a Redis lock key:
`slack_alert_sent:{sender_email}:{hour_window}`
When a worker encounters a `RATE_LIMIT` throttle event, it executes a single `SET key "1" EX 7200 NX` lock command in Upstash. The alert is sent to Slack **only** if this atomic reservation succeeds. This restricts Slack notification traffic to exactly one alert per sender per hour window.

### 3. Safe Token Expiration & Revocation Cleanups
If a worker attempts to post an alert but Slack returns an invalid or expired token error (such as `invalid_auth` or `token_revoked`), the service catches the exception and immediately **deletes/purges the SlackConnection record** from PostgreSQL. This ensures subsequent scheduling processes do not call stale, inactive tokens.

### 4. Non-Blocking Notification Policy
Slack dispatches occur asynchronously. If Slack is disconnected, network transport fails, or a token is revoked, **the worker catches the exception silently and proceeds with rescheduling normally**. Slack errors never fail scheduled email jobs.

---

## 🔍 Elasticsearch Search & Indexing

### 1. PostgreSQL Source of Truth
PostgreSQL remains the primary database and source of truth for email states, job attributes, and history. Elasticsearch acts purely as a secondary search index.

### 2. Search Indexing Lifecycle Hooks
* **Email Creation**: When a user schedules an email, the backend inserts the record in PostgreSQL and immediately triggers an asynchronous, non-blocking index operation (`ElasticsearchService.indexEmail`) to create the document in Elasticsearch.
* **Worker State Transitions**: During queue claim (`PROCESSING`), successful SMTP send (`SENT` with `sentAt`), or retry exhausted (`FAILED`), the worker triggers asynchronous updates (`ElasticsearchService.updateEmailStatus`) to keep the search index in sync.
* **Non-Blocking Fault Tolerance**: All Elasticsearch operations are wrapped in safe try/catch structures. If the Elastic Cloud cluster is unreachable or degraded, the scheduling and SMTP delivery processes will complete successfully.

### 3. User-Isolated Full-Text Search
The search API (`GET /api/emails/search?q=...`) runs multi-field text queries across the `recipientEmail`, `senderEmail`, `subject`, and `body` fields. A strict term filter matches the authenticated user's `userId`, ensuring complete data isolation between tenants.

### 4. Bulk CLI & Init Commands
* **Safe Initialization (`npm run elasticsearch:init`)**: Asserts the index creation and registers strict mapping parameters for full-text and keyword capabilities in Elastic Cloud.
* **Bulk Migration (`npm run elasticsearch:index`)**: Retrieves all historical email records from PostgreSQL and pushes them in batch operations to Elasticsearch utilizing the high-performance Bulk API.

### 5. Run Phase 7 Elasticsearch & Isolation Tests:
```bash
cd backend
npm run build
$env:MIN_DELAY_BETWEEN_EMAILS_MS=1500; $env:MAX_EMAILS_PER_HOUR=200; node dist/phase7Tests.js
```

---

## 📊 Live Queue Monitoring & BullMQ Dashboard

### 1. Existing Queue Monitoring
The dashboard connects directly to the actual production email queue `email-queue` using the existing Upstash Redis connection parameters. No duplicate queues or separate pools are created.

### 2. Live Updates via Server-Sent Events (SSE)
Real-time updates are driven by Server-Sent Events via `GET /api/queue/events`. 
* Pushes real-time aggregate statistics whenever worker state transitions occur (e.g. `waiting`, `active`, `completed`, `failed`, `delayed`).
* Closes and cleans up `QueueEvents` connection listeners gracefully when client sockets terminate.
* Eliminates the need for client-side interval polling.

### 3. Queue APIs & Data Safety
* **Stats API (`GET /api/queue/stats`)**: Retrieves real-time counts from BullMQ's native `queue.getJobCounts()`.
* **Jobs API (`GET /api/queue/jobs?status=<status>&page=<page>&limit=<limit>`)**: Returns paginated job metadata (Job ID, attempt counts, maximum attempts, failure reasons).
* **Safe Payload Mapping**: Combines the BullMQ job identifiers with target PostgreSQL `Email` record attributes (such as recipient address and subject lines) inside the controller, preventing raw Redis passwords or database host credentials from leaking.

### 4. Interactive Frontend Dashboard
* Mounted inside a dedicated tab selector ("Queue Monitor") in the React client.
* **Aggregate Summary Cards**: Displays dynamic aggregate counters. Clicking a card updates the active filter status.
* **Paginated Table**: Displays job-specific metadata with loading, empty, and connection error boundaries.
* **Live SSE Indicator**: Integrates a real-time status light reflecting EventSource connection integrity (Green when active, Amber during reconnection retries).

### 5. Run Phase 8 BullMQ Dashboard Tests:
```bash
cd backend
npm run build
$env:MIN_DELAY_BETWEEN_EMAILS_MS=1500; $env:MAX_EMAILS_PER_HOUR=200; node dist/phase8Tests.js
```

---

## 🎨 Final SaaS Frontend Dashboard & Colors

### 1. Burnt Orange & Cream Theme
* **Visual Palette**: Features Page Background (`#FFF7ED`), Card & Sidebar Surfaces (`#FFFFFF`), Input Boxes (`#FFFCF8`), Selected Navigation highlight (`#FFEDD5`), Charcoal Typography (`#292524`), and Primary Brand accents in Burnt Orange (`#C2410C`, Hover `#9A3412`).
* Status badges utilize soft, non-saturated backgrounds with bold foreground indicators:
  * **SCHEDULED**: Light amber/cream with `#D97706` text.
  * **PROCESSING**: Light orange with `#EA580C` text.
  * **SENT**: Soft muted-olive with `#7A8450` text.
  * **FAILED**: Soft red with `#B91C1C` text.

### 2. Client-Side CSV/TXT Parsing
* **Recipient Upload**: The compose modal includes a client-side File Uploader that reads `.csv` or `.txt` content locally using a HTML5 `FileReader`.
* **RFC-Compliant Regex**: Validates each line. Separates valid emails from invalid emails, reporting the detected email count (e.g. `128 email addresses parsed`) and skipping empty/invalid rows. Prevents scheduler scheduling if the valid recipient count is 0.

### 3. Integrated Elasticsearch Search & Tables
* **Scheduled List**: Displays recipient, subject, scheduled date/times, and status badges (SCHEDULED/PROCESSING) fetched directly from the database API.
* **Sent Log**: Combines the complete PostgreSQL sent/failed history logs and an **Elasticsearch search input** into a single page.
* **Full-Text Match**: Query keywords are sent to `GET /api/emails/search?q=...` to run real-time user-isolated queries across recipient, sender, subject, and body text fields.

### 4. Running the Frontend
```bash
cd frontend
npm install
npm run build
npm run dev
```
