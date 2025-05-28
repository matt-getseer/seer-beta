import { BaasClient, type BaasClientConfig } from '@meeting-baas/sdk/dist/baas/api/client';
import { DefaultApi, CalendarsApi, WebhooksApi } from '@meeting-baas/sdk/dist/baas/api';
import { Configuration } from '@meeting-baas/sdk/dist/baas/configuration';
import type { 
  JoinRequest, 
  JoinResponse, 
  CreateCalendarParams, 
  ListRawCalendarsParams,
  Metadata,
  Calendar,
  CreateCalendarResponse,
  ListRawCalendarsResponse
} from '@meeting-baas/sdk/dist/baas/models';

/**
 * MeetingBaas SDK Client Service
 * Based on the MCP documentation and real SDK implementation
 * 
 * This service provides a singleton wrapper around the MeetingBaas SDK
 * with proper error handling and logging.
 */
export class MeetingBaasClientService {
  private static instance: MeetingBaasClientService;
  private baasClient: BaasClient;
  private defaultApi: DefaultApi;
  private calendarsApi: CalendarsApi;
  private webhooksApi: WebhooksApi;
  private config: BaasClientConfig;

  private constructor(config: BaasClientConfig) {
    console.log('🚀 Initializing MeetingBaas SDK Client...');
    
    this.config = config;
    this.baasClient = new BaasClient(config);
    
    // Create configuration for direct API usage
    const configuration = new Configuration({
      apiKey: config.apiKey,
      basePath: config.baseUrl
    });
    
    this.defaultApi = new DefaultApi(configuration);
    this.calendarsApi = new CalendarsApi(configuration);
    this.webhooksApi = new WebhooksApi(configuration);
    
    console.log('✅ MeetingBaas SDK Client initialized successfully');
  }

  static getInstance(config?: BaasClientConfig): MeetingBaasClientService {
    if (!MeetingBaasClientService.instance) {
      if (!config) {
        throw new Error('MeetingBaasClientService requires configuration on first initialization');
      }
      MeetingBaasClientService.instance = new MeetingBaasClientService(config);
    }
    return MeetingBaasClientService.instance;
  }

