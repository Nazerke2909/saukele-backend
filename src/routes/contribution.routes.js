import { Router } from 'express';
import asyncHandler from '../utils/asyncHandler.js';
import auth from '../middleware/auth.js';
import roleCheck from '../middleware/roleCheck.js';
import {
  createContribution,
  getMyContributions,
  getContributions,
  getContributionsByCurrency,
  deleteContribution,
} from '../controller/contributionController.js';
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
 * /contributions/my:
 *   get:
 *     tags: [Contributions]
 *     summary: "Get current user's contributions"
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
 *         description: "Paginated list of user's contributions"
 *       401:
 *         description: "Unauthorized"
 */
router.get('/my', auth, asyncHandler(getMyContributions));

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

/**
 * @swagger
 * /contributions/wedding/{weddingId}/by-currency:
 *   get:
 *     tags: [Contributions]
 *     summary: "Get all contributions for a wedding grouped by original currency"
 *     description: "Returns totals and breakdown per currency. COUPLE or SUPER_ADMIN only."
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: weddingId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: "Contributions grouped by currency"
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 weddingId: { type: integer }
 *                 totals:
 *                   type: object
 *                   properties:
 *                     totalKzt: { type: integer }
 *                     totalContributions: { type: integer }
 *                     totalPools: { type: integer }
 *                 currencyBreakdown:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       currency: { type: string, example: "USD" }
 *                       totalOriginalAmount: { type: number }
 *                       totalKzt: { type: integer }
 *                       count: { type: integer }
 *                       contributions: { type: array }
 *       403:
 *         description: "Forbidden — not your wedding"
 *       404:
 *         description: "Wedding not found"
 */
router.get('/wedding/:weddingId/by-currency', auth, asyncHandler(getContributionsByCurrency));

/**
 * @swagger
 * /contributions/{id}:
 *   delete:
 *     tags: [Contributions]
 *     summary: "Delete a contribution (SUPER_ADMIN only)"
 *     description: "Anonymizes the contribution by removing guest association."
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: "Contribution deleted (anonymized)"
 *       403:
 *         description: "SUPER_ADMIN only"
 *       404:
 *         description: "Contribution not found"
 */
router.delete('/:id', auth, roleCheck('SUPER_ADMIN'), asyncHandler(deleteContribution));

export default router;

