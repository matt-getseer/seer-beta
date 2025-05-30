import { Request, Response } from 'express';
import { IntegratedCalendarService, IntegratedEventData } from '../services/integrated-calendar.service';

export class CalendarController {
  private integratedCalendarService: IntegratedCalendarService;

  constructor() {
    this.integratedCalendarService = new IntegratedCalendarService();
  }

  /**
   * Get integration status for user
   */
  getIntegrationStatus = async (req: Request, res: Response) => {
    try {
      if (!req.auth?.userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const status = await this.integratedCalendarService.isFullyConnected(req.auth.userId);
      
      res.json({
        success: true,
        data: status
      });

    } catch (error) {
      console.error('Error getting integration status:', error);
      res.status(500).json({
        error: 'Failed to get integration status',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  };

  /**
   * Setup complete integration
   */
  setupIntegration = async (req: Request, res: Response) => {
    try {
      if (!req.auth?.userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const result = await this.integratedCalendarService.setupIntegration(req.auth.userId);
      
      if (result.success) {
        res.json({
          success: true,
          data: result
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.message,
          data: result
        });
      }

    } catch (error) {
      console.error('Error setting up integration:', error);
      res.status(500).json({
        error: 'Failed to setup integration',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  };

  /**
   * Create a new calendar event with optional recording
   */
  createEvent = async (req: Request, res: Response) => {
    try {
      if (!req.auth?.userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const eventData: IntegratedEventData = {
        summary: req.body.summary,
        description: req.body.description,
        startTime: new Date(req.body.startTime),
        endTime: new Date(req.body.endTime),
        attendees: req.body.attendees,
        location: req.body.location,
        meetingPlatform: req.body.meetingPlatform,
        timeZone: req.body.timeZone,
        enableRecording: req.body.enableRecording,
        recordingOptions: req.body.recordingOptions,
      };

      // Validate required fields
      if (!eventData.summary || !eventData.startTime || !eventData.endTime) {
        return res.status(400).json({
          error: 'Missing required fields: summary, startTime, endTime'
        });
      }

      if (eventData.startTime >= eventData.endTime) {
        return res.status(400).json({
          error: 'Start time must be before end time'
        });
      }

      const event = await this.integratedCalendarService.createEventWithRecording(
        req.auth.userId,
        eventData
      );

      res.status(201).json({
        success: true,
        data: event
      });

    } catch (error) {
      console.error('Error creating calendar event:', error);
      res.status(500).json({
        error: 'Failed to create calendar event',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  };

  /**
   * List calendar events
   */
  listEvents = async (req: Request, res: Response) => {
    try {
      if (!req.auth?.userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      // Parse query parameters
      const startDate = req.query.startDate 
        ? new Date(req.query.startDate as string)
        : new Date(); // Default to today

      const endDate = req.query.endDate
        ? new Date(req.query.endDate as string)
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // Default to 30 days from now

      const maxResults = req.query.maxResults
        ? parseInt(req.query.maxResults as string, 10)
        : 50;

      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return res.status(400).json({
          error: 'Invalid date format. Use ISO 8601 format (YYYY-MM-DDTHH:mm:ss.sssZ)'
        });
      }

      if (startDate >= endDate) {
        return res.status(400).json({
          error: 'Start date must be before end date'
        });
      }

      const events = await this.integratedCalendarService.listEventsWithRecording(
        req.auth.userId,
        startDate,
        endDate,
        maxResults
      );

      res.json({
        success: true,
        data: {
          events,
          count: events.length,
          dateRange: {
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString()
          }
        }
      });

    } catch (error) {
      console.error('Error listing calendar events:', error);
      res.status(500).json({
        error: 'Failed to list calendar events',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  };

  /**
   * Get a specific calendar event
   */
  getEvent = async (req: Request, res: Response) => {
    try {
      if (!req.auth?.userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const { eventId } = req.params;

      if (!eventId) {
        return res.status(400).json({ error: 'Event ID is required' });
      }

      const event = await this.integratedCalendarService.getEventWithRecording(
        req.auth.userId,
        eventId
      );

      res.json({
        success: true,
        data: event
      });

    } catch (error) {
      console.error('Error getting calendar event:', error);
      res.status(500).json({
        error: 'Failed to get calendar event',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  };

  /**
   * Update a calendar event
   */
  updateEvent = async (req: Request, res: Response) => {
    try {
      if (!req.auth?.userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const { eventId } = req.params;

      if (!eventId) {
        return res.status(400).json({ error: 'Event ID is required' });
      }

      const updateData: Partial<IntegratedEventData> = {};

      // Only include fields that are provided
      if (req.body.summary !== undefined) updateData.summary = req.body.summary;
      if (req.body.description !== undefined) updateData.description = req.body.description;
      if (req.body.startTime !== undefined) updateData.startTime = new Date(req.body.startTime);
      if (req.body.endTime !== undefined) updateData.endTime = new Date(req.body.endTime);
      if (req.body.attendees !== undefined) updateData.attendees = req.body.attendees;
      if (req.body.location !== undefined) updateData.location = req.body.location;
      if (req.body.meetingPlatform !== undefined) updateData.meetingPlatform = req.body.meetingPlatform;
      if (req.body.timeZone !== undefined) updateData.timeZone = req.body.timeZone;
      if (req.body.enableRecording !== undefined) updateData.enableRecording = req.body.enableRecording;
      if (req.body.recordingOptions !== undefined) updateData.recordingOptions = req.body.recordingOptions;

      // Validate dates if provided
      if (updateData.startTime && isNaN(updateData.startTime.getTime())) {
        return res.status(400).json({ error: 'Invalid start time format' });
      }

      if (updateData.endTime && isNaN(updateData.endTime.getTime())) {
        return res.status(400).json({ error: 'Invalid end time format' });
      }

      if (updateData.startTime && updateData.endTime && updateData.startTime >= updateData.endTime) {
        return res.status(400).json({ error: 'Start time must be before end time' });
      }

      const event = await this.integratedCalendarService.updateEventWithRecording(
        req.auth.userId,
        eventId,
        updateData
      );

      res.json({
        success: true,
        data: event
      });

    } catch (error) {
      console.error('Error updating calendar event:', error);
      res.status(500).json({
        error: 'Failed to update calendar event',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  };

  /**
   * Delete a calendar event
   */
  deleteEvent = async (req: Request, res: Response) => {
    try {
      if (!req.auth?.userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const { eventId } = req.params;

      if (!eventId) {
        return res.status(400).json({ error: 'Event ID is required' });
      }

      await this.integratedCalendarService.deleteEventWithRecording(
        req.auth.userId,
        eventId
      );

      res.json({
        success: true,
        message: 'Event deleted successfully'
      });

    } catch (error) {
      console.error('Error deleting calendar event:', error);
      res.status(500).json({
        error: 'Failed to delete calendar event',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  };

  /**
   * Enable recording for an event
   */
  enableRecording = async (req: Request, res: Response) => {
    try {
      if (!req.auth?.userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const { eventId } = req.params;

      if (!eventId) {
        return res.status(400).json({ error: 'Event ID is required' });
      }

      const event = await this.integratedCalendarService.updateEventWithRecording(
        req.auth.userId,
        eventId,
        {
          enableRecording: true,
          recordingOptions: req.body.recordingOptions
        }
      );

      res.json({
        success: true,
        data: event,
        message: 'Recording enabled for event'
      });

    } catch (error) {
      console.error('Error enabling recording:', error);
      res.status(500).json({
        error: 'Failed to enable recording',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  };

  /**
   * Disable recording for an event
   */
  disableRecording = async (req: Request, res: Response) => {
    try {
      if (!req.auth?.userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const { eventId } = req.params;

      if (!eventId) {
        return res.status(400).json({ error: 'Event ID is required' });
      }

      const event = await this.integratedCalendarService.updateEventWithRecording(
        req.auth.userId,
        eventId,
        { enableRecording: false }
      );

      res.json({
        success: true,
        data: event,
        message: 'Recording disabled for event'
      });

    } catch (error) {
      console.error('Error disabling recording:', error);
      res.status(500).json({
        error: 'Failed to disable recording',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  };
} 