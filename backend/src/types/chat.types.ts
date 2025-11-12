/**
 * Professional Chat System - Type Definitions
 * Cross-platform support: Web (Next.js) + Android
 * All fields in camelCase for consistency
 */

export interface Conversation {
  id: string
  providerId: string
  customerId?: string | null
  customerName: string
  customerEmail: string
  customerPhone?: string | null
  status: 'active' | 'archived'
  lastMessageAt: string  // ISO timestamp
  createdAt: string
  // Provider information
  providerName?: string
  providerBusinessName?: string | null
  providerServiceCategory?: string
  // Computed fields (not in DB)
  unreadCount?: number
  lastMessage?: Message
  participants?: Participant[]
}

export interface Message {
  id: string
  conversationId: string
  senderUserId?: string | null  // New field (will be populated)
  senderType: 'customer' | 'provider'  // Legacy field (keep for compatibility)
  senderName: string
  type: 'text' | 'image' | 'file' | 'system' | 'case_template' | 'service_request' | 'case_created' | 'case_filled' | 'survey'
  body: string  // Maps to 'message' column
  messageType?: string  // Legacy field
  sentAt: string
  editedAt?: string | null
  deletedAt?: string | null
  isRead: boolean
  // Relations
  attachments?: Attachment[]
  receipts?: Receipt[]
}

export interface Participant {
  conversationId: string
  userId: string
  role: 'customer' | 'provider' | 'admin'
  joinedAt: string
  lastReadMessageId?: string | null
  settings: Record<string, any>
}

export interface Receipt {
  messageId: string
  recipientUserId: string
  status: 'delivered' | 'read'
  at: string
}

export interface Attachment {
  id: string
  messageId: string
  url: string
  mimeType: string
  size: number
  width?: number | null
  height?: number | null
  thumbUrl?: string | null
  createdAt: string
}

// Database row types (snake_case from PostgreSQL)
export interface ConversationRow {
  id: string
  provider_id: string
  customer_id?: string | null
  customer_name: string
  customer_email: string
  customer_phone?: string | null
  status: string
  last_message_at: Date
  created_at: Date
  // Joined fields from service_provider_profiles and users
  provider_first_name?: string | null
  provider_last_name?: string | null
  provider_business_name?: string | null
  provider_service_category?: string | null
}

export interface MessageRow {
  id: string
  conversation_id: string
  sender_user_id?: string | null
  sender_type: string
  sender_name: string
  message: string
  message_type: string
  is_read: boolean
  sent_at: Date
  edited_at?: Date | null
  deleted_at?: Date | null
}

export interface ParticipantRow {
  conversation_id: string
  user_id: string
  role: string
  joined_at: Date
  last_read_message_id?: string | null
  settings: any
}

export interface ReceiptRow {
  message_id: string
  recipient_user_id: string
  status: string
  at: Date
}

export interface AttachmentRow {
  id: string
  message_id: string
  url: string
  mime_type: string
  size: number
  width?: number | null
  height?: number | null
  thumb_url?: string | null
  created_at: Date
}

// API Request/Response types
export interface CreateConversationRequest {
  providerId: string
  customerName: string
  customerEmail: string
  customerPhone?: string
  initialMessage?: string
  chatSource?: string  // Source of chat: 'smschat', 'searchchat', 'direct', etc.
}

export interface SendMessageRequest {
  conversationId: string
  type: Message['type']
  body: string
  attachments?: string[]  // Array of attachment URLs
}

export interface UpdateReceiptRequest {
  messageId: string
  status: 'delivered' | 'read'
}

export interface GetMessagesQuery {
  before?: string  // Message ID for pagination
  limit?: number
}

export interface GetConversationsQuery {
  cursor?: string  // Conversation ID for pagination
  limit?: number
  status?: 'active' | 'archived'
}

// Socket.IO event payloads
export interface SocketTypingEvent {
  conversationId: string
  userId: string
  isTyping: boolean
}

export interface SocketMessageEvent {
  conversationId: string
  message: Message
}

export interface SocketReceiptEvent {
  messageId: string
  recipientUserId: string
  status: 'delivered' | 'read'
  at: string
}

export interface SocketPresenceEvent {
  userId: string
  status: 'online' | 'offline' | 'away'
}
