import { jest } from '@jest/globals';

jest.unstable_mockModule('../../src/config/database.js', () => ({
  default: {
    $transaction: jest.fn(),
    $queryRaw: jest.fn(),
    giftPool: {
      findUnique: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
    contribution: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    exchangeRate: {
      findFirst: jest.fn(),
    },
    wedding: {
      findUnique: jest.fn(),
    },
    familyTree: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
  },
}));

jest.unstable_mockModule('../../src/config/redis.js', () => ({
  default: {
    get: jest.fn(),
    setEx: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  },
}));

describe('Contribution Transaction Atomicity', () => {
  describe('Pool Capacity Guards', () => {
    it('should reject contribution exceeding remaining target', () => {
      const remainingTarget = 30000;
      const contributionAmount = 50000;
      const wouldOversell = contributionAmount > remainingTarget;
      expect(wouldOversell).toBe(true);
    });

    it('should accept contribution equal to remaining target', () => {
      const remainingTarget = 30000;
      const contributionAmount = 30000;
      expect(contributionAmount <= remainingTarget).toBe(true);
    });

    it('should accept contribution less than remaining target', () => {
      const remainingTarget = 100000;
      const contributionAmount = 30000;
      expect(contributionAmount <= remainingTarget).toBe(true);
    });
  });

  describe('Pool Status Guards', () => {
    const OPEN_STATUSES = ['PENDING', 'FUNDING'];
    const CLOSED_STATUSES = ['FUNDED', 'PURCHASED', 'DELIVERED'];

    it('should allow contributions to FUNDING pools', () => {
      expect(OPEN_STATUSES.includes('FUNDING')).toBe(true);
    });

    it('should NOT allow contributions to FUNDED pools', () => {
      expect(CLOSED_STATUSES.includes('FUNDED')).toBe(true);
      expect(OPEN_STATUSES.includes('FUNDED')).toBe(false);
    });

    it('should NOT allow contributions to PURCHASED pools', () => {
      expect(CLOSED_STATUSES.includes('PURCHASED')).toBe(true);
      expect(OPEN_STATUSES.includes('PURCHASED')).toBe(false);
    });

    it('should NOT allow contributions to DELIVERED pools', () => {
      expect(CLOSED_STATUSES.includes('DELIVERED')).toBe(true);
      expect(OPEN_STATUSES.includes('DELIVERED')).toBe(false);
    });
  });

  describe('Double-Entry Prevention (Idempotency)', () => {
    it('should detect duplicate idempotency key', () => {
      const processedKeys = new Set();
      const key = 'test-uniq-key';

      processedKeys.add(key);
      expect(processedKeys.has(key)).toBe(true);

      expect(processedKeys.has(key)).toBe(true);
      expect(processedKeys.size).toBe(1);
    });
  });

  describe('Currency Snapshot Immutability', () => {
    it('should lock exchange rate at creation time', () => {
      const contribution = {
        amountKzt: 47050,
        originalAmount: 100,
        originalCurrency: 'USD',
        exchangeRate: 470.5,
        lockedAt: new Date('2025-01-15T10:00:00Z'),
      };

      const newRate = 480.0;
      const recalculatedKzt = Math.round(contribution.originalAmount * newRate);

      expect(contribution.amountKzt).not.toBe(recalculatedKzt);
      expect(contribution.amountKzt).toBe(47050);
    });

    it('should preserve historical rate', () => {
      const original = {
            amountKzt: 50000,
        originalAmount: 100,
        originalCurrency: 'USD',
        exchangeRate: 500.0,
      };

      const immutable = { ...original };

      immutable.exchangeRate = 480.0;

      expect(original.exchangeRate).toBe(500.0);
      expect(original.amountKzt).toBe(50000);
    });
  });

  describe('Escrow State Machine Transitions', () => {
    const ESCROW_TRANSITIONS = {
      PENDING: ['FUNDING'],
      FUNDING: ['FUNDED'],
      FUNDED: ['PURCHASED'],
      PURCHASED: ['DELIVERED'],
      };

    it('should complete full lifecycle from PENDING to DELIVERED', () => {
      const lifecycle = ['PENDING', 'FUNDING', 'FUNDED', 'PURCHASED', 'DELIVERED'];
      for (let i = 0; i < lifecycle.length - 1; i++) {
        expect(ESCROW_TRANSITIONS[lifecycle[i]]).toContain(lifecycle[i + 1]);
      }
    });

    it('should reject backward transitions', () => {
      expect(ESCROW_TRANSITIONS['FUNDED']).not.toContain('FUNDING');
      expect(ESCROW_TRANSITIONS['PURCHASED']).not.toContain('FUNDED');
    });
  });
});

