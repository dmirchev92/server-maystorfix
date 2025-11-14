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
  role: 'tradesperson' | 'employee' | 'admin';
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
    const response = await this.makeRequest('/auth/logout', {
      method: 'POST',
    });
    
    // Clear the auth token and cached user data
    this.authToken = null;
    await AsyncStorage.removeItem('auth_token');
    await AsyncStorage.removeItem('user'); // Clear cached user data
    
    return response;
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
      method: 'PUT',
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

  public async closeConversation(conversationId: string): Promise<APIResponse> {
    console.log('📱 ApiService - Closing conversation:', conversationId);
    return this.makeRequest(`/chat/conversations/${conversationId}/close`, {
      method: 'POST',
    });
  }

  // Case Management Methods
  public async getCasesWithFilters(filters: {
    status?: string;
    category?: string;
    city?: string;
    neighborhood?: string;
    providerId?: string;
    customerId?: string;
    onlyUnassigned?: string;
    excludeDeclinedBy?: string;
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
      dataKeys: response.data ? Object.keys(response.data) : [],
      casesCount: response.data?.cases?.length || 0
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
        proposedBudgetRange,
        bidComment
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
      body: JSON.stringify({ bidId }),
    });
  }

  public async getMyBids(): Promise<APIResponse> {
    console.log('📋 ApiService - Getting my bids');
    return this.makeRequest('/bidding/my-bids');
  }
}

export default ApiService;