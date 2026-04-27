import { Router } from 'express';
import asyncHandler from '../utils/asyncHandler.js';
import auth from '../middleware/auth.js';
import roleCheck from '../middleware/roleCheck.js';
import { createWedding, getWedding } from '../controller/weddingController.js';

const router = Router();

router.post('/', auth, roleCheck('COUPLE', 'SUPER_ADMIN'), asyncHandler(createWedding));
router.get('/:id', auth, asyncHandler(getWedding));

export default router;
