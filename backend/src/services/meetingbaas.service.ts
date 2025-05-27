import axios from 'axios';
import { prisma } from '../utils/prisma';
import { google } from 'googleapis';
import { NLPService } from './nlp.service';
import { MeetingType } from './meeting-processor.service';

// Using singleton Prisma client from utils/prisma
const MEETINGBAAS_API_URL = process.env.MEETINGBAAS_API_URL || 'https://api.meetingbaas.com';
const MEETINGBAAS_API_KEY = process.env.MEETINGBAAS_API_KEY;

// Google Calendar API credentials (needed to create Google Meet links)
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN;
const GOOGLE_CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID || 'primary';

interface MeetingBaasResponse {
  id: string;
  googleMeetLink: string;
  status: string; // "scheduled", "joining", "in_progress", "completed", "failed"
}

interface NLPResult {
  transcript: string;
  executiveSummary: string;
  wins: string[];
  areasForSupport: string[];
  tasks: string[];
}

/**
 * Service to interact with MeetingBaas API
 */
export class MeetingBaasService {
  /**
   * Create a Google Meet and send a MeetingBaas bot to it
   */
  static async createMeeting(meetingData: {
    title: string;
    scheduledTime: Date;
    duration: number;
    userId?: string; // Add userId parameter to find user-specific refresh token
    teamMemberId?: string; // Add teamMemberId parameter
  }): Promise<MeetingBaasResponse> {
    try {
      // First, create a Google Meet using Google Calendar API
      const googleMeetLink = await this.createGoogleMeet(meetingData);
      
      // For all scheduled meetings, use reserved: true and start_time
      // The bot will be reserved and join 4 minutes before the start_time
      const meetingStartTime = new Date(meetingData.scheduledTime);
      
      const botPayload = {
        meeting_url: googleMeetLink,
        bot_name: "AI Notetaker",
        recording_mode: "gallery_view",
        reserved: true, // Always true for scheduled meetings
        start_time: Math.floor(meetingStartTime.getTime() / 1000), // Unix timestamp in seconds (not milliseconds)
        entry_message: "Hi everyone! I'm Seer, I'll be taking notes and will provide a summary after the meeting.",
        speech_to_text: {
          provider: "Default"
        },
        automatic_leave: {
          waiting_room_timeout: 600
        }
      };
      
      // Send bot to the meeting
      const response = await axios.post(
        `${MEETINGBAAS_API_URL}/bots`,
        botPayload,
        {
          headers: {
            'x-meeting-baas-api-key': MEETINGBAAS_API_KEY,
            'Content-Type': 'application/json'
          }
        }
      );

      return {
        id: response.data.bot_id.toString(),
        googleMeetLink,
        status: "scheduled"
      };
    } catch (error) {
      console.error('Error creating meeting with MeetingBaas:', error);
      
      // Log detailed error information for debugging
      if (axios.isAxiosError(error)) {
        console.error('MeetingBaas API Error Details:');
        console.error('Status:', error.response?.status);
        console.error('Status Text:', error.response?.statusText);
        console.error('Response Data:', JSON.stringify(error.response?.data, null, 2));
        console.error('Request URL:', error.config?.url);
        console.error('Request Method:', error.config?.method);
        console.error('Request Headers:', JSON.stringify(error.config?.headers, null, 2));
        console.error('Request Data:', JSON.stringify(error.config?.data, null, 2));
      }
      
      throw new Error('Failed to create meeting with MeetingBaas');
    }
  }

