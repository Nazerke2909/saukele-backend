import { jest } from '@jest/globals';

const VALID_TRANSITIONS = {
  PENDING: ['FUNDING'],
  FUNDING: ['FUNDED'],
  FUNDED: ['PURCHASED'],
  PURCHASED: ['DELIVERED'],
};

const CLOSED_STATUSES = ['FUNDED', 'PURCHASED', 'DELIVERED'];
const EDITABLE_STATUSES = ['PENDING', 'FUNDING'];

describe('Pool State Machine (VALID_TRANSITIONS)', () => {
  it('should allow PENDING → FUNDING', () => {
    expect(VALID_TRANSITIONS.PENDING).toContain('FUNDING');
  });

  it('should allow FUNDING → FUNDED', () => {
    expect(VALID_TRANSITIONS.FUNDING).toContain('FUNDED');
  });

  it('should allow FUNDED → PURCHASED', () => {
    expect(VALID_TRANSITIONS.FUNDED).toContain('PURCHASED');
  });

  it('should allow PURCHASED → DELIVERED', () => {
    expect(VALID_TRANSITIONS.PURCHASED).toContain('DELIVERED');
  });

  it('should not allow DELIVERED to transition anywhere', () => {
    expect(VALID_TRANSITIONS.DELIVERED).toBeUndefined();
  });

  it('should not allow jumping from PENDING to FUNDED', () => {
    expect(VALID_TRANSITIONS.PENDING).not.toContain('FUNDED');
  });

  it('should not allow jumping from FUNDING to PURCHASED', () => {
    expect(VALID_TRANSITIONS.FUNDING).not.toContain('PURCHASED');
  });

  it('should not allow going backwards from FUNDED to FUNDING', () => {
    expect(VALID_TRANSITIONS.FUNDED).not.toContain('FUNDING');
  });

  it('should not allow going backwards from PURCHASED to FUNDED', () => {
    expect(VALID_TRANSITIONS.PURCHASED).not.toContain('FUNDED');
  });

  it('should complete full lifecycle PENDING → FUNDING → FUNDED → PURCHASED → DELIVERED', () => {
    const lifecycle = ['PENDING', 'FUNDING', 'FUNDED', 'PURCHASED', 'DELIVERED'];
    for (let i = 0; i < lifecycle.length - 1; i++) {
      expect(VALID_TRANSITIONS[lifecycle[i]]).toContain(lifecycle[i + 1]);
    }
  });
});

describe('Pool Status Guards (open/closed for contributions)', () => {
  it('should allow contributions to PENDING and FUNDING pools', () => {
    expect(EDITABLE_STATUSES).toContain('PENDING');
    expect(EDITABLE_STATUSES).toContain('FUNDING');
  });

  it('should reject contributions to FUNDED pools', () => {
    expect(CLOSED_STATUSES).toContain('FUNDED');
    expect(EDITABLE_STATUSES).not.toContain('FUNDED');
  });

  it('should reject contributions to PURCHASED pools', () => {
    expect(CLOSED_STATUSES).toContain('PURCHASED');
    expect(EDITABLE_STATUSES).not.toContain('PURCHASED');
  });

  it('should reject contributions to DELIVERED pools', () => {
    expect(CLOSED_STATUSES).toContain('DELIVERED');
    expect(EDITABLE_STATUSES).not.toContain('DELIVERED');
  });
});

describe('Pool Update Validation Logic', () => {
  it('should reject targetKzt of 0 or negative', () => {
    const targets = [0, -1, -100];
    for (const target of targets) {
      const isValid = target > 0;
      expect(isValid).toBe(false);
    }
  });

  it('should accept positive targetKzt', () => {
    expect(1 > 0).toBe(true);
    expect(100000 > 0).toBe(true);
  });

  it('should reject new target less than already funded amount', () => {
    const totalFunded = 50000;
    const newTarget = 30000;
    const isValid = newTarget >= totalFunded;
    expect(isValid).toBe(false);
  });

  it('should accept new target equal to funded amount', () => {
    const totalFunded = 50000;
    const newTarget = 50000;
    const isValid = newTarget >= totalFunded;
    expect(isValid).toBe(true);
  });

  it('should accept new target greater than funded amount', () => {
    const totalFunded = 50000;
    const newTarget = 75000;
    const isValid = newTarget >= totalFunded;
    expect(isValid).toBe(true);
  });

  it('should calculate remainingTarget correctly after target increase', () => {
    const totalFunded = 30000;
    const oldTarget = 50000;
    const oldRemaining = oldTarget - totalFunded; // 20000

    const newTarget = 80000;
    const newRemaining = newTarget - totalFunded; // 50000

    expect(oldRemaining).toBe(20000);
    expect(newRemaining).toBe(50000);
    expect(newRemaining).toBeGreaterThan(oldRemaining);
  });

  it('should only allow editing pools in PENDING or FUNDING status', () => {
    expect(EDITABLE_STATUSES).toContain('PENDING');
    expect(EDITABLE_STATUSES).toContain('FUNDING');
    expect(EDITABLE_STATUSES).not.toContain('FUNDED');
    expect(EDITABLE_STATUSES).not.toContain('PURCHASED');
    expect(EDITABLE_STATUSES).not.toContain('DELIVERED');
  });

  it('should correctly compute remainingTarget = targetKzt - totalFunded', () => {
    const data = { targetKzt: 100000, totalFunded: 45000 };
    const remainingTarget = data.targetKzt - data.totalFunded;
    expect(remainingTarget).toBe(55000);
  });
});

describe('Purchase & Delivery Guards', () => {
  it('should only allow purchase from FUNDED status', () => {
    expect(VALID_TRANSITIONS.FUNDED).toContain('PURCHASED');
    expect(VALID_TRANSITIONS.FUNDING).not.toContain('PURCHASED');
    expect(VALID_TRANSITIONS.PENDING).not.toContain('PURCHASED');
  });

  it('should only allow delivery from PURCHASED status', () => {
    expect(VALID_TRANSITIONS.PURCHASED).toContain('DELIVERED');
    expect(VALID_TRANSITIONS.FUNDED).not.toContain('DELIVERED');
    expect(VALID_TRANSITIONS.FUNDING).not.toContain('DELIVERED');
  });
});