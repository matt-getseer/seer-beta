import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import { Webhook } from 'svix';

const prisma = new PrismaClient();

// Verify the webhook signature from Clerk
const verifyClerkWebhookSignature = (req: Request & { rawBody?: string }): boolean => {
  try {
    // Get the Clerk webhook secret from environment variables
    const secret = process.env.CLERK_WEBHOOK_SECRET;
    if (!secret) {
      console.error('CLERK_WEBHOOK_SECRET is not defined in environment variables');
      return false;
    }

    // Get the signature from the request headers
    const svix_id = req.headers['svix-id'] as string;
    const svix_timestamp = req.headers['svix-timestamp'] as string;
    const svix_signature = req.headers['svix-signature'] as string;

    if (!svix_id || !svix_timestamp || !svix_signature) {
      console.error('Missing Svix headers:', {
        'svix-id': svix_id ? 'present' : 'missing',
        'svix-timestamp': svix_timestamp ? 'present' : 'missing',
        'svix-signature': svix_signature ? 'present' : 'missing'
      });
      return false;
    }

    console.log('Webhook headers received:', {
      'svix-id': svix_id,
      'svix-timestamp': svix_timestamp,
      'svix-signature': svix_signature.substring(0, 20) + '...' // Log partial signature for debugging
    });

    // Get raw body as a string (important for exact matching)
    // Use the preserved rawBody that we saved in the express middleware
    const rawBody = req.rawBody || JSON.stringify(req.body);
    console.log('Webhook body length:', rawBody.length);
    
    // Prepare the message to sign
    const toSign = `${svix_id}.${svix_timestamp}.${rawBody}`;
    
    // Log all the components for debugging
    console.log('Secret length:', secret.length);
    console.log('Svix ID:', svix_id);
    console.log('Svix Timestamp:', svix_timestamp);
    console.log('Raw body preview (first 100 chars):', rawBody.substring(0, 100) + '...');
    console.log('Message to sign preview (first 100 chars):', toSign.substring(0, 100) + '...');
    
    // Convert secret to Buffer exactly as Clerk expects
    const secretBuffer = Buffer.from(secret, 'base64');
    
    // Create HMAC with the secret
    const hmac = crypto.createHmac('sha256', secretBuffer);
    hmac.update(toSign);
    const calculatedSignature = hmac.digest('hex');
    
    console.log('Calculated signature (partial):', calculatedSignature.substring(0, 10) + '...');
    
    // Parse the signature header
    const signatures = svix_signature.split(' ');
    
    // Try each signature (Clerk may send multiple)
    let signatureFound = false;
    for (const sig of signatures) {
      // Split at the first comma to separate version from signature
      // Format is typically "v1,signature" with no spaces
      const parts = sig.split(',');
      const version = parts[0];
      // The signature is everything after the first comma (in case signature contains commas)
      const signature = parts.slice(1).join(',');
      
      if (version !== 'v1') {
        continue;
      }
      
      // Direct string comparison of signatures
      if (signature === calculatedSignature) {
        console.log('Signature verification succeeded');
        signatureFound = true;
        return true;
      }
    }
    
    // Enable this for development if needed
    const bypassVerification = process.env.BYPASS_WEBHOOK_VERIFICATION === 'true';
    if (bypassVerification) {
      console.warn('⚠️ Bypassing webhook verification (not secure for production)');
      return true;
    }
    
    console.error('All signature verifications failed');
    return false;
  } catch (error) {
    console.error('Error verifying webhook signature:', error);
    return false;
  }
};

// Alternative webhook verification using the svix library
const verifySvixWebhookSignature = (req: Request & { rawBody?: string }): boolean => {
  try {
    // Get the Clerk webhook secret from environment variables
    const secret = process.env.CLERK_WEBHOOK_SECRET;
    if (!secret) {
      console.error('CLERK_WEBHOOK_SECRET is not defined in environment variables');
      return false;
    }

    // Extract the webhook secret, removing the 'whsec_' prefix if present
    const webhookSecret = secret.startsWith('whsec_') ? secret.substring(6) : secret;
    
    // Get the headers needed for verification
    const svixId = req.headers['svix-id'] as string;
    const svixTimestamp = req.headers['svix-timestamp'] as string;
    const svixSignature = req.headers['svix-signature'] as string;
    
    if (!svixId || !svixTimestamp || !svixSignature) {
      console.error('Missing required Svix headers');
      return false;
    }

    // Get the raw body
    const payload = req.rawBody || JSON.stringify(req.body);
    
    try {
      // Create a new Webhook instance with the secret
      const wh = new Webhook(webhookSecret);
      
      // Verify the webhook
      wh.verify(payload, {
        'svix-id': svixId,
        'svix-timestamp': svixTimestamp,
        'svix-signature': svixSignature
      });
      
      console.log('Svix library verification succeeded!');
      return true;
    } catch (verificationError) {
      console.error('Svix verification failed:', verificationError);
      return false;
    }
  } catch (error) {
    console.error('Error in svix verification:', error);
    return false;
  }
};

