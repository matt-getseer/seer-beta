import { Request, Response } from 'express';
import { MeetingBaasCalendarService } from '../services/meetingbaas/calendar.service';
import { MeetingBaasBotService } from '../services/meetingbaas/bot.service';
import { MeetingBaasWebhookService } from '../services/meetingbaas/webhook.service';
import { prisma } from '../utils/prisma';

/**
 * Enhanced MeetingBaas controller with improved error handling and service integration
 */
export class MeetingBaasController {
  private calendarService: MeetingBaasCalendarService;
  private botService: MeetingBaasBotService;
  private webhookService: MeetingBaasWebhookService;

  constructor() {
    this.calendarService = new MeetingBaasCalendarService();
    this.botService = new MeetingBaasBotService();
    this.webhookService = new MeetingBaasWebhookService();
  }

  /**
   * Setup calendar integration
   */
  setupCalendarIntegration = async (req: Request, res: Response) => {
    try {
      const { provider, refreshToken, rawCalendarId } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      if (!provider || !refreshToken) {
        return res.status(400).json({ 
          error: 'Provider and refresh token are required' 
        });
      }

      if (!['google', 'microsoft'].includes(provider)) {
        return res.status(400).json({ 
          error: 'Provider must be either "google" or "microsoft"' 
        });
      }

      const integration = await this.calendarService.setupCalendarIntegration(
        userId,
        provider,
        refreshToken,
        rawCalendarId
      );

      res.json({
        success: true,
        message: `${provider} calendar integration setup successfully`,
        data: {
          id: integration.id,
          provider: integration.provider,
          calendarId: integration.calendarId,
          externalCalendarId: integration.externalCalendarId,
          isActive: integration.isActive,
          createdAt: integration.createdAt,
        },
      });
    } catch (error) {
      console.error('Error setting up calendar integration:', error);
      res.status(500).json({
        error: 'Failed to setup calendar integration',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  };

  /**
   * List available calendars for a provider
   */
  listAvailableCalendars = async (req: Request, res: Response) => {
    try {
      const { provider, refreshToken } = req.body;

      if (!provider || !refreshToken) {
        return res.status(400).json({ 
          error: 'Provider and refresh token are required' 
        });
      }

      if (!['google', 'microsoft'].includes(provider)) {
        return res.status(400).json({ 
          error: 'Provider must be either "google" or "microsoft"' 
        });
      }

      const calendars = await this.calendarService.listAvailableCalendars(
        provider,
        refreshToken
      );

      res.json({
        success: true,
        data: calendars,
      });
    } catch (error) {
      console.error('Error listing available calendars:', error);
      res.status(500).json({
        error: 'Failed to list available calendars',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  };

  /**
   * Get user's calendar integrations
   */
  getUserCalendarIntegrations = async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const integrations = await this.calendarService.getUserCalendarIntegrations(userId);

      res.json({
        success: true,
        data: integrations.map(integration => ({
          id: integration.id,
          provider: integration.provider,
          calendarId: integration.calendarId,
          externalCalendarId: integration.externalCalendarId,
          isActive: integration.isActive,
          lastSyncedAt: integration.lastSyncedAt,
          createdAt: integration.createdAt,
        })),
      });
    } catch (error) {
      console.error('Error getting user calendar integrations:', error);
      res.status(500).json({
        error: 'Failed to get calendar integrations',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  };

  /**
   * Delete calendar integration
   */
  deleteCalendarIntegration = async (req: Request, res: Response) => {
    try {
      const { provider } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      if (!['google', 'microsoft'].includes(provider)) {
        return res.status(400).json({ 
          error: 'Provider must be either "google" or "microsoft"' 
        });
      }

      await this.calendarService.deleteCalendarIntegration(userId, provider as 'google' | 'microsoft');

      res.json({
        success: true,
        message: `${provider} calendar integration deleted successfully`,
      });
    } catch (error) {
      console.error('Error deleting calendar integration:', error);
      res.status(500).json({
        error: 'Failed to delete calendar integration',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  };

  /**
   * Get calendar events
   */
  getCalendarEvents = async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id;
      const { 
        calendarId, 
        organizerEmail, 
        attendeeEmail, 
        startDateGte, 
        startDateLte, 
        status, 
        cursor 
      } = req.query;

      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const events = await this.calendarService.getCalendarEvents({
        userId,
        calendarId: calendarId as string,
        organizerEmail: organizerEmail as string,
        attendeeEmail: attendeeEmail as string,
        startDateGte: startDateGte as string,
        startDateLte: startDateLte as string,
        status: status as string,
        cursor: cursor as string,
      });

      res.json({
        success: true,
        data: events.data || [],
        next: events.next || null,
      });
    } catch (error) {
      console.error('Error getting calendar events:', error);
      res.status(500).json({
        error: 'Failed to get calendar events',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  };

  /**
   * Schedule recording for calendar event
   */
  scheduleEventRecording = async (req: Request, res: Response) => {
    try {
      const { eventId } = req.params;
      const { allOccurrences, customBotConfig } = req.body;

      if (!eventId) {
        return res.status(400).json({ error: 'Event ID is required' });
      }

      const result = await this.calendarService.scheduleEventRecording(eventId, {
        allOccurrences,
        customBotConfig,
      });

      res.json({
        success: true,
        message: 'Recording scheduled successfully',
        data: result,
      });
    } catch (error) {
      console.error('Error scheduling event recording:', error);
      res.status(500).json({
        error: 'Failed to schedule event recording',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  };

  /**
   * Unschedule recording for calendar event
   */
  unscheduleEventRecording = async (req: Request, res: Response) => {
    try {
      const { eventId } = req.params;
      const { allOccurrences } = req.body;

      if (!eventId) {
        return res.status(400).json({ error: 'Event ID is required' });
      }

      const result = await this.calendarService.unscheduleEventRecording(
        eventId, 
        allOccurrences || false
      );

      res.json({
        success: true,
        message: 'Recording unscheduled successfully',
        data: result,
      });
    } catch (error) {
      console.error('Error unscheduling event recording:', error);
      res.status(500).json({
        error: 'Failed to unschedule event recording',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  };

  /**
   * Create bot for meeting URL
   */
  createBot = async (req: Request, res: Response) => {
    try {
      const { meetingUrl, meetingId, customBotName, customWebhookUrl } = req.body;
      const userId = req.user?.id;
      const teamMemberId = req.user?.id; // Assuming user is the team member

      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      if (!meetingUrl) {
        return res.status(400).json({ error: 'Meeting URL is required' });
      }

      const result = await this.botService.createBotWithDefaults(meetingUrl, userId, {
        meetingId,
        teamMemberId,
        customBotName,
        customWebhookUrl,
      });

      res.json({
        success: true,
        message: 'Bot created successfully',
        data: result,
      });
    } catch (error) {
      console.error('Error creating bot:', error);
      res.status(500).json({
        error: 'Failed to create bot',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  };

  /**
   * Get bot details
   */
  getBot = async (req: Request, res: Response) => {
    try {
      const { botId } = req.params;

      if (!botId) {
        return res.status(400).json({ error: 'Bot ID is required' });
      }

      const bot = await this.botService.getBot(botId);

      res.json({
        success: true,
        data: bot,
      });
    } catch (error) {
      console.error('Error getting bot:', error);
      res.status(500).json({
        error: 'Failed to get bot details',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  };

  /**
   * End bot session
   */
  endBot = async (req: Request, res: Response) => {
    try {
      const { botId } = req.params;

      if (!botId) {
        return res.status(400).json({ error: 'Bot ID is required' });
      }

      await this.botService.endBot(botId);

      res.json({
        success: true,
        message: 'Bot session ended successfully',
      });
    } catch (error) {
      console.error('Error ending bot:', error);
      res.status(500).json({
        error: 'Failed to end bot session',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  };

  /**
   * List recent bots
   */
  listRecentBots = async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id;
      const { limit, cursor, botName, meetingUrl, createdAfter, createdBefore } = req.query;

      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const bots = await this.botService.listRecentBots({
        userId,
        limit: limit ? parseInt(limit as string) : undefined,
        cursor: cursor as string,
        botName: botName as string,
        meetingUrl: meetingUrl as string,
        createdAfter: createdAfter as string,
        createdBefore: createdBefore as string,
      });

      res.json({
        success: true,
        data: bots.recentBots || [],
        next: bots.next_cursor || null,
      });
    } catch (error) {
      console.error('Error listing recent bots:', error);
      res.status(500).json({
        error: 'Failed to list recent bots',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  };

  /**
   * Retranscribe bot recording
   */
  retranscribeBot = async (req: Request, res: Response) => {
    try {
      const { botId } = req.params;
      const { speechToText, webhookUrl } = req.body;

      if (!botId) {
        return res.status(400).json({ error: 'Bot ID is required' });
      }

      await this.botService.retranscribeBot(botId, {
        speechToText,
        webhookUrl,
      });

      res.json({
        success: true,
        message: 'Bot retranscription started successfully',
      });
    } catch (error) {
      console.error('Error retranscribing bot:', error);
      res.status(500).json({
        error: 'Failed to retranscribe bot',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  };

  /**
   * Sync calendar events
   */
  syncCalendarEvents = async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      await this.calendarService.syncCalendarEvents(userId);

      res.json({
        success: true,
        message: 'Calendar events synced successfully',
      });
    } catch (error) {
      console.error('Error syncing calendar events:', error);
      res.status(500).json({
        error: 'Failed to sync calendar events',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  };

  /**
   * Auto-schedule recordings
   */
  autoScheduleRecordings = async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      await this.calendarService.autoScheduleRecordings(userId);

      res.json({
        success: true,
        message: 'Auto-scheduling completed',
      });
    } catch (error) {
      console.error('Error auto-scheduling recordings:', error);
      res.status(500).json({
        error: 'Failed to auto-schedule recordings',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  };

  /**
   * Handle webhook events
   */
  handleWebhook = async (req: Request, res: Response) => {
    try {
      const signature = req.headers['x-meetingbaas-signature'] as string;
      const rawBody = JSON.stringify(req.body);
      const event = req.body;

      if (!event.event_type || !event.bot_id) {
        return res.status(400).json({ 
          error: 'Invalid webhook payload: missing event_type or bot_id' 
        });
      }

      const result = await this.webhookService.processWithRetry(
        event,
        rawBody,
        signature
      );

      if (result.success) {
        res.json({
          success: true,
          message: result.message,
          processed: result.processed,
        });
      } else {
        res.status(400).json({
          error: result.message,
          processed: result.processed,
        });
      }
    } catch (error) {
      console.error('Error handling webhook:', error);
      res.status(500).json({
        error: 'Failed to process webhook',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  };
} 