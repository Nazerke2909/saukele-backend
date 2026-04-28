import prisma from '../config/database.js';
import { AppError } from '../middleware/errorHandler.js';

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

  res.status(201).json(wedding);
};

export const getWedding = async (req, res) => {
  const wedding = await prisma.wedding.findUnique({
    where: { id: Number(req.params.id) },
    include: {
      couple: { select: { id: true, fullName: true, email: true } },
      giftPools: true,
    },
  });

  if (!wedding) {
    throw new AppError('Wedding not found', 404);
  }

  res.json(wedding);
};

/**
 * List weddings with cursor-based pagination
 * Cursor is the last visible wedding id
 */
export const listWeddings = async (req, res) => {
  const limit = Math.min(Math.abs(parseInt(req.query.limit, 10)) || 10, 50);
  const cursor = req.query.cursor ? parseInt(req.query.cursor, 10) : undefined;

  const weddings = await prisma.wedding.findMany({
    take: limit + 1, // Take one extra to know if there's a next page
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    orderBy: { createdAt: 'desc' },
    include: {
      couple: { select: { id: true, fullName: true, email: true } },
      _count: { select: { giftPools: true } },
    },
  });

  const hasNextPage = weddings.length > limit;
  const data = hasNextPage ? weddings.slice(0, limit) : weddings;
  const nextCursor = hasNextPage ? data[data.length - 1].id : null;

  res.json({
    data,
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

  // Only the couple or admin can update
  if (wedding.coupleId !== req.user.id && req.user.role !== 'SUPER_ADMIN') {
    throw new AppError('You can only update your own wedding', 403);
  }

  const updated = await prisma.wedding.update({
    where: { id },
    data: {
      ...(title && { title }),
      ...(date && { date: new Date(date) }),
      ...(location !== undefined && { location }),
    },
    include: { couple: { select: { id: true, fullName: true, email: true } } },
  });

  res.json(updated);
};

export const deleteWedding = async (req, res) => {
  const id = Number(req.params.id);

  const wedding = await prisma.wedding.findUnique({
    where: { id },
    select: { id: true, coupleId: true },
  });

  if (!wedding) {
    throw new AppError('Wedding not found', 404);
  }

  if (wedding.coupleId !== req.user.id && req.user.role !== 'SUPER_ADMIN') {
    throw new AppError('You can only delete your own wedding', 403);
  }

  await prisma.wedding.delete({ where: { id } });

  res.json({ message: 'Wedding deleted successfully' });
};

