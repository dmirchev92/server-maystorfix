import { DatabaseFactory } from '../models/DatabaseFactory';
import logger from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';
import { Server as SocketIOServer } from 'socket.io';
import { FCMService } from './FCMService';

interface Notification {
  id: string;
  user_id: string;
  type: 'case_assigned' | 'case_accepted' | 'case_completed' | 'case_declined' | 'new_case_available' | 'review_request' | 'trial_expiring_soon' | 'trial_expired' | 'subscription_upgrade_required';
  title: string;
  message: string;
  data?: any;
  read: boolean;
  created_at: string;
}

interface NotificationTemplate {
  type: string;
  title: string;
  message: string;
}

export class NotificationService {
  private db: any; // DatabaseFactory returns SQLiteDatabase | PostgreSQLDatabase
  private wsConnections: Map<string, any> = new Map(); // Store WebSocket connections by user ID
  private io: SocketIOServer | null = null; // Socket.IO instance for real-time notifications
  private isPostgreSQL: boolean;
  private fcmService: FCMService;

  constructor(io?: SocketIOServer) {
    this.db = DatabaseFactory.getDatabase();
    this.io = io || null;
    this.isPostgreSQL = DatabaseFactory.isPostgreSQL();
    this.fcmService = FCMService.getInstance();
    this.initializeNotificationTables();
  }

  /**
   * Set Socket.IO instance for real-time notifications
   */
  setSocketIO(io: SocketIOServer): void {
    this.io = io;
    logger.info('✅ Socket.IO instance set for NotificationService');
  }

  /**
   * Initialize notification tables if they don't exist
   */
  private async initializeNotificationTables(): Promise<void> {
    try {
      if (this.isPostgreSQL) {
        // PostgreSQL syntax
        await this.db.query(`
          CREATE TABLE IF NOT EXISTS notifications (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            type TEXT NOT NULL,
            title TEXT NOT NULL,
            message TEXT NOT NULL,
            data TEXT,
            read BOOLEAN DEFAULT false,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
          )
        `);

        // Create index for faster queries
        await this.db.query(`
          CREATE INDEX IF NOT EXISTS idx_notifications_user_read 
          ON notifications(user_id, read, created_at)
        `);
      } else {
        // SQLite syntax
        await new Promise<void>((resolve, reject) => {
          this.db.db.run(`
            CREATE TABLE IF NOT EXISTS notifications (
              id TEXT PRIMARY KEY,
              user_id TEXT NOT NULL,
              type TEXT NOT NULL,
              title TEXT NOT NULL,
              message TEXT NOT NULL,
              data TEXT,
              read INTEGER DEFAULT 0,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (user_id) REFERENCES users(id)
            )
          `, (err: Error | null) => {
            if (err) reject(err);
            else resolve();
          });
        });

        // Create index for faster queries
        await new Promise<void>((resolve, reject) => {
          this.db.db.run(`
            CREATE INDEX IF NOT EXISTS idx_notifications_user_read 
            ON notifications(user_id, read, created_at)
          `, (err: Error | null) => {
            if (err) reject(err);
            else resolve();
          });
        });
      }

      logger.info('✅ Notification tables initialized');
    } catch (error) {
      logger.error('❌ Error initializing notification tables:', error);
    }
  }

  /**
   * Register WebSocket connection for real-time notifications
   */
  registerConnection(userId: string, ws: any): void {
    this.wsConnections.set(userId, ws);
    logger.info('🔌 WebSocket connection registered', { userId });

    // Send unread notification count on connection
    this.sendUnreadCount(userId);
  }

  /**
   * Unregister WebSocket connection
   */
  unregisterConnection(userId: string): void {
    this.wsConnections.delete(userId);
    logger.info('🔌 WebSocket connection unregistered', { userId });
  }

