"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.chatErrorHandler = exports.ChatController = void 0;
const chatSchemas_1 = require("../validators/chatSchemas");
const zod_1 = require("zod");
class ChatController {
    constructor(chatService) {
        this.getConversations = async (req, res, next) => {
            try {
                const userId = req.user?.id;
                const userRole = req.user?.role;
                if (!userId) {
                    res.status(401).json({ success: false, error: 'Unauthorized' });
                    return;
                }
                const role = userRole === 'service_provider' || userRole === 'tradesperson' ? 'provider' : 'customer';
                const query = chatSchemas_1.getConversationsQuerySchema.parse(req.query);
                const conversations = await this.chatService.getConversations(userId, role, query);
                res.json({
                    success: true,
                    data: { conversations }
                });
            }
            catch (error) {
                next(error);
            }
        };
        this.createConversation = async (req, res, next) => {
            try {
                const userId = req.user?.id;
                const data = chatSchemas_1.createConversationSchema.parse(req.body);
                const result = await this.chatService.createConversation(data, userId);
                res.status(201).json({
                    success: true,
                    data: result
                });
            }
            catch (error) {
                next(error);
            }
        };
        this.getConversation = async (req, res, next) => {
            try {
                const userId = req.user?.id;
                if (!userId) {
                    res.status(401).json({ success: false, error: 'Unauthorized' });
                    return;
                }
                const { id } = chatSchemas_1.conversationIdParamSchema.parse(req.params);
                const conversation = await this.chatService.getConversation(id, userId);
                res.json({
                    success: true,
                    data: { conversation }
                });
            }
            catch (error) {
                next(error);
            }
        };
        this.getMessages = async (req, res, next) => {
            try {
                const userId = req.user?.id;
                if (!userId) {
                    res.status(401).json({ success: false, error: 'Unauthorized' });
                    return;
                }
                const { id: conversationId } = chatSchemas_1.conversationIdParamSchema.parse(req.params);
                const query = chatSchemas_1.getMessagesQuerySchema.parse(req.query);
                const messages = await this.chatService.getMessages(conversationId, userId, query);
                res.json({
                    success: true,
                    data: { messages }
                });
            }
            catch (error) {
                next(error);
            }
        };
        this.sendMessage = async (req, res, next) => {
            try {
                const userId = req.user?.id;
                const userName = req.user?.firstName + ' ' + req.user?.lastName;
                const userRole = req.user?.role;
                if (!userId) {
                    res.status(401).json({ success: false, error: 'Unauthorized' });
                    return;
                }
                const { id: conversationId } = chatSchemas_1.conversationIdParamSchema.parse(req.params);
                const data = chatSchemas_1.sendMessageSchema.parse({
                    ...req.body,
                    conversationId
                });
                const senderType = userRole === 'service_provider' || userRole === 'tradesperson' ? 'provider' : 'customer';
                const message = await this.chatService.sendMessage(data, userId, senderType, userName);
                const io = req.io;
                if (io) {
                    io.to(`conversation:${conversationId}`).emit('message:new', {
                        conversationId,
                        message
                    });
                }
                res.status(201).json({
                    success: true,
                    data: { message }
                });
            }
            catch (error) {
                next(error);
            }
        };
        this.editMessage = async (req, res, next) => {
            try {
                const userId = req.user?.id;
                if (!userId) {
                    res.status(401).json({ success: false, error: 'Unauthorized' });
                    return;
                }
                const { id: messageId } = chatSchemas_1.messageIdParamSchema.parse(req.params);
                const { body } = chatSchemas_1.editMessageSchema.parse(req.body);
                const message = await this.chatService.editMessage(messageId, body, userId);
                const io = req.io;
                if (io) {
                    io.to(`conversation:${message.conversationId}`).emit('message:updated', { message });
                }
                res.json({
                    success: true,
                    data: { message }
                });
            }
            catch (error) {
                next(error);
            }
        };
        this.deleteMessage = async (req, res, next) => {
            try {
                const userId = req.user?.id;
                if (!userId) {
                    res.status(401).json({ success: false, error: 'Unauthorized' });
                    return;
                }
                const { id: messageId } = chatSchemas_1.messageIdParamSchema.parse(req.params);
                await this.chatService.deleteMessage(messageId, userId);
                const io = req.io;
                if (io) {
                    io.emit('message:deleted', { messageId });
                }
                res.json({
                    success: true,
                    data: { messageId }
                });
            }
            catch (error) {
                next(error);
            }
        };
        this.markAsRead = async (req, res, next) => {
            try {
                const userId = req.user?.id;
                const userRole = req.user?.role;
                if (!userId) {
                    res.status(401).json({ success: false, error: 'Unauthorized' });
                    return;
                }
                const { id: conversationId } = chatSchemas_1.conversationIdParamSchema.parse(req.params);
                const role = userRole === 'service_provider' || userRole === 'tradesperson' ? 'provider' : 'customer';
                await this.chatService.markAsRead(conversationId, userId, role);
                res.json({
                    success: true,
                    data: { conversationId }
                });
            }
            catch (error) {
                next(error);
            }
        };
        this.updateReceipt = async (req, res, next) => {
            try {
                const userId = req.user?.id;
                if (!userId) {
                    res.status(401).json({ success: false, error: 'Unauthorized' });
                    return;
                }
                const { id: messageId } = chatSchemas_1.messageIdParamSchema.parse(req.params);
                const { status } = chatSchemas_1.updateReceiptSchema.parse(req.body);
                await this.chatService.updateReceipt(messageId, userId, status);
                const io = req.io;
                if (io) {
                    io.emit('receipt:updated', {
                        messageId,
                        recipientUserId: userId,
                        status,
                        at: new Date().toISOString()
                    });
                }
                res.json({
                    success: true,
                    data: { messageId, status }
                });
            }
            catch (error) {
                next(error);
            }
        };
        this.getReceipts = async (req, res, next) => {
            try {
                const userId = req.user?.id;
                if (!userId) {
                    res.status(401).json({ success: false, error: 'Unauthorized' });
                    return;
                }
                const { id: messageId } = chatSchemas_1.messageIdParamSchema.parse(req.params);
                const receipts = await this.chatService.getReceipts(messageId, userId);
                res.json({
                    success: true,
                    data: { receipts }
                });
            }
            catch (error) {
                next(error);
            }
        };
        this.chatService = chatService;
    }
}
exports.ChatController = ChatController;
const chatErrorHandler = (err, req, res, next) => {
    if (err instanceof zod_1.ZodError) {
        res.status(400).json({
            success: false,
            error: 'Validation error',
            details: err.issues
        });
        return;
    }
    if (err.message?.includes('Unauthorized')) {
        res.status(403).json({
            success: false,
            error: err.message
        });
        return;
    }
    if (err.message?.includes('not found')) {
        res.status(404).json({
            success: false,
            error: err.message
        });
        return;
    }
    res.status(500).json({
        success: false,
        error: err.message || 'Internal server error'
    });
};
exports.chatErrorHandler = chatErrorHandler;
//# sourceMappingURL=chatControllerV2.js.map