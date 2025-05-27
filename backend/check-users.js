require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkUsers() {
  try {
    const users = await prisma.user.findMany({
      select: { 
        id: true, 
        name: true, 
        email: true, 
        role: true 
      }
    });

    console.log('📋 Users in database:');
    users.forEach((user, index) => {
      console.log(`${index + 1}. ${user.name || 'No name'} (${user.email}) - ${user.role} - ID: ${user.id}`);
    });

    if (users.length === 0) {
      console.log('❌ No users found in database.');
    }

  } catch (error) {
    console.error('❌ Error checking users:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkUsers(); 