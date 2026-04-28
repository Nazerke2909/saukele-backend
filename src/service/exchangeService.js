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

export async function getExchangeRate(fromCurrency, toCurrency) {
  const cacheKey = `rate:${fromCurrency}:${toCurrency}`;

  // Try cache first (gracefully handle Redis being unavailable)
  if (isRedisReady()) {
    try {
  const cached = await redisClient.get(cacheKey);
  if (cached) return parseFloat(cached);
    } catch {
      // Redis unavailable, fall through to DB
    }
  }

  const rate = await prisma.exchangeRate.findFirst({
    where: {
      currencyFrom: fromCurrency,
      currencyTo: toCurrency,
      validUntil: null,
    },
    orderBy: { validFrom: 'desc' },
  });

  if (!rate) {
    throw new Error(`Exchange rate not found: ${fromCurrency} → ${toCurrency}`);
  }

  // Cache the result (best effort)
  if (isRedisReady()) {
    try {
  await redisClient.setEx(cacheKey, CACHE_TTL, rate.rate.toString());
    } catch {
      // Silently fail caching
}
  }

  return rate.rate;
}

export default getExchangeRate;

