import express from 'express';
import { MeetingController } from '../controllers/meeting.controller';
import { MeetingWebhookController } from '../controllers/meeting-webhook.controller';
import { MeetingAnalysisController } from '../controllers/meeting-analysis.controller';
import { ActionItemController } from '../controllers/action-item.controller';
import { authenticate, requireAuth, isAdmin } from '../middleware/auth.middleware';
import { verifyMeetingBaasWebhook } from '../middleware/webhookAuth.middleware';

const router = express.Router();

// Apply authentication middleware to all routes except webhooks
router.use((req, res, next) => {
  if (req.path === '/webhook') {
    return next();
  }
  return authenticate(req, res, next);
});

// Read operations - accessible to all authenticated users
// Get all meetings
router.get('/', requireAuth, MeetingController.getMeetings);

// Get meetings by team member - this specific route must come before /:id
router.get('/team-member/:teamMemberId', requireAuth, MeetingAnalysisController.getMeetingsByTeamMember);

// Analyze team member meetings - this specific route must come before /:id
router.get('/analyze/:teamMemberId', requireAuth, MeetingAnalysisController.analyzeTeamMemberMeetings);

// Get analysis history for a team member
router.get('/analysis-history/:teamMemberId', requireAuth, MeetingAnalysisController.getAnalysisHistory);

// Get a specific analysis by ID
router.get('/analysis/:teamMemberId/:analysisId', requireAuth, MeetingAnalysisController.getAnalysisById);

// Get a specific meeting
router.get('/:id', requireAuth, MeetingController.getMeetingById);

// Get meeting changes history
router.get('/:id/changes', requireAuth, MeetingController.getMeetingChanges);

// Action Item routes
// Get all action items for a meeting
router.get('/:id/action-items', requireAuth, ActionItemController.getActionItems);

// Create a new action item
router.post('/:id/action-items', requireAuth, ActionItemController.createActionItem);

// Update an action item
router.patch('/:id/action-items/:actionItemId', requireAuth, ActionItemController.updateActionItem);

// Delete an action item
router.delete('/:id/action-items/:actionItemId', requireAuth, ActionItemController.deleteActionItem);

// Write operations - accessible only to admins
// Create a meeting - only admin can create meetings
router.post('/', isAdmin, MeetingController.createMeeting);

// Update a meeting - only admin can update meetings
router.put('/:id', isAdmin, MeetingController.updateMeeting);

// Delete a meeting - only admin can delete meetings
router.delete('/:id', isAdmin, MeetingController.deleteMeeting);

// Webhook endpoint for meeting completion
// Apply webhook verification middleware
router.post('/webhook', verifyMeetingBaasWebhook, MeetingWebhookController.handleMeetingCompleted);

// Generate agenda for a meeting
router.get('/:meetingId/agenda', requireAuth, MeetingController.generateAgenda);

export default router; 