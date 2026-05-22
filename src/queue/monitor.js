import { createBullBoard } from '@bull-board/api';
import { BullAdapter } from '@bull-board/api/bullAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { emailQueue, webhookQueue, cronQueue } from './queue.js';
import prisma from '../config/database.js';
import { AppError } from '../middleware/errorHandler.js';

const CRON_TASKS = {
  deadStockDecay: {
    label: '🔄 Dead Stock Decay',
    description: 'Переводит FUNDING пулы без активности >30д в PENDING',
    data: {},
  },
  rateUpdate: {
    label: '💰 Обновить курсы валют',
    description: 'Обновляет курсы USD→KZT и EUR→KZT',
    data: {},
  },
  dailyObligationReminders: {
    label: '📧 Обязательства (ежедневно)',
    description: 'Отправляет напоминания о gift-обязательствах',
    data: {},
  },
  gentleObligationReminders: {
    label: '💌 Мягкие напоминания',
    description: 'Отправляет культурно-зависимые напоминания',
    data: {},
  },
  abandonedCartRecovery: {
    label: '🛒 Брошенные корзины',
    description: 'Находит и логирует PENDING взносы старше 24ч',
    data: {},
  },
};

const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');

createBullBoard({
  queues: [
    new BullAdapter(emailQueue),
    new BullAdapter(webhookQueue),
    new BullAdapter(cronQueue),
  ],
  serverAdapter,
});

export const bullBoardRouter = serverAdapter.getRouter();

export async function getQueueStats(req, res) {
  const queues = [
    { name: 'email', queue: emailQueue },
    { name: 'webhooks', queue: webhookQueue },
    { name: 'cron', queue: cronQueue },
  ];

  const stats = await Promise.all(
    queues.map(async ({ name, queue }) => {
      const [waiting, active, completed, failed, delayed] = await Promise.all([
        queue.getWaitingCount(),
        queue.getActiveCount(),
        queue.getCompletedCount(),
        queue.getFailedCount(),
        queue.getDelayedCount(),
      ]);

      return {
        name,
        counts: { waiting, active, completed, failed, delayed },
      };
    })
  );

  res.json(stats);
}

export async function getQueueDetail(req, res) {
  const { queueName } = req.params;

  const queueMap = {
    email: emailQueue,
    webhooks: webhookQueue,
    cron: cronQueue,
  };

  const queue = queueMap[queueName];
  if (!queue) {
    throw new AppError(`Queue "${queueName}" not found. Available: email, webhooks, cron`, 404);
  }

  const [waiting, active, completed, failed, delayed, jobs] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getCompletedCount(),
    queue.getFailedCount(),
    queue.getDelayedCount(),
    queue.getJobs(['waiting', 'active', 'failed'], 0, 50),
  ]);

  const jobDetails = await Promise.all(
    jobs.map(async (job) => ({
      id: job.id,
      type: job.data?.type || 'unknown',
      attemptsMade: job.attemptsMade,
      maxAttempts: job.opts?.attempts || 1,
      status: await job.getState(),
      timestamp: job.timestamp,
      finishedOn: job.finishedOn,
      failedReason: job.failedReason || null,
      data: job.data,
    }))
  );

  res.json({
    name: queueName,
    counts: { waiting, active, completed, failed, delayed },
    recentJobs: jobDetails,
  });
}

export async function getJobDetail(req, res) {
  const { queueName, jobId } = req.params;

  const queueMap = {
    email: emailQueue,
    webhooks: webhookQueue,
    cron: cronQueue,
  };

  const queue = queueMap[queueName];
  if (!queue) {
    throw new AppError(`Queue "${queueName}" not found`, 404);
  }

  const job = await queue.getJob(Number(jobId));
  if (!job) {
    throw new AppError(`Job #${jobId} not found in queue "${queueName}"`, 404);
  }

  const state = await job.getState();

  res.json({
    id: job.id,
    type: job.data?.type || 'unknown',
    data: job.data,
    opts: job.opts,
    status: state,
    attemptsMade: job.attemptsMade,
    maxAttempts: job.opts?.attempts || 1,
    timestamp: job.timestamp,
    finishedOn: job.finishedOn,
    processedOn: job.processedOn,
    failedReason: job.failedReason || null,
    stacktrace: job.stacktrace || [],
    returnvalue: job.returnvalue || null,
  });
}

