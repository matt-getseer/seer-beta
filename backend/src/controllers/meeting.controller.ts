import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { MeetingBaasService } from '../services/meetingbaas.service';
import axios from 'axios';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const prisma = new PrismaClient();
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const ANTHROPIC_API_URL = process.env.ANTHROPIC_API_URL || 'https://api.anthropic.com';
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-3-opus-20240229';

// Helper function to call Anthropic API
async function callAnthropicAPI(prompt: string) {
  try {
    if (!ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY is not set in environment variables');
    }

    const response = await axios.post(
      `${ANTHROPIC_API_URL}/v1/messages`,
      {
        model: ANTHROPIC_MODEL,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 4000,
        temperature: 0.1, // Low temperature for more consistent, focused output
      },
      {
        headers: {
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
          'x-api-key': ANTHROPIC_API_KEY,
        }
      }
    );

    return response.data.content[0].text;
  } catch (error) {
    console.error('Error calling Anthropic API:', error);
    throw error;
  }
}

/**
 * Get all meetings for the current user
 */
export const getMeetings = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;
    const userEmail = req.user?.email;
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    console.log(`Getting meetings for user: ${userId}, email: ${userEmail}, role: ${userRole}`);
    
    // For debugging, let's get all meetings to see what's available
    const allMeetings = await prisma.meeting.findMany();
    console.log(`Total meetings in system: ${allMeetings.length}`);
    
    // For debugging - log team members
    for (const meeting of allMeetings) {
      console.log(`Meeting ${meeting.id}: title=${meeting.title}, teamMemberId=${meeting.teamMemberId}, createdBy=${meeting.createdBy}`);
    }
    
    // Also get all users to debug ID matching
    const allUsers = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        role: true
      }
    });
    console.log('All users:', JSON.stringify(allUsers, null, 2));
    
    let meetings;
    
    // If user is admin, show all meetings
    if (userRole === 'admin') {
      meetings = await prisma.meeting.findMany({
        orderBy: {
          date: 'desc'
        }
      });
      console.log(`Found ${meetings.length} meetings for admin user`);
    } else {
      // For regular users
      // First, find meetings the user created
      const createdMeetings = await prisma.meeting.findMany({
        where: {
          createdBy: userId
        }
      });
      console.log(`Found ${createdMeetings.length} meetings created by the user`);
      
      // Then, find meetings where the user is the team member
      const invitedToMeetings = await prisma.meeting.findMany({
        where: {
          teamMemberId: userId
        }
      });
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
      details: error instanceof Error ? error.message : String(error)
    });
  }
};

/**
 * Get a specific meeting by ID
 */
export const getMeetingById = async (req: Request, res: Response) => {
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
    if (userRole === 'admin') {
      // Admin can access any meeting
      return res.status(200).json(meeting);
    } else {
      // Regular users can only access meetings they created or were invited to
      if (meeting.createdBy === userId || meeting.teamMemberId === userId) {
        return res.status(200).json(meeting);
      } else {
        return res.status(403).json({ error: 'You do not have access to this meeting' });
      }
    }
  } catch (error) {
    console.error('Error getting meeting:', error);
    return res.status(500).json({ 
      error: 'Failed to get meeting',
      details: error instanceof Error ? error.message : String(error)
    });
  }
};

/**
 * Create a new meeting and integrate with MeetingBaas
 */
export const createMeeting = async (req: Request, res: Response) => {
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
};

/**
 * Update an existing meeting
 */
export const updateMeeting = async (req: Request, res: Response) => {
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
};

/**
 * Delete a meeting
 */
export const deleteMeeting = async (req: Request, res: Response) => {
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
};

/**
 * Handle webhook callback from MeetingBaas when a meeting is completed
 */
