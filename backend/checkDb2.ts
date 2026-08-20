import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
    const assets = await prisma.asset.groupBy({ by: ['assigneeType'], _count: true });
    console.log(assets);
}
main().finally(() => prisma.$disconnect());
