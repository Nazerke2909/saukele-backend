import prisma from '../config/database.js';
import { AppError } from '../middleware/errorHandler.js';
import { logAction } from './auditService.js';
import { sendFragileCarrierNotification } from './emailService.js';

/**
 * Создаёт запись логистического трекинга для пула.
 * Автоматически генерирует заметку о хрупкости, если isFragile = true.
 */
export async function createLogisticsTracking(poolId, userId, ipAddress) {
  const pool = await prisma.giftPool.findUnique({
    where: { id: poolId },
    include: {
      wedding: {
        select: { title: true, coupleId: true, couple: { select: { email: true, fullName: true } } },
      },
      logisticsTrack: true,
    },
  });

  if (!pool) {
    throw new AppError('Gift pool not found', 404);
  }

  if (pool.logisticsTrack) {
    throw new AppError('Logistics tracking already exists for this pool', 409);
  }

  if (pool.status !== 'PURCHASED') {
    throw new AppError('Pool must be in PURCHASED status to create logistics tracking', 400);
  }

  // Формируем заметки для перевозчика
  let carrierNotes = null;
  if (pool.isFragile) {
    carrierNotes = '⚠️ FRAGILE ITEM — Handle with care. This gift contains fragile items that require special handling during transport.';
  }

  const tracking = await prisma.logisticsTracking.create({
    data: {
      poolId: pool.id,
      deliveryStatus: 'PREPARING',
      carrierNotes,
      fragileWarningSent: false, // Будет отправлено при передаче перевозчику
    },
  });

  await logAction({
    userId,
    action: 'CREATE_LOGISTICS_TRACKING',
    entityType: 'LogisticsTracking',
    entityId: tracking.id,
    newValue: {
      poolId: pool.id,
      poolName: pool.name,
      isFragile: pool.isFragile,
      carrierNotes,
    },
    ipAddress,
  });

  return tracking;
}

/**
 * Назначает перевозчика и трек-номер для пула.
 * Если товар хрупкий — отправляет спец-уведомление перевозчику.
 */
export async function assignCarrier(poolId, { carrierName, trackingNumber, estimatedDelivery }, userId, ipAddress) {
  const pool = await prisma.giftPool.findUnique({
    where: { id: poolId },
    include: {
      logisticsTrack: true,
      wedding: {
        select: { title: true, couple: { select: { email: true, fullName: true } } },
      },
    },
  });

  if (!pool) throw new AppError('Gift pool not found', 404);
  if (!pool.logisticsTrack) throw new AppError('Logistics tracking not initialized. Call createLogisticsTracking first.', 400);

  if (pool.logisticsTrack.deliveryStatus !== 'PREPARING') {
    throw new AppError('Can only assign carrier when status is PREPARING', 400);
  }

  let fragileWarningSent = pool.logisticsTrack.fragileWarningSent;

  // 🆕 Если товар хрупкий — отправляем специальное уведомление перевозчику
  if (pool.isFragile && !fragileWarningSent) {
    try {
      await sendFragileCarrierNotification({
        coupleEmail: pool.wedding.couple.email,
        coupleName: pool.wedding.couple.fullName,
        poolName: pool.name,
        weddingTitle: pool.wedding.title,
        carrierName,
        trackingNumber,
        carrierNotes: pool.logisticsTrack.carrierNotes,
      });
      fragileWarningSent = true;
    } catch (err) {
      console.error(`[LOGISTICS] Failed to send fragile carrier notification for pool ${poolId}:`, err.message);
      // Не блокируем операцию, но логируем ошибку
    }
  }

  const updated = await prisma.logisticsTracking.update({
    where: { poolId },
    data: {
      carrierName,
      trackingNumber,
      carrierNotes: pool.isFragile
        ? (pool.logisticsTrack.carrierNotes || '⚠️ FRAGILE ITEM — Handle with care.')
        : pool.logisticsTrack.carrierNotes,
      fragileWarningSent,
      estimatedDelivery: estimatedDelivery ? new Date(estimatedDelivery) : null,
      deliveryStatus: 'HANDED_TO_CARRIER',
    },
  });

  await logAction({
    userId,
    action: 'ASSIGN_CARRIER',
    entityType: 'LogisticsTracking',
    entityId: updated.id,
    oldValue: {
      carrierName: pool.logisticsTrack.carrierName,
      trackingNumber: pool.logisticsTrack.trackingNumber,
      deliveryStatus: pool.logisticsTrack.deliveryStatus,
    },
    newValue: {
      carrierName,
      trackingNumber,
      deliveryStatus: 'HANDED_TO_CARRIER',
      fragileWarningSent,
    },
    ipAddress,
  });

  return updated;
}

