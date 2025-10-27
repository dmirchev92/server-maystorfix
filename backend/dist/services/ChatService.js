"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatService = void 0;
const crypto_1 = require("crypto");
class ChatService {
    constructor(chatRepo) {
        this.chatRepo = chatRepo;
    }
    async getConversations(userId, userRole, query = {}) {
        const conversations = await this.chatRepo.getConversations(userId, userRole, query);
        const enriched = await Promise.all(conversations.map(async (conv) => {
            const unreadCount = await this.chatRepo.getUnreadCount(conv.id, userId, userRole);
            const messages = await this.chatRepo.getMessages(conv.id, { limit: 1 });
            return {
                ...conv,
                unreadCount,
                lastMessage: messages[0] || undefined
            };
        }));
        return enriched;
    }
    async getConversation(conversationId, userId) {
        const isAuthorized = await this.chatRepo.isUserInConversation(conversationId, userId);
        if (!isAuthorized) {
            throw new Error('Unauthorized: User is not a participant in this conversation');
        }
        const conversation = await this.chatRepo.getConversation(conversationId);
        if (!conversation) {
            throw new Error('Conversation not found');
        }
        return conversation;
    }
    async createConversation(data, creatorUserId) {
        if (creatorUserId && data.providerId) {
            const existingConversation = await this.chatRepo.findConversationBetween(creatorUserId, data.providerId);
            if (existingConversation) {
                console.log('💬 ChatService - Found existing conversation:', existingConversation.id);
                return { conversation: existingConversation };
            }
        }
        console.log('💬 ChatService - Creating new conversation');
        const conversationId = (0, crypto_1.randomUUID)();
        const conversation = await this.chatRepo.createConversation({
            id: conversationId,
            providerId: data.providerId,
            customerId: creatorUserId,
            customerName: data.customerName,
            customerEmail: data.customerEmail,
            customerPhone: data.customerPhone
        });
        let initialMessage;
        if (data.initialMessage) {
            initialMessage = await this.sendMessage({
                conversationId: conversation.id,
                type: 'text',
                body: data.initialMessage
            }, creatorUserId || 'system', 'customer', data.customerName);
        }
        return { conversation, initialMessage };
    }
    async archiveConversation(conversationId, userId) {
        const isAuthorized = await this.chatRepo.isUserInConversation(conversationId, userId);
        if (!isAuthorized) {
            throw new Error('Unauthorized');
        }
        console.log(`Archive conversation ${conversationId} for user ${userId}`);
    }
    async getMessages(conversationId, userId, query = {}) {
        const isAuthorized = await this.chatRepo.isUserInConversation(conversationId, userId);
        if (!isAuthorized) {
            throw new Error('Unauthorized: User is not a participant in this conversation');
        }
        const messages = await this.chatRepo.getMessages(conversationId, query);
        return messages;
    }
    async sendMessage(data, senderUserId, senderType, senderName) {
        const isAuthorized = await this.chatRepo.isUserInConversation(data.conversationId, senderUserId);
        if (!isAuthorized) {
            throw new Error('Unauthorized: User is not a participant in this conversation');
        }
        if (!data.body || data.body.trim().length === 0) {
            throw new Error('Message body cannot be empty');
        }
        if (data.body.length > 10000) {
            throw new Error('Message body too long (max 10000 characters)');
        }
        const messageId = (0, crypto_1.randomUUID)();
        const message = await this.chatRepo.createMessage({
            id: messageId,
            conversationId: data.conversationId,
            senderUserId,
            senderType,
            senderName,
            type: data.type,
            body: data.body.trim()
        });
        await this.chatRepo.updateConversationLastMessage(data.conversationId);
        if (data.attachments && data.attachments.length > 0) {
            await Promise.all(data.attachments.map(url => this.chatRepo.createAttachment({
                id: (0, crypto_1.randomUUID)(),
                messageId: message.id,
                url,
                mimeType: this.getMimeTypeFromUrl(url),
                size: 0
            })));
        }
        return message;
    }
    async editMessage(messageId, newBody, userId) {
        const message = await this.chatRepo.getMessage(messageId);
        if (!message) {
            throw new Error('Message not found');
        }
        if (message.senderUserId !== userId) {
            throw new Error('Unauthorized: Only the sender can edit this message');
        }
        if (!newBody || newBody.trim().length === 0) {
            throw new Error('Message body cannot be empty');
        }
        const updated = await this.chatRepo.updateMessage(messageId, newBody.trim());
        if (!updated) {
            throw new Error('Failed to update message');
        }
        return updated;
    }
    async deleteMessage(messageId, userId) {
        const message = await this.chatRepo.getMessage(messageId);
        if (!message) {
            throw new Error('Message not found');
        }
        if (message.senderUserId !== userId) {
            throw new Error('Unauthorized: Only the sender can delete this message');
        }
        await this.chatRepo.deleteMessage(messageId);
    }
    async markAsRead(conversationId, userId, userRole) {
        const isAuthorized = await this.chatRepo.isUserInConversation(conversationId, userId);
        if (!isAuthorized) {
            throw new Error('Unauthorized');
        }
        await this.chatRepo.markMessagesAsRead(conversationId, userId, userRole);
    }
    async getUnreadCount(conversationId, userId, userRole) {
        const isAuthorized = await this.chatRepo.isUserInConversation(conversationId, userId);
        if (!isAuthorized) {
            throw new Error('Unauthorized');
        }
        return await this.chatRepo.getUnreadCount(conversationId, userId, userRole);
    }
    async updateReceipt(messageId, recipientUserId, status) {
        const message = await this.chatRepo.getMessage(messageId);
        if (!message) {
            throw new Error('Message not found');
        }
        const isAuthorized = await this.chatRepo.isUserInConversation(message.conversationId, recipientUserId);
        if (!isAuthorized) {
            throw new Error('Unauthorized');
        }
        await this.chatRepo.createReceipt({
            messageId,
            recipientUserId,
            status
        });
    }
    async getReceipts(messageId, userId) {
        const message = await this.chatRepo.getMessage(messageId);
        if (!message) {
            throw new Error('Message not found');
        }
        const isAuthorized = await this.chatRepo.isUserInConversation(message.conversationId, userId);
        if (!isAuthorized) {
            throw new Error('Unauthorized');
        }
        return await this.chatRepo.getReceipts(messageId);
    }
    getMimeTypeFromUrl(url) {
        const ext = url.split('.').pop()?.toLowerCase();
        const mimeTypes = {
            jpg: 'image/jpeg',
            jpeg: 'image/jpeg',
            png: 'image/png',
            gif: 'image/gif',
            pdf: 'application/pdf',
            doc: 'application/msword',
            docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        };
        return mimeTypes[ext || ''] || 'application/octet-stream';
    }
}
exports.ChatService = ChatService;
//# sourceMappingURL=ChatService.js.map