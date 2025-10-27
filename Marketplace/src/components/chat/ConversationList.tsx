/**
 * ConversationList - List of Conversations
 * Shows unread counts, last message, timestamps
 */

'use client'

import React from 'react'
import { Conversation } from '@/lib/chatApi'
import { useAuth } from '@/contexts/AuthContext'

interface ConversationListProps {
  conversations: Conversation[]
  activeConversationId: string | null
  onSelectConversation: (conversationId: string) => void
  loading?: boolean
}

export default function ConversationList({
  conversations,
  activeConversationId,
  onSelectConversation,
  loading = false
}: ConversationListProps) {
  const { user } = useAuth()
  
  const formatTimestamp = (timestamp: string) => {
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="inline-flex items-center gap-2 text-gray-500">
          <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span>Зареждане...</span>
        </div>
      </div>
    )
  }

  if (conversations.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-center p-8">
        <div className="text-gray-500">
          <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
          <p className="text-lg font-medium">Няма разговори</p>
          <p className="text-sm mt-1">Започнете нов разговор с доставчик</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto bg-white">
      {conversations.map((conversation) => {
        const isActive = conversation.id === activeConversationId
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
            onClick={() => onSelectConversation(conversation.id)}
            className={`
              group w-full p-4 rounded-lg border border-transparent text-left relative transition-all
              hover:bg-white hover:shadow-sm hover:border-purple-200
              ${isActive ? 'bg-gradient-to-r from-purple-100 to-indigo-100' : ''}
              ${hasUnread && !isActive ? 'bg-purple-50/40' : ''}
            `}
          >
            {/* Left accent */}
            <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-lg transition-colors ${isActive ? 'bg-purple-600' : hasUnread ? 'bg-purple-500' : 'bg-transparent'} group-hover:bg-purple-400`} />

            <div className="flex items-center gap-3">
              {/* Avatar */}
              <div className="relative flex-shrink-0">
                <div className={`
                  w-12 h-12 rounded-full flex items-center justify-center text-white font-bold shadow-md
                  ${isActive ? 'bg-gradient-to-br from-purple-600 to-indigo-700' : 'bg-gradient-to-br from-purple-500 to-indigo-600'}
                `}>
                  {displayInitial}
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                {/* Row 1: Name + time + unread */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <h3 className={`font-semibold text-sm truncate ${hasUnread || isActive ? 'text-gray-900' : 'text-gray-800'}`}>{displayName}</h3>
                    {showServiceCategory && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full border border-purple-300 text-purple-700 bg-white text-[11px] font-medium flex-shrink-0 group-hover:border-purple-400 group-hover:bg-purple-50">
                        <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z"/>
                        </svg>
                        {conversation.providerServiceCategory}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-[11px] text-gray-400">{formatTimestamp(conversation.lastMessageAt)}</span>
                    {hasUnread && (
                      <span className="inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-purple-600 text-white text-[10px] font-bold">
                        {conversation.unreadCount}
                      </span>
                    )}
                  </div>
                </div>

                {/* Row 2: Last message */}
                <div className="mt-1 flex items-center justify-between gap-2">
                  <p className={`text-sm truncate flex-1 ${hasUnread ? 'font-medium text-gray-700' : 'text-gray-500'}`}>
                    {conversation.lastMessage?.body || 'Няма съобщения'}
                  </p>
                </div>

                {/* Email for customers (optional) */}
                {conversation.customerEmail && (
                  <p className="text-xs text-gray-400 mt-1 truncate">
                    {conversation.customerEmail}
                  </p>
                )}
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}
