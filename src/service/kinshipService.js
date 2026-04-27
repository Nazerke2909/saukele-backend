import prisma from '../config/database.js';

const RANK_THRESHOLDS = [
  { rank: 'ATA_ANA', maxDistance: 1 },
  { rank: 'ZHIEN_ZHARAP', maxDistance: 3 },
  { rank: 'SHAKYRT', maxDistance: Infinity },
];

export async function computeKinshipRank(weddingId, memberId) {
  const rows = await prisma.$queryRaw`
    WITH RECURSIVE family_cte AS (
      SELECT
        member_id,
        ancestor_id,
        1 AS depth
      FROM family_trees
      WHERE wedding_id = ${weddingId} AND member_id = ${memberId}

      UNION ALL

      SELECT
        ft.member_id,
        ft.ancestor_id,
        cte.depth + 1
      FROM family_trees ft
      INNER JOIN family_cte cte ON ft.member_id = cte.ancestor_id
      WHERE ft.wedding_id = ${weddingId}
    )
    SELECT MIN(depth) AS distance
    FROM family_cte
    WHERE member_id = ${memberId} AND depth IS NOT NULL
  `;

  const distance = rows[0]?.distance ?? null;

  if (distance === null) return null;

  for (const { rank, maxDistance } of RANK_THRESHOLDS) {
    if (distance <= maxDistance) return rank;
  }

  return 'SHAKYRT';
}

export default computeKinshipRank;
