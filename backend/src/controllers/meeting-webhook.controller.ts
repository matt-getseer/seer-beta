import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { MeetingBaasService } from '../services/meetingbaas.service';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// Load environment variables
dotenv.config();

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Log webhook data to file for debugging
function logWebhook(eventType: string, data: any) {
  const logFile = path.join(logsDir, 'webhooks.log');
  const timestamp = new Date().toISOString();
  const logEntry = `${timestamp} - ${eventType}: ${JSON.stringify(data, null, 2)}\n\n`;
  
  fs.appendFile(logFile, logEntry, (err) => {
    if (err) console.error('Error writing to webhook log:', err);
  });
}

// Using singleton Prisma client from utils/prisma

export class MeetingWebhookController {
  /**
   * Handle webhook callback from MeetingBaas when a meeting is completed
   */
  static async handleMeetingCompleted(req: Request, res: Response) {
    try {
      console.log('Received webhook payload:', JSON.stringify(req.body, null, 2));
      
      // Get the event type
      const eventType = req.body.event;
      const data = req.body.data;
      
      // Log all webhooks for debugging
      logWebhook(eventType, req.body);
      
      // MeetingBaas webhook format has bot_id nested in the data object
      const botId = data?.bot_id || req.body.bot_id || req.body.meetingId;
      
      if (!botId && !isCalendarEvent(eventType)) {
        return res.status(400).json({ 
          error: 'Missing bot ID', 
          receivedPayload: req.body 
        });
      }
      
      // Handle different event types
      if (eventType === 'complete') {
        // Only process the recording when the meeting is actually complete
        // Pass the entire webhook data so we can extract transcript and recording URL
        await MeetingBaasService.handleMeetingCompleted(botId, data);
      } 
      else if (eventType === 'bot.status_change') {
        // For status change events, just update the status in our database
        const statusCode = data?.status?.code;
        
        if (statusCode) {
          try {
            const meeting = await prisma.meeting.findUnique({
              where: { meetingBaasId: botId }
            });
            
            if (meeting) {
              // Update the meeting status based on the bot status
              await prisma.meeting.update({
                where: { meetingBaasId: botId },
                data: { 
                  status: statusCode === 'joining_call' ? 'in_progress' : statusCode
                }
              });
              
              console.log(`Updated meeting status to ${statusCode} for meeting ${botId}`);
            } else {
              console.warn(`Meeting with MeetingBaas ID ${botId} not found in database`);
            }
          } catch (err) {
            console.error('Error updating meeting status:', err);
            // Don't throw here, still return 200 to MeetingBaaS
          }
        }
      }
      // Handle calendar events using the new MeetingBaas calendar service
      else if (isCalendarEvent(eventType)) {
        console.log(`Calendar event ${eventType} received but handling not yet implemented`);
        // TODO: Implement calendar webhook handling when MeetingBaas calendar service supports it
      }
      
      // Always return success to acknowledge receipt of the webhook
      return res.status(200).json({ message: 'Webhook received successfully' });
    } catch (error) {
      console.error('Error handling webhook:', error);
      return res.status(500).json({ 
        error: 'Failed to process webhook',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Handle calendar event webhooks (legacy method - now delegated to MeetingBaas calendar service)
   * This method is kept for backward compatibility
   */
  static async handleCalendarEvent(eventType: string, data: any) {
    try {
      console.log(`Processing calendar event via legacy handler: ${eventType}`);
      
      // TODO: Implement calendar webhook handling when MeetingBaas calendar service supports it
      console.log('Calendar event handling not yet implemented');
      
    } catch (error) {
      console.error('Error handling calendar event:', error);
      // Don't throw here, so that we can still return a 200 to MeetingBaas
    }
  }
}

// Helper function to determine if an event type is a calendar event
function isCalendarEvent(eventType: string): boolean {
  const calendarEventTypes = [
    'calendar.sync_events',
    'calendar.event_updated',
    'calendar.event_deleted', 
    'calendar.event_moved',
    'event.added',
    'event.updated',
    'event.deleted',
    'calendar.events',
    'added',
    'updated',
    'deleted',
    'moved',
    'synced'
  ];
  
  return calendarEventTypes.includes(eventType);
}

// Legacy helper functions kept for backward compatibility
// These are now handled by CalendarService but kept here to avoid breaking changes

// Helper function to record a calendar sync event
async function recordCalendarSync(eventUuid: string, data: any) {
  try {
    console.log(`Starting recordCalendarSync for event ${eventUuid}`);
    
    // Try to fetch the event details from MeetingBaas
    let eventDetails;
    try {
      eventDetails = await MeetingBaasService.getCalendarEvent(eventUuid);
      console.log(`Fetched details for event ${eventUuid}:`, JSON.stringify(eventDetails, null, 2));
    } catch (err) {
      console.error(`Error fetching event details for ${eventUuid}:`, err);
      return;
    }
    
    // Find the meeting in our database by calendar event ID
    const meeting = await findMeetingByCalendarEventId(eventUuid);
    
    if (meeting) {
      console.log(`Found meeting ${meeting.id} for calendar event ${eventUuid}`);
      
      // Update the meeting with the latest event details
      await prisma.meeting.update({
        where: { id: meeting.id },
        data: {
          lastSyncedAt: new Date()
        }
      });
      
      // Record the sync in meeting changes
      await prisma.meetingChange.create({
        data: {
          meetingId: meeting.id,
          changeType: 'synced',
          eventId: eventUuid,
          changeData: eventDetails
        }
      });
      
      console.log(`Recorded sync for meeting ${meeting.id}`);
    } else {
      console.log(`No meeting found for calendar event ${eventUuid}`);
    }
  } catch (error) {
    console.error(`Error in recordCalendarSync for ${eventUuid}:`, error);
  }
}

// Handle event added
async function handleEventAdded(data: any) {
  try {
    console.log('Processing event.added:', JSON.stringify(data, null, 2));
    
    const eventId = data.uuid || data.id || data.event_id;
    const title = data.title || data.summary;
    const startTime = data.start_time || data.start?.dateTime;
    const duration = data.duration;
    
    if (!eventId) {
      console.warn('No event ID found in event.added data');
      return;
    }
    
    console.log(`Event added: ${eventId} - ${title} at ${startTime}`);
    
    // For now, just log the event. In the future, we might want to:
    // 1. Check if this is a meeting we should track
    // 2. Automatically create a meeting record if it matches certain criteria
    // 3. Send notifications to relevant users
    
  } catch (error) {
    console.error('Error handling event.added:', error);
  }
}

// Handle event updated
async function handleEventUpdated(data: any) {
  try {
    console.log('Processing event.updated:', JSON.stringify(data, null, 2));
    
    const eventId = data.uuid || data.id || data.event_id;
    const title = data.title || data.summary;
    const startTime = data.start_time || data.start?.dateTime;
    const duration = data.duration;
    
    if (!eventId) {
      console.warn('No event ID found in event.updated data');
      return;
    }
    
    console.log(`Event updated: ${eventId} - ${title} at ${startTime}`);
    
    // Find the meeting in our database
    const meeting = await findMeetingByCalendarEventId(eventId);
    
    if (meeting) {
      console.log(`Found meeting ${meeting.id} for updated event ${eventId}`);
      
      // Prepare update data
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
      
      // Update the meeting if there are changes
      if (Object.keys(updateData).length > 1) { // More than just lastSyncedAt
        await prisma.meeting.update({
          where: { id: meeting.id },
          data: updateData
        });
        
        // Record the change
        await prisma.meetingChange.create({
          data: {
            meetingId: meeting.id,
            changeType: 'updated',
            eventId: eventId,
            changeData: data,
            previousTitle: meeting.title,
            previousDate: meeting.date,
            previousDuration: meeting.duration,
            newTitle: title,
            newDate: startTime ? new Date(startTime) : null,
            newDuration: duration
          }
        });
        
        console.log(`Updated meeting ${meeting.id} from calendar event update`);
      } else {
        // Just update the sync time
        await prisma.meeting.update({
          where: { id: meeting.id },
          data: { lastSyncedAt: new Date() }
        });
      }
    } else {
      console.log(`No meeting found for updated calendar event ${eventId}`);
    }
    
  } catch (error) {
    console.error('Error handling event.updated:', error);
  }
}

// Handle event deleted
async function handleEventDeleted(data: any) {
  try {
    console.log('Processing event.deleted:', JSON.stringify(data, null, 2));
    
    const eventId = data.uuid || data.id || data.event_id;
    
    if (!eventId) {
      console.warn('No event ID found in event.deleted data');
      return;
    }
    
    console.log(`Event deleted: ${eventId}`);
    
    // Find the meeting in our database
    const meeting = await findMeetingByCalendarEventId(eventId);
    
    if (meeting) {
      console.log(`Found meeting ${meeting.id} for deleted event ${eventId}`);
      
      // Update the meeting status to cancelled
      await prisma.meeting.update({
        where: { id: meeting.id },
        data: {
          status: 'cancelled',
          lastSyncedAt: new Date()
        }
      });
      
      // Record the deletion
      await prisma.meetingChange.create({
        data: {
          meetingId: meeting.id,
          changeType: 'deleted',
          eventId: eventId,
          changeData: data,
          previousTitle: meeting.title,
          previousDate: meeting.date,
          previousDuration: meeting.duration
        }
      });
      
      console.log(`Cancelled meeting ${meeting.id} due to calendar event deletion`);
    } else {
      console.log(`No meeting found for deleted calendar event ${eventId}`);
    }
    
  } catch (error) {
    console.error('Error handling event.deleted:', error);
  }
}

// Helper function to find a meeting by calendar event ID
async function findMeetingByCalendarEventId(eventId: string) {
  try {
    // Try to find by calendarEventId first (new field)
    let meeting = await prisma.meeting.findFirst({
      where: { calendarEventId: eventId }
    });
    
    if (!meeting) {
      // Fallback: try to find by meetingBaasId (legacy)
      meeting = await prisma.meeting.findFirst({
        where: { meetingBaasId: eventId }
      });
    }
    
    return meeting;
  } catch (error) {
    console.error('Error finding meeting by calendar event ID:', error);
    return null;
  }
} 