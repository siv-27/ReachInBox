import { prisma } from '../config/database';
import { esClient } from '../config/elasticsearch';

const INDEX_NAME = 'reachinbox-emails';

async function bulkIndex() {
  console.log('[Elasticsearch Bulk Index] Fetching all emails from PostgreSQL...');
  
  const dbEmails = await prisma.email.findMany();
  
  if (dbEmails.length === 0) {
    console.log('[Elasticsearch Bulk Index] No email records found in database to migrate.');
    await prisma.$disconnect();
    process.exit(0);
  }

  console.log(`[Elasticsearch Bulk Index] Found ${dbEmails.length} email records. Formatting operations...`);

  // Build operations array for the Elasticsearch Bulk API
  const operations = dbEmails.flatMap((email) => [
    { index: { _index: INDEX_NAME, _id: email.id } },
    {
      id: email.id,
      userId: email.userId,
      recipientEmail: email.recipient.toLowerCase(),
      senderEmail: email.sender.toLowerCase(),
      subject: email.subject,
      body: email.body,
      status: email.status,
      scheduledAt: email.scheduledAt.toISOString(),
      sentAt: email.sentAt ? email.sentAt.toISOString() : null,
      createdAt: email.createdAt.toISOString(),
    }
  ]);

  try {
    console.log('[Elasticsearch Bulk Index] Executing bulk API batch...');
    const response = await esClient.bulk({
      refresh: true,
      operations,
    });

    if (response.errors) {
      let failedCount = 0;
      response.items.forEach((item: any) => {
        const operation = Object.keys(item)[0];
        const error = item[operation].error;
        if (error) {
          failedCount++;
          console.error(`  Failed document ID: ${item[operation]._id}. Error:`, error);
        }
      });
      console.warn(`[Elasticsearch Bulk Index] Migrated with ${failedCount} failures out of ${dbEmails.length} total.`);
    } else {
      console.log(`[Elasticsearch Bulk Index] Successfully migrated all ${dbEmails.length} emails to Elasticsearch.`);
    }
  } catch (error) {
    console.error('[Elasticsearch Bulk Index] Critical failure during bulk indexing:', error);
  }

  await prisma.$disconnect();
  process.exit(0);
}

bulkIndex().catch((err) => {
  console.error('[Elasticsearch Bulk Index] Critical script error:', err);
  process.exit(1);
});
