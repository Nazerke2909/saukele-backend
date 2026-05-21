import prisma from '../config/database.js';
import { AppError } from '../middleware/errorHandler.js';
import { logAction } from '../service/auditService.js';
import getExchangeRate from '../service/exchangeService.js';
import { canAccessPool, canEditPool, buildPrivacyFilter } from '../middleware/privacyGuard.js';

const VALID_TRANSITIONS = {
  PENDING: ['FUNDING'],
  FUNDING: ['FUNDED'],
  FUNDED: ['PURCHASED'],
  PURCHASED: ['DELIVERED'],
};

export const createPool = async (req, res) => {
  const { weddingId, name, description, targetKzt, targetAmount, targetCurrency, privacy, isFragile } = req.body;

  // 🆕 Multi-currency target support
  let finalTargetKzt = targetKzt;
  let normTargetAmount = targetAmount || null;
  let normTargetCurrency = (targetCurrency || 'KZT').toUpperCase();

  if (targetAmount !== undefined && normTargetCurrency !== 'KZT') {
    if (targetKzt !== undefined) {
      throw new AppError('Specify either targetKzt OR targetAmount+targetCurrency, not both', 400);
    }
    if (targetAmount <= 0) {
      throw new AppError('targetAmount must be positive', 400);
    }
    const rate = await getExchangeRate(normTargetCurrency, 'KZT');
    finalTargetKzt = Math.round(targetAmount * rate);
  }

  if (finalTargetKzt <= 0) {
    throw new AppError('Target amount must be positive', 400);
  }

  const wedding = await prisma.wedding.findUnique({
    where: { id: weddingId },
    select: { id: true, coupleId: true },
  });

  if (!wedding) {
    throw new AppError('Wedding not found', 404);
  }

  if (wedding.coupleId !== req.user.id && req.user.role !== 'SUPER_ADMIN') {
    throw new AppError('You can only create pools for your own wedding', 403);
  }

  // 🆕 Валидация privacy
  const validPrivacy = ['PUBLIC', 'FAMILY_ONLY', 'PRIVATE'];
  const poolPrivacy = privacy || 'PUBLIC';
  if (!validPrivacy.includes(poolPrivacy)) {
    throw new AppError(`Invalid privacy value. Valid values: ${validPrivacy.join(', ')}`, 400);
  }

  const pool = await prisma.giftPool.create({
    data: {
      weddingId,
      name,
      description,
      targetKzt: finalTargetKzt,
      targetAmount: normTargetAmount,
      targetCurrency: normTargetCurrency,
      remainingTarget: finalTargetKzt,
      privacy: poolPrivacy,
      isFragile: isFragile || false,
      status: 'PENDING',
    },
  });

  await logAction({
    userId: req.user.id,
    action: 'CREATE_POOL',
    entityType: 'GiftPool',
    entityId: pool.id,
    newValue: {
      weddingId, name,
      targetKzt: finalTargetKzt,
      targetAmount: normTargetAmount,
      targetCurrency: normTargetCurrency,
      privacy: poolPrivacy,
      isFragile: isFragile || false,
    },
    ipAddress: req.ip,
  });

  res.status(201).json(pool);
};

// В функции listPools — исправленный вызов buildPrivacyFilter

export const listPools = async (req, res) => {
  const weddingId = req.query.weddingId ? Number(req.query.weddingId) : null;

  let whereClause = {};

  if (weddingId) {
    const wedding = await prisma.wedding.findUnique({
      where: { id: weddingId },
      select: { id: true, coupleId: true },
    });

    if (!wedding) {
      throw new AppError('Wedding not found', 404);
    }

    // 🆕 Используем privacyFilter с передачей coupleId
    whereClause = buildPrivacyFilter(req.user, weddingId, wedding.coupleId);
  }

  const limit = Math.min(Math.abs(parseInt(req.query.limit, 10)) || 10, 50);
  const cursor = req.query.cursor ? parseInt(req.query.cursor, 10) : undefined;

  const pools = await prisma.giftPool.findMany({
    where: whereClause,
    take: limit + 1,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { contributions: true } } },
  });

  const hasNextPage = pools.length > limit;
  const data = hasNextPage ? pools.slice(0, limit) : pools;
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

