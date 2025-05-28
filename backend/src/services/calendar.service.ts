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

      // Get the calendar ID from the response (could be 'id' or 'uuid')
      const calendarId = meetingBaasCalendar.calendar.id || meetingBaasCalendar.calendar.uuid;
      
      if (!calendarId) {
        throw new Error('MeetingBaas API response missing calendar ID/UUID');
      }

      // Store the integration in our database with the real MeetingBaas calendar ID
      const calendarIntegration = await prismaClient.calendarIntegration.create({
        data: {
          userId,
          provider: integrationData.provider,
          calendarId: calendarId, // Use the MeetingBaas calendar ID
          externalCalendarId: meetingBaasCalendar.calendar.raw_calendar_id || 'primary',
          refreshToken: integrationData.refreshToken,
          isActive: meetingBaasCalendar.calendar.status === 'active' || meetingBaasCalendar.calendar.status === 'syncing'
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

      if (targetEvent && targetEvent.meeting_url) {
        console.log(`Found matching calendar event with meeting URL: ${targetEvent.meeting_url}`);
        
        // Step 3: Send bot to the existing meeting
        const botResponse = await this.sendBotToMeeting(targetEvent.meeting_url, meetingData.title);
        
        return {
          id: botResponse.id,
          googleMeetLink: targetEvent.meeting_url,
          calendarEventId: targetEvent.id
        };
      } else {
        console.log('No matching calendar event found, using fallback bot creation');
        
        // Fallback: Create a bot without calendar event
        const fallbackResponse = await this.createBotDirectly(meetingData);
        
        return {
          id: fallbackResponse.id,
          googleMeetLink: fallbackResponse.googleMeetLink || 'No meeting URL available'
        };
      }

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
   * Fallback bot creation method when calendar event isn't found
   */
  private static async createBotDirectly(meetingData: CalendarMeetingData): Promise<{ id: string; googleMeetLink?: string }> {
    console.log('Using direct bot creation fallback');
    
    // Import MeetingBaasService to avoid circular dependency
    const { MeetingBaasService } = await import('./meetingbaas.service');
    
    const legacyMeetingData = {
      title: meetingData.title,
      scheduledTime: meetingData.scheduledTime,
      duration: meetingData.duration,
      userId: meetingData.userId
    };
    
    return await MeetingBaasService.createMeeting(legacyMeetingData);
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
    const { affected_event_uuids } = data;

    if (!Array.isArray(affected_event_uuids)) {
      console.log('No affected events in sync webhook');
      return;
    }

    console.log(`Processing ${affected_event_uuids.length} affected events from sync`);

    for (const eventId of affected_event_uuids) {
      try {
        console.log(`Sync event received for calendar event: ${eventId}`);
      } catch (error) {
        console.error(`Error processing sync event ${eventId}:`, error);
      }
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
}

// Type exports for use in other files
export type { CalendarIntegrationData, CalendarMeetingData, CalendarMeetingResponse };