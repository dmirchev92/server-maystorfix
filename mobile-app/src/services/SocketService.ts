import { io, Socket } from 'socket.io-client';

// API Configuration
const API_BASE_URL = 'https://maystorfix.com/api/v1';

interface NewMessageNotification {
  messageId: string;
  conversationId: string;
  senderType: string;
  senderName: string;
  message: string;
  customerName: string;
  customerEmail: string;
  timestamp: string;
}

interface NewCaseNotification {
  caseId: string;
  serviceType: string;
  description: string;
  customerName: string;
  assignmentType: string;
  timestamp: string;
}

class SocketService {
  private static instance: SocketService;
  private socket: Socket | null = null;
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectDelay: number = 1000;
  private userId: string | null = null;

  private constructor() {
    // Private constructor for singleton
  }

  public static getInstance(): SocketService {
    if (!SocketService.instance) {
      SocketService.instance = new SocketService();
    }
    return SocketService.instance;
  }

  /**
   * Connect to WebSocket server
   */
  public connect(userId: string, token?: string): void {
    if (this.socket?.connected) {
      console.log('🔌 Socket already connected');
      return;
    }

    this.userId = userId;

    // Get the base URL for WebSocket connection
    const socketUrl = API_BASE_URL.replace('/api/v1', '');
    
    console.log('🔌 Connecting to WebSocket server:', socketUrl);
    console.log('👤 User ID:', userId);

    this.socket = io(socketUrl, {
      transports: ['websocket', 'polling'],
      timeout: 10000,
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: this.reconnectDelay,
      auth: token ? { token } : undefined,
    });

    this.setupEventListeners();
  }

  /**
   * Setup socket event listeners
   */
  private setupEventListeners(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('✅ Connected to ServiceText Pro WebSocket server');
      this.isConnected = true;
      this.reconnectAttempts = 0;

      // Join user room for notifications
      if (this.userId) {
        this.joinUserRoom(this.userId);
      }
    });

    this.socket.on('disconnect', (reason) => {
      console.log('❌ Disconnected from WebSocket server:', reason);
      this.isConnected = false;
      
      if (reason === 'io server disconnect') {
        // Server initiated disconnect, reconnect manually
        this.reconnect();
      }
    });

    this.socket.on('connect_error', (error) => {
      console.error('❌ WebSocket connection error:', error);
      this.isConnected = false;
      this.reconnect();
    });

    this.socket.on('reconnect', (attemptNumber) => {
      console.log('🔄 Reconnected to WebSocket server after', attemptNumber, 'attempts');
      this.isConnected = true;
      this.reconnectAttempts = 0;
    });

    this.socket.on('reconnect_error', (error) => {
      console.error('❌ WebSocket reconnection error:', error);
      this.reconnectAttempts++;
    });

    this.socket.on('reconnect_failed', () => {
      console.error('❌ Failed to reconnect to WebSocket server after', this.maxReconnectAttempts, 'attempts');
      this.isConnected = false;
    });
  }

  /**
   * Reconnect to server
   */
  private reconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('❌ Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    console.log(`🔄 Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
    
    setTimeout(() => {
      if (this.userId) {
        this.connect(this.userId);
      }
    }, this.reconnectDelay * this.reconnectAttempts);
  }

  /**
   * Join user room for notifications
   */
  public joinUserRoom(userId: string): void {
    if (!this.socket || !this.isConnected) {
      console.warn('⚠️ Socket not connected, cannot join user room');
      return;
    }

    console.log('👤 Joining user room:', userId);
    this.socket.emit('join-user-room', userId);
  }

  /**
   * Join a conversation room for real-time chat updates
   */
  public joinConversation(conversationId: string): void {
    if (!this.socket || !this.isConnected) {
      console.warn('⚠️ Socket not connected, cannot join conversation');
      return;
    }

    console.log('💬 Joining conversation room:', conversationId);
    this.socket.emit('join-conversation', conversationId);
  }

  /**
   * Leave a conversation room
   */
  public leaveConversation(conversationId: string): void {
    if (!this.socket || !this.isConnected) {
      return;
    }

    console.log('💬 Leaving conversation room:', conversationId);
    this.socket.emit('leave-conversation', conversationId);
  }

  /**
   * Listen for new message notifications
   */
  public onNewMessageNotification(callback: (data: NewMessageNotification) => void): void {
    if (!this.socket) {
      console.warn('⚠️ Socket not initialized, cannot listen for message notifications');
      return;
    }

    console.log('📡 Listening for new message notifications');
    this.socket.on('new_message_notification', (data) => {
      console.log('📨 Received new message notification:', data);
      callback(data);
    });
  }

  /**
   * Listen for new messages in conversation
   */
  public onNewMessage(callback: (data: any) => void): void {
    if (!this.socket) {
      console.warn('⚠️ Socket not initialized, cannot listen for new messages');
      return;
    }

    console.log('📡 Listening for new messages');
    this.socket.on('new_message', (data) => {
      console.log('💬 Received new message:', data);
      callback(data);
    });
  }

  /**
   * Listen for new case notifications (when someone creates a case for you)
   */
  public onNewCaseNotification(callback: (data: NewCaseNotification) => void): void {
    if (!this.socket) {
      console.warn('⚠️ Socket not initialized, cannot listen for case notifications');
      return;
    }

    console.log('📡 Listening for new case notifications');
    this.socket.on('new_case_notification', (data) => {
      console.log('📋 Received new case notification:', data);
      callback(data);
    });
  }

  /**
   * Listen for case assignment notifications (direct assignments)
   */
  public onCaseAssigned(callback: (data: any) => void): void {
    if (!this.socket) {
      console.warn('⚠️ Socket not initialized, cannot listen for case assignments');
      return;
    }

    console.log('📡 Listening for case assignments');
    this.socket.on('case_assigned', (data) => {
      console.log('🎯 Received case assignment:', data);
      callback(data);
    });
  }

  /**
   * Listen for case status updates
   */
  public onCaseStatusUpdate(callback: (data: any) => void): void {
    if (!this.socket) {
      console.warn('⚠️ Socket not initialized, cannot listen for case status updates');
      return;
    }

    console.log('📡 Listening for case status updates');
    this.socket.on('case_status_update', (data) => {
      console.log('🔄 Received case status update:', data);
      callback(data);
    });
  }

  /**
   * Remove specific event listener
   */
  public removeListener(event: string): void {
    if (this.socket) {
      console.log('🔇 Removing listener for:', event);
      this.socket.off(event);
    }
  }

  /**
   * Remove all event listeners
   */
  public removeAllListeners(): void {
    if (this.socket) {
      console.log('🔇 Removing all listeners');
      this.socket.removeAllListeners();
    }
  }

  /**
   * Get connection status
   */
  public getConnectionStatus(): boolean {
    return this.isConnected && this.socket?.connected === true;
  }

  /**
   * Disconnect from server
   */
  public disconnect(): void {
    if (this.socket) {
      console.log('🔌 Disconnecting from WebSocket server');
      this.socket.disconnect();
      this.isConnected = false;
      this.userId = null;
    }
  }

  /**
   * Force reconnect
   */
  public forceReconnect(): void {
    this.disconnect();
    setTimeout(() => {
      if (this.userId) {
        this.connect(this.userId);
      }
    }, 1000);
  }
}

export default SocketService;
