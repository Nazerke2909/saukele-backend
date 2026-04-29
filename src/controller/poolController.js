import prisma from '../config/database.js';
import { AppError } from '../middleware/errorHandler.js';

const VALID_TRANSITIONS = {
  PENDING: ['FUNDING'],
  FUNDING: ['FUNDED'],
  FUNDED: ['PURCHASED'],
  PURCHASED: ['DELIVERED'],
};

/**
 * @swagger
 * /pools:
 *   post:
 *     tags: [Pools]
 *     summary: Create a gift pool (COUPLE or SUPER_ADMIN)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [weddingId, name, targetKzt]
 *             properties:
 *               weddingId: { type: integer, example: 1 }
 *               name: { type: string, example: "Kitchen Set" }
 *               description: { type: string }
 *               targetKzt: { type: integer, example: 500000 }
 *               familyOnly: { type: boolean, default: false }
 *     responses:
 *       201:
 *         description: Pool created
 */
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

  res.status(201).json(pool);
};

/**
 * @swagger
 * /pools:
 *   get:
 *     tags: [Pools]
 *     summary: List all pools for a wedding (query ?weddingId=)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: weddingId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Array of pools
 */
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

  const pools = await prisma.giftPool.findMany({
    where: { weddingId },
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { contributions: true } } },
  });

  res.json(pools);
};

/**
 * @swagger
 * /pools/{id}:
 *   get:
 *     tags: [Pools]
 *     summary: Get pool details
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Pool details
 *       404:
 *         description: Pool not found
 */
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

  res.json(pool);
};

/**
 * @swagger
 * /pools/{id}:
 *   put:
 *     tags: [Pools]
 *     summary: Update pool name or target amount
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string, example: "New Kitchen Set" }
 *               targetKzt: { type: integer, example: 600000 }
 *     responses:
 *       200:
 *         description: Pool updated
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Not found
 */
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

  res.json(updated);
};

/**
 * @swagger
 * /pools/{id}:
 *   delete:
 *     tags: [Pools]
 *     summary: Delete a pool (only if no contributions)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Pool deleted
 *       400:
 *         description: Pool has contributions, cannot delete
 *       403:
 *         description: Forbidden
 */
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

  await prisma.giftPool.delete({ where: { id: poolId } });

  res.json({ message: 'Pool deleted successfully' });
};

/**
 * @swagger
 * /pools/{id}/status:
 *   patch:
 *     tags: [Pools]
 *     summary: Transition pool status (Escrow State Machine)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [FUNDING, FUNDED, PURCHASED, DELIVERED]
 *     responses:
 *       200:
 *         description: Status updated
 *       400:
 *         description: Invalid transition
 *       404:
 *         description: Pool not found
 */
export const updatePoolStatus = async (req, res) => {
  const poolId = Number(req.params.id);
  const { status: newStatus } = req.body;

  const pool = await prisma.giftPool.findUnique({
    where: { id: poolId },
    select: { id: true, status: true, wedding: { select: { coupleId: true } } },
  });

  if (!pool) {
    throw new AppError('Gift pool not found', 404);
  }

  if (pool.wedding.coupleId !== req.user.id && req.user.role !== 'SUPER_ADMIN') {
    throw new AppError('You can only update your own pool', 403);
  }

  const allowedTransitions = VALID_TRANSITIONS[pool.status];
  if (!allowedTransitions || !allowedTransitions.includes(newStatus)) {
    throw new AppError(
      `Invalid status transition: ${pool.status} -> ${newStatus}. Allowed: ${allowedTransitions?.join(', ') || 'none'}`,
      400
    );
  }

  const updated = await prisma.giftPool.update({
    where: { id: poolId },
    data: { status: newStatus },
  });

  res.json(updated);
};