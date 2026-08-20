import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const users = await prisma.user.findMany({
        where: {
            OR: [
                { name: { contains: 'Mohan' } },
                { name: { contains: 'Vivekananda' } },
                { name: { contains: 'Bubesh' } }
            ]
        },
        select: { email: true, name: true, employeeId: true }
    });
    console.log(users);
}
main().finally(() => prisma.$disconnect());
