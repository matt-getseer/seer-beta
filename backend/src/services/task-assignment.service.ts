import { AnthropicService } from './anthropic.service';
import { OpenAIService } from './openai.service';
import { GeminiService } from './gemini.service';

export interface TaskWithAssignment {
  text: string;
  assignedTo: string; // User ID
  assignmentReason: string; // Explanation for the assignment
}

export interface TaskAssignmentResult {
  tasks: TaskWithAssignment[];
}

/**
 * Service to intelligently assign tasks based on content analysis
 */
export class TaskAssignmentService {
  /**
   * Analyze tasks and assign them to appropriate people
   */
  static async assignTasks(
    tasks: string[],
    managerId: string,
    teamMemberId: string,
    customApiKey?: string | null,
    customAiProvider?: string | null,
    teamMemberFirstName?: string
  ): Promise<TaskWithAssignment[]> {
    if (!tasks || tasks.length === 0) {
      return [];
    }

    try {
      // Create prompt for AI to analyze and assign tasks
      const isManagerOnly = managerId === teamMemberId;
      
      const prompt = isManagerOnly 
        ? `You are an expert at analyzing meeting action items and determining who should be responsible for each task.

Given the following tasks from a meeting, determine who should be assigned each task. Note that this meeting may involve multiple people even though only one person formally joined the call.

ASSIGNMENT RULES:
- Look for context clues in the task text about who should do the work
- Tasks that mention "assign to team member", "team member should", or similar language should be assigned to TEAM_MEMBER
- Tasks that mention "I will", "follow up", "manager should", or managerial actions should be assigned to MANAGER
- If the task clearly indicates it's for someone else (even if not formally in the meeting), assign to TEAM_MEMBER
- When in doubt, default to MANAGER (since they're the one who joined the call)

TASKS TO ANALYZE:
${tasks.map((task, index) => `${index + 1}. ${task}`).join('\n')}

RESPONSE FORMAT: You must respond with a valid JSON object containing an array of tasks with assignments:
{
  "tasks": [
    {
      "text": "exact task text",
      "assignedTo": "MANAGER" or "TEAM_MEMBER",
      "assignmentReason": "brief explanation for the assignment"
    }
  ]
}

Analyze each task and provide the assignment with reasoning.`
        : `You are an expert at analyzing meeting action items and determining who should be responsible for each task.

Given the following tasks from a one-on-one meeting between a manager and team member, determine who should be assigned each task.

ASSIGNMENT RULES:
- Tasks that start with "I will", "I need to", "I should" (from manager's perspective) should be assigned to the MANAGER
- Tasks that mention "you should", "you will", "you need to" (directed at team member) should be assigned to the TEAM_MEMBER
- Tasks involving coaching, providing feedback, setting up meetings with other stakeholders, or managerial actions should be assigned to the MANAGER
- Tasks involving skill development, completing work, learning, conducting interviews, workshops, or individual development actions should be assigned to the TEAM_MEMBER
- Look for context clues like "lead interviews", "conduct sessions", "prepare to present", "schedule workshops" → TEAM_MEMBER
- Look for context clues like "set up meeting with product leaders", "arrange", "organize stakeholder meetings" → MANAGER
- When in doubt, default to TEAM_MEMBER

PERSONALIZATION RULES:
${teamMemberFirstName ? `- For tasks assigned to TEAM_MEMBER, personalize the task text by using "${teamMemberFirstName}" instead of generic terms like "you" or "team member"
- Make the task feel personal and direct (e.g., "${teamMemberFirstName} will lead three user interviews" instead of "Lead three user interviews")
- Keep the core task content the same, just make it more personal` : '- Keep task text as-is since no team member name was provided'}

TASKS TO ANALYZE:
${tasks.map((task, index) => `${index + 1}. ${task}`).join('\n')}

RESPONSE FORMAT: You must respond with a valid JSON object containing an array of tasks with assignments:
{
  "tasks": [
    {
      "text": "${teamMemberFirstName ? 'personalized task text (using team member first name if assigned to TEAM_MEMBER)' : 'exact task text'}",
      "assignedTo": "MANAGER" or "TEAM_MEMBER",
      "assignmentReason": "brief explanation for the assignment"
    }
  ]
}

Analyze each task and provide the assignment with reasoning.`;

      let result;

      // Determine which AI service to use
      const canUseAnthropicAPI = process.env.ANTHROPIC_API_KEY || (customAiProvider === 'anthropic' && customApiKey);
      
      if (canUseAnthropicAPI) {
        result = await AnthropicService.processWithAI(prompt, {
          responseFormat: 'json',
          parseJSON: true,
          maxTokens: 2000,
          temperature: 0.1
        }, customApiKey);
      } else if (customAiProvider === 'openai' && customApiKey) {
        result = await OpenAIService.processWithAI(prompt, {
          responseFormat: 'json',
          parseJSON: true,
          maxTokens: 2000,
          temperature: 0.1
        }, customApiKey);
      } else if (customAiProvider === 'gemini' && customApiKey) {
        result = await GeminiService.processWithAI(prompt, {
          responseFormat: 'json',
          parseJSON: true,
          maxTokens: 2000,
          temperature: 0.1
        }, customApiKey);
      } else {
        // Fallback to rule-based assignment
        console.warn('No AI API available, using rule-based assignment');
        return this.fallbackAssignment(tasks, managerId, teamMemberId, teamMemberFirstName);
      }

      // Process AI result
      if (result && result.tasks && Array.isArray(result.tasks)) {
        return result.tasks.map((task: any) => ({
          text: task.text,
          assignedTo: task.assignedTo === 'MANAGER' ? managerId : teamMemberId,
          assignmentReason: task.assignmentReason || 'AI-based assignment'
        }));
      } else {
        console.warn('Invalid AI response format, using fallback assignment');
        return this.fallbackAssignment(tasks, managerId, teamMemberId, teamMemberFirstName);
      }

    } catch (error) {
      console.error('Error in AI task assignment:', error);
      return this.fallbackAssignment(tasks, managerId, teamMemberId, teamMemberFirstName);
    }
  }

