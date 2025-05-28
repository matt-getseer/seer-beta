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
   * Get all meetings for the current user with team member information
   * Optimized version that includes team member names in a single query
   */
  static async getMeetingsWithTeamMembers(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      const userRole = req.user?.role;
      
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }
      
      console.log(`Getting meetings with team members for user: ${userId}, role: ${userRole}`);
      
      let meetings;
      
      if (userRole === 'admin') {
        // For admins, get all meetings with both creator and team member info
        meetings = await withRetry(() => prisma.meeting.findMany({
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          },
          orderBy: {
            date: 'desc'
          }
        }));
      } else {
        // For regular users, get meetings they created or are team members of
        meetings = await withRetry(() => prisma.meeting.findMany({
          where: {
            OR: [
              { createdBy: userId },
              { teamMemberId: userId }
            ]
          },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          },
          orderBy: {
            date: 'desc'
          }
        }));
      }
      
      // Get team member information for all unique team member IDs
      const teamMemberIds = [...new Set(meetings.map(m => m.teamMemberId))];
      const teamMembers = await withRetry(() => prisma.user.findMany({
        where: {
          id: {
            in: teamMemberIds
          }
        },
        select: {
          id: true,
          name: true,
          email: true
        }
      }));
      
      // Create a map for quick lookup
      const teamMemberMap = new Map(teamMembers.map(tm => [tm.id, tm]));
      
      // Enhance meetings with team member information
      const enhancedMeetings = meetings.map(meeting => ({
        ...meeting,
        teamMember: teamMemberMap.get(meeting.teamMemberId)
      }));
      
      console.log(`Found ${enhancedMeetings.length} meetings with team member info`);
      
      return res.status(200).json(enhancedMeetings);
    } catch (error) {
      console.error('Error getting meetings with team members:', error);
      return res.status(500).json({ 
        error: 'Failed to get meetings with team members',
        details: formatDbError(error)
      });
    }
  }

  /**
   * Get all meetings for the current user
   */
  static async getMeetings(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      const userRole = req.user?.role;
      
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }
      
      console.log(`Getting meetings for user: ${userId}, role: ${userRole}`);
      
      let meetings;
      
      // Optimized query with proper joins and filtering
      if (userRole === 'admin') {
        // For admins, get all meetings with user information in a single query
        meetings = await withRetry(() => prisma.meeting.findMany({
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          },
          orderBy: {
            date: 'desc'
          }
        }));
      } else {
        // For regular users, get meetings they created or are team members of
        meetings = await withRetry(() => prisma.meeting.findMany({
          where: {
            OR: [
              { createdBy: userId },
              { teamMemberId: userId }
            ]
          },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          },
          orderBy: {
            date: 'desc'
          }
        }));
      }
      
      console.log(`Found ${meetings.length} meetings for user`);
      
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
      
      // Check for legacy tasks that need migration
      if (meeting.tasks && meeting.tasks.length > 0) {
        // Get existing structured tasks
        const existingTasks = await prisma.$queryRaw`
          SELECT * FROM "Task" WHERE "meetingId" = ${meetingId}
        ` as any[];
        
        // Only migrate if we don't already have structured tasks
        if (existingTasks.length === 0) {
          // Migrate legacy tasks to structured format
          await MeetingController.migrateLegacyTasks(meeting);
        }
      }
      
      // Get structured tasks separately (to avoid TypeScript issues)
      const tasks = await prisma.$queryRaw`
        SELECT * FROM "Task" WHERE "meetingId" = ${meetingId}
        ORDER BY "createdAt" ASC
      ` as any[];
      
      // Combine the meeting with structured tasks
      const response = {
        ...meeting,
        tasksData: tasks
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
   * Migrate legacy string-based tasks to structured ones with intelligent assignment
   */
  private static async migrateLegacyTasks(meeting: any) {
    try {
      console.log(`Migrating legacy tasks for meeting ${meeting.id}`);
      
      if (!meeting.tasks || meeting.tasks.length === 0) {
        return;
      }

      // Get user's AI preferences for task assignment
      const user = await prisma.user.findUnique({
        where: { id: meeting.createdBy },
        select: { 
          useCustomAI: true,
          aiProvider: true,
          anthropicApiKey: true,
          openaiApiKey: true,
          geminiApiKey: true,
          hasAnthropicKey: true,
          hasOpenAIKey: true,
          hasGeminiKey: true
        }
      });

      // Determine custom API settings
      let customApiKey: string | null = null;
      let customAiProvider: string | null = null;
      
      if (user?.useCustomAI) {
        if (user.aiProvider === 'anthropic' && user.hasAnthropicKey && user.anthropicApiKey) {
          customApiKey = user.anthropicApiKey;
          customAiProvider = 'anthropic';
        } else if (user.aiProvider === 'openai' && user.hasOpenAIKey && user.openaiApiKey) {
          customApiKey = user.openaiApiKey;
          customAiProvider = 'openai';
        } else if (user.aiProvider === 'gemini' && user.hasGeminiKey && user.geminiApiKey) {
          customApiKey = user.geminiApiKey;
          customAiProvider = 'gemini';
        }
      }

      // Use TaskAssignmentService to intelligently assign tasks
      const { TaskAssignmentService } = await import('../services/task-assignment.service');
      const assignedTasks = await TaskAssignmentService.assignTasks(
        meeting.tasks,
        meeting.createdBy, // Manager ID
        meeting.teamMemberId || meeting.createdBy, // Use creator as fallback team member
        customApiKey,
        customAiProvider
      );

      // Create structured Task records with intelligent assignments
      for (const taskData of assignedTasks) {
        const taskId = crypto.randomUUID();
        const now = new Date();
        
        await prisma.$executeRaw`
          INSERT INTO "Task" (
            "id", 
            "text", 
            "assignedTo", 
            "meetingId", 
            "status", 
            "createdAt"
          )
          VALUES (
            ${taskId}, 
            ${taskData.text}, 
            ${taskData.assignedTo}, 
            ${meeting.id}, 
            'incomplete', 
            ${now}::timestamp
          )
        `;
        
        console.log(`Migrated task "${taskData.text}" assigned to ${taskData.assignedTo} (${taskData.assignmentReason})`);
      }
      
      console.log(`Successfully migrated ${assignedTasks.length} tasks for meeting ${meeting.id}`);
    } catch (error) {
      console.error('Error migrating legacy tasks:', error);
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
        
        // Use MeetingBaas calendar integration
        console.log('Using MeetingBaas calendar integration');
        const meetingBaasResponse = await MeetingBaasService.createMeetingWithCalendar({
          title,
          scheduledTime: meetingDate,
          duration: Number(duration),
          platform: 'google_meet', // Default to Google Meet for now
          userId,
          teamMemberId,
          calendarProvider: 'google' // Default to Google calendar
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
            platform: 'google_meet',
            platformMeetingUrl: meetingBaasResponse.platformMeetingUrl,
            googleMeetLink: meetingBaasResponse.googleMeetLink,
            meetingBaasId: meetingBaasResponse.id,
            calendarEventId: meetingBaasResponse.calendarEventId,
            calendarProvider: 'google',
            createdBy: userId,
            meetingType: "one_on_one",
            wins: [],
            areasForSupport: [],
            tasks: []
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
      
      // Note: Calendar event deletion is now handled automatically by MeetingBaas calendar integration
      // when the meeting is deleted from the database via webhooks
      
      // Delete meeting from database
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
      const userRole = req.user?.role;
      
      console.log(`getMeetingChanges: userId=${userId}, userRole=${userRole}`);
      
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }
      
      const meetingId = req.params.id;
      console.log(`getMeetingChanges: meetingId=${meetingId}`);
      
      // Validate the meeting exists and user has access to it
      const meeting = await prisma.meeting.findUnique({
        where: { id: meetingId },
        include: {
          user: true
        }
      });
      
      if (!meeting) {
        console.log(`getMeetingChanges: Meeting not found for id=${meetingId}`);
        return res.status(404).json({ error: 'Meeting not found' });
      }
      
      console.log(`getMeetingChanges: meeting.createdBy=${meeting.createdBy}, meeting.teamMemberId=${meeting.teamMemberId}`);
      
      // Check if the user is the admin who created the meeting or the team member
      const isAuthorized = meeting.createdBy === userId || meeting.teamMemberId === userId || userRole === 'admin';
      
      console.log(`getMeetingChanges: isAuthorized=${isAuthorized} (createdBy match: ${meeting.createdBy === userId}, teamMember match: ${meeting.teamMemberId === userId}, isAdmin: ${userRole === 'admin'})`);
      
      if (!isAuthorized) {
        console.log(`getMeetingChanges: User ${userId} not authorized to view meeting ${meetingId}`);
        return res.status(403).json({ error: 'Not authorized to view this meeting' });
      }
      
      // Get all changes for this meeting, sorted by most recent first
      const changes = await prisma.meetingChange.findMany({
        where: { meetingId },
        orderBy: { createdAt: 'desc' }
      });
      
      console.log(`getMeetingChanges: Found ${changes.length} changes for meeting ${meetingId}`);
      
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
          tasksData: true
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
          tasksData: true
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
            ...(mostRecentMeeting.tasks || []),
            ...(mostRecentMeeting.tasksData?.map((item: any) => item.text) || [])
          ]
        };
        
        // Get team member name
        const teamMember = await prisma.user.findUnique({
          where: { id: currentMeeting.teamMemberId },
          select: { name: true }
        });
        
        const teamMemberName = teamMember?.name || 'Team Member';
        
        // Check if the user has custom AI settings
        const user = await prisma.user.findUnique({
          where: { id: currentMeeting.createdBy },
          select: { 
            useCustomAI: true,
            aiProvider: true,
            anthropicApiKey: true,
            openaiApiKey: true,
            hasAnthropicKey: true,
            hasOpenAIKey: true
          }
        });
        
        // Determine which AI service to use
        let customApiKey: string | null = null;
        let customAiProvider: string | null = null;
        
        if (user?.useCustomAI) {
          if (user.aiProvider === 'anthropic' && user.hasAnthropicKey && user.anthropicApiKey) {
            customApiKey = user.anthropicApiKey;
            customAiProvider = 'anthropic';
          } else if (user.aiProvider === 'openai' && user.hasOpenAIKey && user.openaiApiKey) {
            customApiKey = user.openaiApiKey;
            customAiProvider = 'openai';
          }
        }
        
        try {
          // Use the appropriate AI service for agenda generation
          if (customAiProvider === 'openai' && customApiKey) {
            // Import OpenAIService dynamically
            const { OpenAIService } = await import('../services/openai.service');
            agendaResponse = await OpenAIService.generateAgenda(
              teamMemberName,
              previousData,
              customApiKey
            );
          } else {
            // Default to Anthropic (either system key or custom key)
            const { AnthropicService } = await import('../services/anthropic.service');
            agendaResponse = await AnthropicService.generateAgenda(
              teamMemberName,
              previousData,
              customApiKey
            );
          }
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

  /**
   * Generate task suggestions based on areas for support
   */
  static async suggestTasks(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      const userRole = req.user?.role;
      const meetingId = req.params.id;
      
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }
      
      console.log(`Suggesting tasks for meeting ${meetingId} by user: ${userId}, role: ${userRole}`);
      
      // Get the meeting
      const meeting = await prisma.meeting.findUnique({
        where: { id: meetingId },
        include: {
          tasksData: true
        }
      });
      
      if (!meeting) {
        return res.status(404).json({ error: 'Meeting not found' });
      }
      
      // Check if user has access to this meeting
      if (userRole !== 'admin' && meeting.createdBy !== userId && meeting.teamMemberId !== userId) {
        return res.status(403).json({ error: 'Access denied' });
      }
      
      // Check if meeting has areas for support
      if (!meeting.areasForSupport || meeting.areasForSupport.length === 0) {
        return res.status(400).json({ error: 'Meeting has no areas for support to generate task suggestions from' });
      }
      
      // Check if there are already suggested tasks for this meeting
      const existingSuggestedTasks = await prisma.$queryRaw`
        SELECT * FROM "Task" WHERE "meetingId" = ${meetingId} AND "status" = 'suggested'
      ` as any[];
      
      if (existingSuggestedTasks.length > 0) {
        console.log(`Meeting already has ${existingSuggestedTasks.length} suggested tasks`);
        return res.status(200).json({ 
          message: 'Suggested tasks already exist for this meeting',
          suggestedTasksCount: existingSuggestedTasks.length
        });
      }
      
      // Check if the user has custom AI settings
      const user = await prisma.user.findUnique({
        where: { id: meeting.createdBy },
        select: { 
          useCustomAI: true,
          aiProvider: true,
          anthropicApiKey: true,
          openaiApiKey: true,
          geminiApiKey: true,
          hasAnthropicKey: true,
          hasOpenAIKey: true,
          hasGeminiKey: true
        }
      });
      
      // Determine which AI service to use
      let customApiKey: string | null = null;
      let customAiProvider: string | null = null;
      
      if (user?.useCustomAI) {
        if (user.aiProvider === 'anthropic' && user.hasAnthropicKey && user.anthropicApiKey) {
          customApiKey = user.anthropicApiKey;
          customAiProvider = 'anthropic';
        } else if (user.aiProvider === 'openai' && user.hasOpenAIKey && user.openaiApiKey) {
          customApiKey = user.openaiApiKey;
          customAiProvider = 'openai';
        } else if (user.aiProvider === 'gemini' && user.hasGeminiKey && user.geminiApiKey) {
          customApiKey = user.geminiApiKey;
          customAiProvider = 'gemini';
        }
      }
      
      // Get team member name for personalization
      const teamMember = await prisma.user.findUnique({
        where: { id: meeting.teamMemberId },
        select: { name: true, email: true }
      });
      
      const teamMemberName = teamMember?.name || teamMember?.email?.split('@')[0] || 'Team Member';
      const firstName = teamMemberName.split(' ')[0]; // Extract first name
      
      // Generate task suggestions using AI
      const { TaskSuggestionService } = await import('../services/task-suggestion.service');
      
      const suggestions = await TaskSuggestionService.generateTaskSuggestions(
        meeting.areasForSupport,
        meeting.transcript || '',
        meeting.executiveSummary || '',
        firstName,
        customApiKey,
        customAiProvider
      );
      
      // Save suggested tasks to database
      const savedTasks = [];
      for (const suggestion of suggestions) {
        const taskId = crypto.randomUUID();
        const now = new Date();
        
        // Don't set assignedTo for suggested tasks - it will be set when approved
        let assignedTo = null;
        
        await prisma.$executeRaw`
          INSERT INTO "Task" (
            "id", 
            "text", 
            "assignedTo", 
            "meetingId", 
            "status", 
            "createdAt",
            "reasoning",
            "relatedAreaForSupport",
            "suggestedAssignee"
          )
          VALUES (
            ${taskId}, 
            ${suggestion.text}, 
            ${assignedTo}, 
            ${meeting.id}, 
            'suggested', 
            ${now}::timestamp,
            ${suggestion.reasoning},
            ${suggestion.relatedAreaForSupport},
            ${suggestion.suggestedAssignee}
          )
        `;
        
        savedTasks.push({
          id: taskId,
          text: suggestion.text,
          assignedTo,
          status: 'suggested',
          createdAt: now.toISOString(),
          reasoning: suggestion.reasoning,
          relatedAreaForSupport: suggestion.relatedAreaForSupport,
          suggestedAssignee: suggestion.suggestedAssignee
        });
        
        console.log(`Saved suggested task "${suggestion.text}" for ${suggestion.suggestedAssignee}`);
      }
      
      return res.status(200).json({ 
        message: 'Task suggestions generated and saved successfully',
        suggestedTasksCount: savedTasks.length,
        areasForSupportCount: meeting.areasForSupport.length
      });
    } catch (error) {
      console.error('Error generating task suggestions:', error);
      return res.status(500).json({ 
        error: 'Failed to generate task suggestions',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  }
} 