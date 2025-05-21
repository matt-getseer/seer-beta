/**
 * Utility script to migrate all legacy action items to the new structured format
 * Run with: npx ts-node src/utils/migrate-action-items.ts
 */

import { prisma } from '../utils/prisma';
import crypto from 'crypto';

async function migrateAllActionItems() {
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
      const existingActionItems = await prisma.$queryRaw`
        SELECT * FROM "ActionItem" WHERE "meetingId" = ${meeting.id}
      ` as any[];
      
      if (existingActionItems.length > 0) {
        console.log(`  Meeting already has ${existingActionItems.length} structured action items, skipping`);
        continue;
      }
      
      // Migrate each legacy action item
      let migratedCount = 0;
      for (const text of meeting.actionItems) {
        const now = new Date();
        const id = crypto.randomUUID();
        
        await prisma.$executeRaw`
          INSERT INTO "ActionItem" (
            "id", 
            "text", 
            "assignedTo", 
            "meetingId", 
            "status", 
            "createdAt"
          )
          VALUES (
            ${id}, 
            ${text}, 
            ${meeting.teamMemberId}, 
            ${meeting.id}, 
            'incomplete', 
            ${now.toISOString()}
          )
        `;
        
        migratedCount++;
      }
      
      console.log(`  Migrated ${migratedCount} action items for meeting ${meeting.id}`);
      totalMigrated += migratedCount;
    }
    
    console.log(`Migration complete. Total action items migrated: ${totalMigrated}`);
  } catch (error) {
    console.error('Error during migration:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the migration
migrateAllActionItems()
  .then(() => {
    console.log('Migration script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration script failed:', error);
    process.exit(1);
  }); 