export const handleClerkWebhook = async (req: Request & { rawBody?: string }, res: Response): Promise<void> => {
  try {
    console.log('Received webhook event type:', req.body?.type);
    
    // For development/testing purposes - bypass signature verification if env flag is set
    const bypassVerification = process.env.BYPASS_WEBHOOK_VERIFICATION === 'true';
    
    // Try both verification methods - use custom implementation first, fallback to svix library
    let isVerified = false;
    
    if (!bypassVerification) {
      console.log('Trying custom signature verification...');
      isVerified = verifyClerkWebhookSignature(req);
      
      if (!isVerified) {
        console.log('Custom verification failed, trying svix library...');
        isVerified = verifySvixWebhookSignature(req);
      }
      
      if (!isVerified) {
        console.error('All webhook signature verification methods failed');
        res.status(401).json({ error: 'Invalid webhook signature' });
        return;
      }
    } else {
      console.warn('⚠️ Bypassing webhook verification (not secure for production)');
      isVerified = true;
    }

    const event = req.body;
    const eventType = event.type;

    // Handle the user creation event
    if (eventType === 'user.created') {
      const userData = event.data;
      const userEmail = userData.email_addresses?.[0]?.email_address;
      const userName = userData.first_name
        ? `${userData.first_name} ${userData.last_name || ''}`
        : userData.username;
      const clerkId = userData.id;

      console.log('Processing user creation:', { 
        email: userEmail, 
        clerkId: clerkId?.substring(0, 5) + '...' // Log partial ID for privacy
      });

      if (userEmail && clerkId) {
        // Check if the user already exists by email OR clerkId
        const existingUser = await prisma.user.findFirst({
          where: {
            OR: [
              { email: userEmail },
              { clerkId }
            ]
          }
        });

        if (existingUser) {
          // If the user exists with this email but different clerkId, update the clerkId
          if (existingUser.clerkId !== clerkId) {
            try {
              const updatedUser = await prisma.user.update({
                where: { id: existingUser.id },
                data: { clerkId }
              });
              console.log(`Updated clerkId for existing user: ${userEmail}`);
            } catch (err) {
              console.error('Error updating clerkId for existing user:', err);
            }
          } else {
            console.log(`User with email ${userEmail} or clerkId already exists in the database`);
          }
        } else {
          // User doesn't exist, create a new one
          // Check if this is the first user (make them admin)
          const userCount = await prisma.user.count();
          const isFirstUser = userCount === 0;
          console.log('User count:', userCount, 'Is first user:', isFirstUser);
          
          // Check if this was an invited user (by checking public metadata for inviter)
          const inviterClerkId = userData.public_metadata?.invited_by;
          let adminId = null;
          
          if (inviterClerkId && !isFirstUser) {
            // Find the admin who invited this user
            try {
              const admin = await prisma.user.findUnique({
                where: { clerkId: inviterClerkId as string }
              });
              
              if (admin) {
                // Check if the admin has already invited 3 users
                try {
                  const memberCount = await prisma.user.count({
                    where: { adminId: admin.id }
                  });
                  
                  if (memberCount < 3) {
                    adminId = admin.id;
                  } else {
                    console.warn(`Admin ${admin.email} has already invited the maximum of 3 team members`);
                  }
                } catch (err) {
                  console.error('Error counting team members:', err);
                }
              }
            } catch (err) {
              console.error('Error finding admin by clerkId:', err);
            }
          }

          // Create the user in our database
          try {
            const newUser = await prisma.user.create({
              data: {
                email: userEmail,
                name: userName?.trim() || null,
                role: isFirstUser ? 'admin' : 'user',
                clerkId,
                adminId
              }
            });

            console.log(`User successfully created in database:`, {
              id: newUser.id,
              email: newUser.email,
              role: newUser.role,
              isAdmin: newUser.role === 'admin'
            });
          } catch (err) {
            console.error('Error creating user in database:', err);
          }
        }
      } else {
        console.error('Missing required user data:', { 
          hasEmail: !!userEmail, 
          hasClerkId: !!clerkId 
        });
      }
    } 
    // Handle user deletion event
    else if (eventType === 'user.deleted') {
      const userData = event.data;
      const clerkId = userData.id;
      
      if (!clerkId) {
        console.error('Missing clerkId in user.deleted webhook');
        res.status(400).json({ error: 'Missing clerkId in webhook data' });
        return;
      }
      
      console.log(`Processing user deletion for clerkId: ${clerkId.substring(0, 5)}...`);
      
      try {
        // Find user by clerkId
        const user = await prisma.user.findUnique({
          where: { clerkId }
        });
        
        if (!user) {
          console.log(`No user found with clerkId: ${clerkId.substring(0, 5)}...`);
          res.status(200).json({ message: 'User not found in database' });
          return;
        }
        
        console.log(`Found user: ${user.email} (${user.id})`);
        
        // If this is an admin, check if they have team members
        if (user.role === 'admin') {
          const teamMembersCount = await prisma.user.count({
            where: { adminId: user.id }
          });
          
          if (teamMembersCount > 0) {
            console.log(`Admin has ${teamMembersCount} team members - removing admin relationship`);
            // Update team members to remove the admin relationship
            await prisma.user.updateMany({
              where: { adminId: user.id },
              data: { adminId: null }
            });
          }
        }
        
        // Delete the user
        await prisma.user.delete({
          where: { id: user.id }
        });
        
        console.log(`User ${user.email} successfully deleted from database`);
      } catch (err) {
        console.error('Error deleting user:', err);
        res.status(500).json({ 
          error: 'Error deleting user',
          details: err instanceof Error ? err.message : String(err)
        });
        return;
      }
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).json({ 
      error: 'Error processing webhook',
      details: error instanceof Error ? error.message : String(error)
    });
  }
}; 