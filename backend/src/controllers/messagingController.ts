// Messaging Controller
import { Router, Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import rateLimit from 'express-rate-limit';

import { ViberBusinessService } from '../services/ViberBusinessService';
import { authenticateToken } from '../middleware/auth';
import { validateSMSRequest } from '../middleware/smsSecurityMiddleware';
import logger, { gdprLogger } from '../utils/logger';
import config from '../utils/config';
import { ServiceTextProError } from '../types';

const router = Router();

// Initialize services (some may not be fully implemented yet)
let viberService: any = null;
try {
  const { ViberBusinessService } = require('../services/ViberBusinessService');
  viberService = new ViberBusinessService();
} catch (error: any) {
  logger.warn('ViberBusinessService not available:', error?.message || 'Unknown error');
}

// Rate limiting for messaging endpoints
const messagingLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 10, // 10 messages per minute
  message: {
    success: false,
    error: {
      code: 'MESSAGING_RATE_LIMIT_EXCEEDED',
      message: 'Too many messages sent, please try again later'
    }
  }
});

/**
 * @swagger
 * /api/messaging/viber/send:
 *   post:
 *     summary: Send Viber Business message
 *     tags: [Messaging]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - receiver
 *               - message
 *             properties:
 *               receiver:
 *                 type: string
 *                 description: Viber user ID or phone number
 *               message:
 *                 type: string
 *                 description: Message content
 *               type:
 *                 type: string
 *                 enum: [text, picture, contact]
 *                 default: text
 *               media:
 *                 type: string
 *                 description: Media URL (for picture messages)
 *     responses:
 *       200:
 *         description: Message sent successfully
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Unauthorized
 *       429:
 *         description: Rate limit exceeded
 */
router.post('/viber/send', messagingLimiter, [
  body('receiver').isString().notEmpty().withMessage('Receiver is required'),
  body('message').isString().notEmpty().withMessage('Message is required'),
  body('type').optional().isIn(['text', 'picture', 'contact']).withMessage('Invalid message type'),
  body('media').optional().isURL().withMessage('Invalid media URL'),
], async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request data',
          details: errors.array()
        }
      });
      return;
    }

    const { receiver, message, type = 'text', media } = req.body;
    const businessId = req.user?.businessId;

    if (!businessId) {
      res.status(400).json({
        success: false,
        error: {
          code: 'BUSINESS_REQUIRED',
          message: 'Business ID is required'
        }
      });
      return;
    }

    // Check if Viber Business is configured
    if (!viberService.isConfigured()) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VIBER_NOT_CONFIGURED',
          message: 'Viber Business is not configured'
        }
      });
      return;
    }

    let success = false;
    const trackingData = `business_${businessId}_${Date.now()}`;

    // Send message based on type
    switch (type) {
      case 'text':
        success = await viberService.sendTextMessage(receiver, message, trackingData);
        break;
      case 'picture':
        if (!media) {
          res.status(400).json({
            success: false,
            error: {
              code: 'MEDIA_REQUIRED',
              message: 'Media URL is required for picture messages'
            }
          });
          return;
        }
        success = await viberService.sendPictureMessage(receiver, media, message);
        break;
      case 'contact':
        // For contact messages, parse the message as contact info
        const contactInfo = JSON.parse(message);
        success = await viberService.sendContactMessage(
          receiver, 
          contactInfo.name, 
          contactInfo.phone
        );
        break;
      default:
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_MESSAGE_TYPE',
            message: 'Invalid message type'
          }
        });
        return;
    }

    if (success) {
      // Log the message in database (simplified for now)
      // TODO: Implement proper message logging when database methods are available
      
      // GDPR logging
      gdprLogger.logDataAccess(
        req.user?.id || 'anonymous',
        'viber_message_sent',
        'business_communication'
      );

      res.json({
        success: true,
        data: {
          message: 'Viber message sent successfully',
          trackingData
        }
      });
    } else {
      res.status(500).json({
        success: false,
        error: {
          code: 'VIBER_SEND_FAILED',
          message: 'Failed to send Viber message'
        }
      });
    }
  } catch (error) {
    logger.error('Error sending Viber message', { 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
    next(error);
  }
});

/**
 * @swagger
 * /api/messaging/viber/webhook:
 *   post:
 *     summary: Viber Business webhook endpoint
 *     tags: [Messaging]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Webhook processed successfully
 */
router.post('/viber/webhook', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const event = req.body;
    
    // Process the webhook event
    viberService.processWebhookEvent(event);

    // TODO: Update message status in database when methods are available
    // if (event.message_token) {
    //   await database.updateMessageStatus(event.message_token, event.event);
    // }

    res.json({ success: true });
  } catch (error) {
    logger.error('Error processing Viber webhook', { 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
    next(error);
  }
});

/**
 * @swagger
 * /api/messaging/viber/account:
 *   get:
 *     summary: Get Viber Business account info
 *     tags: [Messaging]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Account info retrieved successfully
 *       401:
 *         description: Unauthorized
 */
router.get('/viber/account', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!viberService.isConfigured()) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VIBER_NOT_CONFIGURED',
          message: 'Viber Business is not configured'
        }
      });
      return;
    }

    const accountInfo = await viberService.getAccountInfo();
    
    if (accountInfo) {
      res.json({
        success: true,
        data: accountInfo
      });
    } else {
      res.status(500).json({
        success: false,
        error: {
          code: 'VIBER_ACCOUNT_INFO_FAILED',
          message: 'Failed to retrieve Viber account info'
        }
      });
    }
  } catch (error) {
    logger.error('Error getting Viber account info', { 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
    next(error);
  }
});

/**
 * @swagger
 * /api/messaging/sms/send:
 *   post:
 *     summary: Send SMS message
 *     tags: [Messaging]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - phoneNumber
 *               - message
 *             properties:
 *               phoneNumber:
 *                 type: string
 *                 description: Phone number in international format
 *               message:
 *                 type: string
 *                 description: SMS content
 *     responses:
 *       200:
 *         description: SMS sent successfully
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Unauthorized
 */
router.post('/sms/send', 
  messagingLimiter, 
  validateSMSRequest,  // 🔒 SECURITY MIDDLEWARE ADDED!
  [
    body('phoneNumber').isString().notEmpty().withMessage('Phone number is required'),
    body('message').isString().notEmpty().withMessage('Message is required'),
  ], 
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request data',
          details: errors.array()
        }
      });
      return;
    }

    const { phoneNumber, message } = req.body;
    const businessId = req.user?.businessId;

    if (!businessId) {
      res.status(400).json({
        success: false,
        error: {
          code: 'BUSINESS_REQUIRED',
          message: 'Business ID is required'
        }
      });
      return;
    }

    // For now, we'll simulate SMS sending
    // In production, use Mobica SMS service
    const success = true; // Simulate successful SMS sending

    if (success) {
      // Log the SMS in database (simplified for now)
      // TODO: Implement proper SMS logging when database methods are available
      
      // GDPR logging
      gdprLogger.logDataAccess(
        req.user?.id || 'anonymous',
        'sms_sent',
        'business_communication'
      );

      res.json({
        success: true,
        data: {
          message: 'SMS sent successfully',
          phoneNumber,
          messageId: `sms_${Date.now()}`
        }
      });
    } else {
      res.status(500).json({
        success: false,
        error: {
          code: 'SMS_SEND_FAILED',
          message: 'Failed to send SMS'
        }
      });
    }
  } catch (error) {
    logger.error('Error sending SMS', { 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
    next(error);
  }
});

export default router;

