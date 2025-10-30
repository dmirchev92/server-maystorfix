import messaging from '@react-native-firebase/messaging';
import notifee, { AndroidImportance, EventType } from '@notifee/react-native';
import { Platform } from 'react-native';
import ApiService from './ApiService';
import AsyncStorage from '@react-native-async-storage/async-storage';

class FCMService {
  private static instance: FCMService;
  private initialized: boolean = false;

  private constructor() {}

  public static getInstance(): FCMService {
    if (!FCMService.instance) {
      FCMService.instance = new FCMService();
    }
    return FCMService.instance;
  }

  /**
   * Initialize FCM service
   */
  async initialize(): Promise<void> {
    // Check if token is registered, if not, force re-initialization
    const isRegistered = await AsyncStorage.getItem('fcm_token_registered');
    if (this.initialized && isRegistered === 'true') {
      console.log('✅ FCM already initialized and token registered');
      return;
    }
    
    if (!isRegistered) {
      console.log('⚠️ FCM token not registered, forcing re-initialization');
      this.initialized = false;
    }

    try {
      console.log('🔥 Initializing Firebase Cloud Messaging...');
      console.log('🔥 FCM - Step 1: Requesting permission...');

      // Request permission
      const hasPermission = await this.requestPermission();
      console.log('🔥 FCM - Step 1 result: hasPermission =', hasPermission);
      if (!hasPermission) {
        console.warn('⚠️ FCM permission denied - stopping initialization');
        return;
      }

      console.log('🔥 FCM - Step 2: Getting FCM token...');
      // Get FCM token
      const token = await this.getToken();
      console.log('🔥 FCM - Step 2 result: token =', token ? `${token.substring(0, 30)}...` : 'null');
      if (token) {
        console.log('🔥 FCM - Step 3: Registering token with backend...');
        // Register token with backend
        await this.registerToken(token);
        console.log('🔥 FCM - Step 3 completed');
      } else {
        console.error('❌ FCM - No token obtained, skipping registration');
      }

      console.log('🔥 FCM - Step 4: Setting up message handlers...');
      // Setup message handlers
      this.setupForegroundHandler();
      this.setupBackgroundHandler();
      this.setupNotificationOpenedHandler();
      this.setupTokenRefreshHandler();

      this.initialized = true;
      console.log('✅ FCM initialized successfully - all steps completed');
    } catch (error) {
      console.error('❌ Error initializing FCM:', error);
      console.error('❌ FCM Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    }
  }

  /**
   * Request FCM permission
   */
  async requestPermission(): Promise<boolean> {
    try {
      const authStatus = await messaging().requestPermission();
      const enabled =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;

      console.log('🔔 FCM Permission status:', authStatus, enabled);
      return enabled;
    } catch (error) {
      console.error('❌ Error requesting FCM permission:', error);
      return false;
    }
  }

  /**
   * Get FCM token
   */
  async getToken(): Promise<string | null> {
    try {
      const token = await messaging().getToken();
      console.log('🔑 FCM Token obtained:', token.substring(0, 20) + '...');
      
      // Store token locally
      await AsyncStorage.setItem('fcm_token', token);
      
      return token;
    } catch (error) {
      console.error('❌ Error getting FCM token:', error);
      return null;
    }
  }

  /**
   * Register token with backend
   */
  async registerToken(token: string): Promise<void> {
    try {
      console.log('📤 Registering FCM token with backend...');
      console.log('📤 Token length:', token.length);
      console.log('📤 Platform:', Platform.OS);
      console.log('📤 Platform version:', Platform.Version);

      const payload = {
        token,
        platform: Platform.OS,
        deviceInfo: {
          os: Platform.OS,
          version: Platform.Version,
        },
      };
      console.log('📤 Request payload:', JSON.stringify(payload, null, 2));

      const response = await ApiService.getInstance().makeRequest(
        '/device-tokens/register',
        {
          method: 'POST',
          body: JSON.stringify(payload),
        }
      );

      console.log('📤 Response received:', JSON.stringify(response, null, 2));

      if (response.success) {
        console.log('✅ FCM token registered with backend successfully');
        await AsyncStorage.setItem('fcm_token_registered', 'true');
      } else {
        console.error('❌ Failed to register FCM token - Response error:', response.error);
        console.error('❌ Error code:', response.error?.code);
        console.error('❌ Error message:', response.error?.message);
      }
    } catch (error) {
      console.error('❌ Exception while registering FCM token:', error);
      console.error('❌ Error type:', typeof error);
      console.error('❌ Error details:', error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * Setup foreground message handler
   */
  private setupForegroundHandler(): void {
    messaging().onMessage(async remoteMessage => {
      console.log('📨 Foreground FCM message received:', remoteMessage);

      // Display notification using notifee
      await this.displayNotification(remoteMessage);
    });
  }

  /**
   * Setup background message handler
   */
  private setupBackgroundHandler(): void {
    messaging().setBackgroundMessageHandler(async remoteMessage => {
      console.log('📨 Background FCM message received:', remoteMessage);

      // Display notification using notifee
      await this.displayNotification(remoteMessage);
    });
  }

  /**
   * Setup notification opened handler
   */
  private setupNotificationOpenedHandler(): void {
    // Handle notification opened app from quit state
    messaging()
      .getInitialNotification()
      .then(remoteMessage => {
        if (remoteMessage) {
          console.log(
            '📱 Notification caused app to open from quit state:',
            remoteMessage
          );
          this.handleNotificationOpen(remoteMessage.data);
        }
      });

    // Handle notification opened app from background state
    messaging().onNotificationOpenedApp(remoteMessage => {
      console.log(
        '📱 Notification caused app to open from background state:',
        remoteMessage
      );
      this.handleNotificationOpen(remoteMessage.data);
    });

    // Handle notifee notification press
    notifee.onForegroundEvent(({ type, detail }) => {
      if (type === EventType.PRESS) {
        console.log('📱 Notifee notification pressed:', detail.notification);
        this.handleNotificationOpen(detail.notification?.data);
      }
    });
  }

  /**
   * Setup token refresh handler
   */
  private setupTokenRefreshHandler(): void {
    messaging().onTokenRefresh(async token => {
      console.log('🔄 FCM token refreshed:', token.substring(0, 20) + '...');
      await this.registerToken(token);
    });
  }

  /**
   * Display notification using notifee
   */
  private async displayNotification(remoteMessage: any): Promise<void> {
    try {
      const { notification, data } = remoteMessage;

      if (!notification) {
        console.warn('⚠️ No notification payload in FCM message');
        return;
      }

      // Determine channel based on notification type
      const channelId = data?.type === 'case_assigned' ? 'case_assignments' : 'chat_messages';

      await notifee.displayNotification({
        title: notification.title,
        body: notification.body,
        data,
        android: {
          channelId,
          importance: AndroidImportance.HIGH,
          pressAction: {
            id: 'default',
          },
          sound: 'default',
          vibrationPattern: [300, 500, 300],
          smallIcon: 'ic_notification',
          color: '#4A90E2',
          showTimestamp: true,
          autoCancel: true,
        },
        ios: {
          sound: 'default',
          foregroundPresentationOptions: {
            alert: true,
            badge: true,
            sound: true,
            banner: true,
            list: true,
          },
          interruptionLevel: 'timeSensitive',
        },
      });

      console.log('✅ Notification displayed via notifee');
    } catch (error) {
      console.error('❌ Error displaying notification:', error);
    }
  }

  /**
   * Handle notification open/tap
   */
  private handleNotificationOpen(data: any): void {
    console.log('👆 Handling notification tap:', data);

    // TODO: Navigate to appropriate screen based on data.type
    // This will be implemented in the navigation service
    if (data?.type === 'case_assigned' && data?.caseId) {
      // Navigate to case details
      console.log('Navigate to case:', data.caseId);
    } else if (data?.type === 'chat_message' && data?.conversationId) {
      // Navigate to chat
      console.log('Navigate to conversation:', data.conversationId);
    }
  }

  /**
   * Delete token from backend (on logout)
   */
  async deleteToken(): Promise<void> {
    try {
      const token = await AsyncStorage.getItem('fcm_token');
      if (!token) return;

      console.log('🗑️ Deleting FCM token from backend...');

      // Get token ID from backend first (would need to store this)
      // For now, we'll just delete the FCM token itself
      await messaging().deleteToken();
      await AsyncStorage.removeItem('fcm_token');
      await AsyncStorage.removeItem('fcm_token_registered');

      console.log('✅ FCM token deleted');
    } catch (error) {
      console.error('❌ Error deleting FCM token:', error);
    }
  }
}

export default FCMService;
