import { Router } from 'express';
import asyncHandler from '../utils/asyncHandler.js';
import auth from '../middleware/auth.js';
import { createContribution, getContributions } from '../controller/contributionController.js';

const router = Router();

/**
 * @swagger
 * /contributions:
 *   post:
 *     tags: [Contributions]
 *     summary: Make a contribution to a gift pool (locks exchange rate)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateContributionRequest'
 *     responses:
 *       201:
 *         description: Contribution created with locked exchange rate
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CreateContributionResponse'
 *       400:
 *         description: Pool full or invalid amount
 *       404:
 *         description: Pool not found
 */
router.post('/', auth, asyncHandler(createContribution));

/**
 * @swagger
 * /contributions/pool/{poolId}:
 *   get:
 *     tags: [Contributions]
 *     summary: List contributions for a pool (cursor-based pagination)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: poolId
 *         in: path
 *         required: true
 *         schema: { type: integer }
 *       - name: limit
 *         in: query
 *         schema: { type: integer, default: 10 }
 *       - name: cursor
 *         in: query
 *         schema: { type: integer }
 *         description: Cursor from previous response (nextCursor)
 *     responses:
 *       200:
 *         description: Paginated contributions
 */
router.get('/pool/:poolId', auth, asyncHandler(getContributions));

export default router;
