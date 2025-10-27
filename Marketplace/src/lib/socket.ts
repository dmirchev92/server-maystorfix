import { io, Socket } from 'socket.io-client'

// Check if we're in browser environment
const isBrowser = typeof window !== 'undefined'

class MarketplaceSocketService {
  private socket: Socket | null = null
  private isConnected: boolean = false
  private reconnectAttempts: number = 0
  private maxReconnectAttempts: number = 5
  private reconnectDelay: number = 1000

  constructor() {
    if (isBrowser) {
      this.connect()
    }
  }

  private connect(): void {
    if (!isBrowser) {
      console.warn('⚠️ Socket connection attempted on server side, skipping')
      return
    }
    
    if (this.socket?.connected) {
      return
    }

    // Get the base URL for WebSocket connection
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://maystorfix.com/api/v1'
    const socketUrl = apiUrl.replace('/api/v1', '')
    
    console.log('🔌 Connecting to WebSocket server:', socketUrl)

    this.socket = io(socketUrl, {
      transports: ['websocket', 'polling'],
      timeout: 10000,
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: this.reconnectDelay
    })

    this.socket.on('connect', () => {
      console.log('✅ Connected to ServiceText Pro WebSocket server')
      this.isConnected = true
      this.reconnectAttempts = 0
    })

    this.socket.on('disconnect', (reason) => {
      console.log('❌ Disconnected from WebSocket server:', reason)
      this.isConnected = false
      
      if (reason === 'io server disconnect') {
        // Server initiated disconnect, reconnect manually
        this.reconnect()
      }
    })

    this.socket.on('connect_error', (error) => {
      console.error('❌ WebSocket connection error:', error)
      this.isConnected = false
      this.reconnect()
    })

    this.socket.on('reconnect', (attemptNumber) => {
      console.log('🔄 Reconnected to WebSocket server after', attemptNumber, 'attempts')
      this.isConnected = true
      this.reconnectAttempts = 0
    })

    this.socket.on('reconnect_error', (error) => {
      console.error('❌ WebSocket reconnection error:', error)
      this.reconnectAttempts++
    })

    this.socket.on('reconnect_failed', () => {
      console.error('❌ Failed to reconnect to WebSocket server after', this.maxReconnectAttempts, 'attempts')
      this.isConnected = false
    })
  }

