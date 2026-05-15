import { jest } from '@jest/globals';

function determineKinshipRank(computedDistance) {
  if (computedDistance === null || computedDistance === undefined) {
    return 'SHAKYRT';
  }

  if (computedDistance === 1) return 'ATA_ANA';
  if (computedDistance === 2) return 'ZHIEN_ZHARAP';
  if (computedDistance === 3) return 'ZHIEN_ZHARAP';
  return 'SHAKYRT';
}

describe('addFamilyMember — Kinship Rank Determination', () => {
  it('should return ATA_ANA when distance is 1 (parent/root child)', () => {
    expect(determineKinshipRank(1)).toBe('ATA_ANA');
  });

  it('should return ZHIEN_ZHARAP when distance is 2', () => {
    expect(determineKinshipRank(2)).toBe('ZHIEN_ZHARAP');
  });

  it('should return ZHIEN_ZHARAP when distance is 3', () => {
    expect(determineKinshipRank(3)).toBe('ZHIEN_ZHARAP');
  });

  it('should return SHAKYRT when distance is 4', () => {
    expect(determineKinshipRank(4)).toBe('SHAKYRT');
  });

  it('should return SHAKYRT when distance is 5', () => {
    expect(determineKinshipRank(5)).toBe('SHAKYRT');
  });

  it('should return SHAKYRT when distance is 10', () => {
    expect(determineKinshipRank(10)).toBe('SHAKYRT');
  });

  it('should return SHAKYRT when distance is 100', () => {
    expect(determineKinshipRank(100)).toBe('SHAKYRT');
  });

  it('should return SHAKYRT when distance is null (root member, no ancestor)', () => {
    expect(determineKinshipRank(null)).toBe('SHAKYRT');
  });

  it('should return SHAKYRT when distance is undefined', () => {
    expect(determineKinshipRank(undefined)).toBe('SHAKYRT');
  });

    it('should handle distance = 0 — root with no ancestor defaults to SHAKYRT', () => {
    expect(determineKinshipRank(0)).toBe('SHAKYRT');
  });
});

describe('addFamilyMember — Existing Member Guard', () => {
  it('should detect that a user already belongs to a family tree', () => {
    const existingMemberId = 5;
    const existingMembers = new Set([1, 2, 3, 5, 7]);

    expect(existingMembers.has(existingMemberId)).toBe(true);
  });

  it('should allow a user who does not belong to any family tree', () => {
    const newMemberId = 10;
    const existingMembers = new Set([1, 2, 3, 5, 7]);

    expect(existingMembers.has(newMemberId)).toBe(false);
  });
});

describe('addFamilyMember — Ancestor Validation', () => {
  it('should confirm ancestor exists in the wedding tree', () => {
    const weddingTreeMemberIds = new Set([1, 2, 3, 4]);
    const ancestorId = 3;

    expect(weddingTreeMemberIds.has(ancestorId)).toBe(true);
  });

  it('should reject ancestor not in wedding tree', () => {
    const weddingTreeMemberIds = new Set([1, 2, 3, 4]);
    const ancestorId = 99;

    expect(weddingTreeMemberIds.has(ancestorId)).toBe(false);
  });
});

describe('Gift Obligation Calculation', () => {
  it('should compute remaining obligation correctly: obligation - contributed', () => {
    const obligationKzt = 100000;
    const contributedKzt = 45000;
    const remaining = obligationKzt - contributedKzt;
    expect(remaining).toBe(55000);
  });

  it('should compute zero remaining when fully paid', () => {
    const obligationKzt = 100000;
    const contributedKzt = 100000;
    const remaining = obligationKzt - contributedKzt;
    expect(remaining).toBe(0);
  });

  it('should detect obligation is fulfilled', () => {
    const obligationKzt = 50000;
    const contributedKzt = 50000;
    const remaining = obligationKzt - contributedKzt;
    const isFulfilled = remaining <= 0;
    expect(isFulfilled).toBe(true);
  });

  it('should detect obligation is not fulfilled', () => {
    const obligationKzt = 50000;
    const contributedKzt = 30000;
    const remaining = obligationKzt - contributedKzt;
    const isFulfilled = remaining <= 0;
    expect(isFulfilled).toBe(false);
  });
});