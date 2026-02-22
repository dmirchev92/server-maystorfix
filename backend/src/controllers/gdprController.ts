// GDPR Controller
// Handles all GDPR-related requests including data rights, privacy notices, and compliance

import { Router, Request, Response, NextFunction } from 'express';
import { body, query, validationResult } from 'express-validator';
import rateLimit from 'express-rate-limit';

import { GDPRService } from '../services/GDPRService';
import { DatabaseFactory } from '../models/DatabaseFactory';
import { authenticateToken } from '../middleware/auth';
import config from '../utils/config';
import logger, { gdprLogger } from '../utils/logger';
import { normalizeConsentType } from '../utils/consentHelpers';
import {
  ServiceTextProError,
  GDPRComplianceError,
  APIResponse,
  ConsentType,
  DataProcessingBasis
} from '../types';

const router = Router();
const gdprService = GDPRService.getInstance();

// Rate limiting for GDPR requests (more generous as these are user rights)
const gdprLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 requests per hour per IP
  message: {
    success: false,
    error: {
      code: 'GDPR_RATE_LIMIT_EXCEEDED',
      message: 'Too many GDPR requests. Please contact our DPO if you need immediate assistance.'
    }
  },
  standardHeaders: true,
  legacyHeaders: false
});

// More restrictive rate limiting for data export (resource intensive)
const exportLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: 3, // 3 exports per day
  message: {
    success: false,
    error: {
      code: 'EXPORT_RATE_LIMIT_EXCEEDED',
      message: 'Maximum daily data exports exceeded. Contact DPO for assistance.'
    }
  }
});

/**
 * Validation middleware
 */
const validateDataExportRequest = [
  body('format')
    .isIn(['json', 'pdf', 'csv'])
    .withMessage('Export format must be json, pdf, or csv'),
  
  body('includeConversations')
    .isBoolean()
    .withMessage('includeConversations must be boolean'),
  
  body('includeAnalytics')
    .isBoolean()
    .withMessage('includeAnalytics must be boolean')
];

const validateDataErasureRequest = [
  body('reason')
    .isLength({ min: 10, max: 500 })
    .withMessage('Reason must be between 10 and 500 characters'),
  
  body('confirmEmail')
    .isEmail()
    .withMessage('Email confirmation is required'),
  
  body('retainForLegalReasons')
    .optional()
    .isBoolean()
    .withMessage('retainForLegalReasons must be boolean')
];

const validateDataRectificationRequest = [
  body('dataType')
    .isIn(['user_profile', 'business_info', 'contact_info'])
    .withMessage('Invalid data type for rectification'),
  
  body('corrections')
    .isObject()
    .withMessage('Corrections must be an object'),
  
  body('reason')
    .isLength({ min: 5, max: 200 })
    .withMessage('Reason must be between 5 and 200 characters')
];

/**
 * Middleware to handle validation errors
 */
const handleValidationErrors = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const response: APIResponse = {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid input data',
        details: errors.array()
      },
      gdpr: {
        dataProcessingBasis: DataProcessingBasis.LEGITIMATE_INTEREST,
        retentionPeriod: '24 hours for request processing',
        rightsInformation: config.gdpr.urls.privacyPolicy
      }
    };
    
    return res.status(400).json(response);
  }
  return next();
};

/**
 * GET /api/v1/gdpr/privacy-notice
 * Get comprehensive privacy notice (public endpoint)
 */
