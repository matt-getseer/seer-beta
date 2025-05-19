import dotenv from 'dotenv';
import axios from 'axios';

// Load environment variables
dotenv.config();

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

if (!ANTHROPIC_API_KEY) {
  console.error('ANTHROPIC_API_KEY is not set in the environment variables');
  process.exit(1);
}

// Test function to validate API call format without making actual API request
async function testAnthropicCall(makeRealApiCall: boolean = false) {
  // Sample transcript
  const transcript = `
    John: Hi Sarah, thanks for joining this one-on-one meeting.
    Sarah: Thanks for having me, John.
    John: How's your week been going?
    Sarah: Pretty good, though I've been stuck on the database migration issue.
    John: What's the specific problem you're facing?
    Sarah: The schema changes are causing conflicts with existing data.
    John: Let's prioritize that for next sprint. I can ask Dave to help you.
    Sarah: That would be great. Also, I finished the UI redesign ahead of schedule!
    John: That's excellent news! The client will be very happy.
    Sarah: Yes, and I learned a lot about the new design system.
    John: For next steps, could you document your process for the team?
    Sarah: Will do. I'll have that ready by Friday.
  `;
  
  // System prompt
  const systemPrompt = 'You are an expert meeting analyzer. Extract the following from the meeting transcript:\n' +
    '- Executive summary (concise overview of the meeting)\n' +
    '- Wins (positive outcomes, achievements, or successes mentioned)\n' +
    '- Areas for support (challenges, issues, or areas where help is needed)\n' +
    '- Action items (specific tasks, assignments, or next steps)\n\n' +
    'This is a one-on-one meeting.\n\n' +
    'RESPONSE FORMAT: You must respond with a valid JSON object containing these fields: executiveSummary, wins (array), areasForSupport (array), actionItems (array), and keyInsights (array). Use snake_case alternatives if you prefer (executive_summary, areas_for_support, action_items, key_insights).';
  
  // Construct the API request payload
  const requestPayload = {
    model: 'claude-3-7-sonnet-latest',
    max_tokens: 4000,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: transcript
      }
    ]
  };
  
  console.log('API Request Payload:');
  console.log(JSON.stringify(requestPayload, null, 2));
  
  if (makeRealApiCall) {
    try {
      console.log('\nMaking actual API call to Anthropic...');
      const response = await axios.post(
        'https://api.anthropic.com/v1/messages',
        requestPayload,
        {
          headers: {
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
            'x-api-key': ANTHROPIC_API_KEY,
          }
        }
      );
      
      console.log('\nAPI Response:');
      console.log(JSON.stringify(response.data, null, 2));
      
      const content = response.data.content[0].text;
      console.log('\nExtracted Content:');
      console.log(content);
      
      // Try to parse JSON
      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const jsonData = JSON.parse(jsonMatch[0]);
          console.log('\nParsed JSON:');
          console.log(JSON.stringify(jsonData, null, 2));
        } else {
          console.log('\nNo JSON object found in response');
        }
      } catch (error) {
        console.error('\nError parsing JSON:', error);
      }
    } catch (error) {
      console.error('\nAPI Call Error:');
      if (axios.isAxiosError(error)) {
        console.error('Status:', error.response?.status);
        console.error('Data:', JSON.stringify(error.response?.data, null, 2));
        console.error('Headers:', JSON.stringify(error.response?.headers, null, 2));
      } else {
        console.error(error);
      }
    }
  } else {
    console.log('\nSkipping actual API call (dry run)');
    console.log('\nTo make a real API call, run with: npm run test-anthropic -- --real');
  }
}

// Check if we should make a real API call
const makeRealCall = process.argv.includes('--real');

// Run the test
testAnthropicCall(makeRealCall); 