  /**
   * Create and send notification
   */
  async createNotification(
    userId: string,
    type: string,
    title: string,
    message: string,
    data?: any
  ): Promise<string> {
    try {
      const notificationId = uuidv4();
      const now = new Date().toISOString();

      // Store notification in database
      if (this.isPostgreSQL) {
        await this.db.query(
          `INSERT INTO notifications (id, user_id, type, title, message, data, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [notificationId, userId, type, title, message, JSON.stringify(data), now]
        );
      } else {
        await new Promise<void>((resolve, reject) => {
          this.db.db.run(
            `INSERT INTO notifications (id, user_id, type, title, message, data, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [notificationId, userId, type, title, message, JSON.stringify(data), now],
            function(err: Error | null) {
              if (err) reject(err);
              else resolve();
            }
          );
        });
      }

      // Send real-time notification via Socket.IO (primary method)
      if (this.io) {
        const notificationPayload = {
          id: notificationId,
          type,
          title,
          message,
          data,
          created_at: now
        };

        // Emit to user's personal room in /chat namespace
        this.io.of('/chat').to(`user:${userId}`).emit('notification', notificationPayload);
        
        // For case assignments, also emit specific event for mobile app
        if (type === 'case_assigned' && data) {
          this.io.of('/chat').to(`user:${userId}`).emit('case_assigned', {
            id: data.caseId,
            customerName: data.customerName || 'New Customer',
            serviceType: data.serviceType || 'Service Request',
            description: message,
            priority: data.priority || 'medium',
            ...data
          });
          logger.info('📱 Emitted case_assigned event via Socket.IO', { userId, caseId: data.caseId });
        }
        
        logger.info('📡 Notification emitted via Socket.IO', { userId, type, event: 'notification' });
      }

      // Send real-time notification via WebSocket (fallback for legacy)
      const ws = this.wsConnections.get(userId);
      if (ws && ws.readyState === 1) { // WebSocket.OPEN
        ws.send(JSON.stringify({
          type: 'notification',
          data: {
            id: notificationId,
            type,
            title,
            message,
            data,
            created_at: now
          }
        }));
      }

      // Send updated unread count
      this.sendUnreadCount(userId);

      // Send FCM push notification (for background/killed app)
      try {
        await this.fcmService.sendNotificationToUser(userId, {
          title,
          body: message,
          data: {
            type,
            notificationId,
            ...(data && typeof data === 'object' ? 
              Object.fromEntries(
                Object.entries(data).map(([k, v]) => [k, String(v)])
              ) : {}
            )
          }
        });
      } catch (fcmError) {
        logger.warn('⚠️ FCM push notification failed (non-critical):', fcmError);
      }

      logger.info('✅ Notification created and sent', { 
        notificationId, 
        userId, 
        type,
        realTime: !!ws 
      });

      return notificationId;

    } catch (error) {
      logger.error('❌ Error creating notification:', error);
      throw error;
    }
  }

  /**
   * Send unread notification count to user
   */
  private async sendUnreadCount(userId: string): Promise<void> {
    try {
      const count = await this.getUnreadCount(userId);
      const ws = this.wsConnections.get(userId);
      
      if (ws && ws.readyState === 1) {
        ws.send(JSON.stringify({
          type: 'unread_count',
          data: { count }
        }));
      }
    } catch (error) {
      logger.error('❌ Error sending unread count:', error);
    }
  }

  /**
   * Get unread notification count for user
   */
  async getUnreadCount(userId: string): Promise<number> {
    if (this.isPostgreSQL) {
      const result = await this.db.query(
        'SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND read = false',
        [userId]
      );
      return parseInt(result[0]?.count || '0');
    } else {
      return new Promise((resolve, reject) => {
        this.db.db.get(
          'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND read = 0',
          [userId],
          (err: Error | null, row: any) => {
            if (err) reject(err);
            else resolve(row?.count || 0);
          }
        );
      });
    }
  }

  /**
   * Get notifications for user with pagination
   */
  async getUserNotifications(
    userId: string, 
    page: number = 1, 
    limit: number = 20
  ): Promise<{ notifications: Notification[], total: number }> {
    try {
      const offset = (page - 1) * limit;

      if (this.isPostgreSQL) {
        // Get total count
        const countResult = await this.db.query(
          'SELECT COUNT(*) as count FROM notifications WHERE user_id = $1',
          [userId]
        );
        const total = parseInt(countResult[0]?.count || '0');

        // Get notifications
        const rows = await this.db.query(
          `SELECT * FROM notifications 
           WHERE user_id = $1 
           ORDER BY created_at DESC 
           LIMIT $2 OFFSET $3`,
          [userId, limit, offset]
        );

        const notifications = rows.map((row: any) => ({
          ...row,
          data: row.data ? (typeof row.data === 'string' ? JSON.parse(row.data) : row.data) : null,
          read: !!row.read
        }));

        return { notifications, total };
      } else {
        // Get total count
        const total = await new Promise<number>((resolve, reject) => {
          this.db.db.get(
            'SELECT COUNT(*) as count FROM notifications WHERE user_id = ?',
            [userId],
            (err: Error | null, row: any) => {
              if (err) reject(err);
              else resolve(row?.count || 0);
            }
          );
        });

        // Get notifications
        const notifications = await new Promise<Notification[]>((resolve, reject) => {
          this.db.db.all(
            `SELECT * FROM notifications 
             WHERE user_id = ? 
             ORDER BY created_at DESC 
             LIMIT ? OFFSET ?`,
            [userId, limit, offset],
            (err: Error | null, rows: any[]) => {
              if (err) reject(err);
              else {
                const parsed = rows.map(row => ({
                  ...row,
                  data: row.data ? (typeof row.data === 'string' ? JSON.parse(row.data) : row.data) : null,
                  read: !!row.read
                }));
                resolve(parsed);
              }
            }
          );
        });

        return { notifications, total };
      }

    } catch (error) {
      logger.error('❌ Error getting user notifications:', error);
      throw error;
    }
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string, userId: string): Promise<void> {
    try {
      if (this.isPostgreSQL) {
        await this.db.query(
          'UPDATE notifications SET read = true WHERE id = $1 AND user_id = $2',
          [notificationId, userId]
        );
      } else {
        await new Promise<void>((resolve, reject) => {
          this.db.db.run(
            'UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?',
            [notificationId, userId],
            function(err: Error | null) {
              if (err) reject(err);
              else resolve();
            }
          );
        });
      }

      // Send updated unread count
      this.sendUnreadCount(userId);

      logger.info('✅ Notification marked as read', { notificationId, userId });

    } catch (error) {
      logger.error('❌ Error marking notification as read:', error);
      throw error;
    }
  }

  /**
   * Mark all notifications as read for user
   */
  async markAllAsRead(userId: string): Promise<void> {
    try {
      if (this.isPostgreSQL) {
        await this.db.query(
          'UPDATE notifications SET read = true WHERE user_id = $1 AND read = false',
          [userId]
        );
      } else {
        await new Promise<void>((resolve, reject) => {
          this.db.db.run(
            'UPDATE notifications SET read = 1 WHERE user_id = ? AND read = 0',
            [userId],
            function(err: Error | null) {
              if (err) reject(err);
              else resolve();
            }
          );
        });
      }

      // Send updated unread count
      this.sendUnreadCount(userId);

      logger.info('✅ All notifications marked as read', { userId });

    } catch (error) {
      logger.error('❌ Error marking all notifications as read:', error);
      throw error;
    }
  }

  /**
   * Case-specific notification methods
   */
  async notifyCaseAssigned(caseId: string, customerId: string, providerId: string, providerName: string): Promise<void> {
    console.log('🔔 NotificationService - notifyCaseAssigned called:', { caseId, customerId, providerId, providerName });
    await this.createNotification(
      customerId,
      'case_assigned',
      'Заявката ви е приета',
      `${providerName} прие вашата заявка и ще се свърже с вас скоро.`,
      { caseId, providerId }
    );
    console.log('✅ NotificationService - Case assigned notification created');
  }

  async notifyCaseAccepted(caseId: string, providerId: string, customerName: string): Promise<void> {
    await this.createNotification(
      providerId,
      'case_accepted',
      'Нова заявка за работа',
      `Имате нова заявка от ${customerName}. Моля свържете се с клиента.`,
      { caseId }
    );
  }

  async notifyCaseCompleted(caseId: string, customerId: string, providerId: string): Promise<void> {
    try {
      console.log('🔔 NotificationService - Case completed notification triggered:', { caseId, customerId, providerId });
      
      // Get case details for more specific notification
      let caseDetails;
      if (this.isPostgreSQL) {
        const result = await this.db.query(
          `SELECT c.*, p.first_name, p.last_name
           FROM marketplace_service_cases c
           LEFT JOIN users p ON c.provider_id = p.id
           WHERE c.id = $1`,
          [caseId]
        );
        caseDetails = result[0];
      } else {
        caseDetails = await new Promise<any>((resolve, reject) => {
          this.db.db.get(
            `SELECT c.*, p.first_name, p.last_name
             FROM marketplace_service_cases c
             LEFT JOIN users p ON c.provider_id = p.id
             WHERE c.id = ?`,
            [caseId],
            (err: Error | null, row: any) => {
              if (err) reject(err);
              else resolve(row);
            }
          );
        });
      }

      if (!caseDetails) {
        console.log('🔔 NotificationService - Case not found, using generic notification');
        await this.createNotification(
          customerId,
          'case_completed',
          'Заявката е завършена - Оценете услугата',
          'Вашата заявка е отбелязана като завършена. Моля споделете вашето мнение за получената услуга.',
          { caseId, providerId, action: 'review_service' }
        );
        return;
      }

      // Create more specific notification with case details
      const providerName = caseDetails.provider_name || `${caseDetails.first_name || ''} ${caseDetails.last_name || ''}`.trim() || 'Изпълнителя';
      const caseDescription = caseDetails.description || caseDetails.service_type || 'услугата';
      
      console.log('🔔 NotificationService - Creating notification...');
      await this.createNotification(
        customerId,
        'case_completed',
        `Завършена: ${caseDescription}`,
        `Заявката "${caseDescription}" от ${providerName} е завършена. Моля оценете получената услуга.`,
        { caseId, providerId, action: 'review_service' }
      );
      console.log('🔔 NotificationService - Notification created successfully');

      // Send survey request via chat message
      console.log('🔔 NotificationService - Sending survey to chat...');
      await this.sendSurveyToChat(caseId, customerId, providerId);
      console.log('🔔 NotificationService - Survey chat message sent successfully');
      
    } catch (error) {
      console.error('🔔 NotificationService - Error in notifyCaseCompleted:', error);
      throw error;
    }
  }

  private async sendSurveyToChat(caseId: string, customerId: string, providerId: string): Promise<void> {
    try {
      console.log('💬 sendSurveyToChat - Getting case details for:', caseId);
      
      // Get case and provider details
      let caseDetails;
      if (this.isPostgreSQL) {
        const result = await this.db.query(
          `SELECT c.*, u.first_name, u.last_name, sp.business_name
           FROM marketplace_service_cases c
           LEFT JOIN users u ON c.provider_id = u.id
           LEFT JOIN service_provider_profiles sp ON u.id = sp.user_id
           WHERE c.id = $1`,
          [caseId]
        );
        caseDetails = result[0];
      } else {
        caseDetails = await new Promise<any>((resolve, reject) => {
          this.db.db.get(
            `SELECT c.*, u.first_name, u.last_name, sp.business_name
             FROM marketplace_service_cases c
             LEFT JOIN users u ON c.provider_id = u.id
             LEFT JOIN service_provider_profiles sp ON u.id = sp.user_id
             WHERE c.id = ?`,
            [caseId],
            (err: Error | null, row: any) => {
              if (err) reject(err);
              else resolve(row);
            }
          );
        });
      }

      console.log('💬 sendSurveyToChat - Case details:', caseDetails);

      if (!caseDetails) {
        console.log('💬 sendSurveyToChat - No case details found, returning');
        return;
      }

      // Find existing conversation between customer and provider
      console.log('💬 sendSurveyToChat - Looking for conversation between:', customerId, 'and', providerId);
      
      let conversation;
      if (this.isPostgreSQL) {
        const result = await this.db.query(
          `SELECT id FROM marketplace_conversations 
           WHERE customer_id = $1 AND provider_id = $2
           ORDER BY created_at DESC LIMIT 1`,
          [customerId, providerId]
        );
        conversation = result[0];
      } else {
        conversation = await new Promise<any>((resolve, reject) => {
          this.db.db.get(
            `SELECT id FROM marketplace_conversations 
             WHERE customer_id = ? AND provider_id = ?
             ORDER BY created_at DESC LIMIT 1`,
            [customerId, providerId],
            (err: Error | null, row: any) => {
              if (err) reject(err);
              else resolve(row);
            }
          );
        });
      }

      console.log('💬 sendSurveyToChat - Found conversation:', conversation);

      if (conversation) {
        const surveyMessage = `🌟 Заявката "${caseDetails.description}" е завършена успешно!

Моля споделете вашето мнение за получената услуга от ${caseDetails.business_name || `${caseDetails.first_name} ${caseDetails.last_name}`}.

Вашата оценка помага на други клиенти да направят правилния избор.

👆 Натиснете тук за да оцените услугата`;

        // Insert survey message into chat
        console.log('💬 sendSurveyToChat - Inserting survey message into conversation:', conversation.id);
        
        const messageId = require('uuid').v4();
        if (this.isPostgreSQL) {
          await this.db.query(
            `INSERT INTO marketplace_chat_messages (id, conversation_id, sender_id, message, message_type, data, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
              messageId,
              conversation.id,
              'system', // System message
              surveyMessage,
              'survey_request',
              JSON.stringify({ caseId }), // Include caseId in data
              new Date().toISOString()
            ]
          );
          console.log('💬 sendSurveyToChat - Survey message inserted successfully with ID:', messageId);
        } else {
          await new Promise<void>((resolve, reject) => {
            this.db.db.run(
              `INSERT INTO marketplace_chat_messages (id, conversation_id, sender_id, message, message_type, data, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)`,
              [
                messageId,
                conversation.id,
                'system', // System message
                surveyMessage,
                'survey_request',
                JSON.stringify({ caseId }), // Include caseId in data
                new Date().toISOString()
              ],
              (err: Error | null) => {
                if (err) {
                  console.error('💬 sendSurveyToChat - Error inserting message:', err);
                  reject(err);
                } else {
                  console.log('💬 sendSurveyToChat - Survey message inserted successfully with ID:', messageId);
                  resolve();
                }
              }
            );
          });
        }
      } else {
        console.log('💬 sendSurveyToChat - No conversation found between customer and provider');
      }
    } catch (error) {
      console.error('💬 sendSurveyToChat - Error sending survey to chat:', error);
      throw error;
    }
  }


  async notifyNewCaseAvailable(caseId: string, category: string, location: string, providerIds: string[]): Promise<void> {
    const title = 'Нова заявка в района ви';
    const message = `Нова заявка за ${category} в ${location}. Проверете дали можете да я приемете.`;

    // Send to all relevant providers
    for (const providerId of providerIds) {
      await this.createNotification(
        providerId,
        'new_case_available',
        title,
        message,
        { caseId, category, location }
      );
    }
  }

  async notifyReviewRequest(caseId: string, customerId: string, providerName: string): Promise<void> {
    await this.createNotification(
      customerId,
      'review_request',
      'Оценете услугата',
      `Моля оценете работата на ${providerName}. Вашето мнение е важно за нас.`,
      { caseId }
    );
  }

  /**
   * Notify user that their trial is expiring soon
   */
  async notifyTrialExpiringSoon(userId: string, casesRemaining: number, daysRemaining: number): Promise<void> {
    const title = '⚠️ Безплатният период скоро изтича';
    let message = '';
    
    if (casesRemaining <= 2 && casesRemaining > 0) {
      message = `Имате още ${casesRemaining} ${casesRemaining === 1 ? 'заявка' : 'заявки'} в безплатния период. Надстройте сега за неограничен достъп!`;
    } else if (daysRemaining <= 3 && daysRemaining > 0) {
      message = `Безплатният ви период изтича след ${daysRemaining} ${daysRemaining === 1 ? 'ден' : 'дни'}. Надстройте сега за да продължите да използвате платформата!`;
    } else {
      message = 'Вашият безплатен период скоро изтича. Надстройте сега за неограничен достъп!';
    }

    await this.createNotification(
      userId,
      'trial_expiring_soon',
      title,
      message,
      { 
        casesRemaining, 
        daysRemaining,
        action: 'upgrade',
        upgradeUrl: '/upgrade-required'
      }
    );
  }

  /**
   * Notify user that their trial has expired
   */
  async notifyTrialExpired(userId: string, reason: 'cases_limit' | 'time_limit'): Promise<void> {
    const title = '🔒 Безплатният период изтече';
    let message = '';
    
    if (reason === 'cases_limit') {
      message = 'Достигнахте максимума от 5 заявки за безплатния план. Надстройте сега за да продължите да приемате заявки!';
    } else {
      message = 'Вашият 14-дневен пробен период приключи. Надстройте сега за да продължите да използвате платформата!';
    }

    await this.createNotification(
      userId,
      'trial_expired',
      title,
      message,
      { 
        reason,
        action: 'upgrade_required',
        upgradeUrl: '/upgrade-required'
      }
    );
  }

  /**
   * Notify user that they need to upgrade to continue
   */
  async notifySubscriptionUpgradeRequired(userId: string, feature: string): Promise<void> {
    const title = '💳 Надстройване необходимо';
    const message = `За да използвате "${feature}", моля надстройте вашия абонамент.`;

    await this.createNotification(
      userId,
      'subscription_upgrade_required',
      title,
      message,
      { 
        feature,
        action: 'upgrade',
        upgradeUrl: '/upgrade-required'
      }
    );
  }
}

export default NotificationService;
