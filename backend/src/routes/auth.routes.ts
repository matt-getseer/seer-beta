import { Router } from 'express';
import { prisma } from '../utils/prisma';
import { authenticate, requireAuth } from '../middleware/auth.middleware';
import { google } from 'googleapis';
import jwt from 'jsonwebtoken';

const router = Router();
// Using singleton Prisma client from utils/prisma

// Google OAuth credentials from environment variables
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI;

// Set up OAuth2 client
const oauth2Client = new google.auth.OAuth2(
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI
);

// Scopes required for Google Calendar/Meet
const SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events'
];

// Debug route to test session
router.get('/debug-session', (req, res) => {
  try {
    console.log('Session debug request received');
    console.log('Session data:', req.session);
    
    // Set a test value in session
    req.session.testValue = 'Session test at ' + new Date().toISOString();
    
    res.json({
      sessionExists: !!req.session,
      sessionId: req.sessionID,
      sessionData: req.session
    });
  } catch (error) {
    console.error('Error in debug session route:', error);
    res.status(500).json({ error: 'Session debug error' });
  }
});

// Start Google OAuth flow
router.get('/google', async (req, res) => {
  try {
    console.log('Google OAuth flow initiated');
    
    // Get token from query parameter
    const token = req.query.token as string;
    
    if (!token) {
      console.error('No token provided in query parameters');
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    console.log('Received token:', token.substring(0, 10) + '...');
    
    // Store token in session for callback
    req.session.authToken = token;
    console.log('Token stored in session');
    
    // Generate auth URL
    const url = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
      // Force to always prompt for consent so we get refresh token every time
      prompt: 'consent'
    });
    
    // Save session before redirect
    req.session.save((err) => {
      if (err) {
        console.error('Error saving session:', err);
        return res.status(500).json({ error: 'Session save error' });
      }
      console.log('Session saved, redirecting to:', url);
      res.redirect(url);
    });
  } catch (error) {
    console.error('Error starting Google OAuth flow:', error);
    res.status(500).json({ error: 'Failed to start Google authentication' });
  }
});

