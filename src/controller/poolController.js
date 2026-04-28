import prisma from '../config/database.js';
import { AppError } from '../middleware/errorHandler.js';

/** @swagger
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
 *             $ref: '#/components/schemas/CreatePoolRequest'
 *     responses:
 *       201:
 *         description: Pool created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CreatePoolResponse'
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
 * Escrow State Machine transition:
 * PENDING -> FUNDING (activate the pool for contributions)
 * FUNDING -> FUNDED (when target reached, or manual close)
 * FUNDED -> PURCHASED (money spent on gift)
 * PURCHASED -> DELIVERED (gift delivered to couple)
 */
const VALID_TRANSITIONS = {
  PENDING: ['FUNDING'],
  FUNDING: ['FUNDED'],
  FUNDED: ['PURCHASED'],
  PURCHASED: ['DELIVERED'],
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
import prisma from '../config/database.js';

/** @swagger
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

  const wedding = await prisma.wedding.findUnique({
    where: { id: weddingId },
    select: { id: true, coupleId: true },
  });

  if (!wedding) {
    return res.status(404).json({ error: 'Wedding not found' });
  }

  if (wedding.coupleId !== req.user.id) {
    return res.status(403).json({ error: 'You can only create pools for your own wedding' });
  }

  const pool = await prisma.giftPool.create({
    data: {
      weddingId,
      name,
      description,
      targetKzt,
      remainingTarget: targetKzt,
      familyOnly: familyOnly || false,
    },
  });

  res.status(201).json(pool);
};};