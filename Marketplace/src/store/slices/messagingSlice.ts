import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'
import { apiClient } from '@/lib/api'

interface Message {
  id: string
  text: string
  senderId: string
  senderName: string
  timestamp: string
  isRead: boolean
  platform: 'mobile' | 'web'
}

interface Conversation {
  id: string
  customerId: string
  serviceProviderId: string
  customerName: string
  serviceProviderName: string
  messages: Message[]
  lastActivity: string
  status: 'active' | 'closed' | 'handoff_requested'
  serviceType: string
}

interface MessagingState {
  conversations: Conversation[]
  activeConversation: Conversation | null
  isLoading: boolean
  error: string | null
  unreadCount: number
}

const initialState: MessagingState = {
  conversations: [],
  activeConversation: null,
  isLoading: false,
  error: null,
  unreadCount: 0,
}

// Async thunks
export const loadConversations = createAsyncThunk(
  'messaging/loadConversations',
  async () => {
    const response = await apiClient.getConversations()
    return response.data
  }
)

export const sendMessage = createAsyncThunk(
  'messaging/sendMessage',
  async (data: {
    conversationId: string
    senderType: 'customer' | 'provider'
    senderName: string
    message: string
    messageType?: string
  }) => {
    const response = await apiClient.sendMessage(data)
    return response.data
  }
)

const messagingSlice = createSlice({
  name: 'messaging',
  initialState,
  reducers: {
    setActiveConversation: (state, action: PayloadAction<Conversation | null>) => {
      state.activeConversation = action.payload
    },
    addMessage: (state, action: PayloadAction<{ conversationId: string; message: Message }>) => {
      const { conversationId, message } = action.payload
      const conversation = state.conversations.find(conv => conv.id === conversationId)
      
      if (conversation) {
        conversation.messages.push(message)
        conversation.lastActivity = message.timestamp
        
        // Update unread count
        if (message.senderId !== state.activeConversation?.id) {
          state.unreadCount += 1
        }
      }
    },
    markAsRead: (state, action: PayloadAction<string>) => {
      const conversationId = action.payload
      const conversation = state.conversations.find(conv => conv.id === conversationId)
      
      if (conversation) {
        conversation.messages.forEach(message => {
          message.isRead = true
        })
        
        // Update unread count
        state.unreadCount = Math.max(0, state.unreadCount - 1)
      }
    },
    clearError: (state) => {
      state.error = null
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadConversations.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(loadConversations.fulfilled, (state, action) => {
        state.isLoading = false
        state.conversations = action.payload
        state.unreadCount = action.payload.reduce((count: number, conv: Conversation) => {
          return count + conv.messages.filter((msg: Message) => !msg.isRead).length
        }, 0)
        state.error = null
      })
      .addCase(loadConversations.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.error.message || 'Failed to load conversations'
      })
      .addCase(sendMessage.fulfilled, (state, action) => {
        // Message will be added via WebSocket
        state.error = null
      })
      .addCase(sendMessage.rejected, (state, action) => {
        state.error = action.error.message || 'Failed to send message'
      })
  },
})

export const { 
  setActiveConversation, 
  addMessage, 
  markAsRead, 
  clearError 
} = messagingSlice.actions

export default messagingSlice.reducer

