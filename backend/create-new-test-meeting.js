const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function createNewTestMeeting() {
  try {
    // Get the users
    const users = await prisma.user.findMany();
    const manager = users.find(u => u.role === 'admin'); // Matt Stevenson
    const teamMember = users.find(u => u.role === 'user'); // The other user
    
    if (!manager || !teamMember) {
      console.log('Need both a manager (admin) and team member (user) to create the meeting');
      console.log('Available users:', users.map(u => `${u.name || u.email} (${u.role})`));
      return;
    }
    
    console.log(`Manager: ${manager.name} (${manager.id})`);
    console.log(`Team Member: ${teamMember.email} (${teamMember.id})`);
    
    // Delete any existing test meeting first
    await prisma.meeting.deleteMany({
      where: { title: 'Test Meeting - Task Generation' }
    });
    
    const transcript = `Matt Stevenson: So I've noticed your designs are consistently polished and the technical execution is strong. I think that to take the work to the next level, it would be good to see you further deepen your user empathy through more direct qualitative research. You're great at synthesizing data, but I think getting even closer to our users' real-world experiences would be valuable. So I'd like you to personally lead at least three user interviews or usability test sessions for your next project. And then come prepared to show me those key learnings and how those insights directly influence what we're doing.

I also think your ability to deliver high quality designs is great, but we all need to be better at driving cross-functional alignment earlier in the process. We're getting valuable input from engineering and product, but sometimes it's a bit too late, which can lead to rework. For your next project, I want you to proactively schedule and facilitate at least one early-stage workshop or brainstorming session. The goal is to gather perspectives and identify potential issues early.

And I want you to schedule a call with me after you've done those tasks. What I'm going to do - and this is on me - is set up a meeting with some of the product leaders. But I want you to be present as well to share your findings. What do you think?

Team Member: That sounds great! I'm excited about leading the user interviews - I think that will really help me understand our users better. The early workshop idea makes a lot of sense too. When would you like me to schedule that follow-up call with you?

Matt Stevenson: Let's plan for that call after you've completed the interviews and the workshop. That way you'll have concrete insights to share when we meet with the product team.`;
    
    const meeting = await prisma.meeting.create({
      data: {
        title: 'Test Meeting - Task Generation',
        teamMemberId: teamMember.id,  // Team member (different from manager)
        date: new Date(),
        duration: 30,
        status: 'completed',
        processingStatus: 'completed',
        transcript: transcript,
        executiveSummary: 'Test meeting to verify task generation and assignment functionality.',
        wins: [],
        areasForSupport: [],
        tasks: [], // No tasks initially - we'll generate them using the button
        createdBy: manager.id  // Manager creates the meeting
      }
    });
    
    console.log('✅ New test meeting created successfully!');
    console.log('Meeting ID:', meeting.id);
    console.log(`Created by: ${manager.name} (manager)`);
    console.log(`Team member: ${teamMember.email} (team member)`);
    console.log('');
    console.log('Expected task assignments:');
    console.log('📋 TEAM MEMBER tasks (should have "I want you to" language):');
    console.log('  - Lead at least three user interviews or usability test sessions');
    console.log('  - Prepare to show key learnings and how insights influence decisions');
    console.log('  - Schedule and facilitate early-stage workshop or brainstorming session');
    console.log('  - Schedule a follow-up call with manager');
    console.log('  - Present findings in product leaders meeting');
    console.log('');
    console.log('📋 MANAGER tasks (should have "I will" or "this is on me" language):');
    console.log('  - Set up meeting with product leaders');
    console.log('');
    console.log('🎯 You can now test the "Generate Tasks" button in the frontend!');
    
  } catch (error) {
    console.error('Error creating test meeting:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createNewTestMeeting(); 