// Google OAuth callback
router.get('/google/callback', async (req, res) => {
  try {
    console.log('Google OAuth callback received');
    const { code } = req.query;
    
    if (!code) {
      console.error('No authorization code received from Google');
      return res.status(400).json({ error: 'Missing authorization code' });
    }
    
    // Get the auth token from session
    console.log('Session data:', req.session);
    const authToken = req.session.authToken;
    
    // If no token in session, check for auth header (fallback method)
    let userId;
    if (!authToken) {
      console.warn('No auth token found in session, checking headers');
      
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const headerToken = authHeader.split(' ')[1];
        try {
          // Decode the token from header
          const decoded = jwt.decode(headerToken) as any;
          if (decoded && decoded.sub) {
            userId = decoded.sub;
            console.log('Using userId from Authorization header:', userId);
          }
        } catch (e) {
          console.error('Error decoding header token', e);
        }
      }
      
      if (!userId) {
        console.error('No valid authentication found');
        return res.redirect(`${process.env.FRONTEND_URL}/settings?googleError=auth_missing`);
      }
    } else {
      // Decode the JWT to get user ID from session token
      const decoded = jwt.decode(authToken) as any;
      if (!decoded || !decoded.sub) {
        console.error('Invalid JWT token structure:', decoded);
        return res.redirect(`${process.env.FRONTEND_URL}/settings?googleError=invalid_token`);
      }
      userId = decoded.sub;
      console.log('Using userId from session token:', userId);
    }
    
    // Exchange code for tokens
    console.log('Exchanging code for tokens');
    const { tokens } = await oauth2Client.getToken(code as string);
    console.log('Received tokens from Google:', tokens.refresh_token ? 'refresh token present' : 'no refresh token');
    
    // Save tokens to database
    if (tokens.refresh_token) {
      // Update user with Google refresh token
      console.log('Updating user with refresh token');
      const updatedUser = await prisma.user.update({
        where: { clerkId: userId },
        data: {
          googleRefreshToken: tokens.refresh_token,
          googleConnected: true
        }
      });
      
      // Also update the environment variable so it's available right away
      process.env.GOOGLE_REFRESH_TOKEN = tokens.refresh_token;
      console.log('Environment variable updated with refresh token');
      
      // Automatically set up MeetingBaas calendar integration
      try {
        console.log('Automatically setting up MeetingBaas calendar integration...');
        const { MeetingBaasCalendarService } = await import('../services/meetingbaas/calendar.service');
        const calendarService = new MeetingBaasCalendarService();
        
        // Check if calendar integration already exists
        const existingIntegration = await prisma.calendarIntegration.findFirst({
          where: {
            userId: updatedUser.id,
            provider: 'google',
            isActive: true
          }
        });

        if (!existingIntegration) {
          const calendarIntegration = await calendarService.setupCalendarIntegration(
            updatedUser.id,
            'google',
            tokens.refresh_token
          );
          
          console.log('✅ MeetingBaas calendar integration created automatically:', calendarIntegration.calendarId);
          
          // Redirect with success and calendar setup info
          return res.redirect(`${process.env.FRONTEND_URL}/settings?googleSuccess=true&calendarSetup=true&calendarId=${calendarIntegration.calendarId}`);
        } else {
          console.log('✅ Calendar integration already exists:', existingIntegration.calendarId);
          
          // Redirect with success
          return res.redirect(`${process.env.FRONTEND_URL}/settings?googleSuccess=true&calendarExists=true`);
        }
        
      } catch (calendarError: any) {
        console.error('❌ Error setting up calendar integration automatically:', calendarError);
        
        // Still redirect with success for OAuth, but indicate calendar setup failed
        return res.redirect(`${process.env.FRONTEND_URL}/settings?googleSuccess=true&calendarError=${encodeURIComponent(calendarError.message)}`);
      }
      
    } else {
      console.error('No refresh token received');
      return res.redirect(`${process.env.FRONTEND_URL}/settings?googleError=missing_token`);
    }
  } catch (error) {
    console.error('Error in Google OAuth callback:', error);
    res.redirect(`${process.env.FRONTEND_URL}/settings?googleError=server_error`);
  }
});

