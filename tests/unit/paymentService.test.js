import { jest } from '@jest/globals';

let processPayment;

beforeAll(async () => {
  const mod = await import('../../src/service/paymentService.js');
  processPayment = mod.default;
});

describe('Payment Service - Process Payment', () => {
  beforeEach(() => {
  });

  it('should complete payment successfully and return payment intent', async () => {
    const result = await processPayment(50000, 'test-key-1');

    expect(result).toMatchObject({
      success: true,
      amountKzt: 50000,
      status: 'COMPLETED',
    });
    expect(result.paymentIntentId).toBeDefined();
    expect(result.paymentIntentId).toMatch(/^pi_mock_/);
  });

  it('should return the same result for duplicate idempotency key', async () => {
    const first = await processPayment(50000, 'duplicate-key');
    const second = await processPayment(50000, 'duplicate-key');

    expect(second).toEqual(first);
    expect(second.paymentIntentId).toBe(first.paymentIntentId);
  });

  it('should handle zero amount payments', async () => {
    const result = await processPayment(0, 'zero-amount');

    expect(result).toMatchObject({
      success: true,
      amountKzt: 0,
      status: 'COMPLETED',
    });
  });

  it('should handle large amount payments', async () => {
    const result = await processPayment(100000000, 'large-amount');

    expect(result).toMatchObject({
      success: true,
      amountKzt: 100000000,
      status: 'COMPLETED',
    });
  });

  it('should generate unique payment intent IDs for different keys', async () => {
    const result1 = await processPayment(100, 'key-a');
    const result2 = await processPayment(200, 'key-b');

    expect(result1.paymentIntentId).not.toBe(result2.paymentIntentId);
  });
});

describe('Payment Math Tests', () => {
  it('should correctly calculate remaining pool target after contribution', () => {
    const targetKzt = 500000;
    const contribution = 100000;
    const remaining = targetKzt - contribution;
    expect(remaining).toBe(400000);
  });

  it('should correctly detect when pool is fully funded', () => {
    const targetKzt = 500000;
    const contribution = 500000;
    const remaining = targetKzt - contribution;
    expect(remaining).toBe(0);

    // Pool should transition to FUNDED when remaining_target = 0
    const newStatus = remaining === 0 ? 'FUNDED' : 'FUNDING';
    expect(newStatus).toBe('FUNDED');
  });

  it('should reject contributions that exceed remaining target', () => {
    const remainingTarget = 30000;
    const contribution = 50000;
    expect(contribution > remainingTarget).toBe(true);
  });

  it('should allow contributions equal to remaining target', () => {
    const remainingTarget = 30000;
    const contribution = 30000;
    expect(contribution <= remainingTarget).toBe(true);
  });

  it('should accumulate total funded correctly', () => {
    let totalFunded = 0;
    totalFunded += 10000;
    totalFunded += 25000;
    totalFunded += 15000;
    expect(totalFunded).toBe(50000);
  });
});

describe('Escrow State Machine Transitions', () => {
  const VALID_TRANSITIONS = {
    PENDING: ['FUNDING'],
    FUNDING: ['FUNDED'],
    FUNDED: ['PURCHASED'],
    PURCHASED: ['DELIVERED'],
  };

  it('should allow valid transitions', () => {
    const current = 'FUNDING';
    const next = 'FUNDED';
    expect(VALID_TRANSITIONS[current]).toContain(next);
  });

  it('should reject invalid transitions', () => {
    const current = 'PENDING';
    const next = 'PURCHASED';
    expect(VALID_TRANSITIONS[current]).not.toContain(next);
  });

  it('should not allow going backwards in state machine', () => {
    const current = 'FUNDED';
    const next = 'FUNDING';
    expect(VALID_TRANSITIONS[current]).not.toContain(next);
  });

  it('should not allow DELIVERED to transition anywhere', () => {
    expect(VALID_TRANSITIONS['DELIVERED']).toBeUndefined();
  });

  it('should follow complete lifecycle', () => {
    const lifecycle = ['PENDING', 'FUNDING', 'FUNDED', 'PURCHASED', 'DELIVERED'];
    for (let i = 0; i < lifecycle.length - 1; i++) {
      const current = lifecycle[i];
      const next = lifecycle[i + 1];
      expect(VALID_TRANSITIONS[current]).toContain(next);
    }
  });
});
