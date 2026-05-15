import prisma from '../config/database.js';
import { AppError } from '../middleware/errorHandler.js';
import processPayment from '../service/paymentService.js';
import getExchangeRate from '../service/exchangeService.js';
import { logAction } from '../service/auditService.js';
import { queueContributionNotification, queuePoolFundedNotification } from '../queue/producer.js';

const MIN_OBLIGATIONS = {
  ATA_ANA: 100000,
  ZHIEN_ZHARAP: 50000,
  SHAKYRT: 20000,
};

async function validateFamilyMinimum(userId, pool, amountKzt) {
  // Check if user is a family member of this wedding
  const familyMember = await prisma.familyTree.findFirst({
    where: {
      memberId: userId,
      weddingId: pool.weddingId,
    },
    select: { kinshipRank: true, giftObligation: true },
  });

  if (!familyMember) return; // Not a family member — no minimum

  // Get total contributed so far by this user to this wedding (including this contribution)
  const previousContributions = await prisma.contribution.aggregate({
    where: {
      guestId: userId,
      status: 'COMPLETED',
      pool: { weddingId: pool.weddingId },
      id: { not: undefined }, // all previous contributions
    },
    _sum: { amountKzt: true },
  });

  const prevTotalKzt = previousContributions._sum.amountKzt || 0;
  const totalAfter = prevTotalKzt + amountKzt;

  const minObligation = MIN_OBLIGATIONS[familyMember.kinshipRank] || 20000;
  const requiredObligation = familyMember.giftObligation || minObligation;

  // First contribution must meet or exceed the minimum per rank
  if (prevTotalKzt === 0 && amountKzt < requiredObligation) {
    throw new AppError(
      `As a ${familyMember.kinshipRank}, your first contribution must be at least ${requiredObligation.toLocaleString()} KZT total. Current contribution (${amountKzt.toLocaleString()} KZT) is below the minimum of ${requiredObligation.toLocaleString()} KZT.`,
      400
    );
  }

  // If they already contributed some but haven't met the obligation, this contribution combined should meet it
  if (prevTotalKzt > 0 && prevTotalKzt < requiredObligation && totalAfter < requiredObligation) {
    // Allow partial contributions as long as it's not the first
    return;
  }
}

