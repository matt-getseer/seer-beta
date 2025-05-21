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
  status: string;
}

interface NLPResult {
  transcript: string;
  executiveSummary: string;
  wins: string[];
  areasForSupport: string[];
  actionItems: string[];
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
      
      // Then, send a bot to the meeting
      const response = await axios.post(
        `${MEETINGBAAS_API_URL}/bots`,
        {
          meeting_url: googleMeetLink,
          bot_name: "AI Notetaker",
          recording_mode: "speaker_view",
          reserved: false, // Set to true for scheduled meetings
          speech_to_text: {
            provider: "Default"
          },
          automatic_leave: {
            waiting_room_timeout: 600
          }
        },
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
          actionItems: nlpResult.actionItems,
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
} 