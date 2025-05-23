import { Request, Response } from 'express';
import { MeetingBaasService } from '../services/meetingbaas.service';
import dotenv from 'dotenv';
import { prisma } from '../utils/prisma';
import { withRetry, formatDbError } from '../utils/db-helpers';
import crypto from 'crypto';

// Load environment variables
dotenv.config();

export class MeetingController {
  /**
   * Get all meetings for the current user
   */
  static async getMeetings(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      const userRole = req.user?.role;
      const userEmail = req.user?.email;
      
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }
      
      console.log(`Getting meetings for user: ${userId}, email: ${userEmail}, role: ${userRole}`);
      
      // For debugging, let's get all meetings to see what's available
      const allMeetings = await withRetry(() => prisma.meeting.findMany());
      console.log(`Total meetings in system: ${allMeetings.length}`);
      
      // For debugging - log team members
      for (const meeting of allMeetings) {
        console.log(`Meeting ${meeting.id}: title=${meeting.title}, teamMemberId=${meeting.teamMemberId}, createdBy=${meeting.createdBy}`);
      }
      
      // Also get all users to debug ID matching
      const allUsers = await withRetry(() => prisma.user.findMany({
        select: {
          id: true,
          email: true,
          role: true
        }
      }));
      console.log('All users:', JSON.stringify(allUsers, null, 2));
      
      let meetings;
      
      // If user is admin, show all meetings
      if (userRole === 'admin') {
        meetings = await withRetry(() => prisma.meeting.findMany({
          orderBy: {
            date: 'desc'
          }
        }));
        console.log(`Found ${meetings.length} meetings for admin user`);
      } else {
        // For regular users
        // First, find meetings the user created
        const createdMeetings = await withRetry(() => prisma.meeting.findMany({
          where: {
            createdBy: userId
          }
        }));
        console.log(`Found ${createdMeetings.length} meetings created by the user`);
        
        // Then, find meetings where the user is the team member
        const invitedToMeetings = await withRetry(() => prisma.meeting.findMany({
          where: {
            teamMemberId: userId
          }
        }));
        console.log(`Found ${invitedToMeetings.length} meetings where user is teamMember`);
        
        // Combine the results, removing duplicates
        const meetingsMap = new Map();
        
        // Add created meetings
        createdMeetings.forEach(meeting => {
          meetingsMap.set(meeting.id, meeting);
        });
        
        // Add invited meetings
        invitedToMeetings.forEach(meeting => {
          meetingsMap.set(meeting.id, meeting);
        });
        
        // Convert back to array and sort
        meetings = Array.from(meetingsMap.values()).sort((a, b) => {
          return new Date(b.date).getTime() - new Date(a.date).getTime();
        });
        
        console.log(`Returning ${meetings.length} total meetings for the user`);
      }
      
