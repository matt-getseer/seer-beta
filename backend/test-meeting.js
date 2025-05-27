const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Test meeting data with wins and areas for support, but no tasks/action items
const testMeeting = {
  title: "1:1 Meeting - Test Session",
  teamMemberId: '46863fb6-9bd5-4502-9a4b-2962c910d5f9', // Replace with actual user ID
  date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7), // 7 days ago
  duration: 60,
  status: "completed",
  processingStatus: "completed",
  meetingType: "one_on_one",
  executiveSummary: "Sarah had an excellent month with significant achievements in project delivery and team collaboration. The client presentation went exceptionally well, receiving positive feedback from stakeholders. Her mentoring of junior team members is showing great results, with noticeable improvements in their code quality and confidence. The new process improvements she implemented have streamlined our workflow considerably.",
  wins: [
    "Successfully delivered the Q3 feature release two weeks ahead of schedule",
    "Client presentation received outstanding feedback with 95% satisfaction rating",
    "Mentored two junior developers who both received positive performance reviews",
    "Implemented new code review process that reduced bugs by 40%",
    "Led cross-functional workshop that improved team communication",
    "Completed advanced certification in cloud architecture",
    "Received recognition from product team for exceptional collaboration",
    "Improved system performance by 30% through optimization work"
  ],
  areasForSupport: [
    "Time management during peak project periods could be more effective",
    "Public speaking confidence when presenting to larger executive audiences",
    "Balancing perfectionist tendencies with practical delivery timelines",
    "Developing broader industry network for knowledge sharing",
    "Strategic thinking about long-term career progression",
    "Managing stress during high-pressure situations",
    "Building influence with stakeholders outside immediate team"
  ],
  tasks: [], // Explicitly empty - no tasks mentioned
  transcript: "We had a great discussion about Sarah's recent accomplishments and growth areas. Sarah shared her excitement about the successful client presentation and how the preparation really paid off. We talked about the positive impact her mentoring has had on the junior team members, and she expressed genuine satisfaction in seeing their growth. The conversation covered her interest in developing better time management strategies, particularly during busy periods. Sarah mentioned wanting to work on her confidence when presenting to executive audiences, as she has some upcoming opportunities. We discussed various approaches to building her professional network and thinking more strategically about her career path. Overall, it was a very positive session highlighting her strong performance and clear areas for continued development.",
  createdBy: '46863fb6-9bd5-4502-9a4b-2962c910d5f9' // Replace with actual user ID
};

async function createTestMeeting() {
  try {
    console.log('Creating test meeting...');
    
    // Verify the user exists
    const user = await prisma.user.findUnique({
      where: { id: testMeeting.createdBy }
    });
    
    if (!user) {
      console.error(`User with ID ${testMeeting.createdBy} not found!`);
      console.log('Please update the teamMemberId and createdBy fields with a valid user ID');
      return;
    }
    
    console.log(`Found user: ${user.name} (${user.email})`);
    
    // Create the test meeting
    const meeting = await prisma.meeting.create({
      data: testMeeting
    });
    
    console.log(`✅ Test meeting created successfully!`);
    console.log(`Meeting ID: ${meeting.id}`);
    console.log(`Title: ${meeting.title}`);
    console.log(`Wins: ${meeting.wins.length} items`);
    console.log(`Areas for Support: ${meeting.areasForSupport.length} items`);
    console.log(`Tasks: ${meeting.tasks.length} items (should be 0)`);
    
  } catch (error) {
    console.error('Error creating test meeting:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the function if this file is executed directly
if (require.main === module) {
  createTestMeeting();
}

module.exports = { testMeeting, createTestMeeting }; 