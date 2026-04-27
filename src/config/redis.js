import { createClient } from 'redis';

const redisClient = createClient({ url: process.env.REDIS_URL });

redisClient.on('error', (err) => console.error('[REDIS] Error:', err));

await redisClient.connect();

const shutdown = async (signal) => {
  console.log(`[${signal}] Disconnecting Redis...`);
  await redisClient.quit();
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

export default redisClient;
