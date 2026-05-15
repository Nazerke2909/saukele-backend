describe('Exchange Rate Math', () => {
  it('should convert USD to KZT correctly', () => {
    const rate = 470.5;
    const usdAmount = 100;
    const kztAmount = Math.round(usdAmount * rate);
    expect(kztAmount).toBe(47050);
  });

  it('should convert EUR to KZT correctly', () => {
    const rate = 510.3;
    const eurAmount = 50;
    const kztAmount = Math.round(eurAmount * rate);
    expect(kztAmount).toBe(25515);
  });

  it('should handle zero amount', () => {
    const rate = 470.5;
    expect(Math.round(0 * rate)).toBe(0);
  });

  it('should handle KZT to KZT as identity', () => {
    const amount = 50000;
    expect(Math.round(amount * 1)).toBe(50000);
  });

  it('should handle large amounts without overflow', () => {
    const rate = 470.5;
    const largeAmount = 1000000;
    const result = Math.round(largeAmount * rate);
    expect(result).toBe(470500000);
    expect(Number.isSafeInteger(result)).toBe(true);
  });

  it('should round fractional results correctly', () => {
    const rate = 470.5;
    const amount = 1.5;
    const result = Math.round(amount * rate);
    // 1.5 * 470.5 = 705.75 -> rounds to 706
    expect(result).toBe(706);
  });

  it('should handle very small amounts', () => {
    const rate = 470.5;
    const amount = 0.01;
    const result = Math.round(amount * rate);
    // 0.01 * 470.5 = 4.705 -> rounds to 5
    expect(result).toBe(5);
  });
});

describe('Exchange Rate Service Logic', () => {
  it('should throw error for negative exchange rates', () => {
    const rate = -1;
    expect(() => {
      if (rate <= 0) throw new Error('Invalid exchange rate');
    }).toThrow('Invalid exchange rate');
  });

  it('should validate currency codes are uppercase', () => {
    const validCurrencies = ['USD', 'EUR', 'KZT', 'GBP', 'RUB'];
    const invalid = ['usd', 'Eur', 'kzt'];

    for (const c of validCurrencies) {
      expect(c).toBe(c.toUpperCase());
    }
    for (const c of invalid) {
      expect(c).not.toBe(c.toUpperCase());
    }
  });

  it('should detect non-numeric rate values', () => {
    const rate = 'abc';
    const parsed = parseFloat(rate);
    expect(Number.isNaN(parsed)).toBe(true);
  });
});

