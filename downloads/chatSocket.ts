/**
 * Chat Socket.IO Handler
 * Handles real-time chat events: typing, presence, messages
 * Cross-platform: Web + Android
 */

import { Server, Socket } from 'socket.io'
import { ChatService } from '../services/ChatService'
import { verify } from 'jsonwebtoken'

interface AuthenticatedSocket extends Socket {
  userId?: string
  userRole?: string
  userName?: string
}

export class ChatSocketHandler {
  private io: Server
  private chatService: ChatService
  private userSockets: Map<string, Set<string>> = new Map() // userId -> Set of socketIds
  private typingUsers: Map<string, Set<string>> = new Map() // conversationId -> Set of userIds

  constructor(io: Server, chatService: ChatService) {
    this.io = io
    this.chatService = chatService
  }

  /**
   * Initialize chat socket namespace
   */
  initialize() {
    const chatNamespace = this.io.of('/chat')

    chatNamespace.use(this.authenticateSocket.bind(this))

    chatNamespace.on('connection', (socket: AuthenticatedSocket) => {
      console.log(`✅ Chat socket connected: ${socket.id} (User: ${socket.userId})`)

      this.handleConnection(socket)
      this.handleTyping(socket)
      this.handlePresence(socket)
      this.handleMessages(socket)
      this.handleReceipts(socket)
      this.handleDisconnection(socket)
    })

    console.log('🔌 Chat socket namespace initialized at /chat')
  }

  /**
   * Authenticate socket connection via JWT
   */
  private async authenticateSocket(socket: AuthenticatedSocket, next: (err?: Error) => void) {
    try {
      const token = socket.handshake.auth.token || socket.handshake.query.token

      if (!token) {
        return next(new Error('Authentication token required'))
      }

      const decoded = verify(token as string, process.env.JWT_SECRET || 'your-secret-key') as any
      
      socket.userId = decoded.userId || decoded.id
      socket.userRole = decoded.role
      socket.userName = decoded.firstName + ' ' + decoded.lastName

      next()
    } catch (error) {
      console.error('❌ Socket authentication failed:', error)
      next(new Error('Invalid authentication token'))
    }
  }

  /**
   * Handle socket connection
   */
  private handleConnection(socket: AuthenticatedSocket) {
    const userId = socket.userId!

    // Track user's sockets
    if (!this.userSockets.has(userId)) {
      this.userSockets.set(userId, new Set())
    }
    this.userSockets.get(userId)!.add(socket.id)

    // Join user's personal room
    socket.join(`user:${userId}`)

    // Emit online presence
    this.broadcastPresence(userId, 'online')

    console.log(`👤 User ${userId} connected (${this.userSockets.get(userId)!.size} active sockets)`)
  }

  /**
   * Handle typing indicators
   */
  private handleTyping(socket: AuthenticatedSocket) {
    socket.on('typing:start', async (data: { conversationId: string }) => {
      try {
        const userId = socket.userId!
        const { conversationId } = data

        // Verify user is in conversation
        const isAuthorized = await this.chatService['chatRepo'].isUserInConversation(conversationId, userId)
        if (!isAuthorized) {
          socket.emit('error', { message: 'Unauthorized' })
          return
        }

        // Track typing user
        if (!this.typingUsers.has(conversationId)) {
          this.typingUsers.set(conversationId, new Set())
        }
        this.typingUsers.get(conversationId)!.add(userId)

        // Broadcast to conversation (except sender)
        socket.to(`conversation:${conversationId}`).emit('typing', {
          conversationId,
          userId,
          userName: socket.userName,
          isTyping: true
        })

        console.log(`⌨️  User ${userId} started typing in ${conversationId}`)
      } catch (error) {
        console.error('Error handling typing:start:', error)
      }
    })

    socket.on('typing:stop', async (data: { conversationId: string }) => {
      try {
        const userId = socket.userId!
        const { conversationId } = data

        // Remove from typing users
        this.typingUsers.get(conversationId)?.delete(userId)

        // Broadcast to conversation
        socket.to(`conversation:${conversationId}`).emit('typing', {
          conversationId,
          userId,
          userName: socket.userName,
          isTyping: false
        })

        console.log(`⌨️  User ${userId} stopped typing in ${conversationId}`)
      } catch (error) {
        console.error('Error handling typing:stop:', error)
      }
    })
  }

  /**
   * Handle presence updates
   */
  private handlePresence(socket: AuthenticatedSocket) {
    socket.on('presence:update', (data: { status: 'online' | 'away' | 'offline' }) => {
      const userId = socket.userId!
      this.broadcastPresence(userId, data.status)
    })
  }

  /**
   * Handle real-time message sending (alternative to REST API)
   */
  private handleMessages(socket: AuthenticatedSocket) {
    socket.on('message:send', async (data: {
      conversationId: string
      type: string
      body: string
      attachments?: string[]
    }) => {
      try {
        const userId = socket.userId!
        const userName = socket.userName!
        const userRole = socket.userRole === 'service_provider' || socket.userRole === 'tradesperson' ? 'provider' : 'customer'

        const message = await this.chatService.sendMessage(
          data as any,
          userId,
          userRole,
          userName
        )

        // Emit to individual users (same as API endpoint does)
        await this.emitConversationUpdate(data.conversationId, userId, message)

        console.log(`📨 Message sent via socket: ${message.id}`)
      } catch (error: any) {
        socket.emit('error', { message: error.message })
        console.error('Error sending message via socket:', error)
      }
    })

    // Join conversation room
    socket.on('conversation:join', async (data: { conversationId: string }) => {
      try {
        const userId = socket.userId!
        const { conversationId } = data

        // Verify authorization
        const isAuthorized = await this.chatService['chatRepo'].isUserInConversation(conversationId, userId)
        if (!isAuthorized) {
          socket.emit('error', { message: 'Unauthorized' })
          return
        }

        socket.join(`conversation:${conversationId}`)
        console.log(`🚪 User ${userId} joined conversation ${conversationId}`)
      } catch (error) {
        console.error('Error joining conversation:', error)
      }
    })

    // Leave conversation room
    socket.on('conversation:leave', (data: { conversationId: string }) => {
      socket.leave(`conversation:${data.conversationId}`)
      console.log(`🚪 User ${socket.userId} left conversation ${data.conversationId}`)
    })
  }