  /**
   * Fallback rule-based assignment when AI is not available
   */
  private static personalizeTaskText(task: string, teamMemberFirstName?: string): string {
    if (!teamMemberFirstName) return task;
    
    // Simple personalization patterns
    let personalizedTask = task;
    
    // Replace "you" with the team member's name
    personalizedTask = personalizedTask.replace(/\byou\b/gi, teamMemberFirstName);
    
    // Add the team member's name at the beginning if it starts with an action verb
    const actionVerbs = ['lead', 'conduct', 'schedule', 'prepare', 'present', 'complete', 'finish', 'organize'];
    const startsWithAction = actionVerbs.some(verb => 
      personalizedTask.toLowerCase().startsWith(verb.toLowerCase())
    );
    
    if (startsWithAction && !personalizedTask.toLowerCase().includes(teamMemberFirstName.toLowerCase())) {
      personalizedTask = `${teamMemberFirstName} will ${personalizedTask.toLowerCase()}`;
    }
    
    return personalizedTask;
  }

  private static fallbackAssignment(
    tasks: string[],
    managerId: string,
    teamMemberId: string,
    teamMemberFirstName?: string
  ): TaskWithAssignment[] {
    const isManagerOnly = managerId === teamMemberId;
    
    return tasks.map(task => {
      const taskLower = task.toLowerCase();
      
      if (isManagerOnly) {
        // Special handling for single-person meetings
        // Look for explicit mentions of assigning to others
        const teamMemberIndicators = [
          'assign to team member', 'team member to', 'team member should',
          'have team member', 'get team member to', 'team member will',
          'delegate to', 'have someone', 'assign someone to'
        ];
        
        const managerIndicators = [
          'i will', 'i should', 'i need to', 'follow up', 'check in',
          'notify me', 'remind me', 'schedule', 'arrange'
        ];
        
        const hasTeamMemberIndicators = teamMemberIndicators.some(indicator => 
          taskLower.includes(indicator)
        );
        
        const hasManagerIndicators = managerIndicators.some(indicator => 
          taskLower.includes(indicator)
        );
        
        if (hasTeamMemberIndicators) {
          return {
            text: this.personalizeTaskText(task, teamMemberFirstName),
            assignedTo: teamMemberId, // This will be the same as managerId, but semantically represents "team member"
            assignmentReason: 'Task explicitly mentions team member assignment'
          };
        } else if (hasManagerIndicators) {
          return {
            text: task,
            assignedTo: managerId,
            assignmentReason: 'Task explicitly mentions manager/self assignment'
          };
        } else {
          return {
            text: task,
            assignedTo: managerId,
            assignmentReason: 'Default assignment to meeting host'
          };
        }
      } else {
        // Normal two-person meeting logic
        const managerKeywords = [
          'set up meeting', 'arrange meeting', 'organize meeting', 'provide feedback',
          'review with', 'coach', 'mentor', 'follow up with',
          'check in', 'approve', 'authorize', 'escalate', 'allocate resources', 
          'budget', 'hire', 'recruit', 'performance review', 'set up a meeting',
          'arrange a call', 'organize with product leaders', 'coordinate with'
        ];

        const teamMemberKeywords = [
          'learn', 'study', 'practice', 'develop', 'improve', 'enhance',
          'complete', 'finish', 'work on', 'build', 'create', 'implement',
          'research', 'investigate', 'explore', 'attend training', 'take course',
          'read', 'watch', 'listen', 'participate', 'join', 'apply for',
          'submit', 'prepare', 'draft', 'write', 'code', 'test', 'lead interviews',
          'conduct interviews', 'lead sessions', 'conduct sessions', 'facilitate workshop',
          'schedule workshop', 'prepare to present', 'present findings', 'show learnings'
        ];

        // Check for explicit pronouns and context
        const managerIndicators = [
          'i will', 'i need to', 'i should', 'i\'m going to', 'something for me is',
          'what i\'m going to do', 'that\'s on me'
        ];
        
        const teamMemberIndicators = [
          'you should', 'you will', 'you need to', 'i\'d like you to', 'i want you to',
          'for you to', 'have you'
        ];

        const hasManagerIndicators = managerIndicators.some(indicator => 
          taskLower.includes(indicator)
        );

        const hasTeamMemberIndicators = teamMemberIndicators.some(indicator => 
          taskLower.includes(indicator)
        );

        const hasManagerKeywords = managerKeywords.some(keyword => 
          taskLower.includes(keyword)
        );

        const hasTeamMemberKeywords = teamMemberKeywords.some(keyword => 
          taskLower.includes(keyword)
        );

        let assignedTo = teamMemberId; // Default to team member
        let reason = 'Default assignment to team member';

        // Pronoun-based assignment takes precedence
        if (hasManagerIndicators) {
          assignedTo = managerId;
          reason = 'Task explicitly mentions manager responsibility (I will/should)';
        } else if (hasTeamMemberIndicators) {
          assignedTo = teamMemberId;
          reason = 'Task explicitly directed at team member (you should/will)';
        } else if (hasManagerKeywords && !hasTeamMemberKeywords) {
          assignedTo = managerId;
          reason = 'Contains managerial action keywords';
        } else if (hasTeamMemberKeywords) {
          assignedTo = teamMemberId;
          reason = 'Contains individual development/work keywords';
        }

        return {
          text: assignedTo === teamMemberId ? this.personalizeTaskText(task, teamMemberFirstName) : task,
          assignedTo,
          assignmentReason: reason
        };
      }
    });
  }
} 