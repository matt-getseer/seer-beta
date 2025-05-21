import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { AIService } from '../services/ai.service';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Using singleton Prisma client from utils/prisma

export class MeetingAnalysisController {
  /**
   * Get meetings by team member ID
   */
  static async getMeetingsByTeamMember(req: Request, res: Response) {
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
  }

  /**
   * Analyze team member meetings to extract recurring themes
   */
  static async analyzeTeamMemberMeetings(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      const userRole = req.user?.role;
      const teamMemberId = req.params.teamMemberId;
      const forceRefresh = req.query.forceRefresh === 'true';
      
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }
      
      console.log(`Analyzing meetings for team member: ${teamMemberId} by user: ${userId}, role: ${userRole}${forceRefresh ? ' (forced refresh)' : ''}`);
      
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
      
      // Get key areas for this team member
      const keyAreas = await prisma.keyArea.findMany({
        where: {
          userId: teamMemberId
        },
        select: {
          name: true,
          description: true
        }
      });
      
      console.log(`Found ${keyAreas.length} key areas for team member ${teamMemberId}`);
      
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
        !forceRefresh &&
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
      let prompt = `I have meeting data for a team member that I'd like you to analyze to find recurring themes.
Based on these meetings, I need you to identify:
1. 5-8 significant wins the person has achieved
2. 5-8 areas where they need support
3. 5-8 action items they should focus on

Look for patterns across meetings, not just single occurrences.`;

      // Add key areas to the prompt if there are any
      if (keyAreas.length > 0) {
        prompt += `\n\nAdditionally, pay special attention to the following key focus areas for this team member:`;
        keyAreas.forEach((area, index) => {
          prompt += `\n${index + 1}. ${area.name}: ${area.description}`;
        });
        prompt += `\n\nEnsure your analysis highlights points related to these key areas within the three output categories.`;
      }

      prompt += `\n\nHere's the meeting data in JSON format:
${JSON.stringify(meetingData, null, 2)}

Please respond in JSON format with exactly this structure:
{
  "wins": ["win 1", "win 2", ...],
  "areasForSupport": ["area 1", "area 2", ...],
  "actionItems": ["action 1", "action 2", ...]
}
Each category should have 5-8 items. Make each item concise but descriptive.`;
      
      // Call Anthropic API
      const result = await AIService.callAnthropicAPI(prompt);
      
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
        
        // Save to analysis history
        const analyzedAt = new Date();
        console.log(`Creating analysis history with date: ${analyzedAt.toISOString()}`);
        
        await prisma.analysisHistory.create({
          data: {
            userId: teamMemberId,
            wins: sanitizedResult.wins,
            areasForSupport: sanitizedResult.areasForSupport,
            actionItems: sanitizedResult.actionItems,
            analyzedAt: analyzedAt
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
  }

  /**
   * Get analysis history for a team member
   */
  static async getAnalysisHistory(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      const userRole = req.user?.role;
      const teamMemberId = req.params.teamMemberId;
      
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }
      
      console.log(`Getting analysis history for team member: ${teamMemberId} by user: ${userId}, role: ${userRole}`);
      
      // First check if team member exists
      const teamMember = await prisma.user.findUnique({
        where: {
          id: teamMemberId
        }
      });
      
      if (!teamMember) {
        return res.status(404).json({ error: 'Team member not found' });
      }
      
      // Get analysis history sorted by date
      const history = await prisma.analysisHistory.findMany({
        where: {
          userId: teamMemberId
        },
        orderBy: {
          analyzedAt: 'desc'
        }
      });
      
      return res.status(200).json(history);
    } catch (error) {
      console.error('Error getting analysis history:', error);
      return res.status(500).json({ 
        error: 'Failed to get analysis history',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Get a specific analysis by ID
   */
  static async getAnalysisById(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      const userRole = req.user?.role;
      const teamMemberId = req.params.teamMemberId;
      const analysisId = req.params.analysisId;
      
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }
      
      console.log(`Getting analysis ${analysisId} for team member: ${teamMemberId} by user: ${userId}, role: ${userRole}`);
      
      // First check if team member exists
      const teamMember = await prisma.user.findUnique({
        where: {
          id: teamMemberId
        }
      });
      
      if (!teamMember) {
        return res.status(404).json({ error: 'Team member not found' });
      }
      
      // Get the specific analysis
      const analysis = await prisma.analysisHistory.findFirst({
        where: {
          id: analysisId,
          userId: teamMemberId
        }
      });
      
      if (!analysis) {
        return res.status(404).json({ error: 'Analysis not found' });
      }
      
      return res.status(200).json(analysis);
    } catch (error) {
      console.error('Error getting analysis:', error);
      return res.status(500).json({ 
        error: 'Failed to get analysis',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  }
} 