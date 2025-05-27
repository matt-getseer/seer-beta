import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { formatDbError } from '../utils/db-helpers';
import crypto from 'crypto';

export class TaskController {
  /**
   * Get all tasks across all meetings (admin only)
   */
  static async getAllTasks(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      const userRole = req.user?.role;
      
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }
      
      if (userRole !== 'admin') {
        return res.status(403).json({ error: 'Only admins can access all tasks' });
      }
      
      // Get all tasks with meeting information
      const tasks = await prisma.$queryRaw`
        SELECT 
          t.*,
          m.title as "meetingTitle",
          m.date as "meetingDate",
          u.name as "assigneeName",
          u.email as "assigneeEmail"
        FROM "Task" t
        LEFT JOIN "Meeting" m ON t."meetingId" = m.id
        LEFT JOIN "User" u ON t."assignedTo" = u.id
        ORDER BY t."createdAt" DESC
      ` as any[];
      
      return res.status(200).json(tasks);
    } catch (error) {
      console.error('Error getting all tasks:', error);
      return res.status(500).json({ 
        error: 'Failed to get all tasks',
        details: formatDbError(error)
      });
    }
  }

  /**
   * Get all tasks for a meeting
   */
  static async getTasks(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      const userRole = req.user?.role;
      const meetingId = req.params.id;
      
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }
      
      // First, check if user has access to this meeting
      const meeting = await prisma.meeting.findUnique({
        where: {
          id: meetingId
        }
      });
      
      if (!meeting) {
        return res.status(404).json({ error: 'Meeting not found' });
      }
      
      // Check if user has access to this meeting
      if (userRole !== 'admin' && meeting.createdBy !== userId && meeting.teamMemberId !== userId) {
        return res.status(403).json({ error: 'You do not have access to this meeting' });
      }
      
      // Get tasks for this meeting using raw SQL
      const tasks = await prisma.$queryRaw`
        SELECT * FROM "Task" WHERE "meetingId" = ${meetingId}
        ORDER BY "createdAt" ASC
      ` as any[];
      
      return res.status(200).json(tasks);
    } catch (error) {
      console.error('Error getting tasks:', error);
      return res.status(500).json({ 
        error: 'Failed to get tasks',
        details: formatDbError(error)
      });
    }
  }
  
  /**
   * Create a new task
   */
  static async createTask(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      const userRole = req.user?.role;
      const meetingId = req.params.id;
      const { text, assignedTo } = req.body;
      
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }
      
      if (!text) {
        return res.status(400).json({ error: 'Task text is required' });
      }
      
      // First, check if user has access to this meeting
      const meeting = await prisma.meeting.findUnique({
        where: {
          id: meetingId
        }
      });
      
      if (!meeting) {
        return res.status(404).json({ error: 'Meeting not found' });
      }
      
      // Check if user has access to this meeting
      if (userRole !== 'admin' && meeting.createdBy !== userId) {
        return res.status(403).json({ error: 'Only meeting creators or admins can add tasks' });
      }
      
      // If assignedTo is provided, verify that user exists
      if (assignedTo) {
        const assignedUser = await prisma.user.findUnique({
          where: {
            id: assignedTo
          }
        });
        
        if (!assignedUser) {
          return res.status(400).json({ error: 'Assigned user not found' });
        }
      }
      
      // Create task using raw SQL
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      
      await prisma.$executeRaw`
        INSERT INTO "Task" ("id", "text", "assignedTo", "meetingId", "status", "createdAt")
        VALUES (${id}, ${text}, ${assignedTo || null}, ${meetingId}, 'incomplete', ${now})
      `;
      
      // Retrieve the created item
      const tasks = await prisma.$queryRaw`
        SELECT * FROM "Task" WHERE "id" = ${id}
      ` as any[];
      
      return res.status(201).json(tasks[0]);
    } catch (error) {
      console.error('Error creating task:', error);
      return res.status(500).json({ 
        error: 'Failed to create task',
        details: formatDbError(error)
      });
    }
  }
  
  /**
   * Update a task
   */
  static async updateTask(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      const userRole = req.user?.role;
      const meetingId = req.params.id;
      const taskId = req.params.taskId;
      const { text, status, assignedTo, completedAt } = req.body;
      
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }
      
      // First, check if user has access to this meeting
      const meeting = await prisma.meeting.findUnique({
        where: {
          id: meetingId
        }
      });
      
      if (!meeting) {
        return res.status(404).json({ error: 'Meeting not found' });
      }
      
      // Check if user has access to this meeting
      const canEdit = userRole === 'admin' || meeting.createdBy === userId;
      const canToggleStatus = canEdit || meeting.teamMemberId === userId;
      
      if (!canToggleStatus) {
        return res.status(403).json({ error: 'You do not have permission to update this task' });
      }
      
      // Get the task
      const tasks = await prisma.$queryRaw`
        SELECT * FROM "Task" WHERE "id" = ${taskId}
      ` as any[];
      
      if (!tasks.length) {
        return res.status(404).json({ error: 'Task not found' });
      }
      
      const task = tasks[0];
      
      if (task.meetingId !== meetingId) {
        return res.status(400).json({ error: 'Task does not belong to this meeting' });
      }
      
      // Build update fields
      let updateFields = [];
      let updateValues = [];
      
      if (text !== undefined) {
        if (!canEdit) {
          return res.status(403).json({ error: 'You do not have permission to edit task text' });
        }
        updateFields.push('"text" = $' + (updateValues.length + 1));
        updateValues.push(text);
      }
      
      if (status !== undefined) {
        updateFields.push('"status" = $' + (updateValues.length + 1));
        updateValues.push(status);
        
        // If marking as complete, set completedAt
        if (status === 'complete' && !task.completedAt) {
          updateFields.push('"completedAt" = $' + (updateValues.length + 1) + '::timestamp');
          updateValues.push(new Date().toISOString());
        }
        // If marking as incomplete, clear completedAt
        else if (status === 'incomplete' && task.completedAt) {
          updateFields.push('"completedAt" = NULL');
        }
      }
      
      if (assignedTo !== undefined) {
        if (!canEdit) {
          return res.status(403).json({ error: 'You do not have permission to change task assignment' });
        }
        
        // If assignedTo is provided, verify that user exists
        if (assignedTo) {
          const assignedUser = await prisma.user.findUnique({
            where: {
              id: assignedTo
            }
          });
          
          if (!assignedUser) {
            return res.status(400).json({ error: 'Assigned user not found' });
          }
        }
        
        updateFields.push('"assignedTo" = $' + (updateValues.length + 1));
        updateValues.push(assignedTo || null);
      }
      
      if (completedAt !== undefined && canEdit) {
        updateFields.push('"completedAt" = $' + (updateValues.length + 1) + '::timestamp');
        updateValues.push(completedAt);
      }
      
      if (updateFields.length === 0) {
        return res.status(400).json({ error: 'No valid fields to update' });
      }
      
      // Update the task
      updateValues.push(taskId);
      const updateQuery = `
        UPDATE "Task" 
        SET ${updateFields.join(', ')} 
        WHERE "id" = $${updateValues.length}
      `;
      
      await prisma.$executeRawUnsafe(updateQuery, ...updateValues);
      
      // Retrieve the updated task
      const updatedTasks = await prisma.$queryRaw`
        SELECT * FROM "Task" WHERE "id" = ${taskId}
      ` as any[];
      
      return res.status(200).json(updatedTasks[0]);
    } catch (error) {
      console.error('Error updating task:', error);
      return res.status(500).json({ 
        error: 'Failed to update task',
        details: formatDbError(error)
      });
    }
  }
  
  /**
   * Delete a task
   */
  static async deleteTask(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      const userRole = req.user?.role;
      const meetingId = req.params.id;
      const taskId = req.params.taskId;
      
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }
      
      // First, check if user has access to this meeting
      const meeting = await prisma.meeting.findUnique({
        where: {
          id: meetingId
        }
      });
      
      if (!meeting) {
        return res.status(404).json({ error: 'Meeting not found' });
      }
      
      // Check if user has permission (only admin or meeting creator)
      if (userRole !== 'admin' && meeting.createdBy !== userId) {
        return res.status(403).json({ error: 'Only meeting creators or admins can delete tasks' });
      }
      
      // Get the task
      const tasks = await prisma.$queryRaw`
        SELECT * FROM "Task" WHERE "id" = ${taskId}
      ` as any[];
      
      if (!tasks.length) {
        return res.status(404).json({ error: 'Task not found' });
      }
      
      const task = tasks[0];
      
      if (task.meetingId !== meetingId) {
        return res.status(400).json({ error: 'Task does not belong to this meeting' });
      }
      
      // Delete task
      await prisma.$executeRaw`
        DELETE FROM "Task" WHERE "id" = ${taskId}
      `;
      
      return res.status(200).json({ message: 'Task deleted successfully' });
    } catch (error) {
      console.error('Error deleting task:', error);
      return res.status(500).json({ 
        error: 'Failed to delete task',
        details: formatDbError(error)
      });
    }
  }
} 