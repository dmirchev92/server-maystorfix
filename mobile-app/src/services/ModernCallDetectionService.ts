import { Logger } from '../utils/Logger';
import { NativeEventEmitter, NativeModules, PermissionsAndroid, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SMSService } from './SMSService';
import ApiService from './ApiService';

interface CallDetectionPermissions {
  READ_PHONE_STATE: boolean;
  READ_CALL_LOG: boolean;
  hasAllPermissions: boolean;
  androidVersion: string;
}

interface MissedCallEvent {
  phoneNumber: string;
  contactName?: string;
  timestamp: number;
  formattedTime: string;
  source: string;
  type: string;
  duration?: number;
}

interface CallDetectionStats {
  missedCallsCount: number;
  status: string;
  queryTime: number;
}

export class ModernCallDetectionService {
  private static instance: ModernCallDetectionService;
  private eventEmitter: NativeEventEmitter | null = null;
  private listeners: Array<(event: MissedCallEvent) => void> = [];
  private isInitialized = false;
  private isListening = false;

  private constructor() {
    this.initialize();
  }

  public static getInstance(): ModernCallDetectionService {
    if (!ModernCallDetectionService.instance) {
      ModernCallDetectionService.instance = new ModernCallDetectionService();
    }
    return ModernCallDetectionService.instance;
  }

  private initialize(): void {
    if (Platform.OS !== 'android') {
      Logger.debug('📱 Call detection only available on Android');
      return;
    }

    const { ModernCallDetectionModule } = NativeModules;
    if (ModernCallDetectionModule) {
      this.eventEmitter = new NativeEventEmitter(ModernCallDetectionModule);
      this.setupEventListeners();
      this.isInitialized = true;
      Logger.debug('📱 Modern call detection service initialized');
      
      // Start the native call detection
      ModernCallDetectionModule.startCallDetection()
        .then(() => {
          Logger.debug('✅ Native call detection started');
        })
        .catch((error: any) => {
          Logger.error('❌ Failed to start native call detection:', error);
        });
    } else {
      Logger.error('❌ ModernCallDetectionModule not found');
    }
  }

  private setupEventListeners(): void {
    if (!this.eventEmitter) return;

    this.eventEmitter.addListener('MissedCallDetected', (event: MissedCallEvent) => {
      Logger.debug('📞 Missed call detected:', event);
      this.handleMissedCall(event);
    });
  }

  private async handleMissedCall(event: MissedCallEvent): Promise<void> {
    try {
      Logger.debug('🚨 MISSED CALL HANDLER TRIGGERED:', event);
      
      // Store the call event locally
      await this.storeMissedCall(event);

      // Notify all listeners
      this.listeners.forEach(listener => {
        try {
          listener(event);
        } catch (error) {
          Logger.error('Error in missed call listener:', error);
        }
      });

      Logger.debug('✅ Missed call processed successfully');
    } catch (error) {
      Logger.error('❌ Error handling missed call:', error);
    }
  }

