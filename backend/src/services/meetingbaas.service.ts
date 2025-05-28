import { MeetingBaasClientService } from './meetingbaas/client.service';
import { MeetingBaasBotService } from './meetingbaas/bot.service';
import { MeetingBaasCalendarService } from './meetingbaas/calendar.service';
import { MeetingBaasConfig } from '../config/meetingbaas.config';
import { prisma } from '../utils/prisma';

/**
 * Main MeetingBaas Service
 * Aggregates all MeetingBaas functionality and provides a unified interface
 */
export class MeetingBaasService {
  private static client: MeetingBaasClientService;
  private static botService: MeetingBaasBotService;
  private static calendarService: MeetingBaasCalendarService;

  /**
   * Initialize the MeetingBaas services
   */
  static initialize() {
    if (!this.client) {
      this.client = MeetingBaasClientService.getInstance({
        apiKey: MeetingBaasConfig.client.apiKey,
        baseUrl: MeetingBaasConfig.client.baseUrl,
      });
      this.botService = new MeetingBaasBotService();
      this.calendarService = new MeetingBaasCalendarService();
    }
  }

  /**
   * Handle meeting completed webhook
   */
  static async handleMeetingCompleted(botId: string, data: any): Promise<void> {
    try {
      this.initialize();
      
      console.log(`Processing completed meeting for bot: ${botId}`);
      
      // Find the meeting in our database
      const meeting = await prisma.meeting.findUnique({
        where: { meetingBaasId: botId },
      });

      if (!meeting) {
        console.warn(`Meeting with MeetingBaas ID ${botId} not found in database`);
        return;
      }

      // Get the latest bot data from MeetingBaas
      const botData = await this.client.getMeetingData(botId);
      
      // Update meeting with recording data
      const recordingUrl = botData.mp4 || data.recording_url;
      const transcriptData = botData.botData?.transcripts?.[0] || null;
      
      await prisma.meeting.update({
        where: { meetingBaasId: botId },
        data: {
          status: 'completed',
          processingStatus: 'completed',
          recordingUrl: recordingUrl,
          transcript: transcriptData ? JSON.stringify(transcriptData) : data.transcript,
          updatedAt: new Date(),
        },
      });

      console.log(`Successfully processed completed meeting for bot: ${botId}`);
    } catch (error) {
      console.error('Error handling meeting completed:', error);
      throw error;
    }
  }

  /**
   * Get calendar event details
   */
  static async getCalendarEvent(eventId: string): Promise<any> {
    this.initialize();
    
    // TODO: Implement calendar event retrieval
    console.log(`Getting calendar event: ${eventId}`);
    return { eventId, message: 'Calendar event retrieval not yet implemented' };
  }

  /**
   * Create a bot for a meeting URL
   */
  static async createBot(params: {
    meetingUrl: string;
    meetingId?: string;
    userId: string;
    customBotName?: string;
  }) {
    this.initialize();
    return await this.botService.createBotWithDefaults(
      params.meetingUrl,
      params.userId,
      {
        meetingId: params.meetingId,
        customBotName: params.customBotName,
      }
    );
  }

  /**
   * End a bot session
   */
  static async endBot(botId: string): Promise<void> {
    this.initialize();
    return await this.botService.endBot(botId);
  }

  /**
   * Get bot details
   */
  static async getBot(botId: string) {
    this.initialize();
    return await this.botService.getBot(botId);
  }

  /**
   * List recent bots
   */
  static async listRecentBots(params?: any) {
    this.initialize();
    return await this.botService.listRecentBots(params);
  }

  /**
   * Setup calendar integration
   */
  static async setupCalendarIntegration(
    userId: string,
    provider: 'google' | 'microsoft',
    refreshToken: string,
    rawCalendarId?: string
  ) {
    this.initialize();
    return await this.calendarService.setupCalendarIntegration(
      userId,
      provider,
      refreshToken,
      rawCalendarId
    );
  }

  /**
   * List available calendars
   */
  static async listAvailableCalendars(
    provider: 'google' | 'microsoft',
    refreshToken: string
  ) {
    this.initialize();
    return await this.calendarService.listAvailableCalendars(provider, refreshToken);
  }

  /**
   * Get user's calendar integrations
   */
  static async getUserCalendarIntegrations(userId: string) {
    this.initialize();
    return await this.calendarService.getUserCalendarIntegrations(userId);
  }

  /**
   * Delete calendar integration
   */
  static async deleteCalendarIntegration(userId: string, provider: 'google' | 'microsoft') {
    this.initialize();
    return await this.calendarService.deleteCalendarIntegration(userId, provider);
  }

  /**
   * Schedule recording for calendar event
   */
  static async scheduleEventRecording(eventId: string, options?: any) {
    this.initialize();
    return await this.calendarService.scheduleEventRecording(eventId, options);
  }

  /**
   * Sync bot statuses
   */
  static async syncBotStatuses(): Promise<void> {
    this.initialize();
    return await this.botService.syncActiveBots();
  }

  /**
   * Sync calendar events
   */
  static async syncCalendarEvents(userId: string): Promise<void> {
    this.initialize();
    return await this.calendarService.syncCalendarEvents(userId);
  }
} 