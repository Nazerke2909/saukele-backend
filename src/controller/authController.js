import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import prisma from '../config/database.js';
import redisClient from '../config/redis.js';
import { AppError } from '../middleware/errorHandler.js';
import { queueVerificationLinkEmail, queuePasswordResetEmail } from '../queue/producer.js';
import crypto from 'crypto';
import { env } from '../config/env.js';
import {
  BCRYPT_ROUNDS,
} from '../utils/constants.js';

const ACCESS_TOKEN_EXPIRY = `${env.ACCESS_TOKEN_EXPIRE_MINUTES}m`;
const REFRESH_TOKEN_EXPIRY_SEC = env.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60;

export const register = async (req, res) => {
  const { email, password, role } = req.body;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    if (existing.emailVerified) {
      return res.status(409).json({ error: 'Email already registered' });
    }
    // Если email не подтверждён — удаляем старую запись, чтобы можно было зарегистрироваться заново
    await prisma.user.delete({ where: { id: existing.id } });
  }

    const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);

  const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

  const user = await prisma.user.create({
    data: {
      email,
      hashedPassword,
      fullName: req.body.fullName || email.split('@')[0],
      role: role || 'GUEST',
      verificationCode,
    },
    select: { id: true, email: true, fullName: true, role: true },
  });

    // Пытаемся отправить письмо через очередь, если не получилось — отправляем напрямую
  try {
    await queueVerificationLinkEmail(email, verificationCode);
    console.log(`[REGISTER] Verification email queued for ${email}`);
  } catch (queueErr) {
    console.error('[QUEUE] Failed to queue verification email:', queueErr.message);
    console.log('[QUEUE] Falling back to direct email send...');
    try {
      const { sendVerificationLinkEmail } = await import('../service/emailService.js');
      await sendVerificationLinkEmail(email, verificationCode);
      console.log(`[REGISTER] Direct email send succeeded for ${email}`);
    } catch (directErr) {
      console.error('[EMAIL] Direct send also failed:', directErr.message);
    }
  }

  res.status(201).json({
    ...user,
    message: 'Registration successful. Please check your email to verify your account.',
  });
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

  const accessToken = jwt.sign(payload, env.SECRET_KEY, {
    expiresIn: ACCESS_TOKEN_EXPIRY,
  });

  const refreshToken = jwt.sign(payload, env.SECRET_KEY, {
    expiresIn: `${env.REFRESH_TOKEN_EXPIRE_DAYS}d`,
  });

  
  const refreshTokenHash = await bcrypt.hash(refreshToken, BCRYPT_ROUNDS);
  await prisma.user.update({
    where: { id: user.id },
    data: { refreshTokenHash },
  });

    
  await redisClient.set(
    `refresh:${user.id}:${refreshToken}`,
    'valid',
    'EX',
    REFRESH_TOKEN_EXPIRY_SEC
  );

  res.json({ accessToken, refreshToken });
};

export const refresh = async (req, res) => {
  const { refreshToken } = req.body;

  
  let payload;
  try {
    payload = jwt.verify(refreshToken, env.SECRET_KEY);
  } catch {
    return res.status(401).json({ error: 'Invalid or expired refresh token' });
  }

  const user = await prisma.user.findUnique({ where: { id: payload.id } });
  if (!user) {
    return res.status(401).json({ error: 'User not found' });
  }

  if (user.isBlocked) {
    return res.status(403).json({ error: 'Account is blocked' });
  }

  if (!user.refreshTokenHash) {
    return res.status(401).json({ error: 'Refresh token not found' });
  }

  const validHash = await bcrypt.compare(refreshToken, user.refreshTokenHash);
  if (!validHash) {
    return res.status(401).json({ error: 'Invalid refresh token' });
  }

  await redisClient.del(`refresh:${user.id}:${refreshToken}`);

  const newPayload = { id: user.id, email: user.email, role: user.role };

  const accessToken = jwt.sign(newPayload, env.SECRET_KEY, {
    expiresIn: ACCESS_TOKEN_EXPIRY,
  });

  const newRefreshToken = jwt.sign(newPayload, env.SECRET_KEY, {
    expiresIn: `${env.REFRESH_TOKEN_EXPIRE_DAYS}d`,
  });

  const newRefreshTokenHash = await bcrypt.hash(newRefreshToken, BCRYPT_ROUNDS);
  await prisma.user.update({
    where: { id: user.id },
    data: { refreshTokenHash: newRefreshTokenHash },
  });

  await redisClient.set(
    `refresh:${user.id}:${newRefreshToken}`,
    'valid',
    'EX',
    REFRESH_TOKEN_EXPIRY_SEC
  );

  res.json({ accessToken, refreshToken: newRefreshToken });
};

