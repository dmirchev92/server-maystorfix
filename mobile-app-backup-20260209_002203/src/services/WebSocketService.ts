import { Logger } from '../utils/Logger';
import { NativeEventEmitter, NativeModules } from 'react-native';
import { io, Socket } from 'socket.io-client';

interface WebSocketMessage {
  type: string;
  data: any;
  timestamp: number;
  messageId?: string;
}

interface CallEventData {
  phoneNumber: string;
  contactName?: string;
  timestamp: number;
  formattedTime: string;
  source: 'native_detection' | 'manual' | 'api';
}

interface ConversationUpdate {
  conversationId: string;
  status: 'ai_active' | 'ivan_taken_over' | 'closed' | 'handoff_requested';
  lastActivity: string;
  newMessage?: {
    id: string;
    text: string;
    sender: 'customer' | 'ai' | 'ivan';
    timestamp: string;
  };
}

interface AIResponseData {
  conversationId: string;
  response: string;
  confidence: number;
  platform: 'viber' | 'whatsapp' | 'telegram';
  metadata?: any;
}

class WebSocketService {
  private static instance: WebSocketService;
  private ws: WebSocket | null = null;
  private isConnected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectInterval = 5000; // 5 seconds
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private messageQueue: WebSocketMessage[] = [];
  
  // Event listeners
  private listeners: Map<string, Array<(data: any) => void>> = new Map();
  
  // Backend configuration
  private backendUrl = 'wss://snapfix.bg'; // Production WebSocket URL
  private apiBaseUrl = 'https://snapfix.bg/api'; // Production API URL

  private constructor() {
    this.setupEventListeners();
  }

  public static getInstance(): WebSocketService {
    if (!WebSocketService.instance) {
      WebSocketService.instance = new WebSocketService();
    }
    return WebSocketService.instance;
  }

  /**
   * Setup event listeners - simplified version without native detection
   */
  private setupEventListeners(): void {
    // No native call detection listeners needed
    Logger.debug('WebSocket event listeners set up (no native detection)');
  }

  /**
   * Connect to WebSocket server
   */
  public async connect(): Promise<boolean> {
    try {
      if (this.isConnected) {
        Logger.debug('WebSocket already connected');
        return true;
      }

      Logger.debug('Connecting to WebSocket server...');
      
      this.ws = new WebSocket(this.backendUrl) as any;
      
      if (this.ws) {
        this.ws.onopen = () => {
        Logger.debug('WebSocket connected successfully');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.startHeartbeat();
        this.processMessageQueue();
        this.emit('connected', { timestamp: Date.now() });
      };

        this.ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          this.handleMessage(message);
        } catch (error) {
          Logger.error('Error parsing WebSocket message:', error);
        }
      };

        this.ws.onclose = (event) => {
        Logger.debug('WebSocket connection closed:', event.code, event.reason);
        this.isConnected = false;
        this.stopHeartbeat();
        this.emit('disconnected', { 
          code: event.code, 
          reason: event.reason, 
          timestamp: Date.now() 
        });
        
        // Attempt to reconnect
        this.attemptReconnect();
      };

        this.ws.onerror = (error) => {
        Logger.error('WebSocket error:', error);
        this.emit('error', { error, timestamp: Date.now() });
      };
      }

