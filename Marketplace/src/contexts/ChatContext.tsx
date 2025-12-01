/**
 * ChatContext - Global Chat State Management
 * Handles conversations, messages, socket connections
 * Professional implementation with proper typing
 */

'use client'

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { Socket } from 'socket.io-client'
import { ChatApi, Conversation, Message } from '@/lib/chatApi'
import { useAuth } from './AuthContext'
import { useSocket } from './SocketContext'

interface ChatContextType {
  // State
  conversations: Conversation[]
  activeConversationId: string | null
  messages: Record<string, Message[]> // conversationId -> messages
  loading: boolean
  connected: boolean

  // Actions
  setActiveConversation: (conversationId: string | null) => void
  loadConversations: () => Promise<void>
  loadMessages: (conversationId: string) => Promise<void>
  sendMessage: (conversationId: string, body: string, type?: Message['type']) => Promise<void>
  markAsRead: (conversationId: string) => Promise<void>
  
  // Socket
  socket: Socket | null
}

const ChatContext = createContext<ChatContextType | undefined>(undefined)

export function ChatProvider({ 
  children,
  initialConversationId 
}: { 
  children: React.ReactNode
  initialConversationId?: string
}) {
  const { user, isAuthenticated } = useAuth()
  const { socket: globalSocket, isConnected } = useSocket() // Use global socket from SocketProvider
  
  // State
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeConversationId, setActiveConversationId] = useState<string | null>(initialConversationId || null)
  const [messages, setMessages] = useState<Record<string, Message[]>>({})
  const [loading, setLoading] = useState(false)
  const [connected, setConnected] = useState(isConnected)
  
  // Socket ref - use global socket
  const socketRef = useRef<Socket | null>(globalSocket)

  // Update socket ref and connected state when global socket changes
  useEffect(() => {
    socketRef.current = globalSocket
    setConnected(isConnected)
  }, [globalSocket, isConnected])

  // ==================== SOCKET EVENT LISTENERS ====================

  useEffect(() => {
    if (!globalSocket || !isAuthenticated) {
      console.log('⏸️ ChatContext - Waiting for socket and authentication')
      return
    }

    console.log('✅ ChatContext - Setting up socket event listeners')
    const socket = globalSocket

    // Listen for new messages
    socket.on('message:new', (data: { conversationId: string; message: Message }) => {
      console.log('📨 New message received via message:new:', data)
      console.log('📨 Message details:', {
        conversationId: data.conversationId,
        messageId: data.message?.id,
        senderUserId: data.message?.senderUserId,
        currentUserId: user?.id,
        body: data.message?.body?.substring(0, 50)
      })
      
      setMessages(prev => {
        const existingMessages = prev[data.conversationId] || []
        
        // Check if message already exists
        const messageExists = existingMessages.some(msg => msg.id === data.message.id)
        
        if (messageExists) {
          console.log('⚠️ Message already exists, skipping:', data.message.id)
          return prev
        }
        
        console.log('✅ Adding new message from socket:', data.message.id)
        return {
          ...prev,
          [data.conversationId]: [...existingMessages, data.message]
        }
      })

      // Update conversation last message
      setConversations(prev =>
        prev.map(conv =>
          conv.id === data.conversationId
            ? { ...conv, lastMessage: data.message, lastMessageAt: data.message.sentAt }
            : conv
        )
      )
    })

    // Listen for message updates
    socket.on('message:updated', (data: { message: Message }) => {
      console.log('✏️ Message updated:', data)
      
      setMessages(prev => ({
        ...prev,
        [data.message.conversationId]: (prev[data.message.conversationId] || []).map(msg =>
          msg.id === data.message.id ? data.message : msg
        )
      }))
    })

    // Listen for message deletions
    socket.on('message:deleted', (data: { messageId: string }) => {
      console.log('🗑️ Message deleted:', data)
      
      // Remove message from all conversations
      setMessages(prev => {
        const updated = { ...prev }
        Object.keys(updated).forEach(convId => {
          updated[convId] = updated[convId].filter(msg => msg.id !== data.messageId)
        })
        return updated
      })
    })

    // Listen for typing indicators
    socket.on('typing', (data: { conversationId: string; userId: string; userName: string; isTyping: boolean }) => {
      console.log('⌨️ Typing indicator:', data)
      // Handle typing indicator in UI (can be implemented in components)
    })

    // Listen for presence updates
    socket.on('presence', (data: { userId: string; status: 'online' | 'offline' | 'away' }) => {
      console.log('👤 Presence update:', data)
      // Handle presence in UI (can be implemented in components)
    })

    // Listen for conversation updates (includes unread count changes)
    socket.on('conversation:updated', (data: { conversationId: string; lastMessageAt?: string; lastMessage?: string; unreadCount?: number }) => {
      console.log('🔄 Conversation updated:', data)
      
      setConversations(prev =>
        prev.map(conv => {
          if (conv.id !== data.conversationId) return conv
          
          // Build updates object - only update fields that are provided
          const updates: { lastMessageAt?: string; unreadCount?: number } = {}
          if (data.lastMessageAt !== undefined) updates.lastMessageAt = data.lastMessageAt
          if (data.unreadCount !== undefined) updates.unreadCount = data.unreadCount
          // Note: lastMessage from socket is a string, but the type expects Message object
          // The full message is handled by message:new event, so we skip lastMessage here
          
          return { ...conv, ...updates }
        })
      )
    })

    // Cleanup event listeners only when socket actually changes
    return () => {
      console.log('🧹 ChatContext - Cleaning up event listeners')
      socket.off('message:new')
      socket.off('message:updated')
      socket.off('message:deleted')
      socket.off('typing')
      socket.off('presence')
      socket.off('conversation:updated')
    }
  }, [globalSocket?.id]) // Only re-run if socket ID changes (actual reconnection)

  // ==================== JOIN/LEAVE CONVERSATION ====================

  useEffect(() => {
    if (!socketRef.current || !activeConversationId) {
      console.log('🔍 Join conversation check:', {
        hasSocket: !!socketRef.current,
        activeConversationId,
        connected
      })
      return
    }

    // Join conversation room
    console.log(`🚪 Joining conversation room: ${activeConversationId}`)
    console.log(`🔌 Socket state:`, {
      connected: socketRef.current.connected,
      id: socketRef.current.id
    })
    
    socketRef.current.emit('join-conversation', activeConversationId)
    console.log(`✅ Emitted join-conversation for: ${activeConversationId}`)

    return () => {
      if (socketRef.current && activeConversationId) {
        console.log(`🚪 Leaving conversation: ${activeConversationId}`)
        socketRef.current.emit('leave-conversation', activeConversationId)
      }
    }
  }, [activeConversationId, connected])

  // ==================== API ACTIONS ====================

  const loadConversations = useCallback(async () => {
    try {
      setLoading(true)
      const data = await ChatApi.getConversations()
      setConversations(data.conversations)
    } catch (error) {
      console.error('Error loading conversations:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  const loadMessages = useCallback(async (conversationId: string) => {
    try {
      setLoading(true)
      const data = await ChatApi.getMessages(conversationId)
      setMessages(prev => ({
        ...prev,
        [conversationId]: data.messages
      }))
    } catch (error) {
      console.error('Error loading messages:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  const sendMessage = useCallback(async (
    conversationId: string,
    body: string,
    type: Message['type'] = 'text'
  ) => {
    try {
      if (!socketRef.current?.connected) {
        throw new Error('Socket not connected')
      }

      console.log('📤 Sending message via socket:', {
        conversationId,
        bodyPreview: body.substring(0, 50),
        type,
        socketConnected: socketRef.current.connected
      })

      // Send via socket only - no API, no optimistic update
      // Backend will save to DB and emit message:new to all participants
      socketRef.current.emit('message:send', {
        conversationId,
        type,
        body
      })

      console.log('✅ Message sent via socket, waiting for confirmation...')
    } catch (error) {
      console.error('Error sending message:', error)
      throw error
    }
  }, [user])

  const markAsRead = useCallback(async (conversationId: string) => {
    try {
      await ChatApi.markAsRead(conversationId)
      
      // Update local state
      setMessages(prev => ({
        ...prev,
        [conversationId]: (prev[conversationId] || []).map(msg => ({
          ...msg,
          isRead: true
        }))
      }))

      setConversations(prev =>
        prev.map(conv =>
          conv.id === conversationId ? { ...conv, unreadCount: 0 } : conv
        )
      )
    } catch (error) {
      console.error('Error marking as read:', error)
    }
  }, [])

  // ==================== LOAD CONVERSATIONS ON MOUNT ====================

  useEffect(() => {
    if (isAuthenticated) {
      loadConversations()
    }
  }, [isAuthenticated, loadConversations])

  const value: ChatContextType = {
    conversations,
    activeConversationId,
    messages,
    loading,
    connected,
    setActiveConversation: setActiveConversationId,
    loadConversations,
    loadMessages,
    sendMessage,
    markAsRead,
    socket: socketRef.current
  }

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>
}

export function useChat() {
  const context = useContext(ChatContext)
  if (!context) {
    throw new Error('useChat must be used within ChatProvider')
  }
  return context
}
