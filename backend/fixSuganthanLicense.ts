import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log("Fixing Suganthan's license...");
  
  let basicLicense = await prisma.license.findFirst({ where: { name: 'Microsoft 365 Basic' }});
  let stdLicense = await prisma.license.findFirst({ where: { name: 'Microsoft 365 Standard' }});
  
  if (!basicLicense || !stdLicense) {
      throw new Error("Licenses not found");
  }

  const suganthan = await prisma.user.findUnique({
      where: { email: 'suganthan@avanamedical.com' }
  });

  if (!suganthan) {
      throw new Error("Suganthan not found");
  }

  // Remove Basic License
  await prisma.licenseAssignment.deleteMany({
      where: {
          userId: suganthan.id,
          licenseId: basicLicense.id
      }
  });

  // Assign Standard License
  const existingStd = await prisma.licenseAssignment.findFirst({
      where: { userId: suganthan.id, licenseId: stdLicense.id }
  });

  if (!existingStd) {
      await prisma.licenseAssignment.create({
          data: {
              userId: suganthan.id,
              licenseId: stdLicense.id
          }
      });
  }

  console.log("Successfully changed Suganthan to Standard license.");
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
