require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { MeetingProcessorService, MeetingType } = require('./dist/services/meeting-processor.service');
const { TaskAssignmentService } = require('./dist/services/task-assignment.service');
const crypto = require('crypto');

const prisma = new PrismaClient();

// Sample transcript with clear action items that should generate reasoning
const sampleTranscript = `
Manager: Hi Sarah, thanks for joining our one-on-one today. How are you feeling about your current workload?

Sarah: Hi John! Overall I'm doing well, but I've been struggling with the database migration project. The schema changes are more complex than I initially thought.

Manager: What specific challenges are you facing with the migration?

Sarah: The main issue is that our legacy data doesn't map cleanly to the new schema. I'm worried about data integrity during the transition. I think I need some guidance from someone who's done this before.

Manager: That makes sense. Let me connect you with Dave from the platform team - he led our last major migration. Would a knowledge transfer session help?

Sarah: Absolutely! That would be really valuable. Also, I wanted to mention that I finished the new user dashboard ahead of schedule.

Manager: That's fantastic! The stakeholders are going to love that. How did you manage to deliver it early?

Sarah: I found some reusable components from our design system that sped things up. I documented the approach so other developers can use the same pattern.

Manager: Excellent thinking. Speaking of documentation, could you create a brief guide about your component reuse strategy? It could help the whole team.

Sarah: Sure, I'll put together a guide with examples. I'm also thinking it might be worth presenting this at our next team meeting.

Manager: Great idea! Let's get that scheduled. Also, I noticed you've been working late a few nights this week. How's your work-life balance?

Sarah: I've been staying late to catch up on the migration work, but you're right - I should be more mindful of my hours.

Manager: Let's make sure you're not burning out. I want you to block your calendar after 6 PM for the next two weeks. No exceptions.

Sarah: That sounds reasonable. I'll set those boundaries.

Manager: Perfect. And remember, if you're stuck on something, reach out earlier rather than working late to figure it out alone.

Sarah: Will do. Thanks for the reminder.

Manager: Before we wrap up, is there anything else on your mind? Any other support you need?

Sarah: Actually, I've been thinking about my career growth. I'd love to take on more technical leadership responsibilities eventually.

Manager: That's great to hear! Let's schedule a separate conversation about your career development path. I'll send you some resources about technical leadership tracks.

Sarah: That would be amazing. Thank you!

Manager: Alright, let me summarize our action items: I'll connect you with Dave for the migration guidance, you'll create the component reuse guide, we'll schedule your team presentation, you'll block your calendar after 6 PM, and I'll send you career development resources.

Sarah: Perfect. And I'll have the component guide ready by Friday.

Manager: Sounds like a plan. Thanks for a great discussion, Sarah!
`;

async function createTestMeeting() {
  try {
    console.log('🚀 Creating test meeting with reasoning-enabled action items...\n');

    // Use the specific manager user ID
    const manager = await prisma.user.findUnique({
      where: { id: 'c1783854-5251-4db7-98c0-f740fca45cbd' }, // Manager ID
      select: { id: true, name: true, email: true }
    });

    if (!manager) {
      console.error('❌ Manager user not found. Please check the user ID.');
      return;
    }

    // Use the specific team member user ID
    const teamMember = await prisma.user.findUnique({
      where: { id: '46863fb6-9bd5-4502-9a4b-2962c910d5f9' }, // Team member ID
      select: { id: true, name: true, email: true }
    });

    if (!teamMember) {
      console.error('❌ Team member user not found. Please check the user ID.');
      return;
    }

    console.log(`👤 Manager: ${manager.name || manager.email} (${manager.id})`);
    console.log(`👤 Team Member: ${teamMember.name || teamMember.email} (${teamMember.id})\n`);

    // Create the meeting record
    const meetingId = crypto.randomUUID();
    const now = new Date();
    
    const meeting = await prisma.meeting.create({
      data: {
        id: meetingId,
        title: 'Test 1:1 - Reasoning Demo',
        teamMemberId: teamMember.id,
        date: now,
        duration: 30,
        status: 'completed',
        meetingType: 'one_on_one',
        processingStatus: 'processing',
        transcript: sampleTranscript,
        createdBy: manager.id
      }
    });

    console.log(`📅 Created meeting: ${meeting.title} (${meeting.id})\n`);

    // Process the transcript to generate action items with reasoning
    console.log('🤖 Processing transcript with AI to generate action items with reasoning...\n');
    
    const nlpResult = await MeetingProcessorService.processMeetingTranscript(
      meeting.id,
      sampleTranscript,
      MeetingType.ONE_ON_ONE
    );

    console.log('📊 NLP Processing Results:');
    console.log(`- Executive Summary: ${nlpResult.executiveSummary.substring(0, 100)}...`);
    console.log(`- Wins: ${nlpResult.wins.length} items`);
    console.log(`- Areas for Support: ${nlpResult.areasForSupport.length} items`);
    console.log(`- Action Items: ${nlpResult.actionItems?.length || 0} items with reasoning\n`);

    // Display action items with reasoning
    if (nlpResult.actionItems && nlpResult.actionItems.length > 0) {
      console.log('✨ Generated Action Items with Reasoning:');
      nlpResult.actionItems.forEach((item, index) => {
        console.log(`\n${index + 1}. 📋 Task: ${item.text}`);
        console.log(`   💡 Why this helps: ${item.reasoning}`);
      });
      console.log('\n');
    }

    // Update the meeting with NLP results
    await prisma.meeting.update({
      where: { id: meeting.id },
      data: {
        processingStatus: 'completed',
        executiveSummary: nlpResult.executiveSummary,
        wins: nlpResult.wins,
        areasForSupport: nlpResult.areasForSupport,
        tasks: nlpResult.tasks || []
      }
    });

    // Create structured tasks with reasoning
    if (nlpResult.actionItems && nlpResult.actionItems.length > 0) {
      console.log('💾 Creating structured tasks in database...\n');

      // Get task assignments
      const taskTexts = nlpResult.actionItems.map(item => item.text);
      const assignedTasks = await TaskAssignmentService.assignTasks(
        taskTexts,
        manager.id,
        teamMember.id
      );

      // Create tasks with reasoning
      for (let i = 0; i < assignedTasks.length; i++) {
        const taskData = assignedTasks[i];
        const originalItem = nlpResult.actionItems[i];
        const taskId = crypto.randomUUID();

        await prisma.task.create({
          data: {
            id: taskId,
            text: taskData.text,
            assignedTo: taskData.assignedTo,
            meetingId: meeting.id,
            status: 'incomplete',
            reasoning: originalItem.reasoning,
            createdAt: now
          }
        });

        const assigneeName = taskData.assignedTo === manager.id ? 'Manager' : 'Team Member';
        console.log(`✅ Created task for ${assigneeName}: ${taskData.text}`);
        console.log(`   💡 Reasoning: ${originalItem.reasoning}\n`);
      }
    }

    console.log('🎉 Test meeting created successfully!\n');
    console.log('📱 You can now view this meeting in the frontend to see:');
    console.log('   - Action items with "Why This Helps" explanations');
    console.log('   - Both regular and suggested tasks showing reasoning');
    console.log('   - The improved task sidebar with reasoning display\n');
    
    console.log(`🔗 Meeting ID: ${meeting.id}`);
    console.log(`🔗 Direct URL: http://localhost:3000/meetings/${meeting.id}\n`);

  } catch (error) {
    console.error('❌ Error creating test meeting:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
createTestMeeting(); 