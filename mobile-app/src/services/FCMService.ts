// @ts-nocheck
import { Logger } from '../utils/Logger';
import messaging from '@react-native-firebase/messaging';
import notifee, { AndroidImportance, EventType } from '@notifee/react-native';
import { Platform } from 'react-native';
import ApiService from './ApiService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import SocketIOService from './SocketIOService';

interface NotificationPreferences {
  push_enabled: boolean;
  push_new_cases: boolean;
  push_chat_messages: boolean;
  push_bid_won: boolean;
  push_new_bids: boolean;
  push_reviews: boolean;
  push_points_subscription: boolean;
}

class FCMService {
  private static instance: FCMService;
  private initialized: boolean = false;
  private navigationRef: any = null;
  private messageUnsubscribe: (() => void) | null = null;
  private notificationPreferences: NotificationPreferences | null = null;
  private preferencesLastFetched: number = 0;
  private PREFERENCES_CACHE_TTL = 60000; // 1 minute cache

  private constructor() {}

  // Fetch notification preferences with caching
  private async getNotificationPreferences(): Promise<NotificationPreferences | null> {
    const now = Date.now();
    if (this.notificationPreferences && (now - this.preferencesLastFetched) < this.PREFERENCES_CACHE_TTL) {
      return this.notificationPreferences;
    }

    try {
      const response = await ApiService.getInstance().get<NotificationPreferences>('/notification-preferences');
      if (response.success && response.data) {
        this.notificationPreferences = response.data;
        this.preferencesLastFetched = now;
        return this.notificationPreferences;
      }
    } catch (error) {
      Logger.error('FCM - Failed to fetch notification preferences:', error);
    }
    return null;
  }

