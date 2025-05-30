import { Router } from 'express';
import { CalendarController } from '../controllers/calendar.controller';
import { authenticate, requireAuth } from '../middleware/auth.middleware';

const router = Router();
const calendarController = new CalendarController();

// All routes require authentication
router.use(authenticate);
router.use(requireAuth);

// Integration status and setup
router.get('/integration/status', calendarController.getIntegrationStatus);
router.post('/integration/setup', calendarController.setupIntegration);

// Event management with recording capabilities
router.post('/events', calendarController.createEvent);
router.get('/events', calendarController.listEvents);
router.get('/events/:eventId', calendarController.getEvent);
router.put('/events/:eventId', calendarController.updateEvent);
router.delete('/events/:eventId', calendarController.deleteEvent);

// Recording management for events
router.post('/events/:eventId/recording', calendarController.enableRecording);
router.delete('/events/:eventId/recording', calendarController.disableRecording);

export default router; 