import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const managers = await prisma.user.findMany({
        where: { subordinates: { some: {} } }
    });
    
    let count = 0;
    for (const m of managers) {
        if (m.role === 'User') {
            await prisma.user.update({
                where: { id: m.id },
                data: { role: 'Manager' }
            });
            console.log(`Updated ${m.name} to Manager`);
            count++;
        }
    }
    console.log(`Finished updating ${count} managers.`);
}

main().finally(() => prisma.$disconnect());