  private async storeMissedCall(event: MissedCallEvent): Promise<void> {
    try {
      // Get current user ID to make storage user-specific
      const currentUser = await this.getCurrentUser();
      if (!currentUser?.id) {
        Logger.debug('⚠️ No current user found, skipping call storage');
        return;
      }
      
      const key = `missed_calls_${currentUser.id}`;
      const existingData = await AsyncStorage.getItem(key);
      const calls = existingData ? JSON.parse(existingData) : [];
      
      // Add new call to the beginning
      calls.unshift({
        ...event,
        id: `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        processed: false,
        aiResponseSent: false,
        userId: currentUser.id, // Store user ID with the call
      });

      // Keep only last 50 calls
      if (calls.length > 50) {
        calls.splice(50);
      }

      await AsyncStorage.setItem(key, JSON.stringify(calls));
      Logger.debug('💾 Missed call stored locally');

      // Sync to backend immediately (don't wait for SMS)
      const callId = `call_${event.timestamp}_${event.phoneNumber}`;
      await this.syncMissedCallToBackend(event, callId);

      // Send SMS automatically if enabled
      await this.sendAutomaticSMS(event);

    } catch (error) {
      Logger.error('❌ Error storing missed call:', error);
    }
  }

  private async sendAutomaticSMS(event: MissedCallEvent): Promise<void> {
    try {
      Logger.debug('🔔 sendAutomaticSMS called for:', event.phoneNumber, 'Contact:', event.contactName);
      
      // Skip SMS for test events
      if (event.source === 'test') {
        Logger.debug('🧪 Test event detected, skipping SMS');
        return;
      }
      
      const smsService = SMSService.getInstance();
      const smsConfig = smsService.getConfig();
      
      Logger.debug('📱 SMS Config check:', {
        isEnabled: smsConfig.isEnabled,
        filterKnownContacts: smsConfig.filterKnownContacts
      });
      
      if (!smsConfig.isEnabled) {
        Logger.debug('📱 SMS sending is disabled, skipping automatic SMS');
        return;
      }

      // Generate a unique call ID for this missed call
      const callId = `call_${event.timestamp}_${event.phoneNumber}`;
      Logger.debug('📱 Generated call ID:', callId);
      
      // Check if SMS has already been sent for this call
      if (smsService.hasSMSSentForCall(callId)) {
        Logger.debug('📱 SMS already sent for this call, skipping');
        return;
      }

      // Get current user ID for the chat link
      const currentUser = await this.getCurrentUser();
      const userId = currentUser?.id;
      
      if (!userId) {
        Logger.error('❌ Cannot send SMS: User not authenticated');
        return; // Don't send SMS if user is not authenticated
      }

      Logger.debug('📱 Sending automatic SMS via backend Mobica service for missed call:', event.phoneNumber, 'Call ID:', callId, 'User ID:', userId);
      
      // Send SMS via backend Mobica API
      await smsService.sendMissedCallViaTwilio(event.phoneNumber, callId, userId);
      
      // Sync to backend
      await this.syncMissedCallToBackend(event, callId);
    } catch (error) {
      Logger.error('❌ Error sending automatic SMS:', error);
    }
  }

  /**
   * Sync missed call data to backend
   */
  private async syncMissedCallToBackend(event: MissedCallEvent, callId: string): Promise<void> {
    try {
      // Get current user ID
      const currentUser = await this.getCurrentUser();
      if (!currentUser?.id) {
        Logger.debug('⚠️ Cannot sync - no user ID available');
        return;
      }

      const apiService = ApiService.getInstance();
      const missedCallData = {
        id: callId,
        userId: currentUser.id,  // Add user ID for backend
        phoneNumber: event.phoneNumber,
        timestamp: event.timestamp,
        duration: event.duration || 0,
        type: 'missed',
        smsSent: true,
        smsSentAt: new Date().toISOString()
      };
      
      Logger.debug('📤 Syncing missed call to backend:', missedCallData);
      const response = await apiService.syncMissedCalls([missedCallData]);
      
      if (response.success) {
        Logger.debug('✅ Missed call synced to backend:', callId);
      } else {
        Logger.debug('❌ Failed to sync missed call to backend:', response.error);
      }
    } catch (error) {
      Logger.error('❌ Error syncing missed call to backend:', error);
    }
  }

  public async requestPermissions(): Promise<boolean> {
    if (Platform.OS !== 'android') return false;

    try {
      Logger.debug('📋 Requesting call detection permissions...');
      
      // Request READ_PHONE_STATE permission first
      Logger.debug('🔐 Requesting READ_PHONE_STATE permission...');
      const phoneStateResult = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.READ_PHONE_STATE,
        {
          title: 'Phone State Permission',
          message: 'SnapFix needs access to phone state to detect incoming calls.',
          buttonNeutral: 'Ask Me Later',
          buttonNegative: 'Deny',
          buttonPositive: 'Allow',
        }
      );

      Logger.debug('📱 READ_PHONE_STATE result:', phoneStateResult);

      // Request READ_CALL_LOG permission second
      Logger.debug('🔐 Requesting READ_CALL_LOG permission...');
      const callLogResult = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.READ_CALL_LOG,
        {
          title: 'Call Log Permission',
          message: 'SnapFix needs access to call log to detect missed calls and provide AI responses.',
          buttonNeutral: 'Ask Me Later',
          buttonNegative: 'Deny',
          buttonPositive: 'Allow',
        }
      );

      Logger.debug('📞 READ_CALL_LOG result:', callLogResult);

      const phoneStateGranted = phoneStateResult === PermissionsAndroid.RESULTS.GRANTED;
      const callLogGranted = callLogResult === PermissionsAndroid.RESULTS.GRANTED;
      const allGranted = phoneStateGranted && callLogGranted;

      Logger.debug('📋 Permission results:');
      Logger.debug('- READ_PHONE_STATE:', phoneStateGranted ? '✅ Granted' : '❌ Denied');
      Logger.debug('- READ_CALL_LOG:', callLogGranted ? '✅ Granted' : '❌ Denied');
      Logger.debug('- All permissions:', allGranted ? '✅ Granted' : '❌ Some denied');

      return allGranted;
    } catch (error) {
      Logger.error('❌ Error requesting permissions:', error);
      return false;
    }
  }

  public async checkPermissions(): Promise<CallDetectionPermissions | null> {
    if (!this.isInitialized) return null;

    try {
      // First check via React Native PermissionsAndroid
      const phoneStateStatus = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_PHONE_STATE);
      const callLogStatus = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_CALL_LOG);
      
      Logger.debug('📋 React Native permission check:');
      Logger.debug('- READ_PHONE_STATE:', phoneStateStatus ? '✅ Granted' : '❌ Denied');
      Logger.debug('- READ_CALL_LOG:', callLogStatus ? '✅ Granted' : '❌ Denied');

      // Also check via native module
      const { ModernCallDetectionModule } = NativeModules;
      const nativePermissions = await ModernCallDetectionModule.hasPermissions();
      Logger.debug('📋 Native module permission check:', nativePermissions);
      
      // Return combined result
      const result: CallDetectionPermissions = {
        READ_PHONE_STATE: phoneStateStatus && nativePermissions.READ_PHONE_STATE,
        READ_CALL_LOG: callLogStatus && nativePermissions.READ_CALL_LOG,
        hasAllPermissions: phoneStateStatus && callLogStatus && nativePermissions.hasAllPermissions,
        androidVersion: nativePermissions.androidVersion,
      };
      
      Logger.debug('📋 Final permission status:', result);
      return result;
    } catch (error) {
      Logger.error('❌ Error checking permissions:', error);
      return null;
    }
  }

  public async startDetection(): Promise<boolean> {
    if (!this.isInitialized) {
      Logger.error('❌ Service not initialized');
      return false;
    }

    try {
      Logger.debug('🚀 Starting modern call detection...');
      
      // Sync settings to native before starting (for background SMS when phone is locked)
      await this.syncSettingsToNative();
      
      const { ModernCallDetectionModule } = NativeModules;
      const result = await ModernCallDetectionModule.startCallDetection();
      
      this.isListening = true;
      Logger.debug('✅ Call detection started:', result);
      return true;
    } catch (error) {
      Logger.error('❌ Error starting call detection:', error);
      this.isListening = false;
      return false;
    }
  }
  
  /**
   * Sync auth token and SMS settings to native SharedPreferences.
   * This allows the native service to send SMS even when React Native JS is paused.
   */
  public async syncSettingsToNative(): Promise<void> {
    try {
      const { ModernCallDetectionModule } = NativeModules;
      if (!ModernCallDetectionModule?.syncNativeSettingsWithFilter && !ModernCallDetectionModule?.syncNativeSettings) {
        Logger.debug('⚠️ syncNativeSettings not available in native module');
        return;
      }
      
      // Get auth token
      const authToken = await AsyncStorage.getItem('auth_token');
      
      // Get user ID
      const currentUser = await this.getCurrentUser();
      const userId = currentUser?.id;
      
      // Get SMS enabled status and filter setting
      const smsService = SMSService.getInstance();
      const smsConfig = smsService.getConfig();
      const smsEnabled = smsConfig.isEnabled;
      const filterKnownContacts = smsConfig.filterKnownContacts || false;
      
      Logger.debug('🔄 syncSettingsToNative() called:');
      Logger.debug('   - authToken:', authToken ? 'SET (' + authToken.length + ' chars)' : 'NULL');
      Logger.debug('   - userId:', userId);
      Logger.debug('   - smsEnabled:', smsEnabled);
      Logger.debug('   - filterKnownContacts:', filterKnownContacts);
      
      if (authToken && userId) {
        // Use the new method with filter if available, otherwise fallback
        if (ModernCallDetectionModule.syncNativeSettingsWithFilter) {
          await ModernCallDetectionModule.syncNativeSettingsWithFilter(authToken, userId, smsEnabled, filterKnownContacts);
          Logger.debug('✅ Settings synced to native: smsEnabled=' + smsEnabled + ', filterKnownContacts=' + filterKnownContacts);
        } else {
          await ModernCallDetectionModule.syncNativeSettings(authToken, userId, smsEnabled);
          Logger.debug('✅ Settings synced to native (legacy): smsEnabled=' + smsEnabled);
        }
        
        // Verify sync worked
        await this.debugNativeSettings();
      } else {
        Logger.debug('⚠️ Cannot sync to native: missing auth token or user ID');
        Logger.debug('   authToken:', authToken ? 'present' : 'MISSING');
        Logger.debug('   userId:', userId ? 'present' : 'MISSING');
      }
    } catch (error) {
      Logger.error('❌ Error syncing settings to native:', error);
    }
  }
  
  /**
   * Debug method to check the current state of native SharedPreferences
   */
  public async debugNativeSettings(): Promise<any> {
    try {
      const { ModernCallDetectionModule } = NativeModules;
      if (!ModernCallDetectionModule?.debugNativeSettings) {
        Logger.debug('⚠️ debugNativeSettings not available in native module');
        return null;
      }
      
      const result = await ModernCallDetectionModule.debugNativeSettings();
      const parsed = JSON.parse(result);
      
      Logger.debug('🔍 DEBUG Native Settings:');
      Logger.debug('   - hasAuthToken:', parsed.hasAuthToken);
      Logger.debug('   - userId:', parsed.userId);
      Logger.debug('   - smsEnabled:', parsed.smsEnabled);
      
      return parsed;
    } catch (error) {
      Logger.error('❌ Error debugging native settings:', error);
      return null;
    }
  }
  
  /**
   * Verify that permissions are still valid for SMS functionality.
   * Returns true if permissions are OK, false if they were revoked.
   * If SMS was enabled but permissions are gone, auto-disables SMS.
   */
  public async verifyPermissionsAndAutoDisable(): Promise<{ permissionsOk: boolean; wasDisabled: boolean }> {
    try {
      const smsService = SMSService.getInstance();
      const smsConfig = smsService.getConfig();
      
      // If SMS is not enabled, no need to check
      if (!smsConfig.isEnabled) {
        return { permissionsOk: true, wasDisabled: false };
      }
      
      // Check permissions
      const permissionStatus = await this.checkPermissions();
      
      if (!permissionStatus?.hasAllPermissions) {
        Logger.debug('⚠️ verifyPermissions: Permissions revoked while SMS was ON');
        
        // Auto-disable SMS
        await smsService.updateConfig({ isEnabled: false });
        await this.stopDetection();
        
        return { permissionsOk: false, wasDisabled: true };
      }
      
      // Permissions OK - sync to native
      await this.syncSettingsToNative();
      return { permissionsOk: true, wasDisabled: false };
      
    } catch (error) {
      Logger.error('❌ Error verifying permissions:', error);
      return { permissionsOk: false, wasDisabled: false };
    }
  }

  public async stopDetection(): Promise<boolean> {
    if (!this.isInitialized) return false;

    try {
      Logger.debug('⏹️ Stopping call detection...');
      
      const { ModernCallDetectionModule } = NativeModules;
      const result = await ModernCallDetectionModule.stopCallDetection();
      
      this.isListening = false;
      Logger.debug('✅ Call detection stopped:', result);
      return true;
    } catch (error) {
      Logger.error('❌ Error stopping call detection:', error);
      return false;
    }
  }

  public async getRecentMissedCalls(): Promise<CallDetectionStats | null> {
    if (!this.isInitialized) return null;

    try {
      const { ModernCallDetectionModule } = NativeModules;
      const stats = await ModernCallDetectionModule.getRecentMissedCalls();
      Logger.debug('📊 Recent missed calls stats:', stats);
      return stats;
    } catch (error) {
      Logger.error('❌ Error getting recent missed calls:', error);
      return null;
    }
  }

  public async getStoredMissedCalls(): Promise<any[]> {
    try {
      // Get current user ID to make storage user-specific
      const currentUser = await this.getCurrentUser();
      if (!currentUser?.id) {
        Logger.debug('⚠️ No current user found, returning empty calls list');
        return [];
      }
      
      const key = `missed_calls_${currentUser.id}`;
      let localCalls: any[] = [];
      let backendCalls: any[] = [];
      
      // Get local storage calls first
      try {
        const localData = await AsyncStorage.getItem(key);
        localCalls = localData ? JSON.parse(localData) : [];
        Logger.debug(`📱 Loaded ${localCalls.length} calls from local storage`);
      } catch (error) {
        Logger.debug('⚠️ Error loading from local storage:', error);
      }
      
      // Try to get from backend database
      try {
        const apiService = ApiService.getInstance();
        const response = await apiService.getMissedCalls(currentUser.id);
        
        if (response.success && response.data && Array.isArray(response.data)) {
          Logger.debug(`☁️ Loaded ${response.data.length} calls from backend database`);
          
          // Format the data to match the app's expected structure
          backendCalls = response.data.map((call: any) => ({
            id: call.id,
            phoneNumber: call.phone_number,
            timestamp: call.timestamp,
            formattedTime: new Date(call.timestamp).toLocaleString('bg-BG'),
            aiResponseSent: false,
          }));
        }
      } catch (error) {
        Logger.debug('⚠️ Could not load from backend:', error);
      }
      
      // Merge local and backend calls (remove duplicates by id)
      const callsMap = new Map();
      
      // Add backend calls first (they're the source of truth)
      backendCalls.forEach(call => callsMap.set(call.id, call));
      
      // Add local calls that aren't in backend yet
      localCalls.forEach(call => {
        if (!callsMap.has(call.id)) {
          callsMap.set(call.id, call);
        }
      });
      
      const mergedCalls = Array.from(callsMap.values())
        .sort((a, b) => b.timestamp - a.timestamp); // Sort by newest first
      
      Logger.debug(`✅ Total merged calls: ${mergedCalls.length} (${backendCalls.length} from backend, ${localCalls.length} from local)`);
      
      // Update local storage with merged data
      await AsyncStorage.setItem(key, JSON.stringify(mergedCalls));
      
      return mergedCalls;
    } catch (error) {
      Logger.error('❌ Error getting stored missed calls:', error);
      return [];
    }
  }

  private async getCurrentUser(): Promise<any> {
    try {
      // Try to get from AsyncStorage first (faster, no rate limit)
      const userStr = await AsyncStorage.getItem('user');
      if (userStr) {
        const user = JSON.parse(userStr);
        Logger.debug('✅ Got user from AsyncStorage:', user.id);
        
        // Validate that user has required fields
        if (user && user.id) {
          return user;
        } else {
          Logger.debug('⚠️ User in AsyncStorage is invalid (no ID), fetching from API');
        }
      }
      
      // Fallback to API
      Logger.debug('📡 Fetching user from API...');
      const apiService = ApiService.getInstance();
      const response = await apiService.getCurrentUser();
      
      Logger.debug('📡 API response:', JSON.stringify(response, null, 2));
      
      const userData = response.data?.user || response.data;
      Logger.debug('👤 Parsed user data:', JSON.stringify(userData, null, 2));
      
      // Validate user data before saving
      if (userData && userData.id) {
        // Store user in AsyncStorage for faster access next time
        await AsyncStorage.setItem('user', JSON.stringify(userData));
        Logger.debug('💾 User saved to AsyncStorage with ID:', userData.id);
        return userData;
      } else {
        Logger.error('❌ Invalid user data from API (no ID):', userData);
        return null;
      }
    } catch (error) {
      Logger.error('❌ Error getting current user:', error);
      return null;
    }
  }
  public async clearUserData(): Promise<void> {
    try {
      // Clear all user-specific missed calls data
      const keys = await AsyncStorage.getAllKeys();
      const missedCallKeys = keys.filter(key => key.startsWith('missed_calls_'));
      
      if (missedCallKeys.length > 0) {
        await AsyncStorage.multiRemove(missedCallKeys);
        Logger.debug('🧹 Cleared user-specific missed calls data');
      }
    } catch (error) {
      Logger.error('❌ Error clearing user data:', error);
    }
  }

  public async testContactFiltering(): Promise<boolean> {
    try {
      Logger.debug('🧪 Testing contact filtering (no SMS will be sent)...');
      
      const testNumber = '+359888123456';
      
      // Check contact filtering only
      const smsService = SMSService.getInstance();
      const config = smsService.getConfig();
      
      Logger.debug('📱 SMS Config:', {
        isEnabled: config.isEnabled,
        filterKnownContacts: config.filterKnownContacts
      });
      
      if (config.filterKnownContacts) {
        Logger.debug('📱 Contact filtering is ENABLED, checking contacts...');
        const { ContactService } = await import('./ContactService');
        const contactService = ContactService.getInstance();
        const contactInfo = await contactService.isPhoneNumberInContacts(testNumber);
        
        Logger.debug('📱 Contact check result:', contactInfo);
        
        if (contactInfo.isInContacts) {
          Logger.debug(`🚫 TEST RESULT: SMS would be BLOCKED - ${testNumber} is in contacts (${contactInfo.contactName})`);
        } else {
          Logger.debug(`✅ TEST RESULT: SMS would be SENT - ${testNumber} is NOT in contacts`);
        }
      } else {
        Logger.debug('📱 Contact filtering is DISABLED - SMS would be sent to any number');
      }
      
      return true;
    } catch (error) {
      Logger.error('❌ Error testing contact filtering:', error);
      return false;
    }
  }

  public async testMissedCall(): Promise<boolean> {
    if (!this.isInitialized) return false;

    try {
      Logger.debug('🧪 Testing missed call detection (WILL SEND REAL SMS)...');
      
      const { ModernCallDetectionModule } = NativeModules;
      const result = await ModernCallDetectionModule.testMissedCall();
      
      Logger.debug('✅ Test missed call sent:', result);
      return true;
    } catch (error) {
      Logger.error('❌ Error testing missed call:', error);
      return false;
    }
  }

  public async debugCallLog(): Promise<any> {
    if (!this.isInitialized) return null;

    try {
      Logger.debug('🔍 Debugging call log...');
      
      const { ModernCallDetectionModule } = NativeModules;
      const result = await ModernCallDetectionModule.debugCallLog();
      
      Logger.debug('📋 Call Log Debug Info:');
      Logger.debug('- Last Call Time:', new Date(result.lastCallTime));
      Logger.debug('- Current Time:', new Date(result.currentTime));
      Logger.debug('- Total Calls:', result.totalCalls);
      Logger.debug('- Missed Calls Found:', result.missedCallsFound);
      Logger.debug('- Calls Info:\n', result.callsInfo);
      
      return result;
    } catch (error) {
      Logger.error('❌ Error debugging call log:', error);
      return null;
    }
  }

  public async forceCheckMissedCalls(): Promise<boolean> {
    if (!this.isInitialized) return false;
    try {
      Logger.debug('🔍 Forcing manual missed call check...');
      const { ModernCallDetectionModule } = NativeModules;
      await ModernCallDetectionModule.forceCheckMissedCalls();
      Logger.debug('✅ Manual check completed');
      return true;
    } catch (error) {
      Logger.error('❌ Error in manual check:', error);
      return false;
    }
  }

  public addMissedCallListener(listener: (event: MissedCallEvent) => void): void {
    this.listeners.push(listener);
    Logger.debug(`📢 Added missed call listener (total: ${this.listeners.length})`);
  }

  public removeMissedCallListener(listener: (event: MissedCallEvent) => void): void {
    const index = this.listeners.indexOf(listener);
    if (index > -1) {
      this.listeners.splice(index, 1);
      Logger.debug(`📢 Removed missed call listener (total: ${this.listeners.length})`);
    }
  }

  public isServiceListening(): boolean {
    return this.isListening;
  }

  public isServiceInitialized(): boolean {
    return this.isInitialized;
  }

  public async clearStoredCalls(): Promise<void> {
    try {
      await AsyncStorage.removeItem('missed_calls');
      Logger.debug('🗑️ Stored calls cleared');
    } catch (error) {
      Logger.error('❌ Error clearing stored calls:', error);
    }
  }
}

export default ModernCallDetectionService;
