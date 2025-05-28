import axios from 'axios';
import { prisma } from '../utils/prisma';
import { CalendarIntegration } from '@prisma/client';
import axiosRetry from 'axios-retry';
import { PrismaClient } from '@prisma/client';

const prismaClient = new PrismaClient();

// Configure axios retry for better reliability
axiosRetry(axios, { 
  retries: 3, 
  retryDelay: axiosRetry.exponentialDelay,
  retryCondition: (error) => {
    return axiosRetry.isNetworkOrIdempotentRequestError(error) || error.response?.status === 429;
  }
});

interface CalendarIntegrationData {
  provider: 'google' | 'microsoft';
  refreshToken: string;
  clientId?: string;
  clientSecret?: string;
  rawCalendarId?: string;
}

interface MeetingBaasCalendarResponse {
  calendar: {
    id?: string;
    uuid?: string;
    google_id?: string;
    name: string;
    email: string;
    resource_id?: string;
    provider?: string;
    status?: string;
    created_at?: string;
    raw_calendar_id?: string;
    calendar_name?: string;
  };
}

interface CalendarMeetingData {
  title: string;
  scheduledTime: Date;
  duration: number;
  platform: 'google_meet' | 'zoom' | 'teams';
  attendees?: string[];
  description?: string;
  userId: string;
}

interface CalendarMeetingResponse {
  id: string;
  googleMeetLink: string;
  calendarEventId?: string;
}

export class CalendarService {
  private static readonly MEETINGBAAS_API_URL = process.env.MEETINGBAAS_API_URL || 'https://api.meetingbaas.com';
  private static readonly API_KEY = process.env.MEETINGBAAS_API_KEY;
  private static readonly CALENDAR_ENABLED = process.env.MEETINGBAAS_CALENDAR_ENABLED === 'true';
  private static readonly GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
  private static readonly GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

