export interface Conversation {
    id: string;
    providerId: string;
    customerId?: string | null;
    customerName: string;
    customerEmail: string;
    customerPhone?: string | null;
    status: 'active' | 'archived';
    lastMessageAt: string;
    createdAt: string;
    providerName?: string;
    providerBusinessName?: string | null;
    providerServiceCategory?: string;
    unreadCount?: number;
    lastMessage?: Message;
    participants?: Participant[];
}
export interface Message {
    id: string;
    conversationId: string;
    senderUserId?: string | null;
    senderType: 'customer' | 'provider';
    senderName: string;
    type: 'text' | 'image' | 'file' | 'system' | 'case_template' | 'service_request' | 'case_created' | 'case_filled' | 'survey';
    body: string;
    messageType?: string;
    sentAt: string;
    editedAt?: string | null;
    deletedAt?: string | null;
    isRead: boolean;
    attachments?: Attachment[];
    receipts?: Receipt[];
}
export interface Participant {
    conversationId: string;
    userId: string;
    role: 'customer' | 'provider' | 'admin';
    joinedAt: string;
    lastReadMessageId?: string | null;
    settings: Record<string, any>;
}
export interface Receipt {
    messageId: string;
    recipientUserId: string;
    status: 'delivered' | 'read';
    at: string;
}
export interface Attachment {
    id: string;
    messageId: string;
    url: string;
    mimeType: string;
    size: number;
    width?: number | null;
    height?: number | null;
    thumbUrl?: string | null;
    createdAt: string;
}
export interface ConversationRow {
    id: string;
    provider_id: string;
    customer_id?: string | null;
    customer_name: string;
    customer_email: string;
    customer_phone?: string | null;
    status: string;
    last_message_at: Date;
    created_at: Date;
    provider_first_name?: string | null;
    provider_last_name?: string | null;
    provider_business_name?: string | null;
    provider_service_category?: string | null;
}
export interface MessageRow {
    id: string;
    conversation_id: string;
    sender_user_id?: string | null;
    sender_type: string;
    sender_name: string;
    message: string;
    message_type: string;
    is_read: boolean;
    sent_at: Date;
    edited_at?: Date | null;
    deleted_at?: Date | null;
}
export interface ParticipantRow {
    conversation_id: string;
    user_id: string;
    role: string;
    joined_at: Date;
    last_read_message_id?: string | null;
    settings: any;
}
export interface ReceiptRow {
    message_id: string;
    recipient_user_id: string;
    status: string;
    at: Date;
}
export interface AttachmentRow {
    id: string;
    message_id: string;
    url: string;
    mime_type: string;
    size: number;
    width?: number | null;
    height?: number | null;
    thumb_url?: string | null;
    created_at: Date;
}
export interface CreateConversationRequest {
    providerId: string;
    customerName: string;
    customerEmail: string;
    customerPhone?: string;
    initialMessage?: string;
}
export interface SendMessageRequest {
    conversationId: string;
    type: Message['type'];
    body: string;
    attachments?: string[];
}
export interface UpdateReceiptRequest {
    messageId: string;
    status: 'delivered' | 'read';
}
export interface GetMessagesQuery {
    before?: string;
    limit?: number;
}
export interface GetConversationsQuery {
    cursor?: string;
    limit?: number;
    status?: 'active' | 'archived';
}
export interface SocketTypingEvent {
    conversationId: string;
    userId: string;
    isTyping: boolean;
}
export interface SocketMessageEvent {
    conversationId: string;
    message: Message;
}
export interface SocketReceiptEvent {
    messageId: string;
    recipientUserId: string;
    status: 'delivered' | 'read';
    at: string;
}
export interface SocketPresenceEvent {
    userId: string;
    status: 'online' | 'offline' | 'away';
}
//# sourceMappingURL=chat.types.d.ts.map