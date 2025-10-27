'use client'

import React, { useState, useEffect, useRef } from 'react';
import { Socket } from 'socket.io-client';
import UnifiedCaseModal from './UnifiedCaseModal';
import ServiceRequestButton from './ServiceRequestButton';
import SurveyModal from './SurveyModal';
import { apiClient } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import { useSocket } from '@/contexts/SocketContext'

interface ServiceProvider {
  id: string
  // Support both naming conventions - make all optional and handle both
  businessName?: string
  business_name?: string
  serviceCategory?: string
  service_category?: string
  description?: string
  experienceYears?: number
  experience_years?: number
  hourlyRate?: number
  hourly_rate?: number
  city: string
  neighborhood?: string
  phoneNumber?: string
  phone_number?: string
  email?: string
  rating: number
  totalReviews?: number
  total_reviews?: number
  firstName?: string
  first_name?: string
  lastName?: string
  last_name?: string
}

interface Message {
  id: string
  conversationId: string
  senderType: 'customer' | 'provider' | 'system'
  senderName: string
  message: string
  messageType?: string
  timestamp: string
  data?: any // For additional message data like caseId
  caseId?: string // Direct case ID for survey messages
}

interface ChatModalProps {
  provider: ServiceProvider
  isOpen: boolean
  onClose: () => void
}

