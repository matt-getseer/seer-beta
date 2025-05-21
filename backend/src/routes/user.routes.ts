import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { Request, Response, NextFunction } from 'express';
import { authenticate, requireAuth, isAdmin } from '../middleware/auth.middleware';
import { sendInvitationEmail } from '../services/email.service';
import { generateInvitationToken, calculateExpiryDate } from '../utils/token.utils';
import dotenv from 'dotenv';
import crypto from 'crypto';

// Load environment variables
dotenv.config();

// Encryption key and initialization vector - should be stored securely
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'your-secure-encryption-key-at-least-32-chars';
const IV_LENGTH = 16; // For AES, this is always 16

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

// Helper functions for encryption/decryption
function encrypt(text: string): string {
  // Ensure we have a 32-byte key by hashing the original key
  const key = crypto.createHash('sha256').update(String(ENCRYPTION_KEY)).digest();
  
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decrypt(text: string): string {
  // Ensure we have a 32-byte key by hashing the original key
  const key = crypto.createHash('sha256').update(String(ENCRYPTION_KEY)).digest();
  
  const textParts = text.split(':');
  const iv = Buffer.from(textParts[0], 'hex');
  const encryptedText = Buffer.from(textParts[1], 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString();
}

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

// Get all pending invitations
router.get('/invitations', isAdmin, async (req: Request, res: Response) => {
  try {
    const adminId = req.user?.id;
    
    const invitations = await prisma.teamInvitation.findMany({
      where: {
        inviterId: adminId,
        status: 'pending',
        expires: { gt: new Date() }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    res.json(invitations);
  } catch (error) {
    console.error('Error fetching invitations:', error);
    res.status(500).json({ 
      error: 'Error fetching invitations',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// Get user by ID - accessible to all authenticated users
router.get('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({ error: 'User ID is required' });
    }
    
    const user = await prisma.user.findUnique({
      where: { id }
    });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(user);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ 
      error: 'Error fetching user',
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

// Cancel an invitation
router.delete('/invitations/:id', isAdmin, async (req: Request, res: Response) => {
  try {
    const adminId = req.user?.id;
    const invitationId = req.params.id;
    
    if (!invitationId) {
      return res.status(400).json({ error: 'Invalid invitation ID' });
    }
    
    // Check if the invitation exists and belongs to this admin
    const invitation = await prisma.teamInvitation.findFirst({
      where: {
        id: invitationId,
        inviterId: adminId
      }
    });
    
    if (!invitation) {
      return res.status(404).json({ error: 'Invitation not found or not created by you' });
    }
    
    // Delete the invitation
    await prisma.teamInvitation.delete({
      where: { id: invitationId }
    });
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error canceling invitation:', error);
    res.status(500).json({ 
      error: 'Error canceling invitation',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// Send an invitation to join a team
router.post('/invite', isAdmin, async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    const adminId = req.user?.id;
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }
    
    // Verify the admin can invite more users
    const memberCount = await prisma.user.count({
      where: { adminId }
    });
    
    if (memberCount >= 3) {
      return res.status(403).json({ 
        error: 'You have reached the maximum number of team members',
        canInvite: false,
        currentCount: memberCount,
        remainingInvites: 0
      });
    }
    
    // Check if the user is already part of this team
    const existingMember = await prisma.user.findFirst({
      where: {
        email,
        adminId
      }
    });
    
    if (existingMember) {
      return res.status(400).json({ error: 'This user is already a member of your team' });
    }
    
    // Check if there's an existing pending invitation
    const existingInvitation = await prisma.teamInvitation.findFirst({
      where: {
        email,
        inviterId: adminId,
        status: 'pending',
        expires: { gt: new Date() }
      }
    });
    
    if (existingInvitation) {
      return res.status(400).json({ error: 'A pending invitation already exists for this email' });
    }
    
    // Get the admin user for the invitation email
    const admin = await prisma.user.findUnique({
      where: { id: adminId }
    });
    
    if (!admin) {
      return res.status(404).json({ error: 'Admin user not found' });
    }
    
    // Generate a token and create an invitation
    const token = generateInvitationToken();
    const expires = calculateExpiryDate(7); // 7 days
    
    const invitation = await prisma.teamInvitation.create({
      data: {
        email,
        token,
        expires,
        inviterId: adminId,
        status: 'pending'
      }
    });
    
    // Send the invitation email
    const emailSent = await sendInvitationEmail(
      email,
      admin.name || 'Your colleague',
      token
    );
    
    if (!emailSent) {
      // If email fails, still create the invitation but return a warning
      return res.status(207).json({
        invitation,
        warning: 'Invitation created but email failed to send'
      });
    }
    
    // Return the updated invitation count along with success message
    const updatedMemberCount = await prisma.user.count({
      where: { adminId }
    });
    
    const pendingInvitationsCount = await prisma.teamInvitation.count({
      where: {
        inviterId: adminId,
        status: 'pending',
        expires: { gt: new Date() }
      }
    });
    
    res.status(201).json({
      success: true,
      message: `Invitation sent to ${email}`,
      inviteStatus: {
        canInvite: (updatedMemberCount + pendingInvitationsCount) < 3,
        currentCount: updatedMemberCount,
        pendingInvitations: pendingInvitationsCount,
        remainingInvites: 3 - updatedMemberCount - pendingInvitationsCount
      }
    });
  } catch (error) {
    console.error('Error sending invitation:', error);
    res.status(500).json({ 
      error: 'Error sending invitation',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// Accept an invitation
router.post('/invite/accept', async (req: Request, res: Response) => {
  try {
    const { token, clerkId } = req.body;
    
    console.log('Accepting invitation with token:', token, 'and clerkId:', clerkId);
    
    if (!token) {
      return res.status(400).json({ error: 'Token is required' });
    }
    
    if (!clerkId) {
      return res.status(400).json({ error: 'User authentication is required' });
    }
    
    // Find the invitation
    const invitation = await prisma.teamInvitation.findUnique({
      where: {
        token,
        status: 'pending',
        expires: { gt: new Date() }
      },
      include: {
        inviter: true
      }
    });
    
    if (!invitation) {
      return res.status(404).json({ error: 'Invalid or expired invitation' });
    }
    
    console.log('Found invitation:', invitation);
    
    // Find or create the user
    let user = await prisma.user.findFirst({
      where: { clerkId }
    });
    
    console.log('Existing user:', user);
    
    // If the user doesn't exist, create them
    if (!user) {
      user = await prisma.user.create({
        data: {
          email: invitation.email,
          clerkId,
          role: 'user',
          adminId: invitation.inviterId
        }
      });
      console.log('Created new user with adminId:', invitation.inviterId);
    } else {
      // If the user exists, update their adminId
      user = await prisma.user.update({
        where: { id: user.id },
        data: { adminId: invitation.inviterId }
      });
      console.log('Updated existing user with adminId:', invitation.inviterId);
    }
    
    // Update the invitation status
    await prisma.teamInvitation.update({
      where: { id: invitation.id },
      data: { status: 'accepted' }
    });
    
    console.log('Invitation accepted, returning user:', user);
    
    res.json({
      success: true,
      message: 'Invitation accepted',
      user
    });
  } catch (error) {
    console.error('Error accepting invitation:', error);
    res.status(500).json({ 
      error: 'Error accepting invitation',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// Get team members for meetings (used by the meeting creation form)
router.get('/team', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    
    console.log(`Fetching team members for user: ${userId}`);
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    // Get user role
    const currentUser = await prisma.user.findUnique({
      where: { id: userId }
    });
    
    if (!currentUser) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    console.log(`User role: ${currentUser.role}, adminId: ${currentUser.adminId || 'none'}`);
    
    let teamMembers = [];
    
    if (currentUser.role === 'admin') {
      // For admins, get their team members
      teamMembers = await prisma.user.findMany({
        where: { 
          OR: [
            { adminId: userId },
            { id: userId } // Include the admin themselves
          ]
        },
        select: {
          id: true,
          name: true,
          email: true
        }
      });
    } else {
      // For regular users, just return themselves and their admin
      teamMembers = await prisma.user.findMany({
        where: {
          OR: [
            { id: userId },
            { id: currentUser.adminId || '' } // Include their admin if they have one
          ]
        },
        select: {
          id: true,
          name: true,
          email: true
        }
      });
    }
    
    console.log(`Found ${teamMembers.length} team members`);
    console.log('Team members:', JSON.stringify(teamMembers, null, 2));
    
    res.json(teamMembers);
  } catch (error) {
    console.error('Error fetching team:', error);
    res.status(500).json({ 
      error: 'Error fetching team',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// Get AI settings
router.get('/ai-settings', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    // Fetch user's AI settings from database
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        useCustomAI: true,
        aiProvider: true,
        // Do not return the actual API keys for security
        hasAnthropicKey: true,
        hasOpenAIKey: true
      }
    });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Transform the data to a safer format for the frontend
    const settings = {
      useCustomAI: user.useCustomAI || false,
      aiProvider: user.aiProvider || 'anthropic',
      hasAnthropicKey: user.hasAnthropicKey || false,
      hasOpenAIKey: user.hasOpenAIKey || false
    };
    
    res.json(settings);
  } catch (error) {
    console.error('Error fetching AI settings:', error);
    res.status(500).json({ 
      error: 'Error fetching AI settings',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// Save AI settings
router.post('/ai-settings', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const { useCustomAI, aiProvider, apiKey } = req.body;
    
    // Validate inputs
    if (typeof useCustomAI !== 'boolean') {
      return res.status(400).json({ error: 'Invalid useCustomAI value' });
    }
    
    if (aiProvider !== 'anthropic' && aiProvider !== 'openai') {
      return res.status(400).json({ error: 'Invalid AI provider' });
    }
    
    // Prepare data to update
    const updateData: any = {
      useCustomAI,
      aiProvider
    };
    
    // If an API key is provided, encrypt and store it
    if (apiKey) {
      try {
        const encryptedKey = encrypt(apiKey);
        
        if (aiProvider === 'anthropic') {
          updateData.anthropicApiKey = encryptedKey;
          updateData.hasAnthropicKey = true;
        } else {
          updateData.openaiApiKey = encryptedKey;
          updateData.hasOpenAIKey = true;
        }
      } catch (encryptError) {
        console.error('Error encrypting API key:', encryptError);
        return res.status(500).json({ error: 'Failed to secure API key' });
      }
    }
    
    // Update the user in the database
    await prisma.user.update({
      where: { id: userId },
      data: updateData
    });
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error saving AI settings:', error);
    res.status(500).json({ 
      error: 'Error saving AI settings',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

export default router; 