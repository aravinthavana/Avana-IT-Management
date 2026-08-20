import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const usersWithoutAssets = await prisma.user.findMany({
        where: {
            status: 'Active',
            assets: { none: {} }
        },
        select: {
            name: true,
            employeeId: true
        }
    });
    console.log(`Found ${usersWithoutAssets.length} users with no assets:`);
    usersWithoutAssets.forEach(u => console.log(`${u.name} (${u.employeeId || 'No ID'})`));
}

main().finally(() => prisma.$disconnect());
