import { NLPResult, MeetingType } from './meeting-processor.service';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Interface for processing options
export interface ProcessOptions {
  meetingType?: string;
  additionalInstructions?: string;
}

/**
 * Service to process different types of meetings
 */
export class MeetingTypeProcessorService {
  /**
   * Process a meeting transcript based on its type
   */
  static async processByType(
    meetingType: MeetingType,
    transcript: string, 
    baseResult: NLPResult,
    customApiKey?: string | null,
    customAiProvider?: string | null
  ): Promise<NLPResult> {
    // Process based on meeting type
    switch (meetingType) {
      case MeetingType.ONE_ON_ONE:
        return await this.processOneOnOneMeeting(transcript, baseResult, customApiKey, customAiProvider);
      
      case MeetingType.TEAM_MEETING:
        return await this.processTeamMeeting(transcript, baseResult, customApiKey, customAiProvider);
        
      case MeetingType.CLIENT_PRESENTATION:
        return await this.processClientPresentation(transcript, baseResult, customApiKey, customAiProvider);
        
      case MeetingType.SALES_CALL:
        return await this.processSalesCall(transcript, baseResult, customApiKey, customAiProvider);
        
      case MeetingType.DEFAULT:
      default:
        return await this.processDefaultMeeting(transcript, baseResult, customApiKey, customAiProvider);
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
      // Determine if we can use Anthropic API (either system key or custom key)
      const canUseAnthropicAPI = process.env.ANTHROPIC_API_KEY || (customAiProvider === 'anthropic' && customApiKey);
      
      if (canUseAnthropicAPI) {
        // Import dynamically to avoid circular dependencies
        const { AnthropicService } = await import('./anthropic.service');
        const claudeResult = await AnthropicService.processTranscript(transcript, {}, customApiKey);
        return {
          ...baseResult,
          ...claudeResult,
          tasks: (claudeResult as any).actionItems || [],
        };
      }
      
      // Check if we can use OpenAI
      if (customAiProvider === 'openai' && customApiKey) {
        // Import dynamically to avoid circular dependencies
        const { OpenAIService } = await import('./openai.service');
        const openaiResult = await OpenAIService.processTranscript(transcript, {}, customApiKey);
        return {
          ...baseResult,
          ...openaiResult,
          tasks: (openaiResult as any).actionItems || [],
        };
      }
      
      // Check if we can use Gemini
      if (customAiProvider === 'gemini' && customApiKey) {
        // Import dynamically to avoid circular dependencies
        const { GeminiService } = await import('./gemini.service');
        const geminiResult = await GeminiService.processTranscript(transcript, {}, customApiKey);
        return {
          ...baseResult,
          ...geminiResult,
          tasks: (geminiResult as any).actionItems || [],
        };
      }
      
      // Fallback to basic processing if no API key is available
      console.warn('No AI API key available, using basic processing');
      
      // Simple summary (would be replaced by proper NLP)
      baseResult.executiveSummary = `Meeting transcript processed on ${new Date().toLocaleString()}. The transcript contains ${transcript.length} characters.`;
      
      // Extract tasks (very basic - look for phrases like "ACTION:")
      const taskRegex = /action:?\s*(.*?)(?=\n|$)/gi;
      let match;
      while ((match = taskRegex.exec(transcript)) !== null) {
        if (match[1].trim()) {
          baseResult.tasks.push(match[1].trim());
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
      // Determine if we can use Anthropic API
      const canUseAnthropicAPI = process.env.ANTHROPIC_API_KEY || (customAiProvider === 'anthropic' && customApiKey);
      
      if (canUseAnthropicAPI) {
        // Import dynamically to avoid circular dependencies
        const { AnthropicService } = await import('./anthropic.service');
        const claudeResult = await AnthropicService.processTranscript(transcript, {
          meetingType: 'one-on-one',
          additionalInstructions: 'Focus on personal development goals, feedback, and career growth discussions.'
        }, customApiKey);
        return {
          ...baseResult,
          ...claudeResult,
          tasks: (claudeResult as any).actionItems || [],
        };
      }
      
      // Check if we can use OpenAI
      if (customAiProvider === 'openai' && customApiKey) {
        // Import dynamically to avoid circular dependencies
        const { OpenAIService } = await import('./openai.service');
        const openaiResult = await OpenAIService.processTranscript(transcript, {
          meetingType: 'one-on-one',
          additionalInstructions: 'Focus on personal development goals, feedback, and career growth discussions.'
        }, customApiKey);
        return {
          ...baseResult,
          ...openaiResult,
          tasks: (openaiResult as any).actionItems || [],
        };
      }
      
      // Check if we can use Gemini
      if (customAiProvider === 'gemini' && customApiKey) {
        // Import dynamically to avoid circular dependencies
        const { GeminiService } = await import('./gemini.service');
        const geminiResult = await GeminiService.processTranscript(transcript, {
          meetingType: 'one-on-one',
          additionalInstructions: 'Focus on personal development goals, feedback, and career growth discussions.'
        }, customApiKey);
        return {
          ...baseResult,
          ...geminiResult,
          tasks: (geminiResult as any).actionItems || [],
        };
      }
      
      // Fallback to basic processing
      const result = await this.processDefaultMeeting(transcript, baseResult, customApiKey, customAiProvider);
      
      // Add specialized processing for 1:1 meetings
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
      // Determine if we can use Anthropic API
      const canUseAnthropicAPI = process.env.ANTHROPIC_API_KEY || (customAiProvider === 'anthropic' && customApiKey);
      
      if (canUseAnthropicAPI) {
        // Import dynamically to avoid circular dependencies
        const { AnthropicService } = await import('./anthropic.service');
        const claudeResult = await AnthropicService.processTranscript(transcript, {
          meetingType: 'team-meeting',
          additionalInstructions: 'Focus on project updates, team blockers, decisions made, and team collaboration.'
        }, customApiKey);
        return {
          ...baseResult,
          ...claudeResult,
          tasks: (claudeResult as any).actionItems || [],
        };
      }
      
      // Check if we can use OpenAI
      if (customAiProvider === 'openai' && customApiKey) {
        // Import dynamically to avoid circular dependencies
        const { OpenAIService } = await import('./openai.service');
        const openaiResult = await OpenAIService.processTranscript(transcript, {
          meetingType: 'team-meeting',
          additionalInstructions: 'Focus on project updates, team blockers, decisions made, and team collaboration.'
        }, customApiKey);
        return {
          ...baseResult,
          ...openaiResult,
          tasks: (openaiResult as any).actionItems || [],
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
      // Determine if we can use Anthropic API
      const canUseAnthropicAPI = process.env.ANTHROPIC_API_KEY || (customAiProvider === 'anthropic' && customApiKey);
      
      if (canUseAnthropicAPI) {
        // Import dynamically to avoid circular dependencies
        const { AnthropicService } = await import('./anthropic.service');
        const claudeResult = await AnthropicService.processTranscript(transcript, {
          meetingType: 'client-presentation',
          additionalInstructions: 'Focus on client questions, concerns, feedback, and opportunities for follow-up.'
        }, customApiKey);
        return {
          ...baseResult,
          ...claudeResult,
          tasks: (claudeResult as any).actionItems || [],
        };
      }
      
      // Check if we can use OpenAI
      if (customAiProvider === 'openai' && customApiKey) {
        // Import dynamically to avoid circular dependencies
        const { OpenAIService } = await import('./openai.service');
        const openaiResult = await OpenAIService.processTranscript(transcript, {
          meetingType: 'client-presentation',
          additionalInstructions: 'Focus on client questions, concerns, feedback, and opportunities for follow-up.'
        }, customApiKey);
        return {
          ...baseResult,
          ...openaiResult,
          tasks: (openaiResult as any).actionItems || [],
        };
      }
      
      // Fallback to basic processing
      const result = await this.processDefaultMeeting(transcript, baseResult, customApiKey, customAiProvider);
      
      // Add client-specific processing
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
      // Determine if we can use Anthropic API
      const canUseAnthropicAPI = process.env.ANTHROPIC_API_KEY || (customAiProvider === 'anthropic' && customApiKey);
      
      if (canUseAnthropicAPI) {
        // Import dynamically to avoid circular dependencies
        const { AnthropicService } = await import('./anthropic.service');
        const claudeResult = await AnthropicService.processTranscript(transcript, {
          meetingType: 'sales-call',
          additionalInstructions: 'Focus on objections raised, budget discussions, timeline negotiations, and next steps.'
        }, customApiKey);
        return {
          ...baseResult,
          ...claudeResult,
          tasks: (claudeResult as any).actionItems || [],
        };
      }
      
      // Check if we can use OpenAI
      if (customAiProvider === 'openai' && customApiKey) {
        // Import dynamically to avoid circular dependencies
        const { OpenAIService } = await import('./openai.service');
        const openaiResult = await OpenAIService.processTranscript(transcript, {
          meetingType: 'sales-call',
          additionalInstructions: 'Focus on objections raised, budget discussions, timeline negotiations, and next steps.'
        }, customApiKey);
        return {
          ...baseResult,
          ...openaiResult,
          tasks: (openaiResult as any).actionItems || [],
        };
      }
      
      // Check if we can use Gemini
      if (customAiProvider === 'gemini' && customApiKey) {
        // Import dynamically to avoid circular dependencies
        const { GeminiService } = await import('./gemini.service');
        const geminiResult = await GeminiService.processTranscript(transcript, {
          meetingType: 'sales-call',
          additionalInstructions: 'Focus on objections raised, budget discussions, timeline negotiations, and next steps.'
        }, customApiKey);
        return {
          ...baseResult,
          ...geminiResult,
          tasks: (geminiResult as any).actionItems || [],
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
} 