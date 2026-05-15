import { Router } from 'express';
import asyncHandler from '../utils/asyncHandler.js';
import auth from '../middleware/auth.js';
import roleCheck from '../middleware/roleCheck.js';
import {
  listUsers,
  deleteUser,
  updateExchangeRate,
  getAuditLog,
  promoteModerator,
} from '../controller/adminController.js';
import {
  getQueueStats,
  getQueueDetail,
  getJobDetail,
  retryJob,
  removeJob,
} from '../queue/monitor.js';
const router = Router();

router.use(auth, roleCheck('SUPER_ADMIN'));

/**
 * @swagger
 * /admin/users:
 *   get:
 *     tags: [Admin]
 *     summary: "List all users with optional filters"
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *       - in: query
 *         name: cursor
 *         schema: { type: integer }
 *       - in: query
 *         name: role
 *         schema: { type: string, enum: [GUEST, FAMILY_MEMBER, COUPLE, MODERATOR, SUPER_ADMIN] }
 *       - in: query
 *         name: isBlocked
 *         schema: { type: string, enum: ["true", "false"] }
 *     responses:
 *       200:
 *         description: "Paginated user list (cursor-based)"
 *       403:
 *         description: "SUPER_ADMIN only"
 */
router.get('/users', asyncHandler(listUsers));

/**
 * @swagger
 * /admin/users/{id}:
 *   delete:
 *     tags: [Admin]
 *     summary: "Delete a user"
 *     description: "Anonymizes their contributions and removes them from family trees. Cannot delete yourself."
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: "User deleted"
 *       400:
 *         description: "Cannot delete yourself"
 *       403:
 *         description: "SUPER_ADMIN only"
 *       404:
 *         description: "User not found"
 */
router.delete('/users/:id', asyncHandler(deleteUser));

/**
 * @swagger
 * /admin/exchange-rates:
 *   put:
 *     tags: [Admin]
 *     summary: "Set a new exchange rate"
 *     description: "Expires the current active rate and inserts a new one. Logged in audit trail."
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [currencyFrom, currencyTo, rate]
 *             properties:
 *               currencyFrom: { type: string, example: "USD" }
 *               currencyTo: { type: string, example: "KZT" }
 *               rate: { type: number, example: 480.5 }
 *               source: { type: string, default: "manual" }
 *     responses:
 *       201:
 *         description: "Exchange rate created"
 *       400:
 *         description: "Missing required fields"
 *       403:
 *         description: "SUPER_ADMIN only"
 */
router.put('/exchange-rates', asyncHandler(updateExchangeRate));

/**
 * @swagger
 * /admin/audit-log:
 *   get:
 *     tags: [Admin]
 *     summary: "View full audit log with filters"
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 50 }
 *       - in: query
 *         name: cursor
 *         schema: { type: integer }
 *       - in: query
 *         name: action
 *         schema: { type: string }
 *       - in: query
 *         name: entityType
 *         schema: { type: string }
 *       - in: query
 *         name: userId
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: "Paginated audit log"
 *       403:
 *         description: "SUPER_ADMIN only"
 */
router.get('/audit-log', asyncHandler(getAuditLog));

/**
 * @swagger
 * /admin/moderators/{userId}/promote:
 *   patch:
 *     tags: [Admin]
 *     summary: "Toggle MODERATOR role for a user"
 *     description: "If user is currently MODERATOR, demotes to COUPLE. If not, promotes to MODERATOR."
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: "Role updated"
 *       400:
 *         description: "Cannot promote SUPER_ADMIN"
 *       403:
 *         description: "SUPER_ADMIN only"
 *       404:
 *         description: "User not found"
 */
router.patch('/moderators/:userId/promote', asyncHandler(promoteModerator));
/**
 * @swagger
 * /admin/queue-stats:
 *   get:
 *     tags: [Admin]
 *     summary: "Queue monitoring — get all queue stats"
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: "Queue stats"
 *       403:
 *         description: "SUPER_ADMIN only"
 */
router.get('/queue-stats', asyncHandler(getQueueStats));

/**
 * @swagger
 * /admin/queue-stats/{queueName}:
 *   get:
 *     tags: [Admin]
 *     summary: "Queue monitoring — get queue details"
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: queueName
 *         required: true
 *         schema: { type: string, enum: [email, webhooks, cron] }
 *     responses:
 *       200:
 *         description: "Queue details with recent jobs"
 *       403:
 *         description: "SUPER_ADMIN only"
 *       404:
 *         description: "Queue not found"
 */
router.get('/queue-stats/:queueName', asyncHandler(getQueueDetail));

/**
 * @swagger
 * /admin/queue-stats/{queueName}/jobs/{jobId}:
 *   get:
 *     tags: [Admin]
 *     summary: "Queue monitoring — get job details"
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: queueName
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: "Job details"
 *       403:
 *         description: "SUPER_ADMIN only"
 */
router.get('/queue-stats/:queueName/jobs/:jobId', asyncHandler(getJobDetail));

/**
 * @swagger
 * /admin/queue-stats/{queueName}/jobs/{jobId}/retry:
 *   post:
 *     tags: [Admin]
 *     summary: "Queue monitoring — retry a failed job"
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: queueName
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: "Job retried"
 *       403:
 *         description: "SUPER_ADMIN only"
 */
router.post('/queue-stats/:queueName/jobs/:jobId/retry', asyncHandler(retryJob));

/**
 * @swagger
 * /admin/queue-stats/{queueName}/jobs/{jobId}:
 *   delete:
 *     tags: [Admin]
 *     summary: "Queue monitoring — remove a job"
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: queueName
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: "Job removed"
 *       403:
 *         description: "SUPER_ADMIN only"
 */
router.delete('/queue-stats/:queueName/jobs/:jobId', asyncHandler(removeJob));

export default router;