  /**
   * Setup calendar integration with MeetingBaas using proper API
   */
  static async setupCalendarIntegration(
    userId: string, 
    integrationData: CalendarIntegrationData
  ): Promise<CalendarIntegration> {
    try {
      if (!this.CALENDAR_ENABLED) {
        throw new Error('MeetingBaas calendar integration is not enabled');
      }

      if (!this.API_KEY) {
        throw new Error('MeetingBaas API key is not configured');
      }

      console.log(`Setting up ${integrationData.provider} calendar integration for user ${userId}`);

      // Use environment credentials if not provided
      const clientId = integrationData.clientId || this.GOOGLE_CLIENT_ID;
      const clientSecret = integrationData.clientSecret || this.GOOGLE_CLIENT_SECRET;

      if (!clientId || !clientSecret) {
        throw new Error(`${integrationData.provider} OAuth credentials not configured`);
      }

      // Call MeetingBaas API to setup calendar integration using the correct field names
      const response = await axios.post(
        `${this.MEETINGBAAS_API_URL}/calendars`,
        {
          platform: integrationData.provider === 'google' ? 'Google' : 'Microsoft',
          oauth_refresh_token: integrationData.refreshToken,
          oauth_client_id: clientId,
          oauth_client_secret: clientSecret,
          raw_calendar_id: integrationData.rawCalendarId // Optional - defaults to primary calendar
        },
        {
          headers: {
            'x-meeting-baas-api-key': this.API_KEY,
            'Content-Type': 'application/json'
          }
        }
      );

      const meetingBaasCalendar: MeetingBaasCalendarResponse = response.data;
      
      console.log('MeetingBaas calendar integration created:', meetingBaasCalendar);
      console.log('Calendar status received:', meetingBaasCalendar.calendar.status);

      // Get the calendar ID from the response (could be 'id' or 'uuid')
      const calendarId = meetingBaasCalendar.calendar.id || meetingBaasCalendar.calendar.uuid;
      
      if (!calendarId) {
        throw new Error('MeetingBaas API response missing calendar ID/UUID');
      }

      // Determine if calendar is active - be more permissive with status values
      // Only set to false if explicitly 'error' or 'disconnected', otherwise assume active
      const calendarStatus = meetingBaasCalendar.calendar.status?.toLowerCase();
      const isCalendarActive = calendarStatus !== 'error' && calendarStatus !== 'disconnected';
      
      console.log(`Calendar status: ${calendarStatus}, setting isActive to: ${isCalendarActive}`);

      // Store the integration in our database with the real MeetingBaas calendar ID
      const calendarIntegration = await prismaClient.calendarIntegration.upsert({
        where: {
          userId_provider: {
            userId,
            provider: integrationData.provider
          }
        },
        update: {
          calendarId: calendarId, // Use the MeetingBaas calendar ID
          externalCalendarId: meetingBaasCalendar.calendar.raw_calendar_id || 'primary',
          refreshToken: integrationData.refreshToken,
          isActive: isCalendarActive,
          lastSyncedAt: new Date(),
          updatedAt: new Date()
        },
        create: {
          userId,
          provider: integrationData.provider,
          calendarId: calendarId, // Use the MeetingBaas calendar ID
          externalCalendarId: meetingBaasCalendar.calendar.raw_calendar_id || 'primary',
          refreshToken: integrationData.refreshToken,
          isActive: isCalendarActive
        }
      });

      return calendarIntegration;

    } catch (error: any) {
      console.error('Error setting up calendar integration:', error.response?.data || error.message);
      throw new Error(`Failed to setup calendar integration: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Create a calendar meeting with proper MeetingBaas integration
   */
  static async createCalendarMeeting(
    userId: string,
    meetingData: CalendarMeetingData,
    calendarProvider: 'google' | 'microsoft' = 'google'
  ): Promise<CalendarMeetingResponse> {
    try {
      if (!this.CALENDAR_ENABLED) {
        throw new Error('MeetingBaas calendar integration is not enabled');
      }

      console.log(`Creating calendar meeting for user ${userId} on ${calendarProvider}`);

      // Get the user's calendar integration
      let calendarIntegration = await prismaClient.calendarIntegration.findFirst({
        where: {
          userId,
          provider: calendarProvider,
          isActive: true
        }
      });

      // If no integration found for this user, try to find any active integration
      if (!calendarIntegration) {
        console.log(`No ${calendarProvider} integration found for user ${userId}, checking for any active integration`);
        calendarIntegration = await prismaClient.calendarIntegration.findFirst({
          where: {
            provider: calendarProvider,
            isActive: true
          }
        });
      }

      if (!calendarIntegration) {
        throw new Error(`No active ${calendarProvider} calendar integration found. Please setup calendar integration first.`);
      }

      console.log(`Using calendar integration: ${calendarIntegration.calendarId}`);

      // Step 1: Check if there are any events around the scheduled time
      const eventSearchResponse = await axios.get(
        `${this.MEETINGBAAS_API_URL}/calendar_events`,
        {
          headers: {
            'x-meeting-baas-api-key': this.API_KEY,
            'Content-Type': 'application/json'
          },
          params: {
            calendar_id: calendarIntegration.calendarId,
            start_date_gte: meetingData.scheduledTime.toISOString(),
            start_date_lte: new Date(meetingData.scheduledTime.getTime() + (meetingData.duration * 60000)).toISOString(),
            status: 'upcoming'
          }
        }
      );

      const events = eventSearchResponse.data.events || [];
      console.log(`Found ${events.length} events in the time window`);

      // Step 2: Look for an event that matches our meeting
      let targetEvent = events.find((event: any) => 
        event.title?.toLowerCase().includes(meetingData.title.toLowerCase()) ||
        event.summary?.toLowerCase().includes(meetingData.title.toLowerCase())
      );

      let meetingResponse: { id: string; googleMeetLink: string; calendarEventId: string };

      if (targetEvent && targetEvent.meeting_url) {
        console.log(`Found matching calendar event with meeting URL: ${targetEvent.meeting_url}`);
        
        // Step 3: Send bot to the existing meeting
        const botResponse = await this.sendBotToMeeting(targetEvent.meeting_url, meetingData.title);
        
        meetingResponse = {
          id: botResponse.id,
          googleMeetLink: targetEvent.meeting_url,
          calendarEventId: targetEvent.id
        };
      } else {
        console.log('No matching calendar event found, creating new calendar event through MeetingBaas');
        
        // Step 3: Create a new calendar event through MeetingBaas
        const newEventResponse = await this.createCalendarEventWithBot(calendarIntegration.calendarId, meetingData);
        
        meetingResponse = {
          id: newEventResponse.id,
          googleMeetLink: newEventResponse.googleMeetLink,
          calendarEventId: newEventResponse.calendarEventId
        };
      }

      return meetingResponse;

    } catch (error: any) {
      console.error('Error creating calendar meeting:', error.response?.data || error.message);
      throw new Error(`Failed to create calendar meeting: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Send bot to an existing meeting using correct authentication
   */
  private static async sendBotToMeeting(meetingUrl: string, meetingTitle: string): Promise<{ id: string }> {
    try {
      const botPayload = {
        meeting_url: meetingUrl,
        bot_name: "AI Notetaker",
        recording_mode: "speaker_view",
        entry_message: "I am here to record and transcribe this meeting.",
        reserved: false,
        speech_to_text: {
          provider: "Default"
        },
        automatic_leave: {
          waiting_room_timeout: 600
        },
        extra: {
          source: "direct_meeting",
          meeting_title: meetingTitle
        }
      };

      console.log('Sending bot to meeting:', meetingUrl);

      const response = await axios.post(
        `${this.MEETINGBAAS_API_URL}/bots`,
        botPayload,
        {
          headers: {
            'x-meeting-baas-api-key': this.API_KEY, // Bot API uses x-meeting-baas-api-key
            'Content-Type': 'application/json'
          }
        }
      );

      console.log('Bot sent successfully:', response.data);
      return response.data;

    } catch (error: any) {
      console.error('Error sending bot to meeting:', error.response?.data || error.message);
      throw new Error(`Failed to send bot to meeting: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * List raw calendars for a user (useful for setup)
   */
  static async listRawCalendars(
    provider: 'google' | 'microsoft',
    refreshToken: string,
    clientId?: string,
    clientSecret?: string
  ): Promise<any[]> {
    try {
      if (!this.API_KEY) {
        throw new Error('MeetingBaas API key is not configured');
      }

      const actualClientId = clientId || this.GOOGLE_CLIENT_ID;
      const actualClientSecret = clientSecret || this.GOOGLE_CLIENT_SECRET;

      if (!actualClientId || !actualClientSecret) {
        throw new Error(`${provider} OAuth credentials not configured`);
      }

      const response = await axios.post(
        `${this.MEETINGBAAS_API_URL}/calendars/raw`,
        {
          platform: provider === 'google' ? 'Google' : 'Microsoft',
          oauth_refresh_token: refreshToken,
          oauth_client_id: actualClientId,
          oauth_client_secret: actualClientSecret
        },
        {
          headers: {
            'x-meeting-baas-api-key': this.API_KEY,
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data.calendars || [];

    } catch (error: any) {
      console.error('Error listing raw calendars:', error.response?.data || error.message);
      throw new Error(`Failed to list calendars: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Delete calendar integration from MeetingBaas
   */
  static async deleteCalendarIntegration(calendarId: string): Promise<void> {
    try {
      if (!this.CALENDAR_ENABLED) {
        console.log('MeetingBaas calendar integration is not enabled, skipping deletion');
        return;
      }

      if (!this.API_KEY) {
        throw new Error('MeetingBaas API key is not configured');
      }

      console.log(`Deleting calendar integration from MeetingBaas: ${calendarId}`);

      // Call MeetingBaas API to delete the calendar integration
      await axios.delete(
        `${this.MEETINGBAAS_API_URL}/calendars/${calendarId}`,
        {
          headers: {
            'x-meeting-baas-api-key': this.API_KEY,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log(`✅ Successfully deleted calendar integration from MeetingBaas: ${calendarId}`);

    } catch (error: any) {
      console.error('Error deleting calendar integration from MeetingBaas:', error.response?.data || error.message);
      
      // Don't throw error if calendar doesn't exist (404) - it might have been already deleted
      if (error.response?.status === 404) {
        console.log(`Calendar ${calendarId} not found in MeetingBaas (already deleted)`);
        return;
      }
      
      throw new Error(`Failed to delete calendar integration from MeetingBaas: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Handle calendar webhook events
   */
  static async handleCalendarWebhook(webhookData: any): Promise<void> {
    try {
      console.log('Processing calendar webhook:', JSON.stringify(webhookData, null, 2));

      const { event_type, data } = webhookData;

      switch (event_type) {
        case 'calendar.sync_events':
          await this.handleSyncEvents(data);
          break;
        case 'calendar.event_created':
          await this.handleEventCreated(data);
          break;
        case 'calendar.event_updated':
          await this.handleEventUpdated(data);
          break;
        case 'calendar.event_deleted':
          await this.handleEventDeleted(data);
          break;
        default:
          console.log(`Unknown calendar webhook event type: ${event_type}`);
      }

    } catch (error: any) {
      console.error('Error handling calendar webhook:', error.message);
      throw error;
    }
  }

  /**
   * Handle sync events webhook
   */
  private static async handleSyncEvents(data: any): Promise<void> {
    const { calendar_id, affected_event_uuids } = data;

    if (!Array.isArray(affected_event_uuids) || affected_event_uuids.length === 0) {
      console.log('No affected events in sync webhook');
      return;
    }

    // Check if this calendar belongs to any of our users
    const calendarIntegration = await prismaClient.calendarIntegration.findFirst({
      where: {
        calendarId: calendar_id,
        isActive: true
      }
    });

    if (!calendarIntegration) {
      console.log(`Ignoring sync events for calendar ${calendar_id} - not associated with any active user`);
      return;
    }

    console.log(`Processing ${affected_event_uuids.length} affected events from sync for calendar ${calendar_id}`);

    // Process each synced event
    for (const eventUuid of affected_event_uuids) {
      try {
        await this.processSyncedEvent(calendar_id, eventUuid, calendarIntegration.userId);
      } catch (error) {
        console.error(`Error processing synced event ${eventUuid}:`, error);
      }
    }
  }

  /**
   * Process a single synced event from MeetingBaas
   */
  private static async processSyncedEvent(calendarId: string, eventUuid: string, userId: string): Promise<void> {
    try {
      console.log(`Processing synced event: ${eventUuid} for calendar ${calendarId}`);

      // Get the event details from MeetingBaas
      const response = await axios.get(
        `${this.MEETINGBAAS_API_URL}/calendar_events/${eventUuid}`,
        {
          headers: {
            'x-meeting-baas-api-key': this.API_KEY,
            'Content-Type': 'application/json'
          }
        }
      );

      const event = response.data;
      console.log(`Full event response:`, JSON.stringify(event, null, 2));
      
      // Use the correct field names from MeetingBaas API
      const eventTitle = event.name || event.title || event.summary;
      const isDeleted = event.deleted === true;
      const hasStartTime = !!event.start_time;
      const isUpcoming = hasStartTime && new Date(event.start_time) > new Date() && !isDeleted;
      
      console.log(`Retrieved event details: ${eventTitle} at ${event.start_time}`);
      console.log(`Event status: deleted=${isDeleted}, upcoming=${isUpcoming}, has_meeting_url=${!!event.meeting_url}`);

      // Check if this event has a meeting URL and is upcoming
      if (!event.meeting_url || !isUpcoming) {
        console.log(`Skipping event ${eventUuid} - no meeting URL (${!!event.meeting_url}) or not upcoming (upcoming: ${isUpcoming})`);
        return;
      }

      // Check if we already have a meeting record for this event
      const existingMeeting = await prismaClient.meeting.findFirst({
        where: {
          OR: [
            { meetingBaasId: eventUuid },
            { calendarEventId: event.google_id || event.raw?.id }
          ]
        }
      });

      if (existingMeeting) {
        console.log(`Meeting already exists for event ${eventUuid}, updating MeetingBaas ID if needed`);
        
        // Update the meeting with the MeetingBaas event UUID if it's missing
        if (!existingMeeting.meetingBaasId) {
          await prismaClient.meeting.update({
            where: { id: existingMeeting.id },
            data: { 
              meetingBaasId: eventUuid,
              meetingBaasCalendarId: calendarId,
              lastSyncedAt: new Date()
            }
          });
          console.log(`Updated meeting ${existingMeeting.id} with MeetingBaas ID ${eventUuid}`);
        }

        // Schedule a bot for this event if not already scheduled
        await this.scheduleOrUpdateBotForEvent(eventUuid, event);
        return;
      }

      // This is a new event that we don't have a meeting record for
      // This could be an event created outside our system
      console.log(`New external event detected: ${eventTitle} - not creating meeting record`);

    } catch (error: any) {
      console.error(`Error processing synced event ${eventUuid}:`, error.response?.data || error.message);
    }
  }

  /**
   * Schedule or update a bot for a MeetingBaas event
   */
  private static async scheduleOrUpdateBotForEvent(eventUuid: string, event: any): Promise<void> {
    try {
      // Check if a bot is already scheduled for this event
      // MeetingBaas API uses 'bot_param' field to indicate if a bot is scheduled
      if (event.bot_param) {
        console.log(`Bot already scheduled for event ${eventUuid}: bot_param exists`);
        return;
      }

      console.log(`No bot scheduled for event ${eventUuid}, scheduling new bot...`);

      // Schedule a bot for this event
      const botConfig = {
        bot_name: "AI Notetaker",
        recording_mode: "speaker_view",
        entry_message: "Hi everyone! I'm Seer, I'll be taking notes and will provide a summary after the meeting.",
        speech_to_text: {
          provider: "Default"
        },
        automatic_leave: {
          waiting_room_timeout: 600
        },
        extra: {
          source: "calendar_sync",
          event_uuid: eventUuid
        }
      };

      const botResponse = await this.scheduleBotForEvent(eventUuid, botConfig);
      
      // The response is an array of events with bot parameters attached
      if (Array.isArray(botResponse) && botResponse.length > 0) {
        const updatedEvent = botResponse[0];
        console.log(`Bot scheduled for synced event ${eventUuid}: bot parameters attached to event`);
        console.log('Bot config:', updatedEvent.bot_param ? 'Present' : 'Missing');
      } else if (botResponse && typeof botResponse === 'object') {
        // Single event response
        console.log(`Bot scheduled for synced event ${eventUuid}: bot parameters attached to event`);
        console.log('Bot config:', botResponse.bot_param ? 'Present' : 'Missing');
      } else {
        console.log(`Bot scheduled for synced event ${eventUuid}: response received`);
      }

    } catch (error: any) {
      console.error(`Error scheduling bot for event ${eventUuid}:`, error.response?.data || error.message);
    }
  }

  /**
   * Handle event created webhook
   */
  private static async handleEventCreated(data: any): Promise<void> {
    console.log('Calendar event created:', data);
    // Implementation for handling new calendar events
  }

  /**
   * Handle event updated webhook
   */
  private static async handleEventUpdated(data: any): Promise<void> {
    try {
      console.log('Calendar event updated:', data);
      
      const eventId = data.uuid || data.id || data.event_id;
      const title = data.title || data.summary;
      const startTime = data.start_time || data.start?.dateTime;
      const duration = data.duration;
      const meetingUrl = data.meeting_url;
      
      if (!eventId) {
        console.warn('No event ID found in calendar.event_updated data');
        return;
      }
      
      console.log(`Calendar event updated: ${eventId} - ${title} at ${startTime}`);
      
      // Find the meeting in our database by calendar event ID or MeetingBaas event ID
      const meeting = await prismaClient.meeting.findFirst({
        where: {
          OR: [
            { calendarEventId: eventId },
            { meetingBaasId: eventId }
          ]
        }
      });
      
      if (meeting) {
        console.log(`Found meeting ${meeting.id} for updated calendar event ${eventId}`);
        
        // Check if this is a time/date change that requires bot rescheduling
        const hasTimeChange = startTime && new Date(startTime).getTime() !== meeting.date.getTime();
        const hasDurationChange = duration && duration !== meeting.duration;
        
        if (hasTimeChange || hasDurationChange) {
          console.log(`Time/duration change detected for meeting ${meeting.id}, rescheduling bot...`);
          
          try {
            // If the meeting has a MeetingBaas bot, we need to reschedule it
            if (meeting.meetingBaasId) {
              await this.rescheduleMeetingBot(meeting, {
                eventId,
                title,
                startTime: startTime ? new Date(startTime) : meeting.date,
                duration: duration || meeting.duration,
                meetingUrl
              });
            }
          } catch (rescheduleError) {
            console.error(`Error rescheduling bot for meeting ${meeting.id}:`, rescheduleError);
            // Continue with database update even if bot rescheduling fails
          }
        }
        
        // Update the meeting in our database
        const updateData: any = {
          lastSyncedAt: new Date()
        };
        
        if (title && title !== meeting.title) {
          updateData.title = title;
        }
        
        if (startTime) {
          const newDate = new Date(startTime);
          if (newDate.getTime() !== meeting.date.getTime()) {
            updateData.date = newDate;
          }
        }
        
        if (duration && duration !== meeting.duration) {
          updateData.duration = duration;
        }
        
        if (meetingUrl && meetingUrl !== meeting.platformMeetingUrl) {
          updateData.platformMeetingUrl = meetingUrl;
        }
        
        // Update the meeting if there are changes
        if (Object.keys(updateData).length > 1) { // More than just lastSyncedAt
          await prismaClient.meeting.update({
            where: { id: meeting.id },
            data: updateData
          });
          
          console.log(`Updated meeting ${meeting.id} from calendar event update`);
        } else {
          // Just update the sync time
          await prismaClient.meeting.update({
            where: { id: meeting.id },
            data: { lastSyncedAt: new Date() }
          });
        }
      } else {
        console.log(`No meeting found for updated calendar event ${eventId}`);
      }
      
    } catch (error) {
      console.error('Error handling calendar event update:', error);
      throw error;
    }
  }

  /**
   * Reschedule a MeetingBaas bot when calendar event changes
   */
  private static async rescheduleMeetingBot(meeting: any, eventData: {
    eventId: string;
    title?: string;
    startTime: Date;
    duration: number;
    meetingUrl?: string;
  }): Promise<void> {
    try {
      console.log(`Rescheduling bot for meeting ${meeting.id} (MeetingBaas ID: ${meeting.meetingBaasId})`);
      
      // Get the calendar integration for this meeting
      const calendarIntegration = await prismaClient.calendarIntegration.findFirst({
        where: {
          userId: meeting.createdBy,
          isActive: true
        }
      });
      
      if (!calendarIntegration) {
        console.warn(`No active calendar integration found for user ${meeting.createdBy}`);
        return;
      }
      
      // Use the MeetingBaas calendar API to update the bot for this event
      // First, try to unschedule the existing bot
      try {
        await axios.delete(
          `${this.MEETINGBAAS_API_URL}/calendar_events/${eventData.eventId}/bot`,
          {
            headers: {
              'x-meeting-baas-api-key': this.API_KEY,
              'Content-Type': 'application/json'
            }
          }
        );
        console.log(`Unscheduled existing bot for calendar event ${eventData.eventId}`);
      } catch (unscheduleError: any) {
        // If unscheduling fails, it might be because no bot was scheduled
        console.warn(`Could not unschedule bot for event ${eventData.eventId}:`, unscheduleError.response?.data || unscheduleError.message);
      }
      
      // Now schedule a new bot with the updated time
      const botConfig = {
        bot_name: "AI Notetaker",
        recording_mode: "gallery_view",
        entry_message: "Hi everyone! I'm Seer, I'll be taking notes and will provide a summary after the meeting.",
        speech_to_text: {
          provider: "Default"
        },
        automatic_leave: {
          waiting_room_timeout: 600
        },
        extra: {
          source: "calendar_sync",
        }
      };
      
      const response = await axios.post(
        `${this.MEETINGBAAS_API_URL}/calendar_events/${eventData.eventId}/bot`,
        botConfig,
        {
          headers: {
            'x-meeting-baas-api-key': this.API_KEY,
            'Content-Type': 'application/json'
          }
        }
      );
      
      console.log(`Successfully rescheduled bot for calendar event ${eventData.eventId}:`, response.data);
      
    } catch (error: any) {
      console.error(`Error rescheduling bot for meeting ${meeting.id}:`, error.response?.data || error.message);
      throw new Error(`Failed to reschedule bot: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Handle event deleted webhook
   */
  private static async handleEventDeleted(data: any): Promise<void> {
    console.log('Calendar event deleted:', data);
    // Implementation for handling deleted calendar events
  }

  /**
   * Check if calendar integration is enabled
   */
  static isCalendarIntegrationEnabled(): boolean {
    return this.CALENDAR_ENABLED;
  }

  /**
   * Create a new calendar event with bot through proper Google Calendar + MeetingBaas flow
   */
  private static async createCalendarEventWithBot(calendarId: string, meetingData: CalendarMeetingData): Promise<{ id: string; googleMeetLink: string; calendarEventId: string }> {
    try {
      console.log(`Creating new calendar event for calendar ${calendarId}`);
      
      // Calculate end time
      const endTime = new Date(meetingData.scheduledTime);
      endTime.setMinutes(endTime.getMinutes() + meetingData.duration);
      
      // Get calendar integration to get OAuth tokens
      const calendarIntegration = await prismaClient.calendarIntegration.findFirst({
        where: {
          calendarId: calendarId,
          isActive: true
        }
      });

      if (!calendarIntegration) {
        throw new Error(`Calendar integration not found for calendar ${calendarId}`);
      }

      if (!calendarIntegration.refreshToken) {
        throw new Error(`Calendar integration missing refresh token for calendar ${calendarId}`);
      }

      // Step 1: Create the calendar event directly through Google Calendar API
      const googleCalendarEvent = await this.createGoogleCalendarEvent(
        calendarIntegration.refreshToken,
        calendarIntegration.externalCalendarId,
        {
          title: meetingData.title,
          startTime: meetingData.scheduledTime,
          endTime: endTime,
          attendees: meetingData.attendees || [],
          description: meetingData.description || ''
        }
      );

      console.log('Google Calendar event created:', googleCalendarEvent.id);

      // Step 2: Wait for MeetingBaas to sync the event via webhook
      // The webhook will automatically schedule a bot for the event
      console.log('Waiting for MeetingBaas to sync the new event via webhook...');
      
      // Return immediately with the Google Calendar event details
      // The webhook will handle bot scheduling asynchronously
      const meetingUrl = googleCalendarEvent.hangoutLink || googleCalendarEvent.conferenceData?.entryPoints?.[0]?.uri || '';
      
      return {
        id: googleCalendarEvent.id, // Use Google Calendar ID initially, webhook will update with MeetingBaas UUID
        googleMeetLink: meetingUrl,
        calendarEventId: googleCalendarEvent.id
      };

    } catch (error: any) {
      console.error('Error creating calendar event with bot:', error.response?.data || error.message);
      throw new Error(`Failed to create calendar event with bot: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Create a Google Calendar event directly using Google Calendar API
   */
  private static async createGoogleCalendarEvent(
    refreshToken: string,
    calendarId: string,
    eventData: {
      title: string;
      startTime: Date;
      endTime: Date;
      attendees: string[];
      description: string;
    }
  ): Promise<any> {
    try {
      // Get access token from refresh token
      const accessToken = await this.getGoogleAccessToken(refreshToken);

      console.log(`Creating Google Calendar event with ${eventData.attendees.length} attendees:`, eventData.attendees);

      const eventPayload = {
        summary: eventData.title,
        description: eventData.description,
        start: {
          dateTime: eventData.startTime.toISOString(),
          timeZone: 'UTC'
        },
        end: {
          dateTime: eventData.endTime.toISOString(),
          timeZone: 'UTC'
        },
        attendees: eventData.attendees.map(email => ({ 
          email,
          responseStatus: 'needsAction' // Explicitly set response status
        })),
        conferenceData: {
          createRequest: {
            requestId: `meeting-${Date.now()}`,
            conferenceSolutionKey: {
              type: 'hangoutsMeet'
            }
          }
        },
        reminders: {
          useDefault: true
        },
        guestsCanInviteOthers: false,
        guestsCanModify: false,
        guestsCanSeeOtherGuests: true
      };

      const response = await axios.post(
        `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events?conferenceDataVersion=1&sendUpdates=all`,
        eventPayload,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log('Google Calendar event created successfully:', {
        id: response.data.id,
        attendees: response.data.attendees?.length || 0,
        hangoutLink: response.data.hangoutLink,
        htmlLink: response.data.htmlLink
      });

      if (response.data.attendees) {
        console.log('Attendees added to event:', response.data.attendees.map((a: any) => ({ email: a.email, status: a.responseStatus })));
      }

      return response.data;
    } catch (error: any) {
      console.error('Error creating Google Calendar event:', error.response?.data || error.message);
      throw new Error(`Failed to create Google Calendar event: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Get Google access token from refresh token
   */
  private static async getGoogleAccessToken(refreshToken: string): Promise<string> {
    try {
      const response = await axios.post('https://oauth2.googleapis.com/token', {
        client_id: this.GOOGLE_CLIENT_ID,
        client_secret: this.GOOGLE_CLIENT_SECRET,
        refresh_token: refreshToken,
        grant_type: 'refresh_token'
      });

      return response.data.access_token;
    } catch (error: any) {
      console.error('Error getting Google access token:', error.response?.data || error.message);
      throw new Error(`Failed to get Google access token: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Find a MeetingBaas event by Google Calendar event ID
   */
  private static async findMeetingBaasEvent(calendarId: string, googleEventId: string): Promise<any> {
    try {
      console.log(`Searching for Google Calendar event ${googleEventId} in MeetingBaas calendar ${calendarId}`);
      
      const response = await axios.get(
        `${this.MEETINGBAAS_API_URL}/calendar_events`,
        {
          headers: {
            'x-meeting-baas-api-key': this.API_KEY,
            'Content-Type': 'application/json'
          },
          params: {
            calendar_id: calendarId,
            status: 'upcoming'
          }
        }
      );

      const events = response.data.events || [];
      console.log(`Found ${events.length} events in MeetingBaas calendar ${calendarId}`);
      
      // Log all events for debugging
      events.forEach((event: any, index: number) => {
        console.log(`Event ${index + 1}:`, {
          uuid: event.uuid,
          title: event.title,
          summary: event.summary,
          external_id: event.external_id,
          raw_calendar_data_id: event.raw_calendar_data?.id,
          start_time: event.start_time
        });
      });

      // Find the event that matches our Google Calendar event ID
      const matchedEvent = events.find((event: any) => {
        const matches = [
          event.raw_calendar_data?.id === googleEventId,
          event.external_id === googleEventId,
          event.id === googleEventId,
          event.uuid === googleEventId
        ];
        
        if (matches.some(match => match)) {
          console.log(`Found matching event: ${event.uuid} (${event.title})`);
          return true;
        }
        return false;
      });

      if (matchedEvent) {
        console.log(`Successfully found MeetingBaas event: ${matchedEvent.uuid}`);
        return matchedEvent;
      } else {
        console.log(`No matching event found for Google Calendar ID: ${googleEventId}`);
        return null;
      }
    } catch (error: any) {
      console.error('Error finding MeetingBaas event:', error.response?.data || error.message);
      return null;
    }
  }

  /**
   * Schedule a bot for a MeetingBaas calendar event
   */
  private static async scheduleBotForEvent(eventUuid: string, botConfig: any): Promise<any> {
    try {
      console.log(`Making API call to schedule bot for event ${eventUuid}`);
      console.log('Bot config:', JSON.stringify(botConfig, null, 2));
      
      const response = await axios.post(
        `${this.MEETINGBAAS_API_URL}/calendar_events/${eventUuid}/bot`,
        botConfig,
        {
          headers: {
            'x-meeting-baas-api-key': this.API_KEY,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log(`Bot scheduling API response status: ${response.status}`);
      console.log('Bot scheduling API response data:', JSON.stringify(response.data, null, 2));
      
      return response.data;
    } catch (error: any) {
      console.error('Error scheduling bot for event:', {
        eventUuid,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message
      });
      throw new Error(`Failed to schedule bot for event: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Find a MeetingBaas event by Google Calendar event ID with retry logic
   */
  private static async findMeetingBaasEventWithRetry(calendarId: string, googleEventId: string, eventSummary: string): Promise<any> {
    let retries = 0;
    const maxRetries = 3;

    while (retries < maxRetries) {
      // First try to find by ID
      let event = await this.findMeetingBaasEvent(calendarId, googleEventId);
      if (event) {
        return event;
      }

      // If not found by ID, try to find by title
      event = await this.findMeetingBaasEventByTitle(calendarId, eventSummary);
      if (event) {
        console.log(`Found event by title match: ${event.uuid} (${event.title})`);
        return event;
      }

      console.log(`Event ${googleEventId} not found in MeetingBaas. Retrying... (${retries + 1}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, 2000)); // Increased wait between retries
      retries++;
    }

    console.log(`Event ${googleEventId} not found in MeetingBaas after ${maxRetries} retries. Event summary: ${eventSummary}`);
    return null;
  }

  /**
   * Find a MeetingBaas event by title (fallback method)
   */
  private static async findMeetingBaasEventByTitle(calendarId: string, eventTitle: string): Promise<any> {
    try {
      console.log(`Searching for event by title: "${eventTitle}" in calendar ${calendarId}`);
      
      const response = await axios.get(
        `${this.MEETINGBAAS_API_URL}/calendar_events`,
        {
          headers: {
            'x-meeting-baas-api-key': this.API_KEY,
            'Content-Type': 'application/json'
          },
          params: {
            calendar_id: calendarId,
            status: 'upcoming'
          }
        }
      );

      const events = response.data.events || [];
      
      // Find event by title match
      const matchedEvent = events.find((event: any) => {
        const eventTitleMatch = event.title === eventTitle || event.summary === eventTitle;
        if (eventTitleMatch) {
          console.log(`Found event by title: ${event.uuid} (${event.title})`);
          return true;
        }
        return false;
      });

      return matchedEvent || null;
    } catch (error: any) {
      console.error('Error finding MeetingBaas event by title:', error.response?.data || error.message);
      return null;
    }
  }
}

// Type exports for use in other files
export type { CalendarIntegrationData, CalendarMeetingData, CalendarMeetingResponse };