export async function retryJob(req, res) {
  const { queueName, jobId } = req.params;

  const queueMap = {
    email: emailQueue,
    webhooks: webhookQueue,
    cron: cronQueue,
  };

  const queue = queueMap[queueName];
  if (!queue) {
    throw new AppError(`Queue "${queueName}" not found`, 404);
  }

  const job = await queue.getJob(Number(jobId));
  if (!job) {
    throw new AppError(`Job #${jobId} not found`, 404);
  }

  await job.retry();

  res.json({ message: `Job #${jobId} retried successfully` });
}

export async function removeJob(req, res) {
  const { queueName, jobId } = req.params;

  const queueMap = {
    email: emailQueue,
    webhooks: webhookQueue,
    cron: cronQueue,
  };

  const queue = queueMap[queueName];
  if (!queue) {
    throw new AppError(`Queue "${queueName}" not found`, 404);
  }

  const job = await queue.getJob(Number(jobId));
  if (!job) {
    throw new AppError(`Job #${jobId} not found`, 404);
  }

  await job.remove();

  res.json({ message: `Job #${jobId} removed` });
}

export async function getCronTasks(req, res) {
  const repeatableJobs = await cronQueue.getRepeatableJobs();

  const tasks = Object.entries(CRON_TASKS).map(([type, config]) => {
    const repeatJob = repeatableJobs.find((rj) => rj.id === type || rj.name === type);
    return {
      type,
      label: config.label,
      description: config.description,
      cron: repeatJob?.cron || null,
      nextRun: repeatJob?.next || null,
    };
  });

  res.json(tasks);
}

export async function triggerCronTask(req, res) {
  const { type } = req.params;
  const taskConfig = CRON_TASKS[type];

  if (!taskConfig) {
    throw new AppError(
      `Неизвестная задача "${type}". Доступны: ${Object.keys(CRON_TASKS).join(', ')}`,
      400
    );
  }

  const job = await cronQueue.add(
    { type, data: taskConfig.data },
    { jobId: `manual-${type}-${Date.now()}` }
  );

  console.log(`[MANUAL_TRIGGER] Cron task "${type}" triggered manually (job #${job.id})`);

  
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'QUEUE_TRIGGER',
        entityType: 'Queue:cron',
        entityId: Number(job.id),
        newValue: {
          type,
          triggeredBy: user?.email || 'unknown',
          timestamp: new Date().toISOString(),
        },
      },
    });
  } catch (err) {
    console.error(`[MONITOR] Failed to log trigger:`, err.message);
  }

  res.json({
    message: `Задача "${taskConfig.label}" запущена (job #${job.id})`,
    jobId: job.id,
  });
}

export async function logJobResult(queueName, job, status) {
  try {
    
    const systemUser = await prisma.user.findFirst({
      where: { OR: [{ role: 'SUPER_ADMIN' }, { role: 'MODERATOR' }] },
      orderBy: { id: 'asc' },
    });
    const userId = systemUser?.id ?? 1;

    await prisma.auditLog.create({
      data: {
        userId,
        action: `QUEUE_${status.toUpperCase()}`,
        entityType: `Queue:${queueName}`,
        entityId: Number(job.id),
        newValue: {
          type: job.data?.type,
          attemptsMade: job.attemptsMade,
          timestamp: new Date().toISOString(),
          failedReason: job.failedReason || null,
        },
      },
    });
  } catch (err) {
    console.error(`[MONITOR] Failed to log job #${job.id}:`, err.message);
  }
}
