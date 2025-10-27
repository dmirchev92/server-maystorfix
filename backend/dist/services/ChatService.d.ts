import { ChatRepository } from '../models/ChatRepository';
import { Conversation, Message, CreateConversationRequest, SendMessageRequest, GetMessagesQuery, GetConversationsQuery } from '../types/chat.types';
export declare class ChatService {
    private chatRepo;
    constructor(chatRepo: ChatRepository);
    getConversations(userId: string, userRole: 'customer' | 'provider', query?: GetConversationsQuery): Promise<Conversation[]>;
    getConversation(conversationId: string, userId: string): Promise<Conversation>;
    createConversation(data: CreateConversationRequest, creatorUserId?: string): Promise<{
        conversation: Conversation;
        initialMessage?: Message;
    }>;
    archiveConversation(conversationId: string, userId: string): Promise<void>;
    getMessages(conversationId: string, userId: string, query?: GetMessagesQuery): Promise<Message[]>;
    sendMessage(data: SendMessageRequest, senderUserId: string, senderType: 'customer' | 'provider', senderName: string): Promise<Message>;
    editMessage(messageId: string, newBody: string, userId: string): Promise<Message>;
    deleteMessage(messageId: string, userId: string): Promise<void>;
    markAsRead(conversationId: string, userId: string, userRole: 'customer' | 'provider'): Promise<void>;
    getUnreadCount(conversationId: string, userId: string, userRole: 'customer' | 'provider'): Promise<number>;
    updateReceipt(messageId: string, recipientUserId: string, status: 'delivered' | 'read'): Promise<void>;
    getReceipts(messageId: string, userId: string): Promise<any[]>;
    private getMimeTypeFromUrl;
}
//# sourceMappingURL=ChatService.d.ts.map