import { esClient } from '../config/elasticsearch';

const INDEX_NAME = 'reachinbox-emails';

export interface ElasticsearchEmailDoc {
  id: string;
  userId: string;
  recipientEmail: string;
  senderEmail: string;
  subject: string;
  body: string;
  status: string;
  scheduledAt: string;
  sentAt?: string | null;
  createdAt: string;
}

export class ElasticsearchService {
  /**
   * Initializes the emails index and applies strict mapping if missing
   */
  static async initializeEmailIndex(): Promise<void> {
    try {
      const exists = await esClient.indices.exists({ index: INDEX_NAME });
      if (exists) {
        console.log(`[Elasticsearch] Index "${INDEX_NAME}" already exists.`);
        return;
      }

      await esClient.indices.create({
        index: INDEX_NAME,
        mappings: {
          properties: {
            id: { type: 'keyword' },
            userId: { type: 'keyword' },
            recipientEmail: {
              type: 'text',
              fields: {
                keyword: { type: 'keyword', ignore_above: 256 }
              }
            },
            senderEmail: {
              type: 'text',
              fields: {
                keyword: { type: 'keyword', ignore_above: 256 }
              }
            },
            subject: {
              type: 'text',
              fields: {
                keyword: { type: 'keyword', ignore_above: 256 }
              }
            },
            body: { type: 'text' },
            status: { type: 'keyword' },
            scheduledAt: { type: 'date' },
            sentAt: { type: 'date' },
            createdAt: { type: 'date' }
          }
        }
      });
      console.log(`[Elasticsearch] Index "${INDEX_NAME}" created with mappings successfully.`);
    } catch (error) {
      console.error('[Elasticsearch] Failed to initialize index (non-blocking):', error);
    }
  }

  /**
   * Indexes a single email record
   */
  static async indexEmail(email: any): Promise<void> {
    try {
      const document: ElasticsearchEmailDoc = {
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
      };

      await esClient.index({
        index: INDEX_NAME,
        id: email.id,
        document,
        refresh: 'wait_for', // Wait for search availability to make tests reliable
      });
      console.log(`[Elasticsearch] Indexed email document ${email.id}`);
    } catch (error) {
      console.error(`[Elasticsearch] Failed to index email document ${email.id} (non-blocking):`, error);
    }
  }

  /**
   * Updates status of an existing email document
   */
  static async updateEmailStatus(emailId: string, status: string, extraFields: Partial<ElasticsearchEmailDoc> = {}): Promise<void> {
    try {
      const updateDoc: any = {
        status,
        ...extraFields,
      };

      await esClient.update({
        index: INDEX_NAME,
        id: emailId,
        doc: updateDoc,
        refresh: 'wait_for',
      });
      console.log(`[Elasticsearch] Updated email document ${emailId} status to ${status}`);
    } catch (error) {
      console.error(`[Elasticsearch] Failed to update email document ${emailId} (non-blocking):`, error);
    }
  }

  /**
   * Deletes an email document from the index
   */
  static async deleteEmail(emailId: string): Promise<void> {
    try {
      await esClient.delete({
        index: INDEX_NAME,
        id: emailId,
        refresh: 'wait_for',
      });
      console.log(`[Elasticsearch] Deleted email document ${emailId}`);
    } catch (error) {
      console.error(`[Elasticsearch] Failed to delete email document ${emailId} (non-blocking):`, error);
    }
  }

  /**
   * Searches user emails using full-text search with strict user isolation
   */
  static async searchEmails(
    userId: string,
    query: string,
    page: number = 1,
    limit: number = 20
  ): Promise<{ data: ElasticsearchEmailDoc[]; total: number }> {
    try {
      const from = (page - 1) * limit;

      const response = await esClient.search({
        index: INDEX_NAME,
        from,
        size: limit,
        query: {
          bool: {
            filter: [
              { term: { userId } } // Enforces strict user isolation
            ],
            must: query ? [
              {
                multi_match: {
                  query,
                  fields: ['recipientEmail', 'senderEmail', 'subject', 'body'],
                  fuzziness: 'AUTO',
                }
              }
            ] : [
              { match_all: {} }
            ]
          }
        },
        sort: [
          { createdAt: 'desc' }
        ]
      });

      const hits = response.hits.hits;
      const total = typeof response.hits.total === 'number'
        ? response.hits.total
        : (response.hits.total?.value || 0);

      const data = hits.map((h: any) => h._source as ElasticsearchEmailDoc);

      return { data, total };
    } catch (error) {
      console.error('[Elasticsearch] Search query failed (returning empty list):', error);
      return { data: [], total: 0 };
    }
  }
}