export const getPool = async (req, res) => {
  const poolId = Number(req.params.id);

  const pool = await prisma.giftPool.findUnique({
    where: { id: poolId },
    include: {
      wedding: { select: { id: true, title: true, coupleId: true } },
      _count: { select: { contributions: true } },
    },
  });

  if (!pool) {
    throw new AppError('Gift pool not found', 404);
  }

  // 🆕 Используем canAccessPool вместо старой проверки
  if (!canAccessPool(req.user, pool)) {
    throw new AppError('You do not have access to this gift pool', 403);
  }

  res.json(pool);
};

/**
 * GET /pools/{id}/progress?currency=USD
 * Returns pool funding progress in the selected (or base) currency
 * using locked exchange rates from contributions.
 */
export const getPoolProgress = async (req, res) => {
  const poolId = Number(req.params.id);
  const displayCurrency = (req.query.currency || 'KZT').toUpperCase();

  const pool = await prisma.giftPool.findUnique({
    where: { id: poolId },
    include: {
      wedding: { select: { id: true, title: true, coupleId: true } },
      _count: { select: { contributions: true } },
    },
  });

  if (!pool) {
    throw new AppError('Gift pool not found', 404);
  }

  // 🆕 Используем canAccessPool
  if (!canAccessPool(req.user, pool)) {
    throw new AppError('You do not have access to this gift pool', 403);
  }

  // Get all completed contributions with their locked rates
  const contributions = await prisma.contribution.findMany({
    where: { poolId, status: 'COMPLETED' },
    orderBy: { createdAt: 'desc' },
    include: {
      guest: { select: { id: true, fullName: true } },
    },
  });

  // Group by original currency
  const byCurrency = {};
  for (const c of contributions) {
    const cur = c.originalCurrency;
    if (!byCurrency[cur]) {
      byCurrency[cur] = {
        currency: cur,
        totalOriginal: 0,
        totalKzt: 0,
        count: 0,
      };
    }
    byCurrency[cur].totalOriginal += c.originalAmount;
    byCurrency[cur].totalKzt += c.amountKzt;
    byCurrency[cur].count += 1;
  }

  // Convert pool totals to display currency
  let displayTarget;
  let displayFunded;
  let displayRemaining;
  let displayRate = 1;

  if (displayCurrency === 'KZT') {
    displayTarget = pool.targetKzt;
    displayFunded = pool.totalFunded;
    displayRemaining = pool.remainingTarget;
  } else if (displayCurrency === pool.targetCurrency && pool.targetAmount) {
    const rateFromKzt = pool.targetKzt / pool.targetAmount;
    displayTarget = pool.targetAmount;
    displayFunded = parseFloat((pool.totalFunded / rateFromKzt).toFixed(2));
    displayRemaining = parseFloat((pool.remainingTarget / rateFromKzt).toFixed(2));
  } else {
    try {
      displayRate = await getExchangeRate(displayCurrency, 'KZT');
      displayTarget = parseFloat((pool.targetKzt / displayRate).toFixed(2));
      displayFunded = parseFloat((pool.totalFunded / displayRate).toFixed(2));
      displayRemaining = parseFloat((pool.remainingTarget / displayRate).toFixed(2));
    } catch {
      throw new AppError(`Exchange rate not found for ${displayCurrency} → KZT`, 400);
    }
  }

  const progressPercent = pool.targetKzt > 0
    ? Math.round((pool.totalFunded / pool.targetKzt) * 100 * 100) / 100
    : 0;

  const breakdownInDisplayCurrency = [];
  for (const group of Object.values(byCurrency)) {
    let displayAmount;
    if (group.currency === displayCurrency) {
      displayAmount = group.totalOriginal;
    } else if (displayCurrency === 'KZT') {
      displayAmount = group.totalKzt;
    } else {
      try {
        const rate = await getExchangeRate(displayCurrency, 'KZT');
        displayAmount = parseFloat((group.totalKzt / rate).toFixed(2));
      } catch {
        displayAmount = null;
      }
    }
    breakdownInDisplayCurrency.push({
      ...group,
      totalInDisplayCurrency: displayAmount,
      displayCurrency,
    });
  }

  const contributionDetails = contributions.map(c => {
    let displayAmount;
    if (displayCurrency === 'KZT') {
      displayAmount = c.amountKzt;
    } else if (c.originalCurrency === displayCurrency) {
      displayAmount = c.originalAmount;
    } else {
      displayAmount = parseFloat((c.amountKzt / displayRate).toFixed(2));
    }

    return {
      id: c.id,
      guestId: c.guestId,
      guestName: c.guest?.fullName || 'Anonymous',
      originalAmount: c.originalAmount,
      originalCurrency: c.originalCurrency,
      exchangeRate: c.exchangeRate,
      lockedAt: c.lockedAt,
      amountKzt: c.amountKzt,
      displayAmount,
      displayCurrency,
    };
  });

  res.json({
    poolId: pool.id,
    poolName: pool.name,
    weddingTitle: pool.wedding.title,
    status: pool.status,
    privacy: pool.privacy,
    targetCurrency: pool.targetCurrency || 'KZT',
    targetOriginalAmount: pool.targetAmount || pool.targetKzt,
    targetInKzt: pool.targetKzt,
    displayCurrency,
    progress: {
      target: displayTarget,
      funded: displayFunded,
      remaining: displayRemaining,
      percentage: progressPercent,
    },
    summary: {
      totalContributions: contributions.length,
      uniqueCurrencies: Object.keys(byCurrency).length,
    },
    currencyBreakdown: breakdownInDisplayCurrency,
    contributions: contributionDetails,
  });
};

