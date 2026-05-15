import prisma from '../config/database.js';
import { AppError } from '../middleware/errorHandler.js';
import { logAction } from '../service/auditService.js';

export const getFlaggedContributions = async (req, res) => {
  const { limit = 20, cursor } = req.query;
  const take = Math.min(Math.abs(Number(limit)) || 20, 100);
  const contributions = await prisma.contribution.findMany({
    where: {
      status: { in: ['FAILED', 'PENDING'] },
    },
    take: take + 1,
    ...(cursor ? { skip: 1, cursor: { id: Number(cursor) } } : {}),
    orderBy: { createdAt: 'desc' },
    include: {
      guest: { select: { id: true, fullName: true, email: true } },
      pool: {
        select: {
          id: true,
          name: true,
          wedding: { select: { title: true } },
        },
      },
    },
  });

  const hasNextPage = contributions.length > take;
  const data = hasNextPage ? contributions.slice(0, take) : contributions;
  const nextCursor = hasNextPage ? data[data.length - 1].id : null;

  res.json({ data, pagination: { limit: take, nextCursor, hasNextPage } });
};

export const blockUser = async (req, res) => {
  const userId = Number(req.params.id);

  if (userId === req.user.id) {
    throw new AppError('Cannot block yourself', 400);
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new AppError('User not found', 404);
  }

  if (user.role === 'SUPER_ADMIN') {
    throw new AppError('Cannot block a SUPER_ADMIN', 403);
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { isBlocked: !user.isBlocked },
    select: { id: true, email: true, fullName: true, role: true, isBlocked: true },
  });

  await logAction({
    userId: req.user.id,
    action: updated.isBlocked ? 'BLOCK_USER' : 'UNBLOCK_USER',
    entityType: 'User',
    entityId: userId,
    oldValue: { isBlocked: user.isBlocked },
    newValue: { isBlocked: updated.isBlocked },
    ipAddress: req.ip,
  });

  res.json({
    message: updated.isBlocked ? 'User blocked' : 'User unblocked',
    user: updated,
  });
};

export const getOwnAuditLog = async (req, res) => {
  const { limit = 50, cursor } = req.query;
  const take = Math.min(Math.abs(Number(limit)) || 50, 200);

  const logs = await prisma.auditLog.findMany({
    where: { userId: req.user.id },
    take: take + 1,
    ...(cursor ? { skip: 1, cursor: { id: Number(cursor) } } : {}),
    orderBy: { createdAt: 'desc' },
  });

  const hasNextPage = logs.length > take;
  const data = hasNextPage ? logs.slice(0, take) : logs;
  const nextCursor = hasNextPage ? data[data.length - 1].id : null;

  res.json({ data, pagination: { limit: take, nextCursor, hasNextPage } });
};