      return true;
    } catch (error) {
      Logger.error('Error connecting to WebSocket:', error);
      return false;
    }
  }

  /**
   * Disconnect from WebSocket server
   */
  public disconnect(): void {
    if (this.ws) {
      this.stopHeartbeat();
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
    this.messageQueue = [];
  }

  /**
   * Send message to WebSocket server
   */
  public sendMessage(type: string, data: any): boolean {
    const message: WebSocketMessage = {
      type,
      data,
      timestamp: Date.now(),
      messageId: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };

    if (this.isConnected && this.ws) {
      try {
        this.ws.send(JSON.stringify(message));
        Logger.debug('WebSocket message sent:', type);
        return true;
      } catch (error) {
        Logger.error('Error sending WebSocket message:', error);
        this.messageQueue.push(message);
        return false;
      }
    } else {
      Logger.debug('WebSocket not connected, queuing message:', type);
      this.messageQueue.push(message);
      return false;
    }
  }

  /**
   * Handle missed call event from native module
   */
  private async handleMissedCallEvent(event: any): Promise<void> {
    try {
      Logger.debug('Processing missed call event:', event);

      const callEventData: CallEventData = {
        phoneNumber: event.phoneNumber,
        contactName: event.contactName || '',
        timestamp: event.timestamp,
        formattedTime: event.formattedTime,
        source: 'native_detection',
      };

      // Send to backend via WebSocket
      this.sendMessage('missed_call_detected', callEventData);

      // Also send via HTTP API as backup
      await this.sendMissedCallToAPI(callEventData);

    } catch (error) {
      Logger.error('Error handling missed call event:', error);
    }
  }

  /**
   * Send missed call to backend API
   */
  private async sendMissedCallToAPI(callEventData: CallEventData): Promise<void> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/calls/missed`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getAuthToken()}`,
        },
        body: JSON.stringify(callEventData),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      Logger.debug('Missed call sent to API:', result);
    } catch (error) {
      Logger.error('Error sending missed call to API:', error);
    }
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleMessage(message: WebSocketMessage): void {
    Logger.debug('WebSocket message received:', message.type);

    switch (message.type) {
      case 'ai_response_generated':
        this.handleAIResponse(message.data);
        break;
      case 'conversation_updated':
        this.handleConversationUpdate(message.data);
        break;
      case 'handoff_requested':
        this.handleHandoffRequest(message.data);
        break;
      case 'message_delivered':
        this.handleMessageDelivery(message.data);
        break;
      case 'new_message_notification':
        this.handleNewMessageNotification(message.data);
        break;
      case 'new_message':
        this.handleNewMessage(message.data);
        break;
      case 'pong':
        // Heartbeat response
        break;
      default:
        Logger.debug('Unknown message type:', message.type);
    }

    // Emit to listeners
    this.emit(message.type, message.data);
  }

  /**
   * Handle AI response from backend
   */
  private handleAIResponse(data: AIResponseData): void {
    Logger.debug('AI response received:', data);
    this.emit('ai_response', data);
  }

  /**
   * Handle conversation update from backend
   */
  private handleConversationUpdate(data: ConversationUpdate): void {
    Logger.debug('Conversation update received:', data);
    this.emit('conversation_update', data);
  }

  /**
   * Handle handoff request from backend
   */
  private handleHandoffRequest(data: any): void {
    Logger.debug('Handoff request received:', data);
    this.emit('handoff_request', data);
  }

  /**
   * Handle message delivery status
   */
  private handleMessageDelivery(data: any): void {
    Logger.debug('Message delivery status:', data);
    this.emit('message_delivery', data);
  }

  /**
   * Handle new message notification from marketplace
   */
  private handleNewMessageNotification(data: any): void {
    Logger.debug('📱 New message notification received:', data);
    this.emit('new_message_notification', data);
  }

  /**
   * Handle new message in conversation
   */
  private handleNewMessage(data: any): void {
    Logger.debug('📱 New message received:', data);
    this.emit('new_message', data);
  }

  /**
   * Start heartbeat to keep connection alive
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      if (this.isConnected) {
        this.sendMessage('ping', { timestamp: Date.now() });
      }
    }, 30000); // Send ping every 30 seconds
  }

  /**
   * Stop heartbeat
   */
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Process queued messages
   */
  private processMessageQueue(): void {
    while (this.messageQueue.length > 0 && this.isConnected) {
      const message = this.messageQueue.shift();
      if (message) {
        this.sendMessage(message.type, message.data);
      }
    }
  }

  /**
   * Attempt to reconnect to WebSocket
   */
  private attemptReconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      Logger.debug(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
      
      setTimeout(() => {
        this.connect();
      }, this.reconnectInterval);
    } else {
      Logger.error('Max reconnection attempts reached');
      this.emit('reconnect_failed', { attempts: this.reconnectAttempts });
    }
  }

  /**
   * Add event listener
   */
  public on(event: string, listener: (data: any) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(listener);
  }

  /**
   * Remove event listener
   */
  public off(event: string, listener: (data: any) => void): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      const index = eventListeners.indexOf(listener);
      if (index > -1) {
        eventListeners.splice(index, 1);
      }
    }
  }

  /**
   * Emit event to listeners
   */
  private emit(event: string, data: any): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.forEach(listener => {
        try {
          listener(data);
        } catch (error) {
          Logger.error('Error in event listener:', error);
        }
      });
    }
  }

  /**
   * Authenticate with WebSocket server
   */
  public authenticate(token: string, userId: string): void {
    if (this.isConnected) {
      this.sendMessage('authenticate', { token, userId });
      Logger.debug('🔐 Mobile app WebSocket authentication sent');
    } else {
      Logger.warn('⚠️ Cannot authenticate - WebSocket not connected');
    }
  }

  /**
   * Join user room for notifications
   */
  public joinUserRoom(userId: string): void {
    if (this.isConnected) {
      this.sendMessage('join-user-room', userId);
      Logger.debug('👤 Mobile app joined user room:', userId);
    } else {
      Logger.warn('⚠️ Cannot join user room - WebSocket not connected');
    }
  }

  /**
   * Join conversation room for real-time updates
   */
  public joinConversation(conversationId: string): void {
    if (this.isConnected) {
      this.sendMessage('join-conversation', conversationId);
      Logger.debug('💬 Mobile app joined conversation room:', conversationId);
    } else {
      Logger.warn('⚠️ Cannot join conversation - WebSocket not connected');
    }
  }

  /**
   * Get authentication token
   */
  private getAuthToken(): string {
    // TODO: Get actual auth token from storage
    return 'mock_token';
  }

  /**
   * Check if WebSocket is connected
   */
  public isWebSocketConnected(): boolean {
    return this.isConnected;
  }

  /**
   * Get connection status
   */
  public getConnectionStatus(): {
    connected: boolean;
    reconnectAttempts: number;
    queuedMessages: number;
  } {
    return {
      connected: this.isConnected,
      reconnectAttempts: this.reconnectAttempts,
      queuedMessages: this.messageQueue.length,
    };
  }
}

export default WebSocketService;
