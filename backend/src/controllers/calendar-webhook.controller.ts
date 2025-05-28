import { Request, Response } from 'express';
import { MeetingBaasCalendarService } from '../services/meetingbaas/calendar.service';

export class CalendarWebhookController {
  /**
   * Handle calendar webhook events from MeetingBaas
   */
  static async handleCalendarWebhook(req: Request, res: Response) {
    try {
      console.log('Received calendar webhook:', JSON.stringify(req.body, null, 2));

      const webhookData = req.body;
      
      // TODO: Implement calendar webhook handling when MeetingBaas calendar service supports it
      console.log('Calendar webhook handling not yet implemented');
      
      res.status(200).json({ 
        success: true, 
        message: 'Calendar webhook received but handling not yet implemented' 
      });

    } catch (error) {
      console.error('Error handling calendar webhook:', error);
      res.status(500).json({ 
        error: 'Failed to process calendar webhook',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Health check for calendar webhook endpoint
   */
  static async healthCheck(req: Request, res: Response) {
    try {
      const isEnabled = MeetingBaasCalendarService.isCalendarIntegrationEnabled();
      
      return res.status(200).json({
        status: 'ok',
        calendarIntegrationEnabled: isEnabled,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error in calendar webhook health check:', error);
      return res.status(500).json({
        status: 'error',
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString()
      });
    }
  }
} 