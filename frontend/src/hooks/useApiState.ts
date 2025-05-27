import { useState } from 'react';
import { logger } from '../utils/logger';

interface ApiState {
  loading: boolean;
  error: string | null;
}

interface ApiStateActions {
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
  reset: () => void;
}

export function useApiState(initialLoading = false): [ApiState, ApiStateActions] {
  const [loading, setLoading] = useState(initialLoading);
  const [error, setError] = useState<string | null>(null);

  const actions: ApiStateActions = {
    setLoading,
    setError,
    clearError: () => setError(null),
    reset: () => {
      setLoading(false);
      setError(null);
    }
  };

  return [{ loading, error }, actions];
}

// Helper function for common async operation pattern
export async function withApiState<T>(
  operation: () => Promise<T>,
  actions: ApiStateActions,
  context?: { component?: string; action?: string; [key: string]: any }
): Promise<T | null> {
  try {
    actions.setLoading(true);
    actions.clearError();
    
    logger.debug('Starting API operation', context);
    const result = await operation();
    logger.debug('API operation completed successfully', context);
    
    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An error occurred';
    
    // Log the error with context
    logger.error('API operation failed', {
      error,
      errorMessage,
      ...context
    });
    
    actions.setError(errorMessage);
    return null;
  } finally {
    actions.setLoading(false);
  }
} 