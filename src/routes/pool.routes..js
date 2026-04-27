import { Router } from 'express';
import asyncHandler from '../utils/asyncHandler.js';
import auth from '../middleware/auth.js';
import roleCheck from '../middleware/roleCheck.js';
import { createPool } from '../controller/poolController.js';

const router = Router();

router.post('/', auth, roleCheck('COUPLE', 'SUPER_ADMIN'), asyncHandler(createPool));

export default router;
