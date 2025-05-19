import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import webhookRoutes from './routes/webhook.routes';
import userRoutes from './routes/user.routes';
import { authenticate } from './middleware/auth.middleware';

// Load environment variables
dotenv.config();

// Initialize Prisma client
const prisma = new PrismaClient();

// Create Express app
const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());

// Raw body parser for webhooks
app.use('/api/webhooks', express.json({
  verify: (req: any, res, buf) => {
    // Store the raw body for webhook signature verification
    req.rawBody = buf.toString('utf8');
  }
}));

// Regular JSON parser for other routes
app.use(express.json());

// Apply auth middleware globally EXCEPT for webhook routes
// (webhooks don't use Authorization headers)
app.use((req, res, next) => {
  if (!req.path.startsWith('/api/webhooks')) {
    return authenticate(req, res, next);
  }
  next();
});

// Register routes
app.use('/api/webhooks', webhookRoutes);
app.use('/api/users', userRoutes);

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