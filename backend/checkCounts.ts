import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
    const totalUsers = await prisma.user.count();
    const activeUsers = await prisma.user.count({ where: { status: 'Active' }});
    const employees = await prisma.user.count({ where: { accountType: 'Employee' }});
    const withEmpId = await prisma.user.count({ where: { employeeId: { not: null } }});
    console.log(`Total: ${totalUsers}, Active: ${activeUsers}, Employees: ${employees}, With EmpId: ${withEmpId}`);
}
main().finally(() => prisma.$disconnect());
