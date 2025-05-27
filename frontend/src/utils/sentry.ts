import * as Sentry from '@sentry/react';

// Sentry configuration
export const initSentry = () => {
  // Only initialize Sentry in production or if explicitly enabled
  const shouldInitSentry = 
    import.meta.env.MODE === 'production' || 
    import.meta.env.VITE_ENABLE_SENTRY === 'true';

  if (!shouldInitSentry) {
    console.log('Sentry disabled in development mode');
    return;
  }

  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) {
    console.warn('Sentry DSN not configured. Set VITE_SENTRY_DSN environment variable.');
    return;
  }

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    
    // Performance monitoring sample rate
    tracesSampleRate: import.meta.env.MODE === 'production' ? 0.1 : 1.0,

    // Release tracking
    release: import.meta.env.VITE_APP_VERSION || 'unknown',

    // Error filtering
    beforeSend(event, hint) {
      // Filter out development errors
      if (import.meta.env.MODE === 'development') {
        console.log('Sentry event (dev mode):', event);
        return null; // Don't send in development
      }

      // Filter out known non-critical errors
      const error = hint.originalException;
      if (error instanceof Error) {
        // Filter out network errors that are expected
        if (error.message.includes('NetworkError') || 
            error.message.includes('Failed to fetch')) {
          return null;
        }
        
        // Filter out Clerk auth errors (they handle their own error reporting)
        if (error.message.includes('Clerk') || 
            error.stack?.includes('clerk')) {
          return null;
        }
      }

      return event;
    },

    // Additional configuration
    attachStacktrace: true,
    
    // User privacy
    sendDefaultPii: false, // Don't send personally identifiable information
    
    // Debug mode in development
    debug: import.meta.env.MODE === 'development',
  });
};

// Enhanced error reporting with context
export const reportError = (
  error: Error | unknown, 
  context?: {
    component?: string;
    action?: string;
    userId?: string;
    endpoint?: string;
    [key: string]: any;
  }
) => {
  // Set user context if provided
  if (context?.userId) {
    Sentry.setUser({ id: context.userId });
  }

  // Set additional context
  if (context) {
    Sentry.setContext('error_context', {
      component: context.component,
      action: context.action,
      endpoint: context.endpoint,
      timestamp: new Date().toISOString(),
      ...context
    });
  }

  // Report the error
  if (error instanceof Error) {
    Sentry.captureException(error);
  } else {
    Sentry.captureMessage(String(error), 'error');
  }
};

// Performance monitoring helpers
export const startTransaction = (_name: string, _operation: string) => {
  // Modern Sentry uses automatic performance monitoring
  // This is a placeholder for compatibility
  return {
    setStatus: () => {},
    finish: () => {},
  };
};

// API performance monitoring
export const trackApiCall = async <T>(
  endpoint: string,
  operation: () => Promise<T>,
  context?: { method?: string; [key: string]: any }
): Promise<T> => {
  const startTime = Date.now();
  
  try {
    const result = await operation();
    
    // Log successful API call performance
    const duration = Date.now() - startTime;
    Sentry.addBreadcrumb({
      message: `API Success: ${context?.method || 'GET'} ${endpoint}`,
      category: 'http',
      level: 'info',
      data: {
        endpoint,
        method: context?.method || 'GET',
        duration: `${duration}ms`,
        status: 'success',
        ...context
      },
    });
    
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    
    // Log failed API call
    Sentry.addBreadcrumb({
      message: `API Error: ${context?.method || 'GET'} ${endpoint}`,
      category: 'http',
      level: 'error',
      data: {
        endpoint,
        method: context?.method || 'GET',
        duration: `${duration}ms`,
        status: 'error',
        ...context
      },
    });
    
    // Report API errors with additional context
    reportError(error, {
      endpoint,
      method: context?.method || 'GET',
      duration: `${duration}ms`,
      ...context
    });
    
    throw error;
  }
};

// User action tracking
export const trackUserAction = (action: string, properties?: Record<string, any>) => {
  Sentry.addBreadcrumb({
    message: `User action: ${action}`,
    category: 'user',
    level: 'info',
    data: properties,
  });
};

// Component error boundary integration
export const SentryErrorBoundary = Sentry.withErrorBoundary;

// Export Sentry for direct use if needed
export { Sentry };

// Environment configuration helper
export const getSentryConfig = () => ({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
  enabled: import.meta.env.MODE === 'production' || import.meta.env.VITE_ENABLE_SENTRY === 'true',
  debug: import.meta.env.MODE === 'development',
});