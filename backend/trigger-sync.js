const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function triggerSync() {
  try {
    console.log('🔄 Manually triggering calendar sync...\n');

    // Get the user with calendar integration
    const integration = await prisma.calendarIntegration.findFirst({
      where: { isActive: true },
      include: { user: { select: { id: true, email: true, name: true } } }
    });

    if (!integration) {
      console.log('❌ No active calendar integration found');
      return;
    }

    console.log(`Found integration for user: ${integration.user.email}`);
    console.log(`Calendar ID: ${integration.calendarId}\n`);

    // Import and use the calendar service
    const { MeetingBaasCalendarService } = require('./src/services/meetingbaas/calendar.service');
    const calendarService = new MeetingBaasCalendarService();

    console.log('🔄 Starting calendar sync...');
    await calendarService.syncCalendarEvents(integration.userId);
    console.log('✅ Calendar sync completed!\n');

    // Check the results
    console.log('📊 Checking sync results...');
    const updatedMeetings = await prisma.meeting.findMany({
      where: { 
        calendarEventId: { not: null },
        createdBy: integration.userId
      },
      select: {
        id: true,
        title: true,
        date: true,
        calendarEventId: true,
        lastSyncedAt: true
      },
      orderBy: { lastSyncedAt: 'desc' }
    });

    console.log(`Found ${updatedMeetings.length} meetings with calendar events:`);
    updatedMeetings.forEach(meeting => {
      console.log(`  - ${meeting.title}`);
      console.log(`    Date: ${meeting.date}`);
      console.log(`    Last Synced: ${meeting.lastSyncedAt || 'Never'}`);
      console.log('');
    });

    // Check for recent changes
    const recentChanges = await prisma.meetingChange.findMany({
      where: {
        changeType: { in: ['synced', 'webhook_sync'] },
        createdAt: { gte: new Date(Date.now() - 5 * 60 * 1000) } // Last 5 minutes
      },
      include: {
        meeting: { select: { title: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    if (recentChanges.length > 0) {
      console.log(`📝 Found ${recentChanges.length} recent sync changes:`);
      recentChanges.forEach(change => {
        console.log(`  - ${change.meeting.title}: ${change.changeType}`);
        if (change.previousDate && change.newDate) {
          console.log(`    Date changed: ${change.previousDate} → ${change.newDate}`);
        }
        if (change.previousTitle && change.newTitle) {
          console.log(`    Title changed: ${change.previousTitle} → ${change.newTitle}`);
        }
      });
    } else {
      console.log('📝 No recent sync changes found (this is normal if calendar events haven\'t changed)');
    }

  } catch (error) {
    console.error('❌ Error triggering sync:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the sync
triggerSync(); 