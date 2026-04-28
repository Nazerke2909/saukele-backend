import { Router } from 'express';
import asyncHandler from '../utils/asyncHandler.js';
import auth from '../middleware/auth.js';
import roleCheck from '../middleware/roleCheck.js';
import { getFamilyTree, addFamilyMember, getGiftObligations } from '../controller/familyController.js';

const router = Router();

/**
 * @swagger
 * /family/{weddingId}/tree:
 *   get:
 *     tags: [Family Tree]
 *     summary: Get full family tree hierarchy with recursive structure
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: weddingId
 *         required: true
 *         schema: { type: integer }
 *         description: Wedding ID
 *     responses:
 *       200:
 *         description: Family tree hierarchy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 weddingId: { type: integer }
 *                 tree:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/FamilyTreeMember'
 *       404:
 *         description: Wedding not found
 */
router.get('/:weddingId/tree', auth, asyncHandler(getFamilyTree));

/**
 * @swagger
 * /family/{weddingId}/obligations:
 *   get:
 *     tags: [Family Tree]
 *     summary: Get gift obligations for all family members
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: weddingId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Gift obligations by kinship rank
 */
router.get('/:weddingId/obligations', auth, asyncHandler(getGiftObligations));

/**
 * @swagger
 * /family/{weddingId}/member:
 *   post:
 *     tags: [Family Tree]
 *     summary: Add a family member to the wedding tree
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: weddingId
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [memberId, kinshipRank]
 *             properties:
 *               memberId:
 *                 type: integer
 *                 example: 3
 *               ancestorId:
 *                 type: integer
 *                 nullable: true
 *                 example: 2
 *               kinshipRank:
 *                 type: string
 *                 enum: [ATA_ANA, ZHIEN_ZHARAP, SHAKYRT]
 *                 example: "ZHIEN_ZHARAP"
 *               giftObligation:
 *                 type: integer
 *                 example: 50000
 *     responses:
 *       201:
 *         description: Family member added
 */
router.post('/:weddingId/member', auth, roleCheck('COUPLE', 'SUPER_ADMIN'), asyncHandler(addFamilyMember));

export default router;
