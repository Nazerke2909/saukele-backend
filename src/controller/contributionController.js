import prisma from '../config/database.js';
import { AppError } from '../middleware/errorHandler.js';
import processPayment from '../service/paymentService.js';
import getExchangeRate, { recordExchangeRateSnapshot } from '../service/exchangeService.js';
import { canAccessPool } from '../middleware/privacyGuard.js';
import { logAction } from '../service/auditService.js';

export const createContribution = async (req, res) => {
  const { poolId, originalAmount, originalCurrency, idempotencyKey } = req.body;

  if (!poolId || originalAmount === undefined || !originalCurrency || !idempotencyKey) {
    throw new AppError('poolId, originalAmount, originalCurrency, idempotencyKey are required', 400);
  }

  const pool = await prisma.giftPool.findUnique({
    where: { id: poolId },
    include: {
      wedding: { select: { id: true, coupleId: true, title: true } },
    },
  });

  if (!pool) {
    throw new AppError('Gift pool not found', 404);
  }

  // 🆕 Проверка приватности через canAccessPool (вместо разрозненных проверок)
  if (!canAccessPool(req.user, pool)) {
    throw new AppError('You do not have access to this gift pool', 403);
  }

  if (pool.status !== 'PENDING' && pool.status !== 'FUNDING') {
    throw new AppError('Pool is not open for contributions', 400);
  }

  const normalizedCurrency = originalCurrency.toUpperCase();

  const exchangeRate = await getExchangeRate(normalizedCurrency, 'KZT');
  const amountKzt = Math.round(originalAmount * exchangeRate);

  if (amountKzt <= 0) {
    throw new AppError('Contribution amount must be positive', 400);
  }

  const contribution = await prisma.$transaction(async (tx) => {
    const currentPool = await tx.giftPool.findUnique({
      where: { id: poolId },
      select: { remainingTarget: true, totalFunded: true },
    });

    if (amountKzt > currentPool.remainingTarget) {
      throw new AppError(
        `Contribution ${amountKzt} KZT exceeds remaining target ${currentPool.remainingTarget} KZT`,
        400
      );
    }

    const existing = await tx.contribution.findUnique({
      where: { paymentIntentId: idempotencyKey },
    });

    if (existing) {
      return existing;
    }

    const paymentResult = await processPayment({
      amount: originalAmount,
      currency: normalizedCurrency,
      idempotencyKey,
    });

    if (!paymentResult.success) {
      const failedContribution = await tx.contribution.create({
        data: {
          guestId: req.user.id,
          poolId,
          amountKzt,
          originalAmount,
          originalCurrency: normalizedCurrency,
          exchangeRate,
          status: 'FAILED',
          paymentIntentId: idempotencyKey,
        },
      });
      throw new AppError(`Payment failed: ${paymentResult.error}`, 402);
    }

    const newTotalFunded = currentPool.totalFunded + amountKzt;
    const newRemaining = currentPool.remainingTarget - amountKzt;
    const newStatus = newRemaining === 0 ? 'FUNDED' : 'FUNDING';

    await tx.giftPool.update({
      where: { id: poolId },
      data: {
        totalFunded: newTotalFunded,
        remainingTarget: newRemaining,
        status: newStatus,
      },
    });

    await recordExchangeRateSnapshot(normalizedCurrency, 'KZT', exchangeRate);

    const newContribution = await tx.contribution.create({
      data: {
        guestId: req.user.id,
        poolId,
        amountKzt,
        originalAmount,
        originalCurrency: normalizedCurrency,
        exchangeRate,
        status: 'COMPLETED',
        paymentIntentId: idempotencyKey,
      },
    });

    return newContribution;
  });

  res.status(201).json(contribution);
};

export const getMyContributions = async (req, res) => {
  const limit = Math.min(Math.abs(parseInt(req.query.limit, 10)) || 10, 50);
  const cursor = req.query.cursor ? parseInt(req.query.cursor, 10) : undefined;

  const contributions = await prisma.contribution.findMany({
    where: { guestId: req.user.id },
    take: limit + 1,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    orderBy: { createdAt: 'desc' },
    include: {
      pool: {
        select: {
          id: true,
          name: true,
          privacy: true,
          wedding: { select: { id: true, title: true } },
        },
      },
    },
  });

  const hasNextPage = contributions.length > limit;
  const data = hasNextPage ? contributions.slice(0, limit) : contributions;
  const nextCursor = hasNextPage ? data[data.length - 1].id : null;

  res.json({
    data,
    pagination: {
      limit,
      nextCursor,
      hasNextPage,
    },
  });
};

export const getPoolContributions = async (req, res) => {
  const poolId = Number(req.params.poolId);
  const limit = Math.min(Math.abs(parseInt(req.query.limit, 10)) || 10, 50);
  const cursor = req.query.cursor ? parseInt(req.query.cursor, 10) : undefined;

  const pool = await prisma.giftPool.findUnique({
    where: { id: poolId },
    include: {
      wedding: { select: { coupleId: true } },
    },
  });

  if (!pool) {
    throw new AppError('Gift pool not found', 404);
  }

  // 🆕 Проверка приватности
  if (!canAccessPool(req.user, pool)) {
    throw new AppError('You do not have access to this gift pool', 403);
  }

  const contributions = await prisma.contribution.findMany({
    where: { poolId },
    take: limit + 1,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    orderBy: { createdAt: 'desc' },
    include: {
      guest: { select: { id: true, fullName: true } },
    },
  });

  const hasNextPage = contributions.length > limit;
  const data = hasNextPage ? contributions.slice(0, limit) : contributions;
  const nextCursor = hasNextPage ? data[data.length - 1].id : null;

  res.json({
    data,
    pagination: {
      limit,
      nextCursor,
      hasNextPage,
    },
  });
};

export const deleteContribution = async (req, res) => {
  const contributionId = Number(req.params.id);

  const contribution = await prisma.contribution.findUnique({
    where: { id: contributionId },
    include: {
      pool: {
        select: {
          id: true,
          totalFunded: true,
          remainingTarget: true,
          status: true,
          wedding: { select: { coupleId: true } },
        },
      },
    },
  });

  if (!contribution) {
    throw new AppError('Contribution not found', 404);
  }

  // SUPER_ADMIN может удалить любой вклад
  if (req.user.role !== 'SUPER_ADMIN') {
    throw new AppError('Only SUPER_ADMIN can delete contributions', 403);
  }

  if (contribution.status !== 'COMPLETED' && contribution.status !== 'FAILED') {
    throw new AppError('Can only delete COMPLETED or FAILED contributions', 400);
  }

  await prisma.$transaction(async (tx) => {
    if (contribution.status === 'COMPLETED') {
      const newTotalFunded = contribution.pool.totalFunded - contribution.amountKzt;
      const newRemaining = contribution.pool.remainingTarget + contribution.amountKzt;

      await tx.giftPool.update({
        where: { id: contribution.poolId },
        data: {
          totalFunded: newTotalFunded,
          remainingTarget: newRemaining,
          status: 'FUNDING',
        },
      });
    }

    await tx.contribution.update({
      where: { id: contributionId },
      data: { status: 'REFUNDED' },
    });
  });

  await logAction({
    userId: req.user.id,
    action: 'DELETE_CONTRIBUTION',
    entityType: 'Contribution',
    entityId: contributionId,
    oldValue: {
      amountKzt: contribution.amountKzt,
      status: contribution.status,
      poolId: contribution.poolId,
    },
    newValue: { status: 'REFUNDED' },
    ipAddress: req.ip,
  });

  res.json({ message: 'Contribution refunded successfully' });
};