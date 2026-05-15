import prisma from '../config/database.js';
import { AppError } from '../middleware/errorHandler.js';
import { logAction } from '../service/auditService.js';

const VALID_TRANSITIONS = {
  PENDING: ['FUNDING'],
  FUNDING: ['FUNDED'],
  FUNDED: ['PURCHASED'],
  PURCHASED: ['DELIVERED'],
};

export const createPool = async (req, res) => {
  const { weddingId, name, description, targetKzt, familyOnly } = req.body;

  if (targetKzt <= 0) {
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

    const pool = await prisma.giftPool.create({
    data: {
      weddingId,
      name,
      description,
      targetKzt,
      remainingTarget: targetKzt,
      familyOnly: familyOnly || false,
      status: 'PENDING',
    },
  });

  await logAction({
    userId: req.user.id,
    action: 'CREATE_POOL',
    entityType: 'GiftPool',
    entityId: pool.id,
    newValue: { weddingId, name, targetKzt, familyOnly },
    ipAddress: req.ip,
  });

  res.status(201).json(pool);
};

export const listPools = async (req, res) => {
  const weddingId = Number(req.query.weddingId);

  if (!weddingId) {
    throw new AppError('weddingId query param is required', 400);
  }

  const wedding = await prisma.wedding.findUnique({
    where: { id: weddingId },
    select: { id: true, coupleId: true },
  });

  if (!wedding) {
    throw new AppError('Wedding not found', 404);
  }

  let whereClause = { weddingId };
  if (req.user.role === 'GUEST') {
    whereClause.familyOnly = false;
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
      wedding: { select: { id: true, title: true } },
      _count: { select: { contributions: true } },
    },
  });

  if (!pool) {
    throw new AppError('Gift pool not found', 404);
  }

  if (pool.familyOnly && req.user.role === 'GUEST') {
    throw new AppError('This pool is for family members only', 403);
  }

  res.json(pool);
};

export const updatePool = async (req, res) => {
  const poolId = Number(req.params.id);
  const { name, targetKzt } = req.body;

  const pool = await prisma.giftPool.findUnique({
    where: { id: poolId },
    select: {
      id: true,
      status: true,
      targetKzt: true,
      totalFunded: true,
      wedding: { select: { coupleId: true } },
    },
  });

  if (!pool) {
    throw new AppError('Gift pool not found', 404);
  }

  if (pool.wedding.coupleId !== req.user.id && req.user.role !== 'SUPER_ADMIN') {
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

    const oldPool = await prisma.giftPool.findUnique({
    where: { id: poolId },
    select: { name: true, targetKzt: true, remainingTarget: true },
  });

  const updated = await prisma.giftPool.update({
    where: { id: poolId },
    data: {
      ...(name && { name }),
      ...(targetKzt !== undefined && {
        targetKzt,
        remainingTarget: targetKzt - pool.totalFunded,
      }),
    },
  });

  await logAction({
    userId: req.user.id,
    action: 'UPDATE_POOL',
    entityType: 'GiftPool',
    entityId: poolId,
    oldValue: oldPool,
    newValue: { name: updated.name, targetKzt: updated.targetKzt, remainingTarget: updated.remainingTarget },
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
      wedding: { select: { coupleId: true } },
      _count: { select: { contributions: true } },
    },
  });

  if (!pool) {
    throw new AppError('Gift pool not found', 404);
  }

  if (pool.wedding.coupleId !== req.user.id && req.user.role !== 'SUPER_ADMIN') {
    throw new AppError('You can only delete your own pool', 403);
  }

  if (pool._count.contributions > 0) {
    throw new AppError('Cannot delete pool with existing contributions', 400);
  }

    const deletedPool = await prisma.giftPool.findUnique({
    where: { id: poolId },
    select: { name: true, targetKzt: true, status: true },
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
    select: { id: true, status: true, totalFunded: true, targetKzt: true, wedding: { select: { coupleId: true } } },
  });

  if (!pool) {
    throw new AppError('Gift pool not found', 404);
  }

  if (pool.wedding.coupleId !== req.user.id && req.user.role !== 'SUPER_ADMIN') {
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

  if (pool.wedding.coupleId !== req.user.id && req.user.role !== 'SUPER_ADMIN') {
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

  if (pool.wedding.coupleId !== req.user.id && req.user.role !== 'SUPER_ADMIN') {
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