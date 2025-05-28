import { prisma } from '../../utils/prisma';
import { MeetingBaasConfig } from '../../config/meetingbaas.config';
import crypto from 'crypto';

export interface WebhookEvent {
  event_type: string;
  bot_id: string;
  meeting_url?: string;
  data: any;
  timestamp: string;
  signature?: string;
}

export interface ProcessedWebhookResult {
  success: boolean;
  message: string;
  meetingId?: string;
  processed: boolean;
}

/**
 * Enhanced webhook service for handling MeetingBaas events
 */
export class MeetingBaasWebhookService {
  private readonly idempotencyCache = new Map<string, { timestamp: number; result: any }>();

  /**
   * Process incoming webhook event
   */
  async processWebhookEvent(
    event: WebhookEvent,
    rawBody: string,
    signature?: string
  ): Promise<ProcessedWebhookResult> {
    try {
      console.log(`Processing webhook event: ${event.event_type} for bot ${event.bot_id}`);

      // Verify webhook signature if enabled
      if (MeetingBaasConfig.webhook.verificationEnabled && signature) {
        if (!this.verifyWebhookSignature(rawBody, signature)) {
          console.error('Webhook signature verification failed');
          return {
            success: false,
            message: 'Invalid webhook signature',
            processed: false,
          };
        }
      }

      // Check for idempotency
      const idempotencyKey = this.generateIdempotencyKey(event);
      const cachedResult = this.checkIdempotency(idempotencyKey);
      if (cachedResult) {
        console.log(`Webhook event already processed: ${idempotencyKey}`);
        return {
          success: true,
          message: 'Event already processed',
          processed: true,
          ...cachedResult,
        };
      }

      // Process the event based on type
      const result = await this.handleEventByType(event);

      // Cache the result for idempotency
      this.cacheResult(idempotencyKey, result);

      return result;

    } catch (error) {
      console.error('Error processing webhook event:', error);
      return {
        success: false,
        message: `Failed to process webhook: ${error instanceof Error ? error.message : String(error)}`,
        processed: false,
      };
    }
  }

  /**
   * Handle webhook event based on its type
   */
  private async handleEventByType(event: WebhookEvent): Promise<ProcessedWebhookResult> {
    switch (event.event_type) {
      case 'bot_join_call':
        return await this.handleBotJoinCall(event);
      
      case 'bot_leave_call':
        return await this.handleBotLeaveCall(event);
      
      case 'recording_ready':
        return await this.handleRecordingReady(event);
      
      case 'transcript_ready':
        return await this.handleTranscriptReady(event);
      
      case 'bot_error':
        return await this.handleBotError(event);
      
      case 'bot_waiting_room':
        return await this.handleBotWaitingRoom(event);
      
      case 'bot_admitted':
        return await this.handleBotAdmitted(event);
      
      default:
        console.warn(`Unknown webhook event type: ${event.event_type}`);
        return {
          success: true,
          message: `Unknown event type: ${event.event_type}`,
          processed: true,
        };
    }
  }

  /**
   * Handle bot joining call
   */
  private async handleBotJoinCall(event: WebhookEvent): Promise<ProcessedWebhookResult> {
    try {
      const meeting = await prisma.meeting.findUnique({
        where: { meetingBaasId: event.bot_id },
      });

      if (meeting) {
        await prisma.meeting.update({
          where: { meetingBaasId: event.bot_id },
          data: {
            status: 'in_progress',
            processingStatus: 'processing',
            updatedAt: new Date(),
          },
        });

        console.log(`Bot joined call for meeting ${meeting.id}`);
        return {
          success: true,
          message: 'Bot joined call successfully',
          meetingId: meeting.id,
          processed: true,
        };
      }

      return {
        success: true,
        message: 'Bot joined call (no matching meeting found)',
        processed: true,
      };
    } catch (error) {
      console.error('Error handling bot join call:', error);
      throw error;
    }
  }