export const handleMeetingCompleted = async (req: Request, res: Response) => {
  try {
    console.log('Received webhook payload:', JSON.stringify(req.body, null, 2));
    
    // Get the event type
    const eventType = req.body.event;
    const data = req.body.data;
    
    // MeetingBaas webhook format has bot_id nested in the data object
    const botId = data?.bot_id || req.body.bot_id || req.body.meetingId;
    
    if (!botId) {
      return res.status(400).json({ 
        error: 'Missing bot ID', 
        receivedPayload: req.body 
      });
    }
    
    // Handle different event types
    if (eventType === 'complete') {
      // Only process the recording when the meeting is actually complete
      // Pass the entire webhook data so we can extract transcript and recording URL
      await MeetingBaasService.handleMeetingCompleted(botId, data);
    } 
    else if (eventType === 'bot.status_change') {
      // For status change events, just update the status in our database
      const statusCode = data?.status?.code;
      
      if (statusCode) {
        try {
          const meeting = await prisma.meeting.findUnique({
            where: { meetingBaasId: botId }
          });
          
          if (meeting) {
            // Update the meeting status based on the bot status
            await prisma.meeting.update({
              where: { meetingBaasId: botId },
              data: { 
                status: statusCode === 'joining_call' ? 'in_progress' : statusCode
              }
            });
            
            console.log(`Updated meeting status to ${statusCode} for meeting ${botId}`);
          } else {
            console.warn(`Meeting with MeetingBaas ID ${botId} not found in database`);
          }
        } catch (err) {
          console.error('Error updating meeting status:', err);
          // Don't throw here, still return 200 to MeetingBaaS
        }
      }
    }
    // Always return success to acknowledge receipt of the webhook
    return res.status(200).json({ message: 'Webhook received successfully' });
  } catch (error) {
    console.error('Error handling webhook:', error);
    return res.status(500).json({ 
      error: 'Failed to process webhook',
      details: error instanceof Error ? error.message : String(error)
    });
  }
};

/**
 * Get meetings by team member ID
 */
export const getMeetingsByTeamMember = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;
    const teamMemberId = req.params.teamMemberId;
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    console.log(`Getting meetings for team member: ${teamMemberId} by user: ${userId}, role: ${userRole}`);
    
    // First check if team member exists
    const teamMember = await prisma.user.findUnique({
      where: {
        id: teamMemberId // ID is a string in the schema
      }
    });
    
    if (!teamMember) {
      return res.status(404).json({ error: 'Team member not found' });
    }
    
    // Get all meetings for this team member
    const meetings = await prisma.meeting.findMany({
      where: {
        teamMemberId: teamMemberId // ID is a string in the schema
      },
      orderBy: {
        date: 'desc'
      }
    });
    
    console.log(`Found ${meetings.length} meetings for team member ${teamMemberId}`);
    
    return res.status(200).json(meetings);
  } catch (error) {
    console.error('Error getting team member meetings:', error);
    return res.status(500).json({ 
      error: 'Failed to get team member meetings',
      details: error instanceof Error ? error.message : String(error)
    });
  }
};

/**
 * Analyze team member meetings to extract recurring themes
 */
