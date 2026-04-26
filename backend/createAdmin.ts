import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const email = 'admin@avana.com';
  const password = 'admin';
  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      password: hashedPassword,
      role: 'Admin',
      status: 'Active'
    },
    create: {
      name: 'System Admin',
      email,
      password: hashedPassword,
      role: 'Admin',
      status: 'Active'
    }
  });

  console.log('✅ Admin user created/updated successfully!');
  console.log(`Username (Email): ${user.email}`);
  console.log(`Password: ${password}`);
}

main()
  .catch((e) => {
    console.error('❌ Failed to create admin user:', e.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
