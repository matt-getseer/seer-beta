/**
 * Utility script to migrate all legacy tasks to the new structured format
 * Run with: npx ts-node src/utils/migrate-tasks.ts
 */

import { prisma } from '../utils/prisma';
import crypto from 'crypto';

async function migrateAllTasks() {
  console.log('Starting task migration...');
  
  try {
    // Get all meetings with legacy tasks
    const meetings = await prisma.meeting.findMany({
      where: {
        tasks: {
          isEmpty: false
        }
      }
    });
    
    console.log(`Found ${meetings.length} meetings with legacy tasks to migrate`);
    
    let totalMigrated = 0;
    
    // Process each meeting
    for (const meeting of meetings) {
      console.log(`Processing meeting ${meeting.id}: "${meeting.title}"`);
      
      // Check if this meeting already has structured tasks
      const existingTasks = await prisma.$queryRaw`
        SELECT * FROM "Task" WHERE "meetingId" = ${meeting.id}
      ` as any[];
      
      if (existingTasks.length > 0) {
        console.log(`  Meeting already has ${existingTasks.length} structured tasks, skipping`);
        continue;
      }
      
      // Migrate each legacy task
      let migratedCount = 0;
      for (const text of meeting.tasks) {
        const now = new Date();
        const id = crypto.randomUUID();
        
        await prisma.$executeRaw`
          INSERT INTO "Task" (
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
            ${now}::timestamp
          )
        `;
        
        migratedCount++;
      }
      
      console.log(`  Migrated ${migratedCount} tasks for meeting ${meeting.id}`);
      totalMigrated += migratedCount;
    }
    
    console.log(`Migration complete. Total tasks migrated: ${totalMigrated}`);
  } catch (error) {
    console.error('Error during migration:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the migration
migrateAllTasks()
  .then(() => {
    console.log('Migration script completed successfully');
    process.exit(0);
  })
  .catch((error: any) => {
    console.error('Migration script failed:', error);
    process.exit(1);
  }); 