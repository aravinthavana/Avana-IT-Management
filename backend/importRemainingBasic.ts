import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const newUsers = [
  { email: 'suganthan@avanasurgical.com', name: 'Suganthan (Surgical)', company: 'Avana Surgical Systems' },
  { email: 'suganthan@avanamedical.com', name: 'Suganthan (Medical)', company: 'Avana Medical Devices' },
  { email: 'ajaytanwar@avanasurgical.com', name: 'Ajay Tanwar', company: 'Avana Surgical Systems' },
  { email: 'jayasree@avanamedical.com', name: 'Jayasree', company: 'Avana Medical Devices' },
  { email: 'tushargupta@avanamedical.com', name: 'Tushar Gupta', company: 'Avana Medical Devices' },
  { email: 'bhuvanchandra@avanasurgical.com', name: 'Bhuvan Chandra', company: 'Avana Surgical Systems' },
  { email: 'mayurchandrakant@avanamedical.com', name: 'Mayur Chandrakant', company: 'Avana Medical Devices' },
  { email: 'pushpavasagan@avanasurgical.com', name: 'Pushpavasagan', company: 'Avana Surgical Systems' }
];

async function main() {
  console.log("Fetching M365 Basic License...");
  
  let basicLicense = await prisma.license.findFirst({ where: { name: 'Microsoft 365 Basic' }});
  if (!basicLicense) throw new Error("Microsoft 365 Basic license not found in DB.");

  console.log("Importing 8 remaining Basic users...");
  let count = 0;
  for (const acc of newUsers) {
    const user = await prisma.user.upsert({
      where: { email: acc.email },
      update: {
        name: acc.name,
        company: acc.company
      },
      create: {
        email: acc.email,
        name: acc.name,
        role: "User",
        status: "Active",
        accountType: 'Employee',
        company: acc.company
      }
    });
    
    // Check if assignment exists
    const existingAssignment = await prisma.licenseAssignment.findFirst({
      where: { userId: user.id, licenseId: basicLicense.id }
    });

    if (!existingAssignment) {
      await prisma.licenseAssignment.create({
        data: {
          userId: user.id,
          licenseId: basicLicense.id
        }
      });
    }
    
    count++;
  }
  
  console.log(`Successfully imported ${count} users and assigned M365 Basic licenses.`);
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
