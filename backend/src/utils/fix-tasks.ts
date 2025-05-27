import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

async function migrateTasks() {
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
      const existingTasks = await prisma.task.findMany({
        where: {
          meetingId: meeting.id
        }
      });
      
      if (existingTasks.length > 0) {
        console.log(`  Meeting already has ${existingTasks.length} structured tasks, skipping`);
        continue;
      }
      
      // Use TaskAssignmentService to intelligently assign tasks
      const { TaskAssignmentService } = await import('../services/task-assignment.service');
      const assignedTasks = await TaskAssignmentService.assignTasks(
        meeting.tasks,
        meeting.createdBy, // Manager ID
        meeting.teamMemberId || meeting.createdBy, // Use creator as fallback team member
        null, // No custom API key for migration script
        null  // No custom AI provider for migration script
      );

      // Migrate each legacy task with intelligent assignment
      let migratedCount = 0;
      
      for (const taskData of assignedTasks) {
        // Create new structured task
        await prisma.task.create({
          data: {
            id: crypto.randomUUID(),
            text: taskData.text,
            status: 'incomplete',
            assignedTo: taskData.assignedTo,
            meetingId: meeting.id,
            createdAt: new Date()
          }
        });
        
        console.log(`  Migrated task "${taskData.text}" assigned to ${taskData.assignedTo} (${taskData.assignmentReason})`);
        migratedCount++;
      }
      
      console.log(`  Migrated ${migratedCount} tasks for meeting ${meeting.id}`);
      totalMigrated += migratedCount;
    }
    
    console.log(`Migration complete. Total tasks migrated: ${totalMigrated}`);
  } catch (error) {
    console.error('Error during migration:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the migration
migrateTasks()
  .then(() => {
    console.log('Migration script completed successfully');
    process.exit(0);
  })
  .catch((error: any) => {
    console.error('Migration script failed:', error);
    process.exit(1);
  }); 