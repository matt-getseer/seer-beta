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
} 