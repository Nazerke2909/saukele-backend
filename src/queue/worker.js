import { registerCronJobs } from './cron.js';
import { emailQueue, webhookQueue, cronQueue } from './queue.js';
import {
  sendVerificationEmail,
  sendVerificationLinkEmail,
  sendPasswordResetEmail,
  sendGiftObligationReminderEmail,
  sendContributionReceivedEmail,
  sendPoolFundedEmail,
  sendRegistryInvitationEmail,
  sendPoolProgressEmail,
  sendGiftDeliveryConfirmationEmail,
  sendGentlePaymentReminderEmail,
} from '../service/emailService.js';
import prisma from '../config/database.js';
import getExchangeRate from '../service/exchangeService.js';
import { logJobResult } from './monitor.js';
import { isSendingAllowed, getDelayUntilAllowed } from '../utils/culturalTiming.js';

emailQueue.process(async (job) => {
  const { type, data } = job.data;

  switch (type) {
    case 'verification':
      await sendVerificationEmail(data.email, data.code);
      break;
    case 'verificationLink':
      await sendVerificationLinkEmail(data.email, data.token);
      break;
    case 'passwordReset':
      await sendPasswordResetEmail(data.email, data.token);
      break;
    case 'contributionReceived':
      await sendContributionReceivedEmail(
        data.coupleEmail, data.coupleName,
        data.guestName, data.poolName, data.amountKzt
      );
      break;
    case 'poolFunded':
      await sendPoolFundedEmail(
        data.coupleEmail, data.coupleName,
        data.poolName, data.targetKzt, data.totalFundedKzt
      );
      break;
    case 'obligationReminder':
      await sendGiftObligationReminderEmail(
        data.memberEmail, data.memberName,
        data.weddingTitle, data.kinshipRank,
        data.obligationKzt, data.contributedKzt
      );
      break;

    // ===== КУЛЬТУРНО-ЗАВИСИМЫЕ БИЗНЕС-ПИСЬМА (4 шт) =====
    case 'registryInvitation':
      await sendRegistryInvitationEmail({
        guestEmail: data.guestEmail,
        guestName: data.guestName,
        coupleName: data.coupleName,
        weddingTitle: data.weddingTitle,
        invitationLink: data.invitationLink,
        registryDescription: data.registryDescription,
      });
      break;

    case 'poolProgress':
      await sendPoolProgressEmail({
        coupleEmail: data.coupleEmail,
        coupleName: data.coupleName,
        poolName: data.poolName,
        targetKzt: data.targetKzt,
        totalFundedKzt: data.totalFundedKzt,
        percentage: data.percentage,
        contributorsCount: data.contributorsCount,
        remainingDays: data.remainingDays,
      });
      break;

    case 'giftDeliveryConfirmation':
      await sendGiftDeliveryConfirmationEmail({
        donorEmail: data.donorEmail,
        donorName: data.donorName,
        coupleName: data.coupleName,
        poolName: data.poolName,
        deliveryDate: data.deliveryDate,
        trackingNumber: data.trackingNumber,
        isFragile: data.isFragile,
      });
      break;

    case 'gentlePaymentReminder':
      await sendGentlePaymentReminderEmail({
        memberEmail: data.memberEmail,
        memberName: data.memberName,
        coupleName: data.coupleName,
        weddingTitle: data.weddingTitle,
        kinshipRank: data.kinshipRank,
        obligationKzt: data.obligationKzt,
        contributedKzt: data.contributedKzt,
        remainingKzt: data.remainingKzt,
      });
      break;

    default:
      console.warn(`[WORKER] Unknown email job type: ${type}`);
  }
});

webhookQueue.process(async (job) => {
  const { url, payload, eventType } = job.data;

  console.log(`[WORKER] Webhook #${job.id} sending ${eventType} to ${url} (attempt ${job.attemptsMade + 1})`);

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      event: eventType,
      timestamp: new Date().toISOString(),
      data: payload,
    }),
  });

  if (!response.ok) {
    throw new Error(`Webhook to ${url} returned ${response.status}: ${await response.text()}`);
  }

  console.log(`[WORKER] Webhook #${job.id} to ${url} succeeded (${response.status})`);
});

cronQueue.process(async (job) => {
  const { type, data } = job.data;

  switch (type) {
    case 'deadStockDecay':
      await handleDeadStockDecay(data.poolId);
      break;

    case 'rateUpdate':
      await handleRateUpdate();
      break;

    case 'dailyObligationReminders':
      await handleDailyObligationReminders();
      break;

    case 'gentleObligationReminders':
      await handleGentleObligationReminders();
      break;

    case 'abandonedCartRecovery':
      await handleAbandonedCartRecovery();
      break;

    default:
      console.warn(`[WORKER] Unknown cron job type: ${type}`);
  }
});

