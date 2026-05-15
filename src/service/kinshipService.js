import prisma from '../config/database.js';

const RANK_THRESHOLDS = [
  { rank: 'ATA_ANA', maxDistance: 1 },
  { rank: 'ZHIEN_ZHARAP', maxDistance: 3 },
  { rank: 'SHAKYRT', maxDistance: Infinity },
];

export async function computeKinshipRank(weddingId, memberId) {
  const allMembers = await prisma.familyTree.findMany({
    where: { weddingId },
    select: { memberId: true, ancestorId: true },
  });

  let distance = 0;
  let currentId = memberId;
  const visited = new Set();

  while (currentId !== null && !visited.has(currentId)) {
    visited.add(currentId);
    const member = allMembers.find(m => m.memberId === currentId);
    if (!member) break;
    if (member.ancestorId === null) break;
    currentId = member.ancestorId;
    distance++;
  }

  if (distance === 0) return null;

  for (const { rank, maxDistance } of RANK_THRESHOLDS) {
    if (distance <= maxDistance) return rank;
  }

  return 'SHAKYRT';
}

export default computeKinshipRank;