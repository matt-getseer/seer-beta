import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { Request, Response, NextFunction } from 'express';
import { authenticate, requireAuth, isAdmin } from '../middleware/auth.middleware';

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
const prisma = new PrismaClient();

// Apply the authentication middleware to all routes
router.use(authenticate);

// Register a new user or retrieve existing user
router.post('/register', requireAuth, async (req: Request, res: Response) => {
  try {
    if (!req.auth?.clerkId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { name, email } = req.body;
    const clerkId = req.auth.clerkId;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Check if the user already exists by clerkId or email
    let user = await prisma.user.findFirst({
      where: {
        OR: [
          { clerkId },
          { email }
        ]
      }
    });

    if (user) {
      // If the user exists but has a different clerkId, update it
      if (user.clerkId !== clerkId) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { clerkId }
        });
        console.log(`Updated clerkId for existing user: ${email}`);
      }
      return res.json(user);
    }

    // User doesn't exist, create a new one
    // Check if this is the first user (make them admin)
    const userCount = await prisma.user.count();
    const isFirstUser = userCount === 0;

    user = await prisma.user.create({
      data: {
        email,
        name: name || null,
        role: isFirstUser ? 'admin' : 'user',
        clerkId
      }
    });

    console.log(`User created via API: ${email} with role: ${isFirstUser ? 'admin' : 'user'}`);
    res.status(201).json(user);
  } catch (error) {
    console.error('Error registering user:', error);
    res.status(500).json({ 
      error: 'Error registering user',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// Get all users
router.get('/', async (req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany();
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ 
      error: 'Error fetching users',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// Get current user
router.get('/me', requireAuth, async (req: Request, res: Response) => {
  try {
    if (!req.auth?.clerkId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Find user by clerkId
    const user = await prisma.user.findUnique({
      where: { clerkId: req.auth.clerkId }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Error fetching current user:', error);
    res.status(500).json({ 
      error: 'Error fetching current user',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// Get team members for an admin
router.get('/team-members', isAdmin, async (req: Request, res: Response) => {
  try {
    const adminId = req.user?.id;
    
    const teamMembers = await prisma.user.findMany({
      where: { adminId }
    });
    
    res.json(teamMembers);
  } catch (error) {
    console.error('Error fetching team members:', error);
    res.status(500).json({ 
      error: 'Error fetching team members',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// Remove a team member (admin only)
router.delete('/team-members/:id', isAdmin, async (req: Request, res: Response) => {
  try {
    const adminId = req.user?.id;
    const memberId = req.params.id;
    
    if (!memberId) {
      return res.status(400).json({ error: 'Invalid member ID' });
    }
    
    // Check if the user exists and is a team member of this admin
    const member = await prisma.user.findFirst({
      where: {
        id: memberId,
        adminId
      }
    });
    
    if (!member) {
      return res.status(404).json({ error: 'Team member not found or not part of your team' });
    }
    
    // Update the user to remove them from the team (set adminId to null)
    await prisma.user.update({
      where: { id: memberId },
      data: { adminId: null }
    });
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error removing team member:', error);
    res.status(500).json({ 
      error: 'Error removing team member',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// Check if admin can invite more team members
router.get('/can-invite', isAdmin, async (req: Request, res: Response) => {
  try {
    const adminId = req.user?.id;
    
    const memberCount = await prisma.user.count({
      where: { adminId }
    });
    
    res.json({ 
      canInvite: memberCount < 3,
      currentCount: memberCount,
      remainingInvites: 3 - memberCount
    });
  } catch (error) {
    console.error('Error checking invitation ability:', error);
    res.status(500).json({ 
      error: 'Error checking invitation ability',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

export default router; 