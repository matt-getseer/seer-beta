import { MeetingBaasCalendarService } from './calendar.service';
import { MeetingBaasBotService } from './bot.service';
import { MeetingBaasConfig } from '../../config/meetingbaas.config';
import { prisma } from '../../utils/prisma';

/**
 * Background scheduler service for MeetingBaas operations
 */
export class MeetingBaasSchedulerService {
  private calendarService: MeetingBaasCalendarService;
  private botService: MeetingBaasBotService;
  private syncInterval: NodeJS.Timeout | null = null;
  private autoScheduleInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.calendarService = new MeetingBaasCalendarService();
    this.botService = new MeetingBaasBotService();
  }

  /**
   * Start all background tasks
   */
  start(): void {
    console.log('Starting MeetingBaas scheduler service...');

    // Start bot status sync (every 2 minutes)
    this.startBotStatusSync();

    // Start calendar sync (every 5 minutes)
    this.startCalendarSync();

    // Start auto-scheduling (every 10 minutes)
    this.startAutoScheduling();

    console.log('MeetingBaas scheduler service started');
  }

  /**
   * Stop all background tasks
   */
  stop(): void {
    console.log('Stopping MeetingBaas scheduler service...');

    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }

    if (this.autoScheduleInterval) {
      clearInterval(this.autoScheduleInterval);
      this.autoScheduleInterval = null;
    }

    console.log('MeetingBaas scheduler service stopped');
  }

  /**
   * Start periodic bot status synchronization
   */
  private startBotStatusSync(): void {
    const syncBotStatuses = async () => {
      try {
        console.log('Running bot status sync...');
        await this.botService.syncActiveBots();
      } catch (error) {
        console.error('Error in bot status sync:', error);
      }
    };

    // Run immediately
    syncBotStatuses();

    // Then run every 2 minutes
    this.syncInterval = setInterval(syncBotStatuses, 2 * 60 * 1000);
  }

  /**
   * Start periodic calendar synchronization
   */
  private startCalendarSync(): void {
    const syncCalendars = async () => {
      try {
        console.log('Running calendar sync...');

        // Get all users with active calendar integrations
        const integrations = await prisma.calendarIntegration.findMany({
          where: { isActive: true },
          select: { userId: true },
          distinct: ['userId'],
        });

        for (const integration of integrations) {
          try {
            await this.calendarService.syncCalendarEvents(integration.userId);
            // Add small delay between users to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 1000));
          } catch (error) {
            console.error(`Error syncing calendar for user ${integration.userId}:`, error);
          }
        }

        console.log(`Calendar sync completed for ${integrations.length} users`);
      } catch (error) {
        console.error('Error in calendar sync:', error);
      }
    };

    // Run every 5 minutes (configurable)
    const interval = MeetingBaasConfig.calendar.syncInterval;
    setInterval(syncCalendars, interval);

    // Run once after 30 seconds to allow server to fully start
    setTimeout(syncCalendars, 30000);
  }

  /**
   * Start periodic auto-scheduling of recordings
   */
  private startAutoScheduling(): void {
    if (!MeetingBaasConfig.calendar.autoScheduling) {
      console.log('Auto-scheduling is disabled');
      return;
    }

    const autoSchedule = async () => {
      try {
        console.log('Running auto-scheduling...');

        // Get all users with active calendar integrations
        const integrations = await prisma.calendarIntegration.findMany({
          where: { isActive: true },
          select: { userId: true },
          distinct: ['userId'],
        });

        for (const integration of integrations) {
          try {
            await this.calendarService.autoScheduleRecordings(integration.userId);
            // Add small delay between users to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 2000));
          } catch (error) {
            console.error(`Error auto-scheduling for user ${integration.userId}:`, error);
          }
        }

        console.log(`Auto-scheduling completed for ${integrations.length} users`);
      } catch (error) {
        console.error('Error in auto-scheduling:', error);
      }
    };

    // Run every 10 minutes
    this.autoScheduleInterval = setInterval(autoSchedule, 10 * 60 * 1000);

    // Run once after 1 minute to allow server to fully start
    setTimeout(autoSchedule, 60000);
  }

  /**
   * Manually trigger bot status sync
   */
  async triggerBotStatusSync(): Promise<void> {
    console.log('Manually triggering bot status sync...');
    await this.botService.syncActiveBots();
  }

  /**
   * Manually trigger calendar sync for a specific user
   */
  async triggerCalendarSync(userId: string): Promise<void> {
    console.log(`Manually triggering calendar sync for user ${userId}...`);
    await this.calendarService.syncCalendarEvents(userId);
  }

  /**
   * Manually trigger auto-scheduling for a specific user
   */
  async triggerAutoScheduling(userId: string): Promise<void> {
    console.log(`Manually triggering auto-scheduling for user ${userId}...`);
    await this.calendarService.autoScheduleRecordings(userId);
  }

  /**
   * Get scheduler status
   */
  getStatus(): {
    running: boolean;
    botSyncActive: boolean;
    calendarSyncActive: boolean;
    autoSchedulingActive: boolean;
    config: typeof MeetingBaasConfig;
  } {
    return {
      running: this.syncInterval !== null || this.autoScheduleInterval !== null,
      botSyncActive: this.syncInterval !== null,
      calendarSyncActive: true, // Calendar sync doesn't use a stored interval
      autoSchedulingActive: this.autoScheduleInterval !== null,
      config: MeetingBaasConfig,
    };
  }

  /**
   * Clean up old webhook cache entries and expired data
   */
  async cleanupExpiredData(): Promise<void> {
    try {
      console.log('Cleaning up expired data...');

      // Clean up old meeting changes (older than 30 days)
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      
      const deletedChanges = await prisma.meetingChange.deleteMany({
        where: {
          createdAt: {
            lt: thirtyDaysAgo,
          },
        },
      });

      console.log(`Cleaned up ${deletedChanges.count} old meeting changes`);

      // Update last sync times for inactive integrations
      await prisma.calendarIntegration.updateMany({
        where: {
          isActive: false,
          lastSyncedAt: {
            lt: thirtyDaysAgo,
          },
        },
        data: {
          lastSyncedAt: null,
        },
      });

      console.log('Cleanup completed');
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  }
}

// Export singleton instance
export const meetingBaasScheduler = new MeetingBaasSchedulerService(); 