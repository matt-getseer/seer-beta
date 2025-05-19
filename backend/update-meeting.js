const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Meeting ID and User ID from logs
const MEETING_ID = 'daa5e634-cbf8-4292-8c82-23f4a20f7744'; // One of the meetings from logs
const REGULAR_USER_ID = 'd8d948d2-a0a0-4ad1-8469-1f3520d50cad'; // The regular user

async function updateMeeting() {
  try {
    // Update the meeting
    const updatedMeeting = await prisma.meeting.update({
      where: {
        id: MEETING_ID
      },
      data: {
        teamMemberId: REGULAR_USER_ID
      }
    });

    console.log('Meeting updated successfully:', updatedMeeting);
  } catch (error) {
    console.error('Error updating meeting:', error);
  } finally {
    await prisma.$disconnect();
  }
}

updateMeeting(); 