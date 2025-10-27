"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUserPublicId = exports.getUnifiedMessages = exports.getUserConversations = exports.markAsRead = exports.updateConversation = exports.getProviderConversations = exports.getConversation = exports.getMessages = exports.getAllMessages = exports.sendMessage = exports.startConversation = void 0;
const DatabaseFactory_1 = require("../models/DatabaseFactory");
const logger_1 = __importDefault(require("../utils/logger"));
const types_1 = require("../types");
const db = DatabaseFactory_1.DatabaseFactory.getDatabase();
const startConversation = async (req, res, next) => {
    try {
        console.log('📥 Chat endpoint hit! Method:', req.method, 'URL:', req.url);
        console.log('📥 Headers:', JSON.stringify(req.headers, null, 2));
        console.log('📥 Received request body:', JSON.stringify(req.body, null, 2));
        console.log('📥 Body type:', typeof req.body, 'Is empty?', Object.keys(req.body || {}).length === 0);
        const { providerId, customerId, customerName, customerEmail, customerPhone } = req.body;
        console.log('🔍 Extracted fields:', {
            providerId: providerId || 'MISSING',
            customerId: customerId || 'null (unauthenticated)',
            customerName: customerName || 'MISSING',
            customerEmail: customerEmail || 'MISSING',
            customerPhone: customerPhone || 'MISSING'
        });
        if (!providerId || !customerName || !customerEmail) {
            console.log('❌ Validation failed - missing required fields');
            console.log('❌ Validation details:', {
                hasProviderId: !!providerId,
                hasCustomerName: !!customerName,
                hasCustomerEmail: !!customerEmail
            });
            throw new types_1.ServiceTextProError('Provider ID, customer name, and email are required', 'BAD_REQUEST', 400);
        }
        console.log('🗨️ Starting conversation:', { providerId, customerId, customerName, customerEmail });
        const conversationId = await db.createOrGetConversation({
            providerId,
            customerId,
            customerName,
            customerEmail,
            customerPhone
        });
        console.log('✅ Conversation created/found:', conversationId);
        const io = req.app.get('io');
        if (io) {
            io.to(`user-${providerId}`).emit('conversations_updated');
            if (customerId) {
                io.to(`user-${customerId}`).emit('conversations_updated');
            }
            console.log('📡 Emitted conversations_updated event');
        }
        res.status(201).json({
            success: true,
            data: { conversationId }
        });
    }
    catch (error) {
        logger_1.default.error('Error starting conversation:', error);
        next(error);
    }
};
exports.startConversation = startConversation;
const sendMessage = async (req, res, next) => {
    try {
        const { conversationId, senderType, senderName, message, messageType } = req.body;
        if (!conversationId || !senderType || !senderName || !message) {
            throw new types_1.ServiceTextProError('Conversation ID, sender type, sender name, and message are required', 'BAD_REQUEST', 400);
        }
        console.log('💬 Sending message:', { conversationId, senderType, senderName, message: message.substring(0, 50) + '...' });
        const conversationExists = await db.getConversationDetails(conversationId);
        if (!conversationExists) {
            console.log('❌ Conversation not found:', conversationId);
            throw new types_1.ServiceTextProError('Conversation not found', 'NOT_FOUND', 404);
        }
        const messageId = await db.sendMessage({
            conversationId,
            senderType,
            senderName,
            message,
            messageType
        });
        console.log('✅ Message sent:', messageId);
        const io = req.io;
        if (io) {
            const messageData = {
                messageId,
                conversationId,
                senderType,
                senderName,
                message,
                messageType: messageType || 'text',
                timestamp: new Date().toISOString()
            };
            io.to(`conversation-${conversationId}`).emit('new_message', messageData);
            const conversation = await db.getConversationDetails(conversationId);
            if (conversation) {
                io.to(`user-${conversation.provider_id}`).emit('new_message_notification', {
                    ...messageData,
                    customerName: conversation.customer_name,
                    customerEmail: conversation.customer_email
                });
                io.to(`user-${conversation.provider_id}`).emit('conversations_updated');
                if (conversation.customer_id) {
                    io.to(`user-${conversation.customer_id}`).emit('conversations_updated');
                }
            }
            console.log('📡 WebSocket message emitted to conversation and user rooms');
        }
        res.status(201).json({
            success: true,
            data: { messageId }
        });
    }
    catch (error) {
        logger_1.default.error('Error sending message:', error);
        next(error);
    }
};
exports.sendMessage = sendMessage;
const getAllMessages = async (req, res, next) => {
    try {
        const { userId, conversationId, limit } = req.query;
        console.log('📖 Getting all messages - userId:', userId, 'conversationId:', conversationId);
        if (conversationId) {
            const messages = await db.getConversationMessages(conversationId, limit ? parseInt(limit) : 50);
            console.log('✅ Found conversation messages:', messages.length);
            res.json({
                success: true,
                data: { messages }
            });
            return;
        }
        if (userId) {
            const conversations = await db.getAllUserConversations(userId);
            console.log('✅ Found user conversations:', conversations.length);
            res.json({
                success: true,
                data: { conversations }
            });
            return;
        }
        console.log('⚠️ No userId or conversationId provided, returning empty array');
        res.json({
            success: true,
            data: { messages: [] }
        });
    }
    catch (error) {
        logger_1.default.error('Error getting all messages:', error);
        next(error);
    }
};
exports.getAllMessages = getAllMessages;
const getMessages = async (req, res, next) => {
    try {
        const { conversationId } = req.params;
        const { limit } = req.query;
        console.log('📖 Getting messages for conversation:', conversationId);
        const messages = await db.getConversationMessages(conversationId, limit ? parseInt(limit) : 50);
        console.log('✅ Found messages:', messages.length);
        res.json({
            success: true,
            data: { messages }
        });
    }
    catch (error) {
        logger_1.default.error('Error getting messages:', error);
        next(error);
    }
};
exports.getMessages = getMessages;
const getConversation = async (req, res, next) => {
    try {
        const { conversationId } = req.params;
        console.log('📋 Getting conversation details:', conversationId);
        const conversation = await db.getConversationDetails(conversationId);
        if (!conversation) {
            throw new types_1.ServiceTextProError('Conversation not found', 'CONVERSATION_NOT_FOUND', 404);
        }
        console.log('✅ Found conversation:', conversation.id);
        res.json({
            success: true,
            data: { conversation }
        });
    }
    catch (error) {
        logger_1.default.error('Error getting conversation:', error);
        next(error);
    }
};
exports.getConversation = getConversation;
const getProviderConversations = async (req, res, next) => {
    try {
        const { providerId } = req.params;
        console.log('📋 Getting conversations for provider:', providerId);
        const conversations = await db.getProviderConversations(providerId);
        console.log('✅ Found conversations:', conversations.length);
        const transformedConversations = conversations.map(conv => ({
            ...conv,
            customerName: conv.customer_name,
            customerEmail: conv.customer_email,
            customerPhone: conv.customer_phone,
            messageCount: conv.message_count,
            unreadCount: conv.unread_count,
            lastMessage: conv.last_message
        }));
        res.json({
            success: true,
            data: { conversations: transformedConversations }
        });
    }
    catch (error) {
        logger_1.default.error('Error getting provider conversations:', error);
        next(error);
    }
};
exports.getProviderConversations = getProviderConversations;
const updateConversation = async (req, res, next) => {
    try {
        const { conversationId } = req.params;
        const { customerName, customerEmail, customerPhone } = req.body;
        console.log('🔄 Updating conversation:', { conversationId, customerName, customerEmail, customerPhone });
        if (!conversationId) {
            throw new types_1.ServiceTextProError('Conversation ID is required', 'BAD_REQUEST', 400);
        }
        await new Promise((resolve, reject) => {
            db._db.run(`UPDATE marketplace_conversations 
         SET customer_name = COALESCE(?, customer_name),
             customer_email = COALESCE(?, customer_email),
             customer_phone = COALESCE(?, customer_phone)
         WHERE id = ?`, [customerName, customerEmail, customerPhone, conversationId], (err) => {
                if (err)
                    reject(err);
                else
                    resolve();
            });
        });
        console.log('✅ Conversation updated successfully');
        res.json({
            success: true,
            data: { message: 'Conversation updated' }
        });
    }
    catch (error) {
        logger_1.default.error('Error updating conversation:', error);
        next(error);
    }
};
exports.updateConversation = updateConversation;
const markAsRead = async (req, res, next) => {
    try {
        const { conversationId } = req.params;
        const { senderType } = req.body;
        if (!['customer', 'provider'].includes(senderType)) {
            throw new types_1.ServiceTextProError('Sender type must be either "customer" or "provider"', 'BAD_REQUEST', 400);
        }
        console.log('👁️ Marking messages as read:', { conversationId, senderType });
        await db.markMessagesAsRead(conversationId, senderType);
        console.log('✅ Messages marked as read');
        res.json({
            success: true,
            data: { message: 'Messages marked as read' }
        });
    }
    catch (error) {
        logger_1.default.error('Error marking messages as read:', error);
        next(error);
    }
};
exports.markAsRead = markAsRead;
const getUserConversations = async (req, res, next) => {
    try {
        const { userId } = req.params;
        console.log('📱 Mobile app requesting conversations for user:', userId);
        console.log('📱 Request from:', req.get('User-Agent'));
        let actualUserId = userId;
        if (userId.startsWith('device_')) {
            try {
                const mapped = await new Promise((resolve, reject) => {
                    db.db.get(`SELECT id FROM users WHERE role = 'tradesperson' ORDER BY created_at DESC LIMIT 1`, [], (err, row) => {
                        if (err)
                            reject(err);
                        else
                            resolve(row?.id || null);
                    });
                });
                if (mapped) {
                    console.log('🔄 Mapped device ID to user for conversations:', { deviceId: userId, actualUserId: mapped });
                    actualUserId = mapped;
                }
            }
            catch (e) {
                console.log('⚠️ Device-to-user mapping failed, continuing with device ID');
            }
        }
        const conversations = await db.getAllUserConversations(actualUserId);
        console.log('✅ Found conversations:', conversations.length);
        const transformedConversations = conversations.map(conv => ({
            id: conv.id,
            customerPhone: conv.customer_phone || '',
            customerName: conv.customer_name || 'Неизвестен клиент',
            customerEmail: conv.customer_email || '',
            serviceProviderName: conv.service_provider_name || conv.serviceProviderName || 'Неизвестен специалист',
            serviceCategory: conv.service_category || conv.serviceCategory || null,
            status: conv.status === 'active' ? 'ai_active' : conv.status,
            lastActivity: conv.last_message_at,
            conversationType: conv.conversation_type,
            messageCount: parseInt(conv.message_count) || 0,
            unreadCount: parseInt(conv.unread_count) || 0,
            lastMessage: conv.last_message_content || null,
            messages: []
        }));
        res.json({
            success: true,
            data: { conversations: transformedConversations }
        });
    }
    catch (error) {
        logger_1.default.error('Error getting user conversations:', error);
        next(error);
    }
};
exports.getUserConversations = getUserConversations;
const getUnifiedMessages = async (req, res, next) => {
    try {
        const { conversationId } = req.params;
        const { conversationType } = req.query;
        if (!conversationType || !['phone', 'marketplace'].includes(conversationType)) {
            throw new types_1.ServiceTextProError('Valid conversation type (phone or marketplace) is required', 'BAD_REQUEST', 400);
        }
        console.log('📱 Getting unified messages:', { conversationId, conversationType });
        const messages = await db.getUnifiedConversationMessages(conversationId, conversationType);
        console.log('✅ Found messages:', messages.length);
        const transformedMessages = messages.map(msg => ({
            id: msg.id,
            text: msg.content || msg.message,
            sender: msg.sender === 'customer' ? 'customer' :
                msg.sender === 'provider' ? 'ivan' :
                    msg.sender,
            timestamp: msg.timestamp,
            isRead: msg.is_read === 1 || msg.is_read === 'read' || msg.is_read === true,
            senderName: msg.sender_name || '',
            metadata: {
                platform: conversationType === 'marketplace' ? 'web' : 'viber',
                deliveryStatus: msg.is_read ? 'read' : 'delivered'
            }
        }));
        res.json({
            success: true,
            data: { messages: transformedMessages }
        });
    }
    catch (error) {
        logger_1.default.error('Error getting unified messages:', error);
        next(error);
    }
};
exports.getUnifiedMessages = getUnifiedMessages;
const getUserPublicId = async (req, res, next) => {
    try {
        const { userId } = req.params;
        let targetUserId = userId;
        if (userId.startsWith('device_')) {
            try {
                const result = await db.query(`SELECT id FROM users WHERE role = $1 ORDER BY created_at DESC LIMIT 1`, ['tradesperson']);
                if (result.rows && result.rows.length > 0 && result.rows[0].id) {
                    targetUserId = result.rows[0].id;
                }
            }
            catch (err) {
                logger_1.default.warn('Failed to map device ID to tradesperson:', err);
            }
        }
        const existingUser = await db.findUserById(targetUserId);
        if (!existingUser) {
            res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });
            return;
        }
        const publicId = await db.ensureUserPublicId(targetUserId);
        res.json({ success: true, data: { publicId, userId: targetUserId } });
    }
    catch (error) {
        next(error);
    }
};
exports.getUserPublicId = getUserPublicId;
//# sourceMappingURL=chatController.js.map