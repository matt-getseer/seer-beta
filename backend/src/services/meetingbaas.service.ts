import axios from 'axios';
import { prisma } from '../utils/prisma';
import { NLPService } from './nlp.service';
import { MeetingType } from './meeting-processor.service';
import { TaskAssignmentService } from './task-assignment.service';
import { CalendarService, CalendarMeetingData, CalendarMeetingResponse } from './calendar.service';
import crypto from 'crypto';

// Using singleton Prisma client from utils/prisma
const MEETINGBAAS_API_URL = process.env.MEETINGBAAS_API_URL || 'https://api.meetingbaas.com';
const MEETINGBAAS_API_KEY = process.env.MEETINGBAAS_API_KEY;

// Extended interface for multi-platform support
interface MeetingBaasCalendarResponse {
  id: string;
  googleMeetLink: string;
  platform: string;
  platformMeetingUrl: string;
  calendarEventId: string;
  calendarProvider: string;
  status: string;
}

interface NLPResult {
  transcript: string;
  executiveSummary: string;
  wins: string[];
  areasForSupport: string[];
  tasks: string[]; // Legacy format for backward compatibility
  actionItems?: Array<{ text: string; reasoning: string }>; // New format with reasoning
}

/**
 * Service to interact with MeetingBaas API
 */
