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
      console.log('📱 Call detection only available on Android');
      return;
    }

    const { ModernCallDetectionModule } = NativeModules;
    if (ModernCallDetectionModule) {
      this.eventEmitter = new NativeEventEmitter(ModernCallDetectionModule);
      this.setupEventListeners();
      this.isInitialized = true;
      console.log('📱 Modern call detection service initialized');
      
      // Start the native call detection
      ModernCallDetectionModule.startCallDetection()
        .then(() => {
          console.log('✅ Native call detection started');
        })
        .catch((error: any) => {
          console.error('❌ Failed to start native call detection:', error);
        });
    } else {
      console.error('❌ ModernCallDetectionModule not found');
    }
  }

  private setupEventListeners(): void {
    if (!this.eventEmitter) return;

    this.eventEmitter.addListener('MissedCallDetected', (event: MissedCallEvent) => {
      console.log('📞 Missed call detected:', event);
      this.handleMissedCall(event);
    });
  }

  private async handleMissedCall(event: MissedCallEvent): Promise<void> {
    try {
      console.log('🚨 MISSED CALL HANDLER TRIGGERED:', event);
      
      // Store the call event locally
      await this.storeMissedCall(event);

      // Notify all listeners
      this.listeners.forEach(listener => {
        try {
          listener(event);
        } catch (error) {
          console.error('Error in missed call listener:', error);
        }
      });

      console.log('✅ Missed call processed successfully');
    } catch (error) {
      console.error('❌ Error handling missed call:', error);
    }
  }

  private async storeMissedCall(event: MissedCallEvent): Promise<void> {
    try {
      // Get current user ID to make storage user-specific
      const currentUser = await this.getCurrentUser();
      if (!currentUser?.id) {
        console.log('⚠️ No current user found, skipping call storage');
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
      console.log('💾 Missed call stored locally');

      // Sync to backend immediately (don't wait for SMS)
      const callId = `call_${event.timestamp}_${event.phoneNumber}`;
      await this.syncMissedCallToBackend(event, callId);

      // Send SMS automatically if enabled
      await this.sendAutomaticSMS(event);

    } catch (error) {
      console.error('❌ Error storing missed call:', error);
    }
  }

  private async sendAutomaticSMS(event: MissedCallEvent): Promise<void> {
    try {
      console.log('🔔 sendAutomaticSMS called for:', event.phoneNumber, 'Contact:', event.contactName);
      
      // Skip SMS for test events
      if (event.source === 'test') {
        console.log('🧪 Test event detected, skipping SMS');
        return;
      }
      
      const smsService = SMSService.getInstance();
      const smsConfig = smsService.getConfig();
      
      console.log('📱 SMS Config check:', {
        isEnabled: smsConfig.isEnabled,
        filterKnownContacts: smsConfig.filterKnownContacts
      });
      
      if (!smsConfig.isEnabled) {
        console.log('📱 SMS sending is disabled, skipping automatic SMS');
        return;
      }

      // Generate a unique call ID for this missed call
      const callId = `call_${event.timestamp}_${event.phoneNumber}`;
      console.log('📱 Generated call ID:', callId);
      
      // Check if SMS has already been sent for this call
      if (smsService.hasSMSSentForCall(callId)) {
        console.log('📱 SMS already sent for this call, skipping');
        return;
      }

      // Get current user ID for the chat link
      const currentUser = await this.getCurrentUser();
      const userId = currentUser?.id;
      
      if (!userId) {
        console.error('❌ Cannot send SMS: User not authenticated');
        return; // Don't send SMS if user is not authenticated
      }

      console.log('📱 Sending automatic SMS via backend Twilio service for missed call:', event.phoneNumber, 'Call ID:', callId, 'User ID:', userId);
      
      // NEW: Send SMS via backend Twilio API instead of native SMS
      await smsService.sendMissedCallViaTwilio(event.phoneNumber, callId, userId);
      
      // Sync to backend
      await this.syncMissedCallToBackend(event, callId);
    } catch (error) {
      console.error('❌ Error sending automatic SMS:', error);
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
        console.log('⚠️ Cannot sync - no user ID available');
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
      
      console.log('📤 Syncing missed call to backend:', missedCallData);
      const response = await apiService.syncMissedCalls([missedCallData]);
      
      if (response.success) {
        console.log('✅ Missed call synced to backend:', callId);
      } else {
        console.log('❌ Failed to sync missed call to backend:', response.error);
      }
    } catch (error) {
      console.error('❌ Error syncing missed call to backend:', error);
    }
  }

  public async requestPermissions(): Promise<boolean> {
    if (Platform.OS !== 'android') return false;

    try {
      console.log('📋 Requesting call detection permissions...');
      
      // Request READ_PHONE_STATE permission first
      console.log('🔐 Requesting READ_PHONE_STATE permission...');
      const phoneStateResult = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.READ_PHONE_STATE,
        {
          title: 'Phone State Permission',
          message: 'ServiceText Pro needs access to phone state to detect incoming calls.',
          buttonNeutral: 'Ask Me Later',
          buttonNegative: 'Deny',
          buttonPositive: 'Allow',
        }
      );

      console.log('📱 READ_PHONE_STATE result:', phoneStateResult);

      // Request READ_CALL_LOG permission second
      console.log('🔐 Requesting READ_CALL_LOG permission...');
      const callLogResult = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.READ_CALL_LOG,
        {
          title: 'Call Log Permission',
          message: 'ServiceText Pro needs access to call log to detect missed calls and provide AI responses.',
          buttonNeutral: 'Ask Me Later',
          buttonNegative: 'Deny',
          buttonPositive: 'Allow',
        }
      );

      console.log('📞 READ_CALL_LOG result:', callLogResult);

      const phoneStateGranted = phoneStateResult === PermissionsAndroid.RESULTS.GRANTED;
      const callLogGranted = callLogResult === PermissionsAndroid.RESULTS.GRANTED;
      const allGranted = phoneStateGranted && callLogGranted;

      console.log('📋 Permission results:');
      console.log('- READ_PHONE_STATE:', phoneStateGranted ? '✅ Granted' : '❌ Denied');
      console.log('- READ_CALL_LOG:', callLogGranted ? '✅ Granted' : '❌ Denied');
      console.log('- All permissions:', allGranted ? '✅ Granted' : '❌ Some denied');

      return allGranted;
    } catch (error) {
      console.error('❌ Error requesting permissions:', error);
      return false;
    }
  }

  public async checkPermissions(): Promise<CallDetectionPermissions | null> {
    if (!this.isInitialized) return null;

    try {
      // First check via React Native PermissionsAndroid
      const phoneStateStatus = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_PHONE_STATE);
      const callLogStatus = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_CALL_LOG);
      
      console.log('📋 React Native permission check:');
      console.log('- READ_PHONE_STATE:', phoneStateStatus ? '✅ Granted' : '❌ Denied');
      console.log('- READ_CALL_LOG:', callLogStatus ? '✅ Granted' : '❌ Denied');

      // Also check via native module
      const { ModernCallDetectionModule } = NativeModules;
      const nativePermissions = await ModernCallDetectionModule.hasPermissions();
      console.log('📋 Native module permission check:', nativePermissions);
      
      // Return combined result
      const result: CallDetectionPermissions = {
        READ_PHONE_STATE: phoneStateStatus && nativePermissions.READ_PHONE_STATE,
        READ_CALL_LOG: callLogStatus && nativePermissions.READ_CALL_LOG,
        hasAllPermissions: phoneStateStatus && callLogStatus && nativePermissions.hasAllPermissions,
        androidVersion: nativePermissions.androidVersion,
      };
      
      console.log('📋 Final permission status:', result);
      return result;
    } catch (error) {
      console.error('❌ Error checking permissions:', error);
      return null;
    }
  }

  public async startDetection(): Promise<boolean> {
    if (!this.isInitialized) {
      console.error('❌ Service not initialized');
      return false;
    }

    try {
      console.log('🚀 Starting modern call detection...');
      
      const { ModernCallDetectionModule } = NativeModules;
      const result = await ModernCallDetectionModule.startCallDetection();
      
      this.isListening = true;
      console.log('✅ Call detection started:', result);
      return true;
    } catch (error) {
      console.error('❌ Error starting call detection:', error);
      this.isListening = false;
      return false;
    }
  }

  public async stopDetection(): Promise<boolean> {
    if (!this.isInitialized) return false;

    try {
      console.log('⏹️ Stopping call detection...');
      
      const { ModernCallDetectionModule } = NativeModules;
      const result = await ModernCallDetectionModule.stopCallDetection();
      
      this.isListening = false;
      console.log('✅ Call detection stopped:', result);
      return true;
    } catch (error) {
      console.error('❌ Error stopping call detection:', error);
      return false;
    }
  }

  public async getRecentMissedCalls(): Promise<CallDetectionStats | null> {
    if (!this.isInitialized) return null;

    try {
      const { ModernCallDetectionModule } = NativeModules;
      const stats = await ModernCallDetectionModule.getRecentMissedCalls();
      console.log('📊 Recent missed calls stats:', stats);
      return stats;
    } catch (error) {
      console.error('❌ Error getting recent missed calls:', error);
      return null;
    }
  }

  public async getStoredMissedCalls(): Promise<any[]> {
    try {
      // Get current user ID to make storage user-specific
      const currentUser = await this.getCurrentUser();
      if (!currentUser?.id) {
        console.log('⚠️ No current user found, returning empty calls list');
        return [];
      }
      
      const key = `missed_calls_${currentUser.id}`;
      let localCalls: any[] = [];
      let backendCalls: any[] = [];
      
      // Get local storage calls first
      try {
        const localData = await AsyncStorage.getItem(key);
        localCalls = localData ? JSON.parse(localData) : [];
        console.log(`📱 Loaded ${localCalls.length} calls from local storage`);
      } catch (error) {
        console.log('⚠️ Error loading from local storage:', error);
      }
      
      // Try to get from backend database
      try {
        const apiService = ApiService.getInstance();
        const response = await apiService.getMissedCalls(currentUser.id);
        
        if (response.success && response.data && Array.isArray(response.data)) {
          console.log(`☁️ Loaded ${response.data.length} calls from backend database`);
          
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
        console.log('⚠️ Could not load from backend:', error);
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
      
      console.log(`✅ Total merged calls: ${mergedCalls.length} (${backendCalls.length} from backend, ${localCalls.length} from local)`);
      
      // Update local storage with merged data
      await AsyncStorage.setItem(key, JSON.stringify(mergedCalls));
      
      return mergedCalls;
    } catch (error) {
      console.error('❌ Error getting stored missed calls:', error);
      return [];
    }
  }

  private async getCurrentUser(): Promise<any> {
    try {
      // Try to get from AsyncStorage first (faster, no rate limit)
      const userStr = await AsyncStorage.getItem('user');
      if (userStr) {
        const user = JSON.parse(userStr);
        console.log('✅ Got user from AsyncStorage:', user.id);
        
        // Validate that user has required fields
        if (user && user.id) {
          return user;
        } else {
          console.log('⚠️ User in AsyncStorage is invalid (no ID), fetching from API');
        }
      }
      
      // Fallback to API
      console.log('📡 Fetching user from API...');
      const apiService = ApiService.getInstance();
      const response = await apiService.getCurrentUser();
      
      console.log('📡 API response:', JSON.stringify(response, null, 2));
      
      const userData = response.data?.user || response.data;
      console.log('👤 Parsed user data:', JSON.stringify(userData, null, 2));
      
      // Validate user data before saving
      if (userData && userData.id) {
        // Store user in AsyncStorage for faster access next time
        await AsyncStorage.setItem('user', JSON.stringify(userData));
        console.log('💾 User saved to AsyncStorage with ID:', userData.id);
        return userData;
      } else {
        console.error('❌ Invalid user data from API (no ID):', userData);
        return null;
      }
    } catch (error) {
      console.error('❌ Error getting current user:', error);
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
        console.log('🧹 Cleared user-specific missed calls data');
      }
    } catch (error) {
      console.error('❌ Error clearing user data:', error);
    }
  }

  public async testContactFiltering(): Promise<boolean> {
    try {
      console.log('🧪 Testing contact filtering (no SMS will be sent)...');
      
      const testNumber = '+359888123456';
      
      // Check contact filtering only
      const smsService = SMSService.getInstance();
      const config = smsService.getConfig();
      
      console.log('📱 SMS Config:', {
        isEnabled: config.isEnabled,
        filterKnownContacts: config.filterKnownContacts
      });
      
      if (config.filterKnownContacts) {
        console.log('📱 Contact filtering is ENABLED, checking contacts...');
        const { ContactService } = await import('./ContactService');
        const contactService = ContactService.getInstance();
        const contactInfo = await contactService.isPhoneNumberInContacts(testNumber);
        
        console.log('📱 Contact check result:', contactInfo);
        
        if (contactInfo.isInContacts) {
          console.log(`🚫 TEST RESULT: SMS would be BLOCKED - ${testNumber} is in contacts (${contactInfo.contactName})`);
        } else {
          console.log(`✅ TEST RESULT: SMS would be SENT - ${testNumber} is NOT in contacts`);
        }
      } else {
        console.log('📱 Contact filtering is DISABLED - SMS would be sent to any number');
      }
      
      return true;
    } catch (error) {
      console.error('❌ Error testing contact filtering:', error);
      return false;
    }
  }

  public async testMissedCall(): Promise<boolean> {
    if (!this.isInitialized) return false;

    try {
      console.log('🧪 Testing missed call detection (WILL SEND REAL SMS)...');
      
      const { ModernCallDetectionModule } = NativeModules;
      const result = await ModernCallDetectionModule.testMissedCall();
      
      console.log('✅ Test missed call sent:', result);
      return true;
    } catch (error) {
      console.error('❌ Error testing missed call:', error);
      return false;
    }
  }

  public async debugCallLog(): Promise<any> {
    if (!this.isInitialized) return null;

    try {
      console.log('🔍 Debugging call log...');
      
      const { ModernCallDetectionModule } = NativeModules;
      const result = await ModernCallDetectionModule.debugCallLog();
      
      console.log('📋 Call Log Debug Info:');
      console.log('- Last Call Time:', new Date(result.lastCallTime));
      console.log('- Current Time:', new Date(result.currentTime));
      console.log('- Total Calls:', result.totalCalls);
      console.log('- Missed Calls Found:', result.missedCallsFound);
      console.log('- Calls Info:\n', result.callsInfo);
      
      return result;
    } catch (error) {
      console.error('❌ Error debugging call log:', error);
      return null;
    }
  }

  public async forceCheckMissedCalls(): Promise<boolean> {
    if (!this.isInitialized) return false;
    try {
      console.log('🔍 Forcing manual missed call check...');
      const { ModernCallDetectionModule } = NativeModules;
      await ModernCallDetectionModule.forceCheckMissedCalls();
      console.log('✅ Manual check completed');
      return true;
    } catch (error) {
      console.error('❌ Error in manual check:', error);
      return false;
    }
  }

  public addMissedCallListener(listener: (event: MissedCallEvent) => void): void {
    this.listeners.push(listener);
    console.log(`📢 Added missed call listener (total: ${this.listeners.length})`);
  }

  public removeMissedCallListener(listener: (event: MissedCallEvent) => void): void {
    const index = this.listeners.indexOf(listener);
    if (index > -1) {
      this.listeners.splice(index, 1);
      console.log(`📢 Removed missed call listener (total: ${this.listeners.length})`);
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
      console.log('🗑️ Stored calls cleared');
    } catch (error) {
      console.error('❌ Error clearing stored calls:', error);
    }
  }
}

export default ModernCallDetectionService;
