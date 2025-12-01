/**
 * ChatController V2 - Professional REST API
 * Handles all HTTP endpoints for chat system
 * Cross-platform: Web (Next.js) + Android
 */

import { Request, Response, NextFunction } from 'express'
import { ChatService } from '../services/ChatService'
import {
  createConversationSchema,
  getConversationsQuerySchema,
  conversationIdParamSchema,
  sendMessageSchema,
  getMessagesQuerySchema,
  messageIdParamSchema,
  editMessageSchema,
  updateReceiptSchema
} from '../validators/chatSchemas'
import { ZodError } from 'zod'

export class ChatController {
  private chatService: ChatService

  constructor(chatService: ChatService) {
    this.chatService = chatService
  }

  // ==================== CONVERSATIONS ====================

  /**
   * GET /api/v1/chat/conversations
   * List conversations for the authenticated user
   */
  getConversations = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = (req as any).user?.id
      const userRole = (req as any).user?.role // 'customer' or 'service_provider'/'tradesperson'

      if (!userId) {
        res.status(401).json({ success: false, error: 'Unauthorized' })
        return
      }

      // Map role
      const role = userRole === 'service_provider' || userRole === 'tradesperson' ? 'provider' : 'customer'

      // Validate query params
      const query = getConversationsQuerySchema.parse(req.query)

      const conversations = await this.chatService.getConversations(userId, role, query)

