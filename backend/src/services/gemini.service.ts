import axios from 'axios';

export interface ProcessOptions {
  meetingType?: string;
  additionalInstructions?: string;
}

/**
 * Service to handle interactions with Google's Gemini API
 */
export class GeminiService {
  /**
   * Process a transcript using Google Gemini
   */
  static async processTranscript(
    transcript: string, 
    options: ProcessOptions = {},
    apiKey?: string | null
  ) {
    if (!apiKey) {
      throw new Error('Gemini API key is not provided');
    }
    
    try {
      // Create a system prompt for Gemini
      let systemPrompt = 'You are an expert meeting analyzer. Extract the following from the meeting transcript:';
      systemPrompt += '\n- Executive summary (concise overview of the meeting)';
      systemPrompt += '\n- Wins (positive outcomes, achievements, or successes mentioned)';
      systemPrompt += '\n- Areas for support (challenges, issues, or areas where help is needed)';
      systemPrompt += '\n- Action items (specific tasks, assignments, or next steps)';
      
      // Add type-specific instructions if provided
      if (options?.meetingType) {
        systemPrompt += `\n\nThis is a ${options.meetingType} meeting.`;
      }
      
      if (options?.additionalInstructions) {
        systemPrompt += `\n${options.additionalInstructions}`;
      }
      
      // Request JSON format explicitly in the prompt
      systemPrompt += '\n\nRESPONSE FORMAT: You must respond with a valid JSON object containing these fields:';
      systemPrompt += '\n- executiveSummary: string';
      systemPrompt += '\n- wins: array of strings';
      systemPrompt += '\n- areasForSupport: array of strings';
      systemPrompt += '\n- actionItems: array of objects with "text" and "reasoning" fields';
      systemPrompt += '\n- keyInsights: array of strings';
      systemPrompt += '\n\nFor actionItems, each item should be an object like:';
      systemPrompt += '\n{"text": "Schedule follow-up meeting with client", "reasoning": "Ensures continued engagement and addresses any remaining concerns from the presentation"}';
      systemPrompt += '\n\nThe reasoning should explain WHY this action item is important and how it helps achieve the meeting\'s goals or addresses identified needs.';
      systemPrompt += '\n\nUse snake_case alternatives if you prefer (executive_summary, areas_for_support, action_items, key_insights).';
      
      // Format the meeting transcript (truncate if too long)
      const maxChars = 100000;
      const truncatedTranscript = transcript.length > maxChars 
        ? `${transcript.substring(0, maxChars)}... (transcript truncated due to length)`
        : transcript;
      
      // Combine system prompt and user content for Gemini
      const fullPrompt = `${systemPrompt}\n\nMeeting Transcript:\n${truncatedTranscript}`;
      
      // Make API call to Gemini
      console.log('Making API call to Gemini with model: gemini-2.0-flash');
      const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
        {
          contents: [
            {
              parts: [
                {
                  text: fullPrompt
                }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 4000,
          }
        },
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
      
      // Parse the Gemini response
      console.log('Received response from Gemini API');
      const responseContent = response.data.candidates[0].content.parts[0].text;
      
      let analysisData;
      try {
        // Method 1: Try direct parsing first
        try {
          const parsed = JSON.parse(responseContent);
          console.log('Direct JSON parsing successful');
          analysisData = parsed;
        } catch (directParseError) {
          console.log('Direct parsing failed, trying to extract JSON block');
        }
        
        if (!analysisData) {
          // Method 2: Extract JSON block between first { and last }
          const firstBrace = responseContent.indexOf('{');
          const lastBrace = responseContent.lastIndexOf('}');
          
          if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
            const jsonBlock = responseContent.substring(firstBrace, lastBrace + 1);
            try {
              const parsed = JSON.parse(jsonBlock);
              console.log('JSON block extraction successful');
              analysisData = parsed;
            } catch (blockParseError) {
              console.log('JSON block parsing failed');
            }
          }
        }
        
        if (!analysisData) {
          // Method 3: Try to clean the response and parse
          try {
            // Remove markdown code blocks if present
            let cleaned = responseContent.replace(/```json\s*/g, '').replace(/```\s*/g, '');
            
            // Find JSON object boundaries more carefully
            const jsonStart = cleaned.indexOf('{');
            const jsonEnd = cleaned.lastIndexOf('}');
            
            if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
              cleaned = cleaned.substring(jsonStart, jsonEnd + 1);
              
              // Clean up common issues
              cleaned = cleaned
                .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // Remove control characters
                .replace(/\n\s*/g, ' ') // Replace newlines with spaces
                .replace(/\r/g, '') // Remove carriage returns
                .replace(/\t/g, ' ') // Replace tabs with spaces
                .replace(/,\s*}/g, '}') // Remove trailing commas
                .replace(/,\s*]/g, ']'); // Remove trailing commas in arrays
              
              const parsed = JSON.parse(cleaned);
              console.log('Cleaned JSON parsing successful');
              analysisData = parsed;
            }
          } catch (cleanParseError) {
            console.log('Cleaned JSON parsing failed');
          }
        }
        
        if (!analysisData) {
          // If all parsing fails, log and throw
          console.error('All JSON parsing methods failed');
          throw new Error('Failed to parse JSON response from Gemini');
        }
        
      } catch (parseError) {
        console.error('Error parsing Gemini JSON response:', parseError);
        throw parseError;
      }
      
