import prisma from '../config/database.js';
import { AppError } from '../middleware/errorHandler.js';
import { logAction } from '../service/auditService.js';
import { queueObligationReminder } from '../queue/producer.js';

const MIN_OBLIGATIONS = {
  ATA_ANA: 100000,
  ZHIEN_ZHARAP: 50000,
  SHAKYRT: 20000,
};

/**
 * GET /family/:weddingId/tree/recursive
 * 
 * Использует PostgreSQL WITH RECURSIVE для построения иерархии семейного дерева
 * прямо на стороне базы данных.
 * 
 * Query params:
 *   - memberId (optional): начать с конкретного пользователя (корень поддерева)
 *   - includeCouple (optional, default false): включить пару (жениха/невесту) как корень
 */
export const getFamilyTreeRecursive = async (req, res) => {
  const weddingId = Number(req.params.weddingId);
  const { memberId, includeCouple } = req.query;

  // Проверяем, существует ли свадьба
  const wedding = await prisma.wedding.findUnique({
    where: { id: weddingId },
    select: {
      id: true,
      title: true,
      coupleId: true,
      couple: { select: { id: true, fullName: true, email: true } },
    },
  });

  if (!wedding) {
    throw new AppError('Wedding not found', 404);
  }

  // WITH RECURSIVE SQL-запрос
  // 1. Начинаем с корневых узлов (ancestor_id IS NULL) или с конкретного memberId
  // 2. Рекурсивно присоединяем потомков
  // 3. Собираем path для отслеживания полной иерархии
  const sql = `
    WITH RECURSIVE family_hierarchy AS (
      -- Базовый случай: корневые элементы (те, у кого нет ancestor)
      SELECT
        ft.id,
        ft.wedding_id,
        ft.member_id,
        ft.ancestor_id,
        ft.kinship_rank,
        ft.custom_distance,
        ft.gift_obligation,
        u.full_name AS member_name,
        u.email AS member_email,
        0 AS level,
        ARRAY[ft.member_id] AS path,
        ARRAY[u.full_name] AS path_names
      FROM family_trees ft
      JOIN users u ON u.id = ft.member_id
      WHERE ft.wedding_id = $1
        AND ft.ancestor_id IS NULL
        ${memberId ? `AND ft.member_id = $2` : ''}

      UNION ALL

      -- Рекурсивный шаг: присоединяем детей (чьи ancestor_id совпадают с member_id из предыдущего уровня)
      SELECT
        ft.id,
        ft.wedding_id,
        ft.member_id,
        ft.ancestor_id,
        ft.kinship_rank,
        ft.custom_distance,
        ft.gift_obligation,
        u.full_name AS member_name,
        u.email AS member_email,
        fh.level + 1 AS level,
        fh.path || ft.member_id AS path,
        fh.path_names || u.full_name AS path_names
      FROM family_trees ft
      JOIN users u ON u.id = ft.member_id
      JOIN family_hierarchy fh ON fh.member_id = ft.ancestor_id
      WHERE ft.wedding_id = $1
        AND NOT (ft.member_id = ANY(fh.path))  -- защита от циклов
    )
    SELECT
      id,
      wedding_id,
      member_id,
      ancestor_id,
      kinship_rank,
      custom_distance,
      gift_obligation,
      member_name,
      member_email,
      level,
      array_to_string(path_names, ' → ') AS lineage
    FROM family_hierarchy
    ORDER BY level, member_name;
  `;

  const params = [weddingId];
  if (memberId) {
    params.push(Number(memberId));
  }

  const tree = await prisma.$queryRawUnsafe(sql, ...params);

  // Группируем по уровням
  const levelsMap = new Map();
  for (const row of tree) {
    const level = Number(row.level);
    if (!levelsMap.has(level)) {
      levelsMap.set(level, []);
    }
    levelsMap.get(level).push({
      id: Number(row.id),
      memberId: Number(row.member_id),
      ancestorId: row.ancestor_id ? Number(row.ancestor_id) : null,
      memberName: row.member_name,
      memberEmail: row.member_email,
      kinshipRank: row.kinship_rank,
      customDistance: row.custom_distance ? Number(row.custom_distance) : null,
      giftObligation: row.gift_obligation ? Number(row.gift_obligation) : null,
      level: Number(row.level),
      lineage: row.lineage,
    });
  }

  // Преобразуем Map в массив уровней
  const levels = [];
  for (const [level, members] of levelsMap) {
    levels.push({ level, members });
  }
  levels.sort((a, b) => a.level - b.level);

  // Собираем статистику по тирам
  const rankCount = {};
  let totalMembers = 0;
  for (const row of tree) {
    const rank = row.kinship_rank;
    rankCount[rank] = (rankCount[rank] || 0) + 1;
    totalMembers++;
  }

  res.json({
    weddingId,
    weddingTitle: wedding.title,
    couple: {
      id: wedding.couple.id,
      fullName: wedding.couple.fullName,
      email: wedding.couple.email,
    },
    queryType: 'WITH RECURSIVE',
    levels,
    summary: {
      totalMembers,
      byRank: rankCount,
      maxDepth: levels.length > 0 ? levels[levels.length - 1].level : 0,
    },
    tree,
  });
};