  /**
   * Handle read receipts
   */
  private handleReceipts(socket: AuthenticatedSocket) {
    socket.on('receipt:update', async (data: {
      messageId: string
      status: 'delivered' | 'read'
    }) => {
      try {
        const userId = socket.userId!

        await this.chatService.updateReceipt(data.messageId, userId, data.status)

        // Broadcast receipt update
        this.io.of('/chat').emit('receipt:updated', {
          messageId: data.messageId,
          recipientUserId: userId,
          status: data.status,
          at: new Date().toISOString()
        })

        console.log(`✅ Receipt updated: ${data.messageId} -> ${data.status}`)
      } catch (error) {
        console.error('Error updating receipt:', error)
      }
    })
  }

  /**
   * Handle socket disconnection
   */
  private handleDisconnection(socket: AuthenticatedSocket) {
    socket.on('disconnect', () => {
      const userId = socket.userId!

      // Remove socket from user's set
      this.userSockets.get(userId)?.delete(socket.id)

      // If user has no more sockets, mark as offline
      if (this.userSockets.get(userId)?.size === 0) {
        this.userSockets.delete(userId)
        this.broadcastPresence(userId, 'offline')
        console.log(`👤 User ${userId} went offline`)
      }

      // Remove from all typing indicators
      this.typingUsers.forEach((users, conversationId) => {
        if (users.has(userId)) {
          users.delete(userId)
          socket.to(`conversation:${conversationId}`).emit('typing', {
            conversationId,
            userId,
            isTyping: false
          })
        }
      })

      console.log(`❌ Chat socket disconnected: ${socket.id}`)
    })
  }

  /**
   * Broadcast presence to all relevant users
   */
  private broadcastPresence(userId: string, status: 'online' | 'away' | 'offline') {
    this.io.of('/chat').emit('presence', {
      userId,
      status,
      at: new Date().toISOString()
    })
  }

  /**
   * Emit conversation update with message to both participants
   */
  async emitConversationUpdate(conversationId: string, senderId: string, message: any) {
    try {
      // Get conversation to find participants
      const conversation = await this.chatService['chatRepo'].getConversation(conversationId)
      
      if (!conversation) {
        console.error(`❌ Conversation not found: ${conversationId}`)
        return
      }

      const participants = {
        providerId: conversation.providerId,
        customerId: conversation.customerId
      }

      // Emit message to both users
      if (message) {
        console.log(`📨 [MESSAGE TO USERS] Message ${message.id}: "${message.body.substring(0, 30)}..."`)
        console.log(`📤 [TO PROVIDER] Sending to user:${participants.providerId}`)
        this.sendToUser(participants.providerId, 'message:new', {
          conversationId,
          message
        })

        if (participants.customerId) {
          console.log(`📤 [TO CUSTOMER] Sending to user:${participants.customerId}`)
          this.sendToUser(participants.customerId, 'message:new', {
            conversationId,
            message
          })
        }
        console.log(`✅ [MESSAGE EMITTED] Message ${message.id} sent to both users`)
      }

      // Emit conversation update with full data including unread count
      // Get unread count for provider (always 0 for sender)
      const providerUnreadCount = senderId === participants.providerId ? 0 : 
        await this.chatService['chatRepo'].getUnreadCount(conversationId, participants.providerId, 'provider')
      
      const providerUpdate = {
        conversationId,
        lastMessageAt: message.sentAt,
        lastMessage: message.body,
        unreadCount: providerUnreadCount
      }
      console.log(`📤 Sending conversation update to provider ${participants.providerId}:`, JSON.stringify(providerUpdate))
      this.sendToUser(participants.providerId, 'conversation:updated', providerUpdate)

      if (participants.customerId) {
        // Get unread count for customer (always 0 for sender)
        const customerUnreadCount = senderId === participants.customerId ? 0 : 
          await this.chatService['chatRepo'].getUnreadCount(conversationId, participants.customerId, 'customer')
        
        const customerUpdate = {
          conversationId,
          lastMessageAt: message.sentAt,
          lastMessage: message.body,
          unreadCount: customerUnreadCount
        }
        console.log(`📤 Sending conversation update to customer ${participants.customerId}:`, JSON.stringify(customerUpdate))
        this.sendToUser(participants.customerId, 'conversation:updated', customerUpdate)
      }

      console.log(`📊 Conversation update emitted for ${conversationId}`)
    } catch (error) {
      console.error('Error emitting conversation update:', error)
    }
  }

  /**
   * Send notification to specific user
   * Note: In cluster mode, userSockets map is per-instance, so count may be inaccurate
   * But socket.io rooms work across cluster instances
   */
  sendToUser(userId: string, event: string, data: any) {
    this.io.of('/chat').to(`user:${userId}`).emit(event, data)
    console.log(`🔌 [EMIT TO USER] Event: ${event}, User: ${userId}, Room: user:${userId}`)
  }

  /**
   * Send notification to conversation
   */
  sendToConversation(conversationId: string, event: string, data: any) {
    this.io.of('/chat').to(`conversation:${conversationId}`).emit(event, data)
  }
}
