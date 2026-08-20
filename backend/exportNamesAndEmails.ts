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
            name: true,
            email: true
        }
    });

    fs.writeFileSync('C:/Users/EAravinthkumar/.gemini/antigravity/brain/92896137-1476-4a04-9f57-5058f8ec32e9/avana_names_and_emails.json', JSON.stringify(users, null, 2));
    console.log(`Exported ${users.length} names and emails to avana_names_and_emails.json`);
}

main().finally(() => prisma.$disconnect());
