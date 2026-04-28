import { createClient } from 'redis';

/**
 * Initialize Redis client.
 * Connection is deferred to avoid top-level await issues.
 * Use connectRedis() before using the client.
 */
const redisClient = createClient({ url: process.env.REDIS_URL });

redisClient.on('error', (err) => console.error('[REDIS] Error:', err));

let connected = false;

export async function connectRedis() {
  if (!connected) {
await redisClient.connect();
    connected = true;
    console.log('[REDIS] Connected');
  }
  return redisClient;
}

const shutdown = async (signal) => {
  console.log(`[${signal}] Disconnecting Redis...`);
  if (connected) {
  await redisClient.quit();
    connected = false;
  }
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

export default redisClient;

