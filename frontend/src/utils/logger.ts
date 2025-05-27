import log from 'loglevel';
import { reportError, trackUserAction } from './sentry';

// Configure loglevel based on environment
const logLevel = import.meta.env.MODE === 'production' ? 'warn' : 'debug';
log.setLevel(logLevel);

// Enhanced logging interface with context support
interface LogContext {
  userId?: string;
  component?: string;
  action?: string;
  endpoint?: string;
  error?: Error | unknown;
  [key: string]: any;
}

class Logger {
  error(message: string, context?: LogContext) {
    const sanitizedContext = this.sanitizeContext(context);
    
    // Format the log message with context
    if (sanitizedContext && Object.keys(sanitizedContext).length > 0) {
      log.error(`${message}`, sanitizedContext);
    } else {
      log.error(message);
    }
    
    // Report critical errors to Sentry
    if (context?.error) {
      reportError(context.error, {
        message,
        ...sanitizedContext
      });
    }
  }

  warn(message: string, context?: LogContext) {
    const sanitizedContext = this.sanitizeContext(context);
    
    if (sanitizedContext && Object.keys(sanitizedContext).length > 0) {
      log.warn(`${message}`, sanitizedContext);
    } else {
      log.warn(message);
    }
  }

  info(message: string, context?: LogContext) {
    const sanitizedContext = this.sanitizeContext(context);
    
    if (sanitizedContext && Object.keys(sanitizedContext).length > 0) {
      log.info(`${message}`, sanitizedContext);
    } else {
      log.info(message);
    }
  }

  debug(message: string, context?: LogContext) {
    const sanitizedContext = this.sanitizeContext(context);
    
    if (sanitizedContext && Object.keys(sanitizedContext).length > 0) {
      log.debug(`${message}`, sanitizedContext);
    } else {
      log.debug(message);
    }
  }

  // API-specific logging methods
  apiError(endpoint: string, error: unknown, context?: LogContext) {
    const errorContext = {
      endpoint,
      error: this.formatError(error),
      ...context,
    };
    
    this.error(`API Error: ${endpoint}`, errorContext);
    
    // Report API errors to Sentry with additional context
    reportError(error, {
      component: 'API',
      endpoint,
      ...context
    });
  }

  apiSuccess(endpoint: string, context?: LogContext) {
    this.debug(`API Success: ${endpoint}`, {
      endpoint,
      ...context,
    });
  }

  // Component-specific logging
  componentError(component: string, error: unknown, context?: LogContext) {
    const errorContext = {
      component,
      error: this.formatError(error),
      ...context,
    };
    
    this.error(`Component Error: ${component}`, errorContext);
    
    // Report component errors to Sentry
    reportError(error, {
      component,
      ...context
    });
  }

  // User action logging
  userAction(action: string, context?: LogContext) {
    this.info(`User Action: ${action}`, {
      action,
      ...context,
    });
    
    // Track user actions in Sentry for debugging context
    trackUserAction(action, context);
  }

  private sanitizeContext(context?: LogContext): LogContext | undefined {
    if (!context) return undefined;

    // Remove sensitive data
    const sanitized = { ...context };
    
    // Remove common sensitive fields
    delete sanitized.password;
    delete sanitized.token;
    delete sanitized.apiKey;
    delete sanitized.secret;

    return sanitized;
  }

  private formatError(error: unknown): any {
    if (error instanceof Error) {
      return {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    }
    return error;
  }
}

// Create and export the logger instance
export const logger = new Logger();

// Export types for use in components
export type { LogContext };

// Development helper - only log in development
export const devLog = {
  error: (message: string, context?: LogContext) => {
    if (import.meta.env.MODE === 'development') {
      logger.error(message, context);
    }
  },
  warn: (message: string, context?: LogContext) => {
    if (import.meta.env.MODE === 'development') {
      logger.warn(message, context);
    }
  },
  info: (message: string, context?: LogContext) => {
    if (import.meta.env.MODE === 'development') {
      logger.info(message, context);
    }
  },
  debug: (message: string, context?: LogContext) => {
    if (import.meta.env.MODE === 'development') {
      logger.debug(message, context);
    }
  },
}; 