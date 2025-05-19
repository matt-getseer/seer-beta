import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Database is empty by default - no seeding
  console.log('No users seeded - starting with empty database');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  }); 