      return res.status(200).json(meetings);
    } catch (error) {
      console.error('Error getting meetings:', error);
      return res.status(500).json({ 
        error: 'Failed to get meetings',
        details: formatDbError(error)
      });
    }
  }

  /**
   * Get a specific meeting by ID
   */
  static async getMeetingById(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      const userRole = req.user?.role;
      const meetingId = req.params.id;
      
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }
      
      console.log(`Getting meeting ${meetingId} for user: ${userId}, role: ${userRole}`);
      
      // First, find the meeting
      const meeting = await prisma.meeting.findUnique({
        where: {
          id: meetingId
        }
      });
      
      if (!meeting) {
        return res.status(404).json({ error: 'Meeting not found' });
      }
      
      console.log(`Found meeting: ${meeting.id}, createdBy: ${meeting.createdBy}, teamMemberId: ${meeting.teamMemberId}`);
      
      // Check if user has access to this meeting
      if (userRole !== 'admin' && meeting.createdBy !== userId && meeting.teamMemberId !== userId) {
        return res.status(403).json({ error: 'You do not have access to this meeting' });
      }
      
      // Check for legacy action items that need migration
      if (meeting.actionItems && meeting.actionItems.length > 0) {
        // Get existing structured action items
        const existingActionItems = await prisma.$queryRaw`
          SELECT * FROM "ActionItem" WHERE "meetingId" = ${meetingId}
        ` as any[];
        
        // Only migrate if we don't already have structured action items
        if (existingActionItems.length === 0) {
          // Migrate legacy action items to structured format
          await MeetingController.migrateLegacyActionItems(meeting);
        }
      }
      
      // Get structured action items separately (to avoid TypeScript issues)
      const actionItems = await prisma.$queryRaw`
        SELECT * FROM "ActionItem" WHERE "meetingId" = ${meetingId}
        ORDER BY "createdAt" ASC
      ` as any[];
      
      // Combine the meeting with structured action items
      const response = {
        ...meeting,
        actionItemsData: actionItems
      };
      
      return res.status(200).json(response);
    } catch (error) {
      console.error('Error getting meeting:', error);
      return res.status(500).json({ 
        error: 'Failed to get meeting',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Migrate legacy string-based action items to structured ones
   */
  private static async migrateLegacyActionItems(meeting: any) {
    try {
      console.log(`Migrating legacy action items for meeting ${meeting.id}`);
      
      if (!meeting.actionItems || meeting.actionItems.length === 0) {
        return;
      }
      
      // Create a structured action item for each legacy item
      for (const text of meeting.actionItems) {
        const now = new Date();
        
        await prisma.$executeRaw`
          INSERT INTO "ActionItem" (
            "id", 
            "text", 
            "assignedTo", 
            "meetingId", 
            "status", 
            "createdAt"
          )
          VALUES (
            ${crypto.randomUUID()}, 
            ${text}, 
            ${meeting.teamMemberId}, 
            ${meeting.id}, 
            'incomplete', 
            ${now}::timestamp
          )
        `;
      }
      
      console.log(`Successfully migrated ${meeting.actionItems.length} action items for meeting ${meeting.id}`);
    } catch (error) {
      console.error('Error migrating legacy action items:', error);
      // We'll just log the error but continue - migration can be retried later
    }
  }

  /**
   * Create a new meeting and integrate with MeetingBaas
   */
  static async createMeeting(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }
      
      const { title, teamMemberId, date, duration, meetingType } = req.body;
      
      // Validate required fields
      if (!title || !teamMemberId || !date || !duration) {
        return res.status(400).json({ 
          error: 'Missing required fields',
          required: {
            title: Boolean(title),
            teamMemberId: Boolean(teamMemberId),
            date: Boolean(date),
            duration: Boolean(duration)
          }
        });
      }
      
      // Check if API key is configured
      if (!process.env.MEETINGBAAS_API_KEY) {
        return res.status(500).json({ 
          error: 'MeetingBaas API key not configured',
          details: 'Please add MEETINGBAAS_API_KEY to your environment variables'
        });
      }
      
      // Create meeting with MeetingBaas
      const meetingDate = new Date(date);
      try {
        console.log(`Creating meeting with title: "${title}", teamMemberId: "${teamMemberId}", date: ${meetingDate}, duration: ${duration}`);
        
        // Create meeting in MeetingBaas
        const meetingBaasResponse = await MeetingBaasService.createMeeting({
          title,
          scheduledTime: meetingDate,
          duration: Number(duration),
          userId,
          teamMemberId
        });
        
        console.log(`MeetingBaas response: ${JSON.stringify(meetingBaasResponse)}`);
        
        // Create meeting in our database
        const meeting = await prisma.meeting.create({
          data: {
            title,
            teamMemberId,
            date: meetingDate,
            duration: Number(duration),
            status: 'scheduled',
            processingStatus: 'pending',
            googleMeetLink: meetingBaasResponse.googleMeetLink,
            meetingBaasId: meetingBaasResponse.id,
            createdBy: userId,
            meetingType: "one_on_one",
            wins: [],
            areasForSupport: [],
            actionItems: []
          } as any
        });
        
        return res.status(201).json(meeting);
      } catch (mbError) {
        console.error('Error with MeetingBaas service:', mbError);
        return res.status(500).json({ 
          error: 'Failed to create meeting with MeetingBaas', 
          details: mbError instanceof Error ? mbError.message : String(mbError),
          note: 'This could be due to invalid API credentials or connection issues with the MeetingBaas service'
        });
      }
    } catch (error) {
      console.error('Error creating meeting:', error);
      return res.status(500).json({ 
        error: 'Failed to create meeting',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Update an existing meeting
   */
  static async updateMeeting(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      const userRole = req.user?.role;
      const meetingId = req.params.id;
      
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }
      
      // Only admins can update meetings
      if (userRole !== 'admin') {
        return res.status(403).json({ error: 'Only administrators can update meetings' });
      }
      
      // Check if meeting exists
      const existingMeeting = await prisma.meeting.findUnique({
        where: {
          id: meetingId
        }
      });
      
      if (!existingMeeting) {
        return res.status(404).json({ error: 'Meeting not found' });
      }
      
      // Update meeting
      const updatedMeeting = await prisma.meeting.update({
        where: { id: meetingId },
        data: req.body
      });
      
      return res.status(200).json(updatedMeeting);
    } catch (error) {
      console.error('Error updating meeting:', error);
      return res.status(500).json({ 
        error: 'Failed to update meeting',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Delete a meeting
   */
  static async deleteMeeting(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      const userRole = req.user?.role;
      const meetingId = req.params.id;
      
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }
      
      // Only admins can delete meetings
      if (userRole !== 'admin') {
        return res.status(403).json({ error: 'Only administrators can delete meetings' });
      }
      
      // Check if meeting exists
      const existingMeeting = await prisma.meeting.findUnique({
        where: {
          id: meetingId
        }
      });
      
      if (!existingMeeting) {
        return res.status(404).json({ error: 'Meeting not found' });
      }
      
      // Delete meeting
      await prisma.meeting.delete({
        where: { id: meetingId }
      });
      
      return res.status(204).send();
    } catch (error) {
      console.error('Error deleting meeting:', error);
      return res.status(500).json({ 
        error: 'Failed to delete meeting',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Get meeting changes history
   */
  static async getMeetingChanges(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }
      
      const meetingId = req.params.id;
      
      // Validate the meeting exists and user has access to it
      const meeting = await prisma.meeting.findUnique({
        where: { id: meetingId },
        include: {
          user: true
        }
      });
      
      if (!meeting) {
        return res.status(404).json({ error: 'Meeting not found' });
      }
      
      // Check if the user is the admin who created the meeting or the team member
      const isAuthorized = meeting.createdBy === userId || meeting.teamMemberId === userId;
      
      if (!isAuthorized) {
        return res.status(403).json({ error: 'Not authorized to view this meeting' });
      }
      
      // Get all changes for this meeting, sorted by most recent first
      const changes = await prisma.meetingChange.findMany({
        where: { meetingId },
        orderBy: { createdAt: 'desc' }
      });
      
      return res.status(200).json(changes);
    } catch (error) {
      console.error('Error retrieving meeting changes:', error);
      return res.status(500).json({ 
        error: 'Failed to retrieve meeting changes',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Generate an agenda for a meeting based on previous meetings
   */
  static async generateAgenda(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }
      
      const { meetingId } = req.params;
      
      if (!meetingId) {
        return res.status(400).json({ error: 'Meeting ID is required' });
      }
      
      // Get the current meeting
      const currentMeeting = await prisma.meeting.findUnique({
        where: { id: meetingId },
        include: {
          actionItemsData: true
        }
      });
      
      if (!currentMeeting) {
        return res.status(404).json({ error: 'Meeting not found' });
      }

      // Check if agenda already exists in the database
      if (currentMeeting.agenda) {
        // If agenda exists, return it
        return res.status(200).json(currentMeeting.agenda);
      }
      
      // Get previous meetings for the same team member, ordered by date (most recent first)
      const previousMeetings = await prisma.meeting.findMany({
        where: {
          teamMemberId: currentMeeting.teamMemberId,
          date: { lt: currentMeeting.date },
          status: 'completed',
          processingStatus: 'completed'
        },
        include: {
          actionItemsData: true
        },
        orderBy: {
          date: 'desc'
        },
        take: 3 // Get the last 3 meetings
      });
      
      let agendaResponse;
      
      if (previousMeetings.length === 0) {
        agendaResponse = {
          phases: [
            {
              name: "Phase 1: Connect & Set the Stage",
              items: [
                "Personal Check-in & Open",
                "Team Member's Top of Mind (Their Agenda First)",
                "Quick Wins & Shout-outs"
              ]
            },
            {
              name: "Phase 2: Focus & Action",
              items: [
                "Key Priorities & Progress Review",
                "Challenges, Support & Roadblocks",
                "Development & Growth"
              ]
            },
            {
              name: "Phase 3: Clarity & Closure",
              items: [
                "Action Items & Next Steps",
                "Feedback Loop",
                "Forward Look & Closing"
              ]
            }
          ],
          note: "No previous meetings found for this team member. A default agenda has been generated."
        };
      } else {
        // Get the most recent meeting
        const mostRecentMeeting = previousMeetings[0];
        
        // Prepare structured data from previous meetings
        const previousData = {
          wins: mostRecentMeeting.wins || [],
          areasForSupport: mostRecentMeeting.areasForSupport || [],
          actionItems: [
            ...(mostRecentMeeting.actionItems || []),
            ...(mostRecentMeeting.actionItemsData?.map(item => item.text) || [])
          ]
        };
        
        // Get team member name
        const teamMember = await prisma.user.findUnique({
          where: { id: currentMeeting.teamMemberId },
          select: { name: true }
        });
        
        const teamMemberName = teamMember?.name || 'Team Member';
        
        // Import AnthropicService dynamically
        const { AnthropicService } = await import('../services/anthropic.service');
        
        try {
          // Call the dedicated method for agenda generation
          agendaResponse = await AnthropicService.generateAgenda(
            teamMemberName,
            previousData
          );
        } catch (aiError) {
          console.error('Error generating agenda with AI:', aiError);
          
          // Fallback to basic structure if AI fails
          agendaResponse = {
            phases: [
              {
                name: "Phase 1: Connect & Set the Stage",
                items: [
                  "Personal Check-in & Open",
                  "Team Member's Top of Mind (Their Agenda First)",
                  "Quick Wins & Shout-outs"
                ]
              },
              {
                name: "Phase 2: Focus & Action",
                items: [
                  "Key Priorities & Progress Review",
                  "Challenges, Support & Roadblocks",
                  "Development & Growth"
                ]
              },
              {
                name: "Phase 3: Clarity & Closure",
                items: [
                  "Action Items & Next Steps",
                  "Feedback Loop",
                  "Forward Look & Closing"
                ]
              }
            ],
            error: "Failed to generate personalized agenda. Using default structure instead."
          };
        }
      }
      
      // Store the agenda in the database
      await prisma.meeting.update({
        where: { id: meetingId },
        data: { agenda: agendaResponse }
      });
      
      return res.status(200).json(agendaResponse);
    } catch (error) {
      console.error('Error generating agenda:', error);
      return res.status(500).json({ 
        error: 'Failed to generate agenda',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  }
} 