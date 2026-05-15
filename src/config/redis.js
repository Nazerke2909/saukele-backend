import Redis from 'ioredis';
import { env } from './env.js';

const redisClient = new Redis(env.REDIS_URL);

redisClient.on('error', (err) => {
  console.warn('[REDIS] Redis недоступен, используется in-memory fallback');
});

let connected = false;

export async function connectRedis() {
  if (connected) return redisClient;
  try {
    await redisClient.ping();
    connected = true;
    console.log('[REDIS] Connected');
  } catch (err) {
    console.warn('[REDIS] Не удалось подключиться, продолжаем без Redis');
  }
  return redisClient;
}

export function isRedisAvailable() {
  return connected && redisClient.status === 'ready';
}

export async function disconnectRedis() {
  if (connected) {
    try {
      await redisClient.quit();
    } catch { /* ignore */ }
    connected = false;
    console.log('[REDIS] Disconnected');
  }
}

export default redisClient;