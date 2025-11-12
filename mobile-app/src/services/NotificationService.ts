import notifee, { AndroidImportance, AndroidStyle, EventType } from '@notifee/react-native';
import { Platform } from 'react-native';

export interface ChatNotification {
  conversationId: string;
  senderName: string;
  message: string;
  timestamp: string;
}

export interface CaseNotification {
  caseId: string;
  customerName: string;
  serviceType: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
}

class NotificationService {
  private static instance: NotificationService;
  private initialized = false;

  private constructor() {}

  public static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  /**
   * Initialize notification service and request permissions
   */
  public async initialize(): Promise<boolean> {
    try {
      if (this.initialized) {
        console.log('📱 NotificationService already initialized');
        return true;
      }

      console.log('📱 Initializing NotificationService...');

      // Request permissions
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        console.warn('⚠️ Notification permissions not granted');
        return false;
      }

      // Create notification channels for Android
      if (Platform.OS === 'android') {
        await this.createNotificationChannels();
      }

      // Set up notification handlers
      this.setupNotificationHandlers();

      this.initialized = true;
      console.log('✅ NotificationService initialized successfully');
      return true;
    } catch (error) {
      console.error('❌ Error initializing NotificationService:', error);
      return false;
    }
  }

  /**
   * Request notification permissions
   */
  private async requestPermissions(): Promise<boolean> {
    try {
      const settings = await notifee.requestPermission();
      
      if (settings.authorizationStatus >= 1) {
        console.log('✅ Notification permissions granted');
        return true;
      } else {
        console.warn('⚠️ Notification permissions denied');
        return false;
      }
    } catch (error) {
      console.error('❌ Error requesting notification permissions:', error);
      return false;
    }
  }

  /**
   * Create notification channels for Android
   */
  private async createNotificationChannels(): Promise<void> {
    try {
      // Chat messages channel with enhanced settings
      await notifee.createChannel({
        id: 'chat_messages',
        name: 'Chat Messages',
        description: 'Notifications for new chat messages',
        importance: AndroidImportance.HIGH,
        sound: 'default',
        vibration: true,
        vibrationPattern: [300, 500],
        lights: true,
        lightColor: '#4A90E2',
        badge: true,
      });

      // Case assignments channel with enhanced settings
      await notifee.createChannel({
        id: 'case_assignments',
        name: 'Case Assignments',
        description: 'Notifications for new case assignments',
        importance: AndroidImportance.HIGH,
        sound: 'default',
        vibration: true,
        vibrationPattern: [500, 500, 500],
        lights: true,
        lightColor: '#FF4444',
        badge: true,
      });

      // Urgent cases channel with maximum priority
      await notifee.createChannel({
        id: 'urgent_cases',
        name: 'Urgent Cases',
        description: 'Notifications for urgent case assignments',
        importance: AndroidImportance.HIGH,
        sound: 'default',
        vibration: true,
        vibrationPattern: [500, 200, 500, 200, 500],
        lights: true,
        lightColor: '#FF0000',
        badge: true,
      });

      console.log('✅ Notification channels created');
    } catch (error) {
      console.error('❌ Error creating notification channels:', error);
    }
  }

  /**
   * Set up notification event handlers
   */
  private setupNotificationHandlers(): void {
    // Handle notification press
    notifee.onForegroundEvent(({ type, detail }) => {
      if (type === EventType.PRESS) {
        console.log('📱 Notification pressed:', detail.notification);
        this.handleNotificationPress(detail.notification);
      }
    });

    // Handle background notification press
    notifee.onBackgroundEvent(async ({ type, detail }) => {
      if (type === EventType.PRESS) {
        console.log('📱 Background notification pressed:', detail.notification);
        this.handleNotificationPress(detail.notification);
      }
    });
  }

  /**
   * Handle notification press - navigate to appropriate screen
   */
  private handleNotificationPress(notification: any): void {
    const data = notification?.data;
    
    if (!data) return;

    if (data.type === 'chat_message') {
      // Navigate to chat detail screen
      console.log('📱 Navigate to chat:', data.conversationId);
      // TODO: Implement navigation
    } else if (data.type === 'case_assignment') {
      // Navigate to case detail screen
      console.log('📱 Navigate to case:', data.caseId);
      // TODO: Implement navigation
    }
  }

  /**
   * Show notification for new chat message
   */
  public async showChatNotification(data: ChatNotification): Promise<void> {
    try {
      console.log('💬 Showing chat notification:', data);

      await notifee.displayNotification({
        title: data.senderName,
        body: data.message,
        android: {
          channelId: 'chat_messages',
          importance: AndroidImportance.HIGH,
          pressAction: {
            id: 'default',
          },
          style: {
            type: AndroidStyle.MESSAGING,
            person: {
              name: data.senderName,
            },
            messages: [
              {
                text: data.message,
                timestamp: Date.now(),
              },
            ],
          },
          smallIcon: 'ic_notification',
          color: '#4A90E2',
          sound: 'default',
          vibrationPattern: [300, 500],
          // Show as heads-up notification
          category: 'message',
          showTimestamp: true,
          timestamp: Date.now(),
          // Auto-cancel when tapped
          autoCancel: true,
          // Show on lock screen
          visibility: 1, // PUBLIC
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
          categoryId: 'message',
          interruptionLevel: 'timeSensitive',
        },
        data: {
          type: 'chat_message',
          conversationId: data.conversationId,
          senderName: data.senderName,
        },
      });

      console.log('✅ Chat notification displayed');
    } catch (error) {
      console.error('❌ Error showing chat notification:', error);
    }
  }

  /**
   * Show notification for new case assignment
   */
  public async showCaseNotification(data: CaseNotification): Promise<void> {
    try {
      console.log('📋 Showing case notification:', data);

      const priorityEmoji = {
        low: '🟢',
        medium: '🟡',
        high: '🟠',
        urgent: '🔴',
      };

      // Use urgent channel for urgent cases
      const channelId = data.priority === 'urgent' ? 'urgent_cases' : 'case_assignments';

      await notifee.displayNotification({
        title: `${priorityEmoji[data.priority]} New Case Assignment`,
        body: `${data.customerName} - ${data.serviceType}\n${data.description}`,
        android: {
          channelId,
          importance: AndroidImportance.HIGH,
          pressAction: {
            id: 'default',
          },
          style: {
            type: AndroidStyle.BIGTEXT,
            text: `Customer: ${data.customerName}\nService: ${data.serviceType}\n\n${data.description}`,
          },
          smallIcon: 'ic_notification',
          largeIcon: 'ic_launcher',
          color: data.priority === 'urgent' ? '#FF4444' : '#4A90E2',
          sound: 'default',
          vibrationPattern: data.priority === 'urgent' ? [500, 200, 500, 200, 500] : [300, 500],
          // Show as heads-up notification
          category: 'event',
          showTimestamp: true,
          timestamp: Date.now(),
          autoCancel: true,
          // Show on lock screen
          visibility: 1, // PUBLIC
          // Make urgent cases more prominent
          ongoing: data.priority === 'urgent',
          actions: [
            {
              title: 'View Case',
              pressAction: {
                id: 'view_case',
              },
            },
            {
              title: 'Dismiss',
              pressAction: {
                id: 'dismiss',
              },
            },
          ],
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
          categoryId: 'case_assignment',
          // Make urgent cases critical
          interruptionLevel: data.priority === 'urgent' ? 'critical' : 'timeSensitive',
        },
        data: {
          type: 'case_assignment',
          caseId: data.caseId,
          priority: data.priority,
          customerName: data.customerName,
          serviceType: data.serviceType,
        },
      });

      console.log('✅ Case notification displayed');
    } catch (error) {
      console.error('❌ Error showing case notification:', error);
    }
  }

  /**
   * Cancel all notifications
   */
  public async cancelAllNotifications(): Promise<void> {
    try {
      await notifee.cancelAllNotifications();
      console.log('✅ All notifications cancelled');
    } catch (error) {
      console.error('❌ Error cancelling notifications:', error);
    }
  }

  /**
   * Cancel notification by ID
   */
  public async cancelNotification(notificationId: string): Promise<void> {
    try {
      await notifee.cancelNotification(notificationId);
      console.log('✅ Notification cancelled:', notificationId);
    } catch (error) {
      console.error('❌ Error cancelling notification:', error);
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
      console.error('❌ Error getting badge count:', error);
      return 0;
    }
  }

  /**
   * Set badge count
   */
  public async setBadgeCount(count: number): Promise<void> {
    try {
      await notifee.setBadgeCount(count);
      console.log('✅ Badge count set to:', count);
    } catch (error) {
      console.error('❌ Error setting badge count:', error);
    }
  }

  /**
   * Increment badge count
   */
  public async incrementBadgeCount(): Promise<void> {
    try {
      const currentCount = await this.getBadgeCount();
      await this.setBadgeCount(currentCount + 1);
    } catch (error) {
      console.error('❌ Error incrementing badge count:', error);
    }
  }

  /**
   * Clear badge count
   */
  public async clearBadgeCount(): Promise<void> {
    try {
      await this.setBadgeCount(0);
      console.log('✅ Badge count cleared');
    } catch (error) {
      console.error('❌ Error clearing badge count:', error);
    }
  }
}

export default NotificationService;
