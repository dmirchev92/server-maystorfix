import axios, { AxiosInstance, AxiosResponse } from 'axios'

// API client configuration - connects to your existing backend
// Whitelist of allowed hostnames for security
const ALLOWED_HOSTS = ['46.224.11.139', '192.168.0.129', 'localhost', '127.0.0.1']

const getApiUrl = (): string => {
  // Always prefer environment variable (most secure)
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL
  }
  
  // Server-side rendering - use production URL
  if (typeof window === 'undefined') {
    return 'https://maystorfix.com/api/v1'
  }
  
  // Client-side - always use HTTPS for production domain
  const hostname = window.location.hostname
  
  // Production domain - always HTTPS
  if (hostname === 'maystorfix.com' || hostname === '46.224.11.139') {
    return 'https://maystorfix.com/api/v1'
  }
  
  // Local development only - HTTP
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '192.168.0.129') {
    return `http://${hostname}:3000/api/v1`
  }
  
  // Fallback to safe default
  return 'https://maystorfix.com/api/v1'
}

const API_BASE_URL = getApiUrl()

class ApiClient {
  private client: AxiosInstance

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    })

    this.setupInterceptors()
  }

  private setupInterceptors() {
    // Request interceptor - add auth token
    this.client.interceptors.request.use(
      (config) => {
        const token = this.getAuthToken()
        if (token) {
          config.headers.Authorization = `Bearer ${token}`
        }
        return config
      },
      (error) => Promise.reject(error)
    )

    // Response interceptor - handle errors
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          // Token expired, redirect to login
          this.clearAuthToken()
          window.location.href = '/auth/login'
        }
        return Promise.reject(error)
      }
    )
  }

  private getAuthToken(): string | null {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('auth_token')
    }
    return null
  }

  private clearAuthToken(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('auth_token')
      localStorage.removeItem('refresh_token')
      localStorage.removeItem('user_data')
    }
  }

  // Authentication endpoints
  async login(email: string, password: string) {
    const response = await this.client.post('/auth/login', { email, password })
    const { token, refreshToken, user } = response.data
    
    // Store tokens
    if (typeof window !== 'undefined') {
      localStorage.setItem('auth_token', token)
      localStorage.setItem('refresh_token', refreshToken)
    }
    
    return { user, token, refreshToken }
  }

  async register(userData: any) {
    return this.client.post('/auth/register', userData)
  }

  async logout() {
    this.clearAuthToken()
    return this.client.post('/auth/logout')
  }

  // Marketplace endpoints
  async searchProviders(filters: any) {
    console.log('🔍 API Client - Making request with filters:', filters)
    try {
      const response = await this.client.get('/marketplace/providers/search', { params: filters })
      console.log('✅ API Client - Response received:', response)
      return response
    } catch (error) {
      console.error('❌ API Client - Request failed:', error)
      throw error
    }
  }

  async getProvider(id: string) {
    return this.client.get(`/marketplace/providers/${id}`)
  }

  async getServiceCategories() {
    return this.client.get('/marketplace/categories')
  }

  // Get cases for map view (for providers)
  async getCasesForMap(params: { latitude?: number; longitude?: number; radius?: number; category?: string }) {
    return this.client.get('/cases/map', { params })
  }

  async validatePublicChat(publicId: string, token: string) {
    return this.client.get(`/chat/public/${publicId}/validate/${token}`)
  }

  async createBooking(bookingData: any) {
    return this.client.post('/marketplace/bookings', bookingData)
  }

  async getBookings() {
    return this.client.get('/marketplace/bookings')
  }

  // Messaging endpoints (connects to your existing messaging system)
  async getConversations() {
    // Get current user to determine correct endpoint
    const user = JSON.parse(localStorage.getItem('user_data') || localStorage.getItem('user') || '{}')
    if (user.role === 'customer') {
      return this.client.get(`/chat/user/${user.id}/conversations`)
    } else {
      return this.client.get(`/chat/provider/${user.id}/conversations`)
    }
  }

  // User profile endpoints
  async getProfile() {
    return this.client.get('/auth/profile')
  }

  async updateProfile(profileData: any) {
    return this.client.put('/auth/profile', profileData)
  }

  // GDPR endpoints (connects to your existing GDPR system)
  async getConsentStatus() {
    return this.client.get('/gdpr/consent-summary')
  }

  async updateConsent(consentData: any) {
    return this.client.post('/gdpr/consent', consentData)
  }

  // Marketplace Chat endpoints
  async startMarketplaceConversation(data: {
    providerId: string
    customerId?: string
    customerName: string
    customerEmail: string
    customerPhone?: string
    chatSource?: string
  }) {
    console.log('🔗 API Client - Starting marketplace conversation:', data)
    
    const payload = {
      providerId: data.providerId,
      customerId: data.customerId,
      customerName: data.customerName,
      customerEmail: data.customerEmail,
      customerPhone: data.customerPhone || '',
      chatSource: data.chatSource || 'direct'
    }
    
    console.log('🔗 API Client - Request payload:', JSON.stringify(payload, null, 2))
    
    try {
      const response = await this.client.post('/chat/conversations', payload)
      console.log('🔗 API Client - Response:', response.data)
      return response
    } catch (error: any) {
      console.error('🔗 API Client - Error:', error.response?.data || error.message)
      throw error
    }
  }

  // Alias for ChatModal compatibility
  async createOrGetConversation(data: {
    providerId: string
    customerId?: string
    customerName: string
    customerEmail: string
    customerPhone?: string
    chatSource?: string
  }) {
    return this.startMarketplaceConversation(data)
  }

  // Alias for ChatWidget compatibility
  async startConversation(data: {
    providerId: string
    customerId?: string
    customerName: string
    customerEmail: string
    customerPhone?: string
    chatSource?: string
  }) {
    return this.startMarketplaceConversation(data)
  }

  async sendMarketplaceMessage(data: {
    conversationId: string
    senderType: 'customer' | 'provider'
    senderName: string
    message: string
    messageType?: string
  }) {
    console.log('💬 API Client - Sending marketplace message:', data.message.substring(0, 50) + '...')
    console.log('💬 API Client - Base URL:', this.client.defaults.baseURL)
    console.log('💬 API Client - Full URL would be:', this.client.defaults.baseURL + '/chat/messages')
    return this.client.post('/chat/messages', data)
  }

  // Alias for ChatModal compatibility
  async sendMessage(data: {
    conversationId: string
    senderType: 'customer' | 'provider'
    senderName: string
    message: string
    messageType?: string
  }) {
    return this.sendMarketplaceMessage(data)
  }

  async getMarketplaceMessages(conversationId: string, limit?: number) {
    console.log('📖 API Client - Getting marketplace messages for:', conversationId)
    console.log('📖 API Client - Base URL:', this.client.defaults.baseURL)
    const url = `/chat/conversations/${conversationId}/messages`
    console.log('📖 API Client - Request URL:', url)
    console.log('📖 API Client - Full URL would be:', this.client.defaults.baseURL + url)
    return this.client.get(url, {
      params: limit ? { limit } : {}
    })
  }

  // Alias for ChatModal compatibility
  async getConversationMessages(conversationId: string, limit?: number) {
    return this.getMarketplaceMessages(conversationId, limit)
  }

  async getMarketplaceConversation(conversationId: string) {
    return this.client.get(`/chat/conversations/${conversationId}`)
  }

  // ==================== CHAT API V2 ====================
  // New professional chat API endpoints

  /**
   * Get all conversations for the authenticated user
   */
  async getConversationsV2(params?: { limit?: number; offset?: number }) {
    console.log('💬 Chat API V2 - Getting conversations')
    return this.client.get('/chat/conversations', { params })
  }

  /**
   * Create a new conversation (V2)
   */
  async createConversationV2(data: {
    providerId: string
    customerName: string
    customerEmail: string
    customerPhone?: string
    initialMessage?: string
  }) {
    console.log('💬 Chat API V2 - Creating conversation:', data)
    return this.client.post('/chat/conversations', data)
  }

  /**
   * Get a specific conversation by ID (V2)
   */
  async getConversationV2(conversationId: string) {
    console.log('💬 Chat API V2 - Getting conversation:', conversationId)
    return this.client.get(`/chat/conversations/${conversationId}`)
  }

  /**
   * Get messages for a conversation (V2)
   */
  async getMessagesV2(conversationId: string, params?: { limit?: number; offset?: number }) {
    console.log('💬 Chat API V2 - Getting messages for:', conversationId)
    return this.client.get(`/chat/conversations/${conversationId}/messages`, { params })
  }

  /**
   * Send a message in a conversation (V2)
   */
  async sendMessageV2(conversationId: string, data: {
    type: 'text' | 'image' | 'file' | 'system'
    body: string
    attachments?: string[]
  }) {
    console.log('💬 Chat API V2 - Sending message to:', conversationId)
    return this.client.post(`/chat/conversations/${conversationId}/messages`, data)
  }

  /**
   * Mark conversation as read (V2)
   */
  async markConversationReadV2(conversationId: string) {
    console.log('💬 Chat API V2 - Marking conversation as read:', conversationId)
    return this.client.post(`/chat/conversations/${conversationId}/read`)
  }

  /**
   * Edit a message (V2)
   */
  async editMessageV2(messageId: string, body: string) {
    console.log('💬 Chat API V2 - Editing message:', messageId)
    return this.client.patch(`/chat/messages/${messageId}`, { body })
  }

  /**
   * Delete a message (V2)
   */
  async deleteMessageV2(messageId: string) {
    console.log('💬 Chat API V2 - Deleting message:', messageId)
    return this.client.delete(`/chat/messages/${messageId}`)
  }

  /**
   * Update message receipt (V2)
   */
  async updateReceiptV2(messageId: string, status: 'delivered' | 'read') {
    console.log('💬 Chat API V2 - Updating receipt for:', messageId, 'to', status)
    return this.client.post(`/chat/messages/${messageId}/receipts`, { status })
  }

  // Upload screenshots and return URLs
  async uploadScreenshots(files: File[]) {
    const formData = new FormData()
    files.forEach(file => {
      formData.append('screenshots', file)
    })
    
    console.log('📸 API Client - Uploading screenshots:', files.length)
    const response = await this.client.post('/upload/case-screenshots', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
    return response.data
  }

  // Case Management API Methods (Updated to new endpoints)
  async createCase(caseData: any) {
    console.log('📋 API Client - Creating case with data:', caseData)
    console.log('📸 API Client - Screenshots in caseData:', caseData.screenshots)
    console.log('📸 API Client - Screenshots length:', caseData.screenshots?.length)
    console.log('📸 API Client - First screenshot type:', caseData.screenshots?.[0]?.constructor?.name)
    
    // If screenshots are File objects, upload them first
    if (caseData.screenshots && caseData.screenshots.length > 0 && caseData.screenshots[0] instanceof File) {
      console.log('📸 API Client - Detected File objects, uploading screenshots first...')
      try {
        const uploadResponse = await this.uploadScreenshots(caseData.screenshots)
        console.log('📸 API Client - Upload response:', uploadResponse)
        
        if (uploadResponse.success && uploadResponse.data.screenshots) {
          // Replace File objects with URLs
          caseData.screenshots = uploadResponse.data.screenshots.map((s: any) => ({ url: s.url }))
          console.log('✅ API Client - Screenshots uploaded successfully:', caseData.screenshots)
        } else {
          console.error('❌ API Client - Screenshot upload failed, response:', uploadResponse)
          delete caseData.screenshots // Remove if upload failed
        }
      } catch (error) {
        console.error('❌ API Client - Screenshot upload error:', error)
        delete caseData.screenshots // Remove if upload failed
      }
    } else {
      console.log('📸 API Client - No File objects detected, skipping upload')
    }
    
    console.log('📋 API Client - Final caseData before POST:', caseData)
    return this.client.post('/cases', caseData)
  }

  async getCases(filters?: {
    status?: string
    category?: string
    providerId?: string
    customerId?: string
    page?: number
    limit?: number
    offset?: number
  }) {
    console.log('📋 API Client - Getting cases with filters:', filters)
    return this.client.get('/cases', { params: filters })
  }

  async getCase(caseId: string) {
    console.log('📋 API Client - Getting case:', caseId)
    return this.client.get(`/cases/${caseId}`)
  }

  async getCaseById(caseId: string) {
    return this.getCase(caseId)
  }

  async assignCase(caseId: string, action: 'accept' | 'decline', message?: string) {
    console.log('📋 API Client - Assigning case:', caseId, action)
    if (action === 'accept') {
      // Use the new accept endpoint
      return this.client.post(`/cases/${caseId}/accept`)
    } else {
      // Use the new decline endpoint
      return this.client.post(`/cases/${caseId}/decline`, { reason: message })
    }
  }

  async declineCase(caseId: string, providerId: string, reason?: string) {
    console.log('📋 API Client - Declining case:', caseId, 'by provider:', providerId)
    return this.client.post(`/cases/${caseId}/decline`, { providerId, reason })
  }

  async getDeclinedCases(providerId: string) {
    console.log('🚫 API Client - Getting declined cases for provider:', providerId)
    return this.client.get(`/cases/declined/${providerId}`)
  }

  async undeclineCase(caseId: string, providerId: string) {
    console.log('✅ API Client - Un-declining case:', caseId, 'for provider:', providerId)
    return this.client.post(`/cases/${caseId}/undecline`, { providerId })
  }

  async updateCaseStatus(caseId: string, status: string, message?: string) {
    console.log('📋 API Client - Updating case status:', caseId, status)
    if (status === 'completed' || status === 'closed') {
      return this.client.post(`/cases/${caseId}/complete`, { completionNotes: message })
    }
    // For other status updates, we might need to add more endpoints
    return this.client.put(`/cases/${caseId}/status`, { status, message })
  }

  async updateCaseStatusDirect(caseId: string, status: string, message?: string) {
    console.log('📋 API Client - Direct status update:', caseId, status)
    return this.client.put(`/cases/${caseId}/status`, { status, message })
  }

  async getProviderCases(providerId: string, status?: string) {
    console.log('📋 API Client - Getting provider cases:', providerId, status)
    const params = status ? { status } : {}
    return this.client.get(`/cases/provider/${providerId}`, { params })
  }

  async getAvailableCases(providerId: string, filters?: {
    category?: string
    location?: string
    page?: number
    limit?: number
  }) {
    console.log('📋 API Client - Getting available cases:', providerId, filters)
    return this.client.get(`/cases/queue/${providerId}`, { params: filters })
  }

  async getProviderMarketplaceConversations(providerId: string) {
    return this.client.get(`/chat/provider/${providerId}/conversations`)
  }

  async markMarketplaceAsRead(conversationId: string, senderType: 'customer' | 'provider') {
    return this.client.put(`/chat/conversations/${conversationId}/read`, { senderType })
  }

  // Case template methods
  async getCaseTemplate(serviceCategory: string) {
    return this.client.get(`/cases/templates/${serviceCategory}`)
  }

  async createServiceCase(data: {
    conversationId: string
    templateId: string
    caseData: Record<string, any>
  }) {
    return this.client.post('/cases', data)
  }

  async updateServiceCase(caseId: string, data: {
    status?: string
    caseData?: any
    estimatedCost?: number
    estimatedDuration?: number
    scheduledDate?: string
  }) {
    return this.client.put(`/cases/${caseId}`, data)
  }

  async getServiceCaseByConversation(conversationId: string) {
    return this.client.get(`/cases/conversation/${conversationId}`)
  }


  // Referral System API Methods
  async getReferralDashboard() {
    console.log('📊 API Client - Getting referral dashboard')
    return this.client.get('/referrals/dashboard')
  }

  async generateReferralCode() {
    console.log('🔗 API Client - Generating referral code')
    return this.client.post('/referrals/generate')
  }

  async trackReferralClick(providerId: string, data: {
    customerUserId?: string
    visitorId: string
  }) {
    console.log('👆 API Client - Tracking referral click:', providerId)
    return this.client.post(`/referrals/track/${providerId}`, data)
  }

  async getReferralStats(providerId: string) {
    console.log('📈 API Client - Getting referral stats:', providerId)
    return this.client.get(`/referrals/stats/${providerId}`)
  }

  async getReferredUsers() {
    console.log('👥 API Client - Getting referred users')
    return this.client.get('/referrals/users')
  }

  async getReferralRewards() {
    console.log('🎁 API Client - Getting referral rewards')
    return this.client.get('/referrals/rewards')
  }

  async claimReferralReward(rewardId: string) {
    console.log('🎯 API Client - Claiming referral reward:', rewardId)
    return this.client.post(`/referrals/rewards/${rewardId}/claim`)
  }

  async getReferralLink() {
    console.log('🔗 API Client - Getting referral link')
    return this.client.get('/referrals/link')
  }

  // Case Management Methods
  async getCasesWithFilters(filters: {
    status?: string
    category?: string
    city?: string
    neighborhood?: string
    providerId?: string
    customerId?: string
    createdByUserId?: string
    onlyUnassigned?: string
    page?: number
    limit?: number
    sortBy?: string
    sortOrder?: string
  }) {
    console.log('📋 API Client - Getting cases with filters:', filters)
    const params = new URLSearchParams()
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        params.append(key, value.toString())
      }
    })
    return this.client.get(`/cases?${params.toString()}`)
  }

  async getCaseStats(providerId?: string, customerId?: string) {
    console.log('📊 API Client - Getting case stats')
    const params = new URLSearchParams()
    if (providerId) params.append('providerId', providerId)
    if (customerId) params.append('customerId', customerId)
    return this.client.get(`/cases/stats?${params.toString()}`)
  }

  async acceptCase(caseId: string, providerId: string, providerName: string) {
    console.log('✅ API Client - Accepting case:', caseId)
    return this.client.post(`/cases/${caseId}/accept`, {
      providerId,
      providerName
    })
  }

  async completeCase(caseId: string, completionNotes?: string, income?: { amount: number; paymentMethod?: string; notes?: string }) {
    console.log('🏁 API Client - Completing case:', caseId, 'with income:', income)
    return this.client.post(`/cases/${caseId}/complete`, {
      completionNotes,
      income
    })
  }

  async getIncomeStats(providerId: string, startDate?: string, endDate?: string) {
    console.log('💰 API Client - Getting income stats for provider:', providerId)
    const params = new URLSearchParams()
    if (startDate) params.append('startDate', startDate)
    if (endDate) params.append('endDate', endDate)
    const queryString = params.toString() ? `?${params.toString()}` : ''
    return this.client.get(`/income/provider/${providerId}${queryString}`)
  }

  async getIncomeYears(providerId: string) {
    console.log('📅 API Client - Getting income years for provider:', providerId)
    return this.client.get(`/income/provider/${providerId}/years`)
  }

  async getIncomeTransactionsByMethod(providerId: string, paymentMethod: string) {
    console.log('💰 API Client - Getting transactions for method:', paymentMethod)
    return this.client.get(`/income/provider/${providerId}/method/${encodeURIComponent(paymentMethod)}`)
  }

  async getIncomeTransactionsByMonth(providerId: string, month: string) {
    console.log('💰 API Client - Getting transactions for month:', month)
    return this.client.get(`/income/provider/${providerId}/month/${month}`)
  }

  async updateIncomeTransaction(incomeId: string, data: { amount: number; paymentMethod?: string; notes?: string }) {
    console.log('💰 API Client - Updating income transaction:', incomeId)
    return this.client.put(`/income/${incomeId}`, data)
  }


  async getSmartMatches(caseId: string, limit?: number) {
    console.log('🎯 API Client - Getting smart matches for case:', caseId)
    const params = limit ? `?limit=${limit}` : ''
    return this.client.get(`/cases/${caseId}/smart-matches${params}`)
  }

  // Notification endpoints
  async getUserNotifications() {
    console.log('🔔 API Client - Getting user notifications')
    return this.client.get('/notifications')
  }

  async getUnreadNotificationCount() {
    console.log('🔔 API Client - Getting unread notification count')
    return this.client.get('/notifications/unread-count')
  }

  async markNotificationAsRead(notificationId: string) {
    console.log('🔔 API Client - Marking notification as read:', notificationId)
    return this.client.post(`/notifications/${notificationId}/read`)
  }

  async markAllNotificationsAsRead() {
    console.log('🔔 API Client - Marking all notifications as read')
    return this.client.post('/notifications/mark-all-read')
  }

  // Review Methods
  async createReview(reviewData: {
    caseId: string
    providerId: string
    rating: number
    comment?: string
    serviceQuality?: number
    communication?: number
    timeliness?: number
    valueForMoney?: number
    wouldRecommend?: boolean
  }) {
    console.log('⭐ API Client - Creating review:', reviewData.caseId)
    return this.client.post('/reviews', reviewData)
  }

  async getProviderReviews(providerId: string, page?: number, limit?: number) {
    console.log('⭐ API Client - Getting provider reviews:', providerId)
    const params = new URLSearchParams()
    if (page) params.append('page', page.toString())
    if (limit) params.append('limit', limit.toString())
    return this.client.get(`/reviews/provider/${providerId}?${params.toString()}`)
  }

  async getProviderReviewStats(providerId: string) {
    console.log('📊 API Client - Getting provider review stats:', providerId)
    return this.client.get(`/reviews/provider/${providerId}/stats`)
  }

  async canReviewCase(caseId: string) {
    console.log('❓ API Client - Checking if can review case:', caseId)
    return this.client.get(`/reviews/case/${caseId}/can-review`)
  }

  async getPendingReviews() {
    console.log('⏳ API Client - Getting pending reviews')
    return this.client.get('/reviews/pending')
  }

  // Subscription Methods
  async upgradeSubscription(tier: 'normal' | 'pro') {
    console.log('💳 API Client - Upgrading subscription to:', tier)
    return this.client.post('/subscriptions/upgrade', {
      tier_id: tier,
      payment_method: 'pending',
      auto_renew: false
    })
  }

  async getSubscriptionTiers() {
    console.log('📋 API Client - Getting subscription tiers')
    return this.client.get('/subscriptions/tiers')
  }

  async getMySubscription() {
    console.log('📋 API Client - Getting my subscription')
    return this.client.get('/subscriptions/my-subscription')
  }

  // Points Methods
  async getPointsBalance() {
    console.log('💰 API Client - Getting points balance')
    return this.client.get('/points/balance')
  }

  async checkCaseAccess(caseId: string, caseBudget: number) {
    console.log('🔍 API Client - Checking case access:', caseId)
    return this.client.post('/points/check-access', { case_id: caseId, case_budget: caseBudget })
  }

  async spendPointsForCase(caseId: string, caseBudget: number) {
    console.log('💸 API Client - Spending points for case:', caseId)
    return this.client.post('/points/spend', { case_id: caseId, case_budget: caseBudget })
  }

  async getPointsTransactions(limit?: number, offset?: number) {
    console.log('📜 API Client - Getting points transactions')
    const params: any = {}
    if (limit) params.limit = limit
    if (offset) params.offset = offset
    return this.client.get('/points/transactions', { params })
  }

  async getAccessedCases() {
    console.log('📋 API Client - Getting accessed cases')
    return this.client.get('/points/accessed-cases')
  }

  // Bidding Methods
  async canBidOnCase(caseId: string) {
    console.log('🔍 API Client - Checking if can bid on case:', caseId)
    return this.client.get(`/bidding/case/${caseId}/can-bid`)
  }

  async placeBid(caseId: string, proposedBudgetRange: string, bidComment?: string) {
    console.log('💸 API Client - Placing bid on case:', caseId, 'with budget range:', proposedBudgetRange)
    return this.client.post(`/bidding/case/${caseId}/bid`, {
      proposed_budget_range: proposedBudgetRange,
      bid_comment: bidComment
    })
  }

  async getCaseBids(caseId: string, includeProviderInfo: boolean = false) {
    console.log('📋 API Client - Getting bids for case:', caseId)
    return this.client.get(`/bidding/case/${caseId}/bids`, { 
      params: { includeProviderInfo } 
    })
  }

  async selectWinningBid(caseId: string, winningBidId: string) {
    console.log('🏆 API Client - Selecting winning bid:', winningBidId)
    return this.client.post(`/bidding/case/${caseId}/select-winner`, { 
      winning_bid_id: winningBidId 
    })
  }

  async getMyBids(status?: string) {
    console.log('📜 API Client - Getting my bids')
    const params: any = {}
    if (status) params.status = status
    return this.client.get('/bidding/my-bids', { params })
  }

  async cancelBid(bidId: string) {
    console.log('❌ API Client - Cancelling bid:', bidId)
    return this.client.delete(`/bidding/bid/${bidId}`)
  }

  // ============ Location API ============

  async getCities() {
    console.log('📍 API Client - Getting cities')
    return this.client.get('/locations/cities')
  }

  async getNeighborhoods(city: string) {
    console.log('📍 API Client - Getting neighborhoods for:', city)
    return this.client.get(`/locations/neighborhoods/${encodeURIComponent(city)}`)
  }

  async getAllLocations() {
    console.log('📍 API Client - Getting all locations')
    return this.client.get('/locations/all')
  }

  async searchLocations(query: string, type?: 'city' | 'neighborhood') {
    console.log('📍 API Client - Searching locations:', query)
    const params: any = { q: query }
    if (type) params.type = type
    return this.client.get('/locations/search', { params })
  }

  // ============ Free Inspection API ============

  async getFreeInspectionStatus() {
    console.log('🔧 API Client - Getting free inspection status')
    return this.client.get('/free-inspection/status')
  }

  async toggleFreeInspection(active: boolean) {
    console.log('🔧 API Client - Toggling free inspection:', active)
    return this.client.post('/free-inspection/toggle', { active })
  }

  async getFreeInspectionPreferences() {
    console.log('🔧 API Client - Getting free inspection preferences')
    return this.client.get('/free-inspection/preferences')
  }

  async updateFreeInspectionPreferences(preferences: {
    enabled?: boolean
    radiusKm?: number
    categories?: string[]
    showOnlyFreeInspection?: boolean
    latitude?: number
    longitude?: number
  }) {
    console.log('🔧 API Client - Updating free inspection preferences:', preferences)
    return this.client.put('/free-inspection/preferences', preferences)
  }

  async getProvidersForMap(params: {
    latitude: number
    longitude: number
    radiusKm?: number
    category?: string
    freeInspectionOnly?: boolean
  }) {
    console.log('🔧 API Client - Getting providers for map:', params)
    const queryParams: any = {
      latitude: params.latitude,
      longitude: params.longitude,
    }
    if (params.radiusKm) queryParams.radiusKm = params.radiusKm
    if (params.category) queryParams.category = params.category
    if (params.freeInspectionOnly) queryParams.freeInspectionOnly = 'true'
    return this.client.get('/free-inspection/providers', { params: queryParams })
  }

  // ============ Account Management ============

  async deleteAccount(password: string) {
    console.log('🗑️ API Client - Deleting account')
    return this.client.delete('/auth/delete-account', { data: { password } })
  }
}

// Export singleton instance
export const apiClient = new ApiClient()
export default apiClient

