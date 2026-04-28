import prisma from '../config/database.js';
import { AppError } from '../middleware/errorHandler.js';
import processPayment from '../service/paymentService.js';
import getExchangeRate from '../service/exchangeService.js';

export const createContribution = async (req, res) => {
  const { poolId, originalAmount, originalCurrency, idempotencyKey } = req.body;
  const guestId = req.user.id;

  if (originalAmount <= 0) {
    throw new AppError('Contribution amount must be positive', 400);
  }

  const result = await prisma.$transaction(async (tx) => {
    // Lock the pool row to prevent double-spending / overselling
    const [pool] = await tx.$queryRaw`
      SELECT id, wedding_id, target_kzt, remaining_target, total_funded, status, family_only
      FROM gift_pools
      WHERE id = ${poolId}
      FOR UPDATE
    `;

    if (!pool) {
      throw new AppError('Gift pool not found', 404);
    }

    if (pool.status === 'FUNDED' || pool.status === 'PURCHASED' || pool.status === 'DELIVERED') {
      throw new AppError('Pool is no longer accepting contributions', 400);
    }

    if (pool.status === 'PENDING') {
      throw new AppError('Pool is not yet open for contributions', 400);
    }

    // Lock exchange rate at moment of payment (currency snapshot)
    let amountKzt;
    let exchangeRate;

    if (originalCurrency === 'KZT') {
      amountKzt = Math.round(originalAmount);
      exchangeRate = 1;
    } else {
      exchangeRate = await getExchangeRate(originalCurrency, 'KZT');
      amountKzt = Math.round(originalAmount * exchangeRate);
    }

    if (amountKzt > pool.remaining_target) {
      throw new AppError(
        `Contribution ${amountKzt} KZT exceeds remaining target (${pool.remaining_target} KZT)`,
        400
      );
    }

    const payment = await processPayment(amountKzt, idempotencyKey);

    if (payment.status === 'COMPLETED') {
      // Create immutable historical row with locked exchange rate
      const contribution = await tx.contribution.create({
        data: {
          guestId,
          poolId,
          amountKzt,
          originalAmount,
          originalCurrency,
          exchangeRate,
          lockedAt: new Date(),
          paymentIntentId: payment.paymentIntentId,
          status: 'COMPLETED',
        },
      });

      const newRemaining = pool.remaining_target - amountKzt;

      await tx.giftPool.update({
        where: { id: poolId },
        data: {
          totalFunded: { increment: amountKzt },
          remainingTarget: newRemaining,
          status: newRemaining === 0 ? 'FUNDED' : 'FUNDING',
        },
      });

      return contribution;
    }

    throw new AppError('Payment processing failed', 502);
  });

  res.status(201).json(result);
};

/**
 * Get contributions for a pool with cursor-based pagination
 */
export const getContributions = async (req, res) => {
  const poolId = Number(req.params.poolId);
  const limit = Math.min(Math.abs(parseInt(req.query.limit, 10)) || 10, 100);
  const cursor = req.query.cursor ? parseInt(req.query.cursor, 10) : undefined;

  // Verify pool exists
  const pool = await prisma.giftPool.findUnique({
    where: { id: poolId },
    select: { id: true },
  });

  if (!pool) {
    throw new AppError('Gift pool not found', 404);
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

