import express from 'express';
import {
  getMeetings,
  getMeetingById,
  createMeeting,
  updateMeeting,
  deleteMeeting,
  handleMeetingCompleted,
  getMeetingsByTeamMember,
  analyzeTeamMemberMeetings
} from '../controllers/meeting.controller';
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
router.get('/', requireAuth, getMeetings);

// Get meetings by team member - this specific route must come before /:id
router.get('/team-member/:teamMemberId', requireAuth, getMeetingsByTeamMember);

// Analyze team member meetings - this specific route must come before /:id
router.get('/analyze/:teamMemberId', requireAuth, analyzeTeamMemberMeetings);

// Get a specific meeting
router.get('/:id', requireAuth, getMeetingById);

// Write operations - accessible only to admins
// Create a meeting - only admin can create meetings
router.post('/', isAdmin, createMeeting);

// Update a meeting - only admin can update meetings
router.put('/:id', isAdmin, updateMeeting);

// Delete a meeting - only admin can delete meetings
router.delete('/:id', isAdmin, deleteMeeting);

// Webhook endpoint for meeting completion
// Apply webhook verification middleware
router.post('/webhook', verifyMeetingBaasWebhook, handleMeetingCompleted);

export default router; 