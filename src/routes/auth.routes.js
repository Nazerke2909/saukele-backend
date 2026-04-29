import { Router } from 'express';
import asyncHandler from '../utils/asyncHandler.js';
import auth from '../middleware/auth.js';
import validate, { registerSchema, loginSchema, refreshSchema } from '../middleware/validation.js';
import loginLimiter from '../middleware/rateLimiter.js';
import {
  register,
  login,
  refresh,
  logout,
  getMe,
  updateProfile,
} from '../controller/authController.js';

const router = Router();

router.post('/register', validate(registerSchema), asyncHandler(register));
router.post('/login', loginLimiter, validate(loginSchema), asyncHandler(login));
router.post('/refresh', validate(refreshSchema), asyncHandler(refresh));
router.post('/logout', asyncHandler(logout));
router.get('/me', auth, asyncHandler(getMe));
router.patch('/profile', auth, asyncHandler(updateProfile));

export default router;

