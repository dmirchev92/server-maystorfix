/**
 * Chat API Client
 * Centralized API calls for chat system
 * All responses in camelCase
 */

import { apiClient } from './api'

export interface Conversation {
  id: string
  providerId: string
  customerId?: string
  customerName: string
  customerEmail: string
  customerPhone?: string
  status: 'active' | 'archived'
  lastMessageAt: string
  createdAt: string
  // Provider information
  providerName?: string
  providerBusinessName?: string
  providerServiceCategory?: string
  unreadCount?: number
  lastMessage?: Message
}

export interface Message {
  id: string
  conversationId: string
  senderUserId?: string
  senderType: 'customer' | 'provider'
  senderName: string
  type: 'text' | 'image' | 'file' | 'system' | 'case_template'
  body: string
  sentAt: string
  editedAt?: string
  deletedAt?: string
  isRead: boolean
  attachments?: Attachment[]
}

export interface Attachment {
  id: string
  messageId: string
  url: string
  mimeType: string
  size: number
  width?: number
  height?: number
  thumbUrl?: string
}

export interface Receipt {
  messageId: string
  recipientUserId: string
  status: 'delivered' | 'read'
  at: string
}

export class ChatApi {
  // ==================== CONVERSATIONS ====================

  /**
   * Get list of conversations
   */
  static async getConversations(params?: {
    cursor?: string
    limit?: number
    status?: 'active' | 'archived'
  }): Promise<{ conversations: Conversation[] }> {
    const response = await apiClient['client'].get('/chat/conversations', { params })
    return response.data.data
  }

  /**
   * Create a new conversation
   */
  static async createConversation(data: {
    providerId: string
    customerName: string
    customerEmail: string
    customerPhone?: string
    initialMessage?: string
  }): Promise<{ conversation: Conversation; initialMessage?: Message }> {
    const response = await apiClient['client'].post('/chat/conversations', data)
    return response.data.data
  }

  /**
   * Get a single conversation
   */
  static async getConversation(conversationId: string): Promise<{ conversation: Conversation }> {
    const response = await apiClient['client'].get(`/chat/conversations/${conversationId}`)
    return response.data.data
  }

  // ==================== MESSAGES ====================

  /**
   * Get messages for a conversation (paginated, backward)
   */
  static async getMessages(
    conversationId: string,
    params?: {
      before?: string
      limit?: number
    }
  ): Promise<{ messages: Message[] }> {
    const response = await apiClient['client'].get(`/chat/conversations/${conversationId}/messages`, { params })
    return response.data.data
  }

  /**
   * Send a message
   */
  static async sendMessage(
    conversationId: string,
    data: {
      type: Message['type']
      body: string
      attachments?: string[]
    }
  ): Promise<{ message: Message }> {
    const response = await apiClient['client'].post(`/chat/conversations/${conversationId}/messages`, data)
    return response.data.data
  }

  /**
   * Edit a message
   */
  static async editMessage(messageId: string, body: string): Promise<{ message: Message }> {
    const response = await apiClient['client'].patch(`/chat/messages/${messageId}`, { body })
    return response.data.data
  }

  /**
   * Delete a message
   */
  static async deleteMessage(messageId: string): Promise<void> {
    await apiClient['client'].delete(`/chat/messages/${messageId}`)
  }

  /**
   * Mark messages as read
   */
  static async markAsRead(conversationId: string): Promise<void> {
    await apiClient['client'].post(`/chat/conversations/${conversationId}/read`)
  }

  // ==================== RECEIPTS ====================

  /**
   * Update receipt status
   */
  static async updateReceipt(
    messageId: string,
    status: 'delivered' | 'read'
  ): Promise<void> {
    await apiClient['client'].post(`/chat/messages/${messageId}/receipts`, { status })
  }

  /**
   * Get receipts for a message
   */
  static async getReceipts(messageId: string): Promise<{ receipts: Receipt[] }> {
    const response = await apiClient['client'].get(`/chat/messages/${messageId}/receipts`)
    return response.data.data
  }
}
