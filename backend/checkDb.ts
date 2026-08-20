import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
    const a = await prisma.asset.findFirst({ where: { assetId: 'AMD-DES-BC-0048' } });
    console.log(a);
}
main().finally(() => prisma.$disconnect());
