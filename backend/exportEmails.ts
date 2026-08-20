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
            email: true
        }
    });

    const emailList = users.map(user => user.email);

    fs.writeFileSync('C:/Users/EAravinthkumar/.gemini/antigravity/brain/92896137-1476-4a04-9f57-5058f8ec32e9/avana_emails.json', JSON.stringify(emailList, null, 2));
    console.log(`Exported ${emailList.length} emails to avana_emails.json`);
}

main().finally(() => prisma.$disconnect());
