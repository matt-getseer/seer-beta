import { Router } from 'express';
import { handleClerkWebhook } from '../webhooks/clerk';
import { CalendarWebhookController } from '../controllers/calendar-webhook.controller';
import { verifyMeetingBaasWebhook } from '../middleware/webhookAuth.middleware';

const router = Router();

// Clerk webhook route (no auth needed - Clerk handles its own verification)
router.post('/clerk', handleClerkWebhook);

// MeetingBaas Calendar webhook routes (with API key verification)
router.post('/calendar', verifyMeetingBaasWebhook, CalendarWebhookController.handleCalendarWebhook);

// Google Calendar specific webhook route (for direct Google Calendar webhooks if needed)
router.post('/google-calendar', verifyMeetingBaasWebhook, CalendarWebhookController.handleGoogleCalendarWebhook);

// Calendar webhook health check (no auth needed for health checks)
router.get('/calendar/health', CalendarWebhookController.healthCheck);

export default router; 