export class MeetingBaasService {
  /**
   * Create meeting using MeetingBaas Calendar API
   * This method supports multi-platform meetings and automatic rescheduling
   */
  static async createMeetingWithCalendar(meetingData: {
    title: string;
    scheduledTime: Date;
    duration: number;
    platform: 'google_meet' | 'zoom' | 'teams';
    userId: string;
    teamMemberId?: string;
    calendarProvider: 'google' | 'microsoft';
  }): Promise<MeetingBaasCalendarResponse> {
    try {
      console.log(`Creating ${meetingData.platform} meeting via calendar integration for user ${meetingData.userId}`);

      // Check if calendar integration is enabled
      if (!CalendarService.isCalendarIntegrationEnabled()) {
        throw new Error('MeetingBaas calendar integration is not enabled. Please enable calendar integration to create meetings.');
      }

      // Get team member email for attendees
      let attendees: string[] = [];
      if (meetingData.teamMemberId) {
        try {
          const teamMember = await prisma.user.findUnique({
            where: { id: meetingData.teamMemberId },
            select: { email: true }
          });
          
          if (teamMember?.email) {
            attendees.push(teamMember.email);
          }
        } catch (err) {
          console.warn('Error fetching team member email:', err);
        }
      }

      // Prepare calendar meeting data
      const calendarMeetingData: CalendarMeetingData = {
        title: meetingData.title,
        scheduledTime: meetingData.scheduledTime,
        duration: meetingData.duration,
        platform: meetingData.platform,
        attendees: attendees,
        userId: meetingData.userId
      };

      // Create meeting through calendar service
      const calendarResponse = await CalendarService.createCalendarMeeting(
        meetingData.userId,
        calendarMeetingData,
        meetingData.calendarProvider
      );

      return {
        id: calendarResponse.id,
        googleMeetLink: calendarResponse.googleMeetLink,
        platformMeetingUrl: calendarResponse.googleMeetLink,
        platform: meetingData.platform,
        calendarEventId: calendarResponse.calendarEventId || '',
        calendarProvider: meetingData.calendarProvider,
        status: "scheduled"
      };

    } catch (error) {
      console.error('Error creating meeting with calendar integration:', error);
      throw new Error(`Failed to create ${meetingData.platform} meeting via calendar integration: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Update meeting when calendar event changes
   */
  static async updateMeetingFromCalendar(meetingId: string, calendarData: any): Promise<void> {
    try {
      console.log(`Updating meeting ${meetingId} from calendar data`);

      const { title, start_time, duration, meeting_url } = calendarData;

      // Update meeting in database
      const updateData: any = {
        lastSyncedAt: new Date()
      };

      if (title) updateData.title = title;
      if (start_time) updateData.date = new Date(start_time);
      if (duration) updateData.duration = duration;
      if (meeting_url) updateData.platformMeetingUrl = meeting_url;

      await prisma.meeting.update({
        where: { id: meetingId },
        data: updateData
      });

      console.log(`Successfully updated meeting ${meetingId} from calendar`);
    } catch (error) {
      console.error('Error updating meeting from calendar:', error);
      throw new Error('Failed to update meeting from calendar data');
    }
  }

  /**
   * Process recording with NLP
   */
  static async processRecording(meetingBaasId: string, webhookData?: any): Promise<any> {
    try {
      // Find the meeting to get its ID
      const meeting = await prisma.meeting.findUnique({
        where: { meetingBaasId },
        select: {
          id: true,
          title: true
          // We no longer need to select meetingType since we always use ONE_ON_ONE
        }
      });
      
      if (!meeting) {
        throw new Error(`Meeting with MeetingBaasId ${meetingBaasId} not found`);
      }

      // Update meeting status to processing
      await prisma.meeting.update({
        where: { meetingBaasId },
        data: { processingStatus: 'processing' }
      });

      // Extract transcript from webhook data or API
      let transcript = '';
      
      // Check if we have webhook data from the "complete" event
      if (webhookData && webhookData.transcript) {
        console.log('Using transcript data from webhook payload');
        
        // Convert the webhook transcript format to a simple text string
        if (Array.isArray(webhookData.transcript)) {
          webhookData.transcript.forEach((segment: any) => {
            if (segment.speaker && segment.words) {
              transcript += `${segment.speaker}: `;
              segment.words.forEach((word: any) => {
                transcript += word.word;
              });
              transcript += '\n';
            }
          });
        }
      } else {
        // Fallback to API call if no webhook data is provided
        console.log('No transcript in webhook data, fetching from MeetingBaas API');
        
        // Get recording and transcript from MeetingBaas
        const response = await axios.get(
          `${MEETINGBAAS_API_URL}/bots/${meetingBaasId}/recording`,
          {
            headers: {
              'Authorization': `Bearer ${MEETINGBAAS_API_KEY}`
            }
          }
        );

        transcript = response.data.transcript || '';
      }
      
      // Determine meeting type (default to DEFAULT if not specified)
      const meetingType = this.determineMeetingType(meeting);
      
      // Process transcript with our custom NLP service
      return await NLPService.processMeetingTranscript(
        meeting.id,
        transcript,
        meetingType
      );
    } catch (error) {
      console.error('Error processing recording:', error);
      
      try {
        // Update meeting status to failed
        await prisma.meeting.update({
          where: { meetingBaasId },
          data: { processingStatus: 'failed' }
        });
      } catch (updateError) {
        console.error('Error updating meeting status:', updateError);
      }
      
      throw new Error('Failed to process recording');
    }
  }
  
  /**
   * Determine the meeting type based on meeting data
   */
  private static determineMeetingType(meeting: any): MeetingType {
    // Per client request, always use ONE_ON_ONE meeting type
    return MeetingType.ONE_ON_ONE;
    
    // Code below is kept for future reference but not used
    /*
    // If the meeting has an explicit type, use it
    if (meeting.meetingType) {
      try {
        return meeting.meetingType as MeetingType;
      } catch (e) {
        console.warn(`Invalid meeting type: ${meeting.meetingType}, using DEFAULT`);
      }
    }
    
    // Otherwise, try to infer from the title
    const title = meeting.title.toLowerCase();
    
    if (title.includes('1:1') || title.includes('one on one') || title.includes('1-on-1')) {
      return MeetingType.ONE_ON_ONE;
    }
    
    if (title.includes('team') || title.includes('standup') || title.includes('sprint')) {
      return MeetingType.TEAM_MEETING;
    }
    
    if (title.includes('client') || title.includes('presentation')) {
      return MeetingType.CLIENT_PRESENTATION;
    }
    
    if (title.includes('sales') || title.includes('prospect') || title.includes('demo')) {
      return MeetingType.SALES_CALL;
    }
    
    // Default meeting type
    return MeetingType.DEFAULT;
    */
  }
  
  /**
   * Handle webhook for meeting completion
   */
  static async handleMeetingCompleted(meetingBaasId: string, webhookData?: any): Promise<void> {
    try {
      // Find the meeting in our database
      const meeting = await prisma.meeting.findUnique({
        where: { meetingBaasId }
      });
      
      if (!meeting) {
        console.warn(`Meeting with MeetingBaas ID ${meetingBaasId} not found in database. This might be a test webhook or external meeting.`);
        // For test webhooks or external meetings, we'll just log and return success
        // rather than throwing an error
        return;
      }
      
      console.log(`Processing meeting completion for meeting ${meeting.id} (MeetingBaas ID: ${meetingBaasId})`);
      
      // Process the recording with our NLP service, passing the webhook data
      const nlpResult = await this.processRecording(meetingBaasId, webhookData);
      
      // Store the recording URL if provided in the webhook data
      const recordingUrl = webhookData?.mp4 || '';
      
      // Update the meeting with NLP results and create structured tasks
      await prisma.meeting.update({
        where: { meetingBaasId },
        data: {
          status: 'completed',
          processingStatus: 'completed',
          transcript: nlpResult.transcript,
          executiveSummary: nlpResult.executiveSummary,
          wins: nlpResult.wins,
          areasForSupport: nlpResult.areasForSupport,
          tasks: nlpResult.tasks,
          recordingUrl: recordingUrl,
          // Store additional data if available
          ...(nlpResult.keyInsights ? { keyInsights: nlpResult.keyInsights } : {}),
          ...(nlpResult.clientFeedback ? { clientFeedback: nlpResult.clientFeedback } : {})
        }
      });

      // Create structured tasks with intelligent assignment
      if ((nlpResult.tasks && nlpResult.tasks.length > 0) || (nlpResult.actionItems && nlpResult.actionItems.length > 0)) {
        await this.createStructuredTasks(meeting, nlpResult);
      }
      
      console.log(`Successfully processed meeting completion for ${meetingBaasId}`);
    } catch (error) {
      console.error('Error handling meeting completion:', error);
      throw new Error('Failed to handle meeting completion');
    }
  }

  /**
   * Get calendar event details from MeetingBaas
   */
  static async getCalendarEvent(eventId: string): Promise<any> {
    try {
      console.log(`Fetching calendar event details for ${eventId}`);
      
      // Call the MeetingBaas API to get event details
      const response = await axios.get(
        `${MEETINGBAAS_API_URL}/calendar_events/${eventId}`,
        {
          headers: {
            'Authorization': `Bearer ${MEETINGBAAS_API_KEY}`
          }
        }
      );
      
      return response.data;
    } catch (error) {
      console.error(`Error fetching calendar event ${eventId}:`, error);
      throw new Error(`Failed to fetch calendar event details for ${eventId}`);
    }
  }

  /**
   * Create structured tasks with intelligent assignment
   */
  private static async createStructuredTasks(meeting: any, nlpResult: any): Promise<void> {
    try {
      console.log(`Creating structured tasks for meeting ${meeting.id}`);
      
      // Extract tasks from either legacy format or new format
      let tasksToProcess: Array<{ text: string; reasoning: string }> = [];
      
      if (nlpResult.actionItems && Array.isArray(nlpResult.actionItems)) {
        // New format with reasoning
        tasksToProcess = nlpResult.actionItems.map((item: any) => ({
          text: item.text || '',
          reasoning: item.reasoning || ''
        }));
      } else if (nlpResult.tasks && Array.isArray(nlpResult.tasks)) {
        // Legacy format - convert strings to objects
        tasksToProcess = nlpResult.tasks.map((task: string) => ({
          text: task,
          reasoning: ''
        }));
      }
      
      if (tasksToProcess.length === 0) {
        console.log('No tasks to create for this meeting');
        return;
      }
      
      // Get user's AI preferences for task assignment
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

      // Determine custom API settings
      let customApiKey: string | null = null;
      let customAiProvider: string | null = null;
      
      if (user?.useCustomAI) {
        if (user.aiProvider === 'anthropic' && user.hasAnthropicKey && user.anthropicApiKey) {
          customApiKey = user.anthropicApiKey;
          customAiProvider = 'anthropic';
        } else if (user.aiProvider === 'openai' && user.hasOpenAIKey && user.openaiApiKey) {
          customApiKey = user.openaiApiKey;
          customAiProvider = 'openai';
        } else if (user.aiProvider === 'gemini' && user.hasGeminiKey && user.geminiApiKey) {
          customApiKey = user.geminiApiKey;
          customAiProvider = 'gemini';
        }
      }

      // Use TaskAssignmentService to intelligently assign tasks
      // Extract just the text for assignment (TaskAssignmentService expects string[])
      const taskTexts = tasksToProcess.map(task => task.text);
      const assignedTasks = await TaskAssignmentService.assignTasks(
        taskTexts,
        meeting.createdBy, // Manager ID
        meeting.teamMemberId || meeting.createdBy, // Use creator as fallback team member
        customApiKey,
        customAiProvider
      );

      // Create structured Task records in the database with reasoning
      for (let i = 0; i < assignedTasks.length; i++) {
        const taskData = assignedTasks[i];
        const originalTask = tasksToProcess[i];
        const taskId = crypto.randomUUID();
        const now = new Date();
        
        await prisma.$executeRaw`
          INSERT INTO "Task" (
            "id", 
            "text", 
            "assignedTo", 
            "meetingId", 
            "status", 
            "createdAt",
            "reasoning"
          )
          VALUES (
            ${taskId}, 
            ${taskData.text}, 
            ${taskData.assignedTo}, 
            ${meeting.id}, 
            'incomplete', 
            ${now}::timestamp,
            ${originalTask.reasoning}
          )
        `;
        
        console.log(`Created task "${taskData.text}" assigned to ${taskData.assignedTo} with reasoning: "${originalTask.reasoning}"`);
      }
      
      console.log(`Successfully created ${assignedTasks.length} structured tasks for meeting ${meeting.id}`);
    } catch (error) {
      console.error('Error creating structured tasks:', error);
      // Don't throw - we want the meeting completion to succeed even if task creation fails
    }
  }
} 