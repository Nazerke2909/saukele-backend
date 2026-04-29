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
 * @swagger
 * /contributions/my:
 *   get:
 *     tags: [Contributions]
 *     summary: Get my contribution history
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *       - in: query
 *         name: cursor
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Paginated list of my contributions
 */
export const getMyContributions = async (req, res) => {
  const limit = Math.min(Math.abs(parseInt(req.query.limit, 10)) || 10, 100);
  const cursor = req.query.cursor ? parseInt(req.query.cursor, 10) : undefined;

  const contributions = await prisma.contribution.findMany({
    where: { guestId: req.user.id },
    take: limit + 1,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { createdAt: 'desc' },
    include: {
      pool: {
        select: { id: true, name: true, wedding: { select: { title: true } } },
    },
    },
  });

  const hasNextPage = contributions.length > limit;
  const data = hasNextPage ? contributions.slice(0, limit) : contributions;
  const nextCursor = hasNextPage ? data[data.length - 1].id : null;

  res.json({ data, pagination: { limit, nextCursor, hasNextPage } });
};

/**
 * @swagger
 * /contributions/{id}:
 *   delete:
 *     tags: [Contributions]
 *     summary: Cancel/delete a contribution (SUPER_ADMIN only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Contribution cancelled and pool refunded
 *       403:
 *         description: Forbidden — admin only
 *       404:
 *         description: Contribution not found
 */
export const deleteContribution = async (req, res) => {
  const contributionId = Number(req.params.id);

  const contribution = await prisma.contribution.findUnique({
    where: { id: contributionId },
    include: { pool: { select: { id: true } } },
  });

  if (!contribution) {
    throw new AppError('Contribution not found', 404);
  }

  const result = await prisma.$transaction(async (tx) => {
    const [pool] = await tx.$queryRaw`
      SELECT id, remaining_target, total_funded, status
      FROM gift_pools
      WHERE id = ${contribution.poolId}
      FOR UPDATE
    `;

    if (!pool) {
      throw new AppError('Associated pool not found', 404);
    }

    // Refund: decrement total, increment remaining
    await tx.giftPool.update({
      where: { id: pool.id },
      data: {
        totalFunded: { decrement: contribution.amountKzt },
        remainingTarget: { increment: contribution.amountKzt },
        status: 'FUNDING',
      },
    });

    await tx.contribution.update({
      where: { id: contributionId },
      data: { status: 'REFUNDED' },
    });

    return { message: 'Contribution cancelled and refunded' };
  });

  res.json(result);
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

