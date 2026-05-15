import prisma from '../config/database.js';
import { AppError } from '../middleware/errorHandler.js';
import { logAction } from '../service/auditService.js';
import { queueObligationReminder } from '../queue/producer.js';

const MIN_OBLIGATIONS = {
  ATA_ANA: 100000,
  ZHIEN_ZHARAP: 50000,
  SHAKYRT: 20000,
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
  const { memberId, ancestorId, giftObligation } = req.body;

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

  if (!ancestorId) {
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

  const wedding = await prisma.wedding.findUnique({
    where: { id: familyMember.weddingId },
    include: {
      couple: { select: { id: true, fullName: true, email: true } },
      giftPools: true,
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