  /**
   * Handle bot leaving call
   */
  private async handleBotLeaveCall(event: WebhookEvent): Promise<ProcessedWebhookResult> {
    try {
      const meeting = await prisma.meeting.findUnique({
        where: { meetingBaasId: event.bot_id },
      });

      if (meeting) {
        await prisma.meeting.update({
          where: { meetingBaasId: event.bot_id },
          data: {
            status: 'completed',
            updatedAt: new Date(),
          },
        });

        console.log(`Bot left call for meeting ${meeting.id}`);
        return {
          success: true,
          message: 'Bot left call successfully',
          meetingId: meeting.id,
          processed: true,
        };
      }

      return {
        success: true,
        message: 'Bot left call (no matching meeting found)',
        processed: true,
      };
    } catch (error) {
      console.error('Error handling bot leave call:', error);
      throw error;
    }
  }

  /**
   * Handle recording ready
   */
  private async handleRecordingReady(event: WebhookEvent): Promise<ProcessedWebhookResult> {
    try {
      const { mp4_s3_path, audio_s3_path, duration } = event.data;

      const meeting = await prisma.meeting.findUnique({
        where: { meetingBaasId: event.bot_id },
      });

      if (meeting) {
        await prisma.meeting.update({
          where: { meetingBaasId: event.bot_id },
          data: {
            recordingUrl: mp4_s3_path,
            duration: duration ? parseInt(duration) : undefined,
            processingStatus: 'completed',
            updatedAt: new Date(),
          },
        });

        console.log(`Recording ready for meeting ${meeting.id}: ${mp4_s3_path}`);
        return {
          success: true,
          message: 'Recording processed successfully',
          meetingId: meeting.id,
          processed: true,
        };
      }

      return {
        success: true,
        message: 'Recording ready (no matching meeting found)',
        processed: true,
      };
    } catch (error) {
      console.error('Error handling recording ready:', error);
      throw error;
    }
  }

  /**
   * Handle transcript ready
   */
  private async handleTranscriptReady(event: WebhookEvent): Promise<ProcessedWebhookResult> {
    try {
      const { transcript, transcript_s3_path, speakers } = event.data;

      const meeting = await prisma.meeting.findUnique({
        where: { meetingBaasId: event.bot_id },
      });

      if (meeting) {
        // Store transcript data
        const transcriptData = {
          transcript: transcript || null,
          processingStatus: 'completed' as const,
          updatedAt: new Date(),
        };

        await prisma.meeting.update({
          where: { meetingBaasId: event.bot_id },
          data: transcriptData,
        });

        console.log(`Transcript ready for meeting ${meeting.id}`);
        return {
          success: true,
          message: 'Transcript processed successfully',
          meetingId: meeting.id,
          processed: true,
        };
      }

      return {
        success: true,
        message: 'Transcript ready (no matching meeting found)',
        processed: true,
      };
    } catch (error) {
      console.error('Error handling transcript ready:', error);
      throw error;
    }
  }

  /**
   * Handle bot error
   */
  private async handleBotError(event: WebhookEvent): Promise<ProcessedWebhookResult> {
    try {
      const { error_message, error_code } = event.data;

      const meeting = await prisma.meeting.findUnique({
        where: { meetingBaasId: event.bot_id },
      });

      if (meeting) {
        await prisma.meeting.update({
          where: { meetingBaasId: event.bot_id },
          data: {
            status: 'failed',
            processingStatus: 'failed',
            updatedAt: new Date(),
          },
        });

        console.error(`Bot error for meeting ${meeting.id}: ${error_message} (${error_code})`);
        return {
          success: true,
          message: 'Bot error processed',
          meetingId: meeting.id,
          processed: true,
        };
      }

      return {
        success: true,
        message: 'Bot error (no matching meeting found)',
        processed: true,
      };
    } catch (error) {
      console.error('Error handling bot error:', error);
      throw error;
    }
  }

  /**
   * Handle bot waiting room
   */
  private async handleBotWaitingRoom(event: WebhookEvent): Promise<ProcessedWebhookResult> {
    try {
      const meeting = await prisma.meeting.findUnique({
        where: { meetingBaasId: event.bot_id },
      });

      if (meeting) {
        await prisma.meeting.update({
          where: { meetingBaasId: event.bot_id },
          data: {
            status: 'waiting',
            processingStatus: 'waiting',
            updatedAt: new Date(),
          },
        });

        console.log(`Bot in waiting room for meeting ${meeting.id}`);
      }

      return {
        success: true,
        message: 'Bot waiting room status updated',
        meetingId: meeting?.id,
        processed: true,
      };
    } catch (error) {
      console.error('Error handling bot waiting room:', error);
      throw error;
    }
  }

