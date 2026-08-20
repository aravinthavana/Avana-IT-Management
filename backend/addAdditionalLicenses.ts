import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const exchangeEmails = [
    'stores@avanamedical.com',
    'sundar@avanamedical.com',
    'srinivasan@avanamedical.com',
    'ruchir@avanamedical.com',
    'manish@avanamedical.com',
    'senthilkumar@avanamedical.com',
    'travedesk@avanamedical.com' // Using exact string provided
];

const powerBiEmails = [
    'sudarsan@avanamedical.com'
];

async function main() {
    console.log("Setting up Exchange and PowerBI licenses...");

    // Find or create Exchange Online Server
    let exchangeLicense = await prisma.license.findFirst({ where: { name: 'Exchange Online Server' } });
    if (exchangeLicense) {
        exchangeLicense = await prisma.license.update({
            where: { id: exchangeLicense.id },
            data: { seats: 7, expirationDate: new Date('2027-05-17T00:00:00Z') }
        });
    } else {
        exchangeLicense = await prisma.license.create({
            data: {
                name: 'Exchange Online Server',
                key: 'EXCHANGE_ONLINE',
                seats: 7,
                category: 'Software',
                expirationDate: new Date('2027-05-17T00:00:00Z')
            }
        });
    }

    // Find or create Power BI
    let powerBiLicense = await prisma.license.findFirst({ where: { name: 'Power BI' } });
    if (powerBiLicense) {
        powerBiLicense = await prisma.license.update({
            where: { id: powerBiLicense.id },
            data: { seats: 1, expirationDate: new Date('2027-05-17T00:00:00Z') }
        });
    } else {
        powerBiLicense = await prisma.license.create({
            data: {
                name: 'Power BI',
                key: 'POWER_BI',
                seats: 1,
                category: 'Software',
                expirationDate: new Date('2027-05-17T00:00:00Z')
            }
        });
    }

    // Also update Basic and Standard expiry
    const msLicenses = await prisma.license.findMany({
        where: { name: { in: ['Microsoft 365 Basic', 'Microsoft 365 Standard'] } }
    });
    for (const lic of msLicenses) {
        await prisma.license.update({
            where: { id: lic.id },
            data: { expirationDate: new Date('2027-05-17T00:00:00Z') }
        });
    }

    // Assign Exchange Online
    for (const email of exchangeEmails) {
        let user = await prisma.user.findUnique({ where: { email } });
        if (!user && email === 'travedesk@avanamedical.com') {
            user = await prisma.user.findUnique({ where: { email: 'traveldesk@avanamedical.com' }});
        }
        if (user) {
            const exists = await prisma.licenseAssignment.findFirst({
                where: { userId: user.id, licenseId: exchangeLicense.id }
            });
            if (!exists) {
                await prisma.licenseAssignment.create({
                    data: { userId: user.id, licenseId: exchangeLicense.id }
                });
            }
            console.log(`Assigned Exchange Online to ${user.email}`);
        } else {
            console.log(`Could not find user for email: ${email}`);
        }
    }

    // Assign Power BI
    for (const email of powerBiEmails) {
        const user = await prisma.user.findUnique({ where: { email } });
        if (user) {
            const exists = await prisma.licenseAssignment.findFirst({
                where: { userId: user.id, licenseId: powerBiLicense.id }
            });
            if (!exists) {
                await prisma.licenseAssignment.create({
                    data: { userId: user.id, licenseId: powerBiLicense.id }
                });
            }
            console.log(`Assigned Power BI to ${user.email}`);
        } else {
            console.log(`Could not find user for email: ${email}`);
        }
    }

    console.log("Finished updating licenses.");
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
