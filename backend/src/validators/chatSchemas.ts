/**
 * Chat Request Validation Schemas (Zod)
 * Validates all incoming requests for chat endpoints
 */

import { z } from 'zod'

// ==================== CONVERSATIONS ====================

export const createConversationSchema = z.object({
  providerId: z.string().min(1, 'Provider ID is required'),
  customerName: z.string().min(1, 'Customer name is required').max(255),
  customerEmail: z.string().email('Invalid email address'),
  customerPhone: z.string().optional(),
  initialMessage: z.string().max(10000, 'Message too long').optional(),
  chatSource: z.string().optional() // 'smschat', 'searchchat', 'direct', etc.
})

export const getConversationsQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['active', 'archived']).optional()
})

export const conversationIdParamSchema = z.object({
  id: z.string().min(1, 'Conversation ID is required')
})

// ==================== MESSAGES ====================

export const sendMessageSchema = z.object({
  conversationId: z.string().min(1, 'Conversation ID is required'),
  type: z.enum(['text', 'image', 'file', 'system', 'case_template', 'service_request', 'case_created', 'case_filled', 'survey']),
  body: z.string().min(1, 'Message body is required').max(10000, 'Message too long'),
  attachments: z.array(z.string().url()).max(10, 'Too many attachments').optional()
})

export const getMessagesQuerySchema = z.object({
  before: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50)
})

export const messageIdParamSchema = z.object({
  id: z.string().min(1, 'Message ID is required')
})

export const editMessageSchema = z.object({
  body: z.string().min(1, 'Message body is required').max(10000, 'Message too long')
})

// ==================== RECEIPTS ====================

export const updateReceiptSchema = z.object({
  status: z.enum(['delivered', 'read'])
})

// ==================== TYPING ====================

export const typingEventSchema = z.object({
  conversationId: z.string().min(1),
  isTyping: z.boolean()
})

// ==================== PRESENCE ====================

export const presenceEventSchema = z.object({
  status: z.enum(['online', 'offline', 'away'])
})

// ==================== UPLOADS ====================

export const uploadFileSchema = z.object({
  filename: z.string().min(1, 'Filename is required'),
  mimeType: z.string().min(1, 'MIME type is required'),
  size: z.number().int().min(1).max(10 * 1024 * 1024, 'File too large (max 10MB)')
})

// Type exports for TypeScript
export type CreateConversationInput = z.infer<typeof createConversationSchema>
export type GetConversationsQuery = z.infer<typeof getConversationsQuerySchema>
export type SendMessageInput = z.infer<typeof sendMessageSchema>
export type GetMessagesQuery = z.infer<typeof getMessagesQuerySchema>
export type EditMessageInput = z.infer<typeof editMessageSchema>
export type UpdateReceiptInput = z.infer<typeof updateReceiptSchema>
export type TypingEventInput = z.infer<typeof typingEventSchema>
export type PresenceEventInput = z.infer<typeof presenceEventSchema>
export type UploadFileInput = z.infer<typeof uploadFileSchema>
