import { Router } from 'express';
import asyncHandler from '../utils/asyncHandler.js';
import auth from '../middleware/auth.js';
import roleCheck from '../middleware/roleCheck.js';
import {
  createPool,
  listPools,
  getPool,
  updatePool,
  deletePool,
  updatePoolStatus,
} from '../controller/poolController.js';
const router = Router();

router.post('/', auth, roleCheck('COUPLE', 'SUPER_ADMIN'), asyncHandler(createPool));
router.get('/', auth, asyncHandler(listPools));
router.get('/:id', auth, asyncHandler(getPool));
router.put('/:id', auth, roleCheck('COUPLE', 'SUPER_ADMIN'), asyncHandler(updatePool));
router.delete('/:id', auth, roleCheck('COUPLE', 'SUPER_ADMIN'), asyncHandler(deletePool));
router.patch('/:id/status', auth, roleCheck('COUPLE', 'SUPER_ADMIN'), asyncHandler(updatePoolStatus));

export default router;