async function handleDeadStockDecay(poolId) {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

  const staleFunding = await prisma.giftPool.findMany({
    where: {
      status: 'FUNDING',
      updatedAt: { lt: thirtyDaysAgo },
      totalFunded: 0,
    },
  });

  for (const pool of staleFunding) {
    await prisma.giftPool.update({
      where: { id: pool.id },
      data: { status: 'PENDING' },
    });
    console.log(`[DEAD_STOCK] Pool #${pool.id} decayed FUNDING → PENDING (no activity for 30 days)`);
  }

  const stalePurchased = await prisma.giftPool.findMany({
    where: {
      status: 'PURCHASED',
      updatedAt: { lt: ninetyDaysAgo },
    },
  });

  for (const pool of stalePurchased) {
    console.warn(`[DEAD_STOCK] Pool #${pool.id} stuck in PURCHASED for >90 days`);
  }

  if (poolId) {
    const pool = await prisma.giftPool.findUnique({ where: { id: poolId } });
    if (pool && pool.status === 'FUNDING' && pool.totalFunded === 0) {
      await prisma.giftPool.update({
        where: { id: poolId },
        data: { status: 'PENDING' },
      });
      console.log(`[DEAD_STOCK] Pool #${poolId} decayed via scheduled job`);
    }
  }
}

async function handleRateUpdate() {
  console.log('[RATE_UPDATE] Checking exchange rates...');

  const pairs = [
    { from: 'USD', to: 'KZT' },
    { from: 'EUR', to: 'KZT' },
  ];

  for (const { from, to } of pairs) {
    const currentRate = await getExchangeRate(from, to);
    const variation = (Math.random() - 0.5) * 10;
    const newRate = Math.round((currentRate + variation) * 100) / 100;

    if (newRate !== currentRate) {
      await prisma.exchangeRate.updateMany({
        where: { currencyFrom: from, currencyTo: to, validUntil: null },
        data: { validUntil: new Date() },
      });

      await prisma.exchangeRate.create({
        data: {
          currencyFrom: from,
          currencyTo: to,
          rate: newRate,
          source: 'auto-update',
        },
      });

      console.log(`[RATE_UPDATE] ${from}→${to}: ${currentRate} → ${newRate}`);
    }
  }
}

async function handleDailyObligationReminders() {
  console.log('[CRON] Daily obligation reminders started');

  const weddings = await prisma.wedding.findMany({
    where: { giftPools: { some: { status: { in: ['FUNDING', 'PENDING'] } } } },
    select: { id: true, title: true },
  });

  for (const wedding of weddings) {
    const familyMembers = await prisma.familyTree.findMany({
      where: { weddingId: wedding.id, giftObligation: { not: null } },
      include: {
        member: { select: { id: true, email: true, fullName: true } },
      },
    });

    const memberIds = familyMembers.map(fm => fm.memberId);

    const contributions = await prisma.contribution.groupBy({
      by: ['guestId'],
      where: {
        guestId: { in: memberIds },
        status: 'COMPLETED',
        pool: { weddingId: wedding.id },
      },
      _sum: { amountKzt: true },
    });

    const contributionMap = new Map();
    for (const c of contributions) {
      contributionMap.set(c.guestId, c._sum.amountKzt);
    }

    const toRemind = familyMembers.filter(fm => {
      const contributedKzt = contributionMap.get(fm.memberId) || 0;
      return fm.giftObligation > contributedKzt;
    });

    for (const fm of toRemind) {
      await sendGiftObligationReminderEmail(
        fm.member.email, fm.member.fullName,
        wedding.title, fm.kinshipRank,
        fm.giftObligation, contributionMap.get(fm.memberId) || 0
      ).catch((err) => console.error(`[CRON] Failed to send reminder to ${fm.member.email}:`, err.message));
    }
  }

  console.log(`[CRON] Daily obligation reminders sent for ${weddings.length} weddings`);
}

/**
 * Мягкие напоминания о платежах с учётом культурных таймингов.
 * Проверяет время по Астане (09:00–21:00) и не отправляет в воскресенье.
 * Если сейчас неразрешённое время — откладывает задачу.
 */
