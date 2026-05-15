import jwt from 'jsonwebtoken';
import prisma from '../config/database.js';
import redisClient from '../config/redis.js';
import { env } from '../config/env.js';

const auth = async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = header.split(' ')[1];

  try {
    const decoded = jwt.verify(token, env.SECRET_KEY);
    req.user = decoded;
    const blacklisted = await redisClient.get(`blacklist:access:${token}`);
    if (blacklisted) {
      return res.status(401).json({ error: 'Token has been revoked' });
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { emailVerified: true, isBlocked: true },
    });

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    if (user.isBlocked) {
      return res.status(403).json({ error: 'Account is blocked' });
    }

    if (!user.emailVerified) {
      return res.status(403).json({
        error: 'Email not verified. Please verify your email first.',
        needsVerification: true,
      });
    }

    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

export default auth;