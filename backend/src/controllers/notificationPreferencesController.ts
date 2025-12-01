/**
 * Notification Preferences Controller
 * Handles user notification settings for push and email notifications
 */

import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { body, validationResult } from 'express-validator';
import { DatabaseFactory } from '../models/DatabaseFactory';
import { PostgreSQLDatabase } from '../models/PostgreSQLDatabase';
import { authenticateToken } from '../middleware/auth';
import logger from '../utils/logger';

const router = Router();
const database = DatabaseFactory.getDatabase() as PostgreSQLDatabase;

export interface NotificationPreferences {
  id: string;
  user_id: string;
  // Push notifications
  push_enabled: boolean;
  push_new_cases: boolean;
  push_chat_messages: boolean;
  push_bid_won: boolean;
  push_new_bids: boolean;
  push_reviews: boolean;
  push_points_subscription: boolean;
  // Email notifications
  email_enabled: boolean;
  email_weekly_report: boolean;
  email_new_cases: boolean;
  email_bid_won: boolean;
  email_reviews: boolean;
  email_marketing: boolean;
  // Timestamps
  created_at: Date;
  updated_at: Date;
}

/**
 * GET /api/v1/notification-preferences
 * Get user's notification preferences
 */
router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' }
      });
    }

    // Get or create preferences
    let preferences = await getPreferences(userId);
    
    if (!preferences) {
      preferences = await createDefaultPreferences(userId);
    }

    res.json({
      success: true,
      data: preferences
    });
  } catch (error: any) {
    logger.error('Failed to get notification preferences', { error });
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to get notification preferences' }
    });
  }
});

/**
 * PUT /api/v1/notification-preferences
 * Update user's notification preferences
 */
router.put(
  '/',
  authenticateToken,
  [
    body('push_enabled').optional().isBoolean(),
    body('push_new_cases').optional().isBoolean(),
    body('push_chat_messages').optional().isBoolean(),
    body('push_bid_won').optional().isBoolean(),
    body('push_new_bids').optional().isBoolean(),
    body('push_reviews').optional().isBoolean(),
    body('push_points_subscription').optional().isBoolean(),
    body('email_enabled').optional().isBoolean(),
    body('email_weekly_report').optional().isBoolean(),
    body('email_new_cases').optional().isBoolean(),
    body('email_bid_won').optional().isBoolean(),
    body('email_reviews').optional().isBoolean(),
    body('email_marketing').optional().isBoolean(),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: errors.array() }
        });
      }

      const userId = (req as any).user?.id;
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' }
        });
      }

      // Ensure preferences exist
      let preferences = await getPreferences(userId);
      if (!preferences) {
        preferences = await createDefaultPreferences(userId);
      }

      // Build update query dynamically
      const allowedFields = [
        'push_enabled', 'push_new_cases', 'push_chat_messages', 'push_bid_won',
        'push_new_bids', 'push_reviews', 'push_points_subscription',
        'email_enabled', 'email_weekly_report', 'email_new_cases',
        'email_bid_won', 'email_reviews', 'email_marketing'
      ];

      const updates: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
          updates.push(`${field} = $${paramIndex}`);
          values.push(req.body[field]);
          paramIndex++;
        }
      }

      if (updates.length === 0) {
        return res.json({
          success: true,
          data: preferences,
          message: 'No changes made'
        });
      }

      updates.push(`updated_at = CURRENT_TIMESTAMP`);
      values.push(userId);

      const query = `
        UPDATE notification_preferences 
        SET ${updates.join(', ')}
        WHERE user_id = $${paramIndex}
        RETURNING *
      `;

      const rows = await database.query(query, values);
      
      logger.info('Notification preferences updated', { userId, updates: req.body });

      res.json({
        success: true,
        data: mapPreferences(rows[0]),
        message: 'Preferences updated successfully'
      });
    } catch (error: any) {
      logger.error('Failed to update notification preferences', { error });
      res.status(500).json({
        success: false,
        error: { code: 'SERVER_ERROR', message: 'Failed to update notification preferences' }
      });
    }
  }
);

