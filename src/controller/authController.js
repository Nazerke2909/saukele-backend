import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import prisma from '../config/database.js';
import redisClient from '../config/redis.js';
import {
  BCRYPT_ROUNDS,
  ACCESS_TOKEN_EXPIRY,
  REFRESH_TOKEN_EXPIRY_SEC,
} from '../utils/constants.js';

export const register = async (req, res) => {
  const { email, password, firstName, lastName, role } = req.body;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return res.status(409).json({ error: 'Email already registered' });
  }

  const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);

  const user = await prisma.user.create({
    data: {
      email,
      hashedPassword,
      fullName: `${firstName} ${lastName}`.trim(),
      role: role || 'GUEST',
    },
    select: { id: true, email: true, fullName: true, role: true },
  });

  res.status(201).json(user);
};

export const login = async (req, res) => {
  const { email, password } = req.body;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const valid = await bcrypt.compare(password, user.hashedPassword);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const payload = { id: user.id, email: user.email, role: user.role };

  const accessToken = jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRY,
  });

  const refreshToken = jwt.sign(payload, process.env.REFRESH_TOKEN_SECRET, {
    expiresIn: '7d',
  });

  await redisClient.set(
    `refresh:${user.id}:${refreshToken}`,
    'valid',
    { EX: REFRESH_TOKEN_EXPIRY_SEC }
  );

  res.json({ accessToken, refreshToken });
};

export const refresh = async (req, res) => {
  const { refreshToken } = req.body;

  let payload;
  try {
    payload = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
  } catch {
    return res.status(401).json({ error: 'Invalid or expired refresh token' });
  }

  const stored = await redisClient.get(`refresh:${payload.id}:${refreshToken}`);
  if (!stored) {
    return res.status(401).json({ error: 'Refresh token revoked or not found' });
  }

  const newPayload = { id: payload.id, email: payload.email, role: payload.role };

  const accessToken = jwt.sign(newPayload, process.env.JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRY,
  });

  res.json({ accessToken });
};

export const logout = async (req, res) => {
  const { refreshToken } = req.body;

  let payload;
  try {
    payload = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
  } catch {
    return res.status(401).json({ error: 'Invalid refresh token' });
  }

  await redisClient.del(`refresh:${payload.id}:${refreshToken}`);

  res.json({ message: 'Logged out successfully' });
};