export const updatePool = async (req, res) => {
  const poolId = Number(req.params.id);
  const { name, targetKzt, privacy, isFragile } = req.body;

  const pool = await prisma.giftPool.findUnique({
    where: { id: poolId },
    select: {
      id: true,
      status: true,
      targetKzt: true,
      totalFunded: true,
      privacy: true,
      isFragile: true,
      wedding: { select: { coupleId: true } },
    },
  });

  if (!pool) {
    throw new AppError('Gift pool not found', 404);
  }

  // 🆕 Используем canEditPool
  if (!canEditPool(req.user, pool)) {
    throw new AppError('You can only update your own pool', 403);
  }

  if (pool.status !== 'PENDING' && pool.status !== 'FUNDING') {
    throw new AppError('Can only edit PENDING or FUNDING pools', 400);
  }

  if (targetKzt !== undefined) {
    if (targetKzt <= 0) {
      throw new AppError('Target amount must be positive', 400);
    }
    if (targetKzt < pool.totalFunded) {
      throw new AppError('New target cannot be less than already funded amount', 400);
    }
  }

  // 🆕 Валидация privacy
  if (privacy !== undefined) {
    const validPrivacy = ['PUBLIC', 'FAMILY_ONLY', 'PRIVATE'];
    if (!validPrivacy.includes(privacy)) {
      throw new AppError(`Invalid privacy value. Valid values: ${validPrivacy.join(', ')}`, 400);
    }
  }

  const oldPool = await prisma.giftPool.findUnique({
    where: { id: poolId },
    select: { name: true, targetKzt: true, remainingTarget: true, privacy: true, isFragile: true },
  });

  const updated = await prisma.giftPool.update({
    where: { id: poolId },
    data: {
      ...(name && { name }),
      ...(targetKzt !== undefined && {
        targetKzt,
        remainingTarget: targetKzt - pool.totalFunded,
      }),
      ...(privacy !== undefined && { privacy }),
      ...(isFragile !== undefined && { isFragile }),
    },
  });

  await logAction({
    userId: req.user.id,
    action: 'UPDATE_POOL',
    entityType: 'GiftPool',
    entityId: poolId,
    oldValue: oldPool,
    newValue: {
      name: updated.name,
      targetKzt: updated.targetKzt,
      remainingTarget: updated.remainingTarget,
      privacy: updated.privacy,
      isFragile: updated.isFragile,
    },
    ipAddress: req.ip,
  });

  res.json(updated);
};

