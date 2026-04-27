import prisma from '../config/database.js';
import processPayment from '../service/paymentService.js';
import getExchangeRate from '../service/exchangeService.js';

export const createContribution = async (req, res) => {
  const { poolId, originalAmount, originalCurrency, idempotencyKey } = req.body;
  const guestId = req.user.id;

  const result = await prisma.$transaction(async (tx) => {
    const [pool] = await tx.$queryRaw`
      SELECT id, wedding_id, target_kzt, remaining_target, total_funded, status, family_only
      FROM gift_pools
      WHERE id = ${poolId}
      FOR UPDATE
    `;

    if (!pool) {
      throw Object.assign(new Error('Gift pool not found'), { statusCode: 404 });
    }

    if (pool.status === 'FUNDED' || pool.status === 'PURCHASED' || pool.status === 'DELIVERED') {
      throw Object.assign(new Error('Pool is no longer accepting contributions'), { statusCode: 400 });
    }

    let amountKzt;
    let exchangeRate;

    if (originalCurrency === 'KZT') {
      amountKzt = originalAmount;
      exchangeRate = 1;
    } else {
      exchangeRate = await getExchangeRate(originalCurrency, 'KZT');
      amountKzt = Math.round(originalAmount * exchangeRate);
    }

    if (amountKzt > pool.remaining_target) {
      throw Object.assign(
        new Error(`Contribution exceeds remaining target (${pool.remaining_target} KZT)`),
        { statusCode: 400 }
      );
    }

    const payment = await processPayment(amountKzt, idempotencyKey);

    if (payment.status === 'COMPLETED') {
      const contribution = await tx.contribution.create({
        data: {
          guestId,
          poolId,
          amountKzt,
          originalAmount,
          originalCurrency,
          exchangeRate,
          paymentIntentId: payment.paymentIntentId,
          status: 'COMPLETED',
        },
      });

      await tx.giftPool.update({
        where: { id: poolId },
        data: {
          totalFunded: { increment: amountKzt },
          remainingTarget: { decrement: amountKzt },
          status: pool.remaining_target - amountKzt === 0 ? 'FUNDED' : 'FUNDING',
        },
      });

      return contribution;
    }

    throw Object.assign(new Error('Payment failed'), { statusCode: 502 });
  });

  res.status(201).json(result);
};

export const getContributions = async (req, res) => {
  const poolId = Number(req.params.poolId);

  const contributions = await prisma.contribution.findMany({
    where: { poolId },
    include: {
      guest: { select: { id: true, fullName: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  res.json(contributions);
};
