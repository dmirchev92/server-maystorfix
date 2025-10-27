/**
 * MessageBubble - Single Message Component
 * Industry standard alignment: sender right, receiver left
 */

'use client'

import React from 'react'
import { Message } from '@/lib/chatApi'
import { useAuth } from '@/contexts/AuthContext'

interface MessageBubbleProps {
  message: Message
  showSenderName?: boolean
}

export default function MessageBubble({ message, showSenderName = true }: MessageBubbleProps) {
  const { user } = useAuth()
  
  // Determine if this is my message
  const isMyMessage = message.senderUserId === user?.id

  // Format timestamp
  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString('bg-BG', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div className={`flex ${isMyMessage ? 'justify-end' : 'justify-start'} mb-3`}>
      <div className={`max-w-[70%] ${isMyMessage ? 'items-end' : 'items-start'} flex flex-col`}>
        {/* Sender name (only for received messages) */}
        {!isMyMessage && showSenderName && (
          <span className="text-xs text-gray-500 mb-1 px-2">
            {message.senderName}
          </span>
        )}

        {/* Message bubble */}
        <div
          className={`
            px-4 py-2 rounded-lg break-words
            ${isMyMessage
              ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-br-none'
              : 'bg-gray-200 text-gray-900 rounded-bl-none'
            }
            ${message.deletedAt ? 'opacity-50 italic' : ''}
          `}
        >
          {/* Message content */}
          {message.deletedAt ? (
            <span className="text-sm">Това съобщение е изтрито</span>
          ) : (
            <p className="text-sm whitespace-pre-wrap">{message.body}</p>
          )}

          {/* Edited indicator */}
          {message.editedAt && !message.deletedAt && (
            <span className={`text-xs ${isMyMessage ? 'text-purple-200' : 'text-gray-500'} ml-2`}>
              (редактирано)
            </span>
          )}
        </div>

        {/* Timestamp and read status */}
        <div className={`flex items-center gap-1 mt-1 px-2 ${isMyMessage ? 'flex-row-reverse' : 'flex-row'}`}>
          <span className="text-xs text-gray-500">
            {formatTime(message.sentAt)}
          </span>
          
          {/* Read indicator (only for my messages) */}
          {isMyMessage && (
            <span className="text-xs">
              {message.isRead ? (
                <span className="text-blue-500" title="Прочетено">✓✓</span>
              ) : (
                <span className="text-gray-400" title="Изпратено">✓</span>
              )}
            </span>
          )}
        </div>

        {/* Attachments (if any) */}
        {message.attachments && message.attachments.length > 0 && (
          <div className="mt-2 space-y-2">
            {message.attachments.map((attachment) => (
              <div key={attachment.id} className="rounded-lg overflow-hidden">
                {attachment.mimeType.startsWith('image/') ? (
                  <img
                    src={attachment.url}
                    alt="Attachment"
                    className="max-w-full h-auto rounded-lg cursor-pointer hover:opacity-90 transition"
                    onClick={() => window.open(attachment.url, '_blank')}
                  />
                ) : (
                  <a
                    href={attachment.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`
                      flex items-center gap-2 px-3 py-2 rounded-lg
                      ${isMyMessage ? 'bg-purple-700 text-white' : 'bg-gray-300 text-gray-900'}
                      hover:opacity-80 transition
                    `}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span className="text-sm truncate">Файл</span>
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
