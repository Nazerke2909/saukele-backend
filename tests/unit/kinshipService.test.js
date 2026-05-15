import { jest } from '@jest/globals';

const RANK_THRESHOLDS = [
  { rank: 'ATA_ANA', maxDistance: 1 },
  { rank: 'ZHIEN_ZHARAP', maxDistance: 3 },
  { rank: 'SHAKYRT', maxDistance: Infinity },
];

function determineRank(distance) {
  if (distance === null || distance === undefined) return null;

  for (const { rank, maxDistance } of RANK_THRESHOLDS) {
    if (distance <= maxDistance) return rank;
  }

  return 'SHAKYRT';
}

describe('computeKinshipRank — Rank Determination Logic', () => {
  it('should return ATA_ANA for distance 0', () => {
    expect(determineRank(0)).toBe('ATA_ANA');
  });

  it('should return ATA_ANA for distance 1', () => {
    expect(determineRank(1)).toBe('ATA_ANA');
  });

  it('should return ZHIEN_ZHARAP for distance 2', () => {
    expect(determineRank(2)).toBe('ZHIEN_ZHARAP');
  });

  it('should return ZHIEN_ZHARAP for distance 3', () => {
    expect(determineRank(3)).toBe('ZHIEN_ZHARAP');
  });

  it('should return SHAKYRT for distance 4', () => {
    expect(determineRank(4)).toBe('SHAKYRT');
  });

  it('should return SHAKYRT for distance 10', () => {
    expect(determineRank(10)).toBe('SHAKYRT');
  });

  it('should return SHAKYRT for distance Infinity', () => {
    expect(determineRank(Infinity)).toBe('SHAKYRT');
  });

  it('should return SHAKYRT for very large distance (1000)', () => {
    expect(determineRank(1000)).toBe('SHAKYRT');
  });

  it('should return null when distance is null', () => {
    expect(determineRank(null)).toBeNull();
  });

  it('should return null when distance is undefined', () => {
    expect(determineRank(undefined)).toBeNull();
  });

  it('should handle negative distance as ATA_ANA (edge case)', () => {
    expect(determineRank(-1)).toBe('ATA_ANA');
  });

  it('should apply thresholds in order: ATA_ANA < ZHIEN_ZHARAP < SHAKYRT', () => {
    expect(determineRank(1)).toBe('ATA_ANA');
    expect(determineRank(2)).toBe('ZHIEN_ZHARAP');
    expect(determineRank(3)).toBe('ZHIEN_ZHARAP');
    expect(determineRank(4)).toBe('SHAKYRT');
  });
});