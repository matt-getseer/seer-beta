import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

const MAX_RETRY_ATTEMPTS = Number(process.env.MAX_RETRY_ATTEMPTS) || 3;
const RETRY_DELAY_MS = Number(process.env.RETRY_DELAY_MS) || 1000;

/**
 * Handles database operations with retry logic
 * @param operation Function that performs the database operation
 * @param retryCount Maximum number of retries (defaults to MAX_RETRY_ATTEMPTS)
 * @param delay Delay between retries in ms (defaults to RETRY_DELAY_MS)
 * @returns Result of the database operation
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  retryCount = MAX_RETRY_ATTEMPTS,
  delay = RETRY_DELAY_MS
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (shouldRetry(error) && retryCount > 0) {
      console.warn(`Database operation failed, retrying... (${MAX_RETRY_ATTEMPTS - retryCount + 1}/${MAX_RETRY_ATTEMPTS})`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return withRetry(operation, retryCount - 1, delay);
    }
    throw error;
  }
}

/**
 * Determines if an error should trigger a retry
 */
function shouldRetry(error: any): boolean {
  // Retry on connection errors (P1001, P1002)
  if (error instanceof PrismaClientKnownRequestError) {
    return ['P1001', 'P1002', 'P1008', 'P1011', 'P1017'].includes(error.code);
  }
  
  // Retry on connection timeout or similar network errors
  if (error.message && (
    error.message.includes('connection') ||
    error.message.includes('timeout') ||
    error.message.includes('pool')
  )) {
    return true;
  }
  
  return false;
}

/**
 * Formats error messages from database operations
 */
export function formatDbError(error: any): string {
  if (error instanceof PrismaClientKnownRequestError) {
    return `Database error ${error.code}: ${error.message}`;
  }
  return `Database error: ${error.message || 'Unknown error'}`;
} 