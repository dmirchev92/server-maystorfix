import messaging from '@react-native-firebase/messaging';
import notifee, { AndroidImportance, EventType } from '@notifee/react-native';
import { Platform } from 'react-native';
import ApiService from './ApiService';
import AsyncStorage from '@react-native-async-storage/async-storage';

class FCMService {
  private static instance: FCMService;
  private initialized: boolean = false;
  private navigationRef: any = null;

  private constructor() {}

  public static getInstance(): FCMService {
    if (!FCMService.instance) {
      FCMService.instance = new FCMService();
    }
    return FCMService.instance;
  }

  /**
   * Set navigation reference
   */
  setNavigationRef(ref: any): void {
    this.navigationRef = ref;
    console.log('✅ Navigation reference set for FCM');
  }

  /**
   * Handle initial notification from App.tsx
   */
  handleInitialNotification(initialNotification: any): void {
    if (!initialNotification) {
      console.log('⚠️ No initial notification to handle');
      return;
    }

    console.log('📱 FCMService - Handling initial notification from App.tsx:', initialNotification);
    const { notification, pressAction } = initialNotification;
    
    // Check if an action button was pressed
    const actionId = pressAction?.id;
    if (actionId === 'view_and_bid') {
      console.log('👁️ View and Bid action pressed (from App.tsx)');
      this.handleNotificationAction('view_and_bid', notification?.data);
    } else if (actionId === 'dismiss') {
      console.log('✖️ Dismiss action pressed (from App.tsx)');
      this.handleNotificationAction('dismiss', notification?.data);
    } else {
      // Default press (not an action button)
      console.log('📱 Default notification press (from App.tsx)');
      this.handleNotificationOpen(notification?.data);
    }
  }