export default function ChatModal({ provider, isOpen, onClose }: ChatModalProps) {
  const { user, isAuthenticated } = useAuth()
  const { socket, isConnected } = useSocket() // Use global socket from context
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [customerName, setCustomerName] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isStarted, setIsStarted] = useState(false)
  const [formMode, setFormMode] = useState<'register' | 'login'>('register')
  const [authError, setAuthError] = useState<string | null>(null)
  const [showUnifiedModal, setShowUnifiedModal] = useState(false)
  const [currentTemplate, setCurrentTemplate] = useState<any>(null)
  const [isSubmittingTemplate, setIsSubmittingTemplate] = useState(false)
  const [modalMode, setModalMode] = useState<'template' | 'direct'>('direct')
  const [showSurveyModal, setShowSurveyModal] = useState(false)
  const [surveyCase, setSurveyCase] = useState<any>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Storage keys for persistence
  const storageKey = `chat_${provider.id}`
  const conversationKey = `conversation_${provider.id}`

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Initialize user data only once when modal opens
  useEffect(() => {
    const initializeChat = async () => {
      if (isOpen && isAuthenticated && user && !isStarted) {
        console.log('🗨️ ChatModal opened for provider:', provider.id)
        
        const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim()
        const finalName = fullName || 'User'
        
        setCustomerName(finalName)
        setCustomerEmail(user.email || '')
        setCustomerPhone(user.phoneNumber || '')
        
        // Check for existing conversation
        const savedConversationId = localStorage.getItem(conversationKey)
        if (savedConversationId) {
          console.log('🔍 Found saved conversation ID:', savedConversationId)
          console.log('📖 Loading existing conversation and messages')
          // Load the existing conversation instead of creating new one
          setConversationId(savedConversationId)
          setIsStarted(true)
          await loadMessages(savedConversationId)
        } else {
          // No saved conversation, create a new one
          console.log('🆕 No saved conversation, creating new one')
          await startConversation({ 
            name: finalName, 
            email: user.email || '', 
            phone: user.phoneNumber || '' 
          })
        }
      }
    }
    
    initializeChat()
  }, [isOpen, isAuthenticated, user, provider.id])

  // Join conversation room when modal opens
  useEffect(() => {
    if (!isOpen || !conversationId || !socket || !isConnected) return

    console.log('🏠 ChatModal - Joining conversation room:', conversationId)
    socket.emit('join-conversation', conversationId)

    return () => {
      console.log('🚪 ChatModal - Leaving conversation room:', conversationId)
      // Don't disconnect the global socket, just leave the room
    }
  }, [isOpen, conversationId, socket, isConnected])

  // Setup real-time message listeners
  useEffect(() => {
    if (!socket || !conversationId) return

    const handleNewMessage = (data: any) => {
      console.log('💬 Customer received new message:', data)
      
      // Accept ALL messages for this conversation (both customer and provider)
      if (data.conversationId === conversationId && data.messageId) {
        const newMessage: Message = {
          id: data.messageId,
          conversationId: data.conversationId,
          senderType: data.senderType,
          senderName: data.senderName,
          message: data.message,
          messageType: data.messageType,
          timestamp: data.timestamp
        }
        
        setMessages(prev => {
          const messageExists = prev.some(msg => msg.id === data.messageId)
          if (messageExists) return prev
          
          console.log('📝 Adding message to customer chat:', newMessage)
          return [...prev, newMessage]
        })
        scrollToBottom()
      }
    }

    socket.on('new_message', handleNewMessage)

    return () => {
      socket.off('new_message', handleNewMessage)
    }
  }, [socket, conversationId])

  const handleQuickRegister = async () => {
    setAuthError(null)
    
    // Validation
    if (!customerName || !customerEmail || !customerPhone || !password) {
      setAuthError('Моля попълнете всички полета')
      return
    }
    
    if (password !== confirmPassword) {
      setAuthError('Паролите не съвпадат')
      return
    }
    
    if (password.length < 6) {
      setAuthError('Паролата трябва да е поне 6 символа')
      return
    }
    
    setLoading(true)
    try {
      // Register the user
      const registerResponse = await apiClient.register({
        email: customerEmail,
        password: password,
        firstName: customerName.split(' ')[0] || customerName,
        lastName: customerName.split(' ').slice(1).join(' ') || '',
        phoneNumber: customerPhone,
        role: 'customer'
      })
      
      if (registerResponse.data?.success) {
        // Auto-login after registration
        const { token } = await apiClient.login(customerEmail, password)
        
        if (token) {
          // Token already saved by login method
          // Reload page to update auth context
          window.location.reload()
        }
      }
    } catch (error: any) {
      console.error('Registration error:', error)
      const errorMessage = error.response?.data?.error?.message || error.response?.data?.message || 'Грешка при регистрация'
      setAuthError(errorMessage)
    } finally {
      setLoading(false)
    }
  }
  
  const handleLogin = async () => {
    setAuthError(null)
    
    // Validation
    if (!customerEmail || !password) {
      setAuthError('Моля въведете email и парола')
      return
    }
    
    setLoading(true)
    try {
      const { token } = await apiClient.login(customerEmail, password)
      
      if (token) {
        // Token already saved by login method
        // Reload page to update auth context
        window.location.reload()
      }
    } catch (error: any) {
      console.error('Login error:', error)
      const errorMessage = error.response?.data?.error?.message || error.response?.data?.message || 'Грешка при вход'
      setAuthError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const startConversation = async (overrideData?: { name?: string, email?: string, phone?: string }) => {
    if (loading || isStarted) return

    setLoading(true)
    try {
      const data = {
        providerId: provider.id,
        customerId: user?.id || undefined, // Add authenticated user ID
        customerName: overrideData?.name || customerName,
        customerEmail: overrideData?.email || customerEmail,
        customerPhone: overrideData?.phone || customerPhone
      }

      console.log('🚀 Starting conversation with data:', data)

      // Use new Chat API V2
      const response = await apiClient.createConversationV2(data)
      
      if (response.data?.success && response.data?.data?.conversation?.id) {
        const newConversationId = response.data.data.conversation.id
        setConversationId(newConversationId)
        setIsStarted(true)
        
        // Save to localStorage
        localStorage.setItem(storageKey, JSON.stringify(data))
        localStorage.setItem(conversationKey, newConversationId)
        
        // Load existing messages
        await loadMessages(newConversationId)
      }
    } catch (error) {
      console.error('Error starting conversation:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadMessages = async (convId: string) => {
    try {
      setLoading(true)
      // Use new Chat API V2
      const response = await apiClient.getMessagesV2(convId, { limit: 100 })
      console.log('💬 ChatModal V2 - Load messages response:', response.data)
      
      if (response.data?.success) {
        // New API returns { success: true, data: { messages: [...] } }
        const messagesData = response.data.data?.messages || []
        console.log('💬 ChatModal V2 - Extracted messages:', messagesData)
        
        if (Array.isArray(messagesData)) {
          // Map V2 message format to old format for compatibility
          const mappedMessages = messagesData.map((m: any) => ({
            id: m.id,
            conversationId: m.conversationId,
            senderType: m.senderType,
            senderName: m.senderName,
            message: m.body,
            messageType: m.type,
            timestamp: m.createdAt,
            data: m.data
          }))
          setMessages(mappedMessages)
          scrollToBottom()
        }
      }
    } catch (error: any) {
      console.error('Error loading messages:', error)
      // If conversation doesn't exist, auto-recreate it
      if (error?.response?.status === 404) {
        console.log('🔧 Conversation not found, attempting to recreate...')
        await recreateConversation()
      }
    } finally {
      setLoading(false)
    }
  }

  const recreateConversation = async () => {
    try {
      const data = {
        providerId: provider.id,
        customerName: customerName,
        customerEmail: customerEmail,
        customerPhone: customerPhone
      }
      
      // Use new Chat API V2
      const response = await apiClient.createConversationV2(data)
      if (response.data?.success && response.data?.data?.conversation?.id) {
        const newConversationId = response.data.data.conversation.id
        setConversationId(newConversationId)
        localStorage.setItem(conversationKey, newConversationId)
        console.log('✅ Conversation recreated:', newConversationId)
      }
    } catch (error) {
      console.error('Failed to recreate conversation:', error)
    }
  }

  const handleCaseTemplateClick = async (message: Message) => {
    if (message.messageType !== 'case_template') return;
    
    try {
      // Get the service category from provider
      const serviceCategory = provider.serviceCategory || provider.service_category || 'general';
      
      // Fetch the case template
      const response = await apiClient.getCaseTemplate(serviceCategory);
      
      if (response.data?.success && response.data?.data) {
        const templateData = JSON.parse(response.data.data.template_data);
        setCurrentTemplate({
          ...response.data.data,
          templateData
        });
        setModalMode('template');
        setShowUnifiedModal(true);
      }
    } catch (error) {
      console.error('Error loading case template:', error);
    }
  };

  const handleTemplateSubmit = async (formData: Record<string, any>) => {
    if (!conversationId || !currentTemplate) return;

    setIsSubmittingTemplate(true);
    try {
      // Create or update service case with filled data
      const response = await apiClient.createServiceCase({
        conversationId,
        templateId: currentTemplate.id,
        caseData: formData
      });

      if (response.data?.success) {
        // Send a message to the provider with the filled template
        const summaryMessage = `📋 Попълних формата с информация за проблема:

${Object.entries(formData).map(([key, value]) => {
  const field = currentTemplate.templateData.fields.find((f: any) => f.id === key);
  const label = field?.label || key;
  return `${label}: ${value}`;
}).join('\n')}`;

        // Send the summary message
        const messageResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://192.168.0.129:3000/api/v1'}/chat/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            conversationId,
            senderType: 'customer',
            senderName: customerName,
            message: summaryMessage,
            messageType: 'case_filled'
          })
        });

        if (messageResponse.ok) {
          // Add message to local state
          const newMessage: Message = {
            id: Date.now().toString(),
            conversationId: conversationId!,
            senderType: 'customer',
            senderName: customerName,
            message: summaryMessage,
            messageType: 'case_filled',
            timestamp: new Date().toISOString()
          };
          setMessages(prev => [...prev, newMessage]);
        }

        setShowUnifiedModal(false);
        setCurrentTemplate(null);
      }
    } catch (error) {
      console.error('Error submitting template:', error)
      alert('Възникна грешка при изпращането на формата')
    } finally {
      setIsSubmittingTemplate(false)
    }
  }

  const handleCaseCreation = async (caseData: any) => {
    if (!conversationId) return
    
    // Check if user is authenticated
    if (!user || !user.id) {
      console.error('❌ Cannot create case: User not authenticated')
      alert('Моля, влезте в профила си, за да създадете заявка')
      return
    }
    
    try {
      console.log('📋 ChatModal - Creating case with data:', caseData)
      console.log('📋 ChatModal - User ID:', user.id)
      console.log('📋 ChatModal - Provider object:', provider)
      console.log('📋 ChatModal - Assignment type:', caseData.assignmentType)
      
      // Prevent Service Providers from creating cases for themselves
      if (caseData.assignmentType === 'specific' && user.id === provider.id) {
        alert('❌ Грешка: Не можете да създадете заявка за себе си като специалист.')
        return
      }
      
      // Prepare case data for API
      const casePayload = {
        serviceType: caseData.serviceType,
        description: caseData.description,
        preferredDate: caseData.preferredDate,
        preferredTime: caseData.preferredTime,
        priority: caseData.priority || 'normal',
        address: caseData.address,
        phone: caseData.phone,
        additionalDetails: caseData.additionalDetails || '',
        // Handle assignment based on "тип заявка" selection
        assignmentType: caseData.assignmentType || 'specific',
        providerId: caseData.assignmentType === 'specific' ? provider.id : null,
        conversationId: conversationId,
        customerId: user.id, // Add the actual user ID
        customerName: customerName,
        customerEmail: customerEmail,
        customerPhone: customerPhone
      }
      console.log('📋 ChatModal - Case payload:', casePayload)
      console.log('📋 ChatModal - Final providerId for assignment:', casePayload.providerId)
      console.log('📋 ChatModal - Assignment logic: assignmentType =', caseData.assignmentType, 'provider.id =', provider.id)

      // Create the actual case in the system
      const caseResponse = await apiClient.createCase(casePayload)
      
      if (caseResponse.data?.success) {
        const createdCase = caseResponse.data.data
        console.log('✅ ChatModal - Case created successfully:', createdCase)

        // Create a notification message in the chat
        let notificationMessage = `✅ Заявката е създадена успешно!

📋 Номер на заявката: #${createdCase.id}
🔧 Услуга: ${caseData.serviceType}
📍 Адрес: ${caseData.address}
📅 Дата: ${caseData.preferredDate}
⏰ Време: ${caseData.preferredTime || 'Сутрин (8:00-12:00)'}

${caseData.assignmentType === 'specific' 
  ? `🎯 Заявката е насочена директно към ${provider.businessName || provider.business_name}`
  : '🌐 Заявката е поставена в общата опашка за всички специалисти'
}`

        // Try to send notification message to chat (non-critical)
        try {
          // Use new Chat API V2
          await apiClient.sendMessageV2(conversationId, {
            type: 'system',
            body: notificationMessage
          })

          // Add message to local state
          const newMessage: Message = {
            id: Date.now().toString(),
            conversationId: conversationId!,
            senderType: 'customer',
            senderName: customerName,
            message: notificationMessage,
            messageType: 'case_created',
            timestamp: new Date().toISOString()
          }
          setMessages(prev => [...prev, newMessage])
        } catch (chatError) {
          console.error('📋 ChatModal - Failed to send chat notification (non-critical):', chatError)
          // Don't throw error here since case was created successfully
        }

        // Show success feedback
        alert(`Заявката е създадена успешно! Номер: #${createdCase.id}`)
        
      } else {
        throw new Error(caseResponse.data?.message || 'Грешка при създаването на заявката')
      }
      
      setShowUnifiedModal(false)
    } catch (error: any) {
      console.error('Error creating case:', error)
      alert('Възникна грешка при създаването на заявката')
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || loading) return

    // If no conversation exists, create one first
    if (!conversationId) {
      console.log('🔧 No conversation found, creating new one...')
      await startConversation()
      if (!conversationId) {
        console.error('❌ Failed to create conversation')
        return
      }
    }

    setLoading(true)
    try {
      // Use new Chat API V2
      const response = await apiClient.sendMessageV2(conversationId, {
        type: 'text',
        body: newMessage
      })

      if (response.data?.success) {
        // Add customer message to UI immediately (won't come back via WebSocket)
        const sentMessage = response.data.data?.message
        const newMsg: Message = {
          id: sentMessage?.id || Date.now().toString(),
          conversationId: conversationId,
          senderType: 'customer',
          senderName: customerName,
          message: newMessage,
          timestamp: sentMessage?.createdAt || new Date().toISOString()
        }
        
        setMessages(prev => [...prev, newMsg])
        setNewMessage('')
      }
    } catch (error: any) {
      console.error('Error sending message:', error)
      
      // If conversation was deleted, try to recreate and resend
      if (error?.response?.status === 404) {
        console.log('🔧 Conversation deleted, recreating and retrying...')
        await recreateConversation()
        // Retry sending the message
        setTimeout(() => sendMessage(), 1000)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    // Reset state when closing
    setMessages([])
    setNewMessage('')
    setConversationId(null)
    setIsStarted(false)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-slate-800 rounded-xl shadow-2xl w-full max-w-md mx-4 h-96 flex flex-col border border-white/20">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-4 rounded-t-xl flex justify-between items-center">
          <div>
            <h3 className="font-semibold">
              {provider.businessName || provider.business_name || `${provider.firstName || provider.first_name} ${provider.lastName || provider.last_name}`}
            </h3>
            <p className="text-sm text-white/80">
              {provider.serviceCategory || provider.service_category}
            </p>
          </div>
          <button
            onClick={handleClose}
            className="text-white/80 hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-900/50">
          {loading && messages.length === 0 ? (
            <div className="text-center text-slate-400">Зареждане...</div>
          ) : (
            messages.map((msg) => {
              // Facebook Messenger logic:
              // My messages = Gray (LEFT)
              // Their messages = Purple (RIGHT)
              console.log('🎨 Rendering message:', { 
                id: msg.id, 
                senderType: msg.senderType, 
                message: msg.message?.substring(0, 20),
                allKeys: Object.keys(msg)
              })
              const isMyMessage = msg.senderType === 'customer'
              console.log('🎨 isMyMessage:', isMyMessage, 'will render:', isMyMessage ? 'GRAY LEFT' : 'PURPLE RIGHT')
              
              return (
              <div
                key={msg.id}
                className={`flex ${isMyMessage ? 'justify-start' : 'justify-end'}`}
              >
                <div
                  className={`max-w-xs px-3 py-2 rounded-lg text-sm ${
                    isMyMessage
                      ? 'bg-slate-700 text-slate-100 border border-slate-600'
                      : 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white'
                  }`}
                >
                  <div>{msg.message}</div>
                  
                  {/* Show template button for case_template messages */}
                  {msg.messageType === 'case_template' && msg.senderType === 'provider' && (
                    <button
                      onClick={() => handleCaseTemplateClick(msg)}
                      className="mt-2 px-3 py-1 bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-xs rounded hover:shadow-lg transform hover:scale-105 transition-all duration-300"
                    >
                      📋 Попълни формата
                    </button>
                  )}
                  
                  {/* Show service request button for service_request messages */}
                  {msg.messageType === 'service_request' && msg.senderType === 'provider' && (
                    <div className="mt-2">
                      <ServiceRequestButton 
                        providerName={provider.businessName || provider.business_name || `${provider.firstName || provider.first_name} ${provider.lastName || provider.last_name}`}
                        onClick={() => {
                          setModalMode('direct');
                          setShowUnifiedModal(true);
                        }}
                      />
                    </div>
                  )}

                  {/* Show survey button for survey_request messages */}
                  {msg.messageType === 'survey_request' && (
                    <button
                      onClick={async () => {
                        // Extract case ID from message data
                        console.log('🔍 Survey button clicked, message data:', msg);
                        let caseId = msg.caseId;
                        
                        // Try to parse data field if it exists
                        if (msg.data) {
                          try {
                            const parsedData = typeof msg.data === 'string' ? JSON.parse(msg.data) : msg.data;
                            console.log('🔍 Parsed message data:', parsedData);
                            caseId = parsedData.caseId || caseId;
                          } catch (e) {
                            console.log('Could not parse message data:', msg.data);
                          }
                        }
                        
                        console.log('🔍 Final caseId extracted:', caseId);
                        
                        if (caseId) {
                          try {
                            // Fetch case details for the survey
                            const response = await apiClient.getCase(caseId);
                            if (response.data?.success) {
                              setSurveyCase({
                                id: caseId,
                                providerName: provider.businessName || provider.business_name || `${provider.firstName || provider.first_name} ${provider.lastName || provider.last_name}`,
                                serviceType: response.data.data.service_type,
                                completedAt: response.data.data.completed_at,
                                description: response.data.data.description
                              });
                              setShowSurveyModal(true);
                            }
                          } catch (error) {
                            console.error('Error fetching case details:', error);
                            alert('Възникна грешка при зареждането на детайлите за заявката');
                          }
                        } else {
                          alert('Не може да се намери ID на заявката');
                        }
                      }}
                      className="mt-2 px-4 py-2 bg-gradient-to-r from-yellow-500 to-orange-500 text-white text-sm rounded-lg hover:from-yellow-600 hover:to-orange-600 transition-all duration-200 flex items-center space-x-2"
                    >
                      <span>⭐</span>
                      <span>Оценете услугата</span>
                    </button>
                  )}
                  
                  <div className={`text-xs mt-1 ${
                    isMyMessage ? 'text-slate-400' : 'text-white/60'
                  }`}>
                    {new Date(msg.timestamp).toLocaleTimeString('bg-BG', {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </div>
                </div>
              </div>
              )
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Section */}
        {isStarted && (
          <div className="border-t border-slate-700 p-4 bg-slate-800/50">
            <div className="flex space-x-2 mb-3">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                placeholder="Напишете съобщение..."
                className="flex-1 bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-slate-400"
                disabled={loading}
              />
              <button
                onClick={sendMessage}
                disabled={!newMessage.trim() || loading}
                className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-4 py-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg transform hover:scale-105 transition-all duration-300"
              >
                {loading ? '...' : 'Изпрати'}
              </button>
            </div>
            
            {/* Quick Action Button */}
            <div className="flex justify-center">
              <button
                onClick={() => {
                  setModalMode('direct');
                  setShowUnifiedModal(true);
                }}
                className="bg-gradient-to-r from-green-500 to-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:from-green-600 hover:to-blue-600 transition-all duration-200 flex items-center space-x-2"
              >
                <span>🔧</span>
                <span>Създай заявка за услуга</span>
              </button>
            </div>
          </div>
        )}

        {/* Registration/Login Form */}
        {!isStarted && !loading && (
          <div className="p-4 border-t border-slate-700 bg-slate-800/50 max-h-96 overflow-y-auto">
            {/* Mode Toggle */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setFormMode('register')}
                className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
                  formMode === 'register'
                    ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                Регистрация
              </button>
              <button
                onClick={() => setFormMode('login')}
                className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
                  formMode === 'login'
                    ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                Вход
              </button>
            </div>

            {/* Error Message */}
            {authError && (
              <div className="mb-3 p-2 bg-red-500/20 border border-red-500/50 rounded-lg text-red-200 text-sm">
                {authError}
              </div>
            )}

            <div className="space-y-3">
              {/* Registration Form */}
              {formMode === 'register' && (
                <>
                  <input
                    type="text"
                    placeholder="Вашето име"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-slate-400"
                  />
                  <input
                    type="email"
                    placeholder="Email адрес"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-slate-400"
                  />
                  <input
                    type="tel"
                    placeholder="Телефон"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-slate-400"
                  />
                  <input
                    type="password"
                    placeholder="Парола (мин. 6 символа)"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-slate-400"
                  />
                  <input
                    type="password"
                    placeholder="Потвърди парола"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-slate-400"
                  />
                  <button
                    onClick={handleQuickRegister}
                    disabled={loading}
                    className="w-full bg-gradient-to-r from-green-600 to-blue-600 text-white py-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg transform hover:scale-105 transition-all duration-300 font-medium"
                  >
                    {loading ? 'Регистриране...' : '🚀 Регистрирай се и започни чат'}
                  </button>
                  <p className="text-xs text-slate-400 text-center">
                    Ще бъдете автоматично влезли след регистрацията
                  </p>
                </>
              )}

              {/* Login Form */}
              {formMode === 'login' && (
                <>
                  <input
                    type="email"
                    placeholder="Email адрес"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-slate-400"
                  />
                  <input
                    type="password"
                    placeholder="Парола"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
                    className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-slate-400"
                  />
                  <button
                    onClick={handleLogin}
                    disabled={loading}
                    className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg transform hover:scale-105 transition-all duration-300 font-medium"
                  >
                    {loading ? 'Влизане...' : '🔓 Влез и започни чат'}
                  </button>
                  <p className="text-xs text-slate-400 text-center">
                    Ще бъдете автоматично влезли и чатът ще се отвори
                  </p>
                </>
              )}
            </div>
          </div>
        )}
    </div>

    {/* Unified Case Modal */}
    {showUnifiedModal && (
      <UnifiedCaseModal
        isOpen={showUnifiedModal}
        mode={modalMode}
        templateData={currentTemplate?.templateData}
        onClose={() => {
          setShowUnifiedModal(false);
          setCurrentTemplate(null);
        }}
        onSubmit={modalMode === 'template' ? handleTemplateSubmit : handleCaseCreation}
        isSubmitting={isSubmittingTemplate}
        providerName={provider.businessName || provider.business_name || 'специалиста'}
        providerId={provider.id}
        providerCategory={provider.serviceCategory || provider.service_category}
        customerPhone={customerPhone}
      />
    )}

    {/* Survey Modal */}
    {showSurveyModal && surveyCase && (
      <SurveyModal
        isOpen={showSurveyModal}
        onClose={() => {
          setShowSurveyModal(false);
          setSurveyCase(null);
        }}
        caseId={surveyCase.id}
        providerId={provider.id}
        providerName={provider.businessName || provider.business_name || `${provider.firstName || provider.first_name} ${provider.lastName || provider.last_name}`}
        onSubmitSuccess={async () => {
          // Send a thank you message to the chat
          const thankYouMessage = `✅ Благодарим ви за оценката! 

Вашето мнение е важно за нас и помага на други клиенти да направят правилния избор.`;

          try {
            // Use new Chat API V2
            await apiClient.sendMessageV2(conversationId!, {
              type: 'text',
              body: thankYouMessage
            });

            // Add thank you message to local state
            const newMessage: Message = {
              id: Date.now().toString(),
              conversationId: conversationId!,
              senderType: 'customer',
              senderName: customerName,
              message: thankYouMessage,
              messageType: 'text',
              timestamp: new Date().toISOString()
            };
            setMessages(prev => [...prev, newMessage]);
          } catch (error) {
            console.error('Error sending thank you message:', error);
          }

          setShowSurveyModal(false);
          setSurveyCase(null);
          alert('Благодарим ви за оценката!');
        }}
      />
    )}
  </div>
)
}
