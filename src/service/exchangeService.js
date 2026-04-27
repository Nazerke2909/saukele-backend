import prisma from '../config/database.js';
import redisClient from '../config/redis.js';

const CACHE_TTL = 300;

export async function getExchangeRate(fromCurrency, toCurrency) {
  const cacheKey = `rate:${fromCurrency}:${toCurrency}`;

  const cached = await redisClient.get(cacheKey);
  if (cached) return parseFloat(cached);

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

  await redisClient.setEx(cacheKey, CACHE_TTL, rate.rate.toString());

  return rate.rate;
}

export default getExchangeRate;