export const deletePool = async (req, res) => {
  const poolId = Number(req.params.id);

  const pool = await prisma.giftPool.findUnique({
    where: { id: poolId },
    select: {
      id: true,
      privacy: true,
      wedding: { select: { coupleId: true } },
      _count: { select: { contributions: true } },
    },
  });

  if (!pool) {
    throw new AppError('Gift pool not found', 404);
  }

  // 🆕 Используем canEditPool
  if (!canEditPool(req.user, pool)) {
    throw new AppError('You can only delete your own pool', 403);
  }

  if (pool._count.contributions > 0) {
    throw new AppError('Cannot delete pool with existing contributions', 400);
  }

  const deletedPool = await prisma.giftPool.findUnique({
    where: { id: poolId },
    select: { name: true, targetKzt: true, status: true, privacy: true },
  });

  await prisma.giftPool.delete({ where: { id: poolId } });

  await logAction({
    userId: req.user.id,
    action: 'DELETE_POOL',
    entityType: 'GiftPool',
    entityId: poolId,
    oldValue: deletedPool,
    ipAddress: req.ip,
  });

  res.json({ message: 'Pool deleted successfully' });
};

export const purchasePool = async (req, res) => {
  const poolId = Number(req.params.id);

  const pool = await prisma.giftPool.findUnique({
    where: { id: poolId },
    select: {
      id: true,
      status: true,
      totalFunded: true,
      targetKzt: true,
      wedding: { select: { coupleId: true } },
    },
  });

  if (!pool) {
    throw new AppError('Gift pool not found', 404);
  }

  if (!canEditPool(req.user, pool)) {
    throw new AppError('You can only manage your own pool', 403);
  }

  if (pool.status !== 'FUNDED') {
    throw new AppError('Pool must be in FUNDED status to mark as purchased', 400);
  }

  const updated = await prisma.giftPool.update({
    where: { id: poolId },
    data: { status: 'PURCHASED' },
  });

  await logAction({
    userId: req.user.id,
    action: 'STATUS_CHANGE',
    entityType: 'GiftPool',
    entityId: poolId,
    oldValue: { status: 'FUNDED' },
    newValue: { status: 'PURCHASED' },
    ipAddress: req.ip,
  });

  res.json(updated);
};

export const updatePoolStatus = async (req, res) => {
  const poolId = Number(req.params.id);
  const { status } = req.body;

  const pool = await prisma.giftPool.findUnique({
    where: { id: poolId },
    select: { id: true, status: true, wedding: { select: { coupleId: true } } },
  });

  if (!pool) {
    throw new AppError('Gift pool not found', 404);
  }

  if (!canEditPool(req.user, pool)) {
    throw new AppError('You can only manage your own pool', 403);
  }

  const allowedNext = VALID_TRANSITIONS[pool.status];
  if (!allowedNext || !allowedNext.includes(status)) {
    throw new AppError(
      `Cannot change status from ${pool.status} to ${status}. Allowed transitions: ${(allowedNext || []).join(', ') || 'none'}`,
      400
    );
  }

  const updated = await prisma.giftPool.update({
    where: { id: poolId },
    data: { status },
  });

  await logAction({
    userId: req.user.id,
    action: 'STATUS_CHANGE',
    entityType: 'GiftPool',
    entityId: poolId,
    oldValue: { status: pool.status },
    newValue: { status },
    ipAddress: req.ip,
  });

  res.json(updated);
};

export const deliverPool = async (req, res) => {
  const poolId = Number(req.params.id);

  const pool = await prisma.giftPool.findUnique({
    where: { id: poolId },
    select: { id: true, status: true, wedding: { select: { coupleId: true } } },
  });

  if (!pool) {
    throw new AppError('Gift pool not found', 404);
  }

  if (!canEditPool(req.user, pool)) {
    throw new AppError('You can only manage your own pool', 403);
  }

  if (pool.status !== 'PURCHASED') {
    throw new AppError('Pool must be in PURCHASED status to mark as delivered', 400);
  }

  const updated = await prisma.giftPool.update({
    where: { id: poolId },
    data: { status: 'DELIVERED' },
  });

  await logAction({
    userId: req.user.id,
    action: 'STATUS_CHANGE',
    entityType: 'GiftPool',
    entityId: poolId,
    oldValue: { status: 'PURCHASED' },
    newValue: { status: 'DELIVERED' },
    ipAddress: req.ip,
  });

  res.json(updated);
};