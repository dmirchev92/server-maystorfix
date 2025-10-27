/**
 * MessageList - Scrollable Message List
 * Auto-scrolls to bottom on new messages
 * Supports pagination (load more)
 */

'use client'

import React, { useEffect, useRef } from 'react'
import { Message } from '@/lib/chatApi'
import MessageBubble from './MessageBubble'

interface MessageListProps {
  messages: Message[]
  loading?: boolean
  onLoadMore?: () => void
  hasMore?: boolean
}

export default function MessageList({
  messages,
  loading = false,
  onLoadMore,
  hasMore = false
}: MessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const prevMessageCountRef = useRef(messages.length)

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    // Only auto-scroll if new messages were added (not on initial load or load more)
    if (messages.length > prevMessageCountRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
    prevMessageCountRef.current = messages.length
  }, [messages])

  // Scroll to bottom on mount
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'auto' })
  }, [])

  // Handle scroll for "load more"
  const handleScroll = () => {
    if (!containerRef.current || !onLoadMore || !hasMore || loading) return

    const { scrollTop } = containerRef.current
    
    // If scrolled to top, load more
    if (scrollTop === 0) {
      onLoadMore()
    }
  }

  if (messages.length === 0 && !loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="text-center text-gray-500">
          <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <p className="text-lg font-medium">Няма съобщения</p>
          <p className="text-sm mt-1">Започнете разговор като изпратите съобщение</p>
        </div>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto bg-gray-50 p-4 space-y-2"
    >
      {/* Load more indicator */}
      {hasMore && (
        <div className="text-center py-2">
          {loading ? (
            <div className="inline-flex items-center gap-2 text-sm text-gray-500">
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>Зареждане...</span>
            </div>
          ) : (
            <button
              onClick={onLoadMore}
              className="text-sm text-purple-600 hover:text-purple-700 font-medium"
            >
              Зареди по-стари съобщения
            </button>
          )}
        </div>
      )}

      {/* Messages */}
      {messages.map((message, index) => {
        // Show sender name only if different from previous message
        const showSenderName = index === 0 || messages[index - 1].senderUserId !== message.senderUserId

        return (
          <MessageBubble
            key={message.id}
            message={message}
            showSenderName={showSenderName}
          />
        )
      })}

      {/* Loading indicator */}
      {loading && messages.length === 0 && (
        <div className="flex items-center justify-center py-8">
          <div className="inline-flex items-center gap-2 text-gray-500">
            <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>Зареждане на съобщения...</span>
          </div>
        </div>
      )}

      {/* Scroll anchor */}
      <div ref={messagesEndRef} />
    </div>
  )
}