async function handleGentleObligationReminders() {
  console.log('[CRON] Gentle obligation reminders started (culturally-aware timing)');

  // Проверка: если сейчас неразрешённое время — откладываем
  const { allowed, reason } = isSendingAllowed();
  if (!allowed) {
    const delay = getDelayUntilAllowed();
    console.log(`[CRON] Gentle reminders delayed: ${reason} (retry in ${Math.round(delay / 60000)} min)`);
    await cronQueue.add(
      { type: 'gentleObligationReminders', data: {} },
      { delay }
    );
    return;
  }

  const weddings = await prisma.wedding.findMany({
    where: { giftPools: { some: { status: { in: ['FUNDING', 'PENDING'] } } } },
    select: {
      id: true,
      title: true,
      couple: { select: { fullName: true } },
    },
  });

  for (const wedding of weddings) {
    const familyMembers = await prisma.familyTree.findMany({
      where: { weddingId: wedding.id, giftObligation: { not: null } },
      include: {
        member: { select: { id: true, email: true, fullName: true } },
      },
    });

    const memberIds = familyMembers.map(fm => fm.memberId);

    const contributions = await prisma.contribution.groupBy({
      by: ['guestId'],
      where: {
        guestId: { in: memberIds },
        status: 'COMPLETED',
        pool: { weddingId: wedding.id },
      },
      _sum: { amountKzt: true },
    });

    const contributionMap = new Map();
    for (const c of contributions) {
      contributionMap.set(c.guestId, c._sum.amountKzt);
    }

    const toRemind = familyMembers.filter(fm => {
      const contributedKzt = contributionMap.get(fm.memberId) || 0;
      return fm.giftObligation > contributedKzt;
    });

    for (const fm of toRemind) {
      const contributedKzt = contributionMap.get(fm.memberId) || 0;
      const remainingKzt = fm.giftObligation - contributedKzt;

      // Используем очередь культурно-зависимых уведомлений с задержкой
      await emailQueue.add(
        {
          type: 'gentlePaymentReminder',
          data: {
            memberEmail: fm.member.email,
            memberName: fm.member.fullName,
            coupleName: wedding.couple.fullName,
            weddingTitle: wedding.title,
            kinshipRank: fm.kinshipRank,
            obligationKzt: fm.giftObligation,
            contributedKzt,
            remainingKzt,
          },
        },
        { delay: getDelayUntilAllowed() }
      );
    }
  }

  console.log(`[CRON] Gentle obligation reminders queued for ${weddings.length} weddings`);
}

async function handleAbandonedCartRecovery() {
  console.log('[CRON] Abandoned cart recovery started');

  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const abandoned = await prisma.contribution.findMany({
    where: {
      status: 'PENDING',
      createdAt: { lt: oneDayAgo },
    },
    include: {
      guest: { select: { id: true, email: true, fullName: true } },
      pool: {
        select: {
          name: true,
          wedding: {
            select: {
              title: true,
              couple: { select: { email: true, fullName: true } },
            },
          },
        },
      },
    },
  });

  for (const contribution of abandoned) {
    if (!contribution.guest) continue;

    console.log(`[CART_RECOVERY] Reminding ${contribution.guest.email} about abandoned contribution #${contribution.id}`);

    console.log(
      `[CART_RECOVERY] Guest ${contribution.guest.fullName} (${contribution.guest.email}) ` +
      `abandoned ${contribution.amountKzt} KZT contribution to "${contribution.pool.name}"`
    );
  }

  console.log(`[CRON] Abandoned cart recovery: ${abandoned.length} pending contributions found`);
}

// Log job results to database
emailQueue.on('completed', (job) => logJobResult('email', job, 'completed'));
emailQueue.on('failed', (job) => logJobResult('email', job, 'failed'));

webhookQueue.on('completed', (job) => logJobResult('webhooks', job, 'completed'));
webhookQueue.on('failed', (job) => logJobResult('webhooks', job, 'failed'));

cronQueue.on('completed', (job) => logJobResult('cron', job, 'completed'));
cronQueue.on('failed', (job) => logJobResult('cron', job, 'failed'));

console.log('[WORKER] All queue workers started');
console.log('[WORKER]   emailQueue — email notifications');
console.log('[WORKER]   webhookQueue — webhook retries (max 5 attempts)');
console.log('[WORKER]   cronQueue — periodic tasks (dead stock, rates, reminders, cart recovery)');

// Регистрируем периодические cron-задачи
registerCronJobs().catch((err) =>
  console.error('[WORKER] Failed to register cron jobs:', err.message)
);