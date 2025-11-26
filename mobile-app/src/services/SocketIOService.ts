import { io, Socket } from 'socket.io-client';
import NotificationService from './NotificationService';
import { AppState } from 'react-native';

interface Message {
  id: string;
  conversationId: string;
  senderType: 'customer' | 'provider' | 'system';
  senderName: string;
  senderUserId?: string;
  message: string;
  body?: string; // Added for V2 API compatibility
  messageType?: 'text' | 'system' | 'survey_request' | 'case_created' | 'case_template' | 'service_request';
  timestamp: string;
  sentAt?: string; // Added for V2 API compatibility
  data?: any;
  caseId?: string;
}

interface Conversation {
  id: string;
  customerId: string;
  providerId: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  status: 'active' | 'closed';
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
  createdAt: string;
  updatedAt: string;
}

class SocketIOService {
  private static instance: SocketIOService;
  private socket: Socket | null = null;
  private backendUrl = 'https://maystorfix.com';
  private messageCallbacks: ((message: Message) => void)[] = [];
  private conversationCallbacks: ((conversation: Conversation) => void)[] = [];
  private typingCallbacks: ((data: { userId: string; isTyping: boolean }) => void)[] = [];
  private readCallbacks: ((data: { messageId: string }) => void)[] = [];
  private smsConfigCallbacks: ((data: any) => void)[] = [];
  private jobIncomingCallbacks: ((data: any) => void)[] = [];
  private notificationService: NotificationService;
  private currentConversationId: string | null = null;
  private userId: string | null = null;

  private constructor() {
    this.notificationService = NotificationService.getInstance();
  }

  static getInstance(): SocketIOService {
    if (!SocketIOService.instance) {
      SocketIOService.instance = new SocketIOService();
    }
    return SocketIOService.instance;
  }

  async connect(token: string, userId?: string): Promise<void> {
    return new Promise(async (resolve, reject) => {
      // Idempotency check: If already connected, don't create a new connection
      if (this.socket?.connected) {
        console.log('✅ Socket already connected, skipping new connection');
        resolve();
        return;
      }

      console.log('🔌 Connecting to Socket.IO /chat namespace...');
      
      // Clean up existing instance if it exists but isn't connected
      if (this.socket) {
        console.log('⚠️ Cleaning up existing disconnected socket instance');
        this.socket.removeAllListeners();
        this.socket.disconnect();
        this.socket = null;
      }
      
      // Initialize notification service
      try {
        await this.notificationService.initialize();
        console.log('✅ NotificationService initialized in SocketIOService');
      } catch (error) {
        console.error('⚠️ Failed to initialize NotificationService:', error);
      }
      
      // Store userId for reference
      if (userId) {
        this.userId = userId;
        console.log('👤 Stored userId for Socket.IO:', userId);
      }
      
      // Connect to /chat namespace to match backend
      // Pass userId in auth so backend can join user to their personal room
      this.socket = io(`${this.backendUrl}/chat`, {
        auth: { 
          token,
          userId: userId || this.userId // Pass userId to backend
        },
        transports: ['websocket', 'polling'],
        path: '/socket.io',
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: 5,
      });

      this.socket.on('connect', () => {
        console.log('✅ Socket.IO connected:', this.socket?.id);
        this.setupEventListeners();
        resolve();
      });

      this.socket.on('connect_error', (error) => {
        console.error('❌ Socket.IO connection error:', error);
        reject(error);
      });

      this.socket.on('disconnect', (reason) => {
        console.log('🔌 Socket.IO disconnected:', reason);
      });

      this.socket.on('reconnect', (attemptNumber) => {
        console.log('🔄 Socket.IO reconnected after', attemptNumber, 'attempts');
      });

      this.socket.on('reconnect_error', (error) => {
        console.error('❌ Socket.IO reconnection error:', error);
      });

      this.socket.on('reconnect_failed', () => {
        console.error('❌ Socket.IO reconnection failed');
      });
    });
  }

