/**
 * ChatWindow - Active Conversation View
 * Combines MessageList and MessageInput
 */

'use client'

import React, { useEffect } from 'react'
import { useChat } from '@/contexts/ChatContext'
import { useAuth } from '@/contexts/AuthContext'
import MessageList from './MessageList'
import MessageInput from './MessageInput'

interface ChatWindowProps {
  conversationId: string
}

export default function ChatWindow({ conversationId }: ChatWindowProps) {
  const { user } = useAuth()
  const { messages, loading, loadMessages, sendMessage, markAsRead, conversations } = useChat()

  const conversation = conversations.find(c => c.id === conversationId)
  const conversationMessages = messages[conversationId] || []

  // Load messages when conversation changes
  useEffect(() => {
    if (conversationId) {
      loadMessages(conversationId)
      markAsRead(conversationId)
    }
  }, [conversationId, loadMessages, markAsRead])

  const handleSendMessage = async (body: string) => {
    await sendMessage(conversationId, body)
    markAsRead(conversationId)
  }

  if (!conversation) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="text-center text-gray-500">
          <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <p className="text-lg font-medium">Изберете разговор</p>
          <p className="text-sm mt-1">Изберете разговор от списъка вляво</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              {user?.role === 'customer'
                ? (conversation.providerBusinessName || conversation.providerName || 'Майстор')
                : (conversation.customerName || 'Клиент')
              }
            </h2>
            {user?.role === 'customer' && conversation.providerServiceCategory ? (
              <p className="text-sm text-gray-500">
                {conversation.providerServiceCategory}
              </p>
            ) : (
              <p className="text-sm text-gray-500">
                {conversation.customerEmail}
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {/* Connection status */}
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <div className="w-2 h-2 rounded-full bg-green-500"></div>
              <span>Свързан</span>
            </div>
          </div>
        </div>
      </div>

      {/* Messages */}
      <MessageList
        messages={conversationMessages}
        loading={loading}
      />

      {/* Input */}
      <MessageInput
        onSend={handleSendMessage}
        disabled={loading}
      />
    </div>
  )
}
