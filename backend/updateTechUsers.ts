import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const namesToUpdate = [
  'singaravel',
  'kumaresan',
  'malini',
  'dinesh',
  'ranjith',
  'aravinth',
  'avinashi',
  'samadhan',
  'chetan',
  'sridhara'
];

async function main() {
  console.log("Updating users to Avana Technology Services...");
  let updatedCount = 0;

  for (const partialName of namesToUpdate) {
    // Find users whose email or name contains the partial name
    const users = await prisma.user.findMany({
      where: {
        OR: [
          { email: { contains: partialName, mode: 'insensitive' } },
          { name: { contains: partialName, mode: 'insensitive' } }
        ]
      }
    });

    if (users.length === 0) {
      console.log(`Could not find any user matching: ${partialName}`);
    } else {
      for (const u of users) {
        console.log(`Updating ${u.name} (${u.email}) -> Avana Technology Services`);
        await prisma.user.update({
          where: { id: u.id },
          data: { company: 'Avana Technology Services' }
        });
        updatedCount++;
      }
    }
  }

  console.log(`Finished updating ${updatedCount} users.`);
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