  private setupEventListeners() {
    if (!this.socket) return;

    // Remove all existing listeners to prevent duplicates
    this.socket.off('message:new');
    this.socket.off('message:updated');
    this.socket.off('message:deleted');
    this.socket.off('conversation:updated');
    this.socket.off('new_message_notification');
    this.socket.off('notification');
    this.socket.off('typing');
    this.socket.off('read');
    this.socket.off('sms_config_updated');
    this.socket.off('job:incoming');

    // New message received - backend emits 'message:new'
    this.socket.on('message:new', (data: { conversationId: string; message: Message }) => {
      console.log('📨 New message received via message:new:', data);
      // Extract message from data envelope
      const message = data.message;
      this.messageCallbacks.forEach(callback => callback(message));
      
      // Check if we need to show a notification (e.g. if app is in background)
      this.handleMessageNotification(message, 'message:new');
    });

    // Message updated - backend emits 'message:updated'
    this.socket.on('message:updated', (data: { message: Message }) => {
      console.log('✏️ Message updated via message:updated:', data);
      // Update message in callbacks
      this.messageCallbacks.forEach(callback => callback(data.message));
    });

    // Message deleted - backend emits 'message:deleted'
    this.socket.on('message:deleted', (data: { messageId: string; conversationId: string }) => {
      console.log('🗑️ Message deleted via message:deleted:', data);
      // Notify callbacks about deletion (components should handle removal)
    });

    // Conversation updated - backend emits 'conversation:updated'
    this.socket.on('conversation:updated', (data: { conversationId: string; lastMessageAt: string }) => {
      console.log('🔄 Conversation updated:', data);
      // Note: Backend only sends conversationId and lastMessageAt
      // You may need to fetch full conversation data if needed
      this.conversationCallbacks.forEach(callback => callback(data as any));
    });

    // New message notification (for messages in other conversations)
    this.socket.on('new_message_notification', (data: any) => {
      console.log('📨 New message notification received (raw):', data);
      
      // Transform notification payload to Message shape
      const message: Message = {
        id: data.id,
        conversationId: data.conversationId,
        senderType: data.senderType,
        senderName: data.senderName,
        senderUserId: data.senderUserId || data.senderId,
        message: data.message,
        messageType: data.messageType,
        timestamp: data.timestamp,
        data: data.data,
        caseId: data.caseId
      };

      // Route through callbacks as a fallback (dedupe happens in UI by id)
      this.messageCallbacks.forEach(callback => callback(message));

      // Handle notification logic
      this.handleMessageNotification(message, 'new_message_notification');
    });

    // New case assignment
    this.socket.on('case_assigned', (caseData: any) => {
      console.log('📋 New case assigned:', caseData);
      
      // Show notification for new case assignment
      this.notificationService.showCaseNotification({
        caseId: caseData.id,
        customerName: caseData.customerName || 'New Customer',
        serviceType: caseData.serviceType || 'Service Request',
        description: caseData.description || 'New case has been assigned to you',
        priority: caseData.priority || 'medium',
      });
      this.notificationService.incrementBadgeCount();
    });

    // SMS config updated (real-time sync with marketplace)
    this.socket.on('sms-config-updated', (data: any) => {
      console.log('📱 SMS config updated via Socket.IO:', data);
      this.smsConfigCallbacks.forEach(callback => callback(data));
    });

    // Typing indicator - matches web app event name
    this.socket.on('typing', (data: { conversationId: string; userId: string; userName: string; isTyping: boolean }) => {
      console.log('⌨️ Typing indicator:', data);
      this.typingCallbacks.forEach(callback => callback(data));
    });

    // Presence updates - online/offline status
    this.socket.on('presence', (data: { userId: string; status: 'online' | 'offline' | 'away' }) => {
      console.log('👤 Presence update:', data);
      // Can be used to show online/offline status in UI
    });

    // Message read
    this.socket.on('message_read', (data: { messageId: string }) => {
      console.log('✅ Message read:', data);
      this.readCallbacks.forEach(callback => callback(data));
    });

    // Instant Job Alert (Uber-like modal)
    this.socket.on('job:incoming', (data: any) => {
      console.log('🔔 Instant Job Alert received:', data);
      this.jobIncomingCallbacks.forEach(callback => callback(data));
    });
  }

  private handleMessageNotification(message: Message, source: string) {
    // Show notification if app in background or viewing different conversation
    // Don't show for own messages (check userId)
    const isAppInBackground = AppState.currentState !== 'active';
    const isDifferentConversation = message.conversationId !== this.currentConversationId;
    
    // Robust check for own message (handle string/number types)
    const isOwnMessage = String(message.senderUserId) === String(this.userId);
    
    // NOTE: Normally we filter out own messages (!isOwnMessage).
    // However, for testing purposes (or if user messages themselves from another device),
    // we allow the notification to trigger if the app is in background.
    const shouldShowNotification = isAppInBackground || isDifferentConversation;

    if (isOwnMessage && shouldShowNotification) {
      console.log('⚠️ Notification triggered for own message (allowed for testing)');
    }

    console.log(`📱 Notification check [${source}]:`, {
      isAppInBackground,
      isDifferentConversation,
      isOwnMessage,
      shouldShowNotification,
      senderType: message.senderType,
      appState: AppState.currentState,
      currentConversationId: this.currentConversationId,
      msgConversationId: message.conversationId,
      myUserId: this.userId,
      msgSenderId: message.senderUserId,
      decision: shouldShowNotification ? 'SHOW' : 'SKIP'
    });
    
    if (shouldShowNotification) {
      // If it's our own message, append (Me) to clearer debugging
      const displayName = isOwnMessage ? `${message.senderName} (Me)` : (message.senderName || 'New Message');
      
      console.log('📱 Showing notification for message:', message.id);
      this.notificationService.showChatNotification({
        conversationId: message.conversationId,
        senderName: displayName,
        message: message.message || message.body || 'New message received',
        timestamp: message.timestamp || message.sentAt || new Date().toISOString(),
      });
      this.notificationService.incrementBadgeCount();
    } else {
      console.log(`📱 Skipping notification for ${source}. Reason: App is active and in same conversation`);
    }
  }

