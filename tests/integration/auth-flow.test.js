import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

afterAll(async () => {
  await prisma.$disconnect();
});

test('ORM can connect to DB and create/read a user', async () => {
  const created = await prisma.user.create({
    data: {
      email: 'simple-test@test.com',
      hashedPassword: 'hash123',
      fullName: 'Test User',
      role: 'GUEST',
    },
  });

  expect(created.id).toBeGreaterThan(0);

  const found = await prisma.user.findUnique({
    where: { email: 'simple-test@test.com' },
  });

  expect(found).not.toBeNull();
  expect(found.fullName).toBe('Test User');

  await prisma.user.delete({ where: { id: created.id } });

  const deleted = await prisma.user.findUnique({
    where: { id: created.id },
  });

  expect(deleted).toBeNull();
});