  // Bot Management Methods - Based on MCP Documentation
  async join(joinRequest: JoinRequest): Promise<JoinResponse> {
    try {
      console.log('🤖 Joining meeting with MeetingBaas SDK:', {
        meetingUrl: joinRequest.meetingUrl,
        botName: joinRequest.botName
      });

      const response = await this.defaultApi.join({ joinRequest });
      console.log('✅ Successfully joined meeting:', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ Failed to join meeting:', error);
      throw new Error(`Failed to join meeting: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getMeetingData(botId: string): Promise<Metadata> {
    try {
      console.log('📊 Getting meeting data for bot:', botId);
      
      const response = await this.defaultApi.getMeetingData({ botId });
      console.log('✅ Successfully retrieved meeting data');
      return response.data;
    } catch (error) {
      console.error('❌ Failed to get meeting data:', error);
      throw new Error(`Failed to get meeting data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async leave(botId: string): Promise<void> {
    try {
      console.log('👋 Leaving meeting for bot:', botId);
      
      await this.defaultApi.leave({ uuid: botId });
      console.log('✅ Successfully left meeting');
    } catch (error) {
      console.error('❌ Failed to leave meeting:', error);
      throw new Error(`Failed to leave meeting: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async botsWithMetadata(): Promise<any> {
    try {
      console.log('🤖 Getting bots with metadata');
      
      const response = await this.defaultApi.botsWithMetadata({});
      console.log('✅ Successfully retrieved bots metadata');
      return response.data;
    } catch (error) {
      console.error('❌ Failed to get bots metadata:', error);
      throw new Error(`Failed to get bots metadata: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Calendar Management Methods - Based on MCP Documentation
  async createCalendar(params: CreateCalendarParams): Promise<Calendar> {
    try {
      console.log('📅 Creating calendar integration with detailed params:', {
        platform: params.platform,
        oauthClientId: params.oauthClientId ? '***' : 'not provided',
        oauthClientSecret: params.oauthClientSecret ? '***' : 'not provided',
        oauthRefreshToken: params.oauthRefreshToken ? '***' : 'not provided',
        raw_calendar_id: params.raw_calendar_id || 'not provided',
        fullParams: JSON.stringify(params, (key, value) => {
          if (key.includes('oauth') || key.includes('token') || key.includes('secret')) {
            return '***';
          }
          return value;
        }, 2)
      });

      // WORKAROUND: The SDK has a bug where it doesn't transform camelCase to snake_case
      // So we need to manually create the correct API payload
      const apiPayload = {
        platform: params.platform,
        oauth_client_id: params.oauthClientId,
        oauth_client_secret: params.oauthClientSecret,
        oauth_refresh_token: params.oauthRefreshToken,
        ...(params.raw_calendar_id && { raw_calendar_id: params.raw_calendar_id })
      };

      console.log('📤 Sending API request with snake_case params:', {
        platform: apiPayload.platform,
        oauth_client_id: apiPayload.oauth_client_id ? '***' : 'not provided',
        oauth_client_secret: apiPayload.oauth_client_secret ? '***' : 'not provided',
        oauth_refresh_token: apiPayload.oauth_refresh_token ? '***' : 'not provided',
        raw_calendar_id: apiPayload.raw_calendar_id || 'not provided'
      });

      // Use the SDK's underlying API call with the correct payload
      const response = await this.calendarsApi.createCalendar({ createCalendarParams: apiPayload as any });
      console.log('✅ Calendar created successfully:', response.data.calendar);
      return response.data.calendar;
    } catch (error: any) {
      console.log('❌ Failed to create calendar with detailed error:', {
        error,
        errorMessage: error.message,
        errorStack: error.stack,
        responseData: error.response?.data,
        responseStatus: error.response?.status,
        responseHeaders: error.response?.headers
      });
      throw new Error(`Failed to create calendar: ${error.message}`);
    }
  }

  async deleteCalendar(calendarId: string): Promise<void> {
    try {
      console.log('🗑️ Deleting calendar integration:', calendarId);

      await this.calendarsApi.deleteCalendar({ uuid: calendarId });
      console.log('✅ Successfully deleted calendar integration');
    } catch (error) {
      console.error('❌ Failed to delete calendar:', error);
      throw new Error(`Failed to delete calendar: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getCalendar(calendarId: string): Promise<any> {
    try {
      console.log('📅 Getting calendar details:', calendarId);

      const response = await this.calendarsApi.getCalendar({ uuid: calendarId });
      console.log('✅ Successfully retrieved calendar details');
      return response.data;
    } catch (error) {
      console.error('❌ Failed to get calendar:', error);
      throw new Error(`Failed to get calendar: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async listEvents(calendarId: string, params?: {
    attendeeEmail?: string;
    cursor?: string;
    organizerEmail?: string;
    startDateGte?: string;
    startDateLte?: string;
    status?: string;
    updatedAtGte?: string;
  }): Promise<any> {
    try {
      console.log('📅 Listing calendar events for:', calendarId);

      const response = await this.calendarsApi.listEvents({
        calendarId,
        attendeeEmail: params?.attendeeEmail || '',
        cursor: params?.cursor || '',
        organizerEmail: params?.organizerEmail || '',
        startDateGte: params?.startDateGte || '',
        startDateLte: params?.startDateLte || '',
        status: params?.status || '',
        updatedAtGte: params?.updatedAtGte || ''
      });
      console.log('✅ Successfully retrieved calendar events');
      return response.data;
    } catch (error) {
      console.error('❌ Failed to list events:', error);
      throw new Error(`Failed to list events: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getEvent(eventId: string): Promise<any> {
    try {
      console.log('📅 Getting event details:', eventId);

      const response = await this.calendarsApi.getEvent({ uuid: eventId });
      console.log('✅ Successfully retrieved event details');
      return response.data;
    } catch (error) {
      console.error('❌ Failed to get event:', error);
      throw new Error(`Failed to get event: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async scheduleRecordEvent(eventId: string, botParams: any, allOccurrences: boolean = false): Promise<any> {
    try {
      console.log('🎥 Scheduling recording for event:', eventId);

      const response = await this.calendarsApi.scheduleRecordEvent({
        uuid: eventId,
        botParam2: botParams,
        allOccurrences
      });
      console.log('✅ Successfully scheduled recording');
      return response.data;
    } catch (error) {
      console.error('❌ Failed to schedule recording:', error);
      throw new Error(`Failed to schedule recording: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async unscheduleRecordEvent(eventId: string, allOccurrences: boolean = false): Promise<any> {
    try {
      console.log('🚫 Unscheduling recording for event:', eventId);

      const response = await this.calendarsApi.unscheduleRecordEvent({
        uuid: eventId,
        allOccurrences
      });
      console.log('✅ Successfully unscheduled recording');
      return response.data;
    } catch (error) {
      console.error('❌ Failed to unschedule recording:', error);
      throw new Error(`Failed to unschedule recording: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async listRawCalendars(params: ListRawCalendarsParams): Promise<ListRawCalendarsResponse> {
    try {
      console.log('📅 Listing raw calendars:', {
        platform: params.platform,
        oauthClientId: params.oauthClientId ? '***' : 'not provided'
      });

      const response = await this.calendarsApi.listRawCalendars({ listRawCalendarsParams: params });
      console.log('✅ Successfully retrieved raw calendars');
      return response.data;
    } catch (error) {
      console.error('❌ Failed to list raw calendars:', error);
      throw new Error(`Failed to list raw calendars: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async listCalendars(): Promise<any> {
    try {
      console.log('📅 Listing calendars');
      
      const response = await this.calendarsApi.listCalendars();
      console.log('✅ Successfully retrieved calendars');
      return response.data;
    } catch (error) {
      console.error('❌ Failed to list calendars:', error);
      throw new Error(`Failed to list calendars: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Utility Methods
  getApiKey(): string {
    return this.config.apiKey;
  }

  getBaseUrl(): string {
    return this.config.baseUrl || 'https://api.meetingbaas.com';
  }
} 