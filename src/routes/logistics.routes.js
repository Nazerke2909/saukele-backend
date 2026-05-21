import { Router } from 'express';
import asyncHandler from '../utils/asyncHandler.js';
import auth from '../middleware/auth.js';
import roleCheck from '../middleware/roleCheck.js';
import {
  createTracking,
  assignCarrier,
  updateStatus,
  getTracking,
} from '../controller/logisticsController.js';

const router = Router();

/**
 * @swagger
 * /pools/{id}/logistics:
 *   post:
 *     tags: [Logistics]
 *     summary: "Инициализировать логистический трекинг для пула"
 *     description: "Создаёт запись трекинга. Пул должен быть в статусе PURCHASED."
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       201:
 *         description: "Logistics tracking created"
 *       400:
 *         description: "Pool not in PURCHASED status"
 *       403:
 *         description: "Forbidden"
 *       404:
 *         description: "Pool not found"
 *       409:
 *         description: "Tracking already exists"
 */
router.post('/pools/:id/logistics', auth, roleCheck('COUPLE', 'SUPER_ADMIN'), asyncHandler(createTracking));

/**
 * @swagger
 * /pools/{id}/logistics/carrier:
 *   post:
 *     tags: [Logistics]
 *     summary: "Назначить перевозчика и трек-номер"
 *     description: "Если товар хрупкий — отправляет специальное уведомление перевозчику."
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
 *             required: [carrierName, trackingNumber]
 *             properties:
 *               carrierName:
 *                 type: string
 *                 example: "КазПочта"
 *               trackingNumber:
 *                 type: string
 *                 example: "KZ1234567890"
 *               estimatedDelivery:
 *                 type: string
 *                 format: date-time
 *                 example: "2025-08-01T12:00:00Z"
 *     responses:
 *       200:
 *         description: "Carrier assigned"
 *       400:
 *         description: "Not in PREPARING status"
 *       403:
 *         description: "Forbidden"
 *       404:
 *         description: "Pool or tracking not found"
 */
router.post('/pools/:id/logistics/carrier', auth, roleCheck('COUPLE', 'SUPER_ADMIN'), asyncHandler(assignCarrier));

/**
 * @swagger
 * /pools/{id}/logistics/status:
 *   patch:
 *     tags: [Logistics]
 *     summary: "Обновить статус доставки"
 *     description: "Следует цепочке: PREPARING → HANDED_TO_CARRIER → IN_TRANSIT → OUT_FOR_DELIVERY → DELIVERED. При DELIVERED автоматом обновляет статус пула."
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
 *             required: [deliveryStatus]
 *             properties:
 *               deliveryStatus:
 *                 type: string
 *                 enum: [PREPARING, HANDED_TO_CARRIER, IN_TRANSIT, OUT_FOR_DELIVERY, DELIVERED, FAILED]
 *               carrierNotes:
 *                 type: string
 *     responses:
 *       200:
 *         description: "Delivery status updated"
 *       400:
 *         description: "Invalid transition"
 *       403:
 *         description: "Forbidden"
 *       404:
 *         description: "Tracking not found"
 */
router.patch('/pools/:id/logistics/status', auth, roleCheck('COUPLE', 'SUPER_ADMIN'), asyncHandler(updateStatus));

/**
 * @swagger
 * /pools/{id}/logistics:
 *   get:
 *     tags: [Logistics]
 *     summary: "Получить информацию о логистическом трекинге"
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: "Logistics tracking details"
 *       401:
 *         description: "Unauthorized"
 *       404:
 *         description: "Tracking not found"
 */
router.get('/pools/:id/logistics', auth, asyncHandler(getTracking));

export default router;