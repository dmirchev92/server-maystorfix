// @ts-nocheck
import { Request, Response, NextFunction } from 'express';
import { DatabaseFactory } from '../models/DatabaseFactory';
import logger from '../utils/logger';
import { ServiceTextProError } from '../types';

const db = DatabaseFactory.getDatabase();

/**
 * POST /api/v1/chat/conversations
 * Start a new conversation or get existing one
 */
export const startConversation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
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
      throw new ServiceTextProError('Provider ID, customer name, and email are required', 'BAD_REQUEST', 400);
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

    // Emit conversation list update to both provider and customer
    const io = (req.app as any).get('io');
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

  } catch (error) {
    logger.error('Error starting conversation:', error);
    next(error);
  }
};

/**
 * POST /api/v1/chat/messages
 * Send a message in a conversation
 */
export const sendMessage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { conversationId, senderType, senderName, message, messageType } = req.body;
    if (!conversationId || !senderType || !senderName || !message) {
      throw new ServiceTextProError('Conversation ID, sender type, sender name, and message are required', 'BAD_REQUEST', 400);
    }
    console.log('💬 Sending message:', { conversationId, senderType, senderName, message: message.substring(0, 50) + '...' });
    
    // Check if conversation exists, if not return 404 for frontend to handle
    const conversationExists = await db.getConversationDetails(conversationId);
    if (!conversationExists) {
      console.log('❌ Conversation not found:', conversationId);
      throw new ServiceTextProError('Conversation not found', 'NOT_FOUND', 404);
    }
    
    const messageId = await db.sendMessage({
      conversationId,
      senderType,
      senderName,
      message,
      messageType
    });

    console.log('✅ Message sent:', messageId);

    // Emit WebSocket event for real-time updates
    const io = (req as any).io;
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
      
      // Emit to conversation room
      io.to(`conversation-${conversationId}`).emit('new_message', messageData);
      
      // Emit to provider's personal room for notifications
      const conversation = await db.getConversationDetails(conversationId);
      if (conversation) {
        io.to(`user-${conversation.provider_id}`).emit('new_message_notification', {
          ...messageData,
          customerName: conversation.customer_name,
          customerEmail: conversation.customer_email
        });
        
        // Emit conversation list update to both provider and customer
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

  } catch (error) {
    logger.error('Error sending message:', error);
    next(error);
  }
};

/**
 * GET /api/v1/chat/messages
 * Get all messages for the authenticated user (fallback endpoint)
 */
export const getAllMessages = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { userId, conversationId, limit } = req.query;

    console.log('📖 Getting all messages - userId:', userId, 'conversationId:', conversationId);

    // If conversationId is provided, get messages for that conversation
    if (conversationId) {
      const messages = await db.getConversationMessages(
        conversationId as string, 
        limit ? parseInt(limit as string) : 50
      );

      console.log('✅ Found conversation messages:', messages.length);

      res.json({
        success: true,
        data: { messages }
      });
      return;
    }

    // If userId is provided, get all conversations for that user
    if (userId) {
      const conversations = await db.getAllUserConversations(userId as string);
      console.log('✅ Found user conversations:', conversations.length);

      res.json({
        success: true,
        data: { conversations }
      });
      return;
    }

    // Fallback - return empty array
    console.log('⚠️ No userId or conversationId provided, returning empty array');
    res.json({
      success: true,
      data: { messages: [] }
    });

  } catch (error) {
    logger.error('Error getting all messages:', error);
    next(error);
  }
};

/**
 * GET /api/v1/chat/conversations/:conversationId/messages
 * Get messages for a conversation
 */
export const getMessages = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { conversationId } = req.params;
    const { limit } = req.query;

    console.log('📖 Getting messages for conversation:', conversationId);

    const messages = await db.getConversationMessages(
      conversationId, 
      limit ? parseInt(limit as string) : 50
    );

    console.log('✅ Found messages:', messages.length);

    res.json({
      success: true,
      data: { messages }
    });

  } catch (error) {
    logger.error('Error getting messages:', error);
    next(error);
  }
};

/**
 * GET /api/v1/chat/conversations/:conversationId
 * Get conversation details
 */
export const getConversation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { conversationId } = req.params;

    console.log('📋 Getting conversation details:', conversationId);

    const conversation = await db.getConversationDetails(conversationId);

    if (!conversation) {
      throw new ServiceTextProError('Conversation not found', 'CONVERSATION_NOT_FOUND', 404);
    }

    console.log('✅ Found conversation:', conversation.id);

    res.json({
      success: true,
      data: { conversation }
    });

  } catch (error) {
    logger.error('Error getting conversation:', error);
    next(error);
  }
};

/**
 * GET /api/v1/chat/provider/:providerId/conversations
 * Get all conversations for a provider
 */
export const getProviderConversations = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { providerId } = req.params;

    console.log('📋 Getting conversations for provider:', providerId);

    const conversations = await db.getProviderConversations(providerId);

    console.log('✅ Found conversations:', conversations.length);
    
    // Transform conversations to include proper field names for frontend
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

  } catch (error) {
    logger.error('Error getting provider conversations:', error);
    next(error);
  }
};

/**
 * PUT /api/v1/marketplace/conversations/:conversationId
 * Update conversation details (customer info)
 */