  /**
   * Create a Google Meet link using Google Calendar API
   */
  private static async createGoogleMeet(meetingData: {
    title: string;
    scheduledTime: Date;
    duration: number;
    userId?: string;
    teamMemberId?: string; // Add teamMemberId parameter
  }): Promise<string> {
    try {
      // Try to get the user's refresh token if userId is provided
      let refreshToken = GOOGLE_REFRESH_TOKEN;
      
      if (meetingData.userId) {
        try {
          const user = await prisma.user.findUnique({
            where: { id: meetingData.userId },
            select: { googleRefreshToken: true, googleConnected: true }
          });
          
          if (user?.googleConnected && user?.googleRefreshToken) {
            refreshToken = user.googleRefreshToken;
          }
        } catch (err) {
          console.warn('Error fetching user refresh token:', err);
          // Continue with the default refresh token
        }
      }
      
      // If Google API credentials are not set, use a dummy link for testing
      if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !refreshToken) {
        console.warn('Google API credentials not set, using demo link');
        return `https://meet.google.com/demo-${Date.now()}`;
      }

      // Set up OAuth2 client
      const oauth2Client = new google.auth.OAuth2(
        GOOGLE_CLIENT_ID,
        GOOGLE_CLIENT_SECRET
      );
      
      oauth2Client.setCredentials({
        refresh_token: refreshToken
      });
      
      // Create Calendar API client
      const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
      
      // Calculate end time
      const endTime = new Date(meetingData.scheduledTime);
      endTime.setMinutes(endTime.getMinutes() + meetingData.duration);
      
      // Get team member's email if teamMemberId is provided
      let teamMemberEmail = null;
      if (meetingData.teamMemberId) {
        try {
          console.log(`Attempting to fetch email for team member with ID: ${meetingData.teamMemberId}`);
          const teamMember = await prisma.user.findUnique({
            where: { id: meetingData.teamMemberId },
            select: { email: true, name: true }
          });
          
          if (teamMember) {
            teamMemberEmail = teamMember.email;
            console.log(`Found team member email: ${teamMemberEmail}`);
          } else {
            console.warn(`Team member with ID ${meetingData.teamMemberId} not found`);
          }
        } catch (err) {
          console.warn('Error fetching team member email:', err);
        }
      } else {
        console.log('No teamMemberId provided, skipping attendee');
      }
      
      // Create calendar event with Google Meet
      const event: any = {
        summary: meetingData.title,
        start: {
          dateTime: meetingData.scheduledTime.toISOString(),
        },
        end: {
          dateTime: endTime.toISOString(),
        },
        conferenceData: {
          createRequest: {
            requestId: `meeting-${Date.now()}`,
            conferenceSolutionKey: { type: 'hangoutsMeet' }
          }
        }
      };
      
      // Add attendees if team member email is available
      if (teamMemberEmail) {
        console.log(`Adding attendee: ${teamMemberEmail}`);
        event.attendees = [{ email: teamMemberEmail }];
      }
      
      console.log('Calendar event payload:', JSON.stringify(event, null, 2));
      
      const response = await calendar.events.insert({
        calendarId: GOOGLE_CALENDAR_ID,
        conferenceDataVersion: 1,
        requestBody: event,
        sendUpdates: 'all' // This will send email notifications to attendees
      });
      
      console.log('Calendar API response:', JSON.stringify(response.data, null, 2));
      
      // Extract Google Meet link
      const meetLink = response.data.conferenceData?.entryPoints?.find(
        (ep: any) => ep.entryPointType === 'video'
      )?.uri;
      
      if (!meetLink) {
        throw new Error('Failed to create Google Meet link');
      }
      
      return meetLink;
    } catch (error) {
      console.error('Error creating Google Meet:', error);
      throw new Error('Failed to create Google Meet link');
    }
  }

  /**
   * Get bot status from MeetingBaas
   */
  static async getMeeting(meetingBaasId: string): Promise<MeetingBaasResponse> {
    try {
      const response = await axios.get(
        `${MEETINGBAAS_API_URL}/bots/${meetingBaasId}`,
        {
          headers: {
            'x-meeting-baas-api-key': MEETINGBAAS_API_KEY
          }
        }
      );

      return {
        id: response.data.bot_id.toString(),
        googleMeetLink: response.data.meeting_url || '',
        status: response.data.status || 'unknown'
      };
    } catch (error) {
      console.error('Error getting meeting data from MeetingBaas:', error);
      throw new Error('Failed to get meeting data from MeetingBaas');
    }
  }

  /**
   * Process recording with NLP
   */
  static async processRecording(meetingBaasId: string, webhookData?: any): Promise<any> {
    try {
      // Find the meeting to get its ID
      const meeting = await prisma.meeting.findUnique({
        where: { meetingBaasId },
        select: {
          id: true,
          title: true
          // We no longer need to select meetingType since we always use ONE_ON_ONE
        }
      });
      
      if (!meeting) {
        throw new Error(`Meeting with MeetingBaasId ${meetingBaasId} not found`);
      }

      // Update meeting status to processing
      await prisma.meeting.update({
        where: { meetingBaasId },
        data: { processingStatus: 'processing' }
      });

      // Extract transcript from webhook data or API
      let transcript = '';
      
      // Check if we have webhook data from the "complete" event
      if (webhookData && webhookData.transcript) {
        console.log('Using transcript data from webhook payload');
        
        // Convert the webhook transcript format to a simple text string
        if (Array.isArray(webhookData.transcript)) {
          webhookData.transcript.forEach((segment: any) => {
            if (segment.speaker && segment.words) {
              transcript += `${segment.speaker}: `;
              segment.words.forEach((word: any) => {
                transcript += word.word;
              });
              transcript += '\n';
            }
          });
        }
      } else {
        // Fallback to API call if no webhook data is provided
        console.log('No transcript in webhook data, fetching from MeetingBaas API');
        
        // Get recording and transcript from MeetingBaas
        const response = await axios.get(
          `${MEETINGBAAS_API_URL}/bots/${meetingBaasId}/recording`,
          {
            headers: {
              'x-meeting-baas-api-key': MEETINGBAAS_API_KEY
            }
          }
        );

        transcript = response.data.transcript || '';
      }
      
      // Determine meeting type (default to DEFAULT if not specified)
      const meetingType = this.determineMeetingType(meeting);
      
      // Process transcript with our custom NLP service
      return await NLPService.processMeetingTranscript(
        meeting.id,
        transcript,
        meetingType
      );
    } catch (error) {
      console.error('Error processing recording:', error);
      
      try {
        // Update meeting status to failed
        await prisma.meeting.update({
          where: { meetingBaasId },
          data: { processingStatus: 'failed' }
        });
      } catch (updateError) {
        console.error('Error updating meeting status:', updateError);
      }
      
      throw new Error('Failed to process recording');
    }
  }
  
  /**
   * Determine the meeting type based on meeting data
   */
  private static determineMeetingType(meeting: any): MeetingType {
    // Per client request, always use ONE_ON_ONE meeting type
    return MeetingType.ONE_ON_ONE;
    
    // Code below is kept for future reference but not used
    /*
    // If the meeting has an explicit type, use it
    if (meeting.meetingType) {
      try {
        return meeting.meetingType as MeetingType;
      } catch (e) {
        console.warn(`Invalid meeting type: ${meeting.meetingType}, using DEFAULT`);
      }
    }
    
    // Otherwise, try to infer from the title
    const title = meeting.title.toLowerCase();
    
    if (title.includes('1:1') || title.includes('one on one') || title.includes('1-on-1')) {
      return MeetingType.ONE_ON_ONE;
    }
    
    if (title.includes('team') || title.includes('standup') || title.includes('sprint')) {
      return MeetingType.TEAM_MEETING;
    }
    
    if (title.includes('client') || title.includes('presentation')) {
      return MeetingType.CLIENT_PRESENTATION;
    }
    
    if (title.includes('sales') || title.includes('prospect') || title.includes('demo')) {
      return MeetingType.SALES_CALL;
    }
    
    // Default meeting type
    return MeetingType.DEFAULT;
    */
  }
  
  /**
   * Handle webhook for meeting completion
   */
  static async handleMeetingCompleted(meetingBaasId: string, webhookData?: any): Promise<void> {
    try {
      // Find the meeting in our database
      const meeting = await prisma.meeting.findUnique({
        where: { meetingBaasId }
      });
      
      if (!meeting) {
        throw new Error(`Meeting with MeetingBaas ID ${meetingBaasId} not found`);
      }
      
      // Process the recording with our NLP service, passing the webhook data
      const nlpResult = await this.processRecording(meetingBaasId, webhookData);
      
      // Store the recording URL if provided in the webhook data
      const recordingUrl = webhookData?.mp4 || '';
      
      // Update the meeting with NLP results
      await prisma.meeting.update({
        where: { meetingBaasId },
        data: {
          status: 'completed',
          processingStatus: 'completed',
          transcript: nlpResult.transcript,
          executiveSummary: nlpResult.executiveSummary,
          wins: nlpResult.wins,
          areasForSupport: nlpResult.areasForSupport,
          tasks: nlpResult.tasks,
          recordingUrl: recordingUrl,
          // Store additional data if available
          ...(nlpResult.keyInsights ? { keyInsights: nlpResult.keyInsights } : {}),
          ...(nlpResult.clientFeedback ? { clientFeedback: nlpResult.clientFeedback } : {})
        }
      });
    } catch (error) {
      console.error('Error handling meeting completion:', error);
      throw new Error('Failed to handle meeting completion');
    }
  }

  /**
   * Get calendar event details from MeetingBaas
   */
  static async getCalendarEvent(eventId: string): Promise<any> {
    try {
      console.log(`Fetching calendar event details for ${eventId}`);
      
      // Call the MeetingBaas API to get event details
      const response = await axios.get(
        `${MEETINGBAAS_API_URL}/calendar_events/${eventId}`,
        {
          headers: {
            'x-meeting-baas-api-key': MEETINGBAAS_API_KEY
          }
        }
      );
      
      return response.data;
    } catch (error) {
      console.error(`Error fetching calendar event ${eventId}:`, error);
      throw new Error(`Failed to fetch calendar event details for ${eventId}`);
    }
  }

  /**
   * Remove/Cancel a meeting by removing the bot and deleting the calendar event
   */
  static async removeMeeting(meetingData: {
    meetingBaasId: string;
    googleMeetLink: string;
    userId?: string;
  }): Promise<void> {
    try {
      // 1. Remove the bot from MeetingBaas
      await axios.delete(
        `${MEETINGBAAS_API_URL}/bots/${meetingData.meetingBaasId}`,
        {
          headers: {
            'x-meeting-baas-api-key': MEETINGBAAS_API_KEY,
            'Content-Type': 'application/json'
          }
        }
      );

      // 2. Delete the Google Calendar event
      await this.deleteGoogleCalendarEvent(meetingData);

      console.log(`Successfully removed meeting with bot ID: ${meetingData.meetingBaasId}`);
    } catch (error) {
      console.error('Error removing meeting:', error);
      
      // Log detailed error information for debugging
      if (axios.isAxiosError(error)) {
        console.error('MeetingBaas API Error Details:');
        console.error('Status:', error.response?.status);
        console.error('Status Text:', error.response?.statusText);
        console.error('Response Data:', JSON.stringify(error.response?.data, null, 2));
      }
      
      throw new Error('Failed to remove meeting');
    }
  }

  /**
   * Delete Google Calendar event
   */
  private static async deleteGoogleCalendarEvent(meetingData: {
    googleMeetLink: string;
    userId?: string;
  }): Promise<void> {
    try {
      // Try to get the user's refresh token if userId is provided
      let refreshToken = GOOGLE_REFRESH_TOKEN;
      
      if (meetingData.userId) {
        try {
          const user = await prisma.user.findUnique({
            where: { id: meetingData.userId },
            select: { googleRefreshToken: true, googleConnected: true }
          });
          
          if (user?.googleConnected && user?.googleRefreshToken) {
            refreshToken = user.googleRefreshToken;
          }
        } catch (err) {
          console.warn('Error fetching user refresh token:', err);
          // Continue with the default refresh token
        }
      }
      
      // If Google API credentials are not set, skip calendar deletion
      if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !refreshToken) {
        console.warn('Google API credentials not set, skipping calendar event deletion');
        return;
      }

      // Set up OAuth2 client
      const oauth2Client = new google.auth.OAuth2(
        GOOGLE_CLIENT_ID,
        GOOGLE_CLIENT_SECRET
      );
      
      oauth2Client.setCredentials({
        refresh_token: refreshToken
      });
      
      // Create Calendar API client
      const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
      
      // Extract event ID from Google Meet link if possible
      // Google Meet links typically contain the event ID or we need to find it by searching
      // For now, we'll search for events with this meet link
      const events = await calendar.events.list({
        calendarId: GOOGLE_CALENDAR_ID,
        timeMin: new Date().toISOString(),
        maxResults: 100,
        singleEvents: true,
        orderBy: 'startTime'
      });

      // Find the event with matching Google Meet link
      const eventToDelete = events.data.items?.find(event => {
        const meetLink = event.conferenceData?.entryPoints?.find(
          (ep: any) => ep.entryPointType === 'video'
        )?.uri;
        return meetLink === meetingData.googleMeetLink;
      });

      if (eventToDelete && eventToDelete.id) {
        // Delete the calendar event
        await calendar.events.delete({
          calendarId: GOOGLE_CALENDAR_ID,
          eventId: eventToDelete.id,
          sendUpdates: 'all' // This will send cancellation notifications to attendees
        });
        
        console.log(`Successfully deleted Google Calendar event: ${eventToDelete.id}`);
      } else {
        console.warn('Could not find Google Calendar event to delete');
      }
    } catch (error) {
      console.error('Error deleting Google Calendar event:', error);
      // Don't throw here - we still want to remove the bot even if calendar deletion fails
    }
  }
} 