  // Check if notification should be shown based on type and preferences
  private async shouldShowNotification(type: string): Promise<boolean> {
    const prefs = await this.getNotificationPreferences();
    
    // Default to showing if preferences not loaded
    if (!prefs) return true;
    
    // Check if push is enabled globally
    if (!prefs.push_enabled) {
      Logger.debug('📱 FCM - Push notifications disabled globally');
      return false;
    }

    // Check specific notification type
    switch (type) {
      case 'new_case_available':
      case 'case_assigned':
      case 'job_incoming':
        if (!prefs.push_new_cases) {
          Logger.debug('📱 FCM - New cases notifications disabled');
          return false;
        }
        break;
      case 'chat_message':
        if (!prefs.push_chat_messages) {
          Logger.debug('📱 FCM - Chat message notifications disabled');
          return false;
        }
        break;
      case 'bid_won':
        if (!prefs.push_bid_won) {
          Logger.debug('📱 FCM - Bid won notifications disabled');
          return false;
        }
        break;
      case 'new_bid_placed':
        if (!prefs.push_new_bids) {
          Logger.debug('📱 FCM - New bids notifications disabled');
          return false;
        }
        break;
      case 'rating_received':
      case 'review':
        if (!prefs.push_reviews) {
          Logger.debug('📱 FCM - Review notifications disabled');
          return false;
        }
        break;
      case 'points_low_warning':
      case 'trial_expiring_soon':
      case 'trial_expired':
        if (!prefs.push_points_subscription) {
          Logger.debug('📱 FCM - Points/subscription notifications disabled');
          return false;
        }
        break;
    }

    return true;
  }

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
    Logger.debug('✅ Navigation reference set for FCM');
  }

  /**
   * Handle initial notification from App.tsx
   */
  handleInitialNotification(initialNotification: any): void {
    if (!initialNotification) {
      Logger.debug('⚠️ No initial notification to handle');
      return;
    }

    Logger.debug('📱 FCMService - Handling initial notification from App.tsx:', initialNotification);
    const { notification, pressAction } = initialNotification;
    
    // Check if an action button was pressed
    const actionId = pressAction?.id;
    if (actionId === 'view_and_bid') {
      Logger.debug('👁️ View and Bid action pressed (from App.tsx)');
      this.handleNotificationAction('view_and_bid', notification?.data);
    } else if (actionId === 'dismiss') {
      Logger.debug('✖️ Dismiss action pressed (from App.tsx)');
      this.handleNotificationAction('dismiss', notification?.data);
    } else {
      // Default press (not an action button)
      Logger.debug('📱 Default notification press (from App.tsx)');
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
      Logger.debug('✅ FCM already initialized and token registered');
      // Still need to set up notification opened handler for this session
      Logger.debug('🔔 Setting up notification handlers for this session...');
      this.setupNotificationOpenedHandler();
      return;
    }
    
    if (!isRegistered) {
      Logger.debug('⚠️ FCM token not registered, forcing re-initialization');
      this.initialized = false;
    }

    try {
      Logger.debug('🔥 Initializing Firebase Cloud Messaging...');
      
      // Create notification channels (Android)
      await this.createChannels();

      // Create notification categories for action buttons
      await this.createNotificationCategories();
      
      Logger.debug('🔥 FCM - Step 1: Requesting permission...');

      // Request permission
      const hasPermission = await this.requestPermission();
      Logger.debug('🔥 FCM - Step 1 result: hasPermission =', hasPermission);
      if (!hasPermission) {
        Logger.warn('⚠️ FCM permission denied - stopping initialization');
        return;
      }

      Logger.debug('🔥 FCM - Step 2: Getting FCM token...');
      // Get FCM token
      const token = await this.getToken();
      Logger.debug('🔥 FCM - Step 2 result: token =', token ? `${token.substring(0, 30)}...` : 'null');
      if (token) {
        Logger.debug('🔥 FCM - Step 3: Registering token with backend...');
        // Register token with backend
        await this.registerToken(token);
        Logger.debug('🔥 FCM - Step 3 completed');
      } else {
        Logger.error('❌ FCM - No token obtained, skipping registration');
      }

      Logger.debug('🔥 FCM - Step 4: Setting up message handlers...');
      // Setup message handlers
      this.setupForegroundHandler();
      this.setupBackgroundHandler();
      this.setupNotificationOpenedHandler();
      this.setupTokenRefreshHandler();

      this.initialized = true;
      Logger.debug('✅ FCM initialized successfully - all steps completed');
    } catch (error) {
      Logger.error('❌ Error initializing FCM:', error);
      Logger.error('❌ FCM Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    }
  }

  /**
   * Create notification channels (Android)
   */
  private async createChannels(): Promise<void> {
    try {
      Logger.debug('🔔 Creating notification channels...');
      
      // 1. Chat Messages (High Importance)
      await notifee.createChannel({
        id: 'chat_messages',
        name: 'Chat Messages',
        importance: AndroidImportance.HIGH,
        sound: 'default',
        vibration: false,
      });

      // 2. Case Assignments (High Importance)
      await notifee.createChannel({
        id: 'case_assignments',
        name: 'Case Assignments',
        importance: AndroidImportance.HIGH,
        sound: 'default',
        vibration: true,
        vibrationPattern: [300, 500, 300, 500],
      });

      // 3. Urgent Cases (Max Importance for Full Screen Intent)
      await notifee.createChannel({
        id: 'urgent_cases',
        name: 'Urgent Job Alerts',
        importance: AndroidImportance.HIGH, 
        sound: 'default', 
        vibration: false,
        lights: true,
        lightColor: '#DC2626',
      });

      Logger.debug('✅ Notification channels created');
    } catch (error) {
      Logger.error('❌ Error creating notification channels:', error);
    }
  }

  /**
   * Create notification categories for action buttons
   */
  private async createNotificationCategories(): Promise<void> {
    try {
      Logger.debug('🔔 Creating notification categories for action buttons...');
      
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
      
      Logger.debug('🔔 Categories to create:', JSON.stringify(categories));
      await notifee.setNotificationCategories(categories);
      
      // Verify categories were created
      const createdCategories = await notifee.getNotificationCategories();
      Logger.debug('✅ Notification categories created:', JSON.stringify(createdCategories));
    } catch (error) {
      Logger.error('❌ Error creating notification categories:', error);
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

      Logger.debug('🔔 FCM Permission status:', authStatus, enabled);
      return enabled;
    } catch (error) {
      Logger.error('❌ Error requesting FCM permission:', error);
      return false;
    }
  }

  /**
   * Get FCM token
   */
  async getToken(): Promise<string | null> {
    try {
      const token = await messaging().getToken();
      Logger.debug('🔑 FCM Token obtained:', token.substring(0, 20) + '...');
      
      // Store token locally
      await AsyncStorage.setItem('fcm_token', token);
      
      return token;
    } catch (error) {
      Logger.error('❌ Error getting FCM token:', error);
      return null;
    }
  }

  /**
   * Register token with backend
   */
  async registerToken(token: string): Promise<void> {
    try {
      Logger.debug('📤 Registering FCM token with backend...');
      Logger.debug('📤 Token length:', token.length);
      Logger.debug('📤 Platform:', Platform.OS);
      Logger.debug('📤 Platform version:', Platform.Version);

      const payload = {
        token,
        platform: Platform.OS,
        deviceInfo: {
          os: Platform.OS,
          version: Platform.Version,
        },
      };
      Logger.debug('📤 Request payload:', JSON.stringify(payload, null, 2));

      const response = await ApiService.getInstance().makeRequest(
        '/device-tokens/register',
        {
          method: 'POST',
          body: JSON.stringify(payload),
        }
      );

      Logger.debug('📤 Response received:', JSON.stringify(response, null, 2));

      if (response.success) {
        Logger.debug('✅ FCM token registered with backend successfully');
        await AsyncStorage.setItem('fcm_token_registered', 'true');
      } else {
        Logger.error('❌ Failed to register FCM token - Response error:', response.error);
        Logger.error('❌ Error code:', response.error?.code);
        Logger.error('❌ Error message:', response.error?.message);
      }
    } catch (error) {
      Logger.error('❌ Exception while registering FCM token:', error);
      Logger.error('❌ Error type:', typeof error);
      Logger.error('❌ Error details:', error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * Setup foreground message handler
   */
  private setupForegroundHandler(): void {
    // Clean up existing listener if any
    if (this.messageUnsubscribe) {
      Logger.debug('🔄 Cleaning up existing FCM foreground listener');
      this.messageUnsubscribe();
      this.messageUnsubscribe = null;
    }

    Logger.debug('✅ Setting up new FCM foreground listener');
    this.messageUnsubscribe = messaging().onMessage(async remoteMessage => {
      Logger.debug('📨 Foreground FCM message received:', remoteMessage);

      // Always skip chat_message in foreground - SocketIO handles it with better UI
      // This prevents duplicate notifications
      if (remoteMessage.data?.type === 'chat_message') {
        Logger.debug('🚫 FCM - Skipping chat_message in foreground (SocketIO handles it)');
        return;
      }

      // Display notification using notifee
      await this.displayNotification(remoteMessage);
    });
  }

  /**
   * Setup background message handler
   */
  private setupBackgroundHandler(): void {
    messaging().setBackgroundMessageHandler(async remoteMessage => {
      Logger.debug('📨 Background FCM message received:', remoteMessage);

      // Display notification using notifee
      await this.displayNotification(remoteMessage);
    });
  }

  /**
   * Setup notification opened handler
   */
  private setupNotificationOpenedHandler(): void {
    Logger.debug('🔔 Setting up notification opened handlers...');
    
    // Handle notification opened app from quit state (FCM)
    messaging()
      .getInitialNotification()
      .then(remoteMessage => {
        if (remoteMessage) {
          Logger.debug(
            '📱 FCM notification caused app to open from quit state:',
            remoteMessage
          );
          this.handleNotificationOpen(remoteMessage.data);
        }
      });

    // Handle notification opened app from quit state (Notifee)
    // Check immediately and also with delays to catch the notification
    const checkInitialNotification = async (attempt: number) => {
      Logger.debug(`🔍 Checking for initial notifee notification (attempt ${attempt})...`);
      const initialNotification = await notifee.getInitialNotification();
      
      if (initialNotification) {
        Logger.debug('📱 Notifee notification caused app to open from quit state:', initialNotification);
        const { notification, pressAction } = initialNotification;
        
        // Check if an action button was pressed
        const actionId = pressAction?.id;
        if (actionId === 'view_and_bid') {
          Logger.debug('👁️ View and Bid action pressed (from quit state)');
          this.handleNotificationAction('view_and_bid', notification?.data);
        } else if (actionId === 'dismiss') {
          Logger.debug('✖️ Dismiss action pressed (from quit state)');
          this.handleNotificationAction('dismiss', notification?.data);
        } else {
          // Default press (not an action button)
          Logger.debug('📱 Default notification press (from quit state)');
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
      Logger.debug(
        '📱 FCM notification caused app to open from background state:',
        remoteMessage
      );
      this.handleNotificationOpen(remoteMessage.data);
    });

    // Handle notifee notification press and action buttons (foreground)
    notifee.onForegroundEvent(({ type, detail }) => {
      if (type === EventType.PRESS || type === EventType.ACTION_PRESS) {
        Logger.debug('📱 Notifee notification pressed (foreground):', detail.notification);
        Logger.debug('📱 Notification data:', detail.notification?.data);
        
        // Check if an action button was pressed
        const actionId = detail.pressAction?.id;
        if (actionId === 'view_and_bid') {
          Logger.debug('👁️ View and Bid action pressed');
          this.handleNotificationAction('view_and_bid', detail.notification?.data);
        } else if (actionId === 'dismiss') {
          Logger.debug('✖️ Dismiss action pressed');
          this.handleNotificationAction('dismiss', detail.notification?.data);
        } else {
          // Default press (not an action button)
          Logger.debug('📱 Default notification press (foreground)');
          this.handleNotificationOpen(detail.notification?.data);
        }
      }
    });

    // Handle notifee notification press and action buttons (background)
    notifee.onBackgroundEvent(async ({ type, detail }) => {
      if (type === EventType.PRESS || type === EventType.ACTION_PRESS) {
        Logger.debug('📱 Notifee background notification pressed:', detail.notification);
        Logger.debug('📱 Notification data:', detail.notification?.data);
        
        // Check if an action button was pressed
        const actionId = detail.pressAction?.id;
        if (actionId === 'view_and_bid') {
          Logger.debug('👁️ View and Bid action pressed (background)');
          // Background actions are handled when app opens
        } else if (actionId === 'dismiss') {
          Logger.debug('✖️ Dismiss action pressed (background)');
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
      Logger.debug('🔄 FCM token refreshed:', token.substring(0, 20) + '...');
      await this.registerToken(token);
    });
  }

  /**
   * Display notification using notifee
   * 
   * NOTE: We now receive DATA-ONLY FCM messages (no 'notification' payload).
   * The title and body are included in the 'data' object instead.
   * This prevents Firebase from automatically displaying duplicate notifications.
   */
  private async displayNotification(remoteMessage: any): Promise<void> {
    try {
      const { notification, data } = remoteMessage;

      Logger.debug('📱 FCM displayNotification called with:', { notification, data });

      // Support both data-only messages (new) and legacy notification+data messages
      const title = notification?.title || data?.title;
      const body = notification?.body || data?.body;

      Logger.debug('📱 FCM extracted title:', title);
      Logger.debug('📱 FCM extracted body:', body);

      if (!title && !body) {
        Logger.warn('⚠️ No notification content in FCM message (neither notification nor data payload has title/body)');
        Logger.warn('⚠️ Raw data:', JSON.stringify(data));
        return;
      }

      // Check notification preferences before displaying
      const notificationType = data?.type || 'unknown';
      const shouldShow = await this.shouldShowNotification(notificationType);
      if (!shouldShow) {
        Logger.debug(`📱 FCM - Skipping notification display for type: ${notificationType} (disabled by user)`);
        return;
      }

      // Determine channel based on notification type
      let channelId = 'chat_messages';
      if (data?.type === 'new_case_available') {
        channelId = 'case_assignments';
      } else if (data?.type === 'case_assigned') {
        channelId = 'case_assignments';
      } else if (data?.type === 'job_incoming') {
        channelId = 'urgent_cases';
      }

      // Build notification config
      const notificationConfig: any = {
        title,
        body,
        data,
        android: {
          channelId,
          importance: AndroidImportance.HIGH,
          pressAction: {
            id: 'default',
          },
          sound: 'default',
          smallIcon: 'ic_notification',
          color: '#4A90E2',
          showTimestamp: true,
          autoCancel: true,
        },
      };

      Logger.debug('📱 FCM notification config prepared:', JSON.stringify(notificationConfig));

      // Add action buttons for new_case_available notifications
      if (data?.type === 'new_case_available') {
        Logger.debug('🔔 Adding action buttons for new_case_available notification');
        
        // Link to the notification category (use categoryId, not category)
        notificationConfig.android.categoryId = 'new_case_available';
        
        // Set BigTextStyle to ensure actions are visible when expanded
        notificationConfig.android.style = {
          type: 1, // AndroidStyle.BIGTEXT
          text: body, // Use body variable which handles data-only messages
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
      } else if (data?.type === 'job_incoming') {
        // Configure Full Screen Intent for Urgent Job Alerts
        notificationConfig.android.fullScreenAction = {
          id: 'default',
          launchActivity: 'default',
        };
        
        notificationConfig.android.actions = [
          {
            title: 'ПРЕГЛЕДАЙ ЗАЯВКАТА',
            pressAction: {
              id: 'view_job_alert',
              launchActivity: 'default',
            },
          }
        ];
        
        // Set timeout from data or default to 5 minutes
        const timeout = data.timeoutSeconds ? parseInt(data.timeoutSeconds) * 1000 : 300000;
        notificationConfig.android.timeoutAfter = timeout; 
      } else {
        Logger.debug('🔔 No action buttons - notification type:', data?.type);
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

      Logger.debug('✅ Notification displayed via notifee');
    } catch (error) {
      Logger.error('❌ Error displaying notification:', error);
    }
  }

  /**
   * Handle notification action button press
   */
  private handleNotificationAction(actionId: string, data: any, retryCount: number = 0): void {
    Logger.debug('🎯 Handling notification action:', actionId, data, 'retry:', retryCount);

    if (!this.navigationRef) {
      if (retryCount < 10) {
        Logger.warn(`⚠️ Navigation ref not set for action, retrying... (attempt ${retryCount + 1}/10)`);
        setTimeout(() => {
          this.handleNotificationAction(actionId, data, retryCount + 1);
        }, 500);
        return;
      }
      Logger.error('❌ Navigation ref not set after 10 retries, giving up');
      return;
    }

    if (actionId === 'view_and_bid') {
      // Navigate to PlaceBid screen with caseId
      Logger.debug('📍 Navigating to PlaceBid screen for case:', data.caseId);
      try {
        this.navigationRef.navigate('PlaceBid', { caseId: data.caseId });
        Logger.debug('✅ Navigation to PlaceBid successful');
      } catch (error) {
        Logger.error('❌ Error navigating to PlaceBid:', error);
      }
    } else if (actionId === 'view_job_alert') {
      Logger.debug('🔔 View Job Alert action pressed, navigating to case:', data?.caseId);
      // Navigate directly to PlaceBid screen instead of modal (more reliable when app is in background)
      if (data?.caseId) {
        try {
          this.navigationRef.navigate('PlaceBid', { caseId: data.caseId });
          Logger.debug('✅ Navigation to PlaceBid successful from job alert');
        } catch (error) {
          Logger.error('❌ Error navigating to PlaceBid from job alert:', error);
          // Fallback to modal if navigation fails
          setTimeout(() => {
            SocketIOService.getInstance().triggerLocalJobAlert(data);
          }, 500);
        }
      }
    } else if (actionId === 'dismiss') {
      // Just dismiss the notification (do nothing)
      Logger.debug('✅ Notification dismissed');
    }
  }

  /**
   * Handle notification open/tap
   */
  private handleNotificationOpen(data: any, retryCount: number = 0): void {
    Logger.debug('👆 Handling notification tap - RAW DATA:', JSON.stringify(data));
    Logger.debug('👆 Data type:', data?.type);
    Logger.debug('👆 Case ID:', data?.caseId);
    Logger.debug('👆 Retry count:', retryCount);

    if (data?.type === 'job_incoming') {
       Logger.debug('🔔 Job incoming notification tapped, caseId:', data?.caseId);
       // Navigate directly to PlaceBid screen for reliability
       if (data?.caseId && this.navigationRef) {
         try {
           this.navigationRef.navigate('PlaceBid', { caseId: data.caseId });
           Logger.debug('✅ Navigation to PlaceBid successful from job_incoming tap');
           return;
         } catch (error) {
           Logger.error('❌ Error navigating from job_incoming:', error);
         }
       } else if (!this.navigationRef && retryCount < 10) {
         // Retry if navigation ref not ready yet (app was killed)
         Logger.warn(`⚠️ Navigation ref not set for job_incoming, retrying... (attempt ${retryCount + 1}/10)`);
         setTimeout(() => {
           this.handleNotificationOpen(data, retryCount + 1);
         }, 500);
         return;
       }
       // Fallback to modal only if navigation fails after retries
       Logger.debug('🔔 Falling back to modal for job_incoming');
       setTimeout(() => {
         SocketIOService.getInstance().triggerLocalJobAlert(data);
       }, 1000);
       return;
    }

    if (!this.navigationRef) {
      if (retryCount < 10) { // Max 10 retries = 5 seconds
        Logger.warn(`⚠️ Navigation ref not set, will retry in 500ms... (attempt ${retryCount + 1}/10)`);
        // Retry after a delay to allow navigation ref to be set
        setTimeout(() => {
          Logger.debug('🔄 Retrying navigation after delay...');
          this.handleNotificationOpen(data, retryCount + 1);
        }, 500);
      } else {
        Logger.error('❌ Navigation ref not set after 10 retries, giving up');
      }
      return;
    }

    // Navigate to appropriate screen based on data.type
    if (data?.type === 'new_case_available') {
      // Navigate directly to PlaceBid screen with caseId
      Logger.debug('📍 Navigating to PlaceBid screen for case:', data.caseId);
      try {
        this.navigationRef.navigate('PlaceBid', { caseId: data.caseId });
        Logger.debug('✅ Navigation to PlaceBid successful for case:', data.caseId);
      } catch (error) {
        Logger.error('❌ Error navigating to PlaceBid:', error);
      }
    } else if (data?.type === 'case_assigned') {
      // Navigate to Cases screen
      Logger.debug('📍 Navigating to Cases screen for assigned case:', data.caseId);
      try {
        this.navigationRef.navigate('Cases');
        Logger.debug('✅ Navigation to Cases successful');
      } catch (error) {
        Logger.error('❌ Error navigating to Cases:', error);
      }
    } else if (data?.type === 'chat_message') {
      // Navigate to Chat screen
      Logger.debug('📍 Navigating to Chat screen');
      try {
        this.navigationRef.navigate('Chat');
        Logger.debug('✅ Navigation to Chat successful');
      } catch (error) {
        Logger.error('❌ Error navigating to Chat:', error);
      }
    }
  }

  /**
   * Delete/deactivate token from backend (on logout)
   */
  async deleteToken(): Promise<void> {
    try {
      const token = await AsyncStorage.getItem('fcm_token');
      if (!token) {
        Logger.debug('⚠️ No FCM token to deactivate');
        return;
      }

      Logger.debug('🔒 Deactivating FCM token on backend...');

      // Deactivate token on backend BEFORE clearing local storage
      // This ensures the notification won't be sent to this device for the old user
      try {
        const response = await ApiService.getInstance().makeRequest(
          '/device-tokens/deactivate',
          {
            method: 'POST',
            body: JSON.stringify({ token }),
          }
        );
        
        if (response.success) {
          Logger.debug('✅ FCM token deactivated on backend');
        } else {
          Logger.warn('⚠️ Failed to deactivate FCM token on backend:', response.error);
        }
      } catch (backendError) {
        Logger.warn('⚠️ Error deactivating FCM token on backend:', backendError);
        // Continue with local cleanup even if backend fails
      }

      // Delete the FCM token locally (this generates a new token on next getToken())
      await messaging().deleteToken();
      await AsyncStorage.removeItem('fcm_token');
      await AsyncStorage.removeItem('fcm_token_registered');

      Logger.debug('✅ FCM token deleted locally');
    } catch (error) {
      Logger.error('❌ Error deleting FCM token:', error);
    }
  }
}

export default FCMService;
