import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log("Deactivating Sabarinathan...");
  
  const sabari = await prisma.user.findUnique({
      where: { email: 'sabarinathan@avanamedical.com' }
  });

  if (!sabari) {
      throw new Error("Sabarinathan not found");
  }

  // Remove All Licenses
  await prisma.licenseAssignment.deleteMany({
      where: {
          userId: sabari.id
      }
  });

  // Mark Inactive
  await prisma.user.update({
      where: { id: sabari.id },
      data: { status: 'Inactive' }
  });

  console.log("Successfully deactivated Sabarinathan and removed licenses.");
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