export const getFamilyTree = async (req, res) => {
  const weddingId = Number(req.params.weddingId);

  const wedding = await prisma.wedding.findUnique({
    where: { id: weddingId },
    select: { id: true },
  });

  if (!wedding) {
    throw new AppError('Wedding not found', 404);
  }

  const familyMembers = await prisma.familyTree.findMany({
    where: { weddingId },
    include: {
      member: { select: { id: true, fullName: true, email: true } },
    },
    orderBy: { member: { fullName: 'asc' } },
  });

  const tree = buildTree(familyMembers);

  res.json({
    weddingId,
    tree,
    totalMembers: tree.length,
  });
};

function buildTree(flatMembers) {
  const memberMap = new Map();
  for (const fm of flatMembers) {
    memberMap.set(fm.memberId, {
      id: fm.id,
      memberId: fm.memberId,
      ancestorId: fm.ancestorId,
      memberName: fm.member.fullName,
      memberEmail: fm.member.email,
      kinshipRank: fm.kinshipRank,
      giftObligation: fm.giftObligation,
      distance: fm.customDistance || 0,
    });
  }

  const depthMap = new Map();
  function computeDepth(memberId) {
    if (depthMap.has(memberId)) return depthMap.get(memberId);
    const member = memberMap.get(memberId);
    if (!member) return 0;
    if (member.ancestorId === null) {
      depthMap.set(memberId, 0);
      return 0;
    }
    const depth = computeDepth(member.ancestorId) + 1;
    depthMap.set(memberId, depth);
    return depth;
  }

  for (const m of flatMembers) {
    computeDepth(m.memberId);
  }

  const result = [];
  for (const [memberId, data] of memberMap) {
    result.push({
      ...data,
      distance: memberMap.get(memberId).distance,
      depth: depthMap.get(memberId) || 0,
    });
  }

  result.sort((a, b) => a.depth - b.depth || a.memberName.localeCompare(b.memberName));

  return result;
}

export const getGiftObligations = async (req, res) => {
  const weddingId = Number(req.params.weddingId);

  const wedding = await prisma.wedding.findUnique({
    where: { id: weddingId },
    select: { id: true },
  });

  if (!wedding) {
    throw new AppError('Wedding not found', 404);
  }

  const familyMembers = await prisma.familyTree.findMany({
    where: { weddingId },
    include: {
      member: { select: { id: true, fullName: true, email: true } },
    },
  });

  const memberIds = familyMembers.map(fm => fm.memberId);

  const contributions = await prisma.contribution.groupBy({
    by: ['guestId'],
    where: {
      guestId: { in: memberIds },
      status: 'COMPLETED',
      pool: { weddingId },
    },
    _sum: { amountKzt: true },
  });

  const contributionMap = new Map();
  for (const c of contributions) {
    contributionMap.set(c.guestId, c._sum.amountKzt);
  }

  const depthMap = buildDepthMap(familyMembers);

  const obligations = familyMembers.map(fm => {
    const contributedKzt = contributionMap.get(fm.memberId) || 0;
    const remainingObligation = fm.giftObligation !== null
      ? fm.giftObligation - (contributedKzt || 0)
      : null;

    return {
      memberId: fm.memberId,
      memberName: fm.member.fullName,
      memberEmail: fm.member.email,
      kinshipRank: fm.kinshipRank,
      giftObligation: fm.giftObligation,
      contributedKzt,
      remainingObligation: remainingObligation !== null && remainingObligation < 0 ? 0 : remainingObligation,
      depth: depthMap.get(fm.memberId) || 0,
    };
  });

  obligations.sort((a, b) => a.depth - b.depth || a.memberName.localeCompare(b.memberName));

  res.json({
    weddingId,
    obligations,
    totalMembers: obligations.length,
  });
};