  private reconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('❌ Max reconnection attempts reached')
      return
    }

    this.reconnectAttempts++
    console.log(`🔄 Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`)
    
    setTimeout(() => {
      this.connect()
    }, this.reconnectDelay * this.reconnectAttempts)
  }

  /**
   * Listen for provider profile updates
   */
  public onProviderProfileUpdated(callback: (data: {
    type: 'profile_update'
    providerId: string
    provider: any
    timestamp: string
  }) => void): void {
    if (!isBrowser) {
      console.warn('⚠️ Socket events not available on server side')
      return
    }
    
    if (!this.socket) {
      console.warn('⚠️ Socket not initialized, cannot listen for provider updates')
      return
    }

    this.socket.on('provider_profile_updated', (data) => {
      console.log('📡 Received provider profile update:', data.providerId)
      callback(data)
    })
  }

  /**
   * Remove provider profile update listener
   */
  public offProviderProfileUpdated(): void {
    if (this.socket) {
      this.socket.off('provider_profile_updated')
    }
  }

  /**
   * Listen for new provider registrations
   */
  public onNewProviderRegistered(callback: (data: {
    type: 'new_provider'
    providerId: string
    provider: any
    timestamp: string
  }) => void): void {
    if (!this.socket) {
      console.warn('⚠️ Socket not initialized, cannot listen for new providers')
      return
    }

    this.socket.on('new_provider_registered', (data) => {
      console.log('📡 Received new provider registration:', data.providerId)
      callback(data)
    })
  }

  /**
   * Remove new provider registration listener
   */
  public offNewProviderRegistered(): void {
    if (this.socket) {
      this.socket.off('new_provider_registered')
    }
  }

  /**
   * Join a room for location-specific updates
   */
  public joinLocationRoom(city: string, neighborhood?: string): void {
    if (!this.socket || !this.isConnected) {
      console.warn('⚠️ Socket not connected, cannot join location room')
      return
    }

    const roomName = neighborhood ? `${city}-${neighborhood}` : city
    console.log('🏠 Joining location room:', roomName)
    this.socket.emit('join_location_room', roomName)
  }

  /**
   * Leave a location room
   */
  public leaveLocationRoom(city: string, neighborhood?: string): void {
    if (!this.socket || !this.isConnected) {
      return
    }

    const roomName = neighborhood ? `${city}-${neighborhood}` : city
    console.log('🚪 Leaving location room:', roomName)
    this.socket.emit('leave_location_room', roomName)
  }

  /**
   * Join a room for category-specific updates
   */
  public joinCategoryRoom(category: string): void {
    if (!this.socket || !this.isConnected) {
      console.warn('⚠️ Socket not connected, cannot join category room')
      return
    }

    console.log('📂 Joining category room:', category)
    this.socket.emit('join_category_room', category)
  }

  /**
   * Leave a category room
   */
  public leaveCategoryRoom(category: string): void {
    if (!this.socket || !this.isConnected) {
      return
    }

    console.log('📂 Leaving category room:', category)
    this.socket.emit('leave_category_room', category)
  }

  /**
   * Listen for new message notifications
   */
  public onNewMessageNotification(callback: (data: {
    messageId: string
    conversationId: string
    senderType: string
    senderName: string
    message: string
    customerName: string
    customerEmail: string
    timestamp: string
  }) => void): void {
    if (!this.socket) {
      console.warn('⚠️ Socket not initialized, cannot listen for message notifications')
      return
    }

    this.socket.on('new_message_notification', (data) => {
      console.log('📡 Received new message notification:', data)
      callback(data)
    })
  }

  /**
   * Listen for new messages in conversation
   */
  public onNewMessage(callback: (data: {
    messageId: string
    conversationId: string
    senderType: string
    senderName: string
    message: string
    messageType: string
    timestamp: string
  }) => void): void {
    if (!this.socket) {
      console.warn('⚠️ Socket not initialized, cannot listen for new messages')
      return
    }

    this.socket.on('new_message', (data) => {
      console.log('📡 Received new message:', data)
      callback(data)
    })
  }

  /**
   * Join user room for notifications
   */
  public joinUserRoom(userId: string): void {
    if (!this.socket || !this.isConnected) {
      console.warn('⚠️ Socket not connected, cannot join user room')
      return
    }

    console.log('👤 Joining user room:', userId)
    this.socket.emit('join-user-room', userId)
  }

  /**
   * Authenticate with WebSocket server
   */
  public authenticate(token: string, userId: string): void {
    if (!this.socket) {
      console.warn('⚠️ Socket not initialized, cannot authenticate')
      return
    }

    console.log('🔐 Authenticating WebSocket connection')
    this.socket.emit('authenticate', { token, userId })
  }

  /**
   * Join a conversation room for real-time updates
   */
  public joinConversation(conversationId: string): void {
    if (!this.socket || !this.isConnected) {
      console.warn('⚠️ Socket not connected, cannot join conversation')
      return
    }

    console.log('💬 Joining conversation room:', conversationId)
    this.socket.emit('join-conversation', conversationId)
  }

  /**
   * Remove specific event listeners
   */
  public removeListener(event: string, listener: Function): void {
    if (this.socket) {
      this.socket.off(event, listener as any)
    }
  }

  /**
   * Get connection status
   */
  public getConnectionStatus(): boolean {
    if (!isBrowser) {
      return false
    }
    return this.isConnected && this.socket?.connected === true
  }

  /**
   * Manually disconnect
   */
  public disconnect(): void {
    if (this.socket) {
      console.log('🔌 Manually disconnecting from WebSocket server')
      this.socket.disconnect()
      this.isConnected = false
    }
  }

  /**
   * Manually reconnect
   */
  public forceReconnect(): void {
    this.disconnect()
    setTimeout(() => {
      this.connect()
    }, 1000)
  }
}

// Create singleton instance only in browser
let marketplaceSocketInstance: MarketplaceSocketService | null = null

export const getMarketplaceSocket = (): MarketplaceSocketService | null => {
  if (!isBrowser) {
    return null
  }
  
  if (!marketplaceSocketInstance) {
    marketplaceSocketInstance = new MarketplaceSocketService()
  }
  
  return marketplaceSocketInstance
}

// Export singleton instance and class
export const marketplaceSocket = isBrowser ? getMarketplaceSocket() : null
export { MarketplaceSocketService }
export default marketplaceSocket
