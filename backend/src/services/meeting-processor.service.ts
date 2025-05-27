import { prisma } from '../utils/prisma';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Using singleton Prisma client from utils/prisma

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
  tasks: string[];
  // Add any additional fields needed for specialized meeting types
  keyInsights?: string[];
  followUpQuestions?: string[];
  clientFeedback?: string[];
}

/**
 * Service to handle NLP processing of meeting transcripts
 */
export class MeetingProcessorService {
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
          geminiApiKey: true,
          hasAnthropicKey: true,
          hasOpenAIKey: true,
          hasGeminiKey: true
        }
      });
      
      // Custom API key to use (if any)
      let customApiKey: string | null = null;
      let customAiProvider: string | null = null;
      
      if (user?.useCustomAI) {
        if (user.aiProvider === 'anthropic' && user.hasAnthropicKey && user.anthropicApiKey) {
          try {
            customApiKey = user.anthropicApiKey;
            customAiProvider = 'anthropic';
            console.log('Using custom Anthropic API key');
          } catch (error) {
            console.error('Error with Anthropic API key:', error);
          }
        } else if (user.aiProvider === 'openai' && user.hasOpenAIKey && user.openaiApiKey) {
          try {
            customApiKey = user.openaiApiKey;
            customAiProvider = 'openai';
            console.log('Using custom OpenAI API key');
          } catch (error) {
            console.error('Error with OpenAI API key:', error);
          }
        } else if (user.aiProvider === 'gemini' && user.hasGeminiKey && user.geminiApiKey) {
          try {
            customApiKey = user.geminiApiKey;
            customAiProvider = 'gemini';
            console.log('Using custom Gemini API key');
          } catch (error) {
            console.error('Error with Gemini API key:', error);
          }
        }
      }
      
      // Base result structure
      const result: NLPResult = {
        transcript,
        executiveSummary: '',
        wins: [],
        areasForSupport: [],
        tasks: [],
        keyInsights: [],
      };
      
      // Import MeetingTypeProcessorService dynamically to avoid circular dependency
      const { MeetingTypeProcessorService } = await import('./meeting-type-processor.service');
      
      // Process using meeting type processor
      return await MeetingTypeProcessorService.processByType(
        meetingType,
        transcript,
        result,
        customApiKey,
        customAiProvider
      );
    } catch (error) {
      console.error('Error processing meeting transcript:', error);
      throw new Error('Failed to process meeting transcript');
    }
  }
} 