import { Router } from 'express';
import { authenticate, requireAuth, isAdmin } from '../middleware/auth.middleware';
import { AuthController } from '../controllers/auth.controller';
import { TeamController } from '../controllers/team.controller';
import { APIKeyController } from '../controllers/api-key.controller';

// Extend the Express Request type to include user property
declare global {
  namespace Express {
    interface Request {
      user?: any;
      auth?: {
        userId: string;
        sessionId: string;
        clerkId: string;
      };
    }
  }
}

const router = Router();

// Apply the authentication middleware to all routes
router.use(authenticate);

// Auth routes
router.post('/register', AuthController.register);
router.get('/me', requireAuth, AuthController.getCurrentUser);

// Debug routes (development only)
if (process.env.NODE_ENV !== 'production') {
  router.get('/debug/:clerkId', AuthController.getDebugUserInfo);
}

// Team routes
router.get('/team-members', isAdmin, TeamController.getTeamMembers);
router.get('/can-invite', isAdmin, TeamController.canInvite);
router.delete('/team-members/:id', isAdmin, TeamController.removeTeamMember);
router.get('/invitations', isAdmin, TeamController.getPendingInvitations);
router.delete('/invitations/:id', isAdmin, TeamController.cancelInvitation);
router.post('/invite', isAdmin, TeamController.sendInvitation);
router.post('/invite/accept', TeamController.acceptInvitation);
router.get('/team', requireAuth, TeamController.getTeam);

// API Key routes
router.get('/ai-settings', requireAuth, APIKeyController.getAISettings);
router.post('/ai-settings', requireAuth, APIKeyController.saveAISettings);

// Generic user routes - must come after specific paths to avoid catching them
router.get('/:id', requireAuth, AuthController.getUserById);
router.get('/', AuthController.getAllUsers);

export default router; 