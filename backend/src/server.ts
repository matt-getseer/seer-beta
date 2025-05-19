import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import session from 'express-session';
import { PrismaClient } from '@prisma/client';
import webhookRoutes from './routes/webhook.routes';
import userRoutes from './routes/user.routes';
import meetingRoutes from './routes/meeting.routes';
import authRoutes from './routes/auth.routes';
import { authenticate } from './middleware/auth.middleware';

// Load environment variables
dotenv.config();

// Initialize Prisma client
const prisma = new PrismaClient();

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

// Apply auth middleware globally EXCEPT for webhook routes
app.use((req, res, next) => {
  if (!req.path.startsWith('/api/webhooks') && !req.path.startsWith('/api/meetings/webhook')) {
    return authenticate(req, res, next);
  }
  next();
});

// Register routes
app.use('/api/webhooks', webhookRoutes);
app.use('/api/users', userRoutes);
app.use('/api/meetings', meetingRoutes);
app.use('/api/auth', authRoutes);

// Basic route
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to the Seer API' });
});

// User routes
app.get('/api/users', async (req, res) => {
  try {
    const users = await prisma.user.findMany();
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ 
      error: 'Error fetching users',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

// Handle shutdown
process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
}); 