export const logout = async (req, res) => {
  const { refreshToken } = req.body;

  let userId = null;

  if (refreshToken) {
    try {
      const payload = jwt.verify(refreshToken, env.SECRET_KEY);
      userId = payload.id;
    } catch {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    await redisClient.del(`refresh:${userId}:${refreshToken}`);
  }

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const accessToken = authHeader.split(' ')[1];
    try {
      const accessPayload = jwt.verify(accessToken, env.SECRET_KEY);
      if (!userId) userId = accessPayload.id;

      const exp = accessPayload.exp;
      const now = Math.floor(Date.now() / 1000);
      const ttl = Math.max(0, exp - now);
      if (ttl > 0) {
        await redisClient.set(`blacklist:access:${accessToken}`, 'revoked', { EX: ttl });
      }
    } catch {
    }
  }

  if (!userId) {
    return res.status(400).json({ error: 'Provide a refresh token (body) or access token (Authorization header)' });
  }

  await prisma.user.update({
    where: { id: userId },
    data: { refreshTokenHash: null },
  }).catch(() => {
  });

  res.json({ message: 'Logged out successfully' });
};

export const getMe = async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { id: true, email: true, fullName: true, role: true, emailVerified: true, createdAt: true },
  });
  if (!user) {
    throw new AppError('User not found', 404);
  }

  res.json(user);
};

export const updateProfile = async (req, res) => {
  const { fullName, email } = req.body;

  if (!fullName && !email) {
    throw new AppError('Nothing to update — provide fullName or email', 400);
  }

  if (email) {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing && existing.id !== req.user.id) {
      throw new AppError('Email already taken by another user', 409);
    }
  }

  const updated = await prisma.user.update({
    where: { id: req.user.id },
    data: {
      ...(fullName && { fullName }),
      ...(email && { email }),
    },
    select: { id: true, email: true, fullName: true, role: true },
  });

  res.json(updated);
};
export const verifyEmail = async (req, res) => {
  const { email, code } = req.body;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new AppError('User not found', 404);
  }

  if (user.emailVerified) {
    return res.json({ message: 'Email already verified' });
  }

  if (user.verificationCode !== code) {
    throw new AppError('Invalid verification code', 400);
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerified: true,
      verificationCode: null,
    },
  });

  res.json({ message: 'Email verified successfully' });
};

/**
 * Verify email via JWT token from link (GET /auth/verify/:token)
 */
export const verifyByToken = async (req, res) => {
  const { token } = req.params;

  if (!token) {
    return res.status(400).json({ error: 'Verification token is required' });
  }

  let payload;
  try {
    payload = jwt.verify(token, env.SECRET_KEY);
  } catch {
    return res.status(400).json({ error: 'Invalid or expired verification token' });
  }

  const user = await prisma.user.findUnique({ where: { email: payload.email } });
  if (!user) {
    throw new AppError('User not found', 404);
  }

  if (user.emailVerified) {
    return res.json({ message: 'Email already verified' });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerified: true,
      verificationCode: null,
    },
  });

  res.json({ message: 'Email verified successfully' });
};

export const resendVerification = async (req, res) => {
  const { email } = req.body;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new AppError('User not found', 404);
  }

  if (user.emailVerified) {
    return res.json({ message: 'Email already verified' });
  }

  // 🐛 FIX: Генерируем 6-значный код, а не JWT
  const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

  // Сохраняем код в базу
  await prisma.user.update({
    where: { id: user.id },
    data: { verificationCode },
  });

  // Пытаемся отправить письмо через очередь, если не получилось — отправляем напрямую
  try {
    await queueVerificationLinkEmail(email, verificationCode);
    console.log(`[RESEND] Verification email queued for ${email}`);
  } catch (queueErr) {
    console.error('[QUEUE] Failed to queue verification email:', queueErr.message);
    console.log('[QUEUE] Falling back to direct email send...');
    try {
      const { sendVerificationLinkEmail } = await import('../service/emailService.js');
      await sendVerificationLinkEmail(email, verificationCode);
      console.log(`[RESEND] Direct email send succeeded for ${email}`);
    } catch (directErr) {
      console.error('[EMAIL] Direct send also failed:', directErr.message);
    }
  }

  res.json({ message: 'Verification link sent to email.' });
};
export const forgotPassword = async (req, res) => {
  const { email } = req.body;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return res.json({ message: 'If the email exists, a reset link has been sent' });
  }

  const resetToken = crypto.randomBytes(32).toString('hex');
  const resetTokenExp = new Date(Date.now() + 3600000);

  await prisma.user.update({
    where: { id: user.id },
    data: { resetToken, resetTokenExp },
  });

    queuePasswordResetEmail(email, resetToken).catch((err) => {
    console.error('[QUEUE] Failed to queue password reset email:', err.message);
  });

  res.json({ message: 'If the email exists, a reset link has been sent' });
};

export const resetPassword = async (req, res) => {
  const { email, token, newPassword } = req.body;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new AppError('Invalid reset link', 400);
  }

  if (user.resetToken !== token || !user.resetTokenExp || user.resetTokenExp < new Date()) {
    throw new AppError('Invalid or expired reset token', 400);
  }

  const hashedPassword = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      hashedPassword,
      resetToken: null,
      resetTokenExp: null,
    },
  });

  res.json({ message: 'Password reset successfully' });
};
/**
 * GET /auth/search-user?email=user@example.com
 * Поиск пользователя по email (для добавления в Family Tree)
 */
export const searchUserByEmail = async (req, res) => {
  const { email } = req.query;

  if (!email) {
    throw new AppError('Email query param is required', 400);
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, fullName: true, role: true },
  });

  if (!user) {
    throw new AppError('User not found', 404);
  }

  res.json(user);
};