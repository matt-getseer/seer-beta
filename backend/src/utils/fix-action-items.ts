import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

async function migrateActionItems() {
  console.log('Starting action item migration...');
  
  try {
    // Get all meetings with legacy action items
    const meetings = await prisma.meeting.findMany({
      where: {
        actionItems: {
          isEmpty: false
        }
      }
    });
    
    console.log(`Found ${meetings.length} meetings with legacy action items to migrate`);
    
    let totalMigrated = 0;
    
    // Process each meeting
    for (const meeting of meetings) {
      console.log(`Processing meeting ${meeting.id}: "${meeting.title}"`);
      
      // Check if this meeting already has structured action items
      const existingActionItems = await prisma.actionItem.findMany({
        where: {
          meetingId: meeting.id
        }
      });
      
      if (existingActionItems.length > 0) {
        console.log(`  Meeting already has ${existingActionItems.length} structured action items, skipping`);
        continue;
      }
      
      // Migrate each legacy action item
      let migratedCount = 0;
      
      for (const text of meeting.actionItems) {
        // Create new structured action item
        await prisma.actionItem.create({
          data: {
            id: crypto.randomUUID(),
            text: text,
            status: 'incomplete',
            assignedTo: meeting.teamMemberId,
            meetingId: meeting.id,
            createdAt: new Date()
          }
        });
        
        migratedCount++;
      }
      
      console.log(`  Migrated ${migratedCount} action items for meeting ${meeting.id}`);
      totalMigrated += migratedCount;
    }
    
    console.log(`Migration complete. Total action items migrated: ${totalMigrated}`);
  } catch (error) {
    console.error('Error during migration:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the migration
migrateActionItems()
  .then(() => {
    console.log('Migration script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration script failed:', error);
    process.exit(1);
  }); 