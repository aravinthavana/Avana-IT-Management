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
        include: {
            department: true,
            branch: true,
            manager: true
        }
    });

    const formattedUsers = users.map(user => ({
        "Employee ID": user.employeeId,
        "Name": user.name,
        "Email": user.email,
        "Company": user.company,
        "Account Type": user.accountType,
        "Role": user.role,
        "Status": user.status,
        "Job Title": user.jobTitle,
        "Department": user.department?.name || null,
        "Location": user.branch?.name || null,
        "Reporting Manager": user.manager?.name || null,
        "Mobile": user.mobile
    }));

    fs.writeFileSync('C:/Users/EAravinthkumar/.gemini/antigravity/brain/92896137-1476-4a04-9f57-5058f8ec32e9/avana_users.json', JSON.stringify(formattedUsers, null, 2));
    console.log(`Exported ${formattedUsers.length} users to avana_users.json`);
}

main().finally(() => prisma.$disconnect());