      res.json({
        success: true,
        data: { conversations }
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * POST /api/v1/chat/conversations
   * Create a new conversation
   */
  createConversation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = (req as any).user?.id

      // Validate request body
      const data = createConversationSchema.parse(req.body)

      const result = await this.chatService.createConversation(data, userId)

      res.status(201).json({
        success: true,
        data: result
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * GET /api/v1/chat/conversations/:id
   * Get a single conversation
   */
  getConversation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = (req as any).user?.id
      if (!userId) {
        res.status(401).json({ success: false, error: 'Unauthorized' })
        return
      }

      const { id } = conversationIdParamSchema.parse(req.params)

      const conversation = await this.chatService.getConversation(id, userId)

      res.json({
        success: true,
        data: { conversation }
      })
    } catch (error) {
      next(error)
    }
  }

  // ==================== MESSAGES ====================

  /**
   * GET /api/v1/chat/conversations/:id/messages
   * Get messages for a conversation (paginated, backward)
   */
  getMessages = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = (req as any).user?.id
      if (!userId) {
        res.status(401).json({ success: false, error: 'Unauthorized' })
        return
      }

      const { id: conversationId } = conversationIdParamSchema.parse(req.params)
      const query = getMessagesQuerySchema.parse(req.query)

      const messages = await this.chatService.getMessages(conversationId, userId, query)

      res.json({
        success: true,
        data: { messages }
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * POST /api/v1/chat/conversations/:id/messages
   * Send a message
   */
  sendMessage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = (req as any).user?.id
      const user = (req as any).user
      
      // Debug: Log what's in req.user
      console.log('🔍 req.user from auth middleware:', {
        id: user?.id,
        email: user?.email,
        firstName: user?.firstName,
        lastName: user?.lastName,
        first_name: user?.first_name,
        last_name: user?.last_name
      })
      
      // Build userName with fallback for undefined firstName/lastName
      const firstName = user?.firstName || user?.first_name || ''
      const lastName = user?.lastName || user?.last_name || ''
      const userName = (firstName + ' ' + lastName).trim() || user?.email || user?.phoneNumber || 'User'
      
      console.log('🔍 Built userName for message:', userName)
      
      const userRole = user?.role

      if (!userId) {
        res.status(401).json({ success: false, error: 'Unauthorized' })
        return
      }

      const { id: conversationId } = conversationIdParamSchema.parse(req.params)
      
      // Validate and merge conversationId
      const data = sendMessageSchema.parse({
        ...req.body,
        conversationId
      })

      // Map role
      const senderType = userRole === 'service_provider' || userRole === 'tradesperson' ? 'provider' : 'customer'

      const message = await this.chatService.sendMessage(data, userId, senderType, userName)

      // Emit socket event (will be handled by socket layer)
      const io = (req as any).io
      if (io) {
        io.to(`conversation:${conversationId}`).emit('message:new', {
          conversationId,
          message
        })
      }

      res.status(201).json({
        success: true,
        data: { message }
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * PATCH /api/v1/chat/messages/:id
   * Edit a message
   */
  editMessage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = (req as any).user?.id
      if (!userId) {
        res.status(401).json({ success: false, error: 'Unauthorized' })
        return
      }

      const { id: messageId } = messageIdParamSchema.parse(req.params)
      const { body } = editMessageSchema.parse(req.body)

      const message = await this.chatService.editMessage(messageId, body, userId)

      // Emit socket event
      const io = (req as any).io
      if (io) {
        io.to(`conversation:${message.conversationId}`).emit('message:updated', { message })
      }

      res.json({
        success: true,
        data: { message }
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * DELETE /api/v1/chat/messages/:id
   * Delete a message (soft delete)
   */
  deleteMessage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = (req as any).user?.id
      if (!userId) {
        res.status(401).json({ success: false, error: 'Unauthorized' })
        return
      }

      const { id: messageId } = messageIdParamSchema.parse(req.params)

      await this.chatService.deleteMessage(messageId, userId)

      // Emit socket event
      const io = (req as any).io
      if (io) {
        // Get message to find conversationId (before it's deleted)
        // For now, we'll just emit with messageId
        io.emit('message:deleted', { messageId })
      }

      res.json({
        success: true,
        data: { messageId }
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * POST /api/v1/chat/conversations/:id/read
   * Mark messages as read
   */
  markAsRead = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = (req as any).user?.id
      const userRole = (req as any).user?.role

      if (!userId) {
        res.status(401).json({ success: false, error: 'Unauthorized' })
        return
      }

      const { id: conversationId } = conversationIdParamSchema.parse(req.params)
      const role = userRole === 'service_provider' || userRole === 'tradesperson' ? 'provider' : 'customer'

      await this.chatService.markAsRead(conversationId, userId, role)

      // Emit socket event to update unread count for this user
      const io = (req as any).io
      if (io) {
        // Get unread count (should be 0 now since we just read all messages)
        const unreadCount = await this.chatService.getUnreadCount(conversationId, userId, role)
        
        // Emit to the user who marked as read
        io.to(`user-${userId}`).emit('conversation:updated', {
          conversationId,
          unreadCount
        })

        console.log(`📨 Emitted conversation:updated for markAsRead: user=${userId}, conv=${conversationId}, unread=${unreadCount}`)
      }

      res.json({
        success: true,
        data: { conversationId }
      })
    } catch (error) {
      next(error)
    }
  }

  // ==================== RECEIPTS ====================

  /**
   * POST /api/v1/chat/messages/:id/receipts
   * Update receipt status (delivered/read)
   */
  updateReceipt = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = (req as any).user?.id
      if (!userId) {
        res.status(401).json({ success: false, error: 'Unauthorized' })
        return
      }

      const { id: messageId } = messageIdParamSchema.parse(req.params)
      const { status } = updateReceiptSchema.parse(req.body)

      await this.chatService.updateReceipt(messageId, userId, status)

      // Emit socket event
      const io = (req as any).io
      if (io) {
        io.emit('receipt:updated', {
          messageId,
          recipientUserId: userId,
          status,
          at: new Date().toISOString()
        })
      }

      res.json({
        success: true,
        data: { messageId, status }
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * GET /api/v1/chat/messages/:id/receipts
   * Get receipts for a message
   */
  getReceipts = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = (req as any).user?.id
      if (!userId) {
        res.status(401).json({ success: false, error: 'Unauthorized' })
        return
      }

      const { id: messageId } = messageIdParamSchema.parse(req.params)

      const receipts = await this.chatService.getReceipts(messageId, userId)

      res.json({
        success: true,
        data: { receipts }
      })
    } catch (error) {
      next(error)
    }
  }
}

// Error handler middleware for Zod validation errors
export const chatErrorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof ZodError) {
    res.status(400).json({
      success: false,
      error: 'Validation error',
      details: err.issues
    })
    return
  }

  if (err.message?.includes('Unauthorized')) {
    res.status(403).json({
      success: false,
      error: err.message
    })
    return
  }

  if (err.message?.includes('not found')) {
    res.status(404).json({
      success: false,
      error: err.message
    })
    return
  }

  // Default error
  res.status(500).json({
    success: false,
    error: err.message || 'Internal server error'
  })
}
