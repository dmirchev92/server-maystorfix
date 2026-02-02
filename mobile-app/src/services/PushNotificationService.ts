import { Logger } from '../utils/Logger';
import notifee, { AndroidImportance, AndroidStyle, EventType } from '@notifee/react-native';
import { Platform } from 'react-native';
import ApiService from './ApiService';

interface NotificationData {
  type: 'message' | 'case' | 'case_update';
  conversationId?: string;
  caseId?: string;
  senderId?: string;
  senderName?: string;
  message?: string;
}

class PushNotificationService {
  private static instance: PushNotificationService;
  private channelId: string = 'default';
  private messageChannelId: string = 'messages';
  private caseChannelId: string = 'cases';

  private constructor() {
    this.initialize();
  }

  public static getInstance(): PushNotificationService {
    if (!PushNotificationService.instance) {
      PushNotificationService.instance = new PushNotificationService();
    }
    return PushNotificationService.instance;
  }

  /**
   * Initialize notification channels and listeners
   */
  public async initialize(): Promise<void> {
    try {
      Logger.debug('🔔 Initializing Push Notification Service...');

      // Request permissions
      await this.requestPermissions();

      // Create notification channels
      await this.createChannels();

      // Set up notification event listeners
      this.setupNotificationListeners();

      Logger.debug('✅ Push Notification Service initialized');
    } catch (error) {
      Logger.error('❌ Error initializing push notifications:', error);
    }
  }

  /**
   * Request notification permissions
   */
  public async requestPermissions(): Promise<boolean> {
    try {
      Logger.debug('🔔 Requesting notification permissions...');
      
      const settings = await notifee.requestPermission();
      
      Logger.debug('🔔 Permission status:', settings.authorizationStatus);
      
      return settings.authorizationStatus === 1; // 1 = AUTHORIZED
    } catch (error) {
      Logger.error('❌ Error requesting permissions:', error);
      return false;
    }
  }

  /**
   * Create notification channels for Android
   */
  private async createChannels(): Promise<void> {
    if (Platform.OS !== 'android') return;

    try {
      // Default channel
      await notifee.createChannel({
        id: this.channelId,
        name: 'General Notifications',
        importance: AndroidImportance.HIGH,
        sound: 'default',
        vibration: true,
      });

      // Messages channel
      await notifee.createChannel({
        id: this.messageChannelId,
        name: 'Chat Messages',
        description: 'Notifications for new chat messages',
        importance: AndroidImportance.HIGH,
        sound: 'default',
        vibration: true,
        badge: true,
      });

      // Cases channel
      await notifee.createChannel({
        id: this.caseChannelId,
        name: 'Case Updates',
        description: 'Notifications for case assignments and updates',
        importance: AndroidImportance.HIGH,
        sound: 'default',
        vibration: true,
        badge: true,
      });

      Logger.debug('✅ Notification channels created');
    } catch (error) {
      Logger.error('❌ Error creating channels:', error);
    }
  }

  /**
   * Set up notification event listeners
   */
  private setupNotificationListeners(): void {
    // Handle notification press
    notifee.onForegroundEvent(async ({ type, detail }) => {
      Logger.debug('🔔 Foreground notification event:', type);

      if (type === EventType.PRESS) {
        Logger.debug('🔔 Notification pressed:', detail.notification);
        await this.handleNotificationPress(detail.notification?.data as unknown as NotificationData);
      }
    });

    // Handle background notification press
    notifee.onBackgroundEvent(async ({ type, detail }) => {
      Logger.debug('🔔 Background notification event:', type);

      if (type === EventType.PRESS) {
        Logger.debug('🔔 Notification pressed (background):', detail.notification);
        await this.handleNotificationPress(detail.notification?.data as unknown as NotificationData);
      }
    });
  }

  /**
   * Handle notification press - navigate to appropriate screen
   */
  private async handleNotificationPress(data: NotificationData): Promise<void> {
    if (!data) return;

    Logger.debug('🔔 Handling notification press:', data);

    // Store navigation intent for app to handle
    // The app will check this on startup/resume
    if (data.type === 'message' && data.conversationId) {
      // Navigate to chat
      Logger.debug('💬 Should navigate to conversation:', data.conversationId);
      // TODO: Implement navigation
    } else if (data.type === 'case' && data.caseId) {
      // Navigate to case details
      Logger.debug('📋 Should navigate to case:', data.caseId);
      // TODO: Implement navigation
    }
  }

