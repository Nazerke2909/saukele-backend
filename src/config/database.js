import { PrismaClient } from '@prisma/client';
import { env } from './env.js';


const globalForPrisma = globalThis;

let poolConfig = {};

try {
  const url = new URL(env.DATABASE_URL);
  if (!url.searchParams.has('connection_limit')) {
    url.searchParams.set('connection_limit', '20');
  }
  if (!url.searchParams.has('pool_timeout')) {
    url.searchParams.set('pool_timeout', '10');
  }
  poolConfig = { datasources: { db: { url: url.toString() } } };
} catch {
}

const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    ...poolConfig,
    log: env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export async function disconnectPrisma() {
  try {
    await prisma.$disconnect();
    console.log('[DB] Prisma disconnected');
  } catch (err) {
    console.error('[DB] Prisma disconnect error:', err.message);
  }
}
export default prisma;
