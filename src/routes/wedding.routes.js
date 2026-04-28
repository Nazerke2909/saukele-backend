import { Router } from 'express';
import asyncHandler from '../utils/asyncHandler.js';
import auth from '../middleware/auth.js';
import roleCheck from '../middleware/roleCheck.js';
import {
  createWedding,
  getWedding,
  listWeddings,
  updateWedding,
  deleteWedding,
} from '../controller/weddingController.js';

const router = Router();

/**
 * @swagger
 * /weddings:
 *   get:
 *     tags: [Weddings]
 *     summary: List all weddings (cursor-based pagination)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *         description: Items per page (max 50)
 *       - in: query
 *         name: cursor
 *         schema: { type: integer }
 *         description: Cursor from previous response (nextCursor)
 *     responses:
 *       200:
 *         description: Paginated wedding list
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     limit: { type: integer }
 *                     nextCursor: { type: integer, nullable: true }
 *                     hasNextPage: { type: boolean }
 */
router.get('/', auth, asyncHandler(listWeddings));

/**
 * @swagger
 * /weddings:
 *   post:
 *     tags: [Weddings]
 *     summary: Create a wedding (COUPLE or SUPER_ADMIN only)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateWeddingRequest'
 *     responses:
 *       201:
 *         description: Wedding created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CreateWeddingResponse'
 *       403:
 *         description: Insufficient role
 */
router.post('/', auth, roleCheck('COUPLE', 'SUPER_ADMIN'), asyncHandler(createWedding));

/**
 * @swagger
 * /weddings/{id}:
 *   get:
 *     tags: [Weddings]
 *     summary: Get wedding by ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Wedding details
 *       404:
 *         description: Wedding not found
 */
router.get('/:id', auth, asyncHandler(getWedding));

/**
 * @swagger
 * /weddings/{id}:
 *   put:
 *     tags: [Weddings]
 *     summary: Update wedding
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateWeddingRequest'
 *     responses:
 *       200:
 *         description: Wedding updated
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Not found
 */
router.put('/:id', auth, roleCheck('COUPLE', 'SUPER_ADMIN'), asyncHandler(updateWedding));

/**
 * @swagger
 * /weddings/{id}:
 *   delete:
 *     tags: [Weddings]
 *     summary: Delete wedding
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Wedding deleted
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Not found
 */
router.delete('/:id', auth, roleCheck('COUPLE', 'SUPER_ADMIN'), asyncHandler(deleteWedding));

export default router;
