import { Router } from 'express';
import asyncHandler from '../utils/asyncHandler.js';
import auth from '../middleware/auth.js';
import validate, {
  registerSchema,
  loginSchema,
  refreshSchema,
  emailSchema,
  verifyEmailSchema,
  resetPasswordSchema,
} from '../middleware/validation.js';
import { loginLimiter, registerLimiter, generalLimiter } from '../middleware/rateLimiter.js';
import {
  register,
  login,
  refresh,
  logout,
  getMe,
  updateProfile,
  verifyEmail,
  verifyByToken,
  resendVerification,
  forgotPassword,
  resetPassword,
  searchUserByEmail,    // <-- ДОБАВИТЬ ЭТУ СТРОКУ
} from '../controller/authController.js';

const router = Router();

/**
 * @swagger
 * /auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: "Register a new user"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string, format: email, example: "user@example.com" }
 *               password: { type: string, format: password, minLength: 8, example: "Str0ng!Pass" }
 *               role: { type: string, enum: [GUEST, FAMILY_MEMBER, COUPLE, MODERATOR, SUPER_ADMIN], default: "GUEST" }
 *     responses:
 *       201:
 *         description: "User created. Verification email sent."
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id: { type: integer }
 *                 email: { type: string }
 *                 fullName: { type: string }
 *                 role: { type: string }
 *                 message: { type: string }
 *       409:
 *         description: "Email already registered"
 */
router.post('/register', registerLimiter, validate(registerSchema), asyncHandler(register));

/**
 * @swagger
 * /auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: "Log in and receive JWT tokens"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string, format: email, example: "user@example.com" }
 *               password: { type: string, format: password, example: "Str0ng!Pass" }
 *     responses:
 *       200:
 *         description: "Login successful"
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 accessToken: { type: string, example: "eyJhbGciOiJIUzI1NiIs..." }
 *                 refreshToken: { type: string, example: "eyJhbGciOiJIUzI1NiIs..." }
 *       401:
 *         description: "Invalid email or password"
 */
router.post('/login', loginLimiter, validate(loginSchema), asyncHandler(login));

/**
 * @swagger
 * /auth/refresh:
 *   post:
 *     tags: [Auth]
 *     summary: "Refresh tokens — issue new access + refresh pair (rotation)"
 *     description: "Verifies the refresh token signature, compares it via bcrypt against the stored hash, revokes the old token, and issues a new access + refresh pair. The old refresh token cannot be reused."
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties:
 *               refreshToken: { type: string, example: "eyJhbGciOiJIUzI1NiIs..." }
 *     responses:
 *       200:
 *         description: "New token pair issued (rotation complete)"
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 accessToken: { type: string, example: "eyJhbGciOiJIUzI1NiIs..." }
 *                 refreshToken: { type: string, example: "eyJhbGciOiJIUzI1NiIs..." }
 *       401:
 *         description: "Invalid, expired, or already used refresh token"
 *       403:
 *         description: "Account is blocked"
 */
router.post('/refresh', generalLimiter, validate(refreshSchema), asyncHandler(refresh));

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     tags: [Auth]
 *     summary: "Revoke refresh token and optionally blacklist access token"
 *     description: "Accepts refreshToken in the body OR reads access token from the Authorization header (Bearer). Deletes the stored refresh token hash from DB and adds the access token to a Redis blacklist until its natural expiration."
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               refreshToken:
 *                 type: string
 *                 example: "eyJhbGciOiJIUzI1NiIs..."
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: "Logged out successfully"
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string, example: "Logged out successfully" }
 *       400:
 *         description: "No token provided"
 *       401:
 *         description: "Invalid refresh token"
 */
router.post('/logout', generalLimiter, asyncHandler(logout));

/**
 * @swagger
 * /auth/verify-email:
 *   post:
 *     tags: [Auth]
 *     summary: "Verify email with code sent during registration"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, code]
 *             properties:
 *               email: { type: string, format: email, example: "user@example.com" }
 *               code: { type: string, length: 6, example: "483291" }
 *     responses:
 *       200:
 *         description: "Email verified successfully"
 *       400:
 *         description: "Invalid verification code"
 *       404:
 *         description: "User not found"
 */
