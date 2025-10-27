import { io, Socket } from 'socket.io-client';
import NotificationService from './NotificationService';
import { AppState } from 'react-native';

interface Message {
  id: string;
  conversationId: string;
  senderType: 'customer' | 'provider' | 'system';
  senderName: string;
  message: string;
  messageType?: 'text' | 'system' | 'survey_request' | 'case_created' | 'case_template' | 'service_request';
  timestamp: string;
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

  connect(token: string, userId?: string): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log('🔌 Connecting to Socket.IO /chat namespace...');
      
      // Store userId for reference
      if (userId) {
        this.userId = userId;
      }
      
      // Connect to /chat namespace to match backend
      this.socket = io(`${this.backendUrl}/chat`, {
        auth: { token },
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

    // New message received - backend emits 'message:new'
    this.socket.on('message:new', (data: { conversationId: string; message: Message }) => {
      console.log('📨 New message received via message:new:', data);
      // Extract message from data envelope
      const message = data.message;
      this.messageCallbacks.forEach(callback => callback(message));
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
      console.log('📱 App state:', AppState.currentState);
      console.log('📱 Current conversation:', this.currentConversationId);
      console.log('📱 Message conversation:', data.conversationId);

      // Transform notification payload to Message shape
      const message: Message = {
        id: data.messageId || data.id,
        conversationId: data.conversationId,
        senderType: data.senderType,
        senderName: data.senderName,
        message: data.message,
        messageType: data.messageType,
        timestamp: data.timestamp,
        data: data.data,
        caseId: data.caseId
      };

      // Route through callbacks as a fallback (dedupe happens in UI by id)
      this.messageCallbacks.forEach(callback => callback(message));

      // Show notification only if from customer and not the active conversation or app in background
      const isAppInBackground = AppState.currentState !== 'active';
      const isDifferentConversation = message.conversationId !== this.currentConversationId;
      if ((isAppInBackground || isDifferentConversation) && message.senderType === 'customer') {
        console.log('📱 Showing notification (notification event):', message.id);
        this.notificationService.showChatNotification({
          conversationId: message.conversationId,
          senderName: data.customerName || message.senderName,
          message: message.message,
          timestamp: message.timestamp,
        });
        this.notificationService.incrementBadgeCount();
      } else {
        console.log('📱 Skipping notification for notification event - active conversation');
      }
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
