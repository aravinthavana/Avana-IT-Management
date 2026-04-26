import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkUsers() {
    const users = await prisma.user.findMany();
    console.log(JSON.stringify(users, null, 2));
    await prisma.$disconnect();
}

checkUsers();