export const updateConversation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { conversationId } = req.params;
    const { customerName, customerEmail, customerPhone } = req.body;

    console.log('🔄 Updating conversation:', { conversationId, customerName, customerEmail, customerPhone });

    if (!conversationId) {
      throw new ServiceTextProError('Conversation ID is required', 'BAD_REQUEST', 400);
    }

    // Update conversation in database using PostgreSQL
    const pool = (db as any).getPool();
    await pool.query(
      `UPDATE marketplace_conversations 
       SET customer_name = COALESCE($1, customer_name),
           customer_email = COALESCE($2, customer_email),
           customer_phone = COALESCE($3, customer_phone)
       WHERE id = $4`,
      [customerName, customerEmail, customerPhone, conversationId]
    );

    console.log('✅ Conversation updated successfully');

    res.json({
      success: true,
      data: { message: 'Conversation updated' }
    });

  } catch (error) {
    logger.error('Error updating conversation:', error);
    next(error);
  }
};

/**
 * PUT /api/v1/chat/conversations/:conversationId/read
 * Mark messages as read
 */
export const markAsRead = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { conversationId } = req.params;
    const { senderType } = req.body;

    if (!['customer', 'provider'].includes(senderType)) {
      throw new ServiceTextProError('Sender type must be either "customer" or "provider"', 'BAD_REQUEST', 400);
    }

    console.log('👁️ Marking messages as read:', { conversationId, senderType });

    await db.markMessagesAsRead(conversationId, senderType);

    console.log('✅ Messages marked as read');

    res.json({
      success: true,
      data: { message: 'Messages marked as read' }
    });

  } catch (error) {
    logger.error('Error marking messages as read:', error);
    next(error);
  }
};

/**
 * GET /api/v1/chat/user/:userId/conversations
 * Get all conversations for a user (both phone and marketplace) - for mobile app
 */
export const getUserConversations = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { userId } = req.params;

    console.log('📱 Mobile app requesting conversations for user:', userId);
    console.log('📱 Request from:', req.get('User-Agent'));

    let actualUserId = userId;
    if (userId.startsWith('device_')) {
      // Map device ID to latest tradesperson user (single-user fallback)
      try {
        const mapped = await new Promise<string | null>((resolve, reject) => {
          db.db.get(
            `SELECT id FROM users WHERE role = 'tradesperson' ORDER BY created_at DESC LIMIT 1`,
            [],
            (err: any, row: any) => {
              if (err) reject(err);
              else resolve(row?.id || null);
            }
          );
        });
        if (mapped) {
          console.log('🔄 Mapped device ID to user for conversations:', { deviceId: userId, actualUserId: mapped });
          actualUserId = mapped;
        }
      } catch (e) {
        console.log('⚠️ Device-to-user mapping failed, continuing with device ID');
      }
    }

    const conversations = await db.getAllUserConversations(actualUserId);

    console.log('✅ Found conversations:', conversations.length);

    // Transform data to match mobile app format
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
      lastMessage: conv.last_message_content || null, // Include last message content
      messages: [] // Will be loaded separately when conversation is opened
    }));

    res.json({
      success: true,
      data: { conversations: transformedConversations }
    });

  } catch (error) {
    logger.error('Error getting user conversations:', error);
    next(error);
  }
};

/**
 * GET /api/v1/chat/unified/:conversationId/messages
 * Get messages for any conversation type - for mobile app
 */
export const getUnifiedMessages = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { conversationId } = req.params;
    const { conversationType } = req.query;

    if (!conversationType || !['phone', 'marketplace'].includes(conversationType as string)) {
      throw new ServiceTextProError('Valid conversation type (phone or marketplace) is required', 'BAD_REQUEST', 400);
    }

    console.log('📱 Getting unified messages:', { conversationId, conversationType });

    const messages = await db.getUnifiedConversationMessages(
      conversationId, 
      conversationType as 'phone' | 'marketplace'
    );

    console.log('✅ Found messages:', messages.length);

    // Transform messages to match mobile app format
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

  } catch (error) {
    logger.error('Error getting unified messages:', error);
    next(error);
  }
};

// Old chat token methods removed - replaced by new ChatTokenService system

/**
 * GET /api/v1/users/:userId/public-id
 * Ensure and return user's publicId
 */
export const getUserPublicId = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { userId } = req.params as any;
    // Use the existing db variable (already initialized at top of file with DatabaseFactory)
    let targetUserId = userId;

    // Map device_* IDs to the latest tradesperson user (single-user fallback)
    if (userId.startsWith('device_')) {
      try {
        // Use DatabaseFactory's query method (works with both SQLite and PostgreSQL)
        const result = await (db as any).query(
          `SELECT id FROM users WHERE role = $1 ORDER BY created_at DESC LIMIT 1`,
          ['tradesperson']
        );
        if (result.rows && result.rows.length > 0 && result.rows[0].id) {
          targetUserId = result.rows[0].id;
        }
      } catch (err) {
        // Silently fail and use original userId
        logger.warn('Failed to map device ID to tradesperson:', err);
      }
    }

    const existingUser = await db.findUserById(targetUserId);
    if (!existingUser) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });
      return;
    }
    const publicId = await db.ensureUserPublicId(targetUserId);
    res.json({ success: true, data: { publicId, userId: targetUserId } });
  } catch (error) {
    next(error);
  }
};