export const analyzeTeamMemberMeetings = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;
    const teamMemberId = req.params.teamMemberId;
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    console.log(`Analyzing meetings for team member: ${teamMemberId} by user: ${userId}, role: ${userRole}`);
    
    // First check if team member exists
    const teamMember = await prisma.user.findUnique({
      where: {
        id: teamMemberId // ID is a string in the schema
      },
      include: {
        analysis: true // Include the cached analysis if it exists
      }
    });
    
    if (!teamMember) {
      return res.status(404).json({ error: 'Team member not found' });
    }
    
    // Get most recent meeting date
    const latestMeeting = await prisma.meeting.findFirst({
      where: {
        teamMemberId: teamMemberId,
        status: 'completed'
      },
      orderBy: {
        date: 'desc'
      },
      select: {
        date: true
      }
    });
    
    const latestMeetingDate = latestMeeting?.date;
    const lastAnalyzedAt = teamMember.lastAnalyzedAt;
    
    // Check if we have cached analysis and if it's still valid
    if (
      teamMember.analysis && 
      lastAnalyzedAt && 
      latestMeetingDate && 
      lastAnalyzedAt > latestMeetingDate
    ) {
      console.log(`Using cached analysis for team member ${teamMemberId} from ${lastAnalyzedAt}`);
      return res.status(200).json({
        wins: teamMember.analysis.wins,
        areasForSupport: teamMember.analysis.areasForSupport,
        actionItems: teamMember.analysis.actionItems,
        cached: true,
        lastAnalyzedAt: lastAnalyzedAt
      });
    }
    
    // If no cached analysis or it's outdated, perform new analysis
    console.log(`Performing new analysis for team member ${teamMemberId}`);
    
    // Get all meetings for this team member
    const meetings = await prisma.meeting.findMany({
      where: {
        teamMemberId: teamMemberId, // ID is a string in the schema
        status: 'completed' // Only analyze completed meetings
      },
      orderBy: {
        date: 'desc'
      }
    });
    
    if (meetings.length === 0) {
      return res.status(200).json({
        wins: ['No completed meetings available for analysis'],
        areasForSupport: ['No completed meetings available for analysis'],
        actionItems: ['No completed meetings available for analysis']
      });
    }
    
    console.log(`Found ${meetings.length} completed meetings for team member ${teamMemberId}`);
    
    // Extract relevant meeting data for analysis
    const meetingData = meetings.map(meeting => ({
      title: meeting.title,
      date: meeting.date,
      executiveSummary: meeting.executiveSummary || '',
      wins: meeting.wins || [],
      areasForSupport: meeting.areasForSupport || [],
      actionItems: meeting.actionItems || []
    }));
    
    // Create prompt for Anthropic
    const prompt = `I have meeting data for a team member that I'd like you to analyze to find recurring themes.
Based on these meetings, I need you to identify:
1. 5-8 significant wins the person has achieved
2. 5-8 areas where they need support
3. 5-8 action items they should focus on

Look for patterns across meetings, not just single occurrences.

Here's the meeting data in JSON format:
${JSON.stringify(meetingData, null, 2)}

Please respond in JSON format with exactly this structure:
{
  "wins": ["win 1", "win 2", ...],
  "areasForSupport": ["area 1", "area 2", ...],
  "actionItems": ["action 1", "action 2", ...]
}
Each category should have 5-8 items. Make each item concise but descriptive.`;
    
    // Call Anthropic API
    const result = await callAnthropicAPI(prompt);
    
    // Parse JSON from response
    try {
      // Extract JSON from response (Claude might include extra text)
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON object found in response');
      }
      
      const parsedResult = JSON.parse(jsonMatch[0]);
      
      // Ensure we have the right number of items in each category
      const sanitizedResult = {
        wins: (parsedResult.wins || []).slice(0, 8),
        areasForSupport: (parsedResult.areasForSupport || []).slice(0, 8),
        actionItems: (parsedResult.actionItems || []).slice(0, 8)
      };
      
      // Save the analysis results to the database for future use
      const now = new Date();
      
      // Use upsert to handle both creation and update cases
      await prisma.userAnalysis.upsert({
        where: {
          userId: teamMemberId
        },
        update: {
          wins: sanitizedResult.wins,
          areasForSupport: sanitizedResult.areasForSupport,
          actionItems: sanitizedResult.actionItems,
          updatedAt: now
        },
        create: {
          userId: teamMemberId,
          wins: sanitizedResult.wins,
          areasForSupport: sanitizedResult.areasForSupport,
          actionItems: sanitizedResult.actionItems,
          createdAt: now,
          updatedAt: now
        }
      });
      
      // Update the lastAnalyzedAt timestamp on the user
      await prisma.user.update({
        where: {
          id: teamMemberId
        },
        data: {
          lastAnalyzedAt: now
        }
      });
      
      return res.status(200).json({
        ...sanitizedResult,
        cached: false,
        lastAnalyzedAt: now
      });
    } catch (e) {
      console.error('Error parsing Claude response:', e);
      // Return default structure if parsing fails
      return res.status(200).json({
        wins: ['Unable to analyze meeting data'],
        areasForSupport: ['Unable to analyze meeting data'],
        actionItems: ['Unable to analyze meeting data']
      });
    }
  } catch (error) {
    console.error('Error analyzing team member meetings:', error);
    return res.status(500).json({ 
      error: 'Failed to analyze team member meetings',
      details: error instanceof Error ? error.message : String(error)
    });
  }
}; 