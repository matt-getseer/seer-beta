const { AnthropicService } = require('./dist/services/anthropic.service');

// Test function to validate the new reasoning format
async function testReasoningGeneration() {
  console.log('Testing AI service reasoning generation...');
  
  // Sample transcript
  const transcript = `
    Manager: Hi Sarah, thanks for joining this one-on-one meeting.
    Sarah: Thanks for having me, John.
    Manager: How's your week been going?
    Sarah: Pretty good, though I've been stuck on the database migration issue.
    Manager: What's the specific problem you're facing?
    Sarah: The schema changes are causing conflicts with existing data.
    Manager: Let's prioritize that for next sprint. I can ask Dave to help you.
    Sarah: That would be great. Also, I finished the UI redesign ahead of schedule!
    Manager: That's excellent news! The client will be very happy.
    Sarah: Yes, and I learned a lot about the new design system.
    Manager: For next steps, could you document your process for the team?
    Sarah: Will do. I'll have that ready by Friday.
  `;
  
  try {
    // Test the processTranscript method
    const result = await AnthropicService.processTranscript(transcript, {
      meetingType: 'one-on-one',
      additionalInstructions: 'Focus on personal development goals, feedback, and career growth discussions.'
    });
    
    console.log('Result:', JSON.stringify(result, null, 2));
    
    // Check if actionItems have reasoning
    if (result.actionItems && result.actionItems.length > 0) {
      console.log('\n✅ Action items with reasoning generated successfully!');
      result.actionItems.forEach((item, index) => {
        console.log(`\nAction Item ${index + 1}:`);
        console.log(`Text: ${item.text}`);
        console.log(`Reasoning: ${item.reasoning}`);
      });
    } else {
      console.log('\n❌ No action items with reasoning found');
    }
    
  } catch (error) {
    console.error('Error testing reasoning generation:', error);
  }
}

// Only run if ANTHROPIC_API_KEY is available
if (process.env.ANTHROPIC_API_KEY) {
  testReasoningGeneration();
} else {
  console.log('ANTHROPIC_API_KEY not found, skipping test');
} 