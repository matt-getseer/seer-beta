const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testCalendarSync() {
  try {
    console.log('🔍 Testing Calendar Sync Functionality...\n');

    // 1. Check for calendar integrations
    console.log('1. Checking calendar integrations...');
    const integrations = await prisma.calendarIntegration.findMany({
      where: { isActive: true },
      include: { user: { select: { email: true, name: true } } }
    });
    
    console.log(`   Found ${integrations.length} active calendar integrations:`);
    integrations.forEach(integration => {
      console.log(`   - User: ${integration.user.email} (${integration.user.name})`);
      console.log(`     Provider: ${integration.provider}`);
      console.log(`     Calendar ID: ${integration.calendarId}`);
      console.log(`     Last Synced: ${integration.lastSyncedAt || 'Never'}`);
      console.log('');
    });

    // 2. Check for meetings with calendar event IDs
    console.log('2. Checking meetings with calendar event IDs...');
    const meetingsWithCalendarEvents = await prisma.meeting.findMany({
      where: { 
        calendarEventId: { not: null }
      },
      select: {
        id: true,
        title: true,
        date: true,
        calendarEventId: true,
        lastSyncedAt: true,
        user: { select: { email: true, name: true } }
      },
      orderBy: { date: 'desc' },
      take: 10
    });

    console.log(`   Found ${meetingsWithCalendarEvents.length} meetings with calendar event IDs:`);
    meetingsWithCalendarEvents.forEach(meeting => {
      console.log(`   - Meeting: ${meeting.title}`);
      console.log(`     Date: ${meeting.date}`);
      console.log(`     Calendar Event ID: ${meeting.calendarEventId}`);
      console.log(`     Last Synced: ${meeting.lastSyncedAt || 'Never'}`);
      console.log(`     Owner: ${meeting.user.email}`);
      console.log('');
    });

    // 3. Check for recent meeting changes
    console.log('3. Checking recent meeting changes...');
    const recentChanges = await prisma.meetingChange.findMany({
      where: {
        changeType: { in: ['synced', 'webhook_sync', 'updated'] }
      },
      include: {
        meeting: { select: { title: true, calendarEventId: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: 5
    });

    console.log(`   Found ${recentChanges.length} recent sync-related changes:`);
    recentChanges.forEach(change => {
      console.log(`   - Change Type: ${change.changeType}`);
      console.log(`     Meeting: ${change.meeting.title}`);
      console.log(`     Event ID: ${change.eventId}`);
      console.log(`     Created: ${change.createdAt}`);
      if (change.previousDate && change.newDate) {
        console.log(`     Date Change: ${change.previousDate} → ${change.newDate}`);
      }
      if (change.previousTitle && change.newTitle) {
        console.log(`     Title Change: ${change.previousTitle} → ${change.newTitle}`);
      }
      console.log('');
    });

    // 4. Summary and recommendations
    console.log('📋 Summary:');
    console.log(`   - Calendar Integrations: ${integrations.length}`);
    console.log(`   - Meetings with Calendar Events: ${meetingsWithCalendarEvents.length}`);
    console.log(`   - Recent Sync Changes: ${recentChanges.length}`);
    
    if (integrations.length === 0) {
      console.log('\n⚠️  No calendar integrations found. Calendar sync will not work.');
      console.log('   To fix: Set up calendar integration via the frontend.');
    } else if (meetingsWithCalendarEvents.length === 0) {
      console.log('\n⚠️  No meetings with calendar event IDs found.');
      console.log('   This means either:');
      console.log('   - No meetings have been created through the calendar integration');
      console.log('   - Meetings were created before calendar integration was set up');
    } else {
      console.log('\n✅ Calendar sync setup looks good!');
      console.log('   The sync should automatically update meeting dates when you move events in your calendar.');
      console.log('   Sync runs every 5 minutes, or you can trigger it manually via the API.');
    }

  } catch (error) {
    console.error('❌ Error testing calendar sync:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testCalendarSync(); 