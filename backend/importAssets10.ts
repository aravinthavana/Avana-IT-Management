import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const updates = [
    { empId: 'AMD_168', status: 'Uses Own Laptop' },
    { empId: 'AMD_093', status: 'Details Not Collected' },
    { empId: 'AMD_060', status: 'No Laptop Assigned' },
    { empId: 'AMD_022', status: 'No Laptop Assigned' },
    { empId: 'AMD_013', status: 'Details Not Collected' },
    { empId: 'AMD_119', status: 'No Laptop Assigned' },
    { empId: 'AMD_105', status: 'Details Not Collected' },
    { empId: 'AMD_132', status: 'No Laptop Assigned' },
    { empId: 'AMD_030', status: 'No Laptop Assigned' },
    { empId: 'AMD_073', status: 'No Laptop Assigned' },
    { empId: 'AMD_070', status: 'No Laptop Assigned' },
    { empId: 'AMD_071', status: 'No Laptop Assigned' },
    { empId: 'AMD_088', status: 'No Laptop Assigned' },
    { empId: 'AMD_089', status: 'No Laptop Assigned' },
    { empId: 'AMD_176', status: 'Uses Own Laptop' },
    { empId: 'AMD_082', status: 'Uses Own Laptop' },
    { empId: 'AMD_118', status: 'Details Not Collected' },
    { empId: 'AMD_077', status: 'Uses Own Laptop' } // Kshitij
];

async function main() {
    for (const update of updates) {
        const user = await prisma.user.findFirst({ where: { employeeId: update.empId } });
        if (user) {
            await prisma.user.update({
                where: { id: user.id },
                data: { laptopStatus: update.status }
            });
            console.log(`Updated ${user.name} (${update.empId}) to ${update.status}`);
        } else {
            console.log(`WARNING: User ${update.empId} not found!`);
        }
    }
}

main().finally(() => prisma.$disconnect());
