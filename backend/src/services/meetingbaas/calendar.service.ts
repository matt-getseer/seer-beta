import { prisma } from '../../utils/prisma';
import { MeetingBaasClientService } from './client.service';
import { MeetingBaasConfig } from '../../config/meetingbaas.config';
import { CalendarIntegration } from '@prisma/client';
import type { Provider } from '@meeting-baas/sdk/dist/baas/models';

export interface CalendarMeetingData {
  title: string;
  scheduledTime: Date;
  duration: number;
  platform: 'google_meet' | 'zoom' | 'teams';
  attendees?: string[];
  description?: string;
  userId: string;
}

export interface CalendarMeetingResponse {
  id: string;
  meetingUrl: string;
  calendarEventId?: string;
  platform: string;
}

/**
 * Simplified calendar service that leverages MeetingBaas SDK
 * Focuses on high-level operations and delegates complex logic to MeetingBaas
 */
export class MeetingBaasCalendarService {
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
   * Setup calendar integration with MeetingBaas
   */
  async setupCalendarIntegration(
    userId: string,
    provider: 'google' | 'microsoft',
    refreshToken: string,
    rawCalendarId?: string,
    clientId?: string,
    clientSecret?: string
  ): Promise<CalendarIntegration> {
    try {
      console.log(`Setting up ${provider} calendar integration for user ${userId}`);

      // Create calendar integration via MeetingBaas
      const meetingBaasCalendar = await this.getClient().createCalendar({
        platform: provider as Provider,
        oauthClientId: clientId || MeetingBaasConfig.oauth[provider].clientId!,
        oauthClientSecret: clientSecret || MeetingBaasConfig.oauth[provider].clientSecret!,
        oauthRefreshToken: refreshToken,
        raw_calendar_id: rawCalendarId,
      });

      // Store integration in our database
      const calendarIntegration = await prisma.calendarIntegration.upsert({
        where: {
          userId_provider: {
            userId,
            provider,
          }
        },
        update: {
          calendarId: meetingBaasCalendar.uuid,
          externalCalendarId: rawCalendarId || 'primary',
          refreshToken,
          isActive: true,
          lastSyncedAt: new Date(),
          updatedAt: new Date(),
        },
        create: {
          userId,
          provider,
          calendarId: meetingBaasCalendar.uuid,
          externalCalendarId: rawCalendarId || 'primary',
          refreshToken,
          isActive: true,
        },
      });

      console.log(`Calendar integration created with ID: ${calendarIntegration.calendarId}`);
      return calendarIntegration;

    } catch (error) {
      console.error('Error setting up calendar integration:', error);
      throw new Error(`Failed to setup ${provider} calendar integration: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * List available calendars for a user
   */
  async listAvailableCalendars(
    provider: 'google' | 'microsoft',
    refreshToken: string,
    clientId?: string,
    clientSecret?: string
  ) {
    try {
      return await this.getClient().listRawCalendars({
        platform: provider as Provider,
        oauthClientId: clientId || MeetingBaasConfig.oauth[provider].clientId!,
        oauthClientSecret: clientSecret || MeetingBaasConfig.oauth[provider].clientSecret!,
        oauthRefreshToken: refreshToken,
      });
    } catch (error) {
      console.error('Error listing available calendars:', error);
      throw new Error(`Failed to list ${provider} calendars: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get user's calendar integrations
   */
  async getUserCalendarIntegrations(userId: string): Promise<CalendarIntegration[]> {
    return await prisma.calendarIntegration.findMany({
      where: {
        userId,
        isActive: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  /**
   * Delete calendar integration
   */
  async deleteCalendarIntegration(userId: string, provider: 'google' | 'microsoft'): Promise<void> {
    try {
      // Get the integration from our database
      const integration = await prisma.calendarIntegration.findUnique({
        where: {
          userId_provider: {
            userId,
            provider,
          },
        },
      });

      if (!integration) {
        throw new Error(`No ${provider} calendar integration found for user`);
      }

      // Delete calendar from MeetingBaas
      await this.getClient().deleteCalendar(integration.calendarId);

      // Mark as inactive in our database
      await prisma.calendarIntegration.update({
        where: {
          userId_provider: {
            userId,
            provider,
          },
        },
        data: {
          isActive: false,
          updatedAt: new Date(),
        },
      });

      console.log(`Deleted ${provider} calendar integration for user ${userId}`);
    } catch (error) {
      console.error('Error deleting calendar integration:', error);
      throw new Error(`Failed to delete ${provider} calendar integration: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Schedule recording for a calendar event
   */
  async scheduleEventRecording(
    eventId: string,
    options?: {
      allOccurrences?: boolean;
      customBotConfig?: any;
    }
  ) {
    try {
      console.log(`Scheduling recording for event ${eventId}`);

      // Prepare bot parameters with defaults from config
      const botParams = {
        botName: options?.customBotConfig?.botName || MeetingBaasConfig.bot.defaultName,
        recording_mode: options?.customBotConfig?.recording_mode || MeetingBaasConfig.bot.recordingMode,
        speech_to_text: {
          provider: MeetingBaasConfig.bot.speechToText.provider,
          api_key: MeetingBaasConfig.bot.speechToText.apiKey,
        },
        webhook_url: options?.customBotConfig?.webhook_url || MeetingBaasConfig.bot.defaultWebhookUrl,
        noone_joined_timeout: options?.customBotConfig?.noone_joined_timeout || MeetingBaasConfig.bot.automaticLeave.nooneJoinedTimeout,
        waiting_room_timeout: options?.customBotConfig?.waiting_room_timeout || MeetingBaasConfig.bot.automaticLeave.waitingRoomTimeout,
        ...options?.customBotConfig
      };

      const result = await this.getClient().scheduleRecordEvent(
        eventId,
        botParams,
        options?.allOccurrences || false
      );

      console.log(`Successfully scheduled recording for event ${eventId}`);
      return result;
    } catch (error) {
      console.error('Error scheduling event recording:', error);
      throw new Error(`Failed to schedule recording for event ${eventId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Unschedule recording for a calendar event
   */
  async unscheduleEventRecording(
    eventId: string,
    allOccurrences: boolean = false
  ) {
    try {
      console.log(`Unscheduling recording for event ${eventId}`);

      const result = await this.getClient().unscheduleRecordEvent(eventId, allOccurrences);

      console.log(`Successfully unscheduled recording for event ${eventId}`);
      return result;
    } catch (error) {
      console.error('Error unscheduling event recording:', error);
      throw new Error(`Failed to unschedule recording for event ${eventId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get calendar events with optional filtering
   */
  async getCalendarEvents(params: {
    userId?: string;
    calendarId?: string;
    organizerEmail?: string;
    attendeeEmail?: string;
    startDateGte?: string;
    startDateLte?: string;
    status?: string;
    cursor?: string;
  }) {
    try {
      // If userId is provided but no calendarId, get user's calendar integrations
      if (params.userId && !params.calendarId) {
        const integrations = await this.getUserCalendarIntegrations(params.userId);
        if (integrations.length === 0) {
          return { data: [], next: null };
        }
        // Use the first active integration
        params.calendarId = integrations[0].calendarId;
      }

      if (!params.calendarId) {
        throw new Error('Calendar ID is required');
      }

      return await this.getClient().listEvents(params.calendarId, {
        attendeeEmail: params.attendeeEmail,
        cursor: params.cursor,
        organizerEmail: params.organizerEmail,
        startDateGte: params.startDateGte,
        startDateLte: params.startDateLte,
        status: params.status,
      });
    } catch (error) {
      console.error('Error getting calendar events:', error);
      throw new Error(`Failed to get calendar events: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get specific calendar event
   */
  async getCalendarEvent(eventId: string) {
    try {
      return await this.getClient().getEvent(eventId);
    } catch (error) {
      console.error('Error getting calendar event:', error);
      throw new Error(`Failed to get calendar event ${eventId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Sync calendar events and update local database
   */
  async syncCalendarEvents(userId: string): Promise<void> {
    try {
      console.log(`Syncing calendar events for user ${userId}`);

      const integrations = await this.getUserCalendarIntegrations(userId);
      
      for (const integration of integrations) {
        try {
          // Get events from the last week to 30 days in the future
          const events = await this.getClient().listEvents(integration.calendarId, {
            startDateGte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
            startDateLte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          });

          // TODO: Process and store events in local database if needed
          // For now, we just log the sync
          console.log(`Synced ${events.data?.length || 0} events for calendar ${integration.calendarId}`);

          // Update last sync time
          await prisma.calendarIntegration.update({
            where: { id: integration.id },
            data: { lastSyncedAt: new Date() },
          });

          console.log(`Synced calendar ${integration.calendarId}`);
        } catch (error) {
          console.error(`Error syncing calendar ${integration.calendarId}:`, error);
          // Continue with other calendars even if one fails
        }
      }
    } catch (error) {
      console.error('Error syncing calendar events:', error);
      throw new Error(`Failed to sync calendar events: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Check if calendar integration is enabled
   */
  static isCalendarIntegrationEnabled(): boolean {
    return !!MeetingBaasConfig.client.apiKey;
  }

  /**
   * Auto-schedule recordings for upcoming meetings
   */
  async autoScheduleRecordings(userId: string): Promise<void> {
    if (!MeetingBaasConfig.calendar.autoScheduling) {
      console.log('Auto-scheduling is disabled');
      return;
    }

    try {
      console.log(`Auto-scheduling recordings for user ${userId}`);

      const integrations = await this.getUserCalendarIntegrations(userId);
      
      for (const integration of integrations) {
        try {
          // Get upcoming events (next 7 days)
          const events = await this.getClient().listEvents(integration.calendarId, {
            startDateGte: new Date().toISOString(),
            startDateLte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            status: 'upcoming'
          });

          for (const event of events.data || []) {
            try {
              // Check if event has a meeting URL and isn't already scheduled
              if (event.meetingUrl && !event.bot_param) {
                console.log(`Auto-scheduling recording for event: ${event.name}`);
                
                await this.scheduleEventRecording(event.uuid, {
                  allOccurrences: false,
                  customBotConfig: {
                    botName: `${MeetingBaasConfig.bot.defaultName} - ${event.name}`,
                  }
                });
                
                console.log(`✅ Auto-scheduled recording for event: ${event.name}`);
              }
            } catch (eventError) {
              console.error(`Error auto-scheduling event ${event.uuid}:`, eventError);
              // Continue with other events
            }
          }
        } catch (calendarError) {
          console.error(`Error processing calendar ${integration.calendarId}:`, calendarError);
          // Continue with other calendars
        }
      }
      
    } catch (error) {
      console.error('Error auto-scheduling recordings:', error);
      // Don't throw here as this is a background operation
    }
  }
} 