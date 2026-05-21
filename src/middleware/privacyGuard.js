import prisma from '../config/database.js';
import { AppError } from './errorHandler.js';

/**
 * Уровни приватности и какие роли имеют к ним доступ:
 *
 * PUBLIC       → все аутентифицированные пользователи
 * FAMILY_ONLY  → COUPLE (только своей свадьбы) + FAMILY_MEMBER + MODERATOR + SUPER_ADMIN
 * PRIVATE      → только COUPLE (владелец пула) и SUPER_ADMIN
 *
 * Важно: COUPLE не видит FAMILY_ONLY пулы чужой свадьбы.
 *        FAMILY_MEMBER видит FAMILY_ONLY только в рамках своей семьи (по weddingId).
 */

const PRIVACY_ACCESS = {
  PUBLIC: ['GUEST', 'FAMILY_MEMBER', 'COUPLE', 'MODERATOR', 'SUPER_ADMIN'],
  FAMILY_ONLY: ['FAMILY_MEMBER', 'COUPLE', 'MODERATOR', 'SUPER_ADMIN'],
  PRIVATE: ['COUPLE', 'SUPER_ADMIN'],
};

/**
 * Проверяет, имеет ли пользователь доступ к пулу с указанным уровнем приватности.
 *
 * @param {Object} user - текущий пользователь (req.user)
 * @param {Object} pool - пул (должен включать wedding.coupleId)
 * @returns {boolean}
 */
export function canAccessPool(user, pool) {
  const allowedRoles = PRIVACY_ACCESS[pool.privacy] || PRIVACY_ACCESS.PUBLIC;

  // Если роль пользователя вообще не в списке допустимых — отказ
  if (!allowedRoles.includes(user.role)) {
    return false;
  }

  // PRIVATE — только владелец (COUPLE своей свадьбы) или SUPER_ADMIN
  if (pool.privacy === 'PRIVATE') {
    if (user.role === 'SUPER_ADMIN') return true;
    return pool.wedding?.coupleId === user.id;
  }

  // FAMILY_ONLY — пропускаем FAMILY_MEMBER, MODERATOR, SUPER_ADMIN
  if (pool.privacy === 'FAMILY_ONLY') {
    // SUPER_ADMIN и MODERATOR видят всё
    if (user.role === 'SUPER_ADMIN' || user.role === 'MODERATOR') return true;
    // COUPLE видит FAMILY_ONLY только своей свадьбы
    if (user.role === 'COUPLE') {
      return pool.wedding?.coupleId === user.id;
    }
    // FAMILY_MEMBER видит FAMILY_ONLY (но на уровне списка дополнительно фильтруется по weddingId)
    if (user.role === 'FAMILY_MEMBER') return true;
  }

  // PUBLIC — все роли пропускаем
  return true;
}

/**
 * Middleware: проверяет доступ к конкретному пулу по его ID из req.params.id.
 * Использовать на роутах: GET /pools/:id, POST /pools/:id/contribute и т.д.
 */
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

  // Сохраняем pool в req для последующего использования в контроллере
  req.pool = pool;
  next();
}

/**
 * Строит where-условие для Prisma, чтобы отфильтровать пулы по приватности.
 * Использовать в listPools и других эндпоинтах со списком пулов.
 * Фильтрация происходит на уровне SQL запроса — никаких лишних данных не возвращается.
 *
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
      // Видят всё
      return baseFilter;

    case 'COUPLE':
      // Если это своя свадьба — видит все свои пулы (включая PRIVATE)
      if (coupleId === user.id) {
        return baseFilter;
      }
      // Если чужая свадьба — видит только PUBLIC
      return { ...baseFilter, privacy: 'PUBLIC' };

    case 'FAMILY_MEMBER':
      // PUBLIC + FAMILY_ONLY (только в рамках своей семьи по weddingId)
      return {
        ...baseFilter,
        privacy: { in: ['PUBLIC', 'FAMILY_ONLY'] },
      };

    case 'GUEST':
    default:
      // Только PUBLIC
      return { ...baseFilter, privacy: 'PUBLIC' };
  }
}

/**
 * Проверяет, может ли пользователь редактировать пул (COUPLE или SUPER_ADMIN).
 * Для PRIVATE пулов — дополнительно проверяет владельца.
 */
export function canEditPool(user, pool) {
  if (user.role === 'SUPER_ADMIN') return true;
  if (user.role !== 'COUPLE') return false;

  // COUPLE может редактировать только свои пулы
  return pool.wedding?.coupleId === user.id;
}

export { PRIVACY_ACCESS };