      // Normalize the response to match expected format
      const result = {
        executiveSummary: analysisData.executiveSummary || analysisData.executive_summary || '',
        wins: Array.isArray(analysisData.wins) ? analysisData.wins : [],
        areasForSupport: Array.isArray(analysisData.areasForSupport) 
          ? analysisData.areasForSupport 
          : Array.isArray(analysisData.areas_for_support) 
            ? analysisData.areas_for_support 
            : [],
        actionItems: this.parseActionItems(
          Array.isArray(analysisData.actionItems) 
            ? analysisData.actionItems 
            : Array.isArray(analysisData.action_items) 
              ? analysisData.action_items 
              : []
        ),
        keyInsights: Array.isArray(analysisData.keyInsights) 
          ? analysisData.keyInsights 
          : Array.isArray(analysisData.key_insights) 
            ? analysisData.key_insights 
            : []
      };
      
      console.log('Gemini processing completed successfully');
      return result;
    } catch (error) {
      console.error('Error calling Gemini API:', error);
      throw error;
    }
  }

  /**
   * Process any prompt with Gemini AI
   */
  static async processWithAI(
    prompt: string,
    options: {
      responseFormat?: 'text' | 'json',
      parseJSON?: boolean,
      maxTokens?: number,
      temperature?: number,
      model?: string
    } = {},
    apiKey?: string | null
  ) {
    if (!apiKey) {
      throw new Error('Gemini API key is not provided');
    }
    
    try {
      // Create the system prompt
      let systemPrompt = 'You are a helpful AI assistant.';
      
      // Add format instructions if JSON is requested
      if (options.responseFormat === 'json') {
        systemPrompt += ' You must respond with a valid JSON object only. Do not include any explanation or text before or after the JSON.';
      }
      
      // Set model and max tokens
      const model = options.model || 'gemini-2.0-flash';
      const maxTokens = options.maxTokens || 4000;
      const temperature = options.temperature ?? 0.1;
      
      // Combine system prompt and user prompt for Gemini
      const fullPrompt = `${systemPrompt}\n\n${prompt}`;
      
      // Make API call to Gemini
      console.log(`Making API call to Gemini with model: ${model}`);
      const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          contents: [
            {
              parts: [
                {
                  text: fullPrompt
                }
              ]
            }
          ],
          generationConfig: {
            temperature: temperature,
            maxOutputTokens: maxTokens,
          }
        },
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
      
      // Parse the Gemini response
      console.log('Received response from Gemini API');
      const responseContent = response.data.candidates[0].content.parts[0].text;
      
      // If we need to parse JSON and responseFormat is json
      if (options.parseJSON && options.responseFormat === 'json') {
        console.log('Raw response content:', responseContent);
        
        try {
          // Method 1: Try direct parsing first
          try {
            const parsed = JSON.parse(responseContent);
            console.log('Direct JSON parsing successful');
            return parsed;
          } catch (directParseError) {
            console.log('Direct parsing failed, trying to extract JSON block');
          }
          
          // Method 2: Extract JSON block between first { and last }
          const firstBrace = responseContent.indexOf('{');
          const lastBrace = responseContent.lastIndexOf('}');
          
          if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
            const jsonBlock = responseContent.substring(firstBrace, lastBrace + 1);
            try {
              const parsed = JSON.parse(jsonBlock);
              console.log('JSON block extraction successful');
              return parsed;
            } catch (blockParseError) {
              console.log('JSON block parsing failed');
            }
          }
          
          // Method 3: Try to clean the response and parse
          try {
            // Remove markdown code blocks if present
            let cleaned = responseContent.replace(/```json\s*/g, '').replace(/```\s*/g, '');
            
            // Find JSON object boundaries more carefully
            const jsonStart = cleaned.indexOf('{');
            const jsonEnd = cleaned.lastIndexOf('}');
            
            if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
              cleaned = cleaned.substring(jsonStart, jsonEnd + 1);
              
              // Clean up common issues
              cleaned = cleaned
                .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // Remove control characters
                .replace(/\n\s*/g, ' ') // Replace newlines with spaces
                .replace(/\r/g, '') // Remove carriage returns
                .replace(/\t/g, ' ') // Replace tabs with spaces
                .replace(/,\s*}/g, '}') // Remove trailing commas
                .replace(/,\s*]/g, ']'); // Remove trailing commas in arrays
              
              const parsed = JSON.parse(cleaned);
              console.log('Cleaned JSON parsing successful');
              return parsed;
            }
          } catch (cleanParseError) {
            console.log('Cleaned JSON parsing failed');
          }
          
          // If all parsing fails, log and throw
          console.error('All JSON parsing methods failed');
          throw new Error('Failed to parse JSON response from Gemini');
          
        } catch (parseError) {
          console.error('Error parsing Gemini JSON response:', parseError);
          throw parseError;
        }
      }
      
      // Return the raw text response
      return responseContent;
    } catch (error) {
      console.error('Error calling Gemini API:', error);
      throw error;
    }
  }

  /**
   * Generate task suggestions based on areas for support
   */
  static async generateTaskSuggestions(
    prompt: string,
    apiKey: string
  ) {
    if (!apiKey) {
      throw new Error('Gemini API key is not provided');
    }
    
    try {
      console.log('Making API call to Gemini for task suggestions');
      
      const fullPrompt = `${prompt}\n\nIMPORTANT: Respond only with valid JSON. No additional text or formatting.`;
      
      const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`,
        {
          contents: [
            {
              parts: [
                {
                  text: fullPrompt
                }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.1,
            topK: 1,
            topP: 1,
            maxOutputTokens: 2000,
          }
        },
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
      
      console.log('Received response from Gemini API for task suggestions');
      
      if (!response.data.candidates || response.data.candidates.length === 0) {
        throw new Error('No candidates in Gemini response');
      }
      
      const responseContent = response.data.candidates[0].content.parts[0].text;
      
      try {
        // Clean the response and extract JSON
        let cleanedResponse = responseContent.trim();
        
        // Remove markdown code blocks if present
        cleanedResponse = cleanedResponse.replace(/```json\s*/g, '').replace(/```\s*/g, '');
        
        // Find JSON object boundaries
        const jsonStart = cleanedResponse.indexOf('{');
        const jsonEnd = cleanedResponse.lastIndexOf('}');
        
        if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
          cleanedResponse = cleanedResponse.substring(jsonStart, jsonEnd + 1);
        }
        
        return JSON.parse(cleanedResponse);
      } catch (parseError) {
        console.error('Error parsing Gemini task suggestions response:', parseError);
        console.log('Raw response content:', responseContent);
        
        // Return fallback structure
        return {
          suggestedTasks: []
        };
      }
    } catch (error) {
      console.error('Error calling Gemini API for task suggestions:', error);
      
      // Return empty suggestions on API failure
      return {
        suggestedTasks: []
      };
    }
  }

  /**
   * Parse action items to handle both string and object formats
   */
  private static parseActionItems(actionItems: any[]): any[] {
    return actionItems.map((item: any) => {
      if (typeof item === 'string') {
        // Legacy format - convert string to object with empty reasoning
        return { text: item, reasoning: '' };
      } else if (typeof item === 'object' && item !== null) {
        // New format - ensure both text and reasoning fields exist
        return {
          text: item.text || '',
          reasoning: item.reasoning || ''
        };
      } else {
        // Fallback for invalid formats
        return { text: String(item), reasoning: '' };
      }
    });
  }
} 