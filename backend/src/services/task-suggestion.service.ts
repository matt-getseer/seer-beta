import crypto from 'crypto';

export interface SuggestedTask {
  id: string;
  text: string;
  reasoning: string;
  relatedAreaForSupport: string;
  suggestedAssignee?: 'manager' | 'team_member';
}

export class TaskSuggestionService {
  /**
   * Generate task suggestions based on areas for support
   */
  static async generateTaskSuggestions(
    areasForSupport: string[],
    transcript: string,
    executiveSummary: string,
    teamMemberFirstName: string,
    customApiKey?: string | null,
    customAiProvider?: string | null
  ): Promise<SuggestedTask[]> {
    try {
      console.log(`Generating task suggestions for ${areasForSupport.length} areas for support`);
      
      // Determine which AI service to use
      const canUseAnthropicAPI = process.env.ANTHROPIC_API_KEY || (customAiProvider === 'anthropic' && customApiKey);
      
      let suggestions: SuggestedTask[] = [];
      
      if (canUseAnthropicAPI) {
        suggestions = await this.generateWithAnthropic(
          areasForSupport,
          transcript,
          executiveSummary,
          teamMemberFirstName,
          customApiKey
        );
      } else if (customAiProvider === 'openai' && customApiKey) {
        suggestions = await this.generateWithOpenAI(
          areasForSupport,
          transcript,
          executiveSummary,
          teamMemberFirstName,
          customApiKey
        );
      } else if (customAiProvider === 'gemini' && customApiKey) {
        suggestions = await this.generateWithGemini(
          areasForSupport,
          transcript,
          executiveSummary,
          teamMemberFirstName,
          customApiKey
        );
      } else {
        // Fallback to basic rule-based suggestions
        suggestions = this.generateBasicSuggestions(areasForSupport);
      }
      
      console.log(`Generated ${suggestions.length} task suggestions`);
      return suggestions;
    } catch (error) {
      console.error('Error generating task suggestions:', error);
      // Return basic suggestions as fallback
      return this.generateBasicSuggestions(areasForSupport);
    }
  }
  
  /**
   * Generate suggestions using Anthropic Claude
   */
  private static async generateWithAnthropic(
    areasForSupport: string[],
    transcript: string,
    executiveSummary: string,
    teamMemberFirstName: string,
    customApiKey?: string | null
  ): Promise<SuggestedTask[]> {
    const { AnthropicService } = await import('./anthropic.service');
    
    const prompt = this.buildPrompt(areasForSupport, transcript, executiveSummary, teamMemberFirstName);
    
    try {
      const response = await AnthropicService.generateTaskSuggestions(prompt, customApiKey);
      return this.parseAIResponse(response, areasForSupport);
    } catch (error) {
      console.error('Error with Anthropic task suggestions:', error);
      return this.generateBasicSuggestions(areasForSupport);
    }
  }
  
  /**
   * Generate suggestions using OpenAI
   */
  private static async generateWithOpenAI(
    areasForSupport: string[],
    transcript: string,
    executiveSummary: string,
    teamMemberFirstName: string,
    customApiKey: string
  ): Promise<SuggestedTask[]> {
    const { OpenAIService } = await import('./openai.service');
    
    const prompt = this.buildPrompt(areasForSupport, transcript, executiveSummary, teamMemberFirstName);
    
    try {
      const response = await OpenAIService.generateTaskSuggestions(prompt, customApiKey);
      return this.parseAIResponse(response, areasForSupport);
    } catch (error) {
      console.error('Error with OpenAI task suggestions:', error);
      return this.generateBasicSuggestions(areasForSupport);
    }
  }
  
  /**
   * Generate suggestions using Gemini
   */
  private static async generateWithGemini(
    areasForSupport: string[],
    transcript: string,
    executiveSummary: string,
    teamMemberFirstName: string,
    customApiKey: string
  ): Promise<SuggestedTask[]> {
    const { GeminiService } = await import('./gemini.service');
    
    const prompt = this.buildPrompt(areasForSupport, transcript, executiveSummary, teamMemberFirstName);
    
    try {
      const response = await GeminiService.generateTaskSuggestions(prompt, customApiKey);
      return this.parseAIResponse(response, areasForSupport);
    } catch (error) {
      console.error('Error with Gemini task suggestions:', error);
      return this.generateBasicSuggestions(areasForSupport);
    }
  }
  
