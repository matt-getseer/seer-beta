const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkTasks() {
  try {
    const meeting = await prisma.meeting.findFirst({
      where: { title: 'Test Meeting - Task Generation' },
      include: { tasksData: true }
    });
    
    if (meeting) {
      console.log('Meeting found:', meeting.id);
      console.log('Legacy tasks:', meeting.tasks);
      console.log('Structured tasks count:', meeting.tasksData.length);
      
      meeting.tasksData.forEach((task, index) => {
        console.log(`Task ${index + 1}:`);
        console.log(`  Text: ${task.text}`);
        console.log(`  Assigned to: ${task.assignedTo}`);
        console.log(`  Status: ${task.status}`);
        console.log('');
      });
    } else {
      console.log('No test meeting found');
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkTasks(); 