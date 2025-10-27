"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatSocketHandler = void 0;
const jsonwebtoken_1 = require("jsonwebtoken");
class ChatSocketHandler {
    constructor(io, chatService) {
        this.userSockets = new Map();
        this.typingUsers = new Map();
        this.io = io;
        this.chatService = chatService;
    }
    initialize() {
        const chatNamespace = this.io.of('/chat');
        chatNamespace.use(this.authenticateSocket.bind(this));
        chatNamespace.on('connection', (socket) => {
            console.log(`✅ Chat socket connected: ${socket.id} (User: ${socket.userId})`);
            this.handleConnection(socket);
            this.handleTyping(socket);
            this.handlePresence(socket);
            this.handleMessages(socket);
            this.handleReceipts(socket);
            this.handleDisconnection(socket);
        });
        console.log('🔌 Chat socket namespace initialized at /chat');
    }
    async authenticateSocket(socket, next) {
        try {
            const token = socket.handshake.auth.token || socket.handshake.query.token;
            if (!token) {
                return next(new Error('Authentication token required'));
            }
            const decoded = (0, jsonwebtoken_1.verify)(token, process.env.JWT_SECRET || 'your-secret-key');
            socket.userId = decoded.userId || decoded.id;
            socket.userRole = decoded.role;
            socket.userName = decoded.firstName + ' ' + decoded.lastName;
            next();
        }
        catch (error) {
            console.error('❌ Socket authentication failed:', error);
            next(new Error('Invalid authentication token'));
        }
    }
    handleConnection(socket) {
        const userId = socket.userId;
        if (!this.userSockets.has(userId)) {
            this.userSockets.set(userId, new Set());
        }
        this.userSockets.get(userId).add(socket.id);
        socket.join(`user:${userId}`);
        this.broadcastPresence(userId, 'online');
        console.log(`👤 User ${userId} connected (${this.userSockets.get(userId).size} active sockets)`);
    }
    handleTyping(socket) {
        socket.on('typing:start', async (data) => {
            try {
                const userId = socket.userId;
                const { conversationId } = data;
                const isAuthorized = await this.chatService['chatRepo'].isUserInConversation(conversationId, userId);
                if (!isAuthorized) {
                    socket.emit('error', { message: 'Unauthorized' });
                    return;
                }
                if (!this.typingUsers.has(conversationId)) {
                    this.typingUsers.set(conversationId, new Set());
                }
                this.typingUsers.get(conversationId).add(userId);
                socket.to(`conversation:${conversationId}`).emit('typing', {
                    conversationId,
                    userId,
                    userName: socket.userName,
                    isTyping: true
                });
                console.log(`⌨️  User ${userId} started typing in ${conversationId}`);
            }
            catch (error) {
                console.error('Error handling typing:start:', error);
            }
        });
        socket.on('typing:stop', async (data) => {
            try {
                const userId = socket.userId;
                const { conversationId } = data;
                this.typingUsers.get(conversationId)?.delete(userId);
                socket.to(`conversation:${conversationId}`).emit('typing', {
                    conversationId,
                    userId,
                    userName: socket.userName,
                    isTyping: false
                });
                console.log(`⌨️  User ${userId} stopped typing in ${conversationId}`);
            }
            catch (error) {
                console.error('Error handling typing:stop:', error);
            }
        });
    }
    handlePresence(socket) {
        socket.on('presence:update', (data) => {
            const userId = socket.userId;
            this.broadcastPresence(userId, data.status);
        });
    }
    handleMessages(socket) {
        socket.on('message:send', async (data) => {
            try {
                const userId = socket.userId;
                const userName = socket.userName;
                const userRole = socket.userRole === 'service_provider' || socket.userRole === 'tradesperson' ? 'provider' : 'customer';
                const message = await this.chatService.sendMessage(data, userId, userRole, userName);
                await this.emitConversationUpdate(data.conversationId, userId, message);
                console.log(`📨 Message sent via socket: ${message.id}`);
            }
            catch (error) {
                socket.emit('error', { message: error.message });
                console.error('Error sending message via socket:', error);
            }
        });
        socket.on('conversation:join', async (data) => {
            try {
                const userId = socket.userId;
                const { conversationId } = data;
                const isAuthorized = await this.chatService['chatRepo'].isUserInConversation(conversationId, userId);
                if (!isAuthorized) {
                    socket.emit('error', { message: 'Unauthorized' });
                    return;
                }
                socket.join(`conversation:${conversationId}`);
                console.log(`🚪 User ${userId} joined conversation ${conversationId}`);
            }
            catch (error) {
                console.error('Error joining conversation:', error);
            }
        });
        socket.on('conversation:leave', (data) => {
            socket.leave(`conversation:${data.conversationId}`);
            console.log(`🚪 User ${socket.userId} left conversation ${data.conversationId}`);
        });
    }
    handleReceipts(socket) {
        socket.on('receipt:update', async (data) => {
            try {
                const userId = socket.userId;
                await this.chatService.updateReceipt(data.messageId, userId, data.status);
                this.io.of('/chat').emit('receipt:updated', {
                    messageId: data.messageId,
                    recipientUserId: userId,
                    status: data.status,
                    at: new Date().toISOString()
                });
                console.log(`✅ Receipt updated: ${data.messageId} -> ${data.status}`);
            }
            catch (error) {
                console.error('Error updating receipt:', error);
            }
        });
    }
    handleDisconnection(socket) {
        socket.on('disconnect', () => {
            const userId = socket.userId;
            this.userSockets.get(userId)?.delete(socket.id);
            if (this.userSockets.get(userId)?.size === 0) {
                this.userSockets.delete(userId);
                this.broadcastPresence(userId, 'offline');
                console.log(`👤 User ${userId} went offline`);
            }
            this.typingUsers.forEach((users, conversationId) => {
                if (users.has(userId)) {
                    users.delete(userId);
                    socket.to(`conversation:${conversationId}`).emit('typing', {
                        conversationId,
                        userId,
                        isTyping: false
                    });
                }
            });
            console.log(`❌ Chat socket disconnected: ${socket.id}`);
        });
    }
    broadcastPresence(userId, status) {
        this.io.of('/chat').emit('presence', {
            userId,
            status,
            at: new Date().toISOString()
        });
    }
    async emitConversationUpdate(conversationId, senderId, message) {
        try {
            const conversation = await this.chatService['chatRepo'].getConversation(conversationId);
            if (!conversation) {
                console.error(`❌ Conversation not found: ${conversationId}`);
                return;
            }
            const participants = {
                providerId: conversation.providerId,
                customerId: conversation.customerId
            };
            if (message) {
                console.log(`📨 [MESSAGE TO USERS] Message ${message.id}: "${message.body.substring(0, 30)}..."`);
                console.log(`📤 [TO PROVIDER] Sending to user:${participants.providerId}`);
                this.sendToUser(participants.providerId, 'message:new', {
                    conversationId,
                    message
                });
                if (participants.customerId) {
                    console.log(`📤 [TO CUSTOMER] Sending to user:${participants.customerId}`);
                    this.sendToUser(participants.customerId, 'message:new', {
                        conversationId,
                        message
                    });
                }
                console.log(`✅ [MESSAGE EMITTED] Message ${message.id} sent to both users`);
            }
            console.log(`📤 Sending conversation update to provider ${participants.providerId}, unread: 0`);
            this.sendToUser(participants.providerId, 'conversation:updated', {
                conversationId,
                lastMessageAt: message.sentAt
            });
            if (participants.customerId) {
                const unreadCount = senderId === participants.customerId ? 0 : 1;
                console.log(`📤 Sending conversation update to customer ${participants.customerId}, unread: ${unreadCount}`);
                this.sendToUser(participants.customerId, 'conversation:updated', {
                    conversationId,
                    lastMessageAt: message.sentAt
                });
            }
            console.log(`📊 Conversation update emitted for ${conversationId}`);
        }
        catch (error) {
            console.error('Error emitting conversation update:', error);
        }
    }
    sendToUser(userId, event, data) {
        const userSocketCount = this.userSockets.get(userId)?.size || 0;
        console.log(`🔌 [EMIT TO USER] Event: ${event}, User: ${userId}, Active sockets: ${userSocketCount}`);
        if (userSocketCount === 0) {
            console.warn(`⚠️ [NO SOCKETS] User ${userId} has no active socket connections!`);
        }
        this.io.of('/chat').to(`user:${userId}`).emit(event, data);
    }
    sendToConversation(conversationId, event, data) {
        this.io.of('/chat').to(`conversation:${conversationId}`).emit(event, data);
    }
}
exports.ChatSocketHandler = ChatSocketHandler;
//# sourceMappingURL=chatSocket.js.map