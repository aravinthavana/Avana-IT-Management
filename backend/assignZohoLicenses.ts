import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';

const prisma = new PrismaClient();

async function main() {
    console.log("Assigning Zoho People Plus Enterprise Plan licenses...");

    const data = JSON.parse(fs.readFileSync('employee_details.json', 'utf-8'));
    const zohoLicense = await prisma.license.findFirst({ where: { name: 'Zoho People Plus Enterprise Plan' } });

    if (!zohoLicense) {
        console.error("License not found. Run createZohoLicense.ts first.");
        return;
    }

    const allUsers = await prisma.user.findMany();
    const userByEmail = new Map<string, any>();
    for (const u of allUsers) {
        if (u.email) userByEmail.set(u.email.toLowerCase(), u);
    }

    let assignedCount = 0;
    let notFoundCount = 0;

    for (const emp of data) {
        const email = emp["Email address"]?.trim().toLowerCase();
        if (!email) continue;

        let user = userByEmail.get(email);
        
        // Handle alias mappings manually for the 3 missing users
        if (!user) {
            if (email === 'mohan@avanamedical.com') user = userByEmail.get('mohan@avanasurgical.com');
            if (email === 'vivekananda@avanamedical.com') user = userByEmail.get('vivek@avanasurgical.com');
            if (email === 'bubeshkumar@avanamedical.com') user = userByEmail.get('bubeshkumar@avanasurgical.com');
        }

        if (user) {
            const exists = await prisma.licenseAssignment.findFirst({
                where: { userId: user.id, licenseId: zohoLicense.id }
            });
            if (!exists) {
                await prisma.licenseAssignment.create({
                    data: { userId: user.id, licenseId: zohoLicense.id }
                });
            }
            assignedCount++;
        } else {
            console.log(`Could not find user for email: ${email}`);
            notFoundCount++;
        }
    }

    console.log(`Assigned license to ${assignedCount} users.`);
    if (notFoundCount > 0) {
        console.log(`Could not find ${notFoundCount} users to assign.`);
    }
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
