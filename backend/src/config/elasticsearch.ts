import { Client } from '@elastic/elasticsearch';
import { config } from './env';

// Instantiates a single, persistent client instance for Elastic Cloud
export const esClient = new Client({
  node: config.elasticsearchUrl,
  auth: {
    apiKey: config.elasticsearchApiKey,
  },
});

console.log('[Elasticsearch] Client connection instantiated successfully');
