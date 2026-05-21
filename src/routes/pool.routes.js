import { Router } from 'express';
import asyncHandler from '../utils/asyncHandler.js';
import auth from '../middleware/auth.js';
import roleCheck from '../middleware/roleCheck.js';
import validate, { createPoolSchema, updatePoolSchema } from '../middleware/validation.js';
import {
  createPool,
  listPools,
  getPool,
  updatePool,
  deletePool,
  purchasePool,
  deliverPool,
  updatePoolStatus,
} from '../controller/poolController.js';
const router = Router();

/**
 * @swagger
 * /pools:
 *   post:
 *     tags: [Pools]
 *     summary: "Create a new gift pool for a wedding"
 *     description: "COUPLE or SUPER_ADMIN only. First step in escrow state machine."
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
 *         description: "Pool created"
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CreatePoolResponse'
 *       400:
 *         description: "Validation error"
 *       403:
 *         description: "Forbidden"
 */
router.post('/', auth, roleCheck('COUPLE', 'SUPER_ADMIN'), validate(createPoolSchema), asyncHandler(createPool));
/**
 * @swagger
 * /pools:
 *   get:
 *     tags: [Pools]
 *     summary: "List all gift pools"
 *     security:
 *       - bearerAuth: []
  *     parameters:
 *       - in: query
 *         name: weddingId
 *         schema: { type: integer }
 *         description: "Filter by wedding ID"
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *       - in: query
 *         name: cursor
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: "Paginated list of pools"
 *       401:
 *         description: "Unauthorized"
 */
router.get('/', auth, asyncHandler(listPools));
/**
 * @swagger
 * /pools/{id}:
 *   get:
 *     tags: [Pools]
 *     summary: "Get a gift pool by ID"
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: "Pool details"
 *       404:
 *         description: "Pool not found"
 */
router.get('/:id', auth, asyncHandler(getPool));
/**
 * @swagger
 * /pools/{id}:
 *   patch:
 *     tags: [Pools]
 *     summary: "Update a gift pool (partial update)"
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
 *               name: { type: string, example: "Updated Kitchen Set" }
 *               description: { type: string }
 *               targetKzt: { type: integer, example: 600000 }
 *               privacy: { type: string, enum: [PUBLIC, FAMILY_ONLY, PRIVATE] }
 *               isFragile: { type: boolean }
 *     responses:
 *       200:
 *         description: "Pool updated"
 *       403:
 *         description: "Forbidden"
 *       404:
 *         description: "Pool not found"
 */
router.patch('/:id', auth, roleCheck('COUPLE', 'SUPER_ADMIN'), validate(updatePoolSchema), asyncHandler(updatePool));
/**
 * @swagger
 * /pools/{id}:
 *   delete:
 *     tags: [Pools]
 *     summary: "Delete a gift pool"
 *     description: "Only PENDING pools can be deleted."
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: "Pool deleted"
 *       400:
 *         description: "Cannot delete pool with contributions or non-PENDING status"
 *       403:
 *         description: "Forbidden"
 *       404:
 *         description: "Pool not found"
 */
router.delete('/:id', auth, roleCheck('COUPLE', 'SUPER_ADMIN'), asyncHandler(deletePool));
/**
 * @swagger
 * /pools/{id}/purchase:
 *   patch:
 *     tags: [Pools]
 *     summary: "Mark a funded pool as purchased"
 *     description: "Pool must be in FUNDED status. Third step in escrow state machine: PENDING → FUNDING → FUNDED → PURCHASED → DELIVERED"
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: "Pool marked as purchased"
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/GiftPool'
 *       400:
 *         description: "Pool is not in FUNDED status"
 *       403:
 *         description: "Forbidden"
 *       404:
 *         description: "Pool not found"
 */
router.patch('/:id/purchase', auth, roleCheck('COUPLE', 'SUPER_ADMIN'), asyncHandler(purchasePool));

/**
 * @swagger
 * /pools/{id}/deliver:
 *   patch:
 *     tags: [Pools]
 *     summary: "Mark a purchased pool as delivered"
 *     description: "Pool must be in PURCHASED status. Final step in escrow state machine."
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: "Pool marked as delivered"
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/GiftPool'
 *       400:
 *         description: "Pool is not in PURCHASED status"
 *       403:
 *         description: "Forbidden"
 *       404:
 *         description: "Pool not found"
 */
router.patch('/:id/deliver', auth, roleCheck('COUPLE', 'SUPER_ADMIN'), asyncHandler(deliverPool));

/**
 * @swagger
 * /pools/{id}/status:
 *   patch:
 *     tags: [Pools]
 *     summary: "Update pool status manually (e.g. PENDING → FUNDING)"
 *     description: "Follows the state machine: PENDING → FUNDING → FUNDED → PURCHASED → DELIVERED"
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
 *                 enum: [PENDING, FUNDING, FUNDED, PURCHASED, DELIVERED]
 *     responses:
 *       200:
 *         description: "Status updated"
 *       400:
 *         description: "Invalid transition"
 *       403:
 *         description: "Forbidden"
 *       404:
 *         description: "Pool not found"
 */
router.patch('/:id/status', auth, roleCheck('COUPLE', 'SUPER_ADMIN'), asyncHandler(updatePoolStatus));

export default router;