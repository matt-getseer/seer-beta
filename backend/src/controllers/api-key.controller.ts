import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { EncryptionService } from '../services/encryption.service';

// Using singleton Prisma client from utils/prisma

export class APIKeyController {
  /**
   * Get AI settings for the current user
   */
  static async getAISettings(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      
      // Fetch user's AI settings from database
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          useCustomAI: true,
          aiProvider: true,
          // Do not return the actual API keys for security
          hasAnthropicKey: true,
          hasOpenAIKey: true
        }
      });
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      // Determine if the user has a valid API key for their selected provider
      const hasValidApiKey = user.aiProvider === 'anthropic' 
        ? (user.useCustomAI && user.hasAnthropicKey) 
        : (user.useCustomAI && user.hasOpenAIKey);
      
      // Transform the data to a safer format for the frontend
      const settings = {
        useCustomAI: user.useCustomAI || false,
        aiProvider: user.aiProvider || 'anthropic',
        hasAnthropicKey: user.hasAnthropicKey || false,
        hasOpenAIKey: user.hasOpenAIKey || false,
        hasValidApiKey
      };
      
      res.json(settings);
    } catch (error) {
      console.error('Error fetching AI settings:', error);
      res.status(500).json({ 
        error: 'Error fetching AI settings',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Save AI settings for the current user
   */
  static async saveAISettings(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      
      const { useCustomAI, aiProvider, apiKey } = req.body;
      
      // Validate inputs
      if (typeof useCustomAI !== 'boolean') {
        return res.status(400).json({ error: 'Invalid useCustomAI value' });
      }
      
      if (aiProvider !== 'anthropic' && aiProvider !== 'openai') {
        return res.status(400).json({ error: 'Invalid AI provider' });
      }
      
      // Prepare data to update
      const updateData: any = {
        useCustomAI,
        aiProvider
      };
      
      // If an API key is provided, encrypt and store it
      if (apiKey !== undefined) {
        if (apiKey === "") {
          // Empty string means disconnect/remove the API key
          if (aiProvider === 'anthropic') {
            updateData.anthropicApiKey = null;
            updateData.hasAnthropicKey = false;
          } else {
            updateData.openaiApiKey = null;
            updateData.hasOpenAIKey = false;
          }
        } else if (apiKey) {
          // Non-empty string means encrypt and store the API key
          try {
            const encryptedKey = EncryptionService.encrypt(apiKey);
            
            if (aiProvider === 'anthropic') {
              updateData.anthropicApiKey = encryptedKey;
              updateData.hasAnthropicKey = true;
            } else {
              updateData.openaiApiKey = encryptedKey;
              updateData.hasOpenAIKey = true;
            }
          } catch (encryptError) {
            console.error('Error encrypting API key:', encryptError);
            return res.status(500).json({ error: 'Failed to secure API key' });
          }
        }
      }
      
      // Update the user in the database
      await prisma.user.update({
        where: { id: userId },
        data: updateData
      });
      
      res.json({ success: true });
    } catch (error) {
      console.error('Error saving AI settings:', error);
      res.status(500).json({ 
        error: 'Error saving AI settings',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Verify an API key by attempting to use it
   * This would need to be implemented based on the specific API being used
   */
  static async verifyAPIKey(req: Request, res: Response) {
    try {
      const { provider, apiKey } = req.body;
      
      if (!provider || !apiKey) {
        return res.status(400).json({ error: 'Provider and API key are required' });
      }
      
      if (provider !== 'anthropic' && provider !== 'openai') {
        return res.status(400).json({ error: 'Invalid AI provider' });
      }
      
      // Here you would implement verification logic specific to each provider
      // For example, making a test API call to validate the key
      
      // Placeholder for key verification logic
      let isValid = false;
      let errorMessage = '';
      
      try {
        // Mock implementation - in a real app, this would make actual API calls
        // to verify the key with the respective service
        isValid = true;
      } catch (verifyError) {
        console.error(`Error verifying ${provider} API key:`, verifyError);
        errorMessage = verifyError instanceof Error ? verifyError.message : String(verifyError);
        isValid = false;
      }
      
      res.json({
        valid: isValid,
        provider,
        error: errorMessage
      });
    } catch (error) {
      console.error('Error verifying API key:', error);
      res.status(500).json({ 
        error: 'Error verifying API key',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  }
} 