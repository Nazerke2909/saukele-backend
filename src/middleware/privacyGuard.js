import prisma from '../config/database.js';
import { AppError } from './errorHandler.js';


const PRIVACY_ACCESS = {
  PUBLIC: ['GUEST', 'FAMILY_MEMBER', 'COUPLE', 'MODERATOR', 'SUPER_ADMIN'],
  FAMILY_ONLY: ['FAMILY_MEMBER', 'COUPLE', 'MODERATOR', 'SUPER_ADMIN'],
  PRIVATE: ['COUPLE', 'SUPER_ADMIN'],
};

/**
 * @param {Object} user - текущий пользователь (req.user)
 * @param {Object} pool - пул (должен включать wedding.coupleId)
 * @returns {boolean}
 */
export function canAccessPool(user, pool) {
  const allowedRoles = PRIVACY_ACCESS[pool.privacy] || PRIVACY_ACCESS.PUBLIC;

  if (!allowedRoles.includes(user.role)) {
    return false;
  }

  if (pool.privacy === 'PRIVATE') {
    if (user.role === 'SUPER_ADMIN') return true;
    return pool.wedding?.coupleId === user.id;
  }


  if (pool.privacy === 'FAMILY_ONLY') {
    
    if (user.role === 'SUPER_ADMIN' || user.role === 'MODERATOR') return true;
    
    if (user.role === 'COUPLE') {
      return pool.wedding?.coupleId === user.id;
    }
    if (user.role === 'FAMILY_MEMBER') return true;
  }

  
  return true;
}

export async function privacyGuard(req, res, next) {
  const poolId = Number(req.params.id);

  if (!poolId) {
    return next(new AppError('Pool ID is required', 400));
  }

  const pool = await prisma.giftPool.findUnique({
    where: { id: poolId },
    include: {
      wedding: { select: { coupleId: true } },
    },
  });

  if (!pool) {
    return next(new AppError('Gift pool not found', 404));
  }

  if (!canAccessPool(req.user, pool)) {
    return next(new AppError('You do not have access to this gift pool', 403));
  }

  req.pool = pool;
  next();
}

/**
 * @param {Object} user - текущий пользователь
 * @param {number} weddingId - ID свадьбы
 * @param {number} [coupleId] - ID пары (чтобы определить, своя это свадьба или чужая)
 * @returns {Object} where-условие для Prisma
 */
export function buildPrivacyFilter(user, weddingId, coupleId) {
  const baseFilter = { weddingId };

  switch (user.role) {
    case 'SUPER_ADMIN':
    case 'MODERATOR':
      
      return baseFilter;

    case 'COUPLE':
     
      if (coupleId === user.id) {
        return baseFilter;
      }
     
      return { ...baseFilter, privacy: 'PUBLIC' };

    case 'FAMILY_MEMBER':
      
      return {
        ...baseFilter,
        privacy: { in: ['PUBLIC', 'FAMILY_ONLY'] },
      };

    case 'GUEST':
    default:
      
      return { ...baseFilter, privacy: 'PUBLIC' };
  }
}

export function canEditPool(user, pool) {
  if (user.role === 'SUPER_ADMIN') return true;
  if (user.role !== 'COUPLE') return false;

 
  return pool.wedding?.coupleId === user.id;
}

export { PRIVACY_ACCESS };