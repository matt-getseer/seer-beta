import { google } from 'googleapis';
import { prisma } from '../utils/prisma';
import { MeetingBaasConfig } from '../config/meetingbaas.config';

export interface CreateEventData {
  summary: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  attendees?: string[];
  location?: string;
  meetingPlatform?: 'google_meet' | 'zoom' | 'teams';
  timeZone?: string;
}

export interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  attendees?: string[];
  location?: string;
  meetingUrl?: string;
  htmlLink: string;
}

export class GoogleCalendarService {
  private oauth2Client: any;

  constructor() {
    this.oauth2Client = new google.auth.OAuth2(
      MeetingBaasConfig.oauth.google.clientId,
      MeetingBaasConfig.oauth.google.clientSecret,
      `${process.env.BASE_URL || 'http://localhost:3001'}/api/auth/google/callback`
    );
  }

  /**
   * Initialize the service with user's refresh token
   */
  private async initializeWithUserToken(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { googleRefreshToken: true, googleConnected: true }
    });

    if (!user?.googleRefreshToken || !user.googleConnected) {
      throw new Error('User does not have Google Calendar connected');
    }

    this.oauth2Client.setCredentials({
      refresh_token: user.googleRefreshToken
    });

    return google.calendar({ version: 'v3', auth: this.oauth2Client });
  }

  /**
   * Create a new calendar event
   */
  async createEvent(userId: string, eventData: CreateEventData): Promise<CalendarEvent> {
    try {
      const calendar = await this.initializeWithUserToken(userId);

      // Prepare event object
      const event: any = {
        summary: eventData.summary,
        description: eventData.description,
        start: {
          dateTime: eventData.startTime.toISOString(),
          timeZone: eventData.timeZone || 'UTC',
        },
        end: {
          dateTime: eventData.endTime.toISOString(),
          timeZone: eventData.timeZone || 'UTC',
        },
        attendees: eventData.attendees?.map(email => ({ email })),
        location: eventData.location,
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'email', minutes: 24 * 60 }, // 1 day before
            { method: 'popup', minutes: 10 }, // 10 minutes before
          ],
        },
      };

      // Add Google Meet if specified
      if (eventData.meetingPlatform === 'google_meet') {
        event.conferenceData = {
          createRequest: {
            requestId: `meet-${Date.now()}`,
            conferenceSolutionKey: {
              type: 'hangoutsMeet'
            }
          }
        };
      }

      // Create the event
      const response = await calendar.events.insert({
        calendarId: 'primary',
        requestBody: event,
        conferenceDataVersion: eventData.meetingPlatform === 'google_meet' ? 1 : 0,
        sendUpdates: 'all', // Send invitations to attendees
      });

      const createdEvent = response.data;

      return {
        id: createdEvent.id!,
        summary: createdEvent.summary!,
        description: createdEvent.description || undefined,
        startTime: new Date(createdEvent.start!.dateTime!),
        endTime: new Date(createdEvent.end!.dateTime!),
        attendees: createdEvent.attendees?.map((a: any) => a.email!),
        location: createdEvent.location || undefined,
        meetingUrl: createdEvent.conferenceData?.entryPoints?.[0]?.uri || undefined,
        htmlLink: createdEvent.htmlLink!,
      };

    } catch (error) {
      console.error('Error creating Google Calendar event:', error);
      throw new Error(`Failed to create calendar event: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Update an existing calendar event
   */
  async updateEvent(userId: string, eventId: string, eventData: Partial<CreateEventData>): Promise<CalendarEvent> {
    try {
      const calendar = await this.initializeWithUserToken(userId);

      // Get existing event first
      const existingEvent = await calendar.events.get({
        calendarId: 'primary',
        eventId: eventId,
      });

      // Prepare update object
      const updateData: any = {
        ...existingEvent.data,
      };

      if (eventData.summary) updateData.summary = eventData.summary;
      if (eventData.description !== undefined) updateData.description = eventData.description;
      if (eventData.location !== undefined) updateData.location = eventData.location;
      
      if (eventData.startTime) {
        updateData.start = {
          dateTime: eventData.startTime.toISOString(),
          timeZone: eventData.timeZone || 'UTC',
        };
      }
      
      if (eventData.endTime) {
        updateData.end = {
          dateTime: eventData.endTime.toISOString(),
          timeZone: eventData.timeZone || 'UTC',
        };
      }

      if (eventData.attendees) {
        updateData.attendees = eventData.attendees.map(email => ({ email }));
      }

      // Update the event
      const response = await calendar.events.update({
        calendarId: 'primary',
        eventId: eventId,
        requestBody: updateData,
        sendUpdates: 'all',
      });

      const updatedEvent = response.data;

      return {
        id: updatedEvent.id!,
        summary: updatedEvent.summary!,
        description: updatedEvent.description || undefined,
        startTime: new Date(updatedEvent.start!.dateTime!),
        endTime: new Date(updatedEvent.end!.dateTime!),
        attendees: updatedEvent.attendees?.map((a: any) => a.email!),
        location: updatedEvent.location || undefined,
        meetingUrl: updatedEvent.conferenceData?.entryPoints?.[0]?.uri || undefined,
        htmlLink: updatedEvent.htmlLink!,
      };

    } catch (error) {
      console.error('Error updating Google Calendar event:', error);
      throw new Error(`Failed to update calendar event: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Delete a calendar event
   */
  async deleteEvent(userId: string, eventId: string): Promise<void> {
    try {
      const calendar = await this.initializeWithUserToken(userId);

      await calendar.events.delete({
        calendarId: 'primary',
        eventId: eventId,
        sendUpdates: 'all',
      });

      console.log(`Deleted calendar event: ${eventId}`);

    } catch (error) {
      console.error('Error deleting Google Calendar event:', error);
      throw new Error(`Failed to delete calendar event: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get a specific calendar event
   */
  async getEvent(userId: string, eventId: string): Promise<CalendarEvent> {
    try {
      const calendar = await this.initializeWithUserToken(userId);

      const response = await calendar.events.get({
        calendarId: 'primary',
        eventId: eventId,
      });

      const event = response.data;

      return {
        id: event.id!,
        summary: event.summary!,
        description: event.description || undefined,
        startTime: new Date(event.start!.dateTime!),
        endTime: new Date(event.end!.dateTime!),
        attendees: event.attendees?.map((a: any) => a.email!),
        location: event.location || undefined,
        meetingUrl: event.conferenceData?.entryPoints?.[0]?.uri || undefined,
        htmlLink: event.htmlLink!,
      };

    } catch (error) {
      console.error('Error getting Google Calendar event:', error);
      throw new Error(`Failed to get calendar event: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * List calendar events for a date range
   */
  async listEvents(
    userId: string,
    startDate: Date,
    endDate: Date,
    maxResults: number = 50
  ): Promise<CalendarEvent[]> {
    try {
      const calendar = await this.initializeWithUserToken(userId);

      const response = await calendar.events.list({
        calendarId: 'primary',
        timeMin: startDate.toISOString(),
        timeMax: endDate.toISOString(),
        maxResults: maxResults,
        singleEvents: true,
        orderBy: 'startTime',
      });

      const events = response.data.items || [];

      return events.map(event => ({
        id: event.id!,
        summary: event.summary || 'No Title',
        description: event.description || undefined,
        startTime: new Date(event.start!.dateTime || event.start!.date!),
        endTime: new Date(event.end!.dateTime || event.end!.date!),
        attendees: event.attendees?.map((a: any) => a.email!),
        location: event.location || undefined,
        meetingUrl: event.conferenceData?.entryPoints?.[0]?.uri || undefined,
        htmlLink: event.htmlLink!,
      }));

    } catch (error) {
      console.error('Error listing Google Calendar events:', error);
      throw new Error(`Failed to list calendar events: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Check if user has Google Calendar connected
   */
  async isUserConnected(userId: string): Promise<boolean> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { googleRefreshToken: true, googleConnected: true }
      });

      return !!(user?.googleRefreshToken && user.googleConnected);
    } catch (error) {
      console.error('Error checking Google Calendar connection:', error);
      return false;
    }
  }
} 