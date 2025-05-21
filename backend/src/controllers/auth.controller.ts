import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';

// Using singleton Prisma client from utils/prisma

export class AuthController {
  /**
   * Register a new user or retrieve existing user
   */
  static async register(req: Request, res: Response) {
    try {
      if (!req.auth?.clerkId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { name, email } = req.body;
      const clerkId = req.auth.clerkId;

      if (!email) {
        return res.status(400).json({ error: 'Email is required' });
      }

      // Check if the user already exists by clerkId or email
      let user = await prisma.user.findFirst({
        where: {
          OR: [
            { clerkId },
            { email }
          ]
        }
      });

      if (user) {
        // If the user exists but has a different clerkId, update it
        if (user.clerkId !== clerkId) {
          user = await prisma.user.update({
            where: { id: user.id },
            data: { clerkId }
          });
          console.log(`Updated clerkId for existing user: ${email}`);
        }
        return res.json(user);
      }

      // User doesn't exist, create a new one
      // Check if this is the first user (make them admin)
      const userCount = await prisma.user.count();
      const isFirstUser = userCount === 0;

      user = await prisma.user.create({
        data: {
          email,
          name: name || null,
          role: isFirstUser ? 'admin' : 'user',
          clerkId
        }
      });

      console.log(`User created via API: ${email} with role: ${isFirstUser ? 'admin' : 'user'}`);
      res.status(201).json(user);
    } catch (error) {
      console.error('Error registering user:', error);
      res.status(500).json({ 
        error: 'Error registering user',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Get current authenticated user profile
   */
  static async getCurrentUser(req: Request, res: Response) {
    try {
      if (!req.auth?.clerkId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // Find user by clerkId
      const user = await prisma.user.findUnique({
        where: { clerkId: req.auth.clerkId }
      });

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json(user);
    } catch (error) {
      console.error('Error fetching current user:', error);
      res.status(500).json({ 
        error: 'Error fetching current user',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Get user by ID
   */
  static async getUserById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      
      if (!id) {
        return res.status(400).json({ error: 'User ID is required' });
      }
      
      const user = await prisma.user.findUnique({
        where: { id }
      });
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      res.json(user);
    } catch (error) {
      console.error('Error fetching user:', error);
      res.status(500).json({ 
        error: 'Error fetching user',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Get all users (admin only)
   */
  static async getAllUsers(req: Request, res: Response) {
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
  }

  /**
   * Get debug user info (only in dev)
   */
  static async getDebugUserInfo(req: Request, res: Response) {
    try {
      if (process.env.NODE_ENV === 'production') {
        return res.status(404).json({ error: 'Not found' });
      }

      const clerkId = req.params.clerkId;
      
      if (!clerkId) {
        return res.status(400).json({ error: 'Clerk ID is required' });
      }
      
      // Try to find the user by Clerk ID
      const user = await prisma.user.findUnique({
        where: { clerkId }
      });
      
      if (!user) {
        return res.status(404).json({ 
          error: 'User not found',
          searchedFor: { clerkId }
        });
      }
      
      // Return the user info
      res.json({
        user,
        authInfo: req.auth || null,
        message: 'User found in database'
      });
    } catch (error) {
      console.error('Error fetching debug user info:', error);
      res.status(500).json({ 
        error: 'Error fetching debug user info',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  }
} 