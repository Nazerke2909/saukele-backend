import prisma from '../config/database.js';

export const createPool = async (req, res) => {
  const { weddingId, name, description, targetKzt, familyOnly } = req.body;

  const wedding = await prisma.wedding.findUnique({
    where: { id: weddingId },
    select: { id: true, coupleId: true },
  });

  if (!wedding) {
    return res.status(404).json({ error: 'Wedding not found' });
  }

  if (wedding.coupleId !== req.user.id) {
    return res.status(403).json({ error: 'You can only create pools for your own wedding' });
  }

  const pool = await prisma.giftPool.create({
    data: {
      weddingId,
      name,
      description,
      targetKzt,
      remainingTarget: targetKzt,
      familyOnly: familyOnly || false,
    },
  });

  res.status(201).json(pool);
};
