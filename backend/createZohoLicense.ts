import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    console.log("Setting up Zoho People Plus Enterprise Plan license...");

    let zohoLicense = await prisma.license.findFirst({ where: { name: 'Zoho People Plus Enterprise Plan' } });
    if (zohoLicense) {
        zohoLicense = await prisma.license.update({
            where: { id: zohoLicense.id },
            data: { seats: 128, expirationDate: new Date('2027-04-01T00:00:00Z') }
        });
    } else {
        zohoLicense = await prisma.license.create({
            data: {
                name: 'Zoho People Plus Enterprise Plan',
                key: 'ZOHO_PEOPLE_PLUS',
                seats: 128,
                category: 'Software',
                expirationDate: new Date('2027-04-01T00:00:00Z'),
                remarks: 'Billing cycle - Yearly'
            }
        });
    }

    console.log("License created with 128 seats, expiry 01-Apr-2027");
}

main().finally(() => prisma.$disconnect());
