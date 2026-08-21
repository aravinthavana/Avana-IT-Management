import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
    const depts = await prisma.department.findMany();
    console.log('Departments:', depts.map(d => d.name));
    const branches = await prisma.branch.findMany();
    console.log('Branches:', branches.map(b => b.name));
}
main().finally(() => prisma.$disconnect());
