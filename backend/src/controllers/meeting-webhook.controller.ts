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
      // Handle calendar events
      else if (isCalendarEvent(eventType)) {
        await MeetingWebhookController.handleCalendarEvent(eventType, data);
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
   * Handle calendar event webhooks (event.added, event.updated, event.deleted, calendar.sync_events)
   */
  static async handleCalendarEvent(eventType: string, data: any) {
    try {
      console.log(`Processing calendar event: ${eventType}`, JSON.stringify(data, null, 2));
      
      // For calendar.sync_events, we need to process each affected event
      if (eventType === 'calendar.sync_events' && Array.isArray(data.affected_event_uuids)) {
        console.log(`Processing ${data.affected_event_uuids.length} affected events`);
        
        // Process each affected event UUID
        for (const eventUuid of data.affected_event_uuids) {
          console.log(`Need to fetch details for event ${eventUuid}`);
          
          try {
            await recordCalendarSync(eventUuid, data);
          } catch (err) {
            console.error(`Error processing event ${eventUuid}:`, err);
            // Continue processing other events
          }
        }
      }
      // Handle array of events if provided
      else if (data.events && Array.isArray(data.events)) {
        console.log(`Processing ${data.events.length} events in payload`);
        
        for (const event of data.events) {
          const subEventType = event.type || eventType;
          try {
            if (subEventType === 'event.added' || subEventType === 'added') {
              await handleEventAdded(event);
            }
            else if (subEventType === 'event.updated' || subEventType === 'updated') {
              await handleEventUpdated(event);
            }
            else if (subEventType === 'event.deleted' || subEventType === 'deleted') {
              await handleEventDeleted(event);
            }
            else {
              console.log(`Unknown event sub-type: ${subEventType}`);
            }
          } catch (err) {
            console.error(`Error processing event ${JSON.stringify(event)}:`, err);
            // Continue processing other events
          }
        }
      }
      // Handle direct event notifications
      else if (eventType === 'event.added') {
        await handleEventAdded(data);
      }
      else if (eventType === 'event.updated') {
        await handleEventUpdated(data);
      }
      else if (eventType === 'event.deleted') {
        await handleEventDeleted(data);
      }
      else {
        console.log(`Unhandled calendar event type: ${eventType}`);
      }
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
    'event.added',
    'event.updated',
    'event.deleted',
    'calendar.events',
    'added',
    'updated',
    'deleted',
    'synced'
  ];
  
  return calendarEventTypes.includes(eventType);
}

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
      // Continue with the process even if we can't get event details
    }
    
    // If we have event details, we can process the event update
    if (eventDetails) {
      // Determine if this is an update or a deletion based on event status
      if (eventDetails.status === 'deleted' || eventDetails.status === 'cancelled') {
        await handleEventDeleted({ 
          event_id: eventUuid, 
          ...eventDetails 
        });
        return;
      } else {
        await handleEventUpdated({ 
          event_id: eventUuid, 
          ...eventDetails 
        });
        return;
      }
    }
    
    // If we couldn't get event details, fall back to finding the meeting directly
    const meeting = await findMeetingByCalendarEventId(eventUuid);
    
    if (!meeting) {
      console.log(`No matching meeting found for calendar event ${eventUuid}`);
      // Create a record in a separate table for unmatched events so we can track them
      try {
        console.log(`Recording unmatched event ${eventUuid} for future processing`);
        // Here you would create a record in a table for unmatched events
        // This is just a placeholder for now
      } catch (unmatchedErr) {
        console.error(`Error recording unmatched event ${eventUuid}:`, unmatchedErr);
      }
      return;
    }
    
    console.log(`Found meeting ${meeting.id} for calendar event ${eventUuid}`);
    
    // Record that there was a sync event
    const meetingChange = await prisma.meetingChange.create({
      data: {
        meetingId: meeting.id,
        changeType: 'synced',
        eventId: eventUuid,
        changeData: data
      }
    });
    
    console.log(`Recorded sync event for meeting ${meeting.id}`, meetingChange);
  } catch (error) {
    console.error(`Error recording calendar sync for event ${eventUuid}:`, error);
    throw error; // Re-throw so caller can decide whether to continue
  }
}

