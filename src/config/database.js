import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const shutdown = async (signal) => {
  console.log(`[${signal}] Prisma disconnecting...`);
  await prisma.$disconnect();
  process.exit(0);
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

export default prisma;
