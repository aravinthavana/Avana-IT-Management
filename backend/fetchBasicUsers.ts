import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function main() {
  const basicLicense = await prisma.license.findFirst({
    where: { name: 'Microsoft 365 Basic' }
  });

  if (!basicLicense) {
    throw new Error('Basic license not found');
  }

  const assignments = await prisma.licenseAssignment.findMany({
    where: { licenseId: basicLicense.id },
    include: { user: true }
  });

  const emails = assignments.map(a => a.user?.email).filter(Boolean).sort();
  
  // Write to a temporary file in scratch directory
  const outPath = path.join(process.env.APPDATA || '', '..', 'Local', 'Temp', 'basic_users.txt');
  fs.writeFileSync('basic_users.txt', emails.join('\n'));
  
  console.log(`Found ${emails.length} basic users. Wrote to basic_users.txt`);
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
