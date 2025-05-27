const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function createTestMeeting() {
  try {
    // Get the first user to use as creator and team member
    const user = await prisma.user.findFirst();
    
    if (!user) {
      console.log('No users found. Please create a user first.');
      return;
    }
    
    const transcript = `Matt Stevenson: So I've noticed her designs are consistently polished and the technical execution is strong. I think that to take the work to the next level. It would be good to see you like further deepen. Or user empathy. Through more like direct qualitative research. And, you know, you're great at synthesizing data. But I think... That it's getting even closer to our users real-world experiences with Locksum. innovations. So I think... Is I'd like you to... Um personally lead at least three user interviews. Or usability test sessions for your next project. And then come prepared to show me those key learnings. And basically, how those insights directly influence what are we doing? Um, I also think your ability to deliver high quality designs is great. But I think that again, it's sort of... We all need to be better. Driving the cross-functional alignment. But earlier on. And in the process. So it's like... We're getting valuable input from engineering or product. But it's sometimes a bit too late. Tsk. Which then might lead to having to rework. For your next project, I want you to... Proactively schedule and facilitate a lease. Nope. One early stage workshop. Or just a brainstorming session. Right. The goal is to, you know, gather. Perspectives and identify potential stuff. Um, and I want you to... Tip Schedule a call with me. Um,
Matt Stevenson: as well, after you've done those. And then what I'm going to do. Something for me is, I'm going to set up a... Cool. Between. Some of the product leaders. Um, and that's on me. But then I want- You. To be present as well. Your findings in that. What do you reckon?`;
    
    const meeting = await prisma.meeting.create({
      data: {
        title: 'Test Meeting - Task Generation',
        teamMemberId: user.id,
        date: new Date(),
        duration: 30,
        status: 'completed',
        processingStatus: 'completed',
        transcript: transcript,
        executiveSummary: 'Test meeting to verify task generation functionality.',
        wins: [],
        areasForSupport: [],
        tasks: [], // No tasks initially - we'll generate them using the button
        createdBy: user.id
      }
    });
    
    console.log('Test meeting created successfully!');
    console.log('Meeting ID:', meeting.id);
    console.log('You can now test the "Generate Tasks" button in the frontend.');
    
  } catch (error) {
    console.error('Error creating test meeting:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createTestMeeting(); 