  /**
   * Initialize FCM service
   */
  async initialize(): Promise<void> {
    // Check if token is registered, if not, force re-initialization
    const isRegistered = await AsyncStorage.getItem('fcm_token_registered');
    if (this.initialized && isRegistered === 'true') {
      console.log('✅ FCM already initialized and token registered');
      // Still need to set up notification opened handler for this session
      console.log('🔔 Setting up notification handlers for this session...');
      this.setupNotificationOpenedHandler();
      return;
    }
    
    if (!isRegistered) {
      console.log('⚠️ FCM token not registered, forcing re-initialization');
      this.initialized = false;
    }

    try {
      console.log('🔥 Initializing Firebase Cloud Messaging...');
      
      // Create notification categories for action buttons
      await this.createNotificationCategories();
      
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
   * Create notification categories for action buttons
   */
  private async createNotificationCategories(): Promise<void> {
    try {
      console.log('🔔 Creating notification categories for action buttons...');
      
      const categories = [
        {
          id: 'new_case_available',
          actions: [
            {
              id: 'view_and_bid',
              title: 'Виж и наддавай',
            },
            {
              id: 'dismiss',
              title: 'Игнорирай',
            },
          ],
        },
      ];
      
      console.log('🔔 Categories to create:', JSON.stringify(categories));
      await notifee.setNotificationCategories(categories);
      
      // Verify categories were created
      const createdCategories = await notifee.getNotificationCategories();
      console.log('✅ Notification categories created:', JSON.stringify(createdCategories));
    } catch (error) {
      console.error('❌ Error creating notification categories:', error);
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
    console.log('🔔 Setting up notification opened handlers...');
    
    // Handle notification opened app from quit state (FCM)
    messaging()
      .getInitialNotification()
      .then(remoteMessage => {
        if (remoteMessage) {
          console.log(
            '📱 FCM notification caused app to open from quit state:',
            remoteMessage
          );
          this.handleNotificationOpen(remoteMessage.data);
        }
      });

    // Handle notification opened app from quit state (Notifee)
    // Check immediately and also with delays to catch the notification
    const checkInitialNotification = async (attempt: number) => {
      console.log(`🔍 Checking for initial notifee notification (attempt ${attempt})...`);
      const initialNotification = await notifee.getInitialNotification();
      
      if (initialNotification) {
        console.log('📱 Notifee notification caused app to open from quit state:', initialNotification);
        const { notification, pressAction } = initialNotification;
        
        // Check if an action button was pressed
        const actionId = pressAction?.id;
        if (actionId === 'view_and_bid') {
          console.log('👁️ View and Bid action pressed (from quit state)');
          this.handleNotificationAction('view_and_bid', notification?.data);
        } else if (actionId === 'dismiss') {
          console.log('✖️ Dismiss action pressed (from quit state)');
          this.handleNotificationAction('dismiss', notification?.data);
        } else {
          // Default press (not an action button)
          console.log('📱 Default notification press (from quit state)');
          this.handleNotificationOpen(notification?.data);
        }
        return true;
      }
      return false;
    };
    
    // Check immediately
    checkInitialNotification(1);
    
    // Also check after delays in case navigation ref isn't ready yet
    setTimeout(() => checkInitialNotification(2), 500);
    setTimeout(() => checkInitialNotification(3), 1000);
    setTimeout(() => checkInitialNotification(4), 2000);

    // Handle notification opened app from background state (FCM)
    messaging().onNotificationOpenedApp(remoteMessage => {
      console.log(
        '📱 FCM notification caused app to open from background state:',
        remoteMessage
      );
      this.handleNotificationOpen(remoteMessage.data);
    });

    // Handle notifee notification press and action buttons (foreground)
    notifee.onForegroundEvent(({ type, detail }) => {
      if (type === EventType.PRESS || type === EventType.ACTION_PRESS) {
        console.log('📱 Notifee notification pressed (foreground):', detail.notification);
        console.log('📱 Notification data:', detail.notification?.data);
        
        // Check if an action button was pressed
        const actionId = detail.pressAction?.id;
        if (actionId === 'view_and_bid') {
          console.log('👁️ View and Bid action pressed');
          this.handleNotificationAction('view_and_bid', detail.notification?.data);
        } else if (actionId === 'dismiss') {
          console.log('✖️ Dismiss action pressed');
          this.handleNotificationAction('dismiss', detail.notification?.data);
        } else {
          // Default press (not an action button)
          console.log('📱 Default notification press (foreground)');
          this.handleNotificationOpen(detail.notification?.data);
        }
      }
    });

    // Handle notifee notification press and action buttons (background)
    notifee.onBackgroundEvent(async ({ type, detail }) => {
      if (type === EventType.PRESS || type === EventType.ACTION_PRESS) {
        console.log('📱 Notifee background notification pressed:', detail.notification);
        console.log('📱 Notification data:', detail.notification?.data);
        
        // Check if an action button was pressed
        const actionId = detail.pressAction?.id;
        if (actionId === 'view_and_bid') {
          console.log('👁️ View and Bid action pressed (background)');
          // Background actions are handled when app opens
        } else if (actionId === 'dismiss') {
          console.log('✖️ Dismiss action pressed (background)');
          // Just dismiss
        }
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
      let channelId = 'chat_messages';
      if (data?.type === 'new_case_available') {
        channelId = 'case_assignments';
      } else if (data?.type === 'case_assigned') {
        channelId = 'case_assignments';
      }

      // Build notification config
      const notificationConfig: any = {
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
          vibrationPattern: [300, 500],
          smallIcon: 'ic_notification',
          color: '#4A90E2',
          showTimestamp: true,
          autoCancel: true,
        },
      };

      // Add action buttons for new_case_available notifications
      if (data?.type === 'new_case_available') {
        console.log('🔔 Adding action buttons for new_case_available notification');
        
        // Link to the notification category (use categoryId, not category)
        notificationConfig.android.categoryId = 'new_case_available';
        
        // Set BigTextStyle to ensure actions are visible when expanded
        notificationConfig.android.style = {
          type: 1, // AndroidStyle.BIGTEXT
          text: notification.body,
        };
        
        // Add actions with launchActivity for proper Android compatibility
        notificationConfig.android.actions = [
          {
            title: 'Виж и наддавай',
            pressAction: {
              id: 'view_and_bid',
              launchActivity: 'default',
            },
          },
          {
            title: 'Игнорирай',
            pressAction: {
              id: 'dismiss',
              launchActivity: 'default',
            },
          },
        ];
        
        console.log('🔔 Action buttons with categoryId and launchActivity:', {
          categoryId: notificationConfig.android.categoryId,
          actions: notificationConfig.android.actions
        });
      } else {
        console.log('🔔 No action buttons - notification type:', data?.type);
      }

      // Add iOS config
      notificationConfig.ios = {
        sound: 'default',
        foregroundPresentationOptions: {
          alert: true,
          badge: true,
          sound: true,
          banner: true,
          list: true,
        },
        interruptionLevel: 'timeSensitive',
      };

      await notifee.displayNotification(notificationConfig);

      console.log('✅ Notification displayed via notifee');
    } catch (error) {
      console.error('❌ Error displaying notification:', error);
    }
  }

  /**
   * Handle notification action button press
   */
  private handleNotificationAction(actionId: string, data: any): void {
    console.log('🎯 Handling notification action:', actionId, data);

    if (!this.navigationRef) {
      console.warn('⚠️ Navigation ref not set, cannot navigate');
      return;
    }

    if (actionId === 'view_and_bid') {
      // Navigate to PlaceBid screen with caseId
      console.log('📍 Navigating to PlaceBid screen for case:', data.caseId);
      try {
        this.navigationRef.navigate('PlaceBid', { caseId: data.caseId });
        console.log('✅ Navigation to PlaceBid successful');
      } catch (error) {
        console.error('❌ Error navigating to PlaceBid:', error);
      }
    } else if (actionId === 'dismiss') {
      // Just dismiss the notification (do nothing)
      console.log('✅ Notification dismissed');
    }
  }

  /**
   * Handle notification open/tap
   */
  private handleNotificationOpen(data: any, retryCount: number = 0): void {
    console.log('👆 Handling notification tap - RAW DATA:', JSON.stringify(data));
    console.log('👆 Data type:', data?.type);
    console.log('👆 Case ID:', data?.caseId);
    console.log('👆 Retry count:', retryCount);

    if (!this.navigationRef) {
      if (retryCount < 10) { // Max 10 retries = 5 seconds
        console.warn(`⚠️ Navigation ref not set, will retry in 500ms... (attempt ${retryCount + 1}/10)`);
        // Retry after a delay to allow navigation ref to be set
        setTimeout(() => {
          console.log('🔄 Retrying navigation after delay...');
          this.handleNotificationOpen(data, retryCount + 1);
        }, 500);
      } else {
        console.error('❌ Navigation ref not set after 10 retries, giving up');
      }
      return;
    }

    // Navigate to appropriate screen based on data.type
    if (data?.type === 'new_case_available') {
      // Navigate directly to PlaceBid screen with caseId
      console.log('📍 Navigating to PlaceBid screen for case:', data.caseId);
      try {
        this.navigationRef.navigate('PlaceBid', { caseId: data.caseId });
        console.log('✅ Navigation to PlaceBid successful for case:', data.caseId);
      } catch (error) {
        console.error('❌ Error navigating to PlaceBid:', error);
      }
    } else if (data?.type === 'case_assigned') {
      // Navigate to Cases screen
      console.log('📍 Navigating to Cases screen for assigned case:', data.caseId);
      try {
        this.navigationRef.navigate('Cases');
        console.log('✅ Navigation to Cases successful');
      } catch (error) {
        console.error('❌ Error navigating to Cases:', error);
      }
    } else if (data?.type === 'chat_message') {
      // Navigate to Chat screen
      console.log('📍 Navigating to Chat screen');
      try {
        this.navigationRef.navigate('Chat');
        console.log('✅ Navigation to Chat successful');
      } catch (error) {
        console.error('❌ Error navigating to Chat:', error);
      }
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