/**
 * POST /api/v1/notification-preferences/reset
 * Reset preferences to defaults
 */
router.post('/reset', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' }
      });
    }

    const query = `
      UPDATE notification_preferences 
      SET 
        push_enabled = true,
        push_new_cases = true,
        push_chat_messages = true,
        push_bid_won = true,
        push_new_bids = true,
        push_reviews = true,
        push_points_subscription = true,
        email_enabled = true,
        email_weekly_report = true,
        email_new_cases = false,
        email_bid_won = true,
        email_reviews = true,
        email_marketing = false,
        updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $1
      RETURNING *
    `;

    const rows = await database.query(query, [userId]);
    
    logger.info('Notification preferences reset to defaults', { userId });

    res.json({
      success: true,
      data: mapPreferences(rows[0]),
      message: 'Preferences reset to defaults'
    });
  } catch (error: any) {
    logger.error('Failed to reset notification preferences', { error });
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to reset preferences' }
    });
  }
});

// Helper functions
async function getPreferences(userId: string): Promise<NotificationPreferences | null> {
  const query = `SELECT * FROM notification_preferences WHERE user_id = $1`;
  const rows = await database.query(query, [userId]);
  return rows.length > 0 ? mapPreferences(rows[0]) : null;
}

async function createDefaultPreferences(userId: string): Promise<NotificationPreferences> {
  const id = `notif_pref_${uuidv4().substring(0, 20)}`;
  const query = `
    INSERT INTO notification_preferences (id, user_id)
    VALUES ($1, $2)
    RETURNING *
  `;
  const rows = await database.query(query, [id, userId]);
  return mapPreferences(rows[0]);
}

function mapPreferences(row: any): NotificationPreferences {
  return {
    id: row.id,
    user_id: row.user_id,
    push_enabled: row.push_enabled,
    push_new_cases: row.push_new_cases,
    push_chat_messages: row.push_chat_messages,
    push_bid_won: row.push_bid_won,
    push_new_bids: row.push_new_bids,
    push_reviews: row.push_reviews,
    push_points_subscription: row.push_points_subscription,
    email_enabled: row.email_enabled,
    email_weekly_report: row.email_weekly_report,
    email_new_cases: row.email_new_cases,
    email_bid_won: row.email_bid_won,
    email_reviews: row.email_reviews,
    email_marketing: row.email_marketing,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

/**
 * Helper function to check if a user wants a specific notification type
 * Can be used by other services before sending notifications
 */
export async function shouldSendNotification(
  userId: string, 
  type: 'push' | 'email',
  category: string
): Promise<boolean> {
  try {
    const preferences = await getPreferences(userId);
    if (!preferences) return true; // Default to sending if no preferences

    if (type === 'push') {
      if (!preferences.push_enabled) return false;
      
      switch (category) {
        case 'new_case_available':
        case 'case_assigned':
          return preferences.push_new_cases;
        case 'new_message':
        case 'chat_message':
          return preferences.push_chat_messages;
        case 'bid_won':
          return preferences.push_bid_won;
        case 'new_bid_placed':
          return preferences.push_new_bids;
        case 'rating_received':
        case 'review':
          return preferences.push_reviews;
        case 'points_low_warning':
        case 'trial_expiring_soon':
        case 'trial_expired':
          return preferences.push_points_subscription;
        default:
          return true;
      }
    } else if (type === 'email') {
      if (!preferences.email_enabled) return false;
      
      switch (category) {
        case 'weekly_report':
          return preferences.email_weekly_report;
        case 'new_case_available':
          return preferences.email_new_cases;
        case 'bid_won':
          return preferences.email_bid_won;
        case 'rating_received':
        case 'review':
          return preferences.email_reviews;
        case 'marketing':
        case 'promotion':
          return preferences.email_marketing;
        default:
          return true;
      }
    }
    
    return true;
  } catch (error) {
    logger.error('Error checking notification preference', { userId, type, category, error });
    return true; // Default to sending on error
  }
}

export default router;
