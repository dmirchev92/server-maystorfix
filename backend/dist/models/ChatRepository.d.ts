import { Pool } from 'pg';
import { Conversation, Message, Participant, Receipt, Attachment, GetMessagesQuery, GetConversationsQuery } from '../types/chat.types';
export declare class ChatRepository {
    private pool;
    constructor(pool: Pool);
    private mapConversationRow;
    private mapMessageRow;
    private mapParticipantRow;
    private mapReceiptRow;
    private mapAttachmentRow;
    getConversations(userId: string, userRole: 'customer' | 'provider', query?: GetConversationsQuery): Promise<Conversation[]>;
    getConversation(conversationId: string): Promise<Conversation | null>;
    findConversationBetween(customerId: string, providerId: string): Promise<Conversation | null>;
    createConversation(data: {
        id: string;
        providerId: string;
        customerId?: string;
        customerName: string;
        customerEmail: string;
        customerPhone?: string;
    }): Promise<Conversation>;
    updateConversationLastMessage(conversationId: string): Promise<void>;
    getMessages(conversationId: string, query?: GetMessagesQuery): Promise<Message[]>;
    getMessage(messageId: string): Promise<Message | null>;
    createMessage(data: {
        id: string;
        conversationId: string;
        senderUserId?: string;
        senderType: 'customer' | 'provider';
        senderName: string;
        type: string;
        body: string;
    }): Promise<Message>;
    updateMessage(messageId: string, body: string): Promise<Message | null>;
    deleteMessage(messageId: string): Promise<void>;
    getUnreadCount(conversationId: string, userId: string, userRole: 'customer' | 'provider'): Promise<number>;
    markMessagesAsRead(conversationId: string, userId: string, userRole: 'customer' | 'provider'): Promise<void>;
    getParticipants(conversationId: string): Promise<Participant[]>;
    addParticipant(data: {
        conversationId: string;
        userId: string;
        role: 'customer' | 'provider' | 'admin';
    }): Promise<Participant>;
    updateLastRead(conversationId: string, userId: string, messageId: string): Promise<void>;
    createReceipt(data: {
        messageId: string;
        recipientUserId: string;
        status: 'delivered' | 'read';
    }): Promise<Receipt>;
    getReceipts(messageId: string): Promise<Receipt[]>;
    createAttachment(data: {
        id: string;
        messageId: string;
        url: string;
        mimeType: string;
        size: number;
        width?: number;
        height?: number;
        thumbUrl?: string;
    }): Promise<Attachment>;
    getAttachments(messageId: string): Promise<Attachment[]>;
    isUserInConversation(conversationId: string, userId: string): Promise<boolean>;
}
//# sourceMappingURL=ChatRepository.d.ts.map