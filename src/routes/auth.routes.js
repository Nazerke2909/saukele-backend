import { Router } from 'express';
import asyncHandler from '../utils/asyncHandler.js';
import validate, { registerSchema, loginSchema, refreshSchema } from '../middleware/validation.js';
import loginLimiter from '../middleware/rateLimiter.js';
import {
  register,
  login,
  refresh,
  logout,
} from '../controllers/authController.js';

const router = Router();

router.post('/register', validate(registerSchema), asyncHandler(register));
router.post('/login', loginLimiter, validate(loginSchema), asyncHandler(login));
router.post('/refresh', validate(refreshSchema), asyncHandler(refresh));
router.post('/logout', asyncHandler(logout));

export default router;
