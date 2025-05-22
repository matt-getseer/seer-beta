// Define Anthropic API settings
const ANTHROPIC_API_URL = import.meta.env.VITE_ANTHROPIC_API_URL || 'https://api.anthropic.com';
const ANTHROPIC_API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY;
const ANTHROPIC_MODEL = import.meta.env.VITE_ANTHROPIC_MODEL || 'claude-3-opus-20240229';

// Type for Anthropic message structure
export interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string;
}

// Type for analyze meeting response
export interface MeetingAnalysisResult {
  wins: string[];
  areasForSupport: string[];
  actionItems: string[];
}

/**
 * Call Anthropic Claude API
 */
async function callAnthropic(messages: AnthropicMessage[], customKey?: string): Promise<string> {
  try {
    // Use custom key if provided, otherwise use environment variable
    const apiKey = customKey || ANTHROPIC_API_KEY;
    
    if (!apiKey) {
      throw new Error('No Anthropic API key provided');
    }
    
    const response = await fetch(`${ANTHROPIC_API_URL}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        messages: messages,
        max_tokens: 4000,
        temperature: 0.1, // Low temperature for more consistent, focused output
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Anthropic API error: ${errorData.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    return data.content[0].text;
  } catch (error) {
    console.error('Error calling Anthropic API:', error);
    throw error;
  }
}

/**
 * Analyze meeting data to extract recurring themes
 */
export async function analyzeMeetings(
  meetings: { 
    title: string; 
    date: string; 
    executiveSummary?: string;
    transcript?: string;
    wins?: string[];
    areasForSupport?: string[];
    actionItems?: string[];
  }[], 
  customKey?: string
): Promise<MeetingAnalysisResult> {
  try {
    // Extract relevant meeting data for analysis
    const meetingData = meetings.map(meeting => ({
      title: meeting.title,
      date: meeting.date,
      executiveSummary: meeting.executiveSummary || '',
      transcript: meeting.transcript ? meeting.transcript.substring(0, 1000) + '...' : '',
      wins: meeting.wins || [],
      areasForSupport: meeting.areasForSupport || [],
      actionItems: meeting.actionItems || []
    }));

    // Prepare prompt for Claude
    const messages: AnthropicMessage[] = [
      {
        role: 'user',
        content: `I have meeting data for a team member that I'd like you to analyze to find recurring themes.
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
Each category should have 5-8 items. Make each item concise but descriptive.`
      }
    ];

    // Call Claude API
    const result = await callAnthropic(messages, customKey);
    
    // Parse JSON from response
    try {
      // Extract JSON from response (Claude might include extra text)
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON object found in response');
      }
      
      const parsedResult = JSON.parse(jsonMatch[0]) as MeetingAnalysisResult;
      
      // Ensure we have the right number of items (5-8) in each category
      const sanitizedResult: MeetingAnalysisResult = {
        wins: parsedResult.wins?.slice(0, 8) || [],
        areasForSupport: parsedResult.areasForSupport?.slice(0, 8) || [],
        actionItems: parsedResult.actionItems?.slice(0, 8) || []
      };
      
      return sanitizedResult;
    } catch (e) {
      console.error('Error parsing Claude response:', e);
      // Return default structure if parsing fails
      return {
        wins: ['Unable to analyze meeting data'],
        areasForSupport: ['Unable to analyze meeting data'],
        actionItems: ['Unable to analyze meeting data']
      };
    }
  } catch (error) {
    console.error('Error analyzing meetings:', error);
    throw error;
  }
} 