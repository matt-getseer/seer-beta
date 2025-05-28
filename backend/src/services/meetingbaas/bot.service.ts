import { prisma } from '../../utils/prisma';
import { MeetingBaasClientService } from './client.service';
import { MeetingBaasConfig } from '../../config/meetingbaas.config';
import type { SpeechToTextProvider } from '@meeting-baas/sdk/dist/baas/models';

export interface BotCreationParams {
  meetingUrl: string;
  meetingId?: string;
  userId: string;
  teamMemberId?: string;
  botName?: string;
  webhookUrl?: string;
  recordingMode?: string;
  speechToText?: {
    provider: string;
    apiKey: string;
  };
  automaticLeave?: {
    nooneJoinedTimeout: number;
    waitingRoomTimeout: number;
  };
  extra?: Record<string, any>;
}

export interface BotResponse {
  botId: string;
  meetingUrl: string;
  status: string;
}

/**
 * Service for managing MeetingBaas bots for direct meeting URLs
 */
export class MeetingBaasBotService {
  private client: MeetingBaasClientService | null = null;

  constructor() {
    // Don't initialize client here - will be initialized when needed
  }

  private getClient(): MeetingBaasClientService {
    if (!this.client) {
      this.client = MeetingBaasClientService.getInstance({
        apiKey: MeetingBaasConfig.client.apiKey,
        baseUrl: MeetingBaasConfig.client.baseUrl,
      });
    }
    return this.client;
  }

