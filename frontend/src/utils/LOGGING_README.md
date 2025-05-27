# Loglevel Logging System

This project uses **loglevel** for structured, professional logging instead of `console.log`. Loglevel is a lightweight, browser-compatible logging library that provides better error tracking, structured data, and environment-based log levels.

## Why loglevel?

- **Browser-compatible**: Unlike Winston, loglevel is designed for browser environments
- **Lightweight**: Only ~2KB, much smaller than Winston
- **Production-ready**: Used by React DevTools, Webpack, and many other major projects
- **Simple API**: Easy to use with familiar log levels
- **Environment-aware**: Automatically adjusts log levels based on development/production

## Usage

```typescript
import { logger } from './utils/logger';

// Basic logging
logger.error('Something went wrong');
logger.warn('This is a warning');
logger.info('Information message');
logger.debug('Debug information');

// Logging with context
logger.error('API call failed', {
  endpoint: '/api/users',
  userId: '123',
  error: error
});

// Component-specific logging
logger.componentError('UserProfile', error, {
  userId: '123',
  action: 'loadProfile'
});

// API-specific logging
logger.apiError('/api/users', error, {
  method: 'GET',
  userId: '123'
});

// User action tracking
logger.userAction('button_click', {
  component: 'UserProfile',
  buttonId: 'save-profile'
});
```

## Development vs Production

- **Development**: All log levels (debug, info, warn, error) are shown
- **Production**: Only warn and error levels are shown

## Development-only logging

```typescript
import { devLog } from './utils/logger';

// These only log in development mode
devLog.debug('This only shows in development');
devLog.info('Development info');
```

## Integration with Sentry

The logger automatically integrates with Sentry for error reporting:

- `logger.error()` calls report errors to Sentry
- `logger.componentError()` reports component errors
- `logger.apiError()` reports API errors
- Context data is preserved in Sentry reports

## Log Levels

1. **error**: Critical errors that need immediate attention
2. **warn**: Warning messages for potential issues
3. **info**: General information about application flow
4. **debug**: Detailed debugging information (development only)

## Security

The logger automatically sanitizes sensitive data:
- Removes `password`, `token`, `apiKey`, `secret` fields
- Formats error objects safely
- Preserves stack traces for debugging

## Best Practices

1. **Use appropriate log levels**: Don't use `error` for warnings
2. **Include context**: Always provide relevant context data
3. **Use specialized methods**: Prefer `apiError()` over generic `error()` for API calls
4. **Avoid logging sensitive data**: The sanitizer helps, but be mindful
5. **Use development helpers**: Use `devLog` for development-only logging

## Common Usage Patterns

### API Calls
```typescript
try {
  const response = await fetch('/api/users');
  logger.apiSuccess('/api/users', { method: 'GET', status: response.status });
} catch (error) {
  logger.apiError('/api/users', error, { method: 'GET', userId: 'user123' });
}
```

### Component Error Boundaries
```typescript
class ErrorBoundary extends React.Component {
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    logger.componentError('ErrorBoundary', error, {
      componentStack: errorInfo.componentStack,
      errorBoundary: true
    });
  }
}
```

### User Actions
```typescript
const handleSubmit = (formData: any) => {
  logger.userAction('form_submit', {
    formType: 'contact',
    fieldCount: Object.keys(formData).length,
    userId: getCurrentUserId()
  });
};
```

### Performance Monitoring
```typescript
const startTime = performance.now();
// ... do work ...
const duration = performance.now() - startTime;

logger.info('Operation completed', {
  operation: 'data_processing',
  duration: `${duration.toFixed(2)}ms`,
  recordsProcessed: 1000
});
```

## Integration with Existing Code

### Updating API Utilities
The `fetchApi` function in `utils/api.ts` has been updated to use the new logger:

```typescript
// Old
console.error('API request failed:', error);

// New
logger.apiError(endpoint, error, { 
  method: options.method || 'GET',
  url: url 
});
```

### Updating Hooks
The `useApiState` hook now supports logging context:

```typescript
// Usage with context
const result = await withApiState(
  () => userApi.getUsers(),
  actions,
  { component: 'UserList', action: 'loadUsers' }
);
```

## Future Enhancements

Consider adding these features as your application grows:

1. **Remote Logging**: Send logs to services like LogRocket, Datadog, or Sentry
2. **Log Aggregation**: Collect logs in a centralized system
3. **Performance Metrics**: Track API response times and user interactions
4. **Error Tracking**: Integrate with error monitoring services

## Migration Guide

To migrate from `console.log` to the new logger:

1. Replace `console.log` with `logger.info`
2. Replace `console.error` with `logger.error`
3. Replace `console.warn` with `logger.warn`
4. Add relevant context objects
5. Use specialized methods where appropriate

```typescript
// Before
console.log('User logged in:', user.email);
console.error('Login failed:', error);

// After
logger.info('User logged in', { email: user.email, userId: user.id });
logger.error('Login failed', { error, email: user.email, action: 'login' });
```

## Examples

See `utils/logger-examples.ts` for comprehensive usage examples covering all scenarios. 