export const createContribution = async (req, res) => {
  const { poolId, originalAmount, originalCurrency, idempotencyKey } = req.body;
  const guestId = req.user.id;

  if (originalAmount <= 0) {
    throw new AppError('Contribution amount must be positive', 400);
  }

  const result = await prisma.$transaction(async (tx) => {
    const pool = await tx.giftPool.findUnique({
      where: { id: poolId },
    });

    if (!pool) {
      throw new AppError('Gift pool not found', 404);
    }

                if (pool.status === 'FUNDED' || pool.status === 'PURCHASED' || pool.status === 'DELIVERED') {
      throw new AppError('Pool is no longer accepting contributions', 400);
    }

    
    if (pool.familyOnly && req.user.role === 'GUEST') {
      throw new AppError('This pool is for family members only', 403);
    }

    let amountKzt;
    let exchangeRate;

    if (originalCurrency === 'KZT') {
      amountKzt = Math.round(originalAmount);
      exchangeRate = 1;
    } else {
      exchangeRate = await getExchangeRate(originalCurrency, 'KZT');
      amountKzt = Math.round(originalAmount * exchangeRate);
    }

    if (amountKzt > pool.remainingTarget) {
      throw new AppError(
        `Contribution ${amountKzt} KZT exceeds remaining target (${pool.remainingTarget} KZT)`,
        400
      );
    }

    await validateFamilyMinimum(guestId, pool, amountKzt);

    const payment = await processPayment(amountKzt, idempotencyKey);

    if (payment.status === 'COMPLETED') {
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

      const newRemaining = pool.remainingTarget - amountKzt;

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

    await logAction({
    userId: req.user.id,
    action: 'CREATE_CONTRIBUTION',
    entityType: 'Contribution',
    entityId: result.id,
    newValue: {
      poolId,
      amountKzt: result.amountKzt,
      originalAmount: result.originalAmount,
      originalCurrency: result.originalCurrency,
      exchangeRate: result.exchangeRate,
      status: result.status,
    },
    ipAddress: req.ip,
  });

  res.status(201).json(result);

  try {
    const poolWithWedding = await prisma.giftPool.findUnique({
      where: { id: poolId },
      select: {
        wedding: {
          select: {
            title: true,
            couple: { select: { email: true, fullName: true } },
          },
        },
      },
    });

    if (poolWithWedding?.wedding?.couple) {
      const couple = poolWithWedding.wedding.couple;
      await queueContributionNotification(
        couple.email, couple.fullName,
        req.user.fullName || 'A guest',
        poolWithWedding.wedding.title, result.amountKzt
      );

      const updatedPool = await prisma.giftPool.findUnique({
        where: { id: poolId },
        select: { status: true, targetKzt: true, totalFunded: true, name: true },
      });

      if (updatedPool?.status === 'FUNDED') {
        await queuePoolFundedNotification(
          couple.email, couple.fullName,
          updatedPool.name, updatedPool.targetKzt, updatedPool.totalFunded
        );
      }
    }
  } catch (err) {
    console.error('[QUEUE] Notification queue error:', err.message);
  }
};

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
    const pool = await tx.giftPool.findUnique({
      where: { id: contribution.poolId },
    });

    if (!pool) {
      throw new AppError('Associated pool not found', 404);
    }

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

  await logAction({
    userId: req.user.id,
    action: 'REFUND_CONTRIBUTION',
    entityType: 'Contribution',
    entityId: contributionId,
    oldValue: { amountKzt: contribution.amountKzt, status: contribution.status, poolId: contribution.poolId },
    newValue: { status: 'REFUNDED' },
    ipAddress: req.ip,
  });

  res.json(result);
};


export const getContributions = async (req, res) => {
  const poolId = Number(req.params.poolId);
  const limit = Math.min(Math.abs(parseInt(req.query.limit, 10)) || 10, 100);
  const cursor = req.query.cursor ? parseInt(req.query.cursor, 10) : undefined;

  
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


export const getContributionsByCurrency = async (req, res) => {
  const weddingId = Number(req.params.weddingId);

  const wedding = await prisma.wedding.findUnique({
    where: { id: weddingId },
    select: { id: true, coupleId: true },
  });

  if (!wedding) {
    throw new AppError('Wedding not found', 404);
  }

  if (wedding.coupleId !== req.user.id && req.user.role !== 'SUPER_ADMIN') {
    throw new AppError('You can only view contributions for your own wedding', 403);
  }

  const contributions = await prisma.contribution.findMany({
    where: {
      status: 'COMPLETED',
      pool: { weddingId },
    },
    include: {
      pool: { select: { id: true, name: true } },
      guest: { select: { id: true, fullName: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  const byCurrency = {};
  for (const c of contributions) {
    const currency = c.originalCurrency;
    if (!byCurrency[currency]) {
      byCurrency[currency] = {
        currency,
        totalOriginalAmount: 0,
        totalKzt: 0,
        count: 0,
        contributions: [],
      };
    }
    byCurrency[currency].totalOriginalAmount += c.originalAmount;
    byCurrency[currency].totalKzt += c.amountKzt;
    byCurrency[currency].count += 1;
    byCurrency[currency].contributions.push({
      id: c.id,
      amountKzt: c.amountKzt,
      originalAmount: c.originalAmount,
      originalCurrency: c.originalCurrency,
      exchangeRate: c.exchangeRate,
      lockedAt: c.lockedAt,
      createdAt: c.createdAt,
      poolName: c.pool.name,
      guestName: c.guest?.fullName || 'Anonymous',
    });
  }

  const currencyBreakdown = Object.values(byCurrency);

  const totals = {
    totalKzt: contributions.reduce((sum, c) => sum + c.amountKzt, 0),
    totalContributions: contributions.length,
    totalPools: new Set(contributions.map(c => c.poolId)).size,
  };

  res.json({
    weddingId,
    totals,
    currencyBreakdown,
  });
};

