import crypto from 'crypto';

/**
 * Generate a random invitation token
 */
export const generateInvitationToken = (): string => {
  return crypto.randomBytes(32).toString('hex');
};

/**
 * Calculate token expiry date (7 days from now by default)
 */
export const calculateExpiryDate = (days: number = 7): Date => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
}; 