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
    
    console.log('All users:');
    users.forEach((user, index) => {
      console.log(`User ${index + 1}:`);
      console.log(`  ID: ${user.id}`);
      console.log(`  Name: ${user.name}`);
      console.log(`  Email: ${user.email}`);
      console.log(`  Role: ${user.role}`);
      console.log('');
    });
    
    // Check the test meeting details
    const meeting = await prisma.meeting.findFirst({
      where: { title: 'Test Meeting - Task Generation' }
    });
    
    if (meeting) {
      console.log('Test meeting details:');
      console.log(`  Created by: ${meeting.createdBy}`);
      console.log(`  Team member: ${meeting.teamMemberId}`);
      console.log('');
      
      // Check if they're the same person
      if (meeting.createdBy === meeting.teamMemberId) {
        console.log('⚠️  ISSUE: createdBy and teamMemberId are the same person!');
        console.log('This means the TaskAssignmentService thinks it\'s a single-person meeting.');
      } else {
        console.log('✅ Different people: createdBy and teamMemberId are different.');
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkUsers();