function buildDepthMap(familyMembers) {
  const parentMap = new Map();
  for (const fm of familyMembers) {
    parentMap.set(fm.memberId, fm.ancestorId);
  }

  const depthMap = new Map();
  function computeDepth(memberId) {
    if (depthMap.has(memberId)) return depthMap.get(memberId);
    const ancestorId = parentMap.get(memberId);
    if (ancestorId === null || ancestorId === undefined) {
      depthMap.set(memberId, 0);
      return 0;
    }
    const depth = computeDepth(ancestorId) + 1;
    depthMap.set(memberId, depth);
    return depth;
  }

  for (const fm of familyMembers) {
    computeDepth(fm.memberId);
  }

  return depthMap;
}

export const addFamilyMember = async (req, res) => {
  const weddingId = Number(req.params.weddingId);
  const { memberId, ancestorId, kinshipRank: providedRank, giftObligation } = req.body;

  const wedding = await prisma.wedding.findUnique({
    where: { id: weddingId },
    select: { id: true, coupleId: true },
  });

  if (!wedding) {
    throw new AppError('Wedding not found', 404);
  }

  const member = await prisma.user.findUnique({
    where: { id: memberId },
    select: { id: true },
  });

  if (!member) {
    throw new AppError('User not found', 404);
  }

  const existingMember = await prisma.familyTree.findFirst({
    where: { memberId },
  });

  if (existingMember) {
    throw new AppError('This user already belongs to a wedding family tree. Each user can belong to only one wedding.', 400);
  }

  let kinshipRank;
  let computedDistance = null;

  // Если kinshipRank передан с фронта — используем его
  if (providedRank) {
    kinshipRank = providedRank;
  } else if (!ancestorId) {
    kinshipRank = 'SHAKYRT';
    computedDistance = null;
  } else {
    const ancestor = await prisma.familyTree.findFirst({
      where: { weddingId, memberId: ancestorId },
    });
    if (!ancestor) {
      throw new AppError('Ancestor not found in this wedding family tree', 404);
    }

    let distance = 0;
    let currentId = ancestorId;
    const visited = new Set();

    const allMembers = await prisma.familyTree.findMany({
      where: { weddingId },
      select: { memberId: true, ancestorId: true },
    });

    const ancestorMap = new Map();
    for (const m of allMembers) {
      ancestorMap.set(m.memberId, m.ancestorId);
    }

    while (currentId !== null && ancestorMap.has(currentId) && !visited.has(currentId)) {
      visited.add(currentId);
      currentId = ancestorMap.get(currentId);
      distance++;
    }

    computedDistance = distance || 1;

    if (computedDistance === 1) {
      kinshipRank = 'ATA_ANA';
    } else if (computedDistance === 2) {
      kinshipRank = 'ZHIEN_ZHARAP';
    } else {
      kinshipRank = 'SHAKYRT';
    }
  }

    const familyMember = await prisma.familyTree.create({
    data: {
      weddingId,
      memberId,
      ancestorId: ancestorId || null,
      kinshipRank,
      customDistance: computedDistance,
      giftObligation: giftObligation || null,
    },
    include: {
      member: { select: { id: true, fullName: true, email: true } },
      ancestor: { select: { id: true, fullName: true, email: true } },
    },
  });

  await logAction({
    userId: req.user.id,
    action: 'ADD_FAMILY_MEMBER',
    entityType: 'FamilyTree',
    entityId: familyMember.id,
    newValue: { weddingId, memberId, ancestorId, kinshipRank, giftObligation },
    ipAddress: req.ip,
  });

  res.status(201).json(familyMember);
};

export const getMyFamilyWedding = async (req, res) => {
  const familyMember = await prisma.familyTree.findFirst({
    where: { memberId: req.user.id },
    select: { weddingId: true },
  });

  if (!familyMember) {
    throw new AppError('You are not a family member of any wedding', 404);
  }

  // 🐛 FIX: Фильтруем пулы по приватности
  const privacyFilter = {
    OR: [
      { privacy: 'PUBLIC' },
      { privacy: 'FAMILY_ONLY' },
      ...(req.user.role === 'SUPER_ADMIN' ? [{ privacy: 'PRIVATE' }] : []),
    ],
  };

  const wedding = await prisma.wedding.findUnique({
    where: { id: familyMember.weddingId },
    include: {
      couple: { select: { id: true, fullName: true, email: true } },
      giftPools: {
        where: privacyFilter,
      },
    },
  });

  if (!wedding) {
    throw new AppError('Wedding not found', 404);
  }

  res.json(wedding);
};