// Check Google connection status
router.get('/google/status', authenticate, requireAuth, async (req, res) => {
  try {
    if (!req.auth?.userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    const user = await prisma.user.findUnique({
      where: { clerkId: req.auth.userId },
      select: {
        id: true,
        googleConnected: true,
        googleRefreshToken: true
      }
    });
    
    // Check if user has Google OAuth connected
    const hasGoogleOAuth = Boolean(user?.googleConnected && user?.googleRefreshToken);
    
    // Also check if there are active calendar integrations
    let hasActiveCalendarIntegration = false;
    if (hasGoogleOAuth && user?.id) {
      const activeIntegration = await prisma.calendarIntegration.findFirst({
        where: {
          userId: user.id,
          provider: 'google',
          isActive: true
        }
      });
      hasActiveCalendarIntegration = Boolean(activeIntegration);
    }
    
    res.json({
      connected: hasGoogleOAuth,
      hasCalendarIntegration: hasActiveCalendarIntegration,
      fullyConnected: hasGoogleOAuth && hasActiveCalendarIntegration
    });
  } catch (error) {
    console.error('Error checking Google connection status:', error);
    res.status(500).json({ error: 'Failed to check Google connection status' });
  }
});

// Disconnect Google account
router.post('/google/disconnect', authenticate, requireAuth, async (req, res) => {
  try {
    if (!req.auth?.userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    console.log('Disconnecting Google account for user:', req.auth.userId);
    
    // Get user's internal ID for calendar integration cleanup
    const user = await prisma.user.findUnique({
      where: { clerkId: req.auth.userId },
      select: { id: true }
    });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // First, get all Google calendar integrations for this user (both active and inactive)
    const calendarIntegrations = await prisma.calendarIntegration.findMany({
      where: {
        userId: user.id,
        provider: 'google'
      }
    });
    
    if (calendarIntegrations.length > 0) {
      console.log(`Found ${calendarIntegrations.length} Google calendar integrations to delete`);
      
      // First, delete calendar integrations from MeetingBaas (only for active ones)
      const { MeetingBaasCalendarService } = await import('../services/meetingbaas/calendar.service');
      const calendarService = new MeetingBaasCalendarService();
      
      for (const integration of calendarIntegrations) {
        if (integration.isActive) {
          try {
            await calendarService.deleteCalendarIntegration(user.id, 'google');
          } catch (deleteError) {
            console.error(`Failed to delete calendar ${integration.calendarId} from MeetingBaas:`, deleteError);
            // Continue with other deletions even if one fails
          }
        }
      }
      
      // Then, delete ALL calendar integrations from our database (both active and inactive)
      await prisma.calendarIntegration.deleteMany({
        where: {
          userId: user.id,
          provider: 'google'
        }
      });
      
      console.log('✅ All calendar integration records deleted from database');
    }
    
    // Then, update user to remove Google connection
    await prisma.user.update({
      where: { clerkId: req.auth.userId },
      data: {
        googleRefreshToken: null,
        googleConnected: false
      }
    });
    
    console.log('✅ Google OAuth connection removed');
    
    res.json({ 
      success: true, 
      message: 'Google account disconnected and calendar integrations deleted',
      calendarIntegrationsRemoved: calendarIntegrations.length
    });
  } catch (error) {
    console.error('Error disconnecting Google account:', error);
    res.status(500).json({ error: 'Failed to disconnect Google account' });
  }
});

// Setup MeetingBaas calendar integration after OAuth completion
router.post('/google/setup-calendar', authenticate, requireAuth, async (req, res) => {
  try {
    if (!req.auth?.userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    console.log('Setting up MeetingBaas calendar integration for user:', req.auth.userId);

    // Get user's Google refresh token
    const user = await prisma.user.findUnique({
      where: { clerkId: req.auth.userId },
      select: {
        id: true,
        googleRefreshToken: true,
        googleConnected: true
      }
    });

    if (!user?.googleConnected || !user?.googleRefreshToken) {
      return res.status(400).json({ 
        error: 'Google account not connected. Please connect your Google account first.' 
      });
    }

    // Import CalendarService to set up integration
    const { MeetingBaasCalendarService } = await import('../services/meetingbaas/calendar.service');
    const calendarService = new MeetingBaasCalendarService();

    // Check if calendar integration already exists
    const existingIntegration = await prisma.calendarIntegration.findFirst({
      where: {
        userId: user.id,
        provider: 'google',
        isActive: true
      }
    });

    if (existingIntegration) {
      return res.json({
        success: true,
        message: 'Calendar integration already exists',
        calendarId: existingIntegration.calendarId
      });
    }

    // Set up calendar integration with MeetingBaas
    const calendarIntegration = await calendarService.setupCalendarIntegration(
      user.id,
      'google',
      user.googleRefreshToken
    );

    console.log('Calendar integration created successfully:', calendarIntegration);

    res.json({
      success: true,
      message: 'MeetingBaas calendar integration set up successfully',
      calendarId: calendarIntegration.calendarId,
      provider: calendarIntegration.provider,
      isActive: calendarIntegration.isActive
    });

  } catch (error: any) {
    console.error('Error setting up calendar integration:', error);
    res.status(500).json({ 
      error: 'Failed to set up calendar integration',
      details: error.message 
    });
  }
});

// Prepare for Google OAuth by storing token in session
router.post('/google/prepare', (req, res) => {
  try {
    console.log('Prepare Google OAuth flow');
    const { token } = req.body;
    
    if (!token) {
      console.error('No token provided in request body');
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    // Store token in session
    req.session.authToken = token;
    console.log('Token stored in session from prepare endpoint');
    
    // Generate auth URL
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
      // Force to always prompt for consent so we get refresh token every time
      prompt: 'consent'
    });
    
    // Save session before sending response
    req.session.save((err) => {
      if (err) {
        console.error('Error saving session:', err);
        return res.status(500).json({ error: 'Session save error' });
      }
      console.log('Session saved, returning auth URL');
      res.json({ authUrl });
    });
  } catch (error) {
    console.error('Error in prepare endpoint:', error);
    res.status(500).json({ error: 'Failed to prepare Google authentication' });
  }
});

export default router; 