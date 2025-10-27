/**
 * ChatContainer - Main Chat Interface
 * Two-column layout: Conversations list + Active chat
 * Responsive: Mobile shows one column at a time
 */

'use client'

import React, { useState } from 'react'
import { useChat } from '@/contexts/ChatContext'
import ConversationList from './ConversationList'
import ChatWindow from './ChatWindow'

export default function ChatContainer() {
  const { conversations, activeConversationId, setActiveConversation, loading } = useChat()
  const [showMobileChat, setShowMobileChat] = useState(false)

  const handleSelectConversation = (conversationId: string) => {
    setActiveConversation(conversationId)
    setShowMobileChat(true) // Show chat on mobile
  }

  const handleBackToList = () => {
    setShowMobileChat(false)
    setActiveConversation(null)
  }

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-6 py-4 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Back button (mobile only, when chat is open) */}
            {showMobileChat && (
              <button
                onClick={handleBackToList}
                className="md:hidden p-2 hover:bg-white/10 rounded-lg transition"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}

            <div>
              <h1 className="text-2xl font-bold">Съобщения</h1>
              <p className="text-sm text-purple-100">
                {conversations.length} {conversations.length === 1 ? 'разговор' : 'разговора'}
              </p>
            </div>
          </div>

          {/* Refresh button */}
          <button
            onClick={() => window.location.reload()}
            className="p-2 hover:bg-white/10 rounded-lg transition"
            title="Обнови"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Conversations List */}
        <div className={`
          w-full md:w-96 border-r border-gray-200 bg-white
          ${showMobileChat ? 'hidden md:block' : 'block'}
        `}>
          <ConversationList
            conversations={conversations}
            activeConversationId={activeConversationId}
            onSelectConversation={handleSelectConversation}
            loading={loading}
          />
        </div>

        {/* Chat Window */}
        <div className={`
          flex-1 bg-gray-50
          ${showMobileChat ? 'block' : 'hidden md:block'}
        `}>
          {activeConversationId ? (
            <ChatWindow conversationId={activeConversationId} />
          ) : (
            <div className="h-full flex items-center justify-center">
              <div className="text-center text-gray-500">
                <svg className="w-24 h-24 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <p className="text-xl font-medium mb-2">Добре дошли в съобщенията</p>
                <p className="text-sm">Изберете разговор от списъка вляво за да започнете</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
