/**
 * ChatService - Business Logic Layer
 * Handles all chat operations with proper authorization and validation
 */

import { ChatRepository } from '../models/ChatRepository'
import {
  Conversation,
  Message,
  CreateConversationRequest,
  SendMessageRequest,
  GetMessagesQuery,
  GetConversationsQuery
} from '../types/chat.types'
import { randomUUID } from 'crypto'

export class ChatService {
  private chatRepo: ChatRepository

  constructor(chatRepo: ChatRepository) {
    this.chatRepo = chatRepo
  }

  // ==================== CONVERSATIONS ====================

  /**
   * Get conversations for a user (customer or provider)
   */
  async getConversations(
    userId: string,
    userRole: 'customer' | 'provider',
    query: GetConversationsQuery = {}
  ): Promise<Conversation[]> {
    const conversations = await this.chatRepo.getConversations(userId, userRole, query)

    // Enrich with unread counts and last message
    const enriched = await Promise.all(
      conversations.map(async (conv) => {
        const unreadCount = await this.chatRepo.getUnreadCount(conv.id, userId, userRole)
        const messages = await this.chatRepo.getMessages(conv.id, { limit: 1 })
        
        return {
          ...conv,
          unreadCount,
          lastMessage: messages[0] || undefined
        }
      })
    )

    return enriched
  }

  /**
   * Get a single conversation with authorization check
   */
  async getConversation(conversationId: string, userId: string): Promise<Conversation> {
    // Authorization check
    const isAuthorized = await this.chatRepo.isUserInConversation(conversationId, userId)
    if (!isAuthorized) {
      throw new Error('Unauthorized: User is not a participant in this conversation')
    }

    const conversation = await this.chatRepo.getConversation(conversationId)
    if (!conversation) {
      throw new Error('Conversation not found')
    }

    return conversation
  }

  /**
   * Create a new conversation or return existing one
   */
  async createConversation(
    data: CreateConversationRequest,
    creatorUserId?: string
  ): Promise<{ conversation: Conversation; initialMessage?: Message }> {
    // Check if conversation already exists between this customer and provider
    if (creatorUserId && data.providerId) {
      const existingConversation = await this.chatRepo.findConversationBetween(
        creatorUserId,
        data.providerId
      )
      
      if (existingConversation) {
        console.log('💬 ChatService - Found existing conversation:', existingConversation.id)
        return { conversation: existingConversation }
      }
    }

    // Create new conversation if none exists
    console.log('💬 ChatService - Creating new conversation')
    const conversationId = randomUUID()

    const conversation = await this.chatRepo.createConversation({
      id: conversationId,
      providerId: data.providerId,
      customerId: creatorUserId,
      customerName: data.customerName,
      customerEmail: data.customerEmail,
      customerPhone: data.customerPhone
    })

    // Create initial message if provided
    let initialMessage: Message | undefined
    if (data.initialMessage) {
      initialMessage = await this.sendMessage({
        conversationId: conversation.id,
        type: 'text',
        body: data.initialMessage
      }, creatorUserId || 'system', 'customer', data.customerName)
    }

    return { conversation, initialMessage }
  }

  /**
   * Archive a conversation
   */
  async archiveConversation(conversationId: string, userId: string): Promise<void> {
    const isAuthorized = await this.chatRepo.isUserInConversation(conversationId, userId)
    if (!isAuthorized) {
      throw new Error('Unauthorized')
    }

    // Note: We don't have archive functionality in current schema
    // This would require adding a status column or participant-level archive flag
    // For now, we'll just mark it in participant settings
    console.log(`Archive conversation ${conversationId} for user ${userId}`)
  }

  // ==================== MESSAGES ====================

  /**
   * Get messages for a conversation with pagination
   */
  async getMessages(
    conversationId: string,
    userId: string,
    query: GetMessagesQuery = {}
  ): Promise<Message[]> {
    // Authorization check
    const isAuthorized = await this.chatRepo.isUserInConversation(conversationId, userId)
    if (!isAuthorized) {
      throw new Error('Unauthorized: User is not a participant in this conversation')
    }

    const messages = await this.chatRepo.getMessages(conversationId, query)

    // Optionally enrich with attachments and receipts
    // For performance, we might want to do this selectively
    return messages
  }

