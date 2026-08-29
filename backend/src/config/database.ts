import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { config } from './env';

// Prefer DIRECT_URL to bypass PgBouncer idle pooler socket timeouts
const connectionString = config.directUrl || config.databaseUrl;

const pool = new Pool({
  connectionString,
  max: 10,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 30000,
  keepAlive: true,
});

const adapter = new PrismaPg(pool);

export const prisma = new PrismaClient({ adapter });

pool.on('error', (err) => {
  console.warn('[Postgres Pool] Handled database connection pool event:', err.message);
});

export async function testDatabaseConnection(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (error: any) {
    console.error('[Database] Connection test failed:', error.message);
    return false;
  }
}

export { pool };
