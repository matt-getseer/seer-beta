const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function fixTestMeeting() {
  try {
    // Get the users
    const users = await prisma.user.findMany();
    const manager = users.find(u => u.role === 'admin'); // Matt Stevenson
    const teamMember = users.find(u => u.role === 'user'); // The other user
    
    if (!manager || !teamMember) {
      console.log('Need both a manager (admin) and team member (user) to fix the meeting');
      return;
    }
    
    console.log(`Manager: ${manager.name} (${manager.id})`);
    console.log(`Team Member: ${teamMember.email} (${teamMember.id})`);
    
    // Update the test meeting
    const meeting = await prisma.meeting.findFirst({
      where: { title: 'Test Meeting - Task Generation' }
    });
    
    if (meeting) {
      // Delete existing tasks first
      await prisma.task.deleteMany({
        where: { meetingId: meeting.id }
      });
      
      // Update the meeting to have the correct team member
      await prisma.meeting.update({
        where: { id: meeting.id },
        data: {
          teamMemberId: teamMember.id, // Set to the actual team member
          createdBy: manager.id,       // Keep manager as creator
          tasks: [] // Clear legacy tasks so they can be regenerated
        }
      });
      
      console.log('✅ Fixed test meeting:');
      console.log(`  Created by: ${manager.name} (manager)`);
      console.log(`  Team member: ${teamMember.email} (team member)`);
      console.log('  Cleared existing tasks - you can now click "Generate Tasks" again');
    } else {
      console.log('Test meeting not found');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixTestMeeting(); 