  /**
   * Build the AI prompt for task suggestions
   */
  private static buildPrompt(
    areasForSupport: string[],
    transcript: string,
    executiveSummary: string,
    teamMemberFirstName: string
  ): string {
    const contextInfo = [];
    if (executiveSummary) contextInfo.push(`Meeting Summary: ${executiveSummary}`);
    if (transcript) contextInfo.push(`Transcript Context: ${transcript.substring(0, 1000)}...`);
    
    return `You are an expert management coach helping a manager create actionable tasks to support their team member ${teamMemberFirstName}.

Based on these areas where ${teamMemberFirstName} needs support, suggest specific, actionable tasks that a manager could assign or facilitate:

Areas for Support:
${areasForSupport.map((area, i) => `${i + 1}. ${area}`).join('\n')}

${contextInfo.length > 0 ? `\nAdditional Context:\n${contextInfo.join('\n\n')}` : ''}

For each area, suggest 1-2 concrete tasks that would help address the issue. Each task should be:
- Specific and actionable
- Achievable within 1-2 weeks  
- Clearly tied to addressing the support need
- Appropriate for either the manager to do or assign to ${teamMemberFirstName}

RESPONSE FORMAT: You must respond with a valid JSON object containing this structure:
{
  "suggestedTasks": [
    {
      "text": "Schedule 30-minute session with senior developer to review code architecture patterns",
      "reasoning": "Will help address the technical knowledge gap by providing direct mentorship",
      "relatedAreaForSupport": "Understanding complex system architecture",
      "suggestedAssignee": "manager"
    }
  ]
}

Guidelines:
- Use "manager" for tasks the manager should do (scheduling meetings, providing resources, etc.)
- Use "team_member" for tasks ${teamMemberFirstName} should do (learning, practicing, etc.)`;
  }
  
  /**
   * Parse AI response into SuggestedTask objects
   */
  private static parseAIResponse(response: any, areasForSupport: string[]): SuggestedTask[] {
    try {
      let data = response;
      
      // Handle different response formats
      if (typeof response === 'string') {
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          data = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('No JSON found in response');
        }
      }
      
      const suggestedTasks = data.suggestedTasks || data.suggested_tasks || [];
      
      return suggestedTasks.map((task: any) => ({
        id: crypto.randomUUID(),
        text: task.text || '',
        reasoning: task.reasoning || 'AI-generated suggestion',
        relatedAreaForSupport: task.relatedAreaForSupport || task.related_area_for_support || areasForSupport[0] || '',
        suggestedAssignee: task.suggestedAssignee || task.suggested_assignee || 'team_member'
      }));
    } catch (error) {
      console.error('Error parsing AI response:', error);
      return this.generateBasicSuggestions(areasForSupport);
    }
  }
  
  /**
   * Generate basic rule-based suggestions as fallback
   */
  private static generateBasicSuggestions(areasForSupport: string[]): SuggestedTask[] {
    const suggestions: SuggestedTask[] = [];
    
    areasForSupport.forEach((area, index) => {
      // Create a basic task suggestion for each area
      suggestions.push({
        id: crypto.randomUUID(),
        text: `Schedule follow-up discussion about: ${area}`,
        reasoning: 'Basic suggestion to address the identified support need through discussion',
        relatedAreaForSupport: area,
        suggestedAssignee: 'manager'
      });
      
      // Add a second suggestion for learning/development
      if (area.toLowerCase().includes('skill') || area.toLowerCase().includes('knowledge') || area.toLowerCase().includes('learn')) {
        suggestions.push({
          id: crypto.randomUUID(),
          text: `Research and share resources related to: ${area}`,
          reasoning: 'Provide learning resources to help develop skills in this area',
          relatedAreaForSupport: area,
          suggestedAssignee: 'team_member'
        });
      }
    });
    
    return suggestions;
  }
} 