router.post('/verify-email', generalLimiter, validate(verifyEmailSchema), asyncHandler(verifyEmail));

/**
 * @swagger
 * /auth/verify/{token}:
 *   get:
 *     tags: [Auth]
 *     summary: "Verify email via JWT token from email link"
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *         description: JWT verification token from email link
 *     responses:
 *       200:
 *         description: "Email verified successfully"
 *       400:
 *         description: "Invalid or expired verification token"
 *       404:
 *         description: "User not found"
 */
router.get('/verify/:token', generalLimiter, asyncHandler(verifyByToken));

/**
 * @swagger
 * /auth/resend-verification:
 *   post:
 *     tags: [Auth]
 *     summary: "Resend verification code to email"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email: { type: string, format: email, example: "user@example.com" }
 *     responses:
 *       200:
 *         description: "Verification code sent to email"
 *       404:
 *         description: "User not found"
 */
router.post('/resend-verification', generalLimiter, validate(emailSchema), asyncHandler(resendVerification));

/**
 * @swagger
 * /auth/forgot-password:
 *   post:
 *     tags: [Auth]
 *     summary: "Request a password reset link"
 *     description: "If the email exists, a reset link is sent. Always returns 200 to prevent email enumeration."
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email: { type: string, format: email, example: "user@example.com" }
 *     responses:
 *       200:
 *         description: "If the email exists, a reset link has been sent"
 */
router.post('/forgot-password', generalLimiter, validate(emailSchema), asyncHandler(forgotPassword));

/**
 * @swagger
 * /auth/reset-password:
 *   post:
 *     tags: [Auth]
 *     summary: "Reset password using token from email"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, token, newPassword]
 *             properties:
 *               email: { type: string, format: email, example: "user@example.com" }
 *               token: { type: string, example: "a1b2c3d4e5f6..." }
 *               newPassword: { type: string, format: password, minLength: 8, example: "NewStr0ng!Pass" }
 *     responses:
 *       200:
 *         description: "Password reset successfully"
 *       400:
 *         description: "Invalid or expired reset token"
 */
router.post('/reset-password', generalLimiter, validate(resetPasswordSchema), asyncHandler(resetPassword));
/**
 * @swagger
 * /auth/me:
 *   get:
 *     tags: [Auth]
 *     summary: "Get current authenticated user"
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: "Current user details"
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id: { type: integer }
 *                 email: { type: string }
 *                 fullName: { type: string }
 *                 role: { type: string }
 *                 emailVerified: { type: boolean }
 *                 createdAt: { type: string, format: date-time }
 *       401:
 *         description: "Unauthorized"
 */
router.get('/me', auth, asyncHandler(getMe));
/**
 * @swagger
 * /auth/profile:
 *   patch:
 *     tags: [Auth]
 *     summary: "Update user profile"
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               firstName: { type: string, example: "Ainur" }
 *               lastName: { type: string, example: "Kairat" }
 *               email: { type: string, format: email, example: "newemail@example.com" }
 *     responses:
 *       200:
 *         description: "Profile updated"
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id: { type: integer }
 *                 email: { type: string }
 *                 fullName: { type: string }
 *                 role: { type: string }
 *       400:
 *         description: "Validation error"
 *       401:
 *         description: "Unauthorized"
 *       409:
 *         description: "Email already in use"
 */
router.patch('/profile', auth, asyncHandler(updateProfile));

/**
 * @swagger
 * /auth/search-user:
 *   get:
 *     tags: [Auth]
 *     summary: "Search user by email"
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: email
 *         required: true
 *         schema: { type: string, format: email }
 *     responses:
 *       200:
 *         description: "User found"
 *       404:
 *         description: "User not found"
 */
router.get('/search-user', auth, asyncHandler(searchUserByEmail));

export default router;