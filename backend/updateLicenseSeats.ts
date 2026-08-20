import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.license.updateMany({
    where: { name: 'Microsoft 365 Basic' },
    data: { seats: 134 }
  });

  await prisma.license.updateMany({
    where: { name: 'Microsoft 365 Standard' },
    data: { seats: 37 }
  });

  console.log("Updated license seats.");
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
