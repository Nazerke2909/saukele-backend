import prisma from '../config/database.js';

const DEFAULT_REGISTRY_GIFTS = [
  {
    name: '💍 Саукеле — Свадебный головной убор',
    description: 'Традиционный казахский свадебный головной убор / Дәстүрлі қазақтың той бас киімі',
    targetKzt: 200000,
    isFragile: true,
    giftType: 'SAUKELE',
  },
  {
    name: '🥛 Сүт ақы / Молочная плата',
    description: 'Традиционный подарок от родителей / Дәстүрлі ата-ана сыйлығы',
    targetKzt: 50000,
    isFragile: false,
    giftType: 'SUT_AKY',
  },
  {
    name: '💰 Қаржы / Денежный подарок',
    description: 'Любой вклад в бюджет молодожёнов / Жас жұбайлар бюджетіне кез келген үлес',
    targetKzt: 300000,
    isFragile: false,
    giftType: 'KARZHY',
  },
];

export async function createRegistryWithGifts({ weddingId, coupleId }) {
  const registry = await prisma.registry.create({
    data: {
      weddingId,
      coupleId,
    },
  });

  // 2. Создаём GiftPool'ы
  const giftPools = [];
  for (const gift of DEFAULT_REGISTRY_GIFTS) {
    const pool = await prisma.giftPool.create({
      data: {
        weddingId,
        registryId: registry.id,
        name: gift.name,
        description: gift.description,
        targetKzt: gift.targetKzt,
        remainingTarget: gift.targetKzt,
        isFragile: gift.isFragile,
        privacy: 'PUBLIC',
        status: 'PENDING',
      },
    });
    giftPools.push(pool);
  }

  console.log(`[REGISTRY] Created registry #${registry.id} with ${giftPools.length} gifts for wedding #${weddingId}`);

  return { registry, giftPools };
}