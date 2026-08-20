import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';

const prisma = new PrismaClient();

async function main() {
    const users = await prisma.user.findMany({
        where: {
            OR: [
                { company: { contains: 'Avana Medical' } },
                { company: { contains: 'Avana Surgical' } },
                { company: { contains: 'Avana Technology' } }
            ]
        },
        select: {
            employeeId: true,
            name: true,
            email: true
        }
    });

    // Remap to a cleaner structure if needed, or just output as is
    const formattedUsers = users.map(user => ({
        "Employee ID": user.employeeId,
        "Name": user.name,
        "Email": user.email
    }));

    fs.writeFileSync('C:/Users/EAravinthkumar/.gemini/antigravity/brain/92896137-1476-4a04-9f57-5058f8ec32e9/avana_users_basic.json', JSON.stringify(formattedUsers, null, 2));
    console.log(`Exported ${formattedUsers.length} users to avana_users_basic.json`);
}

main().finally(() => prisma.$disconnect());