// Helper function to handle event.added webhook
async function handleEventAdded(data: any) {
  try {
    console.log('Processing event.added webhook', JSON.stringify(data, null, 2));
    
    // For a new event, we might create a new meeting in our database
    // Or we might update an existing meeting if it was created in our system first
    
    // First, check if this meeting already exists in our system
    const eventId = data.event_id || data.id;
    console.log(`Looking for meeting with eventId: ${eventId}`);
    const meeting = await findMeetingByCalendarEventId(eventId);
    
    // If the meeting exists, this might be a duplicate or an update to an existing meeting
    if (meeting) {
      console.log(`Meeting already exists for event ${eventId}, updating instead`);
      return await handleEventUpdated(data);
    }
    
    // If the meeting doesn't exist, create a new one
    // This would typically include processing the calendar event data
    // to extract meeting details like title, date, duration, etc.
    
    // For now, log that we would create a meeting
    console.log(`Would create a new meeting for event ${eventId}`);
    
    // In a real implementation, we would extract the meeting details from the data
    // and create a new meeting in our database
  } catch (error) {
    console.error('Error handling event.added:', error);
  }
}

// Helper function to handle event.updated webhook
async function handleEventUpdated(data: any) {
  try {
    console.log('Processing event.updated webhook', JSON.stringify(data, null, 2));
    
    // Get the event ID from the webhook data - handle different possible formats
    const eventId = data.event_id || data.id || data.uuid || data.event_uuid;
    console.log(`Looking for meeting with eventId: ${eventId}`);
    
    if (!eventId) {
      console.error('Missing event ID in webhook data:', data);
      return;
    }
    
    // Find the corresponding meeting in our database
    const meeting = await findMeetingByCalendarEventId(eventId);
    
    if (!meeting) {
      console.log(`No matching meeting found for updated event ${eventId}`);
      return;
    }
    
    // Extract updated meeting details from the event data
    // This would typically include title, date, duration, etc.
    // For now, we'll log the update and record the change
    
    console.log(`Found meeting ${meeting.id} for updated event ${eventId}`);
    console.log(`Current meeting data: ${JSON.stringify(meeting, null, 2)}`);
    
    // Parse new values from data, handling different possible formats
    const newTitle = data.title || data.summary || data.subject || meeting.title;
    
    // Handle different date formats in the webhook
    let newDate = meeting.date;
    if (data.startTime || data.start_time || data.start) {
      const startTime = data.startTime || data.start_time || data.start;
      if (typeof startTime === 'string') {
        newDate = new Date(startTime);
      } else if (startTime && startTime.dateTime) {
        newDate = new Date(startTime.dateTime);
      }
    }
    
    // Handle different duration formats
    let newDuration = meeting.duration;
    if (data.duration) {
      newDuration = typeof data.duration === 'number' ? data.duration : parseInt(data.duration, 10);
    } else if (data.endTime && data.startTime) {
      // Calculate duration from start and end times
      const start = new Date(data.startTime);
      const end = new Date(data.endTime);
      newDuration = Math.floor((end.getTime() - start.getTime()) / (60 * 1000));
    }
    
    console.log(`New values - Title: ${newTitle}, Date: ${newDate}, Duration: ${newDuration}`);
    
    // Check if there are actual changes
    const titleChanged = newTitle !== meeting.title;
    const dateChanged = new Date(newDate).getTime() !== new Date(meeting.date).getTime();
    const durationChanged = newDuration !== meeting.duration;
    
    if (!titleChanged && !dateChanged && !durationChanged) {
      console.log(`No changes detected for meeting ${meeting.id}`);
      return;
    }
    
    console.log(`Changes detected for meeting ${meeting.id}:`);
    if (titleChanged) console.log(`Title changed from "${meeting.title}" to "${newTitle}"`);
    if (dateChanged) console.log(`Date changed from ${meeting.date} to ${newDate}`);
    if (durationChanged) console.log(`Duration changed from ${meeting.duration} to ${newDuration}`);
    
    // Record the change
    const meetingChange = await prisma.meetingChange.create({
      data: {
        meetingId: meeting.id,
        changeType: 'updated',
        eventId: eventId,
        changeData: data,
        previousTitle: titleChanged ? meeting.title : null,
        previousDate: dateChanged ? meeting.date : null,
        previousDuration: durationChanged ? meeting.duration : null,
        newTitle: titleChanged ? newTitle : null,
        newDate: dateChanged ? newDate : null,
        newDuration: durationChanged ? Number(newDuration) : null
      }
    });
    
    console.log(`Created meeting change record:`, meetingChange);
    
    // Update the meeting with the new details
    const updatedMeeting = await prisma.meeting.update({
      where: { id: meeting.id },
      data: {
        title: newTitle,
        date: newDate,
        duration: Number(newDuration),
        updatedAt: new Date()
      }
    });
    
    console.log(`Updated meeting ${meeting.id} with new details:`, updatedMeeting);
  } catch (error) {
    console.error('Error handling event.updated:', error);
  }
}

