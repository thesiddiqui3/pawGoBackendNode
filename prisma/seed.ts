import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { seedSystemSettings } from '../src/modules/system-settings/system-settings.seed';

const prisma = new PrismaClient() as any;

async function seedSuperAdmin() {
  const email = 'superadmin@pawgo.com';
  const password = 'PawGo@Admin123';

  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) {
    console.log(`Super admin already exists: ${email}`);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.create({
    data: {
      email,
      firstName: 'Super',
      lastName: 'Admin',
      passwordHash,
      role: 'SUPER_ADMIN',
      status: 'ACTIVE',
      isEmailVerified: true,
      mustChangePassword: false,
    },
  });

  console.log('─────────────────────────────────');
  console.log('Super Admin created:');
  console.log(`  Email    : ${email}`);
  console.log(`  Password : ${password}`);
  console.log('─────────────────────────────────');
}

async function main() {
  console.log('Seeding super admin...');
  await seedSuperAdmin();

  console.log('Seeding system settings...');
  await seedSystemSettings(prisma);

  console.log('Seed complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
