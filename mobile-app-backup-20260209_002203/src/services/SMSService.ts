import { Logger } from '../utils/Logger';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ContactService } from './ContactService';
import ApiService from './ApiService';

interface SMSConfig {
  isEnabled: boolean;
  message: string;
  lastSentTime?: number;
  sentCount: number;
  sentCallIds: string[]; // Track which call IDs have had SMS sent
  filterKnownContacts: boolean; // Only send SMS to unknown numbers
  userChatLinks?: { [userId: string]: { link: string; token: string } }; // Per-user chat links
  sentToNumbers?: { [phoneNumber: string]: number }; // Track last SMS time per phone number for spam prevention
}

// Spam prevention: cooldown period in milliseconds (30 minutes)
const SMS_COOLDOWN_MS = 30 * 60 * 1000;

interface SMSPermissions {
  SEND_SMS: boolean;
  hasAllPermissions: boolean;
}

export class SMSService {
  private static instance: SMSService;
  private config: SMSConfig = {
    isEnabled: false, // SMS OFF by default - users must explicitly enable
    message: 'Zaet sum, shte vurna obajdane sled nqkolko minuti.\n\nZapochnete chat tuk:\n[chat_link]\n\n', // Template with [chat_link] placeholder
    sentCount: 0,
    sentCallIds: [],
    filterKnownContacts: false, // Default to false - will be enabled only if permission is granted
    userChatLinks: {}, // Per-user chat links
    sentToNumbers: {}, // Track last SMS time per phone number for spam prevention
  };

  private constructor() {
    this.loadConfig();
    // Don't initialize chat link on startup - wait for user to be authenticated
  }

  public static getInstance(): SMSService {
    if (!SMSService.instance) {
      SMSService.instance = new SMSService();
    }
    return SMSService.instance;
  }

  private async loadConfig(): Promise<void> {
    try {
      // Try to load from API first (synchronized with web app)
      const userId = await this.getCurrentUserIdAsync();
      
      if (userId) {
        try {
          const apiConfig = await this.loadConfigFromAPI(userId);
          if (apiConfig) {
            this.config = { ...this.config, ...apiConfig };
            Logger.debug('📱 SMS config loaded from API (synchronized):', this.config);
            // Cache to AsyncStorage for offline access
            await AsyncStorage.setItem('sms_config', JSON.stringify(this.config));
            return;
          }
        } catch (apiError) {
          Logger.warn('⚠️ Could not load from API, falling back to local storage:', apiError);
        }
      }
      
      // Fallback to AsyncStorage (offline mode or not authenticated)
      const savedConfig = await AsyncStorage.getItem('sms_config');
      if (savedConfig) {
        this.config = { ...this.config, ...JSON.parse(savedConfig) };
        Logger.debug('📱 SMS config loaded from local storage:', this.config);
      }
      
      // Initialize user chat links storage if needed
      if (!this.config.userChatLinks) {
        this.config.userChatLinks = {};
      }
    } catch (error) {
      Logger.error('❌ Error loading SMS config:', error);
    }
  }

  /**
   * Initialize chat link for current device/user (works without authentication)
   */
  private async initializeCurrentUserChatLink(): Promise<void> {
    try {
      Logger.debug('🔗 Starting chat link initialization...');
      
      // Try to get authenticated user ID first
      let userId = await this.getCurrentUserIdAsync();
      
      // If not authenticated, use device-based ID for automatic SMS functionality
      if (!userId) {
        userId = await this.getOrCreateDeviceUserId();
        Logger.debug('🔗 Using device-based user ID for automatic SMS:', userId);
      } else {
        Logger.debug('🔗 Using authenticated user ID:', userId);
      }
      
      if (userId) {
        await this.ensureUserChatLink(userId);
        Logger.debug('✅ Chat link initialization completed for user:', userId);
      }
      
    } catch (error) {
      Logger.error('⚠️ Could not initialize chat link:', error);
    }
  }

