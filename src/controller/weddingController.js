import prisma from '../config/database.js';

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
    return res.status(404).json({ error: 'Wedding not found' });
  }

  res.json(wedding);
};
