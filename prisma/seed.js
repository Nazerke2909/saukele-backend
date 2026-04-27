import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const existing = await prisma.user.findUnique({
    where: { email: 'admin@saukele.kz' },
  });

  if (!existing) {
    const hash = await bcrypt.hash('Admin123!', 10);

    await prisma.user.create({
      data: {
        email: 'admin@saukele.kz',
        hashedPassword: hash,
        role: Role.SUPER_ADMIN,
        fullName: 'Super Admin',
      },
    });

    console.log('[SEED] SUPER_ADMIN created');
  } else {
    console.log('[SEED] SUPER_ADMIN already exists');
  }

  const pairs = [
    { from: 'USD', to: 'KZT', rate: 470.5 },
    { from: 'EUR', to: 'KZT', rate: 510.3 },
  ];

  for (const { from, to, rate } of pairs) {
    const found = await prisma.exchangeRate.findFirst({
      where: { currencyFrom: from, currencyTo: to },
    });

    if (!found) {
      await prisma.exchangeRate.create({
        data: {
          currencyFrom: from,
          currencyTo: to,
          rate,
          source: 'seed',
        },
      });
      console.log(`[SEED] ExchangeRate ${from}→${to} created`);
    } else {
      console.log(`[SEED] ExchangeRate ${from}→${to} already exists`);
    }
  }
}

main()
  .catch((e) => {
    console.error('[SEED] Error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
