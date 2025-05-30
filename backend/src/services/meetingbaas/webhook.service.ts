import crypto from 'crypto';
import { prisma } from '../../utils/prisma';

export interface WebhookEvent {
  event: string;
  data: any;
  timestamp?: string;
  signature?: string;
}

export interface ProcessedWebhookResult {
  success: boolean;
  message: string;
  processed: boolean;
  meetingId?: string;
  botId?: string;
}

/**
 * MeetingBaas webhook service implementing official webhook specification
 * Based on: https://docs.meetingbaas.com/docs/api/getting-started/getting-the-data
 */
export class MeetingBaasWebhookService {
  private readonly idempotencyCache = new Map<string, { timestamp: number; result: any }>();

  /**
   * Process incoming webhook event with retry mechanism
   */
  async processWithRetry(
    event: WebhookEvent,
    rawBody: string,
    signature?: string,
    maxRetries: number = 3
  ): Promise<ProcessedWebhookResult> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.processWebhookEvent(event, rawBody, signature);
      } catch (error) {
        lastError = error as Error;
        console.error(`🔄 Webhook processing attempt ${attempt}/${maxRetries} failed:`, error);
        
        if (attempt < maxRetries) {
          // Exponential backoff: 1s, 2s, 4s
          const delay = Math.pow(2, attempt - 1) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    return {
      success: false,
      message: `Failed after ${maxRetries} attempts: ${lastError?.message}`,
      processed: false
    };
  }

  /**
   * Process incoming webhook event
   */
  async processWebhookEvent(
    event: WebhookEvent,
    rawBody: string,
    signature?: string
  ): Promise<ProcessedWebhookResult> {
    try {
      // Generate idempotency key
      const idempotencyKey = this.generateIdempotencyKey(event);
      
      // Check if we've already processed this event
      const cached = this.idempotencyCache.get(idempotencyKey);
      if (cached && Date.now() - cached.timestamp < 300000) { // 5 minutes
        console.log(`⚡ Returning cached result for event: ${event.event}`);
        return cached.result;
      }

      // Process based on event type
      let result: ProcessedWebhookResult;
      
      switch (event.event) {
        case 'bot.status_change':
          result = await this.handleBotStatusChange(event);
          break;
          
        case 'complete':
          result = await this.handleBotComplete(event);
          break;
          
        case 'failed':
          result = await this.handleBotFailed(event);
          break;
          
        case 'calendar.sync_events':
          result = await this.handleCalendarSync(event);
          break;
          
        default:
          console.warn(`⚠️ Unknown webhook event type: ${event.event}`);
          result = {
            success: true,
            message: `Unknown event type: ${event.event}`,
            processed: false
          };
      }

      // Cache the result
      this.idempotencyCache.set(idempotencyKey, {
        timestamp: Date.now(),
        result
      });

      return result;
    } catch (error) {
      console.error('💥 Error processing webhook event:', error);
      throw error;
    }
  }

  /**
   * Handle bot status change events
   * Status codes: joining_call, in_waiting_room, in_call_not_recording, 
   * in_call_recording, recording_paused, recording_resumed, call_ended, 
   * bot_rejected, bot_removed, waiting_room_timeout, invalid_meeting_url, meeting_error
   */
  private async handleBotStatusChange(event: WebhookEvent): Promise<ProcessedWebhookResult> {
    const { bot_id, status } = event.data;
    const statusCode = status?.code;
    const createdAt = status?.created_at;

    console.log(`🤖 Bot Status Change: ${bot_id} -> ${statusCode}`);

    if (!bot_id || !statusCode) {
      return {
        success: false,
        message: 'Invalid bot status change event: missing bot_id or status.code',
        processed: false
      };
    }

    try {
      // Find the meeting by MeetingBaas bot ID
      const meeting = await prisma.meeting.findFirst({
        where: { meetingBaasId: bot_id }
      });

      if (!meeting) {
        console.warn(`⚠️ No meeting found for bot ID: ${bot_id}`);
        return {
          success: true,
          message: `No meeting found for bot ID: ${bot_id}`,
          processed: false,
          botId: bot_id
        };
      }

      // Map status codes to our internal status
      const statusMapping: Record<string, string> = {
        'joining_call': 'joining',
        'in_waiting_room': 'waiting',
        'in_call_not_recording': 'in_call',
        'in_call_recording': 'recording',
        'recording_paused': 'paused',
        'recording_resumed': 'recording',
        'call_ended': 'completed',
        'bot_rejected': 'failed',
        'bot_removed': 'failed',
        'waiting_room_timeout': 'failed',
        'invalid_meeting_url': 'failed',
        'meeting_error': 'failed'
      };

      const internalStatus = statusMapping[statusCode] || 'unknown';

      // Update meeting status
      await prisma.meeting.update({
        where: { id: meeting.id },
        data: {
          status: internalStatus,
          updatedAt: new Date()
        }
      });

      // Log status for visibility
      console.log(`✅ Updated meeting ${meeting.id} status: ${statusCode} -> ${internalStatus}`);

      // Handle special status codes
      if (statusCode === 'in_call_recording' && status.start_time) {
        console.log(`🎥 Recording started at: ${status.start_time}`);
      }

      if (statusCode === 'meeting_error' && status.error_message) {
        console.error(`❌ Meeting error: ${status.error_message} (Type: ${status.error_type})`);
      }

      return {
        success: true,
        message: `Bot status updated: ${statusCode}`,
        processed: true,
        meetingId: meeting.id,
        botId: bot_id
      };

    } catch (error) {
      console.error('💥 Error handling bot status change:', error);
      throw error;
    }
  }

  /**
   * Handle bot completion events (successful recording)
   */
  private async handleBotComplete(event: WebhookEvent): Promise<ProcessedWebhookResult> {
    const { bot_id, mp4, speakers, transcript } = event.data;

    console.log(`✅ Bot Complete: ${bot_id}`);

    if (!bot_id) {
      return {
        success: false,
        message: 'Invalid complete event: missing bot_id',
        processed: false
      };
    }

    try {
      // Find the meeting by MeetingBaas bot ID
      const meeting = await prisma.meeting.findFirst({
        where: { meetingBaasId: bot_id }
      });

      if (!meeting) {
        console.warn(`⚠️ No meeting found for bot ID: ${bot_id}`);
        return {
          success: true,
          message: `No meeting found for bot ID: ${bot_id}`,
          processed: false,
          botId: bot_id
        };
      }

      // Update meeting with completion data
      const updateData: any = {
        status: 'completed',
        processingStatus: 'processing', // Set to processing while we run NLP
        updatedAt: new Date()
      };

      if (mp4) {
        updateData.recordingUrl = mp4;
        console.log(`🎬 Recording URL received (valid for 2 hours): ${mp4.substring(0, 50)}...`);
      }

      if (speakers && Array.isArray(speakers)) {
        updateData.speakers = speakers;
        console.log(`👥 Speakers detected: ${speakers.join(', ')}`);
      }

      let transcriptText = '';
      if (transcript && Array.isArray(transcript)) {
        updateData.transcript = JSON.stringify(transcript);
        console.log(`📝 Transcript received with ${transcript.length} segments`);
        
        // Convert MeetingBaas transcript format to plain text for NLP processing
        transcriptText = transcript.map((segment: any) => {
          if (segment.speaker && segment.words && Array.isArray(segment.words)) {
            const text = segment.words.map((word: any) => word.word).join('');
            return `${segment.speaker}: ${text}`;
          }
          return '';
        }).filter(Boolean).join('\n\n');
      }

      await prisma.meeting.update({
        where: { id: meeting.id },
        data: updateData
      });

      console.log(`✅ Meeting ${meeting.id} marked as completed with recording data`);

      // Trigger NLP processing if we have a transcript
      if (transcriptText.trim()) {
        console.log(`🧠 Starting NLP processing for meeting ${meeting.id}...`);
        
        // Import and run NLP processing asynchronously
        try {
          const { MeetingProcessorService } = await import('../meeting-processor.service');
          
          // Process the transcript with NLP
          const nlpResult = await MeetingProcessorService.processMeetingTranscript(
            meeting.id,
            transcriptText,
            meeting.meetingType as any || 'DEFAULT'
          );

          // Update meeting with NLP results
          await prisma.meeting.update({
            where: { id: meeting.id },
            data: {
              processingStatus: 'completed',
              executiveSummary: nlpResult.executiveSummary,
              wins: nlpResult.wins,
              areasForSupport: nlpResult.areasForSupport,
              updatedAt: new Date()
            }
          });

          console.log(`🎉 NLP processing completed for meeting ${meeting.id}`);
        } catch (nlpError) {
          console.error(`❌ NLP processing failed for meeting ${meeting.id}:`, nlpError);
          
          // Mark processing as completed even if NLP fails, so the meeting isn't stuck
          await prisma.meeting.update({
            where: { id: meeting.id },
            data: {
              processingStatus: 'completed',
              updatedAt: new Date()
            }
          });
        }
      } else {
        // No transcript to process, mark as completed
        await prisma.meeting.update({
          where: { id: meeting.id },
          data: {
            processingStatus: 'completed',
            updatedAt: new Date()
          }
        });
        console.log(`⚠️ No transcript available for NLP processing for meeting ${meeting.id}`);
      }

      return {
        success: true,
        message: 'Meeting completed successfully',
        processed: true,
        meetingId: meeting.id,
        botId: bot_id
      };

    } catch (error) {
      console.error('💥 Error handling bot completion:', error);
      throw error;
    }
  }

  /**
   * Handle bot failure events
   */
  private async handleBotFailed(event: WebhookEvent): Promise<ProcessedWebhookResult> {
    const { bot_id, error: errorType } = event.data;

    console.log(`❌ Bot Failed: ${bot_id} - ${errorType}`);

    if (!bot_id) {
      return {
        success: false,
        message: 'Invalid failed event: missing bot_id',
        processed: false
      };
    }

    try {
      // Find the meeting by MeetingBaas bot ID
      const meeting = await prisma.meeting.findFirst({
        where: { meetingBaasId: bot_id }
      });

      if (!meeting) {
        console.warn(`⚠️ No meeting found for bot ID: ${bot_id}`);
        return {
          success: true,
          message: `No meeting found for bot ID: ${bot_id}`,
          processed: false,
          botId: bot_id
        };
      }

      // Update meeting status to failed
      await prisma.meeting.update({
        where: { id: meeting.id },
        data: {
          status: 'failed',
          updatedAt: new Date()
        }
      });

      // Log the specific error type
      const errorMessages: Record<string, string> = {
        'CannotJoinMeeting': 'Bot could not join the meeting (likely requires login)',
        'TimeoutWaitingToStart': 'Bot timed out waiting to be accepted',
        'BotNotAccepted': 'Bot was refused entry to the meeting',
        'BotRemoved': 'Bot was removed from the meeting by a participant',
        'InternalError': 'An unexpected error occurred',
        'InvalidMeetingUrl': 'The meeting URL provided is not valid'
      };

      const errorMessage = errorMessages[errorType] || `Unknown error: ${errorType}`;
      console.error(`❌ Meeting ${meeting.id} failed: ${errorMessage}`);

      return {
        success: true,
        message: `Meeting failed: ${errorMessage}`,
        processed: true,
        meetingId: meeting.id,
        botId: bot_id
      };

    } catch (error) {
      console.error('💥 Error handling bot failure:', error);
      throw error;
    }
  }

  /**
   * Handle calendar sync events
   */
  private async handleCalendarSync(event: WebhookEvent): Promise<ProcessedWebhookResult> {
    const { calendar_id, last_updated_ts, affected_event_uuids } = event.data;

    console.log(`📅 Calendar Sync: ${calendar_id} - ${affected_event_uuids?.length || 0} events affected`);

    try {
      // Find the user who owns this calendar
      const calendarIntegration = await prisma.calendarIntegration.findFirst({
        where: { 
          calendarId: calendar_id,
          isActive: true 
        }
      });

      if (!calendarIntegration) {
        console.warn(`⚠️ No active calendar integration found for calendar ID: ${calendar_id}`);
        return {
          success: true,
          message: `No active calendar integration found for calendar ID: ${calendar_id}`,
          processed: false
        };
      }

      // Process each affected event
      let processedCount = 0;
      if (affected_event_uuids && affected_event_uuids.length > 0) {
        const { MeetingBaasCalendarService } = await import('./calendar.service');
        const calendarService = new MeetingBaasCalendarService();

        for (const eventUuid of affected_event_uuids) {
          try {
            // Get the latest event details from MeetingBaas
            const eventDetails = await calendarService.getCalendarEvent(eventUuid);
            
            // Update the meeting from the calendar event
            const updated = await this.updateMeetingFromCalendarEvent(eventDetails, calendarIntegration.userId);
            if (updated) processedCount++;
            
          } catch (eventError) {
            console.error(`Error processing calendar event ${eventUuid}:`, eventError);
            // Continue with other events
          }
        }
      }

      console.log(`📅 Calendar sync processed ${processedCount} meeting updates from ${affected_event_uuids?.length || 0} events`);

      return {
        success: true,
        message: `Calendar sync processed ${processedCount} meeting updates`,
        processed: processedCount > 0
      };

    } catch (error) {
      console.error('💥 Error handling calendar sync:', error);
      return {
        success: false,
        message: `Error handling calendar sync: ${error instanceof Error ? error.message : String(error)}`,
        processed: false
      };
    }
  }

  /**
   * Update a meeting from calendar event data (webhook version)
   */
  private async updateMeetingFromCalendarEvent(event: any, userId: string): Promise<boolean> {
    try {
      // Find the meeting by calendar event ID
      const meeting = await prisma.meeting.findFirst({
        where: { 
          calendarEventId: event.uuid,
          createdBy: userId // Ensure user owns this meeting
        }
      });

      if (!meeting) {
        // No meeting found for this calendar event
        return false;
      }

      // Check if any fields need updating
      const updateData: any = {
        lastSyncedAt: new Date()
      };

      let hasChanges = false;
      const changes: any = {
        meetingId: meeting.id,
        changeType: 'webhook_sync',
        eventId: event.uuid,
        changeData: event
      };

      // Check title changes
      if (event.name && event.name !== meeting.title) {
        updateData.title = event.name;
        changes.previousTitle = meeting.title;
        changes.newTitle = event.name;
        hasChanges = true;
      }

      // Check date/time changes
      if (event.startTime) {
        const newDate = new Date(event.startTime);
        if (Math.abs(newDate.getTime() - meeting.date.getTime()) > 60000) { // More than 1 minute difference
          updateData.date = newDate;
          changes.previousDate = meeting.date;
          changes.newDate = newDate;
          hasChanges = true;
        }
      }

      // Check duration changes (convert from seconds to minutes if needed)
      if (event.duration) {
        let newDuration = event.duration;
        // If duration is in seconds, convert to minutes
        if (newDuration > 1440) { // More than 24 hours in minutes, likely in seconds
          newDuration = Math.round(newDuration / 60);
        }
        
        if (newDuration !== meeting.duration) {
          updateData.duration = newDuration;
          changes.previousDuration = meeting.duration;
          changes.newDuration = newDuration;
          hasChanges = true;
        }
      }

      // Update the meeting if there are changes
      if (hasChanges) {
        await prisma.meeting.update({
          where: { id: meeting.id },
          data: updateData
        });

        // Record the change
        await prisma.meetingChange.create({
          data: changes
        });

        console.log(`🔄 Updated meeting ${meeting.id} from webhook: ${Object.keys(updateData).filter(k => k !== 'lastSyncedAt').join(', ')}`);
        return true;
      } else {
        // Just update the sync time
        await prisma.meeting.update({
          where: { id: meeting.id },
          data: { lastSyncedAt: new Date() }
        });
        return false;
      }
    } catch (error) {
      console.error(`Error updating meeting from calendar event:`, error);
      return false;
    }
  }

  /**
   * Generate idempotency key for webhook event
   */
  private generateIdempotencyKey(event: WebhookEvent): string {
    const botId = event.data?.bot_id || 'unknown';
    const timestamp = event.timestamp || new Date().toISOString();
    
    return crypto
      .createHash('sha256')
      .update(`${event.event}-${botId}-${timestamp}`)
      .digest('hex');
  }

  /**
   * Clean up old idempotency cache entries (call periodically)
   */
  public cleanupCache(): void {
    const now = Date.now();
    const maxAge = 300000; // 5 minutes

    for (const [key, value] of this.idempotencyCache.entries()) {
      if (now - value.timestamp > maxAge) {
        this.idempotencyCache.delete(key);
      }
    }
  }
} 