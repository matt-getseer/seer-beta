import express from 'express';
import { MeetingController } from '../controllers/meeting.controller';
import { MeetingWebhookController } from '../controllers/meeting-webhook.controller';
import { MeetingAnalysisController } from '../controllers/meeting-analysis.controller';
import { TaskController } from '../controllers/task.controller';
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
// Get all meetings with team member information (optimized)
router.get('/with-team-members', requireAuth, MeetingController.getMeetingsWithTeamMembers);

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

// Task routes
// Get all tasks across all meetings (admin only)
router.get('/tasks/all', isAdmin, TaskController.getAllTasks);

// Get all tasks for a meeting
router.get('/:id/tasks', requireAuth, TaskController.getTasks);

// Create a new task
router.post('/:id/tasks', requireAuth, TaskController.createTask);

// Update a task
router.patch('/:id/tasks/:taskId', requireAuth, TaskController.updateTask);

// Approve a suggested task
router.patch('/:id/tasks/:taskId/approve', requireAuth, TaskController.approveSuggestedTask);

// Delete a task
router.delete('/:id/tasks/:taskId', requireAuth, TaskController.deleteTask);

// Write operations - accessible only to admins
// Create a meeting - only admin can create meetings
router.post('/', isAdmin, MeetingController.createMeeting);

// Update a meeting - only admin can update meetings
router.put('/:id', isAdmin, MeetingController.updateMeeting);

// Delete a meeting - only admin can delete meetings
router.delete('/:id', isAdmin, MeetingController.deleteMeeting);

// Bot management routes
router.post('/:meetingId/bot', requireAuth, MeetingController.addBotToMeeting);

// Webhook endpoint for meeting completion
// Apply webhook verification middleware
router.post('/webhook', verifyMeetingBaasWebhook, MeetingWebhookController.handleMeetingCompleted);

// Generate agenda for a meeting
router.get('/:meetingId/agenda', requireAuth, MeetingController.generateAgenda);

// Generate task suggestions based on areas for support
router.post('/:id/suggest-tasks', requireAuth, MeetingController.suggestTasks);

export default router; 