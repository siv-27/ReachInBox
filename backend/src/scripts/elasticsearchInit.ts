import { ElasticsearchService } from '../services/elasticsearchService';
import { prisma } from '../config/database';

async function init() {
  console.log('[Elasticsearch Init] Starting index initialization...');
  await ElasticsearchService.initializeEmailIndex();
  console.log('[Elasticsearch Init] Index initialization completed successfully.');
  
  await prisma.$disconnect();
  process.exit(0);
}

init().catch((err) => {
  console.error('[Elasticsearch Init] Critical error:', err);
  process.exit(1);
});
