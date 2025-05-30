import { Router } from 'express';
import { MeetingBaasController } from '../controllers/meetingbaas.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();
const meetingBaasController = new MeetingBaasController();

// Calendar Integration Routes
router.post('/calendar/setup', authenticate, meetingBaasController.setupCalendarIntegration);
router.post('/calendar/list-available', authenticate, meetingBaasController.listAvailableCalendars);
router.get('/calendar/integrations', authenticate, meetingBaasController.getUserCalendarIntegrations);
router.delete('/calendar/integrations/:provider', authenticate, meetingBaasController.deleteCalendarIntegration);

// Calendar Events Routes
router.get('/calendar/events', authenticate, meetingBaasController.getCalendarEvents);
router.post('/calendar/events/:eventId/schedule-recording', authenticate, meetingBaasController.scheduleEventRecording);
router.delete('/calendar/events/:eventId/schedule-recording', authenticate, meetingBaasController.unscheduleEventRecording);

// Calendar Sync Routes
router.post('/calendar/sync', authenticate, meetingBaasController.syncCalendarEvents);
router.post('/calendar/auto-schedule', authenticate, meetingBaasController.autoScheduleRecordings);

// Bot Management Routes
router.post('/bots', authenticate, meetingBaasController.createBot);
router.get('/bots/:botId', authenticate, meetingBaasController.getBot);
router.delete('/bots/:botId', authenticate, meetingBaasController.endBot);
router.get('/bots', authenticate, meetingBaasController.listRecentBots);
router.post('/bots/:botId/retranscribe', authenticate, meetingBaasController.retranscribeBot);

// Webhook Routes (no authentication required for webhooks)
router.post('/webhooks', meetingBaasController.handleWebhook);
// Temporarily disabled webhook auth for testing:
// router.post('/webhooks', verifyMeetingBaasWebhook, meetingBaasController.handleWebhook);

export default router; 