  /**
   * Display a chat message notification
   */
  public async showMessageNotification(data: {
    conversationId: string;
    senderName: string;
    message: string;
    senderId: string;
  }): Promise<void> {
    try {
      Logger.debug('💬 Showing message notification:', data.senderName);

      await notifee.displayNotification({
        title: data.senderName,
        body: data.message,
        android: {
          channelId: this.messageChannelId,
          importance: AndroidImportance.HIGH,
          sound: 'default',
          vibrationPattern: [300, 500],
          pressAction: {
            id: 'default',
          },
          // Show as heads-up notification (bubble)
          style: {
            type: AndroidStyle.MESSAGING,
            person: {
              name: data.senderName,
            },
            messages: [
              {
                text: data.message,
                timestamp: Date.now(),
                person: {
                  name: data.senderName,
                },
              },
            ],
          },
          smallIcon: 'ic_notification',
          color: '#4F46E5',
        },
        data: {
          type: 'message',
          conversationId: data.conversationId,
          senderId: data.senderId,
          senderName: data.senderName,
        } as any,
      });

      Logger.debug('✅ Message notification displayed');
    } catch (error) {
      Logger.error('❌ Error showing message notification:', error);
    }
  }

  /**
   * Display a case assignment notification
   */
  public async showCaseNotification(data: {
    caseId: string;
    title: string;
    message: string;
    type: 'new' | 'assigned' | 'update';
  }): Promise<void> {
    try {
      Logger.debug('📋 Showing case notification:', data.title);

      const icon = data.type === 'new' ? '📋' : data.type === 'assigned' ? '🎯' : '🔄';

      await notifee.displayNotification({
        title: `${icon} ${data.title}`,
        body: data.message,
        android: {
          channelId: this.caseChannelId,
          importance: AndroidImportance.HIGH,
          sound: 'default',
          vibrationPattern: [300, 500],
          pressAction: {
            id: 'default',
          },
          smallIcon: 'ic_notification',
          color: '#10B981',
        },
        data: {
          type: 'case',
          caseId: data.caseId,
        } as any,
      });

      Logger.debug('✅ Case notification displayed');
    } catch (error) {
      Logger.error('❌ Error showing case notification:', error);
    }
  }

  /**
   * Display a general notification
   */
  public async showNotification(data: {
    title: string;
    body: string;
    data?: any;
  }): Promise<void> {
    try {
      Logger.debug('🔔 Showing notification:', data.title);

      await notifee.displayNotification({
        title: data.title,
        body: data.body,
        android: {
          channelId: this.channelId,
          importance: AndroidImportance.HIGH,
          sound: 'default',
          pressAction: {
            id: 'default',
          },
          smallIcon: 'ic_notification',
          color: '#4F46E5',
        },
        data: data.data,
      });

      Logger.debug('✅ Notification displayed');
    } catch (error) {
      Logger.error('❌ Error showing notification:', error);
    }
  }

  /**
   * Cancel a specific notification
   */
  public async cancelNotification(notificationId: string): Promise<void> {
    try {
      await notifee.cancelNotification(notificationId);
      Logger.debug('✅ Notification cancelled:', notificationId);
    } catch (error) {
      Logger.error('❌ Error cancelling notification:', error);
    }
  }

  /**
   * Cancel all notifications
   */
  public async cancelAllNotifications(): Promise<void> {
    try {
      await notifee.cancelAllNotifications();
      Logger.debug('✅ All notifications cancelled');
    } catch (error) {
      Logger.error('❌ Error cancelling all notifications:', error);
    }
  }

  /**
   * Get badge count
   */
  public async getBadgeCount(): Promise<number> {
    try {
      const count = await notifee.getBadgeCount();
      return count;
    } catch (error) {
      Logger.error('❌ Error getting badge count:', error);
      return 0;
    }
  }

  /**
   * Set badge count
   */
  public async setBadgeCount(count: number): Promise<void> {
    try {
      await notifee.setBadgeCount(count);
      Logger.debug('✅ Badge count set:', count);
    } catch (error) {
      Logger.error('❌ Error setting badge count:', error);
    }
  }

  /**
   * Increment badge count
   */
  public async incrementBadge(): Promise<void> {
    try {
      const current = await this.getBadgeCount();
      await this.setBadgeCount(current + 1);
    } catch (error) {
      Logger.error('❌ Error incrementing badge:', error);
    }
  }

  /**
   * Clear badge
   */
  public async clearBadge(): Promise<void> {
    try {
      await this.setBadgeCount(0);
      Logger.debug('✅ Badge cleared');
    } catch (error) {
      Logger.error('❌ Error clearing badge:', error);
    }
  }
}

export default PushNotificationService;
