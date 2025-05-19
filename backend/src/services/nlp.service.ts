import axios from 'axios';
import { PrismaClient } from '@prisma/client';
import { MeetingBaasService } from './meetingbaas.service';

// You might want to add one of these NLP libraries:
// - natural (lightweight NLP for Node.js)
// - @tensorflow/tfjs-node (for more advanced ML/NLP)
// - Anthropic API client for using Claude models

const prisma = new PrismaClient();

// Types of meetings we support with specialized processing
export enum MeetingType {
  DEFAULT = 'default',
  ONE_ON_ONE = 'one_on_one',
  TEAM_MEETING = 'team_meeting',
  CLIENT_PRESENTATION = 'client_presentation',
  SALES_CALL = 'sales_call',
}

export interface NLPResult {
  transcript: string;
  executiveSummary: string;
  wins: string[];
  areasForSupport: string[];
  actionItems: string[];
  // Add any additional fields needed for specialized meeting types
  keyInsights?: string[];
  followUpQuestions?: string[];
  clientFeedback?: string[];
}

/**
 * Service to handle NLP processing of meeting transcripts
 */
export class NLPService {
  /**
   * Process a meeting transcript with custom NLP
   */
  static async processMeetingTranscript(
    meetingId: string,
    transcript: string,
    meetingType: MeetingType = MeetingType.DEFAULT
  ): Promise<NLPResult> {
    try {
      // Log the processing start
      console.log(`Processing meeting ${meetingId} as type: ${meetingType}`);
      
      // Update meeting processing status
      await prisma.meeting.update({
        where: { id: meetingId },
        data: { processingStatus: 'processing' }
      });
      
      // Base result structure
      const result: NLPResult = {
        transcript,
        executiveSummary: '',
        wins: [],
        areasForSupport: [],
        actionItems: [],
        keyInsights: [],
      };
      
      // Process based on meeting type
      switch (meetingType) {
        case MeetingType.ONE_ON_ONE:
          return await this.processOneOnOneMeeting(transcript, result);
        
        case MeetingType.TEAM_MEETING:
          return await this.processTeamMeeting(transcript, result);
          
        case MeetingType.CLIENT_PRESENTATION:
          return await this.processClientPresentation(transcript, result);
          
        case MeetingType.SALES_CALL:
          return await this.processSalesCall(transcript, result);
          
        case MeetingType.DEFAULT:
        default:
          return await this.processDefaultMeeting(transcript, result);
      }
    } catch (error) {
      console.error('Error processing meeting transcript:', error);
      throw new Error('Failed to process meeting transcript');
    }
  }
  
  /**
   * Process a standard meeting (default processing)
   */
  private static async processDefaultMeeting(transcript: string, baseResult: NLPResult): Promise<NLPResult> {
    try {
      // If ANTHROPIC_API_KEY is set, use Claude for processing
      if (process.env.ANTHROPIC_API_KEY) {
        const claudeResult = await this.processWithClaude(transcript);
        return {
          ...baseResult,
          ...claudeResult,
        };
      }
      
      // Fallback to basic processing if no API key is available
      console.warn('ANTHROPIC_API_KEY not set, using basic processing');
      
      // Simple summary (would be replaced by proper NLP)
      baseResult.executiveSummary = `Meeting transcript processed on ${new Date().toLocaleString()}. The transcript contains ${transcript.length} characters.`;
      
      // Extract action items (very basic - look for phrases like "ACTION:")
      const actionItemRegex = /action:?\s*(.*?)(?=\n|$)/gi;
      let match;
      while ((match = actionItemRegex.exec(transcript)) !== null) {
        if (match[1].trim()) {
          baseResult.actionItems.push(match[1].trim());
        }
      }
      
      return baseResult;
    } catch (error) {
      console.error('Error in default meeting processing:', error);
      return baseResult;
    }
  }
  
