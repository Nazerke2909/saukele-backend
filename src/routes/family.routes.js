import { Router } from 'express';
import asyncHandler from '../utils/asyncHandler.js';
import auth from '../middleware/auth.js';
import roleCheck from '../middleware/roleCheck.js';
import { getFamilyTree, addFamilyMember, getGiftObligations, getMyFamilyWedding, getMyRank, removeFamilyMember, sendObligationReminders } from '../controller/familyController.js';

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

/**
 * @swagger
 * /family/{weddingId}/member/{memberId}:
 *   delete:
 *     tags: [Family Tree]
 *     summary: "Remove a family member from the tree"
 *     description: "Cannot remove a member who has descendants. Re-assign their ancestorId first."
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: weddingId
 *         required: true
 *         schema: { type: integer }
 *       - in: path
 *         name: memberId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: "Member removed from tree"
 *       400:
 *         description: "Member has descendants"
 *       403:
 *         description: "Insufficient role"
 *       404:
 *         description: "Member not found in tree"
 */
router.delete('/:weddingId/member/:memberId', auth, roleCheck('COUPLE', 'SUPER_ADMIN'), asyncHandler(removeFamilyMember));

/**
 * @swagger
 * /family/{weddingId}/remind:
 *   post:
 *     tags: [Family Tree]
 *     summary: "Send gift obligation reminder emails to all family members with outstanding obligations"
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: weddingId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: "Reminders sent"
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string }
 *                 sentCount: { type: integer }
 *       403:
 *         description: "Insufficient role"
 *       404:
 *         description: "Wedding not found"
 */
router.post('/:weddingId/remind', auth, roleCheck('COUPLE', 'SUPER_ADMIN'), asyncHandler(sendObligationReminders));

/**
 * @swagger
 * /family/my-wedding:
 *   get:
 *     tags: [Family Tree]
 *     summary: "Get the wedding I belong to as a family member"
 *     description: "Returns wedding details with all gift pools for the family member's wedding."
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: "Wedding details"
 *       404:
 *         description: "Not a family member of any wedding"
 */
router.get('/my-wedding', auth, asyncHandler(getMyFamilyWedding));

/**
 * @swagger
 * /family/my-rank:
 *   get:
 *     tags: [Family Tree]
 *     summary: "Get my kinship rank and obligation status"
 *     description: "Returns rank, minimum obligation based on rank (ATA_ANA=100k, ZHIEN_ZHARAP=50k, SHAKYRT=20k), total contributed, and whether obligation is fulfilled."
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: "Rank and obligation details"
 *       404:
 *         description: "Not a family member"
 */
router.get('/my-rank', auth, asyncHandler(getMyRank));

export default router;

