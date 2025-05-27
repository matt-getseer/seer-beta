import axios from 'axios';
import dotenv from 'dotenv';
import { ProcessOptions } from './meeting-type-processor.service';

// Load environment variables
dotenv.config();

/**
 * Service to handle interactions with OpenAI's GPT API
 */
export class OpenAIService {
  /**
   * Process a transcript using OpenAI's GPT
   */
  static async processTranscript(
    transcript: string, 
    options: ProcessOptions = {},
    apiKey?: string | null
  ) {
    if (!apiKey) {
      throw new Error('OpenAI API key is not provided');
    }
    
    try {
      // Create a system prompt for OpenAI
      let systemPrompt = 'You are an expert meeting analyzer. Extract the following from the meeting transcript:';
      systemPrompt += '\n- Executive summary (concise overview of the meeting)';
      systemPrompt += '\n- Wins (positive outcomes, achievements, or successes mentioned)';
      systemPrompt += '\n- Areas for support (challenges, issues, or areas where help is needed)';
      systemPrompt += '\n- Action items (specific tasks, assignments, or next steps)';
      
      // Add type-specific instructions if provided
      if (options?.meetingType) {
        systemPrompt += `\n\nThis is a ${options.meetingType} meeting.`;
      }
      
      if (options?.additionalInstructions) {
        systemPrompt += `\n${options.additionalInstructions}`;
      }
      
      // Request JSON format explicitly in the prompt
      systemPrompt += '\n\nRESPONSE FORMAT: You must respond with a valid JSON object containing these fields: executiveSummary, wins (array), areasForSupport (array), actionItems (array), and keyInsights (array). Use snake_case alternatives if you prefer (executive_summary, areas_for_support, action_items, key_insights).';
      
      // Format the meeting transcript (truncate if too long)
      const maxChars = 100000; // GPT models also have token limits
      const truncatedTranscript = transcript.length > maxChars 
        ? `${transcript.substring(0, maxChars)}... (transcript truncated due to length)`
        : transcript;
      
      // Make API call to OpenAI
      console.log('Making API call to OpenAI with model: gpt-4o');
      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-4o', // Using GPT-4o as the default model
          messages: [
            {
              role: 'system',
              content: systemPrompt
            },
            {
              role: 'user',
              content: truncatedTranscript
            }
          ],
          max_tokens: 4000,
          temperature: 0.1, // Lower temperature for more deterministic results
          response_format: { type: "json_object" } // Request JSON response
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          }
        }
      );
      
      // Parse the OpenAI response
      console.log('Received response from OpenAI API');
      const responseContent = response.data.choices[0].message.content;
      
      let analysisData;
      try {
        // Enhanced JSON parsing similar to Anthropic service
        // Method 1: Try direct parsing first
        try {
          analysisData = JSON.parse(responseContent);
          console.log('Direct JSON parsing successful');
        } catch (directParseError) {
          console.log('Direct parsing failed, trying to extract JSON block');
          
          // Method 2: Extract JSON block between first { and last }
          const firstBrace = responseContent.indexOf('{');
          const lastBrace = responseContent.lastIndexOf('}');
          
          if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
            const jsonBlock = responseContent.substring(firstBrace, lastBrace + 1);
            try {
              analysisData = JSON.parse(jsonBlock);
              console.log('JSON block extraction successful');
            } catch (blockParseError) {
              console.log('JSON block parsing failed, trying to clean response');
              
              // Method 3: Try to clean the response and parse
              let cleaned = responseContent.replace(/```json\s*/g, '').replace(/```\s*/g, '');
              
              // Find JSON object boundaries more carefully
              const jsonStart = cleaned.indexOf('{');
              const jsonEnd = cleaned.lastIndexOf('}');
              
              if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
                cleaned = cleaned.substring(jsonStart, jsonEnd + 1);
                
                // Clean up common issues
                cleaned = cleaned
                  .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // Remove control characters
                  .replace(/\n\s*/g, ' ') // Replace newlines with spaces
                  .replace(/\r/g, '') // Remove carriage returns
                  .replace(/\t/g, ' ') // Replace tabs with spaces
                  .replace(/,\s*}/g, '}') // Remove trailing commas
                  .replace(/,\s*]/g, ']'); // Remove trailing commas in arrays
                
                analysisData = JSON.parse(cleaned);
                console.log('Cleaned JSON parsing successful');
              } else {
                throw new Error('Could not find valid JSON boundaries');
              }
            }
          } else {
            throw new Error('Could not find JSON block boundaries');
          }
        }
      } catch (parseError) {
        console.error('Error parsing OpenAI response:', parseError);
        console.log('Raw response content:', responseContent);
        
        // Try to extract structured data from text response as fallback
        analysisData = {
          executiveSummary: responseContent.split('\n\n')[0] || '',
          wins: [],
          areasForSupport: [],
          actionItems: []
        };
        console.log('Created fallback analysis data from text response');
      }
      
      return {
        executiveSummary: analysisData.executiveSummary || analysisData.executive_summary || '',
        wins: analysisData.wins || [],
        areasForSupport: analysisData.areasForSupport || analysisData.areas_for_support || [],
        actionItems: analysisData.actionItems || analysisData.action_items || [],
        keyInsights: analysisData.keyInsights || analysisData.key_insights || [],
        followUpQuestions: analysisData.followUpQuestions || analysisData.follow_up_questions || [],
        clientFeedback: analysisData.clientFeedback || analysisData.client_feedback || []
      };
    } catch (error) {
      // Log detailed error information
      console.error('Error calling OpenAI API:');
      if (axios.isAxiosError(error)) {
        console.error('Status:', error.response?.status);
        console.error('Data:', JSON.stringify(error.response?.data, null, 2));
        console.error('Headers:', JSON.stringify(error.response?.headers, null, 2));
      } else {
        console.error(error instanceof Error ? error.message : error);
      }
      
      // Return placeholder data on API failure
      return {
        executiveSummary: 'Failed to generate summary using GPT.',
        wins: [],
        areasForSupport: [],
        actionItems: []
      };
    }
  }

  /**
   * Process any prompt with OpenAI GPT
   */
  static async processWithAI(
    prompt: string,
    options: {
      responseFormat?: 'text' | 'json',
      parseJSON?: boolean,
      maxTokens?: number,
      temperature?: number,
      model?: string
    } = {},
    apiKey?: string | null
  ) {
    if (!apiKey) {
      throw new Error('OpenAI API key is not provided');
    }
    
    try {
      // Create the system prompt
      let systemPrompt = 'You are a helpful AI assistant.';
      
      // Add format instructions if JSON is requested
      if (options.responseFormat === 'json') {
        systemPrompt += ' You must respond with a valid JSON object only. Do not include any explanation or text before or after the JSON.';
      }
      
      // Set model and max tokens
      const model = options.model || 'gpt-4o';
      const maxTokens = options.maxTokens || 4000;
      const temperature = options.temperature ?? 0.1;
      
      // Make API call to OpenAI
      console.log(`Making API call to OpenAI with model: ${model}`);
      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: model,
          max_tokens: maxTokens,
          temperature: temperature,
          messages: [
            {
              role: 'system',
              content: systemPrompt
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          ...(options.responseFormat === 'json' ? { response_format: { type: "json_object" } } : {})
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          }
        }
      );
      
      // Parse the OpenAI response
      console.log('Received response from OpenAI API');
      const responseContent = response.data.choices[0].message.content;
      
      // If we need to parse JSON and responseFormat is json
      if (options.parseJSON && options.responseFormat === 'json') {
        console.log('Raw response content:', responseContent);
        
        try {
          // Method 1: Try direct parsing first
          try {
            const parsed = JSON.parse(responseContent);
            console.log('Direct JSON parsing successful');
            return parsed;
          } catch (directParseError) {
            console.log('Direct parsing failed, trying to extract JSON block');
          }
          
          // Method 2: Extract JSON block between first { and last }
          const firstBrace = responseContent.indexOf('{');
          const lastBrace = responseContent.lastIndexOf('}');
          
          if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
            const jsonBlock = responseContent.substring(firstBrace, lastBrace + 1);
            try {
              const parsed = JSON.parse(jsonBlock);
              console.log('JSON block extraction successful');
              return parsed;
            } catch (blockParseError) {
              console.log('JSON block parsing failed');
            }
          }
          
          // Method 3: Try to clean the response and parse
          try {
            // Remove markdown code blocks if present
            let cleaned = responseContent.replace(/```json\s*/g, '').replace(/```\s*/g, '');
            
            // Find JSON object boundaries more carefully
            const jsonStart = cleaned.indexOf('{');
            const jsonEnd = cleaned.lastIndexOf('}');
            
            if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
              cleaned = cleaned.substring(jsonStart, jsonEnd + 1);
              
              // Clean up common issues
              cleaned = cleaned
                .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // Remove control characters
                .replace(/\n\s*/g, ' ') // Replace newlines with spaces
                .replace(/\r/g, '') // Remove carriage returns
                .replace(/\t/g, ' ') // Replace tabs with spaces
                .replace(/,\s*}/g, '}') // Remove trailing commas
                .replace(/,\s*]/g, ']'); // Remove trailing commas in arrays
              
              const parsed = JSON.parse(cleaned);
              console.log('Cleaned JSON parsing successful');
              return parsed;
            }
          } catch (cleanParseError) {
            console.log('Cleaned JSON parsing failed');
          }
          
          // If all parsing fails, log and throw
          console.error('All JSON parsing methods failed');
          throw new Error('Failed to parse JSON response from GPT');
          
        } catch (parseError) {
          console.error('Error parsing GPT JSON response:', parseError);
          throw parseError;
        }
      }
      
      // Return the raw text response
      return responseContent;
    } catch (error) {
      console.error('Error calling OpenAI API:', error);
      throw error;
    }
  }

  /**
   * Generate agenda using OpenAI GPT
   */
  static async generateAgenda(
    teamMemberName: string,
    previousData: {
      wins: string[],
      areasForSupport: string[],
      actionItems: string[]
    },
    apiKey?: string | null
  ) {
    // Create prompt for OpenAI
    const prompt = `
You are an expert meeting facilitator. I need you to create a personalized 1:1 meeting agenda for ${teamMemberName} based on their previous meeting data.

Previous meeting data:
- Wins: ${JSON.stringify(previousData.wins)}
- Areas for Support: ${JSON.stringify(previousData.areasForSupport)}
- Action Items: ${JSON.stringify(previousData.actionItems)}

Create a structured 1:1 meeting agenda with 3 phases:

1. **Phase 1: Connect & Set the Stage** (5-10 minutes)
   - Personal connection and rapport building
   - Let them share what's top of mind
   - Celebrate recent wins

2. **Phase 2: Focus & Action** (15-20 minutes)
   - Dive into priorities and progress
   - Address challenges and support needs
   - Discuss development and growth

3. **Phase 3: Clarity & Closure** (5-10 minutes)
   - Clarify action items and next steps
   - Gather feedback
   - Forward-looking statements

For each phase, create 3-4 specific talking points or questions that reference the previous meeting's data.

IMPORTANT: Respond ONLY with a valid JSON object. Do not include any explanatory text, markdown formatting, or code blocks. Just the raw JSON.

The JSON structure must be exactly:
{
  "phases": [
    {
      "name": "Phase 1: Connect & Set the Stage",
      "items": [
        "Personal check-in question...",
        "Specific talking point about their agenda...",
        "Specific win to celebrate from previous data..."
      ]
    },
    {
      "name": "Phase 2: Focus & Action",
      "items": [
        "Specific priority to discuss...",
        "Specific challenge to address from previous data...",
        "Specific development area to explore..."
      ]
    },
    {
      "name": "Phase 3: Clarity & Closure",
      "items": [
        "Specific action item to discuss...",
        "Specific feedback question...",
        "Forward-looking question or statement..."
      ]
    }
  ]
}
`;

    try {
      // Call OpenAI API with the agenda prompt
      return await this.processWithAI(prompt, {
        responseFormat: 'json',
        parseJSON: true
      }, apiKey);
    } catch (error) {
      console.error('Error generating agenda with AI:', error);
      
      // Return a default agenda structure if AI fails
      return {
        phases: [
          {
            name: "Phase 1: Connect & Set the Stage",
            items: [
              "Personal Check-in & Open",
              "Team Member's Top of Mind (Their Agenda First)",
              "Quick Wins & Shout-outs"
            ]
          },
          {
            name: "Phase 2: Focus & Action",
            items: [
              "Key Priorities & Progress Review",
              "Challenges, Support & Roadblocks",
              "Development & Growth"
            ]
          },
          {
            name: "Phase 3: Clarity & Closure",
            items: [
              "Action Items & Next Steps",
              "Feedback Loop",
              "Forward Look & Closing"
            ]
          }
        ],
        error: "Failed to generate personalized agenda. Using default structure instead."
      };
    }
  }
} 