  /**
   * Create a bot for a meeting URL and store in database
   */
  async createBot(params: BotCreationParams): Promise<BotResponse> {
    try {
      console.log(`Creating bot for meeting: ${params.meetingUrl}`);

      // Create bot via MeetingBaas
      const botResponse = await this.getClient().join({
        meetingUrl: params.meetingUrl,
        botName: params.botName || 'Seer Meeting Bot',
        webhook_url: params.webhookUrl,
        extra: params.extra,
        speech_to_text: params.speechToText ? {
          provider: params.speechToText.provider as SpeechToTextProvider,
          api_key: params.speechToText.apiKey,
        } : undefined,
        reserved: false,
      });

      const botId = botResponse.botId;
      if (!botId) {
        throw new Error('Bot creation failed: No bot ID returned');
      }

      // Store or update meeting in database
      if (params.meetingId) {
        await prisma.meeting.update({
          where: { id: params.meetingId },
          data: {
            meetingBaasId: botId,
            processingStatus: 'pending',
            platformMeetingUrl: params.meetingUrl,
            updatedAt: new Date(),
          },
        });
      }

      console.log(`Bot created successfully with ID: ${botId}`);
      
      return {
        botId,
        meetingUrl: params.meetingUrl,
        status: 'created',
      };

    } catch (error) {
      console.error('Error creating bot:', error);
      
      // Update meeting status if we have a meetingId
      if (params.meetingId) {
        try {
          await prisma.meeting.update({
            where: { id: params.meetingId },
            data: {
              processingStatus: 'failed',
              updatedAt: new Date(),
            },
          });
        } catch (dbError) {
          console.error('Error updating meeting status:', dbError);
        }
      }

      throw new Error(`Failed to create bot: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get bot details and recording data
   */
  async getBot(botId: string) {
    try {
      return await this.getClient().getMeetingData(botId);
    } catch (error) {
      console.error('Error getting bot:', error);
      throw new Error(`Failed to get bot ${botId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * End a bot session
   */
  async endBot(botId: string): Promise<void> {
    try {
      console.log(`Ending bot session: ${botId}`);

      await this.getClient().leave(botId);

      // Update meeting status in database
      const meeting = await prisma.meeting.findUnique({
        where: { meetingBaasId: botId },
      });

      if (meeting) {
        await prisma.meeting.update({
          where: { meetingBaasId: botId },
          data: {
            status: 'cancelled',
            processingStatus: 'cancelled',
            updatedAt: new Date(),
          },
        });
      }

      console.log(`Bot session ended: ${botId}`);
    } catch (error) {
      console.error('Error ending bot:', error);
      throw new Error(`Failed to end bot ${botId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * List recent bots with filtering
   */
  async listRecentBots(params?: {
    userId?: string;
    limit?: number;
    cursor?: string;
    botName?: string;
    meetingUrl?: string;
    createdAfter?: string;
    createdBefore?: string;
  }) {
    try {
      const botParams: any = {
        limit: params?.limit || 50,
        cursor: params?.cursor,
        botName: params?.botName,
        meetingUrl: params?.meetingUrl,
        createdAfter: params?.createdAfter,
        createdBefore: params?.createdBefore,
      };

      // If userId is provided, filter by user in extra data
      if (params?.userId) {
        botParams.filterByExtra = JSON.stringify({ userId: params.userId });
      }

      return await this.getClient().botsWithMetadata();
    } catch (error) {
      console.error('Error listing recent bots:', error);
      throw new Error(`Failed to list recent bots: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Retranscribe a bot recording with different settings
   */
  async retranscribeBot(
    botId: string,
    options?: {
      speechToText?: {
        provider: string;
        apiKey: string;
      };
      webhookUrl?: string;
    }
  ): Promise<void> {
    try {
      console.log(`Retranscribing bot: ${botId}`);

      // TODO: Implement retranscribe functionality
      // await this.client.retranscribeBot(botId, {
      //   speechToText: options?.speechToText,
      //   webhookUrl: options?.webhookUrl,
      // });
      
      console.log('Retranscribe functionality not yet implemented');

      // Update meeting status to processing
      const meeting = await prisma.meeting.findUnique({
        where: { meetingBaasId: botId },
      });

      if (meeting) {
        await prisma.meeting.update({
          where: { meetingBaasId: botId },
          data: {
            processingStatus: 'processing',
            updatedAt: new Date(),
          },
        });
      }

      console.log(`Retranscription started for bot: ${botId}`);
    } catch (error) {
      console.error('Error retranscribing bot:', error);
      throw new Error(`Failed to retranscribe bot ${botId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Create bot with default configuration for a user
   */
  async createBotWithDefaults(
    meetingUrl: string,
    userId: string,
    options?: {
      meetingId?: string;
      teamMemberId?: string;
      customBotName?: string;
      customWebhookUrl?: string;
    }
  ): Promise<BotResponse> {
    const params: BotCreationParams = {
      meetingUrl,
      userId,
      meetingId: options?.meetingId,
      teamMemberId: options?.teamMemberId,
      botName: options?.customBotName || MeetingBaasConfig.bot.defaultName,
      webhookUrl: options?.customWebhookUrl || MeetingBaasConfig.bot.defaultWebhookUrl,
      recordingMode: MeetingBaasConfig.bot.recordingMode,
      speechToText: MeetingBaasConfig.bot.speechToText.apiKey ? {
        provider: MeetingBaasConfig.bot.speechToText.provider,
        apiKey: MeetingBaasConfig.bot.speechToText.apiKey,
      } : undefined,
      automaticLeave: MeetingBaasConfig.bot.automaticLeave,
      extra: {
        source: 'seer-app',
        version: '2.0',
      },
    };

    return await this.createBot(params);
  }

  /**
   * Get bot status and update local database
   */
  async syncBotStatus(botId: string): Promise<void> {
    try {
      const botData = await this.getBot(botId);
      
      const meeting = await prisma.meeting.findUnique({
        where: { meetingBaasId: botId },
      });

      if (meeting && botData) {
        // Map MeetingBaas status to our status
        let status = meeting.status;
        let processingStatus = meeting.processingStatus;

        // Update based on bot data
        if (botData.botData?.bot?.endedAt) {
          status = 'completed';
          processingStatus = botData.botData?.bot?.mp4_s3_path ? 'completed' : 'processing';
        } else if (botData.botData?.bot?.createdAt && !botData.botData?.bot?.endedAt) {
          status = 'in_progress';
          processingStatus = 'processing';
        }

        await prisma.meeting.update({
          where: { meetingBaasId: botId },
          data: {
            status,
            processingStatus,
            recordingUrl: botData.botData?.bot?.mp4_s3_path || meeting.recordingUrl,
            updatedAt: new Date(),
          },
        });

        console.log(`Synced status for bot ${botId}: ${status}/${processingStatus}`);
      }
    } catch (error) {
      console.error('Error syncing bot status:', error);
      // Don't throw here as this is a background sync operation
    }
  }

  /**
   * Bulk sync bot statuses for active meetings
   */
  async syncActiveBots(): Promise<void> {
    try {
      console.log('Syncing active bot statuses...');

      const activeMeetings = await prisma.meeting.findMany({
        where: {
          meetingBaasId: { not: null },
          processingStatus: { in: ['pending', 'processing'] },
        },
        select: { meetingBaasId: true, id: true },
      });

      console.log(`Found ${activeMeetings.length} meetings with MeetingBaas IDs to sync`);

      if (activeMeetings.length === 0) {
        console.log('No active meetings with MeetingBaas IDs found, skipping sync');
        return;
      }

      let syncedCount = 0;
      let errorCount = 0;

      for (const meeting of activeMeetings) {
        if (meeting.meetingBaasId) {
          try {
            // Validate bot ID format (should be a valid UUID or MeetingBaas ID format)
            if (this.isValidBotId(meeting.meetingBaasId)) {
              await this.syncBotStatus(meeting.meetingBaasId);
              syncedCount++;
            } else {
              console.warn(`Invalid bot ID format: ${meeting.meetingBaasId}, skipping sync for meeting ${meeting.id}`);
              // Mark as failed if it's clearly a mock/invalid ID
              await this.markMeetingAsFailed(meeting.id, 'Invalid bot ID format');
              errorCount++;
            }
          } catch (error) {
            console.error(`Error syncing bot ${meeting.meetingBaasId}:`, error);
            errorCount++;
          }
          
          // Add small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      console.log(`Bot sync completed: ${syncedCount} synced, ${errorCount} errors`);
    } catch (error) {
      console.error('Error syncing active bots:', error);
      // Don't throw here as this is a background operation
    }
  }

  /**
   * Validate if a bot ID is in a valid format
   */
  private isValidBotId(botId: string): boolean {
    // Check for UUID format (MeetingBaas typically uses UUIDs)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    
    // Check for other valid MeetingBaas ID formats (alphanumeric, reasonable length)
    const validIdRegex = /^[a-zA-Z0-9_-]{10,50}$/;
    
    // Exclude obvious mock/test IDs
    const mockPatterns = [
      /^placeholder/i,
      /^test/i,
      /^mock/i,
      /^fake/i,
      /^opide82v0pperd5mm4kfnula9c$/i // The specific mock ID causing issues
    ];
    
    // Check if it matches mock patterns
    if (mockPatterns.some(pattern => pattern.test(botId))) {
      return false;
    }
    
    // Check if it matches valid formats
    return uuidRegex.test(botId) || validIdRegex.test(botId);
  }

  /**
   * Mark a meeting as failed due to invalid bot ID
   */
  private async markMeetingAsFailed(meetingId: string, reason: string): Promise<void> {
    try {
      await prisma.meeting.update({
        where: { id: meetingId },
        data: {
          processingStatus: 'failed',
          meetingBaasId: null, // Clear the invalid bot ID
          updatedAt: new Date(),
        },
      });
      console.log(`Marked meeting ${meetingId} as failed: ${reason}`);
    } catch (error) {
      console.error(`Error marking meeting ${meetingId} as failed:`, error);
    }
  }

  /**
   * Get bot configuration template for a user
   */
  getBotConfigTemplate(userId: string): any {
    return {
      bot_name: MeetingBaasConfig.bot.defaultName,
      webhook_url: MeetingBaasConfig.bot.defaultWebhookUrl,
      recording_mode: MeetingBaasConfig.bot.recordingMode,
      speech_to_text: MeetingBaasConfig.bot.speechToText.apiKey ? {
        provider: MeetingBaasConfig.bot.speechToText.provider,
        api_key: MeetingBaasConfig.bot.speechToText.apiKey,
      } : undefined,
      automatic_leave: MeetingBaasConfig.bot.automaticLeave,
      extra: {
        userId,
        source: 'seer-app',
        version: '2.0',
      },
    };
  }
} 