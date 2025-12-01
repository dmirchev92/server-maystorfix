import * as admin from 'firebase-admin';
import logger from '../utils/logger';
import { DatabaseFactory } from '../models/DatabaseFactory';

interface FCMNotification {
  title: string;
  body: string;
  data?: Record<string, string>;
}

interface DeviceToken {
  id: string;
  user_id: string;
  token: string;
  platform: 'android' | 'ios';
  is_active: boolean;
}

export class FCMService {
  private static instance: FCMService;
  private db: any;
  private isPostgreSQL: boolean;
  private initialized: boolean = false;

  private constructor() {
    this.db = DatabaseFactory.getDatabase();
    this.isPostgreSQL = DatabaseFactory.isPostgreSQL();
    this.initializeFirebase();
  }

  public static getInstance(): FCMService {
    if (!FCMService.instance) {
      FCMService.instance = new FCMService();
    }
    return FCMService.instance;
  }

  /**
   * Initialize Firebase Admin SDK
   */
  private initializeFirebase(): void {
    try {
      // Check if already initialized
      if (admin.apps.length > 0) {
        logger.info('✅ Firebase Admin already initialized');
        this.initialized = true;
        return;
      }

      // Initialize with environment variables
      const projectId = process.env.FIREBASE_PROJECT_ID;
      const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
      const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

      if (!projectId || !clientEmail || !privateKey) {
        logger.warn('⚠️ Firebase credentials not configured. Push notifications will not work.');
        logger.warn('   Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY in .env');
        return;
      }

      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey,
        }),
      });

      this.initialized = true;
      logger.info('✅ Firebase Admin SDK initialized');
    } catch (error) {
      logger.error('❌ Error initializing Firebase Admin SDK:', error);
    }
  }

  /**
   * Send push notification to a specific user
   */
  async sendNotificationToUser(
    userId: string,
    notification: FCMNotification
  ): Promise<{ success: number; failed: number }> {
    console.log('📱 FCM DEBUG: sendNotificationToUser called', { userId, title: notification.title, initialized: this.initialized });
    
    if (!this.initialized) {
      console.log('⚠️ FCM DEBUG: Firebase not initialized!');
      logger.warn('⚠️ Firebase not initialized, skipping push notification');
      return { success: 0, failed: 0 };
    }

    try {
      // Get all active device tokens for user
      const tokens = await this.getUserDeviceTokens(userId);
      console.log('📱 FCM DEBUG: Found tokens:', tokens.length);

      if (tokens.length === 0) {
        console.log('📱 FCM DEBUG: No tokens, returning');
        logger.info('ℹ️ No device tokens found for user', { userId });
        return { success: 0, failed: 0 };
      }

      console.log('📱 FCM DEBUG: About to send to', tokens.length, 'devices');
      logger.info('📱 Sending push notification to user', {
        userId,
        deviceCount: tokens.length,
        title: notification.title,
      });

      // Send to all devices
      console.log('📱 FCM DEBUG: Calling sendToTokens...');
      const results = await this.sendToTokens(tokens.map(t => t.token), notification);
      console.log('📱 FCM DEBUG: sendToTokens returned:', results);

      // Mark failed tokens as inactive
      if (results.failed > 0) {
        await this.handleFailedTokens(tokens, results.failedTokens);
      }

      logger.info('✅ Push notifications sent', {
        userId,
        success: results.success,
        failed: results.failed,
      });

      return { success: results.success, failed: results.failed };
    } catch (error) {
      logger.error('❌ Error sending push notification to user:', error);
      return { success: 0, failed: 0 };
    }
  }

  /**
   * Send push notification to multiple tokens
   * 
   * IMPORTANT: We use DATA-ONLY messages to prevent duplicate notifications.
   * When both 'notification' and 'data' payloads are included, Firebase automatically
   * displays the notification on Android when the app is in background, AND our app
   * also displays one via notifee - causing duplicates.
   * 
   * With data-only messages, the app has full control over notification display.
   */
  private async sendToTokens(
    tokens: string[],
    notification: FCMNotification
  ): Promise<{ success: number; failed: number; failedTokens: string[] }> {
    try {
      // Prepare DATA-ONLY message (no 'notification' payload at top level)
      // This ensures our mobile app controls all notification display
      const message: admin.messaging.MulticastMessage = {
        // Include notification details in data so our app can display them
        data: {
          title: notification.title,
          body: notification.body,
          ...(notification.data || {}),
        },
        tokens,
        android: {
          priority: 'high',
          // No 'notification' here - let the app handle display
        },
        apns: {
          payload: {
            aps: {
              // For iOS, we need content-available for background delivery
              'content-available': 1,
              sound: 'default',
              badge: 1,
            },
          },
          headers: {
            'apns-priority': '10',
          },
        },
      };

      // Send multicast message
      const response = await admin.messaging().sendEachForMulticast(message);

      // Collect failed tokens
      const failedTokens: string[] = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          failedTokens.push(tokens[idx]);
          logger.warn('❌ Failed to send to token', {
            token: tokens[idx].substring(0, 20) + '...',
            error: resp.error?.message,
          });
        }
      });

      return {
        success: response.successCount,
        failed: response.failureCount,
        failedTokens,
      };
    } catch (error) {
      logger.error('❌ Error sending FCM multicast:', error);
      return { success: 0, failed: tokens.length, failedTokens: tokens };
    }
  }

  /**
   * Get all active device tokens for a user
   */
  private async getUserDeviceTokens(userId: string): Promise<DeviceToken[]> {
    if (this.isPostgreSQL) {
      const result = await this.db.query(
        'SELECT id, user_id, token, platform, is_active FROM device_tokens WHERE user_id = $1 AND is_active = true',
        [userId]
      );
      return result;
    } else {
      return new Promise((resolve, reject) => {
        this.db.db.all(
          'SELECT id, user_id, token, platform, is_active FROM device_tokens WHERE user_id = ? AND is_active = 1',
          [userId],
          (err: Error | null, rows: any[]) => {
            if (err) reject(err);
            else resolve(rows);
          }
        );
      });
    }
  }

  /**
   * Mark failed tokens as inactive
   */
  private async handleFailedTokens(
    allTokens: DeviceToken[],
    failedTokenStrings: string[]
  ): Promise<void> {
    try {
      const failedTokenIds = allTokens
        .filter(t => failedTokenStrings.includes(t.token))
        .map(t => t.id);

      if (failedTokenIds.length === 0) return;

      logger.info('🔄 Marking failed tokens as inactive', {
        count: failedTokenIds.length,
      });

      if (this.isPostgreSQL) {
        await this.db.query(
          'UPDATE device_tokens SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = ANY($1)',
          [failedTokenIds]
        );
      } else {
        const placeholders = failedTokenIds.map(() => '?').join(',');
        await new Promise<void>((resolve, reject) => {
          this.db.db.run(
            `UPDATE device_tokens SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id IN (${placeholders})`,
            failedTokenIds,
            (err: Error | null) => {
              if (err) reject(err);
              else resolve();
            }
          );
        });
      }
    } catch (error) {
      logger.error('❌ Error marking failed tokens as inactive:', error);
    }
  }

  /**
   * Register a new device token
   */
  async registerDeviceToken(
    userId: string,
    token: string,
    platform: 'android' | 'ios',
    deviceInfo?: any
  ): Promise<string> {
    try {
      const tokenId = require('uuid').v4();
      const now = new Date().toISOString();

      // Check if token already exists
      const existing = await this.getTokenByValue(token);

      if (existing) {
        // Update existing token
        logger.info('🔄 Updating existing device token', { userId, platform });

        if (this.isPostgreSQL) {
          await this.db.query(
            `UPDATE device_tokens 
             SET user_id = $1, is_active = true, last_used_at = $2, updated_at = $2, device_info = $3
             WHERE token = $4`,
            [userId, now, JSON.stringify(deviceInfo || {}), token]
          );
        } else {
          await new Promise<void>((resolve, reject) => {
            this.db.db.run(
              `UPDATE device_tokens 
               SET user_id = ?, is_active = 1, last_used_at = ?, updated_at = ?, device_info = ?
               WHERE token = ?`,
              [userId, now, now, JSON.stringify(deviceInfo || {}), token],
              (err: Error | null) => {
                if (err) reject(err);
                else resolve();
              }
            );
          });
        }

        return existing.id;
      }

      // Insert new token
      logger.info('➕ Registering new device token', { userId, platform });

      if (this.isPostgreSQL) {
        await this.db.query(
          `INSERT INTO device_tokens (id, user_id, token, platform, device_info, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [tokenId, userId, token, platform, JSON.stringify(deviceInfo || {}), now, now]
        );
      } else {
        await new Promise<void>((resolve, reject) => {
          this.db.db.run(
            `INSERT INTO device_tokens (id, user_id, token, platform, device_info, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [tokenId, userId, token, platform, JSON.stringify(deviceInfo || {}), now, now],
            (err: Error | null) => {
              if (err) reject(err);
              else resolve();
            }
          );
        });
      }

      logger.info('✅ Device token registered', { tokenId, userId, platform });
      return tokenId;
    } catch (error) {
      logger.error('❌ Error registering device token:', error);
      throw error;
    }
  }

  /**
   * Get token by value
   */
  private async getTokenByValue(token: string): Promise<DeviceToken | null> {
    if (this.isPostgreSQL) {
      const result = await this.db.query(
        'SELECT id, user_id, token, platform, is_active FROM device_tokens WHERE token = $1',
        [token]
      );
      return result[0] || null;
    } else {
      return new Promise((resolve, reject) => {
        this.db.db.get(
          'SELECT id, user_id, token, platform, is_active FROM device_tokens WHERE token = ?',
          [token],
          (err: Error | null, row: any) => {
            if (err) reject(err);
            else resolve(row || null);
          }
        );
      });
    }
  }

  /**
   * Delete device token
   */
  async deleteDeviceToken(tokenId: string, userId: string): Promise<void> {
    try {
      logger.info('🗑️ Deleting device token', { tokenId, userId });

      if (this.isPostgreSQL) {
        await this.db.query(
          'DELETE FROM device_tokens WHERE id = $1 AND user_id = $2',
          [tokenId, userId]
        );
      } else {
        await new Promise<void>((resolve, reject) => {
          this.db.db.run(
            'DELETE FROM device_tokens WHERE id = ? AND user_id = ?',
            [tokenId, userId],
            (err: Error | null) => {
              if (err) reject(err);
              else resolve();
            }
          );
        });
      }

      logger.info('✅ Device token deleted', { tokenId });
    } catch (error) {
      logger.error('❌ Error deleting device token:', error);
      throw error;
    }
  }

  /**
   * Get all device tokens for a user
   */
  async getUserTokens(userId: string): Promise<DeviceToken[]> {
    return this.getUserDeviceTokens(userId);
  }

  /**
   * Deactivate a device token by its value (for logout)
   * This deactivates the token regardless of which user it's assigned to,
   * because the physical device is logging out and shouldn't receive any notifications
   */
  async deactivateTokenByValue(token: string, userId: string): Promise<void> {
    try {
      logger.info('🔒 Deactivating device token by value', { userId, tokenPreview: token.substring(0, 20) + '...' });

      if (this.isPostgreSQL) {
        // Deactivate token regardless of user_id - the device is logging out
        const result = await this.db.query(
          'UPDATE device_tokens SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE token = $1 RETURNING id, user_id',
          [token]
        );
        if (result && result.length > 0) {
          logger.info('✅ Device token deactivated', { 
            tokenId: result[0].id, 
            wasAssignedTo: result[0].user_id,
            requestedBy: userId 
          });
        } else {
          logger.warn('⚠️ No token found to deactivate');
        }
      } else {
        await new Promise<void>((resolve, reject) => {
          this.db.db.run(
            'UPDATE device_tokens SET is_active = 0, updated_at = ? WHERE token = ?',
            [new Date().toISOString(), token],
            (err: Error | null) => {
              if (err) reject(err);
              else resolve();
            }
          );
        });
        logger.info('✅ Device token deactivated');
      }
    } catch (error) {
      logger.error('❌ Error deactivating device token:', error);
      throw error;
    }
  }
}

export default FCMService;