// Helper function to handle event.deleted webhook
async function handleEventDeleted(data: any) {
  try {
    console.log('Processing event.deleted webhook', JSON.stringify(data, null, 2));
    
    // Get the event ID from the webhook data with support for different formats
    const eventId = data.event_id || data.id || data.uuid || data.event_uuid;
    
    if (!eventId) {
      console.error('Missing event ID in deleted webhook data:', data);
      return;
    }
    
    console.log(`Looking for meeting with eventId: ${eventId}`);
    
    // Find the corresponding meeting in our database
    const meeting = await findMeetingByCalendarEventId(eventId);
    
    if (!meeting) {
      console.log(`No matching meeting found for deleted event ${eventId}`);
      return;
    }
    
    console.log(`Found meeting ${meeting.id} for deleted event ${eventId}`);
    
    // Record the deletion
    const meetingChange = await prisma.meetingChange.create({
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
    
    console.log(`Created meeting deletion record:`, meetingChange);
    
    // Update the meeting status to cancelled
    const updatedMeeting = await prisma.meeting.update({
      where: { id: meeting.id },
      data: {
        status: 'cancelled',
        updatedAt: new Date()
      }
    });
    
    console.log(`Marked meeting ${meeting.id} as cancelled due to deletion:`, updatedMeeting);
  } catch (error) {
    console.error('Error handling event.deleted:', error);
  }
}

// Helper function to find a meeting by calendar event ID
async function findMeetingByCalendarEventId(eventId: string) {
  try {
    console.log(`Searching for meeting with event ID: ${eventId}`);
    
    // First try to find by meetingBaasId (direct match)
    let meeting = await prisma.meeting.findFirst({
      where: {
        meetingBaasId: eventId
      }
    });
    
    if (meeting) {
      console.log(`Found meeting ${meeting.id} with meetingBaasId ${eventId}`);
      return meeting;
    }
    
    // If not found, try to find by checking the event ID in meeting changes
    meeting = await prisma.meeting.findFirst({
      where: {
        changes: {
          some: {
            eventId: eventId
          }
        }
      },
      include: {
        changes: {
          where: {
            eventId: eventId
          },
          take: 1
        }
      }
    });
    
    if (meeting) {
      console.log(`Found meeting ${meeting.id} through associated event ID ${eventId} in meeting changes`);
      return meeting;
    }
    
    // Additional fallback: check Google Calendar event IDs in the meeting data
    // This assumes your meeting might have calendar event details stored in it
    const meetings = await prisma.meeting.findMany({
      where: {
        googleMeetLink: {
          not: null
        }
      }
    });
    
    // Log that we're searching through all meetings as a last resort
    console.log(`Searching through ${meetings.length} meetings with Google Meet links for event ID ${eventId}`);
    
    // No meeting found with this event ID
    console.log(`No meeting found with event ID ${eventId}`);
    return null;
  } catch (error) {
    console.error(`Error finding meeting for event ${eventId}:`, error);
    return null;
  }
} 