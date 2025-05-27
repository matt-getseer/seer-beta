// Lazy Sentry initialization to reduce initial bundle size
let sentryInitialized = false;
let sentryModule: typeof import('@sentry/react') | null = null;

// Lazy load Sentry only when needed
const loadSentry = async () => {
  if (!sentryModule) {
    sentryModule = await import('@sentry/react');
  }
  return sentryModule;
};

// Sentry configuration
export const initSentry = async () => {
  // Only initialize Sentry in production or if explicitly enabled
  const shouldInitSentry = 
    import.meta.env.MODE === 'production' || 
    import.meta.env.VITE_ENABLE_SENTRY === 'true';

  if (!shouldInitSentry) {
    console.log('Sentry disabled in development mode');
    return;
  }

  if (sentryInitialized) {
    return;
  }

  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) {
    console.warn('Sentry DSN not configured. Set VITE_SENTRY_DSN environment variable.');
    return;
  }

  try {
    const Sentry = await loadSentry();
    
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
    
    sentryInitialized = true;
  } catch (error) {
    console.warn('Failed to initialize Sentry:', error);
  }
};

// Enhanced error reporting with context
export const reportError = async (
  error: Error | unknown, 
  context?: {
    component?: string;
    action?: string;
    userId?: string;
    endpoint?: string;
    [key: string]: any;
  }
) => {
  try {
    const Sentry = await loadSentry();
    
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
  } catch (sentryError) {
    console.warn('Failed to report error to Sentry:', sentryError);
    console.error('Original error:', error);
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
    try {
      const Sentry = await loadSentry();
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
    } catch {
      // Silently fail if Sentry is not available
    }
    
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    
    // Log failed API call
    try {
      const Sentry = await loadSentry();
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
    } catch {
      // Silently fail if Sentry is not available
    }
    
    // Report API errors with additional context
    await reportError(error, {
      endpoint,
      method: context?.method || 'GET',
      duration: `${duration}ms`,
      ...context
    });
    
    throw error;
  }
};

// User action tracking
export const trackUserAction = async (action: string, properties?: Record<string, any>) => {
  try {
    const Sentry = await loadSentry();
    Sentry.addBreadcrumb({
      message: `User action: ${action}`,
      category: 'user',
      level: 'info',
      data: properties,
    });
  } catch {
    // Silently fail if Sentry is not available
  }
};

// Component error boundary integration (lazy loaded)
export const getSentryErrorBoundary = async () => {
  try {
    const Sentry = await loadSentry();
    return Sentry.withErrorBoundary;
  } catch {
    // Return a no-op error boundary if Sentry fails to load
    return (component: React.ComponentType) => component;
  }
};

// Environment configuration helper
export const getSentryConfig = () => ({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
  enabled: import.meta.env.MODE === 'production' || import.meta.env.VITE_ENABLE_SENTRY === 'true',
  debug: import.meta.env.MODE === 'development',
});