  /**
   * Handle bot admitted to call
   */
  private async handleBotAdmitted(event: WebhookEvent): Promise<ProcessedWebhookResult> {
    try {
      const meeting = await prisma.meeting.findUnique({
        where: { meetingBaasId: event.bot_id },
      });

      if (meeting) {
        await prisma.meeting.update({
          where: { meetingBaasId: event.bot_id },
          data: {
            status: 'in_progress',
            processingStatus: 'processing',
            updatedAt: new Date(),
          },
        });

        console.log(`Bot admitted to call for meeting ${meeting.id}`);
      }

      return {
        success: true,
        message: 'Bot admitted to call',
        meetingId: meeting?.id,
        processed: true,
      };
    } catch (error) {
      console.error('Error handling bot admitted:', error);
      throw error;
    }
  }

  /**
   * Verify webhook signature
   */
  private verifyWebhookSignature(rawBody: string, signature: string): boolean {
    try {
      // Implement signature verification based on MeetingBaas documentation
      // This is a placeholder - adjust based on actual signature format
      const expectedSignature = crypto
        .createHmac('sha256', MeetingBaasConfig.client.apiKey)
        .update(rawBody)
        .digest('hex');

      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      );
    } catch (error) {
      console.error('Error verifying webhook signature:', error);
      return false;
    }
  }

  /**
   * Generate idempotency key for webhook event
   */
  private generateIdempotencyKey(event: WebhookEvent): string {
    return crypto
      .createHash('sha256')
      .update(`${event.event_type}-${event.bot_id}-${event.timestamp}`)
      .digest('hex');
  }

  /**
   * Check if event has already been processed (idempotency)
   */
  private checkIdempotency(key: string): any | null {
    const cached = this.idempotencyCache.get(key);
    if (cached) {
      const now = Date.now();
      if (now - cached.timestamp < MeetingBaasConfig.webhook.idempotencyTtl) {
        return cached.result;
      } else {
        // Clean up expired entry
        this.idempotencyCache.delete(key);
      }
    }
    return null;
  }

  /**
   * Cache result for idempotency
   */
  private cacheResult(key: string, result: any): void {
    this.idempotencyCache.set(key, {
      timestamp: Date.now(),
      result,
    });

    // Clean up old entries periodically
    if (this.idempotencyCache.size > 1000) {
      this.cleanupIdempotencyCache();
    }
  }

  /**
   * Clean up expired idempotency cache entries
   */
  private cleanupIdempotencyCache(): void {
    const now = Date.now();
    const ttl = MeetingBaasConfig.webhook.idempotencyTtl;

    for (const [key, value] of this.idempotencyCache.entries()) {
      if (now - value.timestamp > ttl) {
        this.idempotencyCache.delete(key);
      }
    }
  }

  /**
   * Retry webhook processing with exponential backoff
   */
  async processWithRetry(
    event: WebhookEvent,
    rawBody: string,
    signature?: string,
    maxAttempts: number = MeetingBaasConfig.webhook.retryAttempts
  ): Promise<ProcessedWebhookResult> {
    let lastError: any;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await this.processWebhookEvent(event, rawBody, signature);
      } catch (error) {
        lastError = error;
        
        if (attempt === maxAttempts) {
          break;
        }

        const delay = MeetingBaasConfig.webhook.retryDelay * Math.pow(2, attempt - 1);
        console.warn(`Webhook processing attempt ${attempt} failed, retrying in ${delay}ms:`, error);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    console.error('All webhook processing attempts failed:', lastError);
    return {
      success: false,
      message: `Failed after ${maxAttempts} attempts: ${lastError instanceof Error ? lastError.message : String(lastError)}`,
      processed: false,
    };
  }
} 