/**
 * ChatWidget - Floating Chat Widget
 * Uses the same ChatContext and socket connection as /chat page
 * Provides a compact, floating interface for real-time messaging
 */

'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useChat } from '@/contexts/ChatContext'
import { Message } from '@/lib/chatApi'
import MessageBubble from './chat/MessageBubble'

// Widget content component (uses ChatContext)
function ChatWidgetContent() {
  const { user, isAuthenticated } = useAuth()
  const {
    conversations,
    activeConversationId,
    messages,
    loading,
    connected,
    setActiveConversation,
    loadConversations,
    loadMessages,
    sendMessage,
    markAsRead
  } = useChat()
  
  const [isOpen, setIsOpen] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const [newMessage, setNewMessage] = useState('')
  const pathname = usePathname()

  // Listen for openChatWidget event from SMS token link
  useEffect(() => {
    const handleOpenChat = (event: CustomEvent) => {
      const { providerId } = event.detail
      console.log('📱 ChatWidget received openChatWidget event:', providerId)
      
      // Open the widget
      setIsOpen(true)
      setIsMinimized(false)
      
      // Find conversation with this provider
      const conversation = conversations.find(c => c.providerId === providerId)
      
      if (conversation) {
        console.log('✅ Found existing conversation:', conversation.id)
        setActiveConversation(conversation.id)
      } else {
        console.log('⚠️ No conversation found for provider:', providerId)
        // Load conversations to check if it exists
        loadConversations()
      }
    }

    window.addEventListener('openChatWidget', handleOpenChat as EventListener)
    return () => window.removeEventListener('openChatWidget', handleOpenChat as EventListener)
  }, [conversations, setActiveConversation, loadConversations])

  // Load conversations when widget opens (once)
  useEffect(() => {
    if (isOpen && isAuthenticated) {
      loadConversations()
      // No polling needed - socket handles real-time updates via conversation:updated event
    }
  }, [isOpen, isAuthenticated, loadConversations])

  // Load messages when conversation changes
  useEffect(() => {
    if (activeConversationId) {
      loadMessages(activeConversationId)
      markAsRead(activeConversationId)
      
      // Scroll to bottom after messages load
      setTimeout(() => {
        const messagesContainer = document.querySelector('.chat-messages-container')
        if (messagesContainer) {
          messagesContainer.scrollTop = messagesContainer.scrollHeight
        }
      }, 100)
    }
  }, [activeConversationId, loadMessages, markAsRead])

  // Calculate total unread
  const unreadTotal = conversations.reduce((sum, conv) => sum + (conv.unreadCount || 0), 0)

  // Get active conversation
  const activeConversation = conversations.find(c => c.id === activeConversationId)
  const conversationMessages = activeConversationId ? (messages[activeConversationId] || []) : []

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (conversationMessages.length > 0) {
      setTimeout(() => {
        const messagesContainer = document.querySelector('.chat-messages-container')
        if (messagesContainer) {
          messagesContainer.scrollTop = messagesContainer.scrollHeight
        }
      }, 100)
    }
  }, [conversationMessages.length])

  // Handle send message
  const handleSendMessage = async () => {
    if (!newMessage.trim() || !activeConversationId) return
    
    await sendMessage(activeConversationId, newMessage.trim())
    setNewMessage('')
  }

  // Handle conversation click
  const handleConversationClick = (conversationId: string) => {
    setActiveConversation(conversationId)
  }

  // Handle back to list
  const handleBackToList = () => {
    setActiveConversation(null)
  }

  // Format timestamp
  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Сега'
    if (diffMins < 60) return `${diffMins} мин`
    if (diffHours < 24) return `${diffHours} ч`
    if (diffDays < 7) return `${diffDays} д`
    
    return date.toLocaleDateString('bg-BG', { day: 'numeric', month: 'short' })
  }

  // Don't show on auth pages
  if (pathname?.startsWith('/auth/')) {
    return null
  }

  // Show login prompt for non-authenticated users
  if (!isAuthenticated || !user) {
    return (
      <button
        onClick={() => window.location.href = '/auth/login'}
        className="fixed bottom-6 right-6 bg-gray-600 hover:bg-gray-700 text-white p-4 rounded-full shadow-lg transition-all duration-200 z-[9999]"
        aria-label="Влезте за чат"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
        <div className="absolute -top-2 -right-2 bg-blue-500 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center font-bold">
          !
        </div>
      </button>
    )
  }

  return (
    <>
      {/* Chat Widget Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white p-4 rounded-full shadow-lg transition-all duration-200 z-[9999] border-4 border-white"
          aria-label="Отвори чат"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          
          {/* Unread badge */}
          {unreadTotal > 0 && (
            <div className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center font-bold">
              {unreadTotal > 99 ? '99+' : unreadTotal}
            </div>
          )}

          {/* Connection indicator */}
          {connected && (
            <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>
          )}
        </button>
      )}

      {/* Chat Widget Window */}
      {isOpen && (
        <div 
          className={`fixed bottom-6 right-6 bg-white rounded-lg shadow-2xl border border-gray-200 z-[9999] transition-all duration-200 flex flex-col ${
            isMinimized ? 'w-80 h-14' : 'w-96 h-[600px]'
          }`}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-t-lg">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {/* Back button (when viewing conversation) */}
              {activeConversation && !isMinimized && (
                <button
                  onClick={handleBackToList}
                  className="hover:bg-white/10 p-1 rounded transition"
                  title="Назад"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
              )}

              {/* Connection status */}
              <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-400' : 'bg-gray-400'}`}></div>
              
              {/* Title */}
              <div className="flex-1 min-w-0">
                {activeConversation ? (
                  <>
                    <span className="font-medium text-sm truncate block">
                      {user?.role === 'customer'
                        ? (activeConversation.providerBusinessName || activeConversation.providerName || 'Майстор')
                        : (activeConversation.customerName || 'Клиент')
                      }
                    </span>
                    {user?.role === 'customer' && activeConversation.providerServiceCategory && (
                      <span className="text-xs text-indigo-200 truncate block">
                        {activeConversation.providerServiceCategory}
                      </span>
                    )}
                  </>
                ) : (
                  <>
                    <span className="font-medium text-sm truncate block">
                      Съобщения
                    </span>
                    {unreadTotal > 0 && (
                      <span className="text-xs text-indigo-200">
                        {unreadTotal} непрочетени
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setIsMinimized(!isMinimized)}
                className="hover:bg-white/10 p-1 rounded transition"
                title={isMinimized ? "Разшири" : "Минимизирай"}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {isMinimized ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  )}
                </svg>
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="hover:bg-white/10 p-1 rounded transition"
                title="Затвори"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Content */}
          {!isMinimized && (
            <div className="flex-1 flex flex-col overflow-hidden">
              {activeConversation ? (
                /* Active Chat View */
                <>
                  {/* Messages Area */}
                  <div className="chat-messages-container flex-1 overflow-y-auto bg-gray-50 p-3 space-y-2">
                    {loading && conversationMessages.length === 0 ? (
                      <div className="flex items-center justify-center h-full">
                        <div className="text-center text-gray-500">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-2"></div>
                          <p className="text-sm">Зареждане...</p>
                        </div>
                      </div>
                    ) : conversationMessages.length === 0 ? (
                      <div className="flex items-center justify-center h-full">
                        <div className="text-center text-gray-500">
                          <div className="text-3xl mb-2">💬</div>
                          <p className="text-sm">Няма съобщения</p>
                          <p className="text-xs mt-1">Започнете разговор</p>
                        </div>
                      </div>
                    ) : (
                      conversationMessages.map((message: Message, index: number) => {
                        const showSenderName = index === 0 || conversationMessages[index - 1].senderUserId !== message.senderUserId
                        return (
                          <MessageBubble
                            key={message.id}
                            message={message}
                            showSenderName={showSenderName}
                          />
                        )
                      })
                    )}
                  </div>
                  
                  {/* Message Input */}
                  <div className="border-t p-3 bg-white">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                        placeholder="Напишете съобщение..."
                        className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                        disabled={loading}
                      />
                      <button
                        onClick={handleSendMessage}
                        disabled={!newMessage.trim() || loading}
                        className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-4 py-2 rounded-lg disabled:opacity-50 hover:from-purple-700 hover:to-indigo-700 transition"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                        </svg>
                      </button>
                    </div>
                    
                    {/* Create Case Button - Only show for customers */}
                    {user?.role === 'customer' && activeConversation && (
                      <div className="mt-2">
                        <button
                          onClick={() => {
                            // Navigate to create case page with provider info
                            const providerId = activeConversation.providerId
                            const providerName = activeConversation.providerBusinessName || activeConversation.providerName || 'Майстор'
                            window.location.href = `/create-case?providerId=${providerId}&providerName=${encodeURIComponent(providerName)}&conversationId=${activeConversation.id}`
                          }}
                          className="w-full bg-gradient-to-r from-green-500 to-blue-500 text-white px-3 py-2 rounded-lg text-sm font-medium hover:from-green-600 hover:to-blue-600 transition-all duration-200 flex items-center justify-center gap-2"
                        >
                          <span>📋</span>
                          <span>Създай заявка</span>
                        </button>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                /* Conversations List View */
                <div className="flex-1 overflow-y-auto">
                  {loading ? (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center text-gray-500">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-2"></div>
                        <p className="text-sm">Зареждане...</p>
                      </div>
                    </div>
                  ) : conversations.length === 0 ? (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center text-gray-500 p-4">
                        <div className="text-4xl mb-2">💬</div>
                        <p className="text-sm font-medium">Няма разговори</p>
                        <p className="text-xs mt-1">Започнете нов разговор</p>
                      </div>
                    </div>
                  ) : (
                    conversations.map((conversation) => {
                      const hasUnread = (conversation.unreadCount || 0) > 0
                      // Display the OTHER person's name based on current user's role
                      const displayName = user?.role === 'customer'
                        ? (conversation.providerBusinessName || conversation.providerName || 'Майстор')
                        : (conversation.customerName || 'Клиент')
                      const displayInitial = displayName.charAt(0).toUpperCase()
                      const showServiceCategory = user?.role === 'customer' && conversation.providerServiceCategory
                      
                      return (
                        <button
                          key={conversation.id}
                          onClick={() => handleConversationClick(conversation.id)}
                          className={`group w-full p-3.5 rounded-lg border border-transparent text-left relative transition-all
                            hover:bg-white hover:shadow-sm hover:border-purple-200
                            ${hasUnread ? 'bg-purple-50/40' : ''}
                          `}
                        >
                          {/* Left accent for unread */}
                          <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-lg transition-colors ${hasUnread ? 'bg-purple-500' : 'bg-transparent'} group-hover:bg-purple-400`} />

                          <div className="flex items-center gap-3">
                            {/* Avatar */}
                            <div className="relative flex-shrink-0">
                              <div className="w-11 h-11 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-sm">
                                <span className="text-white font-semibold text-sm">{displayInitial}</span>
                              </div>
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                              {/* Row 1: Name + time (and unread) */}
                              <div className="flex items-center justify-between gap-2">
                                <h3 className={`font-semibold text-sm truncate ${hasUnread ? 'text-gray-900' : 'text-gray-800'}`}>{displayName}</h3>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                  <span className="text-[11px] text-gray-400">{formatTime(conversation.lastMessageAt)}</span>
                                  {hasUnread && (
                                    <span className="inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-purple-600 text-white text-[10px] font-bold">
                                      {conversation.unreadCount}
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Row 2: Category chip + last message */}
                              <div className="mt-1 flex items-center gap-2">
                                {showServiceCategory && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full border border-purple-300 text-purple-700 bg-white text-[11px] font-medium flex-shrink-0 group-hover:border-purple-400 group-hover:bg-purple-50">
                                    <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                      <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z"/>
                                    </svg>
                                    {conversation.providerServiceCategory}
                                  </span>
                                )}
                                <p className={`truncate text-xs ${hasUnread ? 'text-gray-700' : 'text-gray-500'}`}>
                                  {conversation.lastMessage?.body || 'Няма съобщения'}
                                </p>
                              </div>
                            </div>
                          </div>
                        </button>
                      )
                    })
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </>
  )
}

// Main widget component - uses global SocketProvider
export default function ChatWidget() {
  const pathname = usePathname()

  // Don't show on auth pages or chat page (to avoid duplicate)
  if (pathname?.startsWith('/auth/') || pathname === '/chat') {
    return null
  }

  return <ChatWidgetContent />
}
