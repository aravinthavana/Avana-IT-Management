import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    // Kshitij's employee ID is AMD_077
    const kshitij = await prisma.user.findFirst({ where: { employeeId: 'AMD_077' } });

    if (kshitij) {
        // Delete the duplicate AMD-LAP-BD-0000
        const duplicate = await prisma.asset.findFirst({ where: { assetId: 'AMD-LAP-BD-0000' } });
        if (duplicate) {
            await prisma.asset.delete({ where: { id: duplicate.id } });
            console.log('Deleted duplicate asset AMD-LAP-BD-0000');
        }

        // Unassign AMD-LAP-BD-0138
        const actual = await prisma.asset.findFirst({ where: { assetId: 'AMD-LAP-BD-0138' } });
        if (actual) {
            await prisma.asset.update({
                where: { id: actual.id },
                data: { assigneeId: null, assigneeType: null, status: 'In Stock' }
            });
            console.log('Unassigned actual asset AMD-LAP-BD-0138');
        } else {
            console.log('Actual asset AMD-LAP-BD-0138 not found in DB!');
        }
    }
}

main().finally(() => prisma.$disconnect());