  /**
   * Get or create a device-based user ID for automatic SMS functionality
   */
  private async getOrCreateDeviceUserId(): Promise<string> {
    try {
      // Try to get stored device user ID
      const storedDeviceUserId = await AsyncStorage.getItem('device_user_id');
      
      if (storedDeviceUserId) {
        Logger.debug('📱 Using existing device user ID:', storedDeviceUserId);
        return storedDeviceUserId;
      }
      
      // Create new device-based user ID
      const deviceUserId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      await AsyncStorage.setItem('device_user_id', deviceUserId);
      Logger.debug('📱 Created new device user ID:', deviceUserId);
      
      return deviceUserId;
    } catch (error) {
      Logger.error('❌ Error managing device user ID:', error);
      // Fallback to timestamp-based ID
      return `device_${Date.now()}`;
    }
  }

  private async saveConfig(): Promise<void> {
    try {
      // Save to AsyncStorage first (immediate local backup)
      await AsyncStorage.setItem('sms_config', JSON.stringify(this.config));
      Logger.debug('💾 SMS config saved locally:', this.config);
      
      // Try to sync to API (synchronized with web app)
      const userId = await this.getCurrentUserIdAsync();
      if (userId) {
        try {
          await this.saveConfigToAPI(userId);
          Logger.debug('☁️ SMS config synced to server');
        } catch (apiError) {
          Logger.warn('⚠️ Could not sync to API (will retry later):', apiError);
        }
      }
    } catch (error) {
      Logger.error('❌ Error saving SMS config:', error);
    }
  }

  /**
   * Load SMS config from API (synchronized with web app)
   */
  private async loadConfigFromAPI(userId: string): Promise<Partial<SMSConfig> | null> {
    try {
      const response = await ApiService.getInstance().get('/sms/config');

      if (response.success && response.data?.config) {
        const apiConfig = response.data.config;
        Logger.debug('📥 Raw API config keys:', Object.keys(apiConfig));
        
        // Handle both camelCase (standard JSON) and snake_case (DB direct)
        return {
          isEnabled: apiConfig.isEnabled ?? apiConfig.is_enabled,
          message: apiConfig.message,
          sentCount: apiConfig.sentCount ?? apiConfig.sent_count,
          lastSentTime: apiConfig.lastSentTime ?? apiConfig.last_sent_time,
          filterKnownContacts: apiConfig.filterKnownContacts ?? apiConfig.filter_known_contacts,
          sentCallIds: [] // This is managed locally for now
        };
      }
      
      return null;
    } catch (error) {
      Logger.error('❌ Error loading config from API:', error);
      return null;
    }
  }

