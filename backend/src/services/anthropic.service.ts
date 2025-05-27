import axios from 'axios';
import dotenv from 'dotenv';
import { ProcessOptions } from './meeting-type-processor.service';

// Load environment variables
dotenv.config();

/**
 * Service to handle interactions with Anthropic's Claude API
 */
export class AnthropicService {
  /**
   * Process a transcript using Anthropic's Claude
   */
  static async processTranscript(
    transcript: string, 
    options: ProcessOptions = {},
    apiKey?: string | null
  ) {
    // Get API key - try to use custom API key if provided, otherwise use system key
    const ANTHROPIC_API_KEY = apiKey || process.env.ANTHROPIC_API_KEY;
    
    if (!ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY is not configured');
    }
    
    try {
      // Create the system prompt based on meeting type
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
      systemPrompt += '\n\nRESPONSE FORMAT: You must respond with a valid JSON object containing these fields:';
      systemPrompt += '\n- executiveSummary: string';
      systemPrompt += '\n- wins: array of strings';
      systemPrompt += '\n- areasForSupport: array of strings';
      systemPrompt += '\n- actionItems: array of objects with "text" and "reasoning" fields';
      systemPrompt += '\n- keyInsights: array of strings';
      systemPrompt += '\n\nFor actionItems, each item should be an object like:';
      systemPrompt += '\n{"text": "Schedule follow-up meeting with client", "reasoning": "Ensures continued engagement and addresses any remaining concerns from the presentation"}';
      systemPrompt += '\n\nThe reasoning should explain WHY this action item is important and how it helps achieve the meeting\'s goals or addresses identified needs.';
      systemPrompt += '\n\nUse snake_case alternatives if you prefer (executive_summary, areas_for_support, action_items, key_insights).';
      
      // Format the meeting transcript (truncate if too long)
      const maxChars = 100000; // Claude models have token limits
      const truncatedTranscript = transcript.length > maxChars 
        ? `${transcript.substring(0, maxChars)}... (transcript truncated due to length)`
        : transcript;
      
      // Make API call to Anthropic
      console.log('Making API call to Anthropic with model: claude-3-7-sonnet-latest');
      const response = await axios.post(
        'https://api.anthropic.com/v1/messages',
        {
          model: 'claude-3-7-sonnet-latest', // Using Claude 3.7 Sonnet
          max_tokens: 4000,
          system: systemPrompt, // System prompt as top-level parameter
          messages: [
            {
              role: 'user',
              content: truncatedTranscript
            }
          ],
        },
        {
          headers: {
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
            'x-api-key': ANTHROPIC_API_KEY,
          }
        }
      );
      
      // Parse the Claude response
      console.log('Received response from Anthropic API');
      const responseContent = response.data.content[0].text;
      
      let analysisData;
      try {
        // Check if the response contains JSON
        const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          // Extract JSON object from the response if there's other text around it
          analysisData = JSON.parse(jsonMatch[0]);
          console.log('Successfully parsed JSON from response');
        } else {
          // Fall back to treating the entire response as JSON
          analysisData = JSON.parse(responseContent);
          console.log('Parsed entire response as JSON');
        }
      } catch (parseError) {
        console.error('Error parsing Claude response:', parseError);
        console.log('Raw response content:', responseContent);
        
        // Try to extract structured data from text response
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
        actionItems: this.parseActionItems(analysisData.actionItems || analysisData.action_items || []),
        keyInsights: analysisData.keyInsights || analysisData.key_insights || [],
        followUpQuestions: analysisData.followUpQuestions || analysisData.follow_up_questions || [],
        clientFeedback: analysisData.clientFeedback || analysisData.client_feedback || []
      };
    } catch (error) {
      // Log detailed error information
      console.error('Error calling Anthropic API:');
      if (axios.isAxiosError(error)) {
        console.error('Status:', error.response?.status);
        console.error('Data:', JSON.stringify(error.response?.data, null, 2));
        console.error('Headers:', JSON.stringify(error.response?.headers, null, 2));
      } else {
        console.error(error instanceof Error ? error.message : error);
      }
      
      // Return placeholder data on API failure
      return {
        executiveSummary: 'Failed to generate summary using Claude.',
        wins: [],
        areasForSupport: [],
        actionItems: []
      };
    }
  }

  /**
   * Process any prompt with Anthropic AI
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
    // Get API key - try to use custom API key if provided, otherwise use system key
    const ANTHROPIC_API_KEY = apiKey || process.env.ANTHROPIC_API_KEY;
    
    if (!ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY is not configured');
    }
    
    try {
      // Create the system prompt
      let systemPrompt = 'You are a helpful AI assistant.';
      
      // Add format instructions if JSON is requested
      if (options.responseFormat === 'json') {
        systemPrompt += ' You must respond with a valid JSON object only. Do not include any explanation or text before or after the JSON.';
      }
      
      // Set model and max tokens
      const model = options.model || 'claude-3-7-sonnet-latest';
      const maxTokens = options.maxTokens || 4000;
      const temperature = options.temperature ?? 0.1;
      
      // Make API call to Anthropic
      console.log(`Making API call to Anthropic with model: ${model}`);
      const response = await axios.post(
        'https://api.anthropic.com/v1/messages',
        {
          model: model,
          max_tokens: maxTokens,
          temperature: temperature,
          system: systemPrompt,
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ],
        },
        {
          headers: {
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
            'x-api-key': ANTHROPIC_API_KEY,
          }
        }
      );
      
      // Parse the Claude response
      console.log('Received response from Anthropic API');
      const responseContent = response.data.content[0].text;
      
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
          throw new Error('Failed to parse JSON response from Claude');
          
        } catch (parseError) {
          console.error('Error parsing Claude JSON response:', parseError);
          throw parseError;
        }
      }
      
      // Return the raw text response
      return responseContent;
    } catch (error) {
      console.error('Error calling Anthropic API:', error);
      throw error;
    }
  }

  /**
   * Generate a meeting agenda based on previous meeting data
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
    // Create prompt for Anthropic
    const prompt = `
I need to create a 1:1 meeting agenda based on previous meeting data.

The 1:1 meeting should follow this structure:

Phase 1: Connect & Set the Stage
- Personal Check-in & Open: Start with a genuine, quick personal check-in to build rapport.
- Team Member's Top of Mind (Their Agenda First): Ask them directly what's most important for them to discuss.
- Quick Wins & Shout-outs: Acknowledge and celebrate their recent successes and achievements.

Phase 2: Focus & Action
- Key Priorities & Progress Review: Discuss the status of their most critical projects and goals.
- Challenges, Support & Roadblocks: Identify any obstacles they're facing and explore how you can provide support.
- Development & Growth: Discuss their professional development aspirations and how to foster their growth.

Phase 3: Clarity & Closure
- Action Items & Next Steps: Clearly define who is responsible for what, and by when.
- Feedback Loop: Offer an opportunity for them to provide you with feedback.
- Forward Look & Closing: Briefly look ahead to the next 1:1 and reiterate your commitment to their success.

Here is data from the most recent meeting with ${teamMemberName}:

Wins from last meeting:
${previousData.wins.map(win => `- ${win}`).join('\n')}

Areas for Support from last meeting:
${previousData.areasForSupport.map(area => `- ${area}`).join('\n')}

Action Items from last meeting:
${previousData.actionItems.map(item => `- ${item}`).join('\n')}

Based on this data, please generate a personalized agenda for the upcoming 1:1 meeting with ${teamMemberName}. For each phase, create 3-4 specific talking points or questions that reference the previous meeting's data.

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
      // Call Anthropic API with the agenda prompt
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

  /**
   * Generate task suggestions based on areas for support
   */
  static async generateTaskSuggestions(
    prompt: string,
    apiKey?: string | null
  ) {
    // Get API key - try to use custom API key if provided, otherwise use system key
    const ANTHROPIC_API_KEY = apiKey || process.env.ANTHROPIC_API_KEY;
    
    if (!ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY is not configured');
    }
    
    try {
      console.log('Making API call to Anthropic for task suggestions');
      const response = await axios.post(
        'https://api.anthropic.com/v1/messages',
        {
          model: 'claude-3-7-sonnet-latest',
          max_tokens: 2000,
          system: 'You are an expert management coach. Respond only with valid JSON.',
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ],
        },
        {
          headers: {
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
            'x-api-key': ANTHROPIC_API_KEY,
          }
        }
      );
      
      console.log('Received response from Anthropic API for task suggestions');
      const responseContent = response.data.content[0].text;
      
      // Try to parse JSON from response
      try {
        const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        } else {
          return JSON.parse(responseContent);
        }
      } catch (parseError) {
        console.error('Error parsing Anthropic task suggestions response:', parseError);
        console.log('Raw response content:', responseContent);
        
        // Return fallback structure
        return {
          suggestedTasks: []
        };
      }
    } catch (error) {
      console.error('Error calling Anthropic API for task suggestions:');
      if (axios.isAxiosError(error)) {
        console.error('Status:', error.response?.status);
        console.error('Data:', JSON.stringify(error.response?.data, null, 2));
      } else {
        console.error(error instanceof Error ? error.message : error);
      }
      
      // Return empty suggestions on API failure
      return {
        suggestedTasks: []
      };
    }
  }

  /**
   * Parse action items to handle both string and object formats
   */
  private static parseActionItems(actionItems: any[]): any[] {
    return actionItems.map((item: any) => {
      if (typeof item === 'string') {
        // Legacy format - convert string to object with empty reasoning
        return { text: item, reasoning: '' };
      } else if (typeof item === 'object' && item !== null) {
        // New format - ensure both text and reasoning fields exist
        return {
          text: item.text || '',
          reasoning: item.reasoning || ''
        };
      } else {
        // Fallback for invalid formats
        return { text: String(item), reasoning: '' };
      }
    });
  }
} 