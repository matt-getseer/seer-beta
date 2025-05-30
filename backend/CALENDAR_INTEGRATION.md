# Calendar Integration with MeetingBaas

This document explains how to use the integrated Google Calendar and MeetingBaas service that allows you to create calendar events with automatic recording capabilities.

## Overview

The integrated calendar service combines:
- **Google Calendar API**: For creating, updating, and managing calendar events
- **MeetingBaas**: For automatic meeting recording and bot management

## Prerequisites

1. **Google Calendar API Setup**: Already configured with OAuth credentials
2. **MeetingBaas Integration**: Already set up with API keys and calendar sync
3. **User Authentication**: Users must be authenticated via Clerk

## API Endpoints

### Integration Management

#### Check Integration Status
```http
GET /api/calendar/integration/status
```

Returns the connection status for both Google Calendar and MeetingBaas.

**Response:**
```json
{
  "success": true,
  "data": {
    "googleConnected": true,
    "meetingBaasConnected": true,
    "fullyConnected": true
  }
}
```

#### Setup Integration
```http
POST /api/calendar/integration/setup
```

Automatically sets up MeetingBaas calendar integration if Google Calendar is already connected.

### Event Management

#### Create Event with Recording
```http
POST /api/calendar/events
```

**Request Body:**
```json
{
  "summary": "Team Meeting",
  "description": "Weekly team sync",
  "startTime": "2024-01-15T10:00:00.000Z",
  "endTime": "2024-01-15T11:00:00.000Z",
  "attendees": ["user@example.com", "team@example.com"],
  "location": "Conference Room A",
  "meetingPlatform": "google_meet",
  "timeZone": "America/New_York",
  "enableRecording": true,
  "recordingOptions": {
    "allOccurrences": false,
    "customBotConfig": {
      "name": "Seer Meeting Bot"
    }
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "event_id_123",
    "summary": "Team Meeting",
    "description": "Weekly team sync",
    "startTime": "2024-01-15T10:00:00.000Z",
    "endTime": "2024-01-15T11:00:00.000Z",
    "attendees": ["user@example.com", "team@example.com"],
    "location": "Conference Room A",
    "meetingUrl": "https://meet.google.com/abc-defg-hij",
    "htmlLink": "https://calendar.google.com/event?eid=...",
    "recordingScheduled": true,
    "recordingId": "recording_123"
  }
}
```

#### List Events
```http
GET /api/calendar/events?startDate=2024-01-01&endDate=2024-01-31&maxResults=50
```

**Query Parameters:**
- `startDate` (optional): ISO 8601 date string, defaults to today
- `endDate` (optional): ISO 8601 date string, defaults to 30 days from now
- `maxResults` (optional): Number, defaults to 50

#### Get Specific Event
```http
GET /api/calendar/events/:eventId
```

#### Update Event
```http
PUT /api/calendar/events/:eventId
```

**Request Body:** (all fields optional)
```json
{
  "summary": "Updated Meeting Title",
  "enableRecording": false
}
```

#### Delete Event
```http
DELETE /api/calendar/events/:eventId
```

Deletes both the calendar event and any associated recording.

### Recording Management

#### Enable Recording for Event
```http
POST /api/calendar/events/:eventId/recording
```

**Request Body:**
```json
{
  "recordingOptions": {
    "allOccurrences": false,
    "customBotConfig": {
      "name": "Custom Bot Name"
    }
  }
}
```

#### Disable Recording for Event
```http
DELETE /api/calendar/events/:eventId/recording
```

## Service Architecture

### GoogleCalendarService
- Handles direct Google Calendar API interactions
- Creates, updates, deletes calendar events
- Manages Google Meet conference data
- Uses user's stored refresh tokens

### MeetingBaasCalendarService
- Manages MeetingBaas calendar integrations
- Schedules/unschedules recording bots
- Syncs with existing calendar events

### IntegratedCalendarService
- Combines both services
- Orchestrates event creation with recording
- Handles error scenarios gracefully
- Provides unified interface

## Usage Examples

### Create a Meeting with Recording

```javascript
const response = await fetch('/api/calendar/events', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${userToken}`
  },
  body: JSON.stringify({
    summary: 'Product Review Meeting',
    description: 'Monthly product review and planning session',
    startTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Tomorrow
    endTime: new Date(Date.now() + 24 * 60 * 60 * 1000 + 60 * 60 * 1000).toISOString(), // +1 hour
    attendees: ['product@company.com', 'engineering@company.com'],
    meetingPlatform: 'google_meet',
    enableRecording: true
  })
});

const event = await response.json();
console.log('Event created:', event.data);
```

### Check Integration Status

```javascript
const response = await fetch('/api/calendar/integration/status', {
  headers: {
    'Authorization': `Bearer ${userToken}`
  }
});

const status = await response.json();
if (!status.data.fullyConnected) {
  // Redirect user to complete setup
  window.location.href = '/settings?tab=integrations';
}
```

## Error Handling

The service handles various error scenarios:

1. **Google Calendar Not Connected**: Returns 400 with setup instructions
2. **MeetingBaas Not Connected**: Creates event but warns about recording
3. **Invalid Event Data**: Returns 400 with validation errors
4. **API Rate Limits**: Implements retry logic with exponential backoff
5. **Recording Failures**: Creates event successfully but logs recording errors

## Environment Variables Required

```env
# Google Calendar
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# MeetingBaas
MEETINGBAAS_API_KEY=your_meetingbaas_api_key
MEETINGBAAS_API_URL=https://api.meetingbaas.com

# Base URL for callbacks
BASE_URL=http://localhost:3001
```

## Next Steps

1. **Frontend Integration**: Create UI components for event creation/management
2. **Webhook Handling**: Process MeetingBaas webhooks for recording status updates
3. **Batch Operations**: Implement bulk event creation/management
4. **Calendar Sync**: Real-time sync between Google Calendar and MeetingBaas
5. **Advanced Recording Options**: Custom bot configurations, recording preferences 