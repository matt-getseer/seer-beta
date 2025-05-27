# Sentry Integration Setup Guide

This guide will help you set up Sentry for error tracking and performance monitoring in your React application.

## 1. Create a Sentry Account

1. Go to [sentry.io](https://sentry.io) and create an account
2. Create a new project and select "React" as the platform
3. Copy your DSN (Data Source Name) from the project settings

## 2. Environment Variables

Add these variables to your `.env` file:

```bash
# Sentry Configuration
VITE_SENTRY_DSN=https://your-dsn@sentry.io/project-id
VITE_ENABLE_SENTRY=false  # Set to true to enable in development
VITE_APP_VERSION=1.0.0    # Your app version for release tracking
```

### Environment Behavior

- **Development**: Sentry is disabled by default (unless `VITE_ENABLE_SENTRY=true`)
- **Production**: Sentry is automatically enabled if DSN is provided

## 3. What's Already Integrated

### ✅ Automatic Error Reporting
- All `log.error()` calls automatically report to Sentry
- API errors are tracked with endpoint and method context
- Component errors include component name and props
- Unhandled React errors are caught by error boundaries

### ✅ Performance Monitoring
- API calls are automatically tracked with response times
- User interactions are recorded as breadcrumbs
- Page navigation is monitored
- Custom performance transactions can be created

### ✅ User Context
- User IDs are automatically attached to error reports
- User actions create breadcrumb trails for debugging

### ✅ Error Filtering
- Development errors are filtered out (unless explicitly enabled)
- Network errors and Clerk auth errors are filtered
- Sensitive data is automatically removed

## 4. Usage Examples

### Basic Error Reporting
```typescript
import { log } from './utils/logger';

// This automatically reports to Sentry
log.error('Something went wrong', { 
  error: new Error('Details'),
  userId: 'user123',
  component: 'UserProfile'
});
```

### API Error Tracking
```typescript
// API errors are automatically tracked with performance metrics
try {
  const users = await userApi.getUsers();
} catch (error) {
  // Automatically logged and reported to Sentry
  log.apiError('/api/users', error, { action: 'loadUsers' });
}
```

### Component Error Boundaries
```typescript
import { SentryErrorBoundary } from './utils/sentry';

// Wrap components to catch and report errors
export default SentryErrorBoundary(MyComponent, {
  fallback: ({ error }) => <div>Something went wrong: {error.message}</div>,
  beforeCapture: (scope, error, errorInfo) => {
    scope.setTag('component', 'MyComponent');
  }
});
```

### Manual Error Reporting
```typescript
import { reportError } from './utils/sentry';

// Report errors directly to Sentry
reportError(new Error('Custom error'), {
  component: 'PaymentForm',
  userId: 'user123',
  action: 'processPayment'
});
```

### Performance Tracking
```typescript
import { startTransaction } from './utils/sentry';

// Track custom operations
const transaction = startTransaction('data-processing', 'task');
try {
  // Do work
  await processLargeDataset();
  transaction.setStatus('ok');
} catch (error) {
  transaction.setStatus('internal_error');
  throw error;
} finally {
  transaction.finish();
}
```

## 5. Sentry Dashboard Features

Once set up, you'll have access to:

### Error Tracking
- Real-time error notifications
- Error grouping and frequency
- Stack traces with source maps
- User impact analysis
- Release tracking

### Performance Monitoring
- API response time tracking
- Page load performance
- User interaction metrics
- Database query performance (if backend integrated)

### Release Management
- Deploy tracking
- Regression detection
- Performance comparisons between releases

### Alerts
- Email/Slack notifications for new errors
- Performance degradation alerts
- Error rate threshold alerts

## 6. Best Practices

### 1. Use Releases
Update your build process to set the app version:
```bash
VITE_APP_VERSION=$(git rev-parse --short HEAD)
```

### 2. Source Maps
Ensure source maps are uploaded to Sentry for better stack traces:
```bash
# Install Sentry CLI
npm install -g @sentry/cli

# Upload source maps after build
sentry-cli releases files $VERSION upload-sourcemaps ./dist
```

### 3. User Feedback
Add user feedback collection:
```typescript
import { Sentry } from './utils/sentry';

// Show user feedback dialog on errors
Sentry.showReportDialog({
  eventId: 'event-id',
  user: { email: 'user@example.com' }
});
```

### 4. Custom Tags
Add custom tags for better filtering:
```typescript
import { Sentry } from './utils/sentry';

Sentry.setTag('feature', 'payments');
Sentry.setTag('user_type', 'premium');
```

## 7. Development Testing

To test Sentry in development:

1. Set `VITE_ENABLE_SENTRY=true` in your `.env`
2. Add your DSN
3. Trigger an error:
```typescript
// Test error reporting
log.error('Test error', { error: new Error('Test'), userId: 'test' });
```

## 8. Production Deployment

### Environment Variables
Set these in your production environment:
```bash
VITE_SENTRY_DSN=your-production-dsn
VITE_APP_VERSION=your-release-version
```

### Monitoring Setup
1. Set up alerts for error rate increases
2. Configure performance thresholds
3. Set up Slack/email notifications
4. Create dashboards for key metrics

## 9. Privacy Considerations

The integration is configured with privacy in mind:
- `sendDefaultPii: false` - No personally identifiable information
- Sensitive fields are automatically filtered from logs
- User emails are not sent unless explicitly set

## 10. Cost Optimization

- **Error Budget**: Monitor your error quota usage
- **Sampling**: Production uses 10% performance sampling
- **Filtering**: Non-critical errors are filtered out
- **Retention**: Configure data retention based on your plan

## 11. Integration with Existing Logging

The Sentry integration works seamlessly with your Winston logger:
- All error logs are automatically sent to Sentry
- Context from Winston is preserved in Sentry
- No changes needed to existing logging code
- Development logs still work normally

## 12. Troubleshooting

### Common Issues

**Sentry not receiving events:**
- Check DSN is correct
- Verify environment variables are loaded
- Check browser console for Sentry errors

**Too many events:**
- Adjust sampling rates
- Add more error filtering
- Review beforeSend configuration

**Missing context:**
- Ensure user context is set after login
- Check that context is passed to log methods
- Verify sanitization isn't removing needed data

### Debug Mode
Enable debug mode in development:
```typescript
// In sentry.ts, debug is already enabled for development
debug: import.meta.env.MODE === 'development'
```

This will log Sentry operations to the browser console for debugging. 