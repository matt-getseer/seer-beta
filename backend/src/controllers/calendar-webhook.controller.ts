import { Request, Response } from 'express';
import { CalendarService } from '../services/calendar.service';
import fs from 'fs';
import path from 'path';

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Log calendar webhook data to file for debugging
function logCalendarWebhook(eventType: string, data: any) {
  const logFile = path.join(logsDir, 'calendar-webhooks.log');
  const timestamp = new Date().toISOString();
  const logEntry = `${timestamp} - ${eventType}: ${JSON.stringify(data, null, 2)}\n\n`;
  
  fs.appendFile(logFile, logEntry, (err) => {
    if (err) console.error('Error writing to calendar webhook log:', err);
  });
}

export class CalendarWebhookController {
  /**
   * Handle calendar webhook events from MeetingBaas
   */
  static async handleCalendarWebhook(req: Request, res: Response) {
    try {
      console.log('📅 Received calendar webhook payload:', JSON.stringify(req.body, null, 2));
      
      // Get the event type and data
      const eventType = req.body.event || req.body.type;
      const data = req.body.data || req.body;
      
      // Log all calendar webhooks for debugging
      logCalendarWebhook(eventType, req.body);
      
      if (!eventType) {
        console.warn('⚠️ Calendar webhook missing event type');
        return res.status(400).json({ 
          error: 'Missing event type in webhook payload',
          receivedPayload: req.body 
        });
      }
      
      console.log(`🔄 Processing calendar event: ${eventType}`);
      
      // Handle the calendar event using CalendarService
      await CalendarService.handleCalendarWebhook({
        event_type: eventType,
        data: data
      });
      
      console.log(`✅ Successfully processed calendar event: ${eventType}`);
      
      // Always return success to acknowledge receipt of the webhook
      return res.status(200).json({ 
        message: 'Calendar webhook received successfully',
        eventType: eventType,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('❌ Error handling calendar webhook:', error);
      
      // Log the error but still return 200 to MeetingBaas to prevent retries
      // for unrecoverable errors
      return res.status(200).json({ 
        message: 'Calendar webhook received but processing failed',
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Handle Google Calendar specific events
   */
  static async handleGoogleCalendarWebhook(req: Request, res: Response) {
    try {
      console.log('📅 Received Google Calendar webhook:', JSON.stringify(req.body, null, 2));
      
      // Google Calendar webhooks have a different structure
      const eventType = req.body.event || 'google.calendar.event';
      const data = req.body;
      
      // Log Google calendar webhooks
      logCalendarWebhook(`google.${eventType}`, data);
      
      // Process through the calendar service
      await CalendarService.handleCalendarWebhook({
        event_type: eventType,
        data: data
      });
      
      return res.status(200).json({ 
        message: 'Google Calendar webhook processed successfully',
        eventType: eventType
      });
      
    } catch (error) {
      console.error('❌ Error handling Google Calendar webhook:', error);
      
      return res.status(200).json({ 
        message: 'Google Calendar webhook received but processing failed',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Health check endpoint for calendar webhooks
   */
  static async healthCheck(req: Request, res: Response) {
    try {
      const isEnabled = CalendarService.isCalendarIntegrationEnabled();
      
      return res.status(200).json({
        status: 'ok',
        calendarIntegrationEnabled: isEnabled,
        timestamp: new Date().toISOString(),
        message: 'Calendar webhook endpoint is healthy'
      });
      
    } catch (error) {
      return res.status(500).json({
        status: 'error',
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString()
      });
    }
  }
} 