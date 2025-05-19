import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

/**
 * Middleware to authenticate MeetingBaas webhook requests
 * Verifies the API key in the request header against our API key
 */
export const verifyMeetingBaasWebhook = (req: Request, res: Response, next: NextFunction) => {
  try {
    // Get the API key from the request headers
    const apiKey = req.headers['x-meeting-baas-api-key'] as string;
    
    if (!apiKey) {
      return res.status(401).json({ error: 'Missing API key header' });
    }
    
    // Get our API key from environment variables
    const ourApiKey = process.env.MEETINGBAAS_API_KEY;
    
    if (!ourApiKey) {
      console.error('MEETINGBAAS_API_KEY is not set in environment variables');
      return res.status(500).json({ error: 'API key is not configured' });
    }
    
    // Simple equality check
    if (apiKey !== ourApiKey) {
      return res.status(401).json({ error: 'Invalid API key' });
    }
    
    // If API key is valid, proceed to the handler
    next();
  } catch (error) {
    console.error('Error verifying webhook API key:', error);
    return res.status(500).json({ 
      error: 'Failed to verify webhook API key',
      details: error instanceof Error ? error.message : String(error)
    });
  }
}; 