import AsyncStorage from '@react-native-async-storage/async-storage';

// API Configuration
const API_BASE_URL = 'https://maystorfix.com/api/v1';
const API_TIMEOUT = 10000;

// Types
interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  role: 'tradesperson' | 'employee' | 'admin' | 'customer' | 'service_provider';
  businessId?: string;
  isGdprCompliant: boolean;
}

export class ApiService {
  private static instance: ApiService;
  private authToken: string | null = null;

  private tokenLoaded: Promise<void>;

  private constructor() {
    this.tokenLoaded = this.loadAuthToken();
  }

  public static getInstance(): ApiService {
    if (!ApiService.instance) {
      ApiService.instance = new ApiService();
    }
    return ApiService.instance;
  }

  private async loadAuthToken(): Promise<void> {
    try {
      this.authToken = await AsyncStorage.getItem('auth_token');
    } catch (error) {
      console.error('Error loading auth token:', error);
    }
  }

  private async saveAuthToken(token: string): Promise<void> {
    try {
      this.authToken = token;
      await AsyncStorage.setItem('auth_token', token);
    } catch (error) {
      console.error('Error saving auth token:', error);
    }
  }

  public async setAuthToken(token: string): Promise<void> {
    await this.saveAuthToken(token);
  }

  public async getAuthToken(): Promise<string | null> {
    await this.tokenLoaded;
    return this.authToken;
  }

  public async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<APIResponse<T>> {
    try {
      // Ensure token is loaded before making request
      await this.tokenLoaded;
      
      const url = `${API_BASE_URL}${endpoint}`;
      console.log('makeRequest - URL:', url);
      console.log('makeRequest - Auth token present:', !!this.authToken);
      const headers: any = {
        'Content-Type': 'application/json',
        ...options.headers,
      };

      if (this.authToken) {
        headers.Authorization = `Bearer ${this.authToken}`;
      } else {
        console.warn('⚠️ makeRequest - No auth token available for:', endpoint);
      }

      const response = await fetch(url, {
        ...options,
        headers,
      });

      console.log('makeRequest - Response status:', response.status);
      console.log('makeRequest - Response ok:', response.ok);

      const data: any = await response.json();
      console.log('makeRequest - Response data:', data);

      if (!response.ok) {
        console.log('makeRequest - Response not ok, returning error');
        return {
          success: false,
          error: {
            code: data.error?.code || 'API_ERROR',
            message: data.error?.message || 'An error occurred',
          },
        };
      }

      console.log('makeRequest - Response ok, returning success');
      return {
        success: true,
        data: data.data || data,
      };
    } catch (error) {
      console.error('makeRequest - API request failed:', error);
      return {
        success: false,
        error: {
          code: 'NETWORK_ERROR',
          message: error instanceof Error ? error.message : 'Network error',
        },
      };
    }
  }

  // Generic HTTP methods
  public async get<T = any>(endpoint: string): Promise<APIResponse<T>> {
    return this.makeRequest<T>(endpoint, { method: 'GET' });
  }

