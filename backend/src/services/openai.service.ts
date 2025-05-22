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
        analysisData = JSON.parse(responseContent);
        console.log('Successfully parsed JSON from response');
      } catch (parseError) {
        console.error('Error parsing OpenAI response:', parseError);
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
} 