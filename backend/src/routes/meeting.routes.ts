import express from 'express';
import {
  getMeetings,
  getMeetingById,
  createMeeting,
  updateMeeting,
  deleteMeeting,
  handleMeetingCompleted
} from '../controllers/meeting.controller';
import { authenticate } from '../middleware/auth.middleware';
import { verifyMeetingBaasWebhook } from '../middleware/webhookAuth.middleware';

const router = express.Router();

// Apply authentication middleware to all routes except webhooks
router.use((req, res, next) => {
  if (req.path === '/webhook') {
    return next();
  }
  return authenticate(req, res, next);
});

// Get all meetings
router.get('/', getMeetings);

// Get a specific meeting
router.get('/:id', getMeetingById);

// Create a meeting
router.post('/', createMeeting);

// Update a meeting
router.put('/:id', updateMeeting);

// Delete a meeting
router.delete('/:id', deleteMeeting);

// Webhook endpoint for meeting completion
// Apply webhook verification middleware
router.post('/webhook', verifyMeetingBaasWebhook, handleMeetingCompleted);

export default router; 