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
  if (fromCurrency === toCurrency) return 1;

  const cacheKey = `rate:${fromCurrency}:${toCurrency}`;

  if (isRedisReady()) {
    try {
      const cached = await redisClient.get(cacheKey);
      if (cached) return parseFloat(cached);
    } catch {
     
    }
  }

  
  let rate = await prisma.exchangeRate.findFirst({
    where: {
      currencyFrom: fromCurrency,
      currencyTo: toCurrency,
      validUntil: null,
    },
    orderBy: { validFrom: 'desc' },
  });

  
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
      
    }
  }

  return rate.rate;
}

export async function getExchangeRateAt(fromCurrency, toCurrency, targetDate = new Date()) {
  if (fromCurrency === toCurrency) return 1;

 
  const snapshot = await prisma.exchangeRateSnapshot.findFirst({
    where: {
      currencyFrom: fromCurrency,
      currencyTo: toCurrency,
      lockedAt: { lte: targetDate },
    },
    orderBy: { lockedAt: 'desc' },
  });

  if (snapshot) return snapshot.rate;

 
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

  return getExchangeRate(fromCurrency, toCurrency);
}

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

export function convertToKzt(amount, rate) {
  return Math.round(amount * rate);
}

export function convertFromKzt(kztAmount, rate) {
  if (!rate || rate <= 0) return null;
  return parseFloat((kztAmount / rate).toFixed(2));
}

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