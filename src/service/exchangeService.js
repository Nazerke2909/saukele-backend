import prisma from '../config/database.js';
import redisClient from '../config/redis.js';

const CACHE_TTL = 300;

function isRedisReady() {
  try {
    return redisClient.isOpen;
  } catch {
    return false;
  }
}

/**
 * Get the current active exchange rate from the ExchangeRate table.
 * Falls back to ExchangeRateSnapshot if not found.
 */
export async function getExchangeRate(fromCurrency, toCurrency) {
  if (fromCurrency === toCurrency) return 1;

  const cacheKey = `rate:${fromCurrency}:${toCurrency}`;

  if (isRedisReady()) {
    try {
      const cached = await redisClient.get(cacheKey);
      if (cached) return parseFloat(cached);
    } catch {
      // Redis unavailable
    }
  }

  // Try active exchange rate first
  let rate = await prisma.exchangeRate.findFirst({
    where: {
      currencyFrom: fromCurrency,
      currencyTo: toCurrency,
      validUntil: null,
    },
    orderBy: { validFrom: 'desc' },
  });

  // Fall back to latest snapshot
  if (!rate) {
    rate = await prisma.exchangeRateSnapshot.findFirst({
      where: {
        currencyFrom: fromCurrency,
        currencyTo: toCurrency,
      },
      orderBy: { lockedAt: 'desc' },
    });
  }

  if (!rate) {
    throw new Error(`Exchange rate not found: ${fromCurrency} → ${toCurrency}`);
  }

  if (isRedisReady()) {
    try {
      await redisClient.setEx(cacheKey, CACHE_TTL, rate.rate.toString());
    } catch {
      // Redis unavailable
    }
  }

  return rate.rate;
}

/**
 * Get exchange rate valid at a specific point in time.
 * First checks ExchangeRateSnapshot (lockedAt <= targetDate),
 * then ExchangeRate (validFrom <= targetDate and (validUntil IS NULL OR validUntil > targetDate)).
 */
export async function getExchangeRateAt(fromCurrency, toCurrency, targetDate = new Date()) {
  if (fromCurrency === toCurrency) return 1;

  // 1. Try snapshots first
  const snapshot = await prisma.exchangeRateSnapshot.findFirst({
    where: {
      currencyFrom: fromCurrency,
      currencyTo: toCurrency,
      lockedAt: { lte: targetDate },
    },
    orderBy: { lockedAt: 'desc' },
  });

  if (snapshot) return snapshot.rate;

  // 2. Try exchange_rates table valid at that date
  const rate = await prisma.exchangeRate.findFirst({
    where: {
      currencyFrom: fromCurrency,
      currencyTo: toCurrency,
      validFrom: { lte: targetDate },
      AND: [
        { validUntil: null },
        { validUntil: { gt: targetDate } },
      ],
    },
    orderBy: { validFrom: 'desc' },
  });

  if (rate) return rate.rate;

  // 3. Try current active rate
  return getExchangeRate(fromCurrency, toCurrency);
}

/**
 * Record an immutable exchange rate snapshot.
 * This is called when a contribution is created to lock the rate history.
 */
export async function recordExchangeRateSnapshot(fromCurrency, toCurrency, rate, source = 'contribution') {
  if (fromCurrency === toCurrency) return;

  return prisma.exchangeRateSnapshot.create({
    data: {
      currencyFrom: fromCurrency,
      currencyTo: toCurrency,
      rate,
      source,
    },
  });
}

/**
 * Convert an amount from one currency to KZT using a specific exchange rate.
 */
export function convertToKzt(amount, rate) {
  return Math.round(amount * rate);
}

/**
 * Convert KZT amount to a target currency using a specific exchange rate.
 * rate = fromTarget → KZT, so KZT / rate = target amount
 */
export function convertFromKzt(kztAmount, rate) {
  if (!rate || rate <= 0) return null;
  return parseFloat((kztAmount / rate).toFixed(2));
}

/**
 * Convert amount between any two currencies using the rate at a given timestamp.
 */
export async function convertAmount(amount, fromCurrency, toCurrency, timestamp) {
  if (fromCurrency === toCurrency) return amount;

  let rate;
  if (timestamp) {
    rate = await getExchangeRateAt(fromCurrency, toCurrency, timestamp);
  } else {
    rate = await getExchangeRate(fromCurrency, toCurrency);
  }

  return amount * rate;
}

export default getExchangeRate;