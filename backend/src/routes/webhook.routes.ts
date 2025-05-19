import { Router } from 'express';
import { handleClerkWebhook } from '../webhooks/clerk';

const router = Router();

// Clerk webhook route
router.post('/clerk', handleClerkWebhook);

export default router; 