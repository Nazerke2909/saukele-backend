import prisma from '../config/database.js';
import { AppError } from '../middleware/errorHandler.js';
import { logAction } from '../service/auditService.js';

export const listUsers = async (req, res) => {
  const { limit = 20, cursor, role, isBlocked } = req.query;

  const where = {};
  if (role) where.role = role;
  if (isBlocked !== undefined) where.isBlocked = isBlocked === 'true';

  const take = Math.min(Math.abs(Number(limit)) || 20, 100);

  const users = await prisma.user.findMany({
    where,
    take: take + 1,
    ...(cursor ? { skip: 1, cursor: { id: Number(cursor) } } : {}),
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
      isBlocked: true,
      createdAt: true,
    },
  });

  const hasNextPage = users.length > take;
  const data = hasNextPage ? users.slice(0, take) : users;
  const nextCursor = hasNextPage ? data[data.length - 1].id : null;

  res.json({
    data,
    pagination: {
      limit: take,
      nextCursor,
      hasNextPage,
    },
  });
};

export const deleteUser = async (req, res) => {
  const userId = Number(req.params.id);

  if (userId === req.user.id) {
    throw new AppError('Cannot delete yourself', 400);
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new AppError('User not found', 404);
  }

  await prisma.$transaction(async (tx) => {
    await tx.familyTree.deleteMany({ where: { memberId: userId } });
    await tx.familyTree.deleteMany({ where: { ancestorId: userId } });

    await tx.contribution.updateMany({
      where: { guestId: userId },
      data: { guestId: null },
    });

    await tx.user.delete({ where: { id: userId } });
  });

  await logAction({
    userId: req.user.id,
    action: 'DELETE_USER',
    entityType: 'User',
    entityId: userId,
    ipAddress: req.ip,
  });

  res.json({ message: 'User deleted successfully' });
};

export const updateExchangeRate = async (req, res) => {
  const { currencyFrom, currencyTo, rate, source } = req.body;

  if (!currencyFrom || !currencyTo || rate === undefined) {
    throw new AppError('currencyFrom, currencyTo, and rate are required', 400);
  }

  if (rate <= 0) {
    throw new AppError('Rate must be positive', 400);
  }

  await prisma.exchangeRate.updateMany({
    where: {
      currencyFrom,
      currencyTo,
      validUntil: null,
    },
    data: { validUntil: new Date() },
  });

  const exchangeRate = await prisma.exchangeRate.create({
    data: {
      currencyFrom,
      currencyTo,
      rate,
      source: source || 'manual',
    },
  });

  await logAction({
    userId: req.user.id,
    action: 'UPDATE_EXCHANGE_RATE',
    entityType: 'ExchangeRate',
    entityId: exchangeRate.id,
    newValue: { currencyFrom, currencyTo, rate },
    ipAddress: req.ip,
  });

  res.status(201).json(exchangeRate);
};

export const getAuditLog = async (req, res) => {
  const { limit = 50, cursor, action, entityType, userId } = req.query;

  const where = {};
  if (action) where.action = action;
  if (entityType) where.entityType = entityType;
  if (userId) where.userId = Number(userId);

  const take = Math.min(Math.abs(Number(limit)) || 50, 200);

  const logs = await prisma.auditLog.findMany({
    where,
    take: take + 1,
    ...(cursor ? { skip: 1, cursor: { id: Number(cursor) } } : {}),
    orderBy: { createdAt: 'desc' },
    include: {
      user: { select: { id: true, fullName: true, email: true } },
    },
  });

  const hasNextPage = logs.length > take;
  const data = hasNextPage ? logs.slice(0, take) : logs;
  const nextCursor = hasNextPage ? data[data.length - 1].id : null;

  res.json({ data, pagination: { limit: take, nextCursor, hasNextPage } });
};

export const promoteModerator = async (req, res) => {
  const userId = Number(req.params.userId);

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new AppError('User not found', 404);
  }

  if (user.role === 'SUPER_ADMIN') {
    throw new AppError('Cannot promote a SUPER_ADMIN', 400);
  }

  const newRole = user.role === 'MODERATOR' ? 'COUPLE' : 'MODERATOR';

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { role: newRole },
    select: { id: true, email: true, fullName: true, role: true },
  });

  await logAction({
    userId: req.user.id,
    action: 'PROMOTE_MODERATOR',
    entityType: 'User',
    entityId: userId,
    oldValue: { role: user.role },
    newValue: { role: newRole },
    ipAddress: req.ip,
  });

  res.json({
    message: `User role changed from ${user.role} to ${newRole}`,
    user: updated,
  });
};