/**
 * Обновляет статус доставки логистического трекинга.
 * При переводе в DELIVERED — также обновляет статус пула.
 */
export async function updateDeliveryStatus(poolId, newStatus, metadata = {}, userId, ipAddress) {
  const validTransitions = {
    PREPARING: ['HANDED_TO_CARRIER'],
    HANDED_TO_CARRIER: ['IN_TRANSIT'],
    IN_TRANSIT: ['OUT_FOR_DELIVERY'],
    OUT_FOR_DELIVERY: ['DELIVERED', 'FAILED'],
    DELIVERED: [],
    FAILED: ['PREPARING', 'HANDED_TO_CARRIER'],
  };

  const tracking = await prisma.logisticsTracking.findUnique({
    where: { poolId },
    include: { pool: true },
  });

  if (!tracking) throw new AppError('Logistics tracking not found', 404);

  const allowed = validTransitions[tracking.deliveryStatus];
  if (!allowed || !allowed.includes(newStatus)) {
    throw new AppError(
      `Cannot change delivery status from ${tracking.deliveryStatus} to ${newStatus}. Allowed: ${(allowed || []).join(', ') || 'none'}`,
      400
    );
  }

  const updateData = {
    deliveryStatus: newStatus,
    ...(newStatus === 'DELIVERED' ? { deliveredAt: new Date() } : {}),
    ...(metadata.carrierNotes ? { carrierNotes: metadata.carrierNotes } : {}),
  };

  // Если товар хрупкий и передаём курьеру — дублируем предупреждение
  if (newStatus === 'OUT_FOR_DELIVERY' && tracking.pool.isFragile) {
    const fragileNote = '⚠️ FRAGILE — Please handle with extra care during last-mile delivery.';
    updateData.carrierNotes = tracking.carrierNotes
      ? `${tracking.carrierNotes}\n${fragileNote}`
      : fragileNote;
  }

  const updated = await prisma.logisticsTracking.update({
    where: { poolId },
    data: updateData,
  });

  // Если доставлено — автоматически обновляем статус пула
  if (newStatus === 'DELIVERED') {
    await prisma.giftPool.update({
      where: { id: poolId },
      data: { status: 'DELIVERED' },
    });
  }

  await logAction({
    userId,
    action: 'UPDATE_DELIVERY_STATUS',
    entityType: 'LogisticsTracking',
    entityId: tracking.id,
    oldValue: { deliveryStatus: tracking.deliveryStatus },
    newValue: { deliveryStatus: newStatus, ...(newStatus === 'DELIVERED' ? { deliveredAt: updateData.deliveredAt } : {}) },
    ipAddress,
  });

  return updated;
}

/**
 * Получает полную информацию о логистическом трекинге пула.
 */
export async function getLogisticsTracking(poolId) {
  const tracking = await prisma.logisticsTracking.findUnique({
    where: { poolId },
    include: {
      pool: {
        select: {
          id: true,
          name: true,
          isFragile: true,
          status: true,
          wedding: { select: { id: true, title: true } },
        },
      },
    },
  });

  if (!tracking) throw new AppError('Logistics tracking not found', 404);

  return tracking;
}