  /**
   * Save SMS config to API (synchronized with web app)
   */
  private async saveConfigToAPI(userId: string): Promise<void> {
    try {
      const response = await ApiService.getInstance().put('/sms/config', {
        isEnabled: this.config.isEnabled,
        message: this.config.message,
        filterKnownContacts: this.config.filterKnownContacts
      });

      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to save config');
      }
    } catch (error) {
      Logger.error('❌ Error saving config to API:', error);
      throw error;
    }
  }

  /**
   * Ensure there's always a current chat link ready for a specific user
   * Now fetches the latest valid token from backend (generated when previous token was used)
   */
  private async ensureUserChatLink(userId: string): Promise<void> {
    try {
      if (!this.config.userChatLinks) {
        this.config.userChatLinks = {};
      }

      // Get current token from new chat token system
      const tokenData = await this.getCurrentTokenFromBackend(userId);
      
      if (tokenData) {
        Logger.debug(`✅ Using current token from new system for user ${userId}: ${tokenData.token.substring(0, 4)}...`);
        
        this.config.userChatLinks[userId] = {
          link: tokenData.chatUrl,
          token: tokenData.token
        };
        await this.saveConfig();
        return;
      }

      // Fallback: If no valid token exists in backend, generate a new one
      Logger.debug(`🔄 No valid token found in backend for user ${userId}, generating new one`);
      await this.generateNewChatLinkForUser(userId);
      
    } catch (error) {
      Logger.error(`❌ Error ensuring chat link for user ${userId}:`, error);
      // Generate a new one as fallback
      await this.generateNewChatLinkForUser(userId);
    }
  }

  /**
   * Generate a new chat link for a specific user and update the config
   */
  private async generateNewChatLinkForUser(userId: string): Promise<void> {
    try {
      if (!this.config.userChatLinks) {
        this.config.userChatLinks = {};
      }

      // Initialize token system with backend
      const tokenData = await this.initializeChatTokenSystem(userId);
      
      if (tokenData) {
        Logger.debug(`✅ Generated new chat link via backend for user ${userId}`);
        this.config.userChatLinks[userId] = {
          link: tokenData.chatUrl,
          token: tokenData.token
        };
        await this.saveConfig();
        return;
      }

      Logger.warn(`⚠️ Backend token generation failed for user ${userId}, chat link not available`);
    } catch (error) {
      Logger.error(`❌ Error generating new chat link for user ${userId}:`, error);
    }
  }

  /**
   * Get current token from new chat token system
   */
  private async getCurrentTokenFromBackend(userId: string): Promise<{token: string, chatUrl: string} | null> {
    try {
      const response = await ApiService.getInstance().get('/chat/tokens/current');

      if (response.success && response.data) {
        return {
          token: response.data.token,
          chatUrl: response.data.chatUrl
        };
      }
      return null;
    } catch (error) {
      Logger.error('❌ Error getting current token:', error);
      return null;
    }
  }

  /**
   * Get current chat link for current user (for display purposes)
   * Now automatically refreshes from backend to get latest token
   */
  public async getCurrentChatLink(): Promise<string> {
    try {
      Logger.debug('🔍 Getting current chat link (refreshing from backend)...');
      
      // Get current user ID
      let userId = await this.getCurrentUserIdAsync();
      
      if (!userId) {
        userId = await this.getOrCreateDeviceUserId();
      }
      
      // Refresh token from backend first
      await this.ensureUserChatLink(userId);
      
      // Now return the refreshed link
      if (this.config.userChatLinks && this.config.userChatLinks[userId]) {
        const link = this.config.userChatLinks[userId].link;
        Logger.debug('🔗 Refreshed link for user', userId, ':', link);
        return link;
      }
      
      // Return helpful message when no link is available
      Logger.debug('⚠️ No chat links found after refresh');
      return 'Generating chat link...';
    } catch (error) {
      Logger.error('❌ Error getting current chat link:', error);
      return 'No link available';
    }
  }

  /**
   * Get current chat link synchronously (for backward compatibility)
   * Returns cached data without backend refresh
   */
  public getCurrentChatLinkSync(): string {
    try {
      Logger.debug('🔍 Getting cached chat link...');
      
      // Check all available user links and return the first one found
      if (this.config.userChatLinks) {
        const userIds = Object.keys(this.config.userChatLinks);
        
        if (userIds.length > 0) {
          const firstUserId = userIds[0];
          const link = this.config.userChatLinks[firstUserId]?.link;
          
          if (link && link !== 'Generating link...') {
            return link;
          }
        }
      }
      
      return 'Generating chat link...';
    } catch (error) {
      Logger.error('❌ Error getting cached chat link:', error);
      return 'No link available';
    }
  }

  /**
   * Force initialization of chat link for current user (call from UI if needed)
   */
  public async initializeChatLink(): Promise<void> {
    await this.initializeCurrentUserChatLink();
  }

  /**
   * DEPRECATED: SMS permissions no longer needed - using Mobica backend
   * Kept for backward compatibility only
   */
  public async requestPermissions(): Promise<boolean> {
    Logger.debug('⚠️ [DEPRECATED] SMS permissions no longer needed - using Mobica backend');
    return true; // Always return true since we don't need permissions anymore
  }

  /**
   * 🔒 SECURITY: Validate phone number for premium/suspicious patterns
   */
  private validatePhoneNumberSecurity(phoneNumber: string): { isAllowed: boolean; reason?: string; riskLevel: string } {
    const cleanNumber = phoneNumber.replace(/[\s\-\(\)]/g, '');
    
    // LAYER 1: Primary premium patterns (same as backend)
    const primaryPremiumPatterns = [
      /^1\d{3,4}$/,           // 1234, 12345 (premium services)
      /^0900\d+$/,            // 0900 numbers (premium)
      /^090\d+$/,             // 090 numbers (premium)
      /^\+1900\d+$/,          // International premium
      /^\+3591\d{3,4}$/,      // Bulgarian premium with country code
      /^18\d{2}$/,            // 1800-1899 range
      /^19\d{2}$/,            // 1900-1999 range
      /^0901\d+$/,            // Extended premium range
      /^0902\d+$/,            // Extended premium range
      /^0903\d+$/,            // Extended premium range
    ];

    // LAYER 2: Extended premium patterns
    const extendedPremiumPatterns = [
      /^0904\d+$/,            // 0904 premium range
      /^0905\d+$/,            // 0905 premium range
      /^0906\d+$/,            // 0906 premium range
      /^0907\d+$/,            // 0907 premium range
      /^0908\d+$/,            // 0908 premium range
      /^0909\d+$/,            // 0909 premium range
      /^\+359900\d+$/,        // Bulgarian 0900 with country code
      /^\+359901\d+$/,        // Bulgarian 0901 with country code
      /^\+359902\d+$/,        // Bulgarian 0902 with country code
      /^\+359903\d+$/,        // Bulgarian 0903 with country code
      /^\+359904\d+$/,        // Bulgarian 0904 with country code
      /^\+359905\d+$/,        // Bulgarian 0905 with country code
      /^\+359906\d+$/,        // Bulgarian 0906 with country code
      /^\+359907\d+$/,        // Bulgarian 0907 with country code
      /^\+359908\d+$/,        // Bulgarian 0908 with country code
      /^\+359909\d+$/,        // Bulgarian 0909 with country code
      /^1[0-9]{3,5}$/,        // All 1xxxx numbers (broad protection)
      /^\+1900\d+$/,          // US premium
      /^\+1976\d+$/,          // Caribbean premium
      /^\+44900\d+$/,         // UK premium
      /^\+49900\d+$/,         // German premium
      /^\+33899\d+$/,         // French premium
    ];

    // LAYER 3: Suspicious characteristics
    const suspiciousPatterns = [
      /^[0-9]{1,4}$/,         // Very short numbers (1-4 digits)
      /^[0-9]{15,}$/,         // Very long numbers (15+ digits)
      /^\*\d+$/,              // Star codes (*123)
      /^#\d+$/,               // Hash codes (#123)
      /^\*\d+\*$/,            // Star codes with ending (*123*)
      /^#\d+#$/,              // Hash codes with ending (#123#)
    ];

    // Check Layer 1
    if (primaryPremiumPatterns.some(pattern => pattern.test(cleanNumber))) {
      Logger.warn('🚨 MOBILE SECURITY - Layer 1 Block:', cleanNumber);
      return {
        isAllowed: false,
        reason: 'Premium number detected - potential financial risk (Layer 1)',
        riskLevel: 'critical'
      };
    }

    // Check Layer 2
    if (extendedPremiumPatterns.some(pattern => pattern.test(cleanNumber))) {
      Logger.warn('🚨 MOBILE SECURITY - Layer 2 Block:', cleanNumber);
      return {
        isAllowed: false,
        reason: 'Premium number detected - extended protection (Layer 2)',
        riskLevel: 'critical'
      };
    }

    // Check Layer 3
    if (suspiciousPatterns.some(pattern => pattern.test(cleanNumber))) {
      Logger.warn('🚨 MOBILE SECURITY - Layer 3 Block:', cleanNumber);
      return {
        isAllowed: false,
        reason: 'Suspicious number characteristics detected (Layer 3)',
        riskLevel: 'high'
      };
    }

    Logger.debug('✅ MOBILE SECURITY - Number passed all 3 layers:', cleanNumber);
    return {
      isAllowed: true,
      riskLevel: 'low'
    };
  }

  /**
   * DEPRECATED: SMS permissions no longer needed - using Mobica backend
   * Kept for backward compatibility only
   */
  public async checkPermissions(): Promise<SMSPermissions | null> {
    Logger.debug('⚠️ [DEPRECATED] SMS permissions no longer needed - using Mobica backend');
    // Return mock permissions as granted for backward compatibility
    return {
      SEND_SMS: true,
      hasAllPermissions: true,
    };
  }

  /**
   * Send missed call SMS via backend Mobica/Twilio service
   * This replaces native Android SMS which is restricted by Google Play
   */
  public async sendMissedCallViaTwilio(phoneNumber: string, callId: string, userId: string): Promise<boolean> {
    try {
      Logger.debug(`📱 [TWILIO] Processing missed call SMS for ${phoneNumber}, Call ID: ${callId}`);
      
      // Reload config from API to get latest settings (especially filterKnownContacts)
      Logger.debug('🔄 Reloading SMS config from API to get latest settings...');
      await this.loadConfig();
      Logger.debug(`📱 Current filter setting: filterKnownContacts = ${this.config.filterKnownContacts}`);
      
      // 🔒 SECURITY CHECK: Block premium numbers
      const securityCheck = this.validatePhoneNumberSecurity(phoneNumber);
      if (!securityCheck.isAllowed) {
        Logger.error('🚨 MISSED CALL SMS BLOCKED - Security violation:', securityCheck.reason);
        return false;
      }
      
      // Check if SMS has already been sent for this call
      if (this.config.sentCallIds.includes(callId)) {
        Logger.debug(`📱 SMS already sent for call ${callId}, skipping`);
        return false;
      }
      
      // 🚫 SPAM PREVENTION: Check if this number is in cooldown period
      if (this.isNumberInCooldown(phoneNumber)) {
        Logger.debug(`🚫 SMS blocked for ${phoneNumber} - spam prevention cooldown active`);
        return false;
      }

      // Check if we should filter known contacts
      if (this.config.filterKnownContacts) {
        Logger.debug(`📱 Contact filtering is ENABLED, checking contacts...`);
        const contactService = ContactService.getInstance();
        const contactInfo = await contactService.isPhoneNumberInContacts(phoneNumber);
        
        if (contactInfo.isInContacts) {
          Logger.debug(`🚫 BLOCKING SMS: Phone number ${phoneNumber} is in contacts`);
          return false;
        }
      }

      // Get user's business name (optional)
      const userDataStr = await AsyncStorage.getItem('user');
      let businessName = 'SnapFix';
      if (userDataStr) {
        try {
          const userData = JSON.parse(userDataStr);
          businessName = userData.businessName || userData.firstName || businessName;
        } catch (e) {
          Logger.warn('Could not parse user data for business name');
        }
      }

      Logger.debug(`📱 [TWILIO] Sending SMS via backend API...`);
      
      // Call backend API via ApiService (gets auto token refresh on 401)
      const result = await ApiService.getInstance().post('/sms/send-missed-call', {
        phoneNumber,
        businessName,
        callId,
        userId
      });

      if (result.success) {
        Logger.debug(`✅ [TWILIO] SMS sent successfully via backend`, {
          messageId: result.data?.messageId,
          isTrial: result.data?.isTrial
        });

        // Mark this call as having SMS sent (local tracking)
        this.config.sentCallIds.push(callId);
        if (this.config.sentCallIds.length > 100) {
          this.config.sentCallIds = this.config.sentCallIds.slice(-100);
        }
        
        this.config.sentCount++;
        this.config.lastSentTime = Date.now();
        
        // 📝 Record SMS sent to this number for spam prevention
        await this.recordSMSSentToNumber(phoneNumber);
        
        await this.saveConfig();

        // Show trial warning if applicable
        if (result.data?.isTrial && result.data?.trialWarning) {
          Logger.warn(`⚠️ [TWILIO TRIAL]: ${result.data.trialWarning}`);
        }

        return true;
      } else {
        Logger.error(`❌ [TWILIO] Failed to send SMS:`, result.error?.message);
        
        // Show user-friendly error
        if (result.error?.code === 'SMS_DISABLED') {
          Logger.debug('📱 SMS is disabled in settings');
        } else if (result.error?.code === 'TWILIO_SEND_FAILED') {
          Logger.error('❌ Twilio service error:', result.error.details);
        }
        
        return false;
      }

    } catch (error) {
      Logger.error('❌ [TWILIO] Error sending SMS via backend:', error);
      return false;
    }
  }

  public hasSMSSentForCall(callId: string): boolean {
    return this.config.sentCallIds.includes(callId);
  }

  /**
   * Check if SMS was recently sent to this phone number (spam prevention)
   * Returns true if SMS should be blocked (within cooldown period)
   */
  public isNumberInCooldown(phoneNumber: string): boolean {
    if (!this.config.sentToNumbers) {
      this.config.sentToNumbers = {};
    }
    
    // Normalize phone number (remove spaces, dashes, etc.)
    const normalizedNumber = phoneNumber.replace(/[\s\-\(\)]/g, '');
    
    const lastSentTime = this.config.sentToNumbers[normalizedNumber];
    if (!lastSentTime) {
      return false; // Never sent to this number
    }
    
    const timeSinceLastSMS = Date.now() - lastSentTime;
    const isInCooldown = timeSinceLastSMS < SMS_COOLDOWN_MS;
    
    if (isInCooldown) {
      const remainingMinutes = Math.ceil((SMS_COOLDOWN_MS - timeSinceLastSMS) / 60000);
      Logger.debug(`🚫 SMS blocked for ${normalizedNumber} - cooldown active (${remainingMinutes} min remaining)`);
    }
    
    return isInCooldown;
  }

  /**
   * Record that SMS was sent to a phone number (for spam prevention)
   */
  public async recordSMSSentToNumber(phoneNumber: string): Promise<void> {
    if (!this.config.sentToNumbers) {
      this.config.sentToNumbers = {};
    }
    
    // Normalize phone number
    const normalizedNumber = phoneNumber.replace(/[\s\-\(\)]/g, '');
    
    this.config.sentToNumbers[normalizedNumber] = Date.now();
    Logger.debug(`📝 Recorded SMS sent to ${normalizedNumber} at ${new Date().toISOString()}`);
    
    // Clean up old entries (older than 24 hours) to prevent memory bloat
    const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
    for (const num in this.config.sentToNumbers) {
      if (this.config.sentToNumbers[num] < oneDayAgo) {
        delete this.config.sentToNumbers[num];
      }
    }
    
    // Save config
    await this.saveConfig();
  }

  /**
   * Get current authenticated user ID
   */
  private async getCurrentUserIdAsync(): Promise<string | null> {
    try {
      // Try cached user from AsyncStorage first (fast, no network)
      const cachedUser = await AsyncStorage.getItem('user');
      if (cachedUser) {
        try {
          const user = JSON.parse(cachedUser);
          if (user.id) {
            Logger.debug('✅ getCurrentUserIdAsync - Got user ID from cache:', user.id);
            return user.id;
          }
        } catch (e) {
          Logger.warn('⚠️ Could not parse cached user');
        }
      }

      // Fallback to API call via ApiService (with auto token refresh)
      Logger.debug('📡 getCurrentUserIdAsync - Calling /auth/me via ApiService...');
      const response = await ApiService.getInstance().get('/auth/me');
      
      if (response.success && response.data) {
        const user = response.data.user || response.data;
        Logger.debug('✅ getCurrentUserIdAsync - User ID:', user.id);
        return user.id;
      }
      Logger.debug('⚠️ getCurrentUserIdAsync - No user data in result');
      return null;
    } catch (error) {
      Logger.error('❌ Error getting current user ID:', error);
      return null;
    }
  }

  /**
   * Get message with current chat link embedded (async version)
   */
  public async getMessageWithCurrentLink(): Promise<string> {
    const currentLink = await this.getCurrentChatLink();
    if (currentLink === 'Generating chat link...' || currentLink === 'No link available') {
      return this.config.message.replace('[chat_link]', 'Generating chat link...');
    }
    return this.config.message.replace('[chat_link]', currentLink);
  }

  /**
   * Get message with current chat link embedded (sync version using cached data)
   */
  public getMessageWithCurrentLinkSync(): string {
    const currentLink = this.getCurrentChatLinkSync();
    if (currentLink === 'Generating chat link...' || currentLink === 'No link available') {
      return this.config.message.replace('[chat_link]', 'Generating chat link...');
    }
    return this.config.message.replace('[chat_link]', currentLink);
  }

  /**
   * Initialize chat token system for user (replaces old token storage)
   */
  private async initializeChatTokenSystem(userId: string): Promise<{token: string, chatUrl: string} | null> {
    try {
      // Try authenticated endpoint first via ApiService (auto token refresh)
      const response = await ApiService.getInstance().post('/chat/tokens/initialize');

      if (response.success && response.data) {
        Logger.debug('✅ Chat token system initialized successfully (authenticated)');
        return {
          token: response.data.currentToken,
          chatUrl: response.data.chatUrl
        };
      }

      // Fallback to device endpoint for device users (unauthenticated, raw fetch OK)
      if (userId.startsWith('device_')) {
        Logger.debug('🔄 Using device endpoint for token initialization');
        const deviceResponse = await fetch('https://snapfix.bg/api/v1/chat/tokens/initialize-device', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ deviceUserId: userId })
        });

        if (!deviceResponse.ok) {
          Logger.error('❌ Failed to initialize chat token system for device:', deviceResponse.status);
          return null;
        }

        const result: any = await deviceResponse.json();
        if (result.success && result.data) {
          Logger.debug('✅ Chat token system initialized successfully (device)');
          return {
            token: result.data.currentToken,
            chatUrl: result.data.chatUrl
          };
        }
      }

      return null;
      
    } catch (error) {
      Logger.error('❌ Error initializing chat token system:', error);
      return null;
    }
  }


  public getConfig(): SMSConfig {
    return { ...this.config };
  }

  public async updateConfig(updates: Partial<SMSConfig>): Promise<void> {
    this.config = { ...this.config, ...updates };
    await this.saveConfig();
    Logger.debug('📱 SMS config updated:', this.config);
  }

  public async toggleEnabled(): Promise<boolean> {
    const newEnabled = !this.config.isEnabled;
    await this.updateConfig({ isEnabled: newEnabled });
    
    if (newEnabled) {
      // Request permissions when enabling
      const hasPermissions = await this.requestPermissions();
      if (!hasPermissions) {
        await this.updateConfig({ isEnabled: false });
        return false;
      }
    }
    
    return newEnabled;
  }

  public async updateMessage(newMessage: string): Promise<void> {
    await this.updateConfig({ message: newMessage });
  }

  /**
   * Refresh config from backend API (force sync with web app)
   */
  public async refreshConfigFromAPI(): Promise<void> {
    try {
      Logger.debug('🔄 Refreshing SMS config from API...');
      const userId = await this.getCurrentUserIdAsync();
      
      Logger.debug('🔍 Current user ID:', userId);
      
      if (!userId) {
        Logger.debug('⚠️ No user ID, cannot refresh from API');
        return;
      }

      Logger.debug('📡 Calling loadConfigFromAPI...');
      const apiConfig = await this.loadConfigFromAPI(userId);
      
      Logger.debug('📊 API Config received:', JSON.stringify(apiConfig, null, 2));
      
      if (apiConfig) {
        const oldConfig = { ...this.config };
        this.config = { ...this.config, ...apiConfig };
        Logger.debug('✅ SMS config refreshed from API');
        Logger.debug('   Old isEnabled:', oldConfig.isEnabled);
        Logger.debug('   New isEnabled:', this.config.isEnabled);
        Logger.debug('   Full config:', JSON.stringify(this.config, null, 2));
        // Update cache
        await AsyncStorage.setItem('sms_config', JSON.stringify(this.config));
      } else {
        Logger.debug('⚠️ Could not load config from API - apiConfig is null');
      }
    } catch (error) {
      Logger.error('❌ Error refreshing config from API:', error);
    }
  }

  public getStats() {
    return {
      isEnabled: this.config.isEnabled,
      sentCount: this.config.sentCount,
      lastSentTime: this.config.lastSentTime,
      message: this.config.message,
      processedCalls: this.config.sentCallIds.length,
      filterKnownContacts: this.config.filterKnownContacts,
    };
  }

  public async clearSMSSentHistory(): Promise<void> {
    this.config.sentCallIds = [];
    await this.saveConfig();
    Logger.debug('📱 SMS sent history cleared - only new calls will get SMS');
  }

  public async resetSMSStats(): Promise<void> {
    this.config.sentCount = 0;
    this.config.lastSentTime = undefined;
    this.config.sentCallIds = [];
    await this.saveConfig();
    Logger.debug('📱 SMS stats reset');
  }

  public async toggleContactFiltering(): Promise<boolean> {
    const newFiltering = !this.config.filterKnownContacts;
    await this.updateConfig({ filterKnownContacts: newFiltering });
    
    if (newFiltering) {
      // Request contacts permission when enabling filtering
      const contactService = ContactService.getInstance();
      const hasPermission = await contactService.requestContactsPermission();
      if (!hasPermission) {
        await this.updateConfig({ filterKnownContacts: false });
        return false;
      }
    }
    
    return newFiltering;
  }

  public getContactFilteringStatus(): boolean {
    return this.config.filterKnownContacts;
  }
}

export default SMSService;