export const getMyRank = async (req, res) => {
  const familyMember = await prisma.familyTree.findFirst({
    where: { memberId: req.user.id },
    include: {
      member: { select: { id: true, fullName: true, email: true } },
      ancestor: { select: { id: true, fullName: true } },
    },
  });

  if (!familyMember) {
    throw new AppError('You are not a family member of any wedding', 404);
  }

  const contributions = await prisma.contribution.aggregate({
    where: {
      guestId: req.user.id,
      status: 'COMPLETED',
      pool: { weddingId: familyMember.weddingId },
    },
    _sum: { amountKzt: true },
  });

  const contributedKzt = contributions._sum.amountKzt || 0;
  const minObligation = MIN_OBLIGATIONS[familyMember.kinshipRank] || 20000;
  const requiredObligation = familyMember.giftObligation || minObligation;
  const remainingObligation = Math.max(0, requiredObligation - contributedKzt);
  const isFulfilled = contributedKzt >= requiredObligation;

  res.json({
    weddingId: familyMember.weddingId,
    memberId: req.user.id,
    fullName: familyMember.member.fullName,
    email: familyMember.member.email,
    kinshipRank: familyMember.kinshipRank,
    ancestor: familyMember.ancestor ? {
      id: familyMember.ancestor.id,
      fullName: familyMember.ancestor.fullName,
    } : null,
    minObligation,
    requiredObligation,
    contributedKzt,
    remainingObligation,
    isFulfilled,
  });
};

export const sendObligationReminders = async (req, res) => {
  const weddingId = Number(req.params.weddingId);

  const wedding = await prisma.wedding.findUnique({
    where: { id: weddingId },
    select: { id: true, title: true },
  });

  if (!wedding) {
    throw new AppError('Wedding not found', 404);
  }

  const familyMembers = await prisma.familyTree.findMany({
    where: { weddingId, giftObligation: { not: null } },
    include: {
      member: { select: { id: true, email: true, fullName: true } },
    },
  });

  const memberIds = familyMembers.map(fm => fm.memberId);

  const contributions = await prisma.contribution.groupBy({
    by: ['guestId'],
    where: {
      guestId: { in: memberIds },
      status: 'COMPLETED',
      pool: { weddingId },
    },
    _sum: { amountKzt: true },
  });

  const contributionMap = new Map();
  for (const c of contributions) {
    contributionMap.set(c.guestId, c._sum.amountKzt);
  }

  const obligationsToRemind = familyMembers.filter(fm => {
    const contributedKzt = contributionMap.get(fm.memberId) || 0;
    return fm.giftObligation > contributedKzt;
  });

  const queuePromises = obligationsToRemind.map((fm) =>
    queueObligationReminder(
      fm.member.email,
      fm.member.fullName,
      wedding.title,
      fm.kinshipRank,
      fm.giftObligation,
      contributionMap.get(fm.memberId) || 0
    ).catch((err) => console.error(`[QUEUE] Failed to queue reminder for ${fm.member.email}:`, err.message))
  );

  await Promise.allSettled(queuePromises);

  res.json({
    message: `Obligation reminders sent to ${obligationsToRemind.length} family members`,
    sentCount: obligationsToRemind.length,
  });
};

export const removeFamilyMember = async (req, res) => {
  const weddingId = Number(req.params.weddingId);
  const memberId = Number(req.params.memberId);

  
  const member = await prisma.familyTree.findFirst({
    where: { weddingId, memberId },
  });

  if (!member) {
    throw new AppError('Member not found in tree', 404);
  }


  const descendant = await prisma.familyTree.findFirst({
    where: { weddingId, ancestorId: memberId },
  });

  if (descendant) {
    throw new AppError('Cannot remove a member who has descendants. Re-assign their ancestorId first.', 400);
  }

    await prisma.familyTree.delete({
    where: { id: member.id },
  });

  await logAction({
    userId: req.user.id,
    action: 'REMOVE_FAMILY_MEMBER',
    entityType: 'FamilyTree',
    entityId: member.id,
    oldValue: { weddingId, memberId, kinshipRank: member.kinshipRank, giftObligation: member.giftObligation },
    ipAddress: req.ip,
  });

  res.json({ message: 'Member removed from family tree' });
};

