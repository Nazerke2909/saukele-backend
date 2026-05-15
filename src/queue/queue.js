import Bull from 'bull';
import { env } from '../config/env.js';

export const emailQueue = new Bull('email', env.REDIS_URL, {
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 60_000, // 1min → 2min → 4min
    },
    removeOnComplete: 100,
    removeOnFail: 50,
  },
});

export const webhookQueue = new Bull('webhooks', env.REDIS_URL, {
  defaultJobOptions: {
    attempts: 5,
    backoff: {
      type: 'exponential',
      delay: 30_000, // 30s → 1min → 2min → 4min → 8min
    },
    removeOnComplete: 200,
    removeOnFail: 100,
  },
});

export const cronQueue = new Bull('cron', env.REDIS_URL, {
  defaultJobOptions: {
    removeOnComplete: 10,
    removeOnFail: 10,
  },
});

const queues = [emailQueue, webhookQueue, cronQueue];

queues.forEach((q) => {
  q.on('error', (err) => console.error(`[QUEUE:${q.name}] Error:`, err.message));
  q.on('failed', (job, err) =>
    console.error(`[QUEUE:${q.name}] Job #${job.id} failed (attempt ${job.attemptsMade}):`, err.message)
  );
  q.on('completed', (job) =>
    console.log(`[QUEUE:${q.name}] Job #${job.id} completed`)
  );
});

export default { emailQueue, webhookQueue, cronQueue };