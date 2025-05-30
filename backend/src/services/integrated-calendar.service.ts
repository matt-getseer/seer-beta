import { GoogleCalendarService, CreateEventData, CalendarEvent } from './google-calendar.service';
import { MeetingBaasCalendarService } from './meetingbaas/calendar.service';
import { MeetingBaasConfig } from '../config/meetingbaas.config';
import { prisma } from '../utils/prisma';

export interface IntegratedEventData extends CreateEventData {
  enableRecording?: boolean;
  recordingOptions?: {
    allOccurrences?: boolean;
    customBotConfig?: any;
  };
}

export interface IntegratedCalendarEvent extends CalendarEvent {
  recordingScheduled?: boolean;
  recordingId?: string;
}

/**
 * Integrated service that combines Google Calendar event creation 
 * with MeetingBaas recording capabilities
 */
export class IntegratedCalendarService {
  private googleCalendarService: GoogleCalendarService;
  private meetingBaasCalendarService: MeetingBaasCalendarService;

  constructor() {
    this.googleCalendarService = new GoogleCalendarService();
    this.meetingBaasCalendarService = new MeetingBaasCalendarService();
  }

  /**
   * Determine if we should use scheduled bot (for future meetings) or direct bot (for immediate meetings)
   */
  private shouldUseScheduledBot(meetingStartTime: Date): boolean {
    const now = new Date();
    const timeDifference = meetingStartTime.getTime() - now.getTime();
    const minutesUntilMeeting = timeDifference / (1000 * 60);
    
    // Use scheduled bot if meeting is more than 10 minutes in the future
    // This avoids unnecessary charges for bots waiting around
    return minutesUntilMeeting > 10;
  }

