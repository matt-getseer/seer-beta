# MeetingBaas Integration Guide

This document outlines the enhanced MeetingBaas integration implemented in the Seer application.

## Overview

The new integration provides a comprehensive solution for meeting recording and calendar management using the MeetingBaas platform. It includes:

- **Calendar Integration**: Connect Google and Microsoft calendars
- **Automated Recording**: Schedule recordings for calendar events
- **Bot Management**: Create and manage recording bots for direct meeting URLs
- **Webhook Processing**: Handle real-time events from MeetingBaas
- **Background Sync**: Automatic synchronization of meeting data

## Architecture

### Service Layer

#### 1. MeetingBaasClientService (`client.service.ts`)
- Centralized SDK wrapper with error handling and retry logic
- Singleton pattern for efficient resource usage
- Comprehensive API coverage for calendars and bots

#### 2. MeetingBaasCalendarService (`calendar.service.ts`)
- High-level calendar operations
- Calendar integration management
- Event recording scheduling
- Auto-scheduling capabilities

#### 3. MeetingBaasBotService (`bot.service.ts`)
- Direct bot creation and management
- Bot status synchronization
- Recording retranscription

#### 4. MeetingBaasWebhookService (`webhook.service.ts`)
- Webhook event processing
- Signature verification
- Idempotency handling
- Retry logic with exponential backoff

#### 5. MeetingBaasSchedulerService (`scheduler.service.ts`)
- Background task management
- Periodic bot status sync
- Calendar synchronization
- Auto-scheduling of recordings

### Configuration

All configuration is centralized in `config/meetingbaas.config.ts`:

```typescript
export const MeetingBaasConfig = {
  client: {
    apiKey: process.env.MEETINGBAAS_API_KEY!,
    baseUrl: process.env.MEETINGBAAS_API_URL || 'https://api.meetingbaas.com',
  },
  bot: {
    defaultName: "Seer Meeting Bot",
    defaultWebhookUrl: `${process.env.BASE_URL}/api/meetingbaas/webhooks`,
    recordingMode: "speaker_view",
    speechToText: {
      provider: "deepgram",
      apiKey: process.env.DEEPGRAM_API_KEY,
    },
    automaticLeave: {
      nooneJoinedTimeout: 300, // 5 minutes
      waitingRoomTimeout: 120, // 2 minutes
    },
  },
  // ... more configuration
};
```

## API Endpoints

### Calendar Integration
- `POST /api/meetingbaas/calendar/setup` - Setup calendar integration
- `POST /api/meetingbaas/calendar/list-available` - List available calendars
- `GET /api/meetingbaas/calendar/integrations` - Get user's integrations
- `DELETE /api/meetingbaas/calendar/integrations/:provider` - Delete integration

### Calendar Events
- `GET /api/meetingbaas/calendar/events` - Get calendar events
- `POST /api/meetingbaas/calendar/events/:eventId/schedule-recording` - Schedule recording
- `DELETE /api/meetingbaas/calendar/events/:eventId/schedule-recording` - Unschedule recording

### Bot Management
- `POST /api/meetingbaas/bots` - Create bot for meeting URL
- `GET /api/meetingbaas/bots/:botId` - Get bot details
- `DELETE /api/meetingbaas/bots/:botId` - End bot session
- `GET /api/meetingbaas/bots` - List recent bots
- `POST /api/meetingbaas/bots/:botId/retranscribe` - Retranscribe recording

### Sync Operations
- `POST /api/meetingbaas/calendar/sync` - Sync calendar events
- `POST /api/meetingbaas/calendar/auto-schedule` - Auto-schedule recordings

### Webhooks
- `POST /api/meetingbaas/webhooks` - Handle MeetingBaas webhooks

## Environment Variables

Add these to your `.env` file:

```bash
# MeetingBaas Configuration
MEETINGBAAS_API_KEY=your-meetingbaas-api-key
MEETINGBAAS_API_URL=https://api.meetingbaas.com

# Speech-to-Text (Optional)
DEEPGRAM_API_KEY=your-deepgram-api-key

# OAuth for Calendar Integrations
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
MICROSOFT_CLIENT_ID=your-microsoft-client-id
MICROSOFT_CLIENT_SECRET=your-microsoft-client-secret

# Base URL for webhooks
BASE_URL=http://localhost:3001
```

## Database Schema

The integration uses the existing database schema with these key models:

### CalendarIntegration
```sql
model CalendarIntegration {
  id                String    @id @default(uuid())
  userId            String
  provider          String    // "google", "microsoft"
  calendarId        String    // MeetingBaas calendar ID
  externalCalendarId String   // Google/Microsoft calendar ID
  refreshToken      String?
  isActive          Boolean   @default(true)
  lastSyncedAt      DateTime?
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  
  @@unique([userId, provider])
}
```

