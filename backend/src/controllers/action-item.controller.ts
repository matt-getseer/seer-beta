import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { formatDbError } from '../utils/db-helpers';
import crypto from 'crypto';

export class ActionItemController {
  /**
   * Get all action items for a meeting
   */
  static async getActionItems(req: Request, res: Response) {
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
      
      // Get action items for this meeting using raw SQL
      const actionItems = await prisma.$queryRaw`
        SELECT * FROM "ActionItem" WHERE "meetingId" = ${meetingId}
        ORDER BY "createdAt" ASC
      ` as any[];
      
      return res.status(200).json(actionItems);
    } catch (error) {
      console.error('Error getting action items:', error);
      return res.status(500).json({ 
        error: 'Failed to get action items',
        details: formatDbError(error)
      });
    }
  }
  
  /**
   * Create a new action item
   */
  static async createActionItem(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      const userRole = req.user?.role;
      const meetingId = req.params.id;
      const { text, assignedTo } = req.body;
      
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }
      
      if (!text) {
        return res.status(400).json({ error: 'Action item text is required' });
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
        return res.status(403).json({ error: 'Only meeting creators or admins can add action items' });
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
      
      // Create action item using raw SQL
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      
      await prisma.$executeRaw`
        INSERT INTO "ActionItem" ("id", "text", "assignedTo", "meetingId", "status", "createdAt")
        VALUES (${id}, ${text}, ${assignedTo || null}, ${meetingId}, 'incomplete', ${now})
      `;
      
      // Retrieve the created item
      const actionItems = await prisma.$queryRaw`
        SELECT * FROM "ActionItem" WHERE "id" = ${id}
      ` as any[];
      
      return res.status(201).json(actionItems[0]);
    } catch (error) {
      console.error('Error creating action item:', error);
      return res.status(500).json({ 
        error: 'Failed to create action item',
        details: formatDbError(error)
      });
    }
  }
  
  /**
   * Update an action item
   */
  static async updateActionItem(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      const userRole = req.user?.role;
      const meetingId = req.params.id;
      const actionItemId = req.params.actionItemId;
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
        return res.status(403).json({ error: 'You do not have permission to update this action item' });
      }
      
      // Get the action item
      const actionItems = await prisma.$queryRaw`
        SELECT * FROM "ActionItem" WHERE "id" = ${actionItemId}
      ` as any[];
      
      if (!actionItems.length) {
        return res.status(404).json({ error: 'Action item not found' });
      }
      
      const actionItem = actionItems[0];
      
      if (actionItem.meetingId !== meetingId) {
        return res.status(400).json({ error: 'Action item does not belong to this meeting' });
      }
      
      // Build update fields
      let updateFields = [];
      
      // Only admin or creator can update text or assignee
      if (canEdit) {
        if (text !== undefined) {
          updateFields.push(`"text" = '${text}'`);
        }
        
        if (assignedTo !== undefined) {
          // If assignedTo is provided and not null, verify that user exists
          if (assignedTo) {
            const assignedUser = await prisma.user.findUnique({
              where: {
                id: assignedTo
              }
            });
            
            if (!assignedUser) {
              return res.status(400).json({ error: 'Assigned user not found' });
            }
            updateFields.push(`"assignedTo" = '${assignedTo}'`);
          } else {
            updateFields.push(`"assignedTo" = NULL`);
          }
        }
      }
      
      // Anyone with access to the meeting can toggle status
      if (status !== undefined) {
        if (status !== 'complete' && status !== 'incomplete') {
          return res.status(400).json({ error: 'Status must be either "complete" or "incomplete"' });
        }
        
        updateFields.push(`"status" = '${status}'`);
        
        // If marking as complete, set completedAt if not provided
        if (status === 'complete') {
          const completionDate = completedAt ? new Date(completedAt) : new Date();
          updateFields.push(`"completedAt" = '${completionDate.toISOString()}'`);
        } else {
          // If marking as incomplete, clear completedAt
          updateFields.push(`"completedAt" = NULL`);
        }
      } else if (completedAt !== undefined) {
        updateFields.push(`"completedAt" = '${new Date(completedAt).toISOString()}'`);
      }
      
      if (updateFields.length === 0) {
        return res.status(400).json({ error: 'No fields provided to update' });
      }
      
      // Perform the update using raw SQL
      const updateSQL = `
        UPDATE "ActionItem" 
        SET ${updateFields.join(', ')}
        WHERE "id" = '${actionItemId}'
        RETURNING *
      `;
      
      const updatedItems = await prisma.$queryRawUnsafe(updateSQL) as any[];
      
      return res.status(200).json(updatedItems[0]);
    } catch (error) {
      console.error('Error updating action item:', error);
      return res.status(500).json({ 
        error: 'Failed to update action item',
        details: formatDbError(error)
      });
    }
  }
  
  /**
   * Delete an action item
   */
  static async deleteActionItem(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      const userRole = req.user?.role;
      const meetingId = req.params.id;
      const actionItemId = req.params.actionItemId;
      
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
        return res.status(403).json({ error: 'Only meeting creators or admins can delete action items' });
      }
      
      // Get the action item
      const actionItems = await prisma.$queryRaw`
        SELECT * FROM "ActionItem" WHERE "id" = ${actionItemId}
      ` as any[];
      
      if (!actionItems.length) {
        return res.status(404).json({ error: 'Action item not found' });
      }
      
      const actionItem = actionItems[0];
      
      if (actionItem.meetingId !== meetingId) {
        return res.status(400).json({ error: 'Action item does not belong to this meeting' });
      }
      
      // Delete action item
      await prisma.$executeRaw`
        DELETE FROM "ActionItem" WHERE "id" = ${actionItemId}
      `;
      
      return res.status(200).json({ message: 'Action item deleted successfully' });
    } catch (error) {
      console.error('Error deleting action item:', error);
      return res.status(500).json({ 
        error: 'Failed to delete action item',
        details: formatDbError(error)
      });
    }
  }
} 