router.get('/privacy-notice', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const response: APIResponse = {
      success: true,
      data: {
        companyInfo: {
          name: 'SnapFix',
          address: 'София, България',
          email: config.gdpr.dpo.email,
          phone: config.gdpr.dpo.phone
        },
        dataController: {
          name: 'SnapFix',
          contact: config.gdpr.dpo.email,
          dpoContact: config.gdpr.dpo
        },
        dataProcessing: {
          purposes: [
            'Предоставяне на платформа за свързване на майстори и клиенти',
            'Изпращане на SMS известия при пропуснати обаждания',
            'Чат комуникация между майстори и клиенти',
            'Бизнес аналитика и статистики за майсторите',
            'Push известия за нови заявки и съобщения',
            'Система за случаи (cases) и наддаване (bidding)',
            'Реферална програма и точкова система',
            'Спазване на правни изисквания и одитни записи'
          ],
          legalBases: [
            'Легитимен интерес за предоставяне на услугата',
            'Съгласие за съхранение на съобщения и маркетинг',
            'Изпълнение на договор за платени услуги',
            'Правно задължение за данъчни и бизнес записи'
          ],
          dataCategories: {
            serviceProviders: [
              'Лични данни (име, имейл, телефон)',
              'Бизнес информация (ЕИК, ДДС, категории услуги, сертификати)',
              'Профилна информация (снимки, описание, град)',
              'Данни за обаждания и SMS съобщения',
              'Чат комуникация с клиенти',
              'Статистики и аналитика за приходи',
              'Точки, абонамент и реферална активност'
            ],
            customers: [
              'Контактна информация (телефонен номер, име)',
              'Съдържание на чат съобщения',
              'Данни за заявки (случаи)',
              'Технически данни (IP адрес, тип устройство)'
            ]
          }
        },
        dataRetention: {
          conversationData: `${config.gdpr.dataRetention.conversationMonths} месеца`,
          businessData: `${config.gdpr.dataRetention.businessDataMonths} месеца`,
          analyticsData: `${config.gdpr.dataRetention.analyticsMonths} месеца`,
          auditLogs: `${config.gdpr.dataRetention.auditLogMonths} месеца`,
          billingData: '84 месеца (7 години - законово изискване)',
          automaticDeletion: config.gdpr.compliance.autoDeleteExpiredData
        },
        userRights: {
          access: 'Заявка за копие на вашите лични данни (чл. 15)',
          rectification: 'Корекция на неточни лични данни (чл. 16)',
          erasure: 'Заявка за изтриване на данните ви (чл. 17)',
          restriction: 'Ограничаване на обработката на данни (чл. 18)',
          portability: 'Получаване на данните в машиночетим формат (чл. 20)',
          objection: 'Възражение срещу определени видове обработка (чл. 21)',
          withdrawConsent: 'Оттегляне на дадено съгласие по всяко време'
        },
        thirdPartySharing: [
          'Mobica SMS API — за изпращане на SMS съобщения (с договор за обработка)',
          'Firebase/Google — за push известия (с договор за обработка)',
          'Облачен хостинг доставчик — за съхранение на данни в ЕС (с договор за обработка)'
        ],
        internationalTransfers: {
          dataLocation: 'Данните се съхраняват на сървъри в Европейския съюз',
          safeguards: ['Стандартни договорни клаузи (SCC)', 'Решения за адекватност на ЕК'],
          yourRights: 'Можете да поискате информация за трансфери, засягащи вашите данни'
        },
        contact: {
          dpo: config.gdpr.dpo,
          complaints: 'Комисия за защита на личните данни (КЗЛД), България — https://cpdp.bg/',
          responseTime: 'До 30 дни (максимум 72 часа за първоначален отговор)'
        },
        updates: {
          lastUpdated: '2026-02-10',
          notificationMethod: 'Имейл и известие в приложението',
          previousVersions: 'Достъпни при поискване'
        }
      },
      metadata: {
        timestamp: new Date(),
        requestId: (req as any).requestId,
        version: config.app.version
      },
      gdpr: {
        dataProcessingBasis: DataProcessingBasis.LEGAL_OBLIGATION,
        retentionPeriod: 'Indefinite (legal requirement)',
        rightsInformation: 'This notice fulfills GDPR Articles 13-14 requirements'
      }
    };

    res.json(response);

  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/gdpr/my-data
 * Request access to personal data (Article 15 - Right of Access)
 */
router.get('/my-data',
  gdprLimiter,
  authenticateToken,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new ServiceTextProError('Authentication required', 'AUTHENTICATION_REQUIRED', 401);
      }

      const userData = await gdprService.handleDataAccessRequest(
        userId,
        userId, // Self-request
        req.ip
      );

      const response: APIResponse = {
        success: true,
        data: userData,
        metadata: {
          timestamp: new Date(),
          requestId: (req as any).requestId,
          version: config.app.version
        },
        gdpr: {
          dataProcessingBasis: DataProcessingBasis.LEGITIMATE_INTEREST,
          retentionPeriod: 'Data access logs kept for 7 years',
          rightsInformation: 'This fulfills your right of access under GDPR Article 15'
        }
      };

      res.json(response);

    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/gdpr/export-data
 * Request data export (Article 20 - Right to Data Portability)
 */
router.post('/export-data',
  exportLimiter,
  gdprLimiter,
  authenticateToken,
  validateDataExportRequest,
  handleValidationErrors,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new ServiceTextProError('Authentication required', 'AUTHENTICATION_REQUIRED', 401);
      }

      const { format, includeConversations, includeAnalytics } = req.body;

      const exportUrl = await gdprService.handleDataExportRequest({
        userId,
        format,
        includeConversations,
        includeAnalytics,
        requestedBy: userId,
        ipAddress: req.ip
      });

      const response: APIResponse = {
        success: true,
        data: {
          message: 'Data export request processed successfully',
          exportUrl,
          format,
          expiresIn: '7 days',
          downloadInstructions: 'The export file will be available for download for 7 days'
        },
        metadata: {
          timestamp: new Date(),
          requestId: (req as any).requestId,
          version: config.app.version
        },
        gdpr: {
          dataProcessingBasis: DataProcessingBasis.LEGITIMATE_INTEREST,
          retentionPeriod: 'Export files deleted after 7 days',
          rightsInformation: 'This fulfills your right to data portability under GDPR Article 20'
        }
      };

      res.json(response);

    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/gdpr/delete-my-data
 * Request data deletion (Article 17 - Right to Erasure)
 */
router.post('/delete-my-data',
  gdprLimiter,
  authenticateToken,
  validateDataErasureRequest,
  handleValidationErrors,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new ServiceTextProError('Authentication required', 'AUTHENTICATION_REQUIRED', 401);
      }

      const { reason, confirmEmail, retainForLegalReasons } = req.body;

      // Verify email confirmation matches user email
      if (!req.user || confirmEmail.toLowerCase() !== req.user.email.toLowerCase()) {
        throw new ServiceTextProError('Email confirmation does not match', 'EMAIL_MISMATCH', 400);
      }

      await gdprService.handleDataErasureRequest({
        userId,
        reason,
        requestedBy: userId,
        ipAddress: req.ip,
        retainForLegalReasons
      });

      const response: APIResponse = {
        success: true,
        data: {
          message: 'Data deletion request processed successfully',
          processedAt: new Date().toISOString(),
          retainedData: retainForLegalReasons 
            ? 'Some data may be retained for legal compliance purposes'
            : 'All personal data has been scheduled for deletion',
          effectiveDate: 'Deletion will be completed within 30 days',
          contact: 'Contact our DPO if you have questions about this process'
        },
        metadata: {
          timestamp: new Date(),
          requestId: (req as any).requestId,
          version: config.app.version
        },
        gdpr: {
          dataProcessingBasis: DataProcessingBasis.LEGITIMATE_INTEREST,
          retentionPeriod: 'Deletion request logs kept for 7 years',
          rightsInformation: 'This fulfills your right to erasure under GDPR Article 17'
        }
      };

      res.json(response);

    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/gdpr/correct-my-data
 * Request data correction (Article 16 - Right to Rectification)
 */
router.post('/correct-my-data',
  gdprLimiter,
  authenticateToken,
  validateDataRectificationRequest,
  handleValidationErrors,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new ServiceTextProError('Authentication required', 'AUTHENTICATION_REQUIRED', 401);
      }

      const { dataType, corrections, reason } = req.body;

      await gdprService.handleDataRectificationRequest({
        userId,
        dataType,
        corrections,
        requestedBy: userId,
        ipAddress: req.ip
      });

      const response: APIResponse = {
        success: true,
        data: {
          message: 'Data correction request processed successfully',
          correctedFields: Object.keys(corrections),
          reason,
          processedAt: new Date().toISOString(),
          effectiveDate: 'Changes are effective immediately'
        },
        metadata: {
          timestamp: new Date(),
          requestId: (req as any).requestId,
          version: config.app.version
        },
        gdpr: {
          dataProcessingBasis: DataProcessingBasis.LEGITIMATE_INTEREST,
          retentionPeriod: 'Rectification logs kept for 7 years',
          rightsInformation: 'This fulfills your right to rectification under GDPR Article 16'
        }
      };

      res.json(response);

    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/gdpr/data-processing-info
 * Get information about data processing activities
 */
router.get('/data-processing-info',
  gdprLimiter,
  authenticateToken,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new ServiceTextProError('Authentication required', 'AUTHENTICATION_REQUIRED', 401);
      }

      const processingRecords = await gdprService.getDataProcessingInformation(userId);

      const response: APIResponse = {
        success: true,
        data: {
          processingActivities: processingRecords,
          summary: {
            totalActivities: processingRecords.length,
            dataTypes: [...new Set(processingRecords.map(r => r.dataType))],
            legalBases: [...new Set(processingRecords.map(r => r.legalBasis))],
            thirdPartyProcessors: [...new Set(processingRecords.flatMap(r => r.thirdPartyProcessors))]
          },
          yourRights: {
            access: 'You can request copies of your data at any time',
            rectification: 'You can request corrections to inaccurate data',
            erasure: 'You can request deletion of your data',
            restriction: 'You can request processing limitations',
            portability: 'You can request data in machine-readable format',
            objection: 'You can object to certain processing activities'
          },
          contact: config.gdpr.dpo
        },
        metadata: {
          timestamp: new Date(),
          requestId: (req as any).requestId,
          version: config.app.version
        },
        gdpr: {
          dataProcessingBasis: DataProcessingBasis.LEGITIMATE_INTEREST,
          retentionPeriod: 'Information access logs kept for 7 years',
          rightsInformation: 'This information is provided under GDPR Article 30'
        }
      };

      res.json(response);

    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/gdpr/my-consents
 * Get current user's consent preferences
 */
router.get('/my-consents',
  authenticateToken,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new ServiceTextProError('Authentication required', 'AUTHENTICATION_REQUIRED', 401);
      }

      const db = DatabaseFactory.getDatabase();
      const pool = (db as any).getPool();
      
      // Get user's current consents from database
      const consents = await (db as any).query(
        `SELECT consent_type, granted, timestamp, withdrawn_at, legal_basis 
         FROM gdpr_consents 
         WHERE user_id = $1 
         ORDER BY timestamp DESC`,
        [userId]
      );

      // Group by consent_type to get latest for each type
      const latestConsents: Record<string, any> = {};
      for (const consent of consents) {
        if (!latestConsents[consent.consent_type]) {
          latestConsents[consent.consent_type] = {
            consentType: consent.consent_type,
            granted: consent.granted && !consent.withdrawn_at,
            grantedAt: consent.timestamp,
            withdrawnAt: consent.withdrawn_at,
            legalBasis: consent.legal_basis
          };
        }
      }

      const response: APIResponse = {
        success: true,
        data: {
          consents: Object.values(latestConsents),
          availableTypes: Object.values(ConsentType)
        },
        metadata: {
          timestamp: new Date(),
          requestId: (req as any).requestId,
          version: config.app.version
        },
        gdpr: {
          dataProcessingBasis: DataProcessingBasis.CONSENT,
          retentionPeriod: 'Until consent is withdrawn',
          rightsInformation: 'You can update your consent preferences at any time'
        }
      };

      res.json(response);

    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/gdpr/update-consents
 * Update consent preferences - saves to database
 */
router.post('/update-consents',
  authenticateToken,
  gdprLimiter,
  body('consents').isArray({ min: 1 }).withMessage('Consents array is required'),
  body('consents.*.consentType').isString().withMessage('Consent type is required'),
  body('consents.*.granted').isBoolean().withMessage('Consent granted must be boolean'),
  handleValidationErrors,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new ServiceTextProError('Authentication required', 'AUTHENTICATION_REQUIRED', 401);
      }

      const { consents } = req.body;
      const db = DatabaseFactory.getDatabase();
      const pool = (db as any).getPool();
      const now = new Date().toISOString();

      // ✅ Normalize consent types (mobile → backend) before saving
      const normalizedConsents = consents.map((consent: any) => ({
        ...consent,
        consentType: normalizeConsentType(consent.consentType)
      }));

      logger.info('📝 Updating consents', {
        userId,
        consentsCount: normalizedConsents.length,
        types: normalizedConsents.map((c: any) => c.consentType)
      });

      // Save each consent to database
      for (const consent of normalizedConsents) {
        const consentId = `consent_${userId}_${consent.consentType}_${Date.now()}`;

        // If withdrawing consent, update existing record
        if (!consent.granted) {
          await (db as any).query(
            `UPDATE gdpr_consents
             SET withdrawn_at = $1
             WHERE user_id = $2 AND consent_type = $3 AND withdrawn_at IS NULL`,
            [now, userId, consent.consentType]
          );
        }

        // Insert new consent record
        await (db as any).query(
          `INSERT INTO gdpr_consents (id, user_id, consent_type, granted, timestamp, ip_address, legal_basis)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [consentId, userId, consent.consentType, consent.granted, now, req.ip || 'unknown', consent.legalBasis || 'consent']
        );
      }

      // ✅ Clear consent cache for user after updates
      gdprService.clearConsentCache(userId);

      const response: APIResponse = {
        success: true,
        data: {
          message: 'Consent preferences updated successfully',
          updatedConsents: consents.map((c: any) => ({
            type: c.consentType,
            granted: c.granted,
            updatedAt: new Date().toISOString()
          })),
          effectiveDate: 'Changes are effective immediately'
        },
        metadata: {
          timestamp: new Date(),
          requestId: (req as any).requestId,
          version: config.app.version
        },
        gdpr: {
          dataProcessingBasis: DataProcessingBasis.CONSENT,
          retentionPeriod: 'Until consent is withdrawn',
          rightsInformation: 'You can withdraw consent at any time'
        }
      };

      res.json(response);

    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/gdpr/compliance-status
 * Get GDPR compliance status for the user
 */
router.get('/compliance-status',
  authenticateToken,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new ServiceTextProError('Authentication required', 'AUTHENTICATION_REQUIRED', 401);
      }

      const db = DatabaseFactory.getDatabase();
      const pool = (db as any).getPool();

      // Fetch user data from DB
      const userResult = await pool.query(
        'SELECT id, data_retention_until FROM users WHERE id = $1',
        [userId]
      );
      if (userResult.rows.length === 0) {
        throw new ServiceTextProError('User not found', 'USER_NOT_FOUND', 404);
      }

      const dataRetentionUntil = userResult.rows[0].data_retention_until 
        ? new Date(userResult.rows[0].data_retention_until) 
        : new Date(Date.now() + 7 * 365 * 24 * 60 * 60 * 1000);

      // Fetch consents from DB
      const consentsResult = await (db as any).query(
        `SELECT consent_type, granted, timestamp, withdrawn_at, legal_basis
         FROM gdpr_consents WHERE user_id = $1 ORDER BY timestamp DESC`,
        [userId]
      );

      // Get latest consent per type
      const latestConsents: Record<string, any> = {};
      for (const c of consentsResult) {
        if (!latestConsents[c.consent_type]) {
          latestConsents[c.consent_type] = c;
        }
      }
      const consentsList = Object.values(latestConsents);
      
      const now = new Date();
      const isDataRetentionValid = dataRetentionUntil > now;
      const hasEssentialConsent = consentsList.some(
        (c: any) => c.consent_type === ConsentType.ESSENTIAL_SERVICE && c.granted && !c.withdrawn_at
      );

      const response: APIResponse = {
        success: true,
        data: {
          complianceStatus: isDataRetentionValid && hasEssentialConsent 
            ? 'COMPLIANT' 
            : 'REQUIRES_ATTENTION',
          checks: {
            gdprConsentsValid: hasEssentialConsent,
            dataRetentionValid: isDataRetentionValid,
            privacyNoticeAcknowledged: true,
            dataProcessingTransparent: true
          },
          dataRetention: {
            validUntil: dataRetentionUntil,
            daysRemaining: Math.ceil((dataRetentionUntil.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
          },
          consents: consentsList.map((consent: any) => ({
            type: consent.consent_type,
            granted: consent.granted,
            grantedAt: consent.timestamp,
            withdrawnAt: consent.withdrawn_at,
            legalBasis: consent.legal_basis
          })),
          recommendations: [
            ...(isDataRetentionValid ? [] : ['Свържете се с нас за удължаване на периода за съхранение']),
            ...(hasEssentialConsent ? [] : ['Необходимо е съгласие за основни услуги']),
            'Преглеждайте настройките си за поверителност редовно',
            'Поддържайте контактната си информация актуална'
          ]
        },
        metadata: {
          timestamp: new Date(),
          requestId: (req as any).requestId,
          version: config.app.version
        },
        gdpr: {
          dataProcessingBasis: DataProcessingBasis.LEGITIMATE_INTEREST,
          retentionPeriod: 'Записите за съответствие се пазят 7 години',
          rightsInformation: 'Това помага да гарантираме вашите GDPR права'
        }
      };

      res.json(response);

    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/gdpr/extend-data-retention
 * Allows users to extend their data retention period
 * Called when user confirms they want to continue using the service
 */
router.post('/extend-data-retention',
  authenticateToken,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        throw new ServiceTextProError('Authentication required', 'AUTHENTICATION_REQUIRED', 401);
      }

      const db = DatabaseFactory.getDatabase();
      const pool = (db as any).getPool();

      // Extend data retention by 7 years from now
      const newRetentionDate = new Date();
      newRetentionDate.setFullYear(newRetentionDate.getFullYear() + 7);

      await pool.query(
        'UPDATE users SET data_retention_until = $1, updated_at = NOW() WHERE id = $2',
        [newRetentionDate, userId]
      );

      // Log the extension
      gdprLogger.logConsentChange(userId, 'DATA_RETENTION_EXTENDED', true, req.ip || 'unknown');

      const response: APIResponse = {
        success: true,
        data: {
          message: 'Периодът за съхранение на данни е удължен успешно.',
          newRetentionDate: newRetentionDate,
          yearsExtended: 7
        },
        metadata: {
          timestamp: new Date(),
          requestId: (req as any).requestId,
          version: config.app.version
        }
      };

      res.json(response);

    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/gdpr/request-account-deletion
 * Public endpoint for account deletion requests (Google Play compliance)
 * No authentication required - users can request deletion even if locked out
 */
router.post('/request-account-deletion',
  rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5, // 5 requests per hour per IP
    message: {
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Твърде много заявки. Моля, опитайте отново по-късно.'
      }
    }
  }),
  body('email').isEmail().withMessage('Невалиден имейл адрес'),
  body('reason').optional().isLength({ max: 1000 }).withMessage('Причината не може да надвишава 1000 символа'),
  handleValidationErrors,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, reason } = req.body;
      const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';

      // Check if user exists
      const db = DatabaseFactory.getDatabase();
      const pool = (db as any).getPool();
      const userResult = await pool.query(
        'SELECT id, email, first_name, last_name FROM users WHERE LOWER(email) = LOWER($1)',
        [email]
      );

      let userId = null;
      if (userResult.rows.length > 0) {
        userId = userResult.rows[0].id;
      }

      // Check for existing pending request
      const existingRequest = await pool.query(
        `SELECT id, status, requested_at FROM account_deletion_requests 
         WHERE LOWER(email) = LOWER($1) AND status = 'pending'
         ORDER BY requested_at DESC LIMIT 1`,
        [email]
      );

      if (existingRequest.rows.length > 0) {
        const response: APIResponse = {
          success: true,
          data: {
            message: 'Вече имате активна заявка за изтриване на акаунт.',
            requestId: existingRequest.rows[0].id,
            status: 'pending',
            requestedAt: existingRequest.rows[0].requested_at,
            estimatedProcessingTime: '30 дни'
          }
        };
        return res.json(response);
      }

      // Create new deletion request
      const requestId = `del_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      await pool.query(
        `INSERT INTO account_deletion_requests (id, user_id, email, reason, status, requested_at)
         VALUES ($1, $2, $3, $4, 'pending', NOW())`,
        [requestId, userId, email.toLowerCase(), reason || null]
      );

      // Log GDPR action
      gdprLogger.logPrivacyRightRequest(userId, 'ERASURE', 'submitted');

      const response: APIResponse = {
        success: true,
        data: {
          message: 'Заявката за изтриване на акаунт е получена успешно.',
          requestId,
          status: 'pending',
          estimatedProcessingTime: '30 дни',
          contact: 'За въпроси: admin@snapfix.bg',
          nextSteps: [
            'Ще получите имейл потвърждение на посочения адрес.',
            'Заявката ще бъде обработена в рамките на 30 дни.',
            'След изтриването всички ваши данни ще бъдат премахнати безвъзвратно.'
          ]
        },
        gdpr: {
          dataProcessingBasis: DataProcessingBasis.LEGITIMATE_INTEREST,
          retentionPeriod: 'Заявката се съхранява за 7 години за одит',
          rightsInformation: 'Това изпълнява правото ви на изтриване по чл. 17 от GDPR'
        }
      };

      res.json(response);

    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/gdpr/deletion-request-status
 * Check status of a deletion request (public endpoint)
 */
router.get('/deletion-request-status',
  query('email').isEmail().withMessage('Невалиден имейл адрес'),
  handleValidationErrors,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const email = req.query.email as string;

      const db = DatabaseFactory.getDatabase();
      const pool = (db as any).getPool();
      const result = await pool.query(
        `SELECT id, status, requested_at, processed_at, notes 
         FROM account_deletion_requests 
         WHERE LOWER(email) = LOWER($1)
         ORDER BY requested_at DESC LIMIT 1`,
        [email]
      );

      if (result.rows.length === 0) {
        const response: APIResponse = {
          success: true,
          data: {
            found: false,
            message: 'Не е намерена заявка за изтриване с този имейл адрес.'
          }
        };
        return res.json(response);
      }

      const request = result.rows[0];
      const response: APIResponse = {
        success: true,
        data: {
          found: true,
          requestId: request.id,
          status: request.status,
          statusText: {
            pending: 'Изчаква обработка',
            processing: 'В процес на обработка',
            completed: 'Завършена',
            rejected: 'Отхвърлена'
          }[request.status] || request.status,
          requestedAt: request.requested_at,
          processedAt: request.processed_at,
          notes: request.notes
        }
      };

      res.json(response);

    } catch (error) {
      next(error);
    }
  }
);

export default router;
