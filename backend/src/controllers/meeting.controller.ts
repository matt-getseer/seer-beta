import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { MeetingBaasService } from '../services/meetingbaas.service';

const prisma = new PrismaClient();

/**
 * Get all meetings for the current user
 */
export const getMeetings = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    const meetings = await prisma.meeting.findMany({
      where: {
        createdBy: userId
      },
      orderBy: {
        date: 'desc'
      }
    });
    
    return res.status(200).json(meetings);
  } catch (error) {
    console.error('Error getting meetings:', error);
    return res.status(500).json({ 
      error: 'Failed to get meetings',
      details: error instanceof Error ? error.message : String(error)
    });
  }
};

/**
 * Get a specific meeting by ID
 */
export const getMeetingById = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const meetingId = req.params.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    const meeting = await prisma.meeting.findUnique({
      where: {
        id: meetingId,
        createdBy: userId
      }
    });
    
    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }
    
    return res.status(200).json(meeting);
  } catch (error) {
    console.error('Error getting meeting:', error);
    return res.status(500).json({ 
      error: 'Failed to get meeting',
      details: error instanceof Error ? error.message : String(error)
    });
  }
};

/**
 * Create a new meeting and integrate with MeetingBaas
 */
export const createMeeting = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    const { title, teamMemberId, date, duration } = req.body;
    
    // Validate required fields
    if (!title || !teamMemberId || !date || !duration) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        required: {
          title: Boolean(title),
          teamMemberId: Boolean(teamMemberId),
          date: Boolean(date),
          duration: Boolean(duration)
        }
      });
    }
    
    // Check if API key is configured
    if (!process.env.MEETINGBAAS_API_KEY) {
      return res.status(500).json({ 
        error: 'MeetingBaas API key not configured',
        details: 'Please add MEETINGBAAS_API_KEY to your environment variables'
      });
    }
    
    // Create meeting with MeetingBaas
    const meetingDate = new Date(date);
    try {
      // Create meeting in MeetingBaas
      const meetingBaasResponse = await MeetingBaasService.createMeeting({
        title,
        scheduledTime: meetingDate,
        duration: Number(duration),
        userId
      });
      
      // Create meeting in our database
      const meeting = await prisma.meeting.create({
        data: {
          title,
          teamMemberId,
          date: meetingDate,
          duration: Number(duration),
          status: 'scheduled',
          processingStatus: 'pending',
          googleMeetLink: meetingBaasResponse.googleMeetLink,
          meetingBaasId: meetingBaasResponse.id,
          createdBy: userId,
          wins: [],
          areasForSupport: [],
          actionItems: []
        }
      });
      
      return res.status(201).json(meeting);
    } catch (mbError) {
      console.error('Error with MeetingBaas service:', mbError);
      return res.status(500).json({ 
        error: 'Failed to create meeting with MeetingBaas', 
        details: mbError instanceof Error ? mbError.message : String(mbError),
        note: 'This could be due to invalid API credentials or connection issues with the MeetingBaas service'
      });
    }
  } catch (error) {
    console.error('Error creating meeting:', error);
    return res.status(500).json({ 
      error: 'Failed to create meeting',
      details: error instanceof Error ? error.message : String(error)
    });
  }
};

/**
 * Update a meeting
 */
export const updateMeeting = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const meetingId = req.params.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    // Check if meeting exists and belongs to user
    const existingMeeting = await prisma.meeting.findUnique({
      where: {
        id: meetingId,
        createdBy: userId
      }
    });
    
    if (!existingMeeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }
    
    // Update meeting
    const updatedMeeting = await prisma.meeting.update({
      where: { id: meetingId },
      data: req.body
    });
    
    return res.status(200).json(updatedMeeting);
  } catch (error) {
    console.error('Error updating meeting:', error);
    return res.status(500).json({ 
      error: 'Failed to update meeting',
      details: error instanceof Error ? error.message : String(error)
    });
  }
};

/**
 * Delete a meeting
 */
export const deleteMeeting = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const meetingId = req.params.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    // Check if meeting exists and belongs to user
    const existingMeeting = await prisma.meeting.findUnique({
      where: {
        id: meetingId,
        createdBy: userId
      }
    });
    
    if (!existingMeeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }
    
    // Delete meeting
    await prisma.meeting.delete({
      where: { id: meetingId }
    });
    
    return res.status(204).send();
  } catch (error) {
    console.error('Error deleting meeting:', error);
    return res.status(500).json({ 
      error: 'Failed to delete meeting',
      details: error instanceof Error ? error.message : String(error)
    });
  }
};

/**
 * Handle webhook for meeting completion
 */
export const handleMeetingCompleted = async (req: Request, res: Response) => {
  try {
    console.log('Received webhook payload:', JSON.stringify(req.body, null, 2));
    
    // Get the event type
    const eventType = req.body.event;
    const data = req.body.data;
    
    // MeetingBaas webhook format has bot_id nested in the data object
    const botId = data?.bot_id || req.body.bot_id || req.body.meetingId;
    
    if (!botId) {
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
    // Always return success to acknowledge receipt of the webhook
    return res.status(200).json({ message: 'Webhook received successfully' });
  } catch (error) {
    console.error('Error handling webhook:', error);
    return res.status(500).json({ 
      error: 'Failed to process webhook',
      details: error instanceof Error ? error.message : String(error)
    });
  }
}; 