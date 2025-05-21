import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { MeetingBaasService } from '../services/meetingbaas.service';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

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
  }
} 