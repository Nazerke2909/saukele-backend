import prisma from '../config/database.js';
import { AppError } from '../middleware/errorHandler.js';
import { logAction } from '../service/auditService.js';
import { buildPrivacyFilter } from '../middleware/privacyGuard.js';

export const createWedding = async (req, res) => {
  const { title, date, location } = req.body;

  const wedding = await prisma.wedding.create({
    data: {
      coupleId: req.user.id,
      title,
      date: new Date(date),
      location,
    },
    include: { couple: { select: { id: true, fullName: true, email: true } } },
  });

  await logAction({
    userId: req.user.id,
    action: 'CREATE_WEDDING',
    entityType: 'Wedding',
    entityId: wedding.id,
    newValue: { title, date, location },
    ipAddress: req.ip,
  });

  res.status(201).json(wedding);
};

export const getWedding = async (req, res) => {
  const weddingId = Number(req.params.id);

  const wedding = await prisma.wedding.findUnique({
    where: { id: weddingId },
    include: {
      couple: { select: { id: true, fullName: true, email: true } },
    },
  });

  if (!wedding) {
    throw new AppError('Wedding not found', 404);
  }

  // Фильтруем пулы по уровню приватности для текущего пользователя
  const giftPools = await prisma.giftPool.findMany({
    where: buildPrivacyFilter(req.user, weddingId, wedding.coupleId),
  });

  // 🆕 Флаг "моя свадьба" для COUPLE
  const isMyWedding = req.user.role === 'COUPLE' && wedding.coupleId === req.user.id;

  res.json({ ...wedding, giftPools, isMyWedding });
};

export const listWeddings = async (req, res) => {
  const limit = Math.min(Math.abs(parseInt(req.query.limit, 10)) || 10, 50);
  const cursor = req.query.cursor ? parseInt(req.query.cursor, 10) : undefined;

  const weddings = await prisma.wedding.findMany({
    take: limit + 1,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    orderBy: { createdAt: 'desc' },
    include: {
      couple: {
        select:
          req.user.role === 'COUPLE' || req.user.role === 'SUPER_ADMIN' || req.user.role === 'MODERATOR'
            ? { id: true, fullName: true, email: true }
            : { id: true, fullName: true },
      },
      _count: { select: { giftPools: true } },
    },
  });

    const hasNextPage = weddings.length > limit;
  const data = hasNextPage ? weddings.slice(0, limit) : weddings;
  const nextCursor = hasNextPage ? data[data.length - 1].id : null;

  // 🆕 Добавляем isMyWedding для COUPLE (чтобы показать "My Wedding")
  const dataWithFlag = data.map(w => ({
    ...w,
    isMyWedding: req.user.role === 'COUPLE' && w.couple.id === req.user.id,
  }));

  res.json({
    data: dataWithFlag,
    pagination: {
      limit,
      nextCursor,
      hasNextPage,
    },
  });
};

export const updateWedding = async (req, res) => {
  const id = Number(req.params.id);
  const { title, date, location } = req.body;

  const wedding = await prisma.wedding.findUnique({
    where: { id },
    select: { id: true, coupleId: true },
  });

  if (!wedding) {
    throw new AppError('Wedding not found', 404);
  }

  if (wedding.coupleId !== req.user.id && req.user.role !== 'SUPER_ADMIN') {
    throw new AppError('You can only update your own wedding', 403);
  }

    const oldWedding = await prisma.wedding.findUnique({ where: { id }, select: { title: true, date: true, location: true } });

  const updated = await prisma.wedding.update({
    where: { id },
    data: {
      ...(title && { title }),
      ...(date && { date: new Date(date) }),
      ...(location !== undefined && { location }),
    },
    include: { couple: { select: { id: true, fullName: true, email: true } } },
  });

  await logAction({
    userId: req.user.id,
    action: 'UPDATE_WEDDING',
    entityType: 'Wedding',
    entityId: id,
    oldValue: oldWedding,
    newValue: { title: updated.title, date: updated.date, location: updated.location },
    ipAddress: req.ip,
  });

  res.json(updated);
};

export const deleteWedding = async (req, res) => {
  const id = Number(req.params.id);

  const wedding = await prisma.wedding.findUnique({
    where: { id },
    select: {
      id: true,
      coupleId: true,
      _count: { select: { giftPools: true } },
    },
  });

  if (!wedding) {
    throw new AppError('Wedding not found', 404);
  }

  if (wedding.coupleId !== req.user.id && req.user.role !== 'SUPER_ADMIN') {
    throw new AppError('You can only delete your own wedding', 403);
  }
  const poolsWithContributions = await prisma.giftPool.findFirst({
    where: {
      weddingId: id,
      contributions: { some: {} },
    },
    select: { id: true },
  });

  if (poolsWithContributions) {
    throw new AppError(
      'Cannot delete wedding: one or more gift pools have contributions. Delete or refund them first.',
      400
    );
  }

    const oldWedding = await prisma.wedding.findUnique({
    where: { id },
    select: { title: true, date: true, location: true },
  });

  await prisma.wedding.delete({ where: { id } });

  await logAction({
    userId: req.user.id,
    action: 'DELETE_WEDDING',
    entityType: 'Wedding',
    entityId: id,
    oldValue: oldWedding,
    ipAddress: req.ip,
  });

  res.json({ message: 'Wedding deleted successfully' });
};
