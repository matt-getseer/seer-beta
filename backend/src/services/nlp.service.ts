import axios from 'axios';
import { PrismaClient } from '@prisma/client';
import { MeetingBaasService } from './meetingbaas.service';
import crypto from 'crypto';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// You might want to add one of these NLP libraries:
// - natural (lightweight NLP for Node.js)
// - @tensorflow/tfjs-node (for more advanced ML/NLP)
// - Anthropic API client for using Claude models

const prisma = new PrismaClient();

// Encryption configuration
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'your-secure-encryption-key-at-least-32-chars';
const IV_LENGTH = 16; // For AES, this is always 16

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

// Helper function to decrypt API key
function decrypt(text: string): string {
  // Ensure we have a 32-byte key by hashing the original key
  const key = crypto.createHash('sha256').update(String(ENCRYPTION_KEY)).digest();
  
  const textParts = text.split(':');
  const iv = Buffer.from(textParts[0], 'hex');
  const encryptedText = Buffer.from(textParts[1], 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString();
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
      
      // Update meeting status to processing
      await prisma.meeting.update({
        where: { id: meetingId },
        data: { processingStatus: 'processing' }
      });
      
      // Get the meeting to find who created it (for custom API key check)
      const meeting = await prisma.meeting.findUnique({
        where: { id: meetingId },
        select: { 
          createdBy: true 
        }
      });
      
      if (!meeting) {
        throw new Error(`Meeting ${meetingId} not found`);
      }
      
      // Check if the user has custom AI settings
      const user = await prisma.user.findUnique({
        where: { id: meeting.createdBy },
        select: { 
          useCustomAI: true,
          aiProvider: true,
          anthropicApiKey: true,
          openaiApiKey: true,
          hasAnthropicKey: true,
          hasOpenAIKey: true
        }
      });
      
      // Custom API key to use (if any)
      let customApiKey: string | null = null;
      let customAiProvider: string | null = null;
      
      if (user?.useCustomAI) {
        if (user.aiProvider === 'anthropic' && user.hasAnthropicKey && user.anthropicApiKey) {
          try {
            customApiKey = decrypt(user.anthropicApiKey);
            customAiProvider = 'anthropic';
            console.log('Using custom Anthropic API key');
          } catch (error) {
            console.error('Error decrypting Anthropic API key:', error);
          }
        } else if (user.aiProvider === 'openai' && user.hasOpenAIKey && user.openaiApiKey) {
          try {
            customApiKey = decrypt(user.openaiApiKey);
            customAiProvider = 'openai';
            console.log('Using custom OpenAI API key');
          } catch (error) {
            console.error('Error decrypting OpenAI API key:', error);
          }
        }
      }
      
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
          return await this.processOneOnOneMeeting(transcript, result, customApiKey, customAiProvider);
        
        case MeetingType.TEAM_MEETING:
          return await this.processTeamMeeting(transcript, result, customApiKey, customAiProvider);
          
        case MeetingType.CLIENT_PRESENTATION:
          return await this.processClientPresentation(transcript, result, customApiKey, customAiProvider);
          
        case MeetingType.SALES_CALL:
          return await this.processSalesCall(transcript, result, customApiKey, customAiProvider);
          
        case MeetingType.DEFAULT:
        default:
          return await this.processDefaultMeeting(transcript, result, customApiKey, customAiProvider);
      }
    } catch (error) {
      console.error('Error processing meeting transcript:', error);
      throw new Error('Failed to process meeting transcript');
    }
  }
  
  /**
   * Process a standard meeting (default processing)
   */
  private static async processDefaultMeeting(
    transcript: string, 
    baseResult: NLPResult,
    customApiKey?: string | null,
    customAiProvider?: string | null
  ): Promise<NLPResult> {
    try {
      // Determine if we can use Claude API (either system key or custom key)
      const canUseAnthropicAPI = process.env.ANTHROPIC_API_KEY || (customAiProvider === 'anthropic' && customApiKey);
      
      if (canUseAnthropicAPI) {
        const claudeResult = await this.processWithClaude(transcript, {}, customApiKey, customAiProvider);
        return {
          ...baseResult,
          ...claudeResult,
        };
      }
      
      // Fallback to basic processing if no API key is available
      console.warn('No AI API key available, using basic processing');
      
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
  private static async processOneOnOneMeeting(
    transcript: string, 
    baseResult: NLPResult,
    customApiKey?: string | null,
    customAiProvider?: string | null
  ): Promise<NLPResult> {
    try {
      // Determine if we can use Claude API (either system key or custom key)
      const canUseAnthropicAPI = process.env.ANTHROPIC_API_KEY || (customAiProvider === 'anthropic' && customApiKey);
      
      if (canUseAnthropicAPI) {
        const claudeResult = await this.processWithClaude(transcript, {
          meetingType: 'one-on-one',
          additionalInstructions: 'Focus on personal development goals, feedback, and career growth discussions.'
        }, customApiKey, customAiProvider);
        return {
          ...baseResult,
          ...claudeResult,
        };
      }
      
      // Fallback to basic processing
      const result = await this.processDefaultMeeting(transcript, baseResult, customApiKey, customAiProvider);
      
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
  private static async processTeamMeeting(
    transcript: string, 
    baseResult: NLPResult,
    customApiKey?: string | null,
    customAiProvider?: string | null
  ): Promise<NLPResult> {
    try {
      // Determine if we can use Claude API (either system key or custom key)
      const canUseAnthropicAPI = process.env.ANTHROPIC_API_KEY || (customAiProvider === 'anthropic' && customApiKey);
      
      if (canUseAnthropicAPI) {
        const claudeResult = await this.processWithClaude(transcript, {
          meetingType: 'team-meeting',
          additionalInstructions: 'Focus on project updates, team blockers, decisions made, and team collaboration.'
        }, customApiKey, customAiProvider);
        return {
          ...baseResult,
          ...claudeResult,
        };
      }
      
      // Fallback to basic processing
      const result = await this.processDefaultMeeting(transcript, baseResult, customApiKey, customAiProvider);
      
      return result;
    } catch (error) {
      console.error('Error in team meeting processing:', error);
      return baseResult;
    }
  }
  
  /**
   * Process a client presentation
   */
  private static async processClientPresentation(
    transcript: string, 
    baseResult: NLPResult,
    customApiKey?: string | null,
    customAiProvider?: string | null
  ): Promise<NLPResult> {
    try {
      // Determine if we can use Claude API (either system key or custom key)
      const canUseAnthropicAPI = process.env.ANTHROPIC_API_KEY || (customAiProvider === 'anthropic' && customApiKey);
      
      if (canUseAnthropicAPI) {
        const claudeResult = await this.processWithClaude(transcript, {
          meetingType: 'client-presentation',
          additionalInstructions: 'Focus on client questions, concerns, feedback, and opportunities for follow-up.'
        }, customApiKey, customAiProvider);
        return {
          ...baseResult,
          ...claudeResult,
        };
      }
      
      // Fallback to basic processing
      const result = await this.processDefaultMeeting(transcript, baseResult, customApiKey, customAiProvider);
      
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
  private static async processSalesCall(
    transcript: string, 
    baseResult: NLPResult,
    customApiKey?: string | null,
    customAiProvider?: string | null
  ): Promise<NLPResult> {
    try {
      // Determine if we can use Claude API (either system key or custom key)
      const canUseAnthropicAPI = process.env.ANTHROPIC_API_KEY || (customAiProvider === 'anthropic' && customApiKey);
      
      if (canUseAnthropicAPI) {
        const claudeResult = await this.processWithClaude(transcript, {
          meetingType: 'sales-call',
          additionalInstructions: 'Focus on objections raised, budget discussions, timeline negotiations, and next steps.'
        }, customApiKey, customAiProvider);
        return {
          ...baseResult,
          ...claudeResult,
        };
      }
      
      // Fallback to basic processing
      const result = await this.processDefaultMeeting(transcript, baseResult, customApiKey, customAiProvider);
      
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
    },
    customApiKey?: string | null,
    customAiProvider?: string | null
  ): Promise<Partial<NLPResult>> {
    // Try to use custom API key if provided, otherwise use system key
    const ANTHROPIC_API_KEY = customAiProvider === 'anthropic' && customApiKey 
      ? customApiKey 
      : process.env.ANTHROPIC_API_KEY;
    
    // If OpenAI is selected and we have a key, use that instead
    if (customAiProvider === 'openai' && customApiKey) {
      return this.processWithOpenAI(transcript, options, customApiKey);
    }
    
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
  
  /**
   * Process a meeting using OpenAI's GPT
   */
  private static async processWithOpenAI(
    transcript: string, 
    options?: {
      meetingType?: string;
      additionalInstructions?: string;
    },
    apiKey?: string
  ): Promise<Partial<NLPResult>> {
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
      console.log('Raw response content:', responseContent);
      
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