  joinConversation(conversationId: string) {
    if (!this.socket) {
      console.error('❌ Socket not connected - cannot join conversation');
      return;
    }
    if (!this.socket.connected) {
      console.error('❌ Socket exists but not connected - cannot join conversation');
      return;
    }
    console.log('🚪 Joining conversation:', conversationId);
    console.log('🔌 Socket ID:', this.socket.id);
    console.log('🔌 Socket connected:', this.socket.connected);
    
    // Track current conversation to prevent notifications for active chat
    this.currentConversationId = conversationId;
    
    // Backend expects 'join-conversation' with hyphen, not underscore
    this.socket.emit('join-conversation', conversationId);
  }

  leaveConversation(conversationId: string) {
    if (!this.socket) return;
    console.log('🚺 Leaving conversation:', conversationId);
    
    // Clear current conversation tracking
    if (this.currentConversationId === conversationId) {
      this.currentConversationId = null;
    }
    
    // Emit leave-conversation to match web app
    if (this.socket.connected) {
      this.socket.emit('leave-conversation', conversationId);
      console.log('✅ Emitted leave-conversation for:', conversationId);
    }
  }

  sendMessage(
    conversationId: string,
    message: string,
    senderType: 'customer' | 'provider' | 'system',
    senderName: string,
    messageType: string = 'text'
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new Error('Socket not connected'));
        return;
      }

      console.log('📤 Sending message via message:send:', { conversationId, message, senderType });

      // Backend expects 'message:send' event with { conversationId, type, body }
      this.socket.emit(
        'message:send',
        {
          conversationId,
          type: messageType,
          body: message,
        }
      );
      
      // Socket-only messaging: no callback, message will arrive via message:new event
      console.log('✅ Message sent via socket, waiting for confirmation via message:new');
      resolve();
    });
  }

  markAsRead(conversationId: string, messageId: string) {
    if (!this.socket) return;
    console.log('✅ Marking message as read:', messageId);
    this.socket.emit('mark_read', { conversationId, messageId });
  }

  sendTypingIndicator(conversationId: string, isTyping: boolean) {
    if (!this.socket) return;
    this.socket.emit('typing', { conversationId, isTyping });
  }

  // Event listeners
  onNewMessage(callback: (message: Message) => void) {
    this.messageCallbacks.push(callback);
    return () => {
      this.messageCallbacks = this.messageCallbacks.filter(cb => cb !== callback);
    };
  }

  onConversationUpdate(callback: (conversation: Conversation) => void) {
    this.conversationCallbacks.push(callback);
    return () => {
      this.conversationCallbacks = this.conversationCallbacks.filter(cb => cb !== callback);
    };
  }

  onUserTyping(callback: (data: { userId: string; isTyping: boolean }) => void) {
    this.typingCallbacks.push(callback);
    return () => {
      this.typingCallbacks = this.typingCallbacks.filter(cb => cb !== callback);
    };
  }

  onMessageRead(callback: (data: { messageId: string }) => void) {
    this.readCallbacks.push(callback);
    return () => {
      this.readCallbacks = this.readCallbacks.filter(cb => cb !== callback);
    };
  }

  onSMSConfigUpdate(callback: (data: any) => void) {
    this.smsConfigCallbacks.push(callback);
    return () => {
      this.smsConfigCallbacks = this.smsConfigCallbacks.filter(cb => cb !== callback);
    };
  }

  onJobIncoming(callback: (data: any) => void) {
    this.jobIncomingCallbacks.push(callback);
    return () => {
      this.jobIncomingCallbacks = this.jobIncomingCallbacks.filter(cb => cb !== callback);
    };
  }

  // Allow triggering the alert locally (e.g. from a push notification tap)
  triggerLocalJobAlert(data: any) {
    console.log('🔔 Triggering local job alert:', data);
    this.jobIncomingCallbacks.forEach(callback => callback(data));
  }

  disconnect() {
    if (this.socket) {
      console.log('🔌 Disconnecting Socket.IO...');
      this.socket.disconnect();
      this.socket = null;
    }
  }

  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  getSocket(): Socket | null {
    return this.socket;
  }
}

export { SocketIOService };
export default SocketIOService;
