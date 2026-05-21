import { cronQueue } from './queue.js';
import { getDelayUntilAllowed } from '../utils/culturalTiming.js';

export async function registerCronJobs() {
  await cronQueue.add(
    { type: 'deadStockDecay', data: {} },
    { repeat: { cron: '0 3 * * *' }, jobId: 'dead-stock-decay-daily' }
  );

  await cronQueue.add(
    { type: 'rateUpdate', data: {} },
    { repeat: { cron: '0 * * * *' }, jobId: 'rate-update-hourly' }
  );

  await cronQueue.add(
    { type: 'dailyObligationReminders', data: {} },
    { repeat: { cron: '0 9 * * *' }, jobId: 'daily-obligation-reminders' }
  );

  await cronQueue.add(
    { type: 'abandonedCartRecovery', data: {} },
    { repeat: { cron: '0 * * * *' }, jobId: 'abandoned-cart-recovery-hourly' }
  );

  await cronQueue.add(
    { type: 'gentleObligationReminders', data: {} },
    { repeat: { cron: '0 10 * * *' }, jobId: 'gentle-obligation-reminders-daily' }
  );

  console.log('[CRON] All periodic jobs registered');
}