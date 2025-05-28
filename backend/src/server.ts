import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import session from 'express-session';
import { prisma, checkDatabaseConnection } from './utils/prisma';
import { verifyDatabaseConnection } from './utils/db-setup';
import webhookRoutes from './routes/webhook.routes';
import userRoutes from './routes/user.routes';
import meetingRoutes from './routes/meeting.routes';
import authRoutes from './routes/auth.routes';
import meetingBaasRoutes from './routes/meetingbaas.routes';
import { authenticate } from './middleware/auth.middleware';
import { meetingBaasScheduler } from './services/meetingbaas/scheduler.service';

// Load environment variables
dotenv.config();

// Create Express app
const app = express();
const PORT = process.env.PORT || 3001;

// CORS middleware with credentials support
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));

// Configure JSON body parser with rawBody capture
// This method preserves the raw body for webhook signature verification
// while still allowing the normal JSON parsing to happen
app.use(express.json({
  verify: (req, res, buf) => {
    // Store the raw buffer for webhook verification
    if (req.url && (req.url.startsWith('/api/webhooks') || req.url.startsWith('/api/meetings/webhook'))) {
      (req as any).rawBody = buf;
    }
  }
}));

// Session middleware for auth flow with improved configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'seer-secret-key',
  resave: true,
  saveUninitialized: true,
  cookie: { 
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Forward the root OAuth callback to our API route
app.get('/auth/google/callback', (req, res) => {
  console.log('Received callback at root route, forwarding to API route');
  const queryString = req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '';
  res.redirect(`/api/auth/google/callback${queryString}`);
});

// Health check endpoint
app.get('/api/health', async (req, res) => {
  const dbStatus = await checkDatabaseConnection();
  res.json({
    status: 'ok',
    timestamp: new Date(),
    database: dbStatus ? 'connected' : 'disconnected'
  });
});

// Apply auth middleware globally EXCEPT for webhook routes and health checks
app.use((req, res, next) => {
  if (!req.path.startsWith('/api/webhooks') && 
      !req.path.startsWith('/api/meetings/webhook') &&
      !req.path.startsWith('/api/meetingbaas/webhooks') &&
      !req.path.startsWith('/api/health')) {
    return authenticate(req, res, next);
  }
  next();
});

// Register routes
app.use('/api/webhooks', webhookRoutes);
app.use('/api/users', userRoutes);
app.use('/api/meetings', meetingRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/meetingbaas', meetingBaasRoutes);

// Basic route
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to the Seer API' });
});

// Start the server with database connection verification
async function startServer() {
  // First verify the database connection
  const dbConnected = await verifyDatabaseConnection();
  
  if (!dbConnected) {
    console.error('⚠️ WARNING: Database connection failed. Server will start but may not function properly.');
    console.error('Please check your DATABASE_URL configuration and ensure PostgreSQL is running.');
    console.error('Run "npx ts-node src/utils/check-db-health.ts" for detailed diagnostics.');
  }

  // Start the server even if DB fails - this allows the /api/health endpoint to work
  // for monitoring and troubleshooting
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Health check available at http://localhost:${PORT}/api/health`);
    
    // Start MeetingBaas scheduler if database is connected
    if (dbConnected) {
      try {
        meetingBaasScheduler.start();
        console.log('✅ MeetingBaas scheduler started successfully');
      } catch (error) {
        console.error('❌ Failed to start MeetingBaas scheduler:', error);
      }
    } else {
      console.log('⏸️ MeetingBaas scheduler not started due to database connection issues');
    }
  });
}

// Start the server
startServer();

// Handle shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  
  // Stop the scheduler
  try {
    meetingBaasScheduler.stop();
    console.log('✅ MeetingBaas scheduler stopped');
  } catch (error) {
    console.error('❌ Error stopping MeetingBaas scheduler:', error);
  }
  
  // Disconnect from database
  await prisma.$disconnect();
  console.log('✅ Database disconnected');
  
  process.exit(0);
}); 