### Meeting (Enhanced)
```sql
model Meeting {
  // ... existing fields ...
  
  // MeetingBaas specific fields
  meetingBaasId     String?   @unique
  processingStatus  String    @default("pending")
  recordingUrl      String?
  
  // Calendar integration fields
  meetingBaasCalendarId  String?
  calendarEventId        String?
  calendarProvider       String?
}
```

## Usage Examples

### 1. Setup Calendar Integration

```typescript
// Setup Google calendar integration
const response = await fetch('/api/meetingbaas/calendar/setup', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    provider: 'google',
    refreshToken: 'user-refresh-token',
    rawCalendarId: 'primary'
  })
});
```

### 2. Create Bot for Meeting URL

```typescript
// Create bot for a Zoom meeting
const response = await fetch('/api/meetingbaas/bots', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    meetingUrl: 'https://zoom.us/j/123456789',
    meetingId: 'meeting-uuid',
    customBotName: 'Custom Bot Name'
  })
});
```

### 3. Schedule Recording for Calendar Event

```typescript
// Schedule recording for a calendar event
const response = await fetch('/api/meetingbaas/calendar/events/event-id/schedule-recording', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    allOccurrences: false,
    customBotConfig: {
      recording_mode: 'gallery_view'
    }
  })
});
```

## Background Tasks

The scheduler service runs several background tasks:

1. **Bot Status Sync** (every 2 minutes)
   - Updates meeting statuses based on bot data
   - Syncs recording URLs and completion status

2. **Calendar Sync** (every 5 minutes)
   - Fetches latest calendar events
   - Updates local database with changes

3. **Auto-Scheduling** (every 10 minutes)
   - Automatically schedules recordings for upcoming meetings
   - Configurable via `MeetingBaasConfig.calendar.autoScheduling`

## Webhook Events

The integration handles these webhook events:

- `bot_join_call` - Bot joined the meeting
- `bot_leave_call` - Bot left the meeting
- `recording_ready` - Recording is available
- `transcript_ready` - Transcript is available
- `bot_error` - Bot encountered an error
- `bot_waiting_room` - Bot is in waiting room
- `bot_admitted` - Bot was admitted to the call

## Error Handling

The integration includes comprehensive error handling:

1. **Retry Logic**: Automatic retries with exponential backoff
2. **Graceful Degradation**: Continues operation even if some services fail
3. **Detailed Logging**: Comprehensive error logging for debugging
4. **Idempotency**: Webhook events are processed only once
5. **Validation**: Input validation at all API endpoints

## Security

- **Webhook Verification**: Optional signature verification for webhooks
- **Authentication**: All API endpoints require user authentication
- **Token Management**: Secure handling of OAuth tokens
- **Rate Limiting**: Built-in delays to prevent API rate limiting

## Monitoring

The integration provides monitoring capabilities:

1. **Health Checks**: Database and service health monitoring
2. **Scheduler Status**: Real-time status of background tasks
3. **Error Tracking**: Comprehensive error logging
4. **Performance Metrics**: Request timing and success rates

## Migration from Legacy System

To migrate from the existing MeetingBaas implementation:

1. **Install Dependencies**: Add `@meeting-baas/sdk` to package.json
2. **Update Environment**: Add new environment variables
3. **Database Migration**: Run Prisma migrations for new schema
4. **Route Updates**: Update frontend to use new API endpoints
5. **Configuration**: Configure MeetingBaas settings
6. **Testing**: Test calendar integrations and bot creation

## Troubleshooting

### Common Issues

1. **SDK Not Found**: Ensure `@meeting-baas/sdk` is installed
2. **Database Errors**: Check Prisma schema and migrations
3. **Webhook Failures**: Verify webhook URL and signature verification
4. **Calendar Sync Issues**: Check OAuth tokens and permissions
5. **Bot Creation Failures**: Verify MeetingBaas API key and meeting URLs

### Debug Mode

Enable debug logging by setting:
```bash
NODE_ENV=development
```

### Health Check

Check system health at:
```
GET /api/health
```

## Performance Optimizations

1. **Connection Pooling**: Efficient database connection management
2. **Caching**: In-memory caching for frequently accessed data
3. **Batch Operations**: Bulk processing of calendar events
4. **Rate Limiting**: Intelligent rate limiting to avoid API limits
5. **Background Processing**: Non-blocking background tasks

## Future Enhancements

Potential improvements for the integration:

1. **Real-time Updates**: WebSocket support for real-time status updates
2. **Advanced Analytics**: Meeting analytics and reporting
3. **Custom Workflows**: User-defined automation workflows
4. **Multi-tenant Support**: Enhanced multi-tenant capabilities
5. **Advanced Scheduling**: More sophisticated scheduling algorithms 