  /**
   * Create a calendar event with optional recording
   */
  async createEventWithRecording(
    userId: string, 
    eventData: IntegratedEventData
  ): Promise<IntegratedCalendarEvent> {
    try {
      // First, create the Google Calendar event
      console.log('Creating Google Calendar event...');
      const calendarEvent = await this.googleCalendarService.createEvent(userId, eventData);

      let recordingScheduled = false;
      let recordingId: string | undefined;

      // If recording is enabled and the event has a meeting URL, schedule recording
      if (eventData.enableRecording && calendarEvent.meetingUrl) {
        try {
          console.log('Setting up MeetingBaas integration and scheduling recording...');
          
          // Ensure MeetingBaas calendar integration exists
          await this.ensureCalendarIntegration(userId);
          
          // Get user's calendar integration
          const calendarIntegrations = await this.meetingBaasCalendarService.getUserCalendarIntegrations(userId);
          const googleIntegration = calendarIntegrations.find(ci => ci.provider === 'google' && ci.isActive);

          if (!googleIntegration) {
            console.warn('No active Google calendar integration found for MeetingBaas. Recording not scheduled.');
          } else {
            const useScheduledBot = this.shouldUseScheduledBot(eventData.startTime);
            
            try {
              if (useScheduledBot) {
                // For future meetings: Use scheduled bot (joins 4 minutes before meeting)
                console.log('Meeting is in the future - using scheduled bot approach...');
                
                // Wait longer for calendar sync and try to find the MeetingBaas event UUID
                console.log('Waiting for calendar sync to MeetingBaas...');
                let meetingBaasEventId: string | undefined;
                let attempts = 0;
                const maxAttempts = 6; // Try for up to 30 seconds
                
                while (attempts < maxAttempts && !meetingBaasEventId) {
                  await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
                  attempts++;
                  
                  try {
                    // Try to find the event in MeetingBaas by checking recent events
                    const calendarIntegrations = await this.meetingBaasCalendarService.getUserCalendarIntegrations(userId);
                    const googleIntegration = calendarIntegrations.find(ci => ci.provider === 'google' && ci.isActive);
                    
                    if (googleIntegration) {
                      const events = await this.meetingBaasCalendarService.getCalendarEvents({
                        calendarId: googleIntegration.calendarId,
                        startDateGte: new Date(eventData.startTime.getTime() - 60000).toISOString(), // 1 min before
                        startDateLte: new Date(eventData.startTime.getTime() + 60000).toISOString(), // 1 min after
                      });
                      
                      // Look for an event with matching time and title
                      const matchingEvent = events.data?.find((event: any) => 
                        event.name?.includes(eventData.summary) || 
                        Math.abs(new Date(event.startTime).getTime() - eventData.startTime.getTime()) < 60000
                      );
                      
                      if (matchingEvent) {
                        meetingBaasEventId = matchingEvent.uuid;
                        console.log(`✅ Found synced MeetingBaas event: ${meetingBaasEventId}`);
                        break;
                      }
                    }
                    
                    console.log(`Attempt ${attempts}/${maxAttempts}: Event not yet synced to MeetingBaas...`);
                  } catch (syncError) {
                    console.warn(`Sync check attempt ${attempts} failed:`, syncError);
                  }
                }
                
                if (meetingBaasEventId) {
                  // Use the MeetingBaas event UUID for scheduling
                  try {
                    const recordingResult = await this.meetingBaasCalendarService.scheduleEventRecording(
                      meetingBaasEventId,
                      {
                        allOccurrences: false,
                        customBotConfig: {
                          bot_name: `${eventData.summary} - Recording Bot`,
                          recording_mode: 'speaker_view',
                          speech_to_text: 'Default',
                          webhook_url: MeetingBaasConfig.bot.defaultWebhookUrl,
                          extra: {
                            source: 'seer-app',
                            version: '2.0',
                            eventTitle: eventData.summary,
                          }
                        }
                      }
                    );
                    
                    recordingScheduled = true;
                    recordingId = recordingResult?.id || recordingResult?.bot_id;
                    console.log('✅ Scheduled recording bot successfully (will join 4 min before meeting):', recordingId);
                  } catch (scheduleError) {
                    console.warn('❌ Scheduled bot creation failed even with correct UUID:', scheduleError);
                    throw scheduleError;
                  }
                } else {
                  console.warn('⚠️ Calendar event not synced to MeetingBaas after 30 seconds, falling back to direct bot');
                  // Fall through to direct bot creation
                  throw new Error('Calendar sync timeout - falling back to direct bot');
                }
              } else {
                // For immediate/soon meetings: Use direct bot
                console.log('Meeting is soon - using direct bot approach...');
                
                const { MeetingBaasBotService } = await import('./meetingbaas/bot.service');
                const botService = new MeetingBaasBotService();
                
                const botResponse = await botService.createBotWithDefaults(
                  calendarEvent.meetingUrl,
                  userId,
                  {
                    customBotName: `${eventData.summary} - Recording Bot`,
                  }
                );
                
                recordingScheduled = true;
                recordingId = botResponse.botId;
                console.log('✅ Direct bot created successfully (active immediately):', recordingId);
              }
            } catch (scheduledBotError) {
              // Fallback to direct bot if scheduled bot fails
              console.warn('⚠️ Scheduled bot approach failed, falling back to direct bot:', scheduledBotError);
              
              const { MeetingBaasBotService } = await import('./meetingbaas/bot.service');
              const botService = new MeetingBaasBotService();
              
              const botResponse = await botService.createBotWithDefaults(
                calendarEvent.meetingUrl,
                userId,
                {
                  customBotName: `${eventData.summary} - Recording Bot`,
                }
              );
              
              recordingScheduled = true;
              recordingId = botResponse.botId;
              console.log('✅ Fallback: Direct bot created successfully (active immediately):', recordingId);
              console.log('💡 Note: This is a direct bot. You can end it manually if the meeting is far in the future.');
            }
          }
        } catch (recordingError) {
          console.error('❌ Failed to schedule recording:', recordingError);
          // Don't fail the entire operation if recording fails
        }
      }

      return {
        ...calendarEvent,
        recordingScheduled,
        recordingId,
      };

    } catch (error) {
      console.error('Error creating integrated calendar event:', error);
      throw new Error(`Failed to create calendar event: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Ensure MeetingBaas calendar integration exists for the user
   */
  private async ensureCalendarIntegration(userId: string): Promise<void> {
    try {
      // Check if integration already exists
      const existingIntegrations = await this.meetingBaasCalendarService.getUserCalendarIntegrations(userId);
      const googleIntegration = existingIntegrations.find(ci => ci.provider === 'google' && ci.isActive);
      
      if (googleIntegration) {
        console.log('✅ MeetingBaas calendar integration already exists');
        return;
      }

      // Get user's Google refresh token
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { googleRefreshToken: true, googleConnected: true }
      });

      if (!user?.googleRefreshToken || !user.googleConnected) {
        throw new Error('User does not have Google Calendar connected');
      }

      // Create MeetingBaas calendar integration
      console.log('Creating MeetingBaas calendar integration...');
      await this.meetingBaasCalendarService.setupCalendarIntegration(
        userId,
        'google',
        user.googleRefreshToken
      );
      
      console.log('✅ MeetingBaas calendar integration created successfully');
    } catch (error) {
      console.error('Error ensuring calendar integration:', error);
      throw new Error(`Failed to setup calendar integration: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Update an event and its recording settings
   */
  async updateEventWithRecording(
    userId: string,
    eventId: string,
    eventData: Partial<IntegratedEventData>
  ): Promise<IntegratedCalendarEvent> {
    try {
      // Update the Google Calendar event
      console.log('Updating Google Calendar event...');
      const updatedEvent = await this.googleCalendarService.updateEvent(userId, eventId, eventData);

      let recordingScheduled = false;
      let recordingId: string | undefined;

      // Handle recording updates
      if (eventData.enableRecording !== undefined) {
        const calendarIntegrations = await this.meetingBaasCalendarService.getUserCalendarIntegrations(userId);
        const googleIntegration = calendarIntegrations.find(ci => ci.provider === 'google' && ci.isActive);

        if (googleIntegration) {
          if (eventData.enableRecording && updatedEvent.meetingUrl) {
            // Schedule or update recording
            try {
              const recordingResult = await this.meetingBaasCalendarService.scheduleEventRecording(
                eventId,
                eventData.recordingOptions
              );
              recordingScheduled = true;
              recordingId = recordingResult?.id;
              console.log('✅ Recording updated successfully');
            } catch (recordingError) {
              console.error('❌ Failed to update recording:', recordingError);
            }
          } else if (!eventData.enableRecording) {
            // Unschedule recording
            try {
              await this.meetingBaasCalendarService.unscheduleEventRecording(eventId);
              console.log('✅ Recording unscheduled successfully');
            } catch (recordingError) {
              console.error('❌ Failed to unschedule recording:', recordingError);
            }
          }
        }
      }

      return {
        ...updatedEvent,
        recordingScheduled,
        recordingId,
      };

    } catch (error) {
      console.error('Error updating integrated calendar event:', error);
      throw new Error(`Failed to update calendar event: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Delete an event and its associated recording
   */
  async deleteEventWithRecording(userId: string, eventId: string): Promise<void> {
    try {
      // First, check if we have a meeting record with bot information
      const meeting = await prisma.meeting.findFirst({
        where: { calendarEventId: eventId },
        select: { meetingBaasId: true, id: true }
      });

      // Try multiple approaches to clean up recording bots
      let botCleanupSuccess = false;

      // Approach 1: Try to unschedule via calendar event (for scheduled bots)
      try {
        console.log(`Attempting to unschedule calendar event recording: ${eventId}`);
        await this.meetingBaasCalendarService.unscheduleEventRecording(eventId);
        console.log('✅ Calendar event recording unscheduled successfully');
        botCleanupSuccess = true;
      } catch (calendarError) {
        console.warn('Could not unschedule via calendar event (may be direct bot):', calendarError);
      }

      // Approach 2: If calendar unscheduling failed and we have a bot ID, try direct bot cleanup
      if (!botCleanupSuccess && meeting?.meetingBaasId) {
        try {
          console.log(`Attempting to end direct bot: ${meeting.meetingBaasId}`);
          const { MeetingBaasBotService } = await import('./meetingbaas/bot.service');
          const botService = new MeetingBaasBotService();
          
          await botService.endBot(meeting.meetingBaasId);
          console.log('✅ Direct bot ended successfully');
          botCleanupSuccess = true;
        } catch (botError) {
          console.warn('Could not end direct bot:', botError);
        }
      }

      if (!botCleanupSuccess) {
        console.warn('⚠️ Could not clean up recording bot via any method. Bot may not exist or may have already ended.');
      }

      // Always delete the Google Calendar event regardless of bot cleanup success
      await this.googleCalendarService.deleteEvent(userId, eventId);
      console.log('✅ Calendar event deleted successfully');

    } catch (error) {
      console.error('Error deleting integrated calendar event:', error);
      throw new Error(`Failed to delete calendar event: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get event with recording status
   */
  async getEventWithRecording(userId: string, eventId: string): Promise<IntegratedCalendarEvent> {
    try {
      const calendarEvent = await this.googleCalendarService.getEvent(userId, eventId);

      // Check if recording is scheduled for this event
      let recordingScheduled = false;
      let recordingId: string | undefined;

      try {
        // This would require additional MeetingBaas API calls to check recording status
        // For now, we'll return the basic event info
        // TODO: Implement recording status check when MeetingBaas provides this functionality
      } catch (recordingError) {
        console.warn('Could not check recording status:', recordingError);
      }

      return {
        ...calendarEvent,
        recordingScheduled,
        recordingId,
      };

    } catch (error) {
      console.error('Error getting integrated calendar event:', error);
      throw new Error(`Failed to get calendar event: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * List events with recording status
   */
  async listEventsWithRecording(
    userId: string,
    startDate: Date,
    endDate: Date,
    maxResults: number = 50
  ): Promise<IntegratedCalendarEvent[]> {
    try {
      const events = await this.googleCalendarService.listEvents(userId, startDate, endDate, maxResults);

      // For each event, check if recording is scheduled
      // TODO: Optimize this with batch API calls when available
      const eventsWithRecording = events.map(event => ({
        ...event,
        recordingScheduled: false, // TODO: Check actual recording status
        recordingId: undefined,
      }));

      return eventsWithRecording;

    } catch (error) {
      console.error('Error listing integrated calendar events:', error);
      throw new Error(`Failed to list calendar events: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Check if user has Google Calendar connected (MeetingBaas is always available via API key)
   */
  async isFullyConnected(userId: string): Promise<{
    googleCalendar: boolean;
    meetingBaas: boolean;
    fullyConnected: boolean;
  }> {
    try {
      const googleCalendar = await this.googleCalendarService.isUserConnected(userId);
      const meetingBaas = true; // MeetingBaas is available via API key

      return {
        googleCalendar,
        meetingBaas,
        fullyConnected: googleCalendar && meetingBaas
      };
    } catch (error) {
      console.error('Error checking integration status:', error);
      return {
        googleCalendar: false,
        meetingBaas: false,
        fullyConnected: false
      };
    }
  }

  /**
   * Setup complete integration (Google Calendar + MeetingBaas)
   */
  async setupIntegration(userId: string): Promise<{
    success: boolean;
    googleConnected: boolean;
    meetingBaasConnected: boolean;
    message: string;
  }> {
    try {
      const status = await this.isFullyConnected(userId);

      if (status.fullyConnected) {
        return {
          success: true,
          googleConnected: true,
          meetingBaasConnected: true,
          message: 'Integration already fully set up',
        };
      }

      if (!status.googleCalendar) {
        return {
          success: false,
          googleConnected: false,
          meetingBaasConnected: status.meetingBaas,
          message: 'Google Calendar connection required first',
        };
      }

      // If Google is connected but MeetingBaas isn't, set up MeetingBaas
      if (status.googleCalendar && !status.meetingBaas) {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { googleRefreshToken: true }
        });

        if (user?.googleRefreshToken) {
          await this.meetingBaasCalendarService.setupCalendarIntegration(
            userId,
            'google',
            user.googleRefreshToken
          );

          return {
            success: true,
            googleConnected: true,
            meetingBaasConnected: true,
            message: 'MeetingBaas integration set up successfully',
          };
        }
      }

      return {
        success: false,
        googleConnected: status.googleCalendar,
        meetingBaasConnected: status.meetingBaas,
        message: 'Unable to complete integration setup',
      };

    } catch (error) {
      console.error('Error setting up integration:', error);
      return {
        success: false,
        googleConnected: false,
        meetingBaasConnected: false,
        message: `Setup failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }
} 