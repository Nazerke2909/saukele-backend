import { Router } from 'express';
import asyncHandler from '../utils/asyncHandler.js';
import auth from '../middleware/auth.js';
import roleCheck from '../middleware/roleCheck.js';
import {
  getFlaggedContributions,
  blockUser,
  getOwnAuditLog,
} from '../controller/moderatorController.js';

const router = Router();

router.use(auth, roleCheck('MODERATOR', 'SUPER_ADMIN'));

/**
 * @swagger
 * /moderator/contributions/flagged:
 *   get:
 *     tags: [Moderator]
 *     summary: "View flagged contributions (FAILED or PENDING status)"
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *       - in: query
 *         name: cursor
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: "Paginated flagged contributions"
 *       403:
 *         description: "MODERATOR or SUPER_ADMIN only"
 */
router.get('/contributions/flagged', asyncHandler(getFlaggedContributions));

/**
 * @swagger
 * /moderator/users/{id}/block:
 *   patch:
 *     tags: [Moderator]
 *     summary: "Toggle block/unblock for a user"
 *     description: "Cannot block yourself or a SUPER_ADMIN. Toggles isBlocked status."
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: "Block status toggled"
 *       400:
 *         description: "Cannot block yourself"
 *       403:
 *         description: "Cannot block SUPER_ADMIN or insufficient role"
 *       404:
 *         description: "User not found"
 */
router.patch('/users/:id/block', asyncHandler(blockUser));

/**
 * @swagger
 * /moderator/audit-log:
 *   get:
 *     tags: [Moderator]
 *     summary: "View own audit log entries (restricted to moderator's own actions)"
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 50 }
 *       - in: query
 *         name: cursor
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: "Paginated own audit log"
 *       403:
 *         description: "MODERATOR or SUPER_ADMIN only"
 */
router.get('/audit-log', asyncHandler(getOwnAuditLog));

export default router;