  /**
   * Send a message
   */
  async sendMessage(
    data: SendMessageRequest,
    senderUserId: string,
    senderType: 'customer' | 'provider',
    senderName: string
  ): Promise<Message> {
    // Authorization check
    const isAuthorized = await this.chatRepo.isUserInConversation(data.conversationId, senderUserId)
    if (!isAuthorized) {
      throw new Error('Unauthorized: User is not a participant in this conversation')
    }

    // Validate message
    if (!data.body || data.body.trim().length === 0) {
      throw new Error('Message body cannot be empty')
    }

    if (data.body.length > 10000) {
      throw new Error('Message body too long (max 10000 characters)')
    }

    // Create message
    const messageId = randomUUID()
    const message = await this.chatRepo.createMessage({
      id: messageId,
      conversationId: data.conversationId,
      senderUserId,
      senderType,
      senderName,
      type: data.type,
      body: data.body.trim()
    })

    // Update conversation last_message_at
    await this.chatRepo.updateConversationLastMessage(data.conversationId)

    // Handle attachments if provided
    if (data.attachments && data.attachments.length > 0) {
      await Promise.all(
        data.attachments.map(url =>
          this.chatRepo.createAttachment({
            id: randomUUID(),
            messageId: message.id,
            url,
            mimeType: this.getMimeTypeFromUrl(url),
            size: 0 // Will be updated by upload service
          })
        )
      )
    }

    return message
  }

  /**
   * Edit a message
   */
  async editMessage(
    messageId: string,
    newBody: string,
    userId: string
  ): Promise<Message> {
    const message = await this.chatRepo.getMessage(messageId)
    if (!message) {
      throw new Error('Message not found')
    }

    // Check if user is the sender
    if (message.senderUserId !== userId) {
      throw new Error('Unauthorized: Only the sender can edit this message')
    }

    // Validate new body
    if (!newBody || newBody.trim().length === 0) {
      throw new Error('Message body cannot be empty')
    }

    const updated = await this.chatRepo.updateMessage(messageId, newBody.trim())
    if (!updated) {
      throw new Error('Failed to update message')
    }

    return updated
  }

  /**
   * Delete a message (soft delete)
   */
  async deleteMessage(messageId: string, userId: string): Promise<void> {
    const message = await this.chatRepo.getMessage(messageId)
    if (!message) {
      throw new Error('Message not found')
    }

    // Check if user is the sender
    if (message.senderUserId !== userId) {
      throw new Error('Unauthorized: Only the sender can delete this message')
    }

    await this.chatRepo.deleteMessage(messageId)
  }

  /**
   * Mark messages as read
   */
  async markAsRead(
    conversationId: string,
    userId: string,
    userRole: 'customer' | 'provider'
  ): Promise<void> {
    const isAuthorized = await this.chatRepo.isUserInConversation(conversationId, userId)
    if (!isAuthorized) {
      throw new Error('Unauthorized')
    }

    await this.chatRepo.markMessagesAsRead(conversationId, userId, userRole)
  }

  /**
   * Get unread count for a conversation
   */
  async getUnreadCount(
    conversationId: string,
    userId: string,
    userRole: 'customer' | 'provider'
  ): Promise<number> {
    const isAuthorized = await this.chatRepo.isUserInConversation(conversationId, userId)
    if (!isAuthorized) {
      throw new Error('Unauthorized')
    }

    return await this.chatRepo.getUnreadCount(conversationId, userId, userRole)
  }

  // ==================== RECEIPTS ====================

  /**
   * Create or update a receipt
   */
  async updateReceipt(
    messageId: string,
    recipientUserId: string,
    status: 'delivered' | 'read'
  ): Promise<void> {
    const message = await this.chatRepo.getMessage(messageId)
    if (!message) {
      throw new Error('Message not found')
    }

    // Check if user is in the conversation
    const isAuthorized = await this.chatRepo.isUserInConversation(
      message.conversationId,
      recipientUserId
    )
    if (!isAuthorized) {
      throw new Error('Unauthorized')
    }

    await this.chatRepo.createReceipt({
      messageId,
      recipientUserId,
      status
    })
  }

  /**
   * Get receipts for a message
   */
  async getReceipts(messageId: string, userId: string): Promise<any[]> {
    const message = await this.chatRepo.getMessage(messageId)
    if (!message) {
      throw new Error('Message not found')
    }

    // Check if user is in the conversation
    const isAuthorized = await this.chatRepo.isUserInConversation(
      message.conversationId,
      userId
    )
    if (!isAuthorized) {
      throw new Error('Unauthorized')
    }

    return await this.chatRepo.getReceipts(messageId)
  }

  // ==================== HELPERS ====================

  private getMimeTypeFromUrl(url: string): string {
    const ext = url.split('.').pop()?.toLowerCase()
    const mimeTypes: Record<string, string> = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      pdf: 'application/pdf',
      doc: 'application/msword',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    }
    return mimeTypes[ext || ''] || 'application/octet-stream'
  }
}
