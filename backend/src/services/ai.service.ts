import axios from 'axios';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const ANTHROPIC_API_URL = process.env.ANTHROPIC_API_URL || 'https://api.anthropic.com';
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-3-opus-20240229';

export class AIService {
  /**
   * Helper function to call Anthropic API
   */
  static async callAnthropicAPI(prompt: string) {
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
   * Helper function to call OpenAI API
   */
  static async callOpenAIAPI(prompt: string, apiKey: string) {
    try {
      if (!apiKey) {
        throw new Error('OpenAI API key is not provided');
      }

      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-4o',
          messages: [
            {
              role: 'system',
              content: 'You are a helpful AI assistant. Respond with valid JSON when requested.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: 4000,
          temperature: 0.1,
          response_format: { type: "json_object" }
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          }
        }
      );

      return response.data.choices[0].message.content;
    } catch (error) {
      console.error('Error calling OpenAI API:', error);
      throw error;
    }
  }

  /**
   * Helper function to call Gemini API
   */
  static async callGeminiAPI(prompt: string, apiKey: string) {
    try {
      if (!apiKey) {
        throw new Error('Gemini API key is not provided');
      }

      const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
        {
          contents: [
            {
              parts: [
                {
                  text: prompt
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

      return response.data.candidates[0].content.parts[0].text;
    } catch (error) {
      console.error('Error calling Gemini API:', error);
      throw error;
    }
  }

  /**
   * Enhanced JSON parsing with multiple fallback methods
   */
  static parseJSONResponse(responseContent: string): any {
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
          console.log('JSON block parsing failed, trying to clean response');
        }
      }
      
      // Method 3: Try to clean the response and parse
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
      
      throw new Error('Could not find valid JSON boundaries');
    } catch (parseError) {
      console.error('All JSON parsing methods failed:', parseError);
      throw new Error('Failed to parse JSON response');
    }
  }

  /**
   * Call AI API with user preference detection
   */
  static async callAIAPI(
    prompt: string, 
    userId: string,
    options: {
      parseJSON?: boolean,
      fallbackToDefault?: boolean
    } = {}
  ): Promise<string | any> {
    try {
      // Import prisma dynamically to avoid circular dependencies
      const { PrismaClient } = await import('@prisma/client');
      const prisma = new PrismaClient();
      
      // Get user's AI preferences
      const user = await prisma.user.findUnique({
        where: { id: userId },
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
      
      let response: string;
      
      // Determine which AI service to use
      if (user?.useCustomAI) {
        if (user.aiProvider === 'openai' && user.hasOpenAIKey && user.openaiApiKey) {
          console.log('Using custom OpenAI API key');
          response = await this.callOpenAIAPI(prompt, user.openaiApiKey);
        } else if (user.aiProvider === 'anthropic' && user.hasAnthropicKey && user.anthropicApiKey) {
          console.log('Using custom Anthropic API key');
          response = await this.callAnthropicAPI(prompt);
        } else if (user.aiProvider === 'gemini' && user.hasGeminiKey && user.geminiApiKey) {
          console.log('Using custom Gemini API key');
          response = await this.callGeminiAPI(prompt, user.geminiApiKey);
        } else if (options.fallbackToDefault && ANTHROPIC_API_KEY) {
          console.log('Custom AI configured but not available, falling back to system Anthropic');
          response = await this.callAnthropicAPI(prompt);
        } else {
          throw new Error('Custom AI configured but API key not available');
        }
      } else if (options.fallbackToDefault && ANTHROPIC_API_KEY) {
        console.log('Using system Anthropic API key');
        response = await this.callAnthropicAPI(prompt);
      } else {
        throw new Error('No AI service available');
      }
      
      // Parse JSON if requested
      if (options.parseJSON) {
        return this.parseJSONResponse(response);
      }
      
      return response;
    } catch (error) {
      console.error('Error calling AI API:', error);
      throw error;
    }
  }
} 