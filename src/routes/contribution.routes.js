import { Router } from 'express';
import asyncHandler from '../utils/asyncHandler.js';
import auth from '../middleware/auth.js';
import { createContribution, getContributions } from '../controller/contributionController.js';

const router = Router();

router.post('/', auth, asyncHandler(createContribution));
router.get('/pool/:poolId', auth, asyncHandler(getContributions));

export default router;
