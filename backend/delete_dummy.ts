import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const result = await prisma.selfAudit.deleteMany({});
  console.log(`Deleted ${result.count} dummy self audits.`);
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
