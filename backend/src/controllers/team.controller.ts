import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { sendInvitationEmail } from '../services/email.service';
import { generateInvitationToken, calculateExpiryDate } from '../utils/token.utils';

// Using singleton Prisma client from utils/prisma

export class TeamController {
  /**
   * Get team members for an admin
   */
  static async getTeamMembers(req: Request, res: Response) {
    try {
      const adminId = req.user?.id;
      
      // Use indexed query with selected fields for better performance
      const teamMembers = await prisma.user.findMany({
        where: { adminId },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          createdAt: true,
          updatedAt: true,
          lastAnalyzedAt: true
        },
        orderBy: {
          createdAt: 'desc'
        }
      });
      
      res.json(teamMembers);
    } catch (error) {
      console.error('Error fetching team members:', error);
      res.status(500).json({ 
        error: 'Error fetching team members',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Check if admin can invite more team members
   */
  static async canInvite(req: Request, res: Response) {
    try {
      const adminId = req.user?.id;
      
      const memberCount = await prisma.user.count({
        where: { adminId }
      });
      
      const pendingInvitationsCount = await prisma.teamInvitation.count({
        where: {
          inviterId: adminId,
          status: 'pending',
          expires: { gt: new Date() }
        }
      });
      
      // Total count should include the admin (1) + members + pending invitations
      const totalCount = 1 + memberCount + pendingInvitationsCount;
      
      res.json({ 
        canInvite: totalCount < 4,
        currentCount: memberCount,
        pendingInvitations: pendingInvitationsCount,
        remainingInvites: 4 - totalCount
      });
    } catch (error) {
      console.error('Error checking invitation ability:', error);
      res.status(500).json({ 
        error: 'Error checking invitation ability',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Remove a team member (admin only)
   */
  static async removeTeamMember(req: Request, res: Response) {
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
  }

  /**
   * Get all pending invitations
   */
  static async getPendingInvitations(req: Request, res: Response) {
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
  }

  /**
   * Cancel an invitation
   */
  static async cancelInvitation(req: Request, res: Response) {
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
  }

  /**
   * Send an invitation to join a team
   */
  static async sendInvitation(req: Request, res: Response) {
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
      
      const pendingInvitationsCount = await prisma.teamInvitation.count({
        where: {
          inviterId: adminId,
          status: 'pending',
          expires: { gt: new Date() }
        }
      });
      
      // Total count should include the admin (1) + members + pending invitations  
      const totalCount = 1 + memberCount + pendingInvitationsCount;
      
      if (totalCount >= 4) {
        return res.status(403).json({ 
          error: 'You have reached the maximum number of team members',
          canInvite: false,
          currentCount: memberCount,
          pendingInvitations: pendingInvitationsCount,
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
      
      const updatedPendingInvitationsCount = await prisma.teamInvitation.count({
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
          canInvite: (1 + updatedMemberCount + updatedPendingInvitationsCount) < 4,
          currentCount: updatedMemberCount,
          pendingInvitations: updatedPendingInvitationsCount,
          remainingInvites: 4 - (1 + updatedMemberCount + updatedPendingInvitationsCount)
        }
      });
    } catch (error) {
      console.error('Error sending invitation:', error);
      res.status(500).json({ 
        error: 'Error sending invitation',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Accept an invitation
   */
  static async acceptInvitation(req: Request, res: Response) {
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
  }

  /**
   * Get team members for meetings (used by the meeting creation form)
   */
  static async getTeam(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      
      console.log(`Fetching team members for user: ${userId}`);
      
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }
      
      // Get user role and team members in a single optimized query
      const currentUser = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          adminId: true,
          // Include team members if user is admin
          teamMembers: {
            select: {
              id: true,
              name: true,
              email: true
            }
          },
          // Include admin if user is not admin
          admin: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        }
      });
      
      if (!currentUser) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      console.log(`User role: ${currentUser.role}, adminId: ${currentUser.adminId || 'none'}`);
      
      let teamMembers = [];
      
      if (currentUser.role === 'admin') {
        // For admins, include themselves and their team members
        teamMembers = [
          {
            id: currentUser.id,
            name: currentUser.name,
            email: currentUser.email
          },
          ...currentUser.teamMembers
        ];
      } else {
        // For regular users, include themselves and their admin (if they have one)
        teamMembers = [
          {
            id: currentUser.id,
            name: currentUser.name,
            email: currentUser.email
          }
        ];
        
        if (currentUser.admin) {
          teamMembers.push({
            id: currentUser.admin.id,
            name: currentUser.admin.name,
            email: currentUser.admin.email
          });
        }
      }
      
      console.log(`Found ${teamMembers.length} team members`);
      
      res.json(teamMembers);
    } catch (error) {
      console.error('Error fetching team:', error);
      res.status(500).json({ 
        error: 'Error fetching team',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Get key areas for a team member
   */
  static async getKeyAreas(req: Request, res: Response) {
    try {
      const { userId } = req.params;
      
      if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
      }
      
      // Get user to check if they exist
      const user = await prisma.user.findUnique({
        where: { id: userId }
      });
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      // Check if the current user is an admin or the user themselves
      const currentUserId = req.user?.id;
      const isAdmin = req.user?.role === 'admin';
      const isSelf = currentUserId === userId;
      
      if (!isAdmin && !isSelf) {
        return res.status(403).json({ error: 'Unauthorized to access this user\'s key areas' });
      }
      
      // Get key areas for the user
      const keyAreas = await prisma.keyArea.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        include: {
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        }
      });
      
      res.json(keyAreas);
    } catch (error) {
      console.error('Error fetching key areas:', error);
      res.status(500).json({ 
        error: 'Error fetching key areas',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  }
  
  /**
   * Create a key area for a team member (admin only)
   */
  static async createKeyArea(req: Request, res: Response) {
    try {
      const { userId } = req.params;
      const { name, description } = req.body;
      const adminId = req.user?.id;
      
      if (!userId || !name || !description) {
        return res.status(400).json({ 
          error: 'User ID, name, and description are required' 
        });
      }
      
      // Check if the user exists and is a team member of this admin
      const user = await prisma.user.findFirst({
        where: {
          id: userId,
          adminId
        }
      });
      
      if (!user) {
        return res.status(404).json({ 
          error: 'Team member not found or not part of your team' 
        });
      }
      
      // Create the key area
      const keyArea = await prisma.keyArea.create({
        data: {
          name,
          description,
          userId,
          createdById: adminId
        }
      });
      
      res.status(201).json(keyArea);
    } catch (error) {
      console.error('Error creating key area:', error);
      res.status(500).json({ 
        error: 'Error creating key area',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  }
  
  /**
   * Update a key area (admin only)
   */
  static async updateKeyArea(req: Request, res: Response) {
    try {
      const { userId, areaId } = req.params;
      const { name, description } = req.body;
      const adminId = req.user?.id;
      
      if (!userId || !areaId || !name || !description) {
        return res.status(400).json({ 
          error: 'User ID, area ID, name, and description are required' 
        });
      }
      
      // Check if the key area exists and belongs to a team member of this admin
      const keyArea = await prisma.keyArea.findFirst({
        where: {
          id: areaId,
          userId,
          user: {
            adminId
          }
        }
      });
      
      if (!keyArea) {
        return res.status(404).json({ 
          error: 'Key area not found or not for your team member' 
        });
      }
      
      // Update the key area
      const updatedKeyArea = await prisma.keyArea.update({
        where: { id: areaId },
        data: {
          name,
          description
        }
      });
      
      res.json(updatedKeyArea);
    } catch (error) {
      console.error('Error updating key area:', error);
      res.status(500).json({ 
        error: 'Error updating key area',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  }
  
  /**
   * Delete a key area (admin only)
   */
  static async deleteKeyArea(req: Request, res: Response) {
    try {
      const { userId, areaId } = req.params;
      const adminId = req.user?.id;
      
      if (!userId || !areaId) {
        return res.status(400).json({ 
          error: 'User ID and area ID are required' 
        });
      }
      
      // Check if the key area exists and belongs to a team member of this admin
      const keyArea = await prisma.keyArea.findFirst({
        where: {
          id: areaId,
          userId,
          user: {
            adminId
          }
        }
      });
      
      if (!keyArea) {
        return res.status(404).json({ 
          error: 'Key area not found or not for your team member' 
        });
      }
      
      // Delete the key area
      await prisma.keyArea.delete({
        where: { id: areaId }
      });
      
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting key area:', error);
      res.status(500).json({ 
        error: 'Error deleting key area',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  }
} 