  public async post<T = any>(endpoint: string, data?: any): Promise<APIResponse<T>> {
    return this.makeRequest<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  public async put<T = any>(endpoint: string, data?: any): Promise<APIResponse<T>> {
    return this.makeRequest<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  public async delete<T = any>(endpoint: string): Promise<APIResponse<T>> {
    return this.makeRequest<T>(endpoint, { method: 'DELETE' });
  }

  // Authentication Methods
  public async login(email: string, password: string): Promise<APIResponse<{ user: User; tokens: any }>> {
    const response = await this.makeRequest<any>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    if (response.success && response.data?.tokens?.accessToken) {
      await this.saveAuthToken(response.data.tokens.accessToken);
    }

    return response as APIResponse<{ user: User; tokens: any }>;
  }

  public async getCurrentUser(): Promise<APIResponse<User>> {
    return this.makeRequest('/auth/me');
  }

  public async logout(): Promise<APIResponse<any>> {
    // IMPORTANT: Deactivate FCM token BEFORE clearing auth token
    // This ensures the device won't receive notifications for the old user
    try {
      console.log('🔒 Logout - Deactivating FCM token...');
      const FCMService = require('./FCMService').default;
      await FCMService.getInstance().deleteToken();
      console.log('✅ Logout - FCM token deactivated');
    } catch (fcmError) {
      console.warn('⚠️ Logout - Error deactivating FCM token:', fcmError);
      // Continue with logout even if FCM fails
    }

    const response = await this.makeRequest('/auth/logout', {
      method: 'POST',
    });
    
    // Clear the auth token and cached user data
    this.authToken = null;
    await AsyncStorage.removeItem('auth_token');
    await AsyncStorage.removeItem('user'); // Clear cached user data
    
    return response;
  }

  // Password Reset Methods
  public async requestPasswordReset(email: string): Promise<APIResponse<{ message: string }>> {
    return this.makeRequest('/auth/password-reset-request', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  public async resetPassword(token: string, newPassword: string): Promise<APIResponse<{ message: string }>> {
    return this.makeRequest('/auth/password-reset', {
      method: 'POST',
      body: JSON.stringify({ token, newPassword }),
    });
  }

  // Health Check
  public async healthCheck(): Promise<APIResponse<{ status: string; timestamp: string }>> {
    return this.makeRequest('/health');
  }

  // User Registration
  public async register(userData: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phoneNumber: string;
    serviceCategory?: string;
    companyName?: string;
    neighborhood?: string;
    role: 'tradesperson';
    gdprConsents?: string[];
  }): Promise<APIResponse<{ user: User; tokens: any }>> {
    console.log('ApiService register - sending data:', userData);
    const response = await this.makeRequest<any>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });

    console.log('ApiService register - received response:', response);

    if (response.success && response.data?.tokens?.accessToken) {
      console.log('ApiService register - saving auth token');
      await this.saveAuthToken(response.data.tokens.accessToken);
    }

    return response as APIResponse<{ user: User; tokens: any }>;
  }

  // Sync Missed Calls to Backend
  public async syncMissedCalls(missedCalls: any[]): Promise<APIResponse<any>> {
    return this.makeRequest('/sync/missed-calls', {
      method: 'POST',
      body: JSON.stringify({ missedCalls }),
    });
  }

  // Get Missed Calls from Backend
  public async getMissedCalls(userId?: string): Promise<APIResponse<any>> {
    const url = userId ? `/missed-calls?userId=${userId}` : '/missed-calls';
    return this.makeRequest(url);
  }

  // Sync SMS Data to Backend
  public async syncSMSSent(smsData: any[]): Promise<APIResponse<any>> {
    return this.makeRequest('/sync/sms-sent', {
      method: 'POST',
      body: JSON.stringify({ smsData }),
    });
  }

  // Get Dashboard Statistics
  public async getDashboardStats(userId?: string): Promise<APIResponse<any>> {
    const url = userId ? `/dashboard/stats?userId=${userId}` : '/dashboard/stats';
    return this.makeRequest(url);
  }

  public isAuthenticated(): boolean {
    return this.authToken !== null;
  }

  // Chat Methods - Using Chat API V2 (matches web app)
  public async getConversations(): Promise<APIResponse> {
    console.log('📱 ApiService - Getting conversations via Chat API V2');
    // Chat API V2 automatically gets conversations for authenticated user
    // No need to pass userId - it's extracted from auth token
    return this.makeRequest(`/chat/conversations`);
  }

  /**
   * Create a new conversation with a provider
   * Used when starting a chat from search/profile view
   */
  public async createConversation(data: {
    providerId: string;
    customerName: string;
    customerEmail: string;
    customerPhone?: string;
    initialMessage?: string;
    chatSource?: string;
  }): Promise<APIResponse> {
    console.log('📱 ApiService - Creating new conversation with provider:', data.providerId);
    return this.makeRequest('/chat/conversations', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  public async getMessages(conversationId: string): Promise<APIResponse> {
    // Use marketplace type by default for now as it matches the V2 structure
    return this.getConversationMessages(conversationId, 'marketplace');
  }

  public async getConversationMessages(
    conversationId: string, 
    conversationType: 'phone' | 'marketplace'
  ): Promise<APIResponse> {
    console.log('📱 ApiService - Getting messages for conversation:', conversationId, 'type:', conversationType);
    
    if (conversationType === 'marketplace') {
      // Use marketplace endpoint
      return this.makeRequest(`/chat/conversations/${conversationId}/messages`);
    } else {
      // Use phone/unified endpoint
      return this.makeRequest(`/chat/unified/${conversationId}/messages?conversationType=${conversationType}`);
    }
  }

  public async sendMessage(conversationId: string, messageData: {
    text: string;
    platform?: string;
    conversationType?: 'phone' | 'marketplace';
  }): Promise<APIResponse> {
    const conversationType = messageData.conversationType || 'phone';
    
    if (conversationType === 'marketplace') {
      // For marketplace conversations, use the marketplace message format
      // Get current user info for sender name
      let senderName = 'Service Provider';
      try {
        const userResponse = await this.getCurrentUser();
        const user: any = (userResponse.data as any)?.user || userResponse.data;
        if (userResponse.success && user?.firstName) {
          senderName = `${user.firstName} ${user.lastName}`;
        }
      } catch (error) {
        console.warn('Could not get current user for sender name:', error);
      }

      const data = {
        conversationId,
        senderType: 'provider' as const,
        senderName,
        message: messageData.text,
      };
      
      console.log('📱 ApiService - Sending marketplace message');
      return this.makeRequest('/chat/messages', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    } else {
      // For phone conversations, use the phone message format
      console.log('📱 ApiService - Sending phone message');
      return this.makeRequest('/messaging/send', {
        method: 'POST',
        body: JSON.stringify({
          conversationId,
          message: messageData.text,
          platform: messageData.platform || 'viber'
        }),
      });
    }
  }

  public async sendMarketplaceMessage(data: {
    conversationId: string;
    senderType: 'customer' | 'provider';
    senderName: string;
    message: string;
  }): Promise<APIResponse> {
    console.log('📱 ApiService - Sending marketplace message');
    return this.makeRequest('/chat/messages', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  public async markMessagesAsRead(
    conversationId: string, 
    senderType: 'customer' | 'provider'
  ): Promise<APIResponse> {
    console.log('📱 ApiService - Marking messages as read');
    return this.makeRequest(`/chat/conversations/${conversationId}/read`, {
      method: 'POST',
      body: JSON.stringify({ senderType }),
    });
  }

  public async requestHandoff(conversationId: string): Promise<APIResponse> {
    console.log('📱 ApiService - Requesting handoff for conversation:', conversationId);
    return this.makeRequest(`/chat/conversations/${conversationId}/handoff`, {
      method: 'POST',
    });
  }

  // Provider Profile - Create/Update
  public async upsertProviderProfile(payload: {
    userId: string;
    profile: any;
    gallery?: string[];
    certificates?: Array<{ title?: string; fileUrl?: string; issuedBy?: string; issuedAt?: string }>
  }): Promise<APIResponse> {
    return this.makeRequest('/marketplace/providers/profile', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  // Marketplace - Service Categories
  public async getServiceCategories(): Promise<APIResponse<any[]>> {
    return this.makeRequest('/marketplace/categories');
  }

  public async searchProviders(params: {
    lat?: number;
    lng?: number;
    radius?: number;
    category?: string;
    city?: string;
    neighborhood?: string;
    limit?: number;
    t?: number;
  }): Promise<APIResponse> {
    console.log('🔍 ApiService - Searching providers:', params);
    const queryString = new URLSearchParams(params as any).toString();
    // Using the endpoint from memory/web app
    return this.makeRequest(`/marketplace/providers/search?${queryString}`);
  }

  public async closeConversation(conversationId: string): Promise<APIResponse> {
    console.log('📱 ApiService - Closing conversation:', conversationId);
    return this.makeRequest(`/chat/conversations/${conversationId}/close`, {
      method: 'POST',
    });
  }

  // Case Management Methods
  public async createCase(caseData: any): Promise<APIResponse> {
    console.log('📝 ApiService - Creating case:', caseData);
    return this.makeRequest('/cases', {
      method: 'POST',
      body: JSON.stringify(caseData),
    });
  }

  public async getCasesWithFilters(filters: {
    status?: string;
    category?: string;
    city?: string;
    neighborhood?: string;
    providerId?: string;
    customerId?: string;
    onlyUnassigned?: string;
    excludeDeclinedBy?: string;
    excludeBiddedBy?: string;
    assignedSpId?: string;
    negotiationStatus?: string;
    page?: number;
    limit?: number;
  }): Promise<APIResponse> {
    console.log('📋 ApiService - Getting cases with filters:', filters);
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        params.append(key, value.toString());
      }
    });
    const url = `/cases?${params.toString()}`;
    console.log('📋 ApiService - Request URL:', url);
    const response = await this.makeRequest(url);
    console.log('📋 ApiService - Cases response:', {
      success: response.success,
      hasData: !!response.data,
      dataKeys: response.data ? Object.keys(response.data as any) : [],
      casesCount: (response.data as any)?.cases?.length || 0
    });
    return response;
  }

  public async getCaseStats(providerId?: string): Promise<APIResponse> {
    console.log('📊 ApiService - Getting case stats for provider:', providerId);
    const params = providerId ? `?providerId=${providerId}` : '';
    return this.makeRequest(`/cases/stats${params}`);
  }

  public async getCaseStatsByChatSource(providerId?: string): Promise<APIResponse> {
    console.log('📊 ApiService - Getting case stats by chat source for provider:', providerId);
    const params = providerId ? `?providerId=${providerId}` : '';
    return this.makeRequest(`/cases/stats/chat-source${params}`);
  }

  public async acceptCase(caseId: string, providerId: string, providerName: string): Promise<APIResponse> {
    console.log('✅ ApiService - Accepting case:', caseId, 'by provider:', providerId, providerName);
    const response = await this.makeRequest(`/cases/${caseId}/accept`, {
      method: 'POST',
      body: JSON.stringify({ providerId, providerName }),
    });
    console.log('✅ ApiService - Accept case response:', response);
    return response;
  }

  public async declineCase(caseId: string, providerId: string, reason?: string): Promise<APIResponse> {
    console.log('🚫 ApiService - Declining case:', caseId, 'by provider:', providerId, 'reason:', reason);
    const response = await this.makeRequest(`/cases/${caseId}/decline`, {
      method: 'POST',
      body: JSON.stringify({ providerId, reason }),
    });
    console.log('🚫 ApiService - Decline case response:', response);
    return response;
  }

  public async undeclineCase(caseId: string, providerId: string): Promise<APIResponse> {
    console.log('✅ ApiService - Un-declining case:', caseId);
    return this.makeRequest(`/cases/${caseId}/undecline`, {
      method: 'POST',
      body: JSON.stringify({ providerId }),
    });
  }

  public async getDeclinedCases(providerId: string): Promise<APIResponse> {
    console.log('🚫 ApiService - Getting declined cases for provider:', providerId);
    return this.makeRequest(`/cases/declined/${providerId}`);
  }

  public async completeCase(caseId: string, completionNotes?: string, income?: {
    amount: number;
    paymentMethod?: string;
    notes?: string;
  }): Promise<APIResponse> {
    console.log('🏁 ApiService - Completing case:', caseId, 'notes:', completionNotes, 'income:', income);
    const response = await this.makeRequest(`/cases/${caseId}/complete`, {
      method: 'POST',
      body: JSON.stringify({ completionNotes, income }),
    });
    console.log('🏁 ApiService - Complete case response:', response);
    return response;
  }

  public async updateCaseStatus(caseId: string, status: string, message?: string): Promise<APIResponse> {
    console.log('📋 ApiService - Updating case status:', caseId, status);
    return this.makeRequest(`/cases/${caseId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status, message }),
    });
  }

  public async getCase(caseId: string): Promise<APIResponse> {
    console.log('📋 ApiService - Getting case:', caseId);
    return this.makeRequest(`/cases/${caseId}`);
  }

  // Income/Dashboard methods
  public async getIncomeStats(providerId: string, startDate?: string, endDate?: string): Promise<APIResponse> {
    console.log('💰 ApiService - Getting income stats for provider:', providerId);
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    const queryString = params.toString();
    return this.makeRequest(`/income/provider/${providerId}${queryString ? `?${queryString}` : ''}`);
  }

  public async getIncomeYears(providerId: string): Promise<APIResponse> {
    console.log('📅 ApiService - Getting income years for provider:', providerId);
    return this.makeRequest(`/income/provider/${providerId}/years`);
  }

  public async getIncomeTransactionsByMonth(providerId: string, month: string): Promise<APIResponse> {
    console.log('📊 ApiService - Getting income transactions for month:', month);
    return this.makeRequest(`/income/provider/${providerId}/month/${month}`);
  }

  // Points/Rewards methods
  public async getPoints(): Promise<APIResponse> {
    console.log('⭐ ApiService - Getting user points');
    return this.makeRequest('/points/balance');
  }

  public async getIncomeTransactions(providerId: string): Promise<APIResponse> {
    console.log('💵 ApiService - Getting income transactions for provider:', providerId);
    return this.makeRequest(`/income/provider/${providerId}/transactions`);
  }

  public async getIncomeTransactionsByMethod(providerId: string, paymentMethod: string): Promise<APIResponse> {
    console.log('💳 ApiService - Getting income transactions by method:', paymentMethod);
    return this.makeRequest(`/income/provider/${providerId}/method/${encodeURIComponent(paymentMethod)}`);
  }

  // Subscription methods
  public async getSubscriptionTiers(): Promise<APIResponse> {
    console.log('🎯 ApiService - Getting subscription tiers');
    return this.makeRequest('/subscriptions/tiers');
  }

  public async getTierComparison(): Promise<APIResponse> {
    console.log('📊 ApiService - Getting tier comparison');
    return this.makeRequest('/subscriptions/tiers/comparison');
  }

  public async getMySubscription(): Promise<APIResponse> {
    console.log('💎 ApiService - Getting my subscription');
    return this.makeRequest('/subscriptions/my-subscription');
  }

  public async upgradeSubscription(tierId: string, paymentMethod?: string, autoRenew?: boolean): Promise<APIResponse> {
    console.log('⬆️ ApiService - Upgrading subscription to:', tierId);
    return this.makeRequest('/subscriptions/upgrade', {
      method: 'POST',
      body: JSON.stringify({ tier_id: tierId, payment_method: paymentMethod, auto_renew: autoRenew }),
    });
  }

  public async cancelSubscription(subscriptionId: string, reason?: string, immediate?: boolean): Promise<APIResponse> {
    console.log('❌ ApiService - Cancelling subscription:', subscriptionId);
    return this.makeRequest('/subscriptions/cancel', {
      method: 'POST',
      body: JSON.stringify({ subscription_id: subscriptionId, reason, immediate }),
    });
  }

  public async checkFeatureAccess(feature: string): Promise<APIResponse> {
    console.log('🔍 ApiService - Checking feature access:', feature);
    return this.makeRequest(`/subscriptions/feature-access/${feature}`);
  }

  // Points methods
  public async getPointsBalance(): Promise<APIResponse> {
    console.log('💰 ApiService - Getting points balance');
    return this.makeRequest('/points/balance');
  }

  public async checkCaseAccess(caseId: string, caseBudget: number): Promise<APIResponse> {
    console.log('🔍 ApiService - Checking case access:', caseId);
    return this.makeRequest('/points/check-access', {
      method: 'POST',
      body: JSON.stringify({ case_id: caseId, case_budget: caseBudget }),
    });
  }

  public async spendPointsForCase(caseId: string, caseBudget: number): Promise<APIResponse> {
    console.log('💸 ApiService - Spending points for case:', caseId);
    return this.makeRequest('/points/spend', {
      method: 'POST',
      body: JSON.stringify({ case_id: caseId, case_budget: caseBudget }),
    });
  }

  public async getPointsTransactions(limit?: number, offset?: number): Promise<APIResponse> {
    console.log('📜 ApiService - Getting points transactions');
    const params = new URLSearchParams();
    if (limit) params.append('limit', limit.toString());
    if (offset) params.append('offset', offset.toString());
    return this.makeRequest(`/points/transactions?${params.toString()}`);
  }

  public async getAccessedCases(): Promise<APIResponse> {
    console.log('📋 ApiService - Getting accessed cases');
    return this.makeRequest('/points/accessed-cases');
  }

  // Bidding methods
  public async canBidOnCase(caseId: string): Promise<APIResponse> {
    console.log('🎯 ApiService - Checking if can bid on case:', caseId);
    return this.makeRequest(`/bidding/case/${caseId}/can-bid`);
  }

  public async placeBid(
    caseId: string, 
    proposedBudgetRange: string, 
    bidComment?: string
  ): Promise<APIResponse> {
    console.log('💰 ApiService - Placing bid on case:', caseId, 'with budget:', proposedBudgetRange);
    return this.makeRequest(`/bidding/case/${caseId}/bid`, {
      method: 'POST',
      body: JSON.stringify({
        proposed_budget_range: proposedBudgetRange,
        bid_comment: bidComment
      }),
    });
  }

  public async getCaseBids(caseId: string, includeProviderInfo: boolean = false): Promise<APIResponse> {
    console.log('👥 ApiService - Getting bids for case:', caseId);
    return this.makeRequest(`/bidding/case/${caseId}/bids?includeProviderInfo=${includeProviderInfo}`);
  }

  public async selectWinningBid(caseId: string, bidId: string): Promise<APIResponse> {
    console.log('✅ ApiService - Selecting winning bid:', bidId);
    return this.makeRequest(`/bidding/case/${caseId}/select-winner`, {
      method: 'POST',
      body: JSON.stringify({ winning_bid_id: bidId }),
    });
  }

  public async getMyBids(): Promise<APIResponse> {
    console.log('📋 ApiService - Getting my bids');
    return this.makeRequest('/bidding/my-bids');
  }

  // Tracking Methods
  public async updateLocation(data: {
    caseId?: string;
    latitude: number;
    longitude: number;
    heading?: number;
    speed?: number;
  }): Promise<APIResponse> {
    console.log('📍 ApiService - Updating location:', data);
    return this.makeRequest('/tracking/update', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // ============ Location Schedule API ============

  /**
   * Get location schedule settings
   */
  public async getLocationSchedule(): Promise<APIResponse> {
    console.log('📅 ApiService - Getting location schedule');
    return this.makeRequest('/tracking/schedule', { method: 'GET' });
  }

  /**
   * Update location schedule settings
   */
  public async updateLocationSchedule(data: {
    schedule_enabled?: boolean;
    start_time?: string;
    end_time?: string;
    disable_weekends?: boolean;
    monday_enabled?: boolean;
    tuesday_enabled?: boolean;
    wednesday_enabled?: boolean;
    thursday_enabled?: boolean;
    friday_enabled?: boolean;
    saturday_enabled?: boolean;
    sunday_enabled?: boolean;
  }): Promise<APIResponse> {
    console.log('📅 ApiService - Updating location schedule:', data);
    return this.makeRequest('/tracking/schedule', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  /**
   * Check if location sharing should be active based on schedule
   */
  public async checkLocationSchedule(): Promise<APIResponse> {
    console.log('📅 ApiService - Checking location schedule');
    return this.makeRequest('/tracking/schedule/check', { method: 'GET' });
  }

  // ============ Location API ============

  /**
   * Get all Bulgarian cities
   */
  public async getCities(): Promise<APIResponse> {
    console.log('📍 ApiService - Fetching cities');
    return this.makeRequest('/locations/cities', { method: 'GET' });
  }

  /**
   * Get neighborhoods for a specific city
   */
  public async getNeighborhoods(city: string): Promise<APIResponse> {
    console.log('📍 ApiService - Fetching neighborhoods for:', city);
    return this.makeRequest(`/locations/neighborhoods/${encodeURIComponent(city)}`, { method: 'GET' });
  }

  /**
   * Get all locations (cities and neighborhoods) for caching
   */
  public async getAllLocations(): Promise<APIResponse> {
    console.log('📍 ApiService - Fetching all locations');
    return this.makeRequest('/locations/all', { method: 'GET' });
  }

  /**
   * Search locations by query
   */
  public async searchLocations(query: string, type?: 'city' | 'neighborhood'): Promise<APIResponse> {
    console.log('📍 ApiService - Searching locations:', query, type);
    const params = new URLSearchParams({ q: query });
    if (type) params.append('type', type);
    return this.makeRequest(`/locations/search?${params.toString()}`, { method: 'GET' });
  }

  /**
   * Find nearest neighborhood based on coordinates
   */
  public async getNearestNeighborhood(lat: number, lng: number, city?: string): Promise<APIResponse> {
    console.log('📍 ApiService - Finding nearest neighborhood:', { lat, lng, city });
    const params = new URLSearchParams({ lat: lat.toString(), lng: lng.toString() });
    if (city) params.append('city', city);
    return this.makeRequest(`/locations/nearest-neighborhood?${params.toString()}`, { method: 'GET' });
  }

  /**
   * Get cases for map view (for providers)
   */
  public async getCasesForMap(latitude: number, longitude: number, radius?: number, category?: string): Promise<APIResponse> {
    console.log('📍 ApiService - Fetching cases for map:', { latitude, longitude, radius, category });
    const params = new URLSearchParams({
      latitude: latitude.toString(),
      longitude: longitude.toString(),
    });
    if (radius) params.append('radius', radius.toString());
    if (category) params.append('category', category);
    return this.makeRequest(`/cases/map?${params.toString()}`, { method: 'GET' });
  }

  // ============ Free Inspection API ============

  /**
   * Get service categories list
   */
  public async getServiceCategories(): Promise<APIResponse> {
    console.log('🔧 ApiService - Fetching service categories');
    return this.makeRequest('/free-inspection/categories', { method: 'GET' });
  }

  /**
   * SP: Get free inspection status
   */
  public async getFreeInspectionStatus(): Promise<APIResponse> {
    console.log('🔧 ApiService - Getting free inspection status');
    return this.makeRequest('/free-inspection/status', { method: 'GET' });
  }

  /**
   * SP: Toggle free inspection mode
   */
  public async toggleFreeInspection(active: boolean): Promise<APIResponse> {
    console.log('🔧 ApiService - Toggling free inspection:', active);
    return this.makeRequest('/free-inspection/toggle', {
      method: 'POST',
      body: JSON.stringify({ active }),
    });
  }

  /**
   * Customer: Get free inspection preferences
   */
  public async getFreeInspectionPreferences(): Promise<APIResponse> {
    console.log('🔧 ApiService - Getting free inspection preferences');
    return this.makeRequest('/free-inspection/preferences', { method: 'GET' });
  }

  /**
   * Customer: Update free inspection preferences
   */
  public async updateFreeInspectionPreferences(preferences: {
    enabled?: boolean;
    radiusKm?: number;
    categories?: string[];
    showOnlyFreeInspection?: boolean;
    latitude?: number;
    longitude?: number;
  }): Promise<APIResponse> {
    console.log('🔧 ApiService - Updating free inspection preferences:', preferences);
    return this.makeRequest('/free-inspection/preferences', {
      method: 'PUT',
      body: JSON.stringify(preferences),
    });
  }

  /**
   * Get providers for map with free inspection filter
   */
  public async getProvidersForMap(params: {
    latitude: number;
    longitude: number;
    radiusKm?: number;
    category?: string;
    freeInspectionOnly?: boolean;
  }): Promise<APIResponse> {
    console.log('🔧 ApiService - Fetching providers for map:', params);
    const queryParams = new URLSearchParams({
      latitude: params.latitude.toString(),
      longitude: params.longitude.toString(),
    });
    if (params.radiusKm) queryParams.append('radiusKm', params.radiusKm.toString());
    if (params.category) queryParams.append('category', params.category);
    if (params.freeInspectionOnly) queryParams.append('freeInspectionOnly', 'true');
    return this.makeRequest(`/free-inspection/providers?${queryParams.toString()}`, { method: 'GET' });
  }

  // ============ Direct Assignment Negotiation API ============

  /**
   * SP responds to a direct assignment request
   */
  public async spRespondToDirectAssignment(
    caseId: string,
    action: 'accept' | 'decline' | 'counter',
    counterBudget?: string,
    message?: string
  ): Promise<APIResponse> {
    console.log('📋 ApiService - SP responding to direct assignment:', { caseId, action, counterBudget });
    return this.makeRequest(`/direct-assignment/${caseId}/sp-respond`, {
      method: 'POST',
      body: JSON.stringify({ action, counterBudget, message }),
    });
  }

  /**
   * Customer responds to SP's counter-offer
   */
  public async customerRespondToCounterOffer(
    caseId: string,
    action: 'accept' | 'decline'
  ): Promise<APIResponse> {
    console.log('📋 ApiService - Customer responding to counter-offer:', { caseId, action });
    return this.makeRequest(`/direct-assignment/${caseId}/customer-respond`, {
      method: 'POST',
      body: JSON.stringify({ action }),
    });
  }

  /**
   * Customer sends declined case to marketplace
   */
  public async sendCaseToMarketplace(caseId: string): Promise<APIResponse> {
    console.log('📋 ApiService - Sending case to marketplace:', caseId);
    return this.makeRequest(`/direct-assignment/${caseId}/send-to-marketplace`, {
      method: 'POST',
    });
  }

  /**
   * Customer cancels a case
   */
  public async cancelCase(caseId: string): Promise<APIResponse> {
    console.log('📋 ApiService - Cancelling case:', caseId);
    return this.makeRequest(`/direct-assignment/${caseId}/cancel`, {
      method: 'POST',
    });
  }
}

export default ApiService;