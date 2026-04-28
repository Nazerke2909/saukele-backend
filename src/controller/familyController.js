import prisma from '../config/database.js';
import { AppError } from '../middleware/errorHandler.js';

/**
 * Get full family tree hierarchy using recursive CTE
 * Returns all members with their depth/level in the tree
 */
export const getFamilyTree = async (req, res) => {
  const weddingId = Number(req.params.weddingId);

  const wedding = await prisma.wedding.findUnique({
    where: { id: weddingId },
    select: { id: true },
  });

  if (!wedding) {
    throw new AppError('Wedding not found', 404);
  }

  // Use Prisma's $queryRawUnsafe for the recursive CTE
  const tree = await prisma.$queryRawUnsafe(`
    WITH RECURSIVE family_hierarchy AS (
      -- Base case: root members (no ancestor)
      SELECT
        ft.id,
        ft.member_id,
        ft.ancestor_id,
        ft.kinship_rank,
        ft.gift_obligation,
        ft.custom_distance,
        0 AS depth,
        u.full_name AS member_name,
        u.email AS member_email
      FROM family_trees ft
      JOIN users u ON u.id = ft.member_id
      WHERE ft.wedding_id = $1 AND ft.ancestor_id IS NULL

      UNION ALL

      -- Recursive step: children
      SELECT
        ft.id,
        ft.member_id,
        ft.ancestor_id,
        ft.kinship_rank,
        ft.gift_obligation,
        ft.custom_distance,
        fh.depth + 1 AS depth,
        u.full_name AS member_name,
        u.email AS member_email
      FROM family_trees ft
      JOIN family_hierarchy fh ON ft.ancestor_id = fh.member_id
      JOIN users u ON u.id = ft.member_id
      WHERE ft.wedding_id = $1
    )
    SELECT
      id,
      member_id AS "memberId",
      ancestor_id AS "ancestorId",
      member_name AS "memberName",
      member_email AS "memberEmail",
      kinship_rank AS "kinshipRank",
      gift_obligation AS "giftObligation",
      COALESCE(custom_distance, depth) AS "distance",
      depth
    FROM family_hierarchy
    ORDER BY depth ASC, member_name ASC
  `, weddingId);

  res.json({
    weddingId,
    tree,
    totalMembers: tree.length,
  });
};

/**
 * Get gift obligations for all family members
 */
export const getGiftObligations = async (req, res) => {
  const weddingId = Number(req.params.weddingId);

  const wedding = await prisma.wedding.findUnique({
    where: { id: weddingId },
    select: { id: true },
  });

  if (!wedding) {
    throw new AppError('Wedding not found', 404);
  }

  const obligations = await prisma.$queryRawUnsafe(`
    WITH RECURSIVE family_hierarchy AS (
      SELECT
        ft.member_id,
        ft.ancestor_id,
        ft.kinship_rank,
        ft.gift_obligation,
        0 AS depth
      FROM family_trees ft
      WHERE ft.wedding_id = $1 AND ft.ancestor_id IS NULL

      UNION ALL

      SELECT
        ft.member_id,
        ft.ancestor_id,
        ft.kinship_rank,
        ft.gift_obligation,
        fh.depth + 1 AS depth
      FROM family_trees ft
      JOIN family_hierarchy fh ON ft.ancestor_id = fh.member_id
      WHERE ft.wedding_id = $1
    )
    SELECT
      fh.member_id AS "memberId",
      u.full_name AS "memberName",
      u.email AS "memberEmail",
      fh.kinship_rank AS "kinshipRank",
      fh.gift_obligation AS "giftObligation",
      fh.depth,
      COALESCE(
        (SELECT SUM(c.amount_kzt)
         FROM contributions c
         JOIN gift_pools gp ON gp.id = c.pool_id
         WHERE c.guest_id = fh.member_id AND gp.wedding_id = $1 AND c.status = 'COMPLETED'),
        0
      ) AS "contributedKzt",
      CASE
        WHEN fh.gift_obligation IS NOT NULL THEN
          fh.gift_obligation - COALESCE(
            (SELECT SUM(c.amount_kzt)
             FROM contributions c
             JOIN gift_pools gp ON gp.id = c.pool_id
             WHERE c.guest_id = fh.member_id AND gp.wedding_id = $1 AND c.status = 'COMPLETED'),
            0
          )
        ELSE NULL
      END AS "remainingObligation"
    FROM family_hierarchy fh
    JOIN users u ON u.id = fh.member_id
    ORDER BY fh.depth ASC, u.full_name ASC
  `, weddingId);

  res.json({
    weddingId,
    obligations,
    totalMembers: obligations.length,
  });
};

/**
 * Add a family member to the wedding tree
 */
export const addFamilyMember = async (req, res) => {
  const weddingId = Number(req.params.weddingId);
  const { memberId, ancestorId, kinshipRank, giftObligation } = req.body;

  const wedding = await prisma.wedding.findUnique({
    where: { id: weddingId },
    select: { id: true },
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

  // If ancestorId provided, verify ancestor exists
  if (ancestorId) {
    const ancestor = await prisma.familyTree.findFirst({
      where: { weddingId, memberId: ancestorId },
    });
    if (!ancestor) {
      throw new AppError('Ancestor not found in this wedding family tree', 404);
    }
  }

  const familyMember = await prisma.familyTree.create({
    data: {
      weddingId,
      memberId,
      ancestorId: ancestorId || null,
      kinshipRank,
      giftObligation: giftObligation || null,
    },
    include: {
      member: { select: { id: true, fullName: true, email: true } },
      ancestor: { select: { id: true, fullName: true, email: true } },
    },
  });

  res.status(201).json(familyMember);
};
