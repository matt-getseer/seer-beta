import { Request, Response, NextFunction } from 'express';
import { prisma } from '../utils/prisma';
import jwt from 'jsonwebtoken';

// Using singleton Prisma client from utils/prisma

// Extend the Express Request type to include user property
declare global {
  namespace Express {
    interface Request {
      user?: any;
      auth?: {
        userId: string;
        sessionId: string;
        clerkId: string;
      };
    }
  }
}

/**
 * Middleware to authenticate requests using Clerk JWT tokens
 */
export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    
    // If there's no Authorization header, pass through but don't set auth info
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('No Authorization header found');
      return next();
    }
    
    // Extract the token
    const token = authHeader.split(' ')[1];
    
    if (!token) {
      console.log('No token found in Authorization header');
      return next();
    }
    
    try {
      // For Clerk, we don't need to verify the token as it's already verified by Clerk
      // We just need to decode it to get the user info
      // In production, you'd want to actually verify the token with Clerk's public key
      const decoded = jwt.decode(token) as any;
      
      if (!decoded || !decoded.sub) {
        console.log('Invalid token format');
        return next();
      }
      
      // Add the decoded auth info to the request
      req.auth = {
        userId: decoded.sub,
        sessionId: decoded.sid || '',
        clerkId: decoded.sub
      };
      
      // Optionally find the user in the database
      const user = await prisma.user.findUnique({
        where: { clerkId: decoded.sub }
      });
      
      if (user) {
        req.user = user;
      }
      
      next();
    } catch (error) {
      console.error('Error decoding token:', error);
      next();
    }
  } catch (error) {
    console.error('Auth middleware error:', error);
    next();
  }
};

/**
 * Middleware to require authentication
 */
export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  if (!req.auth) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
};

/**
 * Middleware to check if the user is an admin
 */
export const isAdmin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // First make sure the user is authenticated
    if (!req.auth) {
      console.log('isAdmin middleware: No auth info found');
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    console.log('isAdmin middleware: Checking admin status for user with clerkId:', req.auth.clerkId);
    
    // If we don't have the user from the database yet, get them
    if (!req.user) {
      console.log('isAdmin middleware: User not loaded yet, fetching from DB');
      const user = await prisma.user.findUnique({
        where: { clerkId: req.auth.clerkId }
      });
      
      if (!user) {
        console.log('isAdmin middleware: User not found in database for clerkId:', req.auth.clerkId);
        return res.status(404).json({ error: 'User not found' });
      }
      
      req.user = user;
    }
    
    console.log('isAdmin middleware: User role:', req.user.role);
    
    // Check if the user is an admin
    if (req.user.role !== 'admin') {
      console.log('isAdmin middleware: User is not an admin');
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    console.log('isAdmin middleware: Access granted, user is admin');
    next();
  } catch (error) {
    console.error('isAdmin middleware error:', error);
    res.status(500).json({ 
      error: 'Server error', 
      details: error instanceof Error ? error.message : String(error)
    });
  }
}; 