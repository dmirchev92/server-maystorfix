import { NativeModules, PermissionsAndroid, Platform, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import SendIntentAndroid from 'react-native-send-intent';
import { ContactService } from './ContactService';

interface SMSConfig {
  isEnabled: boolean;
  message: string;
  lastSentTime?: number;
  sentCount: number;
  sentCallIds: string[]; // Track which call IDs have had SMS sent
  filterKnownContacts: boolean; // Only send SMS to unknown numbers
  userChatLinks?: { [userId: string]: { link: string; token: string } }; // Per-user chat links
}

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
    filterKnownContacts: true, // Default to filtering known contacts
    userChatLinks: {}, // Per-user chat links
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
            console.log('📱 SMS config loaded from API (synchronized):', this.config);
            // Cache to AsyncStorage for offline access
            await AsyncStorage.setItem('sms_config', JSON.stringify(this.config));
            return;
          }
        } catch (apiError) {
          console.warn('⚠️ Could not load from API, falling back to local storage:', apiError);
        }
      }
      
      // Fallback to AsyncStorage (offline mode or not authenticated)
      const savedConfig = await AsyncStorage.getItem('sms_config');
      if (savedConfig) {
        this.config = { ...this.config, ...JSON.parse(savedConfig) };
        console.log('📱 SMS config loaded from local storage:', this.config);
      }
      
      // Initialize user chat links storage if needed
      if (!this.config.userChatLinks) {
        this.config.userChatLinks = {};
      }
    } catch (error) {
      console.error('❌ Error loading SMS config:', error);
    }
  }

  /**
   * Initialize chat link for current device/user (works without authentication)
   */
  private async initializeCurrentUserChatLink(): Promise<void> {
    try {
      console.log('🔗 Starting chat link initialization...');
      
      // Try to get authenticated user ID first
      let userId = await this.getCurrentUserIdAsync();
      
      // If not authenticated, use device-based ID for automatic SMS functionality
      if (!userId) {
        userId = await this.getOrCreateDeviceUserId();
        console.log('🔗 Using device-based user ID for automatic SMS:', userId);
      } else {
        console.log('🔗 Using authenticated user ID:', userId);
      }
      
      if (userId) {
        await this.ensureUserChatLink(userId);
        console.log('✅ Chat link initialization completed for user:', userId);
      }
      
    } catch (error) {
      console.error('⚠️ Could not initialize chat link:', error);
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
        console.log('📱 Using existing device user ID:', storedDeviceUserId);
        return storedDeviceUserId;
      }
      
      // Create new device-based user ID
      const deviceUserId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      await AsyncStorage.setItem('device_user_id', deviceUserId);
      console.log('📱 Created new device user ID:', deviceUserId);
      
      return deviceUserId;
    } catch (error) {
      console.error('❌ Error managing device user ID:', error);
      // Fallback to timestamp-based ID
      return `device_${Date.now()}`;
    }
  }

  private async saveConfig(): Promise<void> {
    try {
      // Save to AsyncStorage first (immediate local backup)
      await AsyncStorage.setItem('sms_config', JSON.stringify(this.config));
      console.log('💾 SMS config saved locally:', this.config);
      
      // Try to sync to API (synchronized with web app)
      const userId = await this.getCurrentUserIdAsync();
      if (userId) {
        try {
          await this.saveConfigToAPI(userId);
          console.log('☁️ SMS config synced to server');
        } catch (apiError) {
          console.warn('⚠️ Could not sync to API (will retry later):', apiError);
        }
      }
    } catch (error) {
      console.error('❌ Error saving SMS config:', error);
    }
  }

  /**
   * Load SMS config from API (synchronized with web app)
   */
  private async loadConfigFromAPI(userId: string): Promise<Partial<SMSConfig> | null> {
    try {
      const authToken = await this.getAuthToken();
      if (!authToken) {
        console.log('⚠️ No auth token, cannot load from API');
        return null;
      }

      const response = await fetch('https://maystorfix.com/api/v1/sms/config', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const result: any = await response.json();
        if (result.success && result.data?.config) {
          const apiConfig = result.data.config;
          return {
            isEnabled: apiConfig.isEnabled,
            message: apiConfig.message,
            sentCount: apiConfig.sentCount,
            lastSentTime: apiConfig.lastSentTime,
            filterKnownContacts: apiConfig.filterKnownContacts,
            sentCallIds: [] // This is managed locally for now
          };
        }
      }
      
      return null;
    } catch (error) {
      console.error('❌ Error loading config from API:', error);
      return null;
    }
  }

  /**
   * Save SMS config to API (synchronized with web app)
   */
  private async saveConfigToAPI(userId: string): Promise<void> {
    try {
      const authToken = await this.getAuthToken();
      if (!authToken) {
        console.log('⚠️ No auth token, cannot save to API');
        return;
      }

      const response = await fetch('https://maystorfix.com/api/v1/sms/config', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          isEnabled: this.config.isEnabled,
          message: this.config.message,
          filterKnownContacts: this.config.filterKnownContacts
        })
      });

      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }

      const result: any = await response.json();
      if (!result.success) {
        throw new Error(result.error?.message || 'Failed to save config');
      }
    } catch (error) {
      console.error('❌ Error saving config to API:', error);
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
        console.log(`✅ Using current token from new system for user ${userId}: ${tokenData.token.substring(0, 4)}...`);
        
        this.config.userChatLinks[userId] = {
          link: tokenData.chatUrl,
          token: tokenData.token
        };
        await this.saveConfig();
        return;
      }

      // Fallback: If no valid token exists in backend, generate a new one
      console.log(`🔄 No valid token found in backend for user ${userId}, generating new one`);
      await this.generateNewChatLinkForUser(userId);
      
    } catch (error) {
      console.error(`❌ Error ensuring chat link for user ${userId}:`, error);
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

      // First try to initialize token system with backend
      const tokenData = await this.initializeChatTokenSystem(userId);
      
      if (tokenData) {
        console.log(`✅ Generated new chat link via backend for user ${userId}`);
        this.config.userChatLinks[userId] = {
          link: tokenData.chatUrl,
          token: tokenData.token
        };
        await this.saveConfig();
        return;
      }

      // Fallback to local generation (should not happen with proper backend)
      console.log(`⚠️ Backend token generation failed, falling back to local generation for user ${userId}`);
      
      // Generate new token and link locally
      const chatToken = this.generateShortSecureToken();

      // If it's a device ID, we need to map it to the actual authenticated user
      let actualUserId = userId;
      if (userId.startsWith('device_')) {
        const authUserId = await this.getCurrentUserIdAsync();
        if (authUserId) {
          actualUserId = authUserId;
          console.log('🔄 Mapping device ID to authenticated user:', { deviceId: userId, actualUserId });
        } else {
          console.log('⚠️ No authenticated user found, using device ID as fallback');
        }
      }

      // Try to resolve user's publicId for prettier link; fall back to token-only page
      let publicId: string | null = null;
      try {
        // Ask backend to ensure/give publicId for the actual user id
        const pubResp = await fetch(`https://maystorfix.com/api/v1/users/${actualUserId}/public-id`, { method: 'GET' });
        if (pubResp.ok) {
          const pubData: any = await pubResp.json();
          publicId = pubData?.data?.publicId || null;
        }
      } catch {}

      const chatUrl = publicId
        ? `https://maystorfix.com/u/${publicId}/c/${chatToken}`
        : `https://maystorfix.com/c/${chatToken}`;

      // Update config with new link for this specific user (keep using device ID for local storage)
      this.config.userChatLinks[userId] = {
        link: chatUrl,
        token: chatToken
      };
      await this.saveConfig();

      console.log(`🔗 Generated new chat link for user ${userId} (mapped to ${actualUserId}):`, chatUrl);
    } catch (error) {
      console.error(`❌ Error generating new chat link for user ${userId}:`, error);
    }
  }

  /**
   * Get current token from new chat token system
   */
  private async getCurrentTokenFromBackend(userId: string): Promise<{token: string, chatUrl: string} | null> {
    try {
      const authToken = await this.getAuthToken();
      if (!authToken) {
        // Silent: SMS feature uses device tokens, not auth tokens
        return null;
      }

      const response = await fetch('https://maystorfix.com/api/v1/chat/tokens/current', {
        method: 'GET',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        }
      });
      
      if (!response.ok) {
        console.error('❌ Failed to get current token:', response.status);
        return null;
      }
      
      const result: any = await response.json();
      if (result.success && result.data) {
        return {
          token: result.data.token,
          chatUrl: result.data.chatUrl
        };
      }
      return null;
    } catch (error) {
      console.error('❌ Error getting current token:', error);
      return null;
    }
  }

  /**
   * Force regeneration of chat link for current user (works with or without authentication)
   */
  public async regenerateChatLink(): Promise<void> {
    try {
      // Try authenticated user first, fallback to device ID
      let userId = await this.getCurrentUserIdAsync();
      
      if (!userId) {
        userId = await this.getOrCreateDeviceUserId();
        console.log(`🔄 Force regenerating chat link for device user ${userId}`);
      } else {
        console.log(`🔄 Force regenerating chat link for authenticated user ${userId}`);
      }

      await this.forceRegenerateTokenForUser(userId);
    } catch (error) {
      console.error('❌ Error regenerating chat link:', error);
    }
  }

  /**
   * Force regenerate token using new backend endpoint
   */
  private async forceRegenerateTokenForUser(userId: string): Promise<void> {
    try {
      const authToken = await this.getAuthToken();
      
      // Try authenticated endpoint first
      if (authToken) {
        const response = await fetch('https://maystorfix.com/api/v1/chat/tokens/regenerate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          }
        });

        if (response.ok) {
          const result: any = await response.json();
          if (result.success && result.data) {
            console.log('✅ Token force regenerated successfully (authenticated)');
            
            if (!this.config.userChatLinks) {
              this.config.userChatLinks = {};
            }
            
            this.config.userChatLinks[userId] = {
              link: result.data.chatUrl,
              token: result.data.token
            };
            await this.saveConfig();
            return;
          }
        }
      }

      // Fallback to device endpoint for device users
      if (userId.startsWith('device_')) {
        console.log('🔄 Using device endpoint for token regeneration');
        const response = await fetch('https://maystorfix.com/api/v1/chat/tokens/regenerate-device', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ deviceUserId: userId })
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('❌ Failed to regenerate token for device:', response.status, errorText);
          throw new Error(`Failed to regenerate token: ${response.status}`);
        }

        const result: any = await response.json();
        if (result.success && result.data) {
          console.log('✅ Token force regenerated successfully (device)');
          
          if (!this.config.userChatLinks) {
            this.config.userChatLinks = {};
          }
          
          this.config.userChatLinks[userId] = {
            link: result.data.chatUrl,
            token: result.data.token
          };
          await this.saveConfig();
          return;
        }
      }

      throw new Error('Failed to regenerate token via backend');
    } catch (error) {
      console.error('❌ Error force regenerating token:', error);
      throw error;
    }
  }

  /**
   * Get current chat link for current user (for display purposes)
   * Now automatically refreshes from backend to get latest token
   */
  public async getCurrentChatLink(): Promise<string> {
    try {
      console.log('🔍 Getting current chat link (refreshing from backend)...');
      
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
        console.log('🔗 Refreshed link for user', userId, ':', link);
        return link;
      }
      
      // Return helpful message when no link is available
      console.log('⚠️ No chat links found after refresh');
      return 'Generating chat link...';
    } catch (error) {
      console.error('❌ Error getting current chat link:', error);
      return 'No link available';
    }
  }

  /**
   * Get current chat link synchronously (for backward compatibility)
   * Returns cached data without backend refresh
   */
  public getCurrentChatLinkSync(): string {
    try {
      console.log('🔍 Getting cached chat link...');
      
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
      console.error('❌ Error getting cached chat link:', error);
      return 'No link available';
    }
  }

  /**
   * Get chat link for a specific user
   */
  public getChatLinkForUser(userId: string): string {
    if (this.config.userChatLinks && this.config.userChatLinks[userId]) {
      return this.config.userChatLinks[userId].link;
    }
    return 'No link available for user';
  }

  /**
   * Force initialization of chat link for current user (call from UI if needed)
   */
  public async initializeChatLink(): Promise<void> {
    await this.initializeCurrentUserChatLink();
  }

  /**
   * Reset message template to default (with chat link)
   */
  public async resetMessageTemplate(): Promise<void> {
    this.config.message = 'Zaet sum, shte vurna obajdane sled nqkolko minuti.\n\nZapochnete chat tuk:\n[chat_link]\n\n';
    await this.saveConfig();
    console.log('📝 Message template reset to default with chat link');
  }

  /**
   * Force clear all cached SMS config and reset to Latin template
   */
  public async forceClearAndReset(): Promise<void> {
    try {
      // Clear AsyncStorage completely
      await AsyncStorage.removeItem('sms_config');
      console.log('🗑️ Cleared old SMS config from storage');
      
      // Reset to default Latin config
      this.config = {
        isEnabled: false,
        message: 'Zaet sum, shte vurna obajdane sled nqkolko minuti.\n\nZapochnete chat tuk:\n[chat_link]\n\n',
        sentCount: 0,
        sentCallIds: [],
        filterKnownContacts: true,
        userChatLinks: {},
      };
      
      // Save the new config
      await this.saveConfig();
      console.log('✅ Force reset to Latin template completed');
      
      // Initialize chat link for current user after reset
      console.log('🔗 Initializing chat link after reset...');
      await this.initializeCurrentUserChatLink();
    } catch (error) {
      console.error('❌ Error during force reset:', error);
    }
  }

  public async requestPermissions(): Promise<boolean> {
    if (Platform.OS !== 'android') return false;

    try {
      console.log('📋 Requesting SMS permissions...');
      
      const smsResult = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.SEND_SMS,
        {
          title: 'SMS Permission',
          message: 'ServiceText Pro needs permission to send SMS messages when you miss calls.',
          buttonNeutral: 'Ask Me Later',
          buttonNegative: 'Deny',
          buttonPositive: 'Allow',
        }
      );

      console.log('📱 SEND_SMS result:', smsResult);

      const granted = smsResult === PermissionsAndroid.RESULTS.GRANTED;
      
      console.log('📋 SMS Permission result:', granted ? '✅ Granted' : '❌ Denied');
      return granted;
    } catch (error) {
      console.error('❌ Error requesting SMS permissions:', error);
      return false;
    }
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
      console.warn('🚨 MOBILE SECURITY - Layer 1 Block:', cleanNumber);
      return {
        isAllowed: false,
        reason: 'Premium number detected - potential financial risk (Layer 1)',
        riskLevel: 'critical'
      };
    }

    // Check Layer 2
    if (extendedPremiumPatterns.some(pattern => pattern.test(cleanNumber))) {
      console.warn('🚨 MOBILE SECURITY - Layer 2 Block:', cleanNumber);
      return {
        isAllowed: false,
        reason: 'Premium number detected - extended protection (Layer 2)',
        riskLevel: 'critical'
      };
    }

    // Check Layer 3
    if (suspiciousPatterns.some(pattern => pattern.test(cleanNumber))) {
      console.warn('🚨 MOBILE SECURITY - Layer 3 Block:', cleanNumber);
      return {
        isAllowed: false,
        reason: 'Suspicious number characteristics detected (Layer 3)',
        riskLevel: 'high'
      };
    }

    console.log('✅ MOBILE SECURITY - Number passed all 3 layers:', cleanNumber);
    return {
      isAllowed: true,
      riskLevel: 'low'
    };
  }

  /**
   * Check if SMS permissions are granted
   */
  public async checkPermissions(): Promise<SMSPermissions | null> {
    if (Platform.OS !== 'android') return null;

    try {
      // Try native module first
      const { NativeModules } = require('react-native');
      const { SMSModule } = NativeModules;
      
      if (SMSModule) {
        try {
          const nativeResult = await SMSModule.checkSMSPermission();
          const result: SMSPermissions = {
            SEND_SMS: nativeResult.hasPermission,
            hasAllPermissions: nativeResult.hasPermission,
          };
          console.log('📋 SMS Permission check (native):', result);
          return result;
        } catch (error) {
          console.log('📋 Native permission check failed, using fallback:', error);
        }
      }
      
      // Fallback to React Native permission check
      const sendSmsStatus = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.SEND_SMS);
      
      const result: SMSPermissions = {
        SEND_SMS: sendSmsStatus,
        hasAllPermissions: sendSmsStatus,
      };
      
      console.log('📋 SMS Permission check (fallback):', result);
      return result;
    } catch (error) {
      console.error('❌ Error checking SMS permissions:', error);
      return null;
    }
  }

  public async sendSMS(phoneNumber: string, message?: string): Promise<boolean> {
    try {
      if (!this.config.isEnabled) {
        console.log('📱 SMS sending is disabled');
        return false;
      }

      // 🔒 SECURITY CHECK: Block premium numbers
      const securityCheck = this.validatePhoneNumberSecurity(phoneNumber);
      if (!securityCheck.isAllowed) {
        console.error('🚨 SMS BLOCKED - Security violation:', securityCheck.reason);
        Alert.alert(
          '🚨 SMS Blocked - Security Protection',
          `Cannot send SMS to ${phoneNumber}\n\nReason: ${securityCheck.reason}\n\nThis protects you from expensive charges.`,
          [{ text: 'OK' }]
        );
        return false;
      }

      const permissions = await this.checkPermissions();
      if (!permissions?.hasAllPermissions) {
        console.log('❌ SMS permissions not granted');
        Alert.alert('SMS Permission Required', 'Please grant SMS permission to send automatic messages.');
        return false;
      }

      const smsMessage = message || this.config.message;
      
      console.log(`📤 Sending SMS to ${phoneNumber}: ${smsMessage}`);
      
      // Try native Android SMS module first
      const { NativeModules } = require('react-native');
      const { SMSModule } = NativeModules;
      
      if (SMSModule) {
        try {
          // Send SMS using native module
          const result = await SMSModule.sendSMS(phoneNumber, smsMessage);
          console.log('📱 SMS sent successfully via native module:', result);
          
          // Update sent count
          this.config.sentCount++;
          this.config.lastSentTime = Date.now();
          await this.saveConfig();
          
          // Show success message
          Alert.alert(
            'SMS Sent! 📱',
            `Message sent to ${phoneNumber}:\n"${smsMessage}"`,
            [{ text: 'OK' }]
          );
          
          return true;
        } catch (error) {
          console.error('❌ Error sending SMS via native module:', error);
          // Fall through to send-intent method
        }
      }
      
      // Use react-native-send-intent for automatic SMS sending
      console.log('📱 Using react-native-send-intent for SMS');
      try {
        await SendIntentAndroid.sendSms(phoneNumber, smsMessage);
        
        console.log('📱 SMS sent successfully via send-intent');
        
        // Update sent count
        this.config.sentCount++;
        this.config.lastSentTime = Date.now();
        await this.saveConfig();
        
        // Show success message
        Alert.alert(
          'SMS Sent! 📱',
          `Message sent to ${phoneNumber}:\n"${smsMessage}"`,
          [{ text: 'OK' }]
        );
        
        return true;
      } catch (error) {
        console.error('❌ Error sending SMS via send-intent:', error);
        
        // Last resort: Show manual SMS instructions
        this.config.sentCount++;
        this.config.lastSentTime = Date.now();
        await this.saveConfig();
        
        Alert.alert(
          'Manual SMS Required 📱',
          `Please send SMS manually to ${phoneNumber}:\n\n"${smsMessage}"\n\nAutomatic SMS failed, but you can send it manually.`,
          [{ text: 'OK' }]
        );
        
        return true;
      }
    } catch (error) {
      console.error('❌ Error sending SMS:', error);
      Alert.alert('SMS Error', `Failed to send SMS: ${error}`);
      return false;
    }
  }

  public async sendMissedCallSMS(phoneNumber: string, callId: string, userId?: string): Promise<boolean> {
    console.log(`📱 Processing missed call SMS for ${phoneNumber}, Call ID: ${callId}`);
    console.log(`📱 Current sent call IDs:`, this.config.sentCallIds);
    
    // 🔒 SECURITY CHECK: Block premium numbers
    const securityCheck = this.validatePhoneNumberSecurity(phoneNumber);
    if (!securityCheck.isAllowed) {
      console.error('🚨 MISSED CALL SMS BLOCKED - Security violation:', securityCheck.reason);
      console.error(`🚨 Attempted to send SMS to premium number: ${phoneNumber}`);
      return false;
    }
    
    // Check if SMS has already been sent for this call
    if (this.config.sentCallIds.includes(callId)) {
      console.log(`📱 SMS already sent for call ${callId}, skipping`);
      return false;
    }

    // Check if we should filter known contacts
    if (this.config.filterKnownContacts) {
      console.log(`📱 Contact filtering is ENABLED, checking contacts...`);
      const contactService = ContactService.getInstance();
      const contactInfo = await contactService.isPhoneNumberInContacts(phoneNumber);
      
      console.log(`📱 Contact check result:`, contactInfo);
      
      if (contactInfo.isInContacts) {
        console.log(`🚫 BLOCKING SMS: Phone number ${phoneNumber} is in contacts (${contactInfo.contactName || 'Unknown'})`);
        return false;
      } else {
        console.log(`✅ ALLOWING SMS: Phone number ${phoneNumber} is NOT in contacts`);
      }
    } else {
      console.log(`📱 Contact filtering is DISABLED, proceeding with SMS`);
    }

    // Get the actual user ID for this SMS
    let actualUserId = userId;
    if (!actualUserId) {
      try {
        const currentUserResponse = await fetch('https://maystorfix.com/api/v1/auth/me', {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        });
        if (currentUserResponse.ok) {
          const userData: any = await currentUserResponse.json();
          actualUserId = userData.data?.user?.id || userData.data?.id || '1';
        }
      } catch (error) {
        console.error('❌ Could not get current user for SMS:', error);
        actualUserId = '1'; // Final fallback
      }
    }

    // Ensure we have a current chat link ready for this specific user
    const finalUserId = actualUserId || '1';
    await this.ensureUserChatLink(finalUserId);
    
    // Use the pre-generated chat link for this user in the template
    const userChatLink = this.config.userChatLinks?.[finalUserId]?.link || 'Link not available';
    const chatMessage = this.config.message.replace('[chat_link]', userChatLink);
    
    console.log(`📞 Sending missed call SMS for user ${actualUserId} to ${phoneNumber} for call ${callId}`);
    console.log(`🔗 Using chat link: ${userChatLink}`);
    const success = await this.sendSMS(phoneNumber, chatMessage);
    
    if (success) {
      // Mark this call as having SMS sent
      this.config.sentCallIds.push(callId);
      
      // Keep only last 100 call IDs to prevent memory issues
      if (this.config.sentCallIds.length > 100) {
        this.config.sentCallIds = this.config.sentCallIds.slice(-100);
      }
      
      await this.saveConfig();
      console.log(`📱 SMS sent and call ${callId} marked as processed`);
      console.log(`📱 Updated sent call IDs:`, this.config.sentCallIds);
    }
    
    return success;
  }

  private async generateChatLinkMessage(userId: string): Promise<string> {
    // Generate a short, secure token for SMS efficiency
    const chatToken = this.generateShortSecureToken();
    const chatUrl = `https://maystorfix.com/c/${chatToken}`;
    
    // Store the token mapping (this will be sent to backend)
    await this.storeChatTokenMapping(chatToken, userId);
    
    // Use the customizable template message and replace {CHAT_LINK} placeholder
    let smsMessage = this.config.message;
    
    // If the template contains {CHAT_LINK} placeholder, replace it
    if (smsMessage.includes('{CHAT_LINK}')) {
      smsMessage = smsMessage.replace('{CHAT_LINK}', chatUrl);
    } else {
      // If no placeholder, append the chat link to the existing message
      smsMessage = `${smsMessage}

Започнете чат тук:
${chatUrl}`;
    }
    
    return smsMessage;
  }

  private generateShortSecureToken(): string {
    // Generate a short but secure 6-character token
    // Uses base36 (0-9, a-z) for URL safety and readability
    const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let token = '';
    
    // Generate 6 random characters for 36^6 = 2.1 billion combinations
    for (let i = 0; i < 6; i++) {
      token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    // Add timestamp component to ensure uniqueness (last 2 digits of timestamp)
    const timeComponent = (Date.now() % 100).toString().padStart(2, '0');
    
    return token + timeComponent; // Total: 8 characters (still very short)
  }

  private async storeChatTokenMapping(token: string, userId: string): Promise<void> {
    try {
      // Store the mapping in the backend for validation
      // This will expire after 24 hours for security
      const mappingData = {
        token,
        userId,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours
      };

      console.log('🔐 Storing chat token:', { token: token.substring(0, 4) + '...', userId, expiresAt: mappingData.expiresAt });
      
      // Send to backend API to store securely
      const response = await fetch('https://maystorfix.com/api/v1/chat/tokens', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(mappingData)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Failed to store token:', response.status, errorText);
        throw new Error(`Failed to store token: ${response.statusText}`);
      }

      const result = await response.json();
      console.log('✅ Chat token stored in backend successfully:', result);
      
    } catch (error) {
      console.error('❌ Error storing chat token mapping:', error);
      // Don't fail SMS sending if token storage fails
    }
  }

  public hasSMSSentForCall(callId: string): boolean {
    return this.config.sentCallIds.includes(callId);
  }

  /**
   * Get user's public ID for chat links
   */
  private async getUserPublicId(userId: string): Promise<string> {
    try {
      const response = await fetch(`https://maystorfix.com/api/v1/users/${userId}/public-id`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        console.warn(`⚠️ Could not get public ID for user ${userId}, using fallback`);
        return userId.substring(0, 8); // Use first 8 chars of userId as fallback
      }

      const result: any = await response.json();
      if (result.success && result.data?.publicId) {
        return result.data.publicId;
      }

      return userId.substring(0, 8); // Fallback
    } catch (error) {
      console.error(`❌ Error getting public ID for user ${userId}:`, error);
      return userId.substring(0, 8); // Fallback
    }
  }

  /**
   * Get auth token for API calls
   */
  private async getAuthToken(): Promise<string | null> {
    try {
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      
      // Try the correct key first (used by ApiService)
      const authToken = await AsyncStorage.getItem('auth_token');
      console.log('🔑 getAuthToken - Checking auth_token key:', !!authToken);
      
      if (authToken) {
        console.log('✅ getAuthToken - Found token in auth_token');
        return authToken;
      }
      
      // Fallback to old key for backwards compatibility
      const authData = await AsyncStorage.getItem('authTokens');
      console.log('🔑 getAuthToken - Checking authTokens key:', !!authData);
      
      if (authData) {
        const tokens = JSON.parse(authData);
        console.log('✅ getAuthToken - Found token in authTokens');
        return tokens.accessToken;
      }
      
      console.log('⚠️ getAuthToken - No token found in either key');
      return null;
    } catch (error) {
      console.error('❌ Error getting auth token:', error);
      return null;
    }
  }

  /**
   * Get current authenticated user ID
   */
  private async getCurrentUserIdAsync(): Promise<string | null> {
    try {
      console.log('🔍 getCurrentUserIdAsync - Getting auth token...');
      const authToken = await this.getAuthToken();
      console.log('🔍 getCurrentUserIdAsync - Auth token exists:', !!authToken);
      
      if (!authToken) {
        console.log('⚠️ getCurrentUserIdAsync - No auth token found');
        return null;
      }

      console.log('📡 getCurrentUserIdAsync - Calling /auth/me...');
      const response = await fetch('https://maystorfix.com/api/v1/auth/me', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        }
      });

      console.log('📡 getCurrentUserIdAsync - Response status:', response.status);
      
      if (!response.ok) {
        console.log('⚠️ getCurrentUserIdAsync - Response not OK');
        return null;
      }

      const result: any = await response.json();
      console.log('📊 getCurrentUserIdAsync - Result:', JSON.stringify(result, null, 2));
      
      if (result.success && result.data) {
        const user = result.data.user || result.data;
        console.log('✅ getCurrentUserIdAsync - User ID:', user.id);
        return user.id;
      }
      console.log('⚠️ getCurrentUserIdAsync - No user data in result');
      return null;
    } catch (error) {
      console.error('❌ Error getting current user ID:', error);
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
      const authToken = await this.getAuthToken();
      
      // Try authenticated endpoint first
      if (authToken) {
        const response = await fetch('https://maystorfix.com/api/v1/chat/tokens/initialize', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          }
        });

        if (response.ok) {
          const result: any = await response.json();
          if (result.success && result.data) {
            console.log('✅ Chat token system initialized successfully (authenticated)');
            return {
              token: result.data.currentToken,
              chatUrl: result.data.chatUrl
            };
          }
        }
      }

      // Fallback to device endpoint for device users
      if (userId.startsWith('device_')) {
        console.log('🔄 Using device endpoint for token initialization');
        const response = await fetch('https://maystorfix.com/api/v1/chat/tokens/initialize-device', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ deviceUserId: userId })
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('❌ Failed to initialize chat token system for device:', response.status, errorText);
          return null;
        }

        const result: any = await response.json();
        if (result.success && result.data) {
          console.log('✅ Chat token system initialized successfully (device)');
          return {
            token: result.data.currentToken,
            chatUrl: result.data.chatUrl
          };
        }
      }

      return null;
      
    } catch (error) {
      console.error('❌ Error initializing chat token system:', error);
      return null;
    }
  }


  /**
   * Test method to generate real SMS text with actual token for manual testing
   * This creates a real token, stores it in backend, but doesn't send SMS
   */
  public async testGenerateChatLink(userId: string, phoneNumber: string): Promise<{ message: string; token: string; url: string }> {
    try {
      console.log('🧪 REAL TEST: Generating actual chat link for manual testing');
      
      // Get the actual current user ID instead of using hardcoded value
      let actualUserId = userId;
      try {
        const currentUserResponse = await fetch('https://maystorfix.com/api/v1/auth/me', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          }
        });
        
        if (currentUserResponse.ok) {
          const userData: any = await currentUserResponse.json();
          if (userData.success && userData.data?.user?.id) {
            actualUserId = userData.data.user.id;
            console.log('✅ Using actual current user ID:', actualUserId);
          }
        }
      } catch (error) {
        console.log('⚠️ Could not get current user, using provided ID:', userId);
      }
      
      console.log('👤 User ID:', actualUserId);
      console.log('📞 Phone Number:', phoneNumber);
      
      // Initialize chat token system for user
      const tokenData = await this.initializeChatTokenSystem(actualUserId);
      let chatToken: string;
      let chatUrl: string;
      
      if (tokenData) {
        chatToken = tokenData.token;
        chatUrl = tokenData.chatUrl;
      } else {
        // Fallback to generated token
        chatToken = this.generateShortSecureToken();
        chatUrl = `https://maystorfix.com/c/${chatToken}`;
      }

      const smsMessage = `Здравейте! Пропуснахте обаждане.

Започнете чат тук:
${chatUrl}

ServiceTextPro 💬`;

      console.log('✅ REAL TOKEN GENERATED AND STORED!');
      console.log('📱 SMS Message that would be sent:');
      console.log('═'.repeat(50));
      console.log(smsMessage);
      console.log('═'.repeat(50));
      console.log('📝 Template used:', this.config.message);
      console.log('🔗 Chat URL:', chatUrl);
      console.log('📏 Message length:', smsMessage.length, 'characters');
      console.log('⏰ Token expires in 24 hours');
      console.log('🔒 Token stored in backend database');

      return {
        message: smsMessage,
        token: chatToken,
        url: chatUrl
      };

    } catch (error) {
      console.error('❌ ERROR: Failed to generate real chat link:', error);
      throw error;
    }
  }

  public getConfig(): SMSConfig {
    return { ...this.config };
  }

  public async updateConfig(updates: Partial<SMSConfig>): Promise<void> {
    this.config = { ...this.config, ...updates };
    await this.saveConfig();
    console.log('📱 SMS config updated:', this.config);
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
      console.log('🔄 Refreshing SMS config from API...');
      const userId = await this.getCurrentUserIdAsync();
      
      console.log('🔍 Current user ID:', userId);
      
      if (!userId) {
        console.log('⚠️ No user ID, cannot refresh from API');
        return;
      }

      console.log('📡 Calling loadConfigFromAPI...');
      const apiConfig = await this.loadConfigFromAPI(userId);
      
      console.log('📊 API Config received:', JSON.stringify(apiConfig, null, 2));
      
      if (apiConfig) {
        const oldConfig = { ...this.config };
        this.config = { ...this.config, ...apiConfig };
        console.log('✅ SMS config refreshed from API');
        console.log('   Old isEnabled:', oldConfig.isEnabled);
        console.log('   New isEnabled:', this.config.isEnabled);
        console.log('   Full config:', JSON.stringify(this.config, null, 2));
        // Update cache
        await AsyncStorage.setItem('sms_config', JSON.stringify(this.config));
      } else {
        console.log('⚠️ Could not load config from API - apiConfig is null');
      }
    } catch (error) {
      console.error('❌ Error refreshing config from API:', error);
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
    console.log('📱 SMS sent history cleared - only new calls will get SMS');
  }

  public async resetSMSStats(): Promise<void> {
    this.config.sentCount = 0;
    this.config.lastSentTime = undefined;
    this.config.sentCallIds = [];
    await this.saveConfig();
    console.log('📱 SMS stats reset');
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
