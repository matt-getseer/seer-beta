import axios from 'axios';
import { EncryptionService } from './encryption.service';
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
    encryptedApiKey?: string | null
  ) {
    // Get API key - try to use custom API key if provided, otherwise use system key
    const ANTHROPIC_API_KEY = encryptedApiKey 
      ? EncryptionService.decrypt(encryptedApiKey)
      : process.env.ANTHROPIC_API_KEY;
    
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
      systemPrompt += '\n\nRESPONSE FORMAT: You must respond with a valid JSON object containing these fields: executiveSummary, wins (array), areasForSupport (array), actionItems (array), and keyInsights (array). Use snake_case alternatives if you prefer (executive_summary, areas_for_support, action_items, key_insights).';
      
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
        actionItems: analysisData.actionItems || analysisData.action_items || [],
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
} 