  /**
   * Process a 1:1 meeting
   */
  private static async processOneOnOneMeeting(transcript: string, baseResult: NLPResult): Promise<NLPResult> {
    try {
      // If ANTHROPIC_API_KEY is set, use Claude with specialized prompt
      if (process.env.ANTHROPIC_API_KEY) {
        const claudeResult = await this.processWithClaude(transcript, {
          meetingType: 'one-on-one',
          additionalInstructions: 'Focus on personal development goals, feedback, and career growth discussions.'
        });
        return {
          ...baseResult,
          ...claudeResult,
        };
      }
      
      // Fallback to basic processing
      const result = await this.processDefaultMeeting(transcript, baseResult);
      
      // Add specialized processing for 1:1 meetings
      // For example: identify personal goals, feedback, and career development items
      
      // Look for development-related items
      const devRegex = /(?:career|development|growth|improve|learn|goal).*?(?:\.|$)/gi;
      const devMatches = transcript.match(devRegex) || [];
      
      result.keyInsights = devMatches.map(m => m.trim()).slice(0, 5);
      
      return result;
    } catch (error) {
      console.error('Error in 1:1 meeting processing:', error);
      return baseResult;
    }
  }
  
  /**
   * Process a team meeting
   */
  private static async processTeamMeeting(transcript: string, baseResult: NLPResult): Promise<NLPResult> {
    try {
      // If ANTHROPIC_API_KEY is set, use Claude with specialized prompt
      if (process.env.ANTHROPIC_API_KEY) {
        const claudeResult = await this.processWithClaude(transcript, {
          meetingType: 'team-meeting',
          additionalInstructions: 'Focus on project updates, team blockers, decisions made, and team collaboration.'
        });
        return {
          ...baseResult,
          ...claudeResult,
        };
      }
      
      // Fallback to basic processing
      const result = await this.processDefaultMeeting(transcript, baseResult);
      
      return result;
    } catch (error) {
      console.error('Error in team meeting processing:', error);
      return baseResult;
    }
  }
  
  /**
   * Process a client presentation
   */
  private static async processClientPresentation(transcript: string, baseResult: NLPResult): Promise<NLPResult> {
    try {
      // If ANTHROPIC_API_KEY is set, use Claude with specialized prompt
      if (process.env.ANTHROPIC_API_KEY) {
        const claudeResult = await this.processWithClaude(transcript, {
          meetingType: 'client-presentation',
          additionalInstructions: 'Focus on client questions, concerns, feedback, and opportunities for follow-up.'
        });
        return {
          ...baseResult,
          ...claudeResult,
        };
      }
      
      // Fallback to basic processing
      const result = await this.processDefaultMeeting(transcript, baseResult);
      
      // Add client-specific processing
      // For example: client questions, feedback, follow-up items
      
      // Extract client feedback
      const feedbackRegex = /(?:feedback|concern|question|thought).*?(?:\.|$)/gi;
      const feedbackMatches = transcript.match(feedbackRegex) || [];
      
      result.clientFeedback = feedbackMatches.map(m => m.trim()).slice(0, 5);
      
      return result;
    } catch (error) {
      console.error('Error in client presentation processing:', error);
      return baseResult;
    }
  }
  
  /**
   * Process a sales call
   */
  private static async processSalesCall(transcript: string, baseResult: NLPResult): Promise<NLPResult> {
    try {
      // If ANTHROPIC_API_KEY is set, use Claude with specialized prompt
      if (process.env.ANTHROPIC_API_KEY) {
        const claudeResult = await this.processWithClaude(transcript, {
          meetingType: 'sales-call',
          additionalInstructions: 'Focus on objections raised, budget discussions, timeline negotiations, and next steps.'
        });
        return {
          ...baseResult,
          ...claudeResult,
        };
      }
      
      // Fallback to basic processing
      const result = await this.processDefaultMeeting(transcript, baseResult);
      
      return result;
    } catch (error) {
      console.error('Error in sales call processing:', error);
      return baseResult;
    }
  }
  
  /**
   * Process a meeting using Anthropic's Claude
   */
  private static async processWithClaude(
    transcript: string, 
    options?: {
      meetingType?: string;
      additionalInstructions?: string;
    }
  ): Promise<Partial<NLPResult>> {
    const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
    
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
          model: 'claude-3-7-sonnet-latest', // Using Claude 3.7 Sonnet as per Anthropic docs
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
      console.log('Raw response content:', responseContent);
      
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