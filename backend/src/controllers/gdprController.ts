// GDPR Controller
// Handles all GDPR-related requests including data rights, privacy notices, and compliance

import { Router, Request, Response, NextFunction } from 'express';
import { body, query, validationResult } from 'express-validator';
import rateLimit from 'express-rate-limit';

import { GDPRService } from '../services/GDPRService';
import config from '../utils/config';
import logger, { gdprLogger } from '../utils/logger';
import {
  ServiceTextProError,
  GDPRComplianceError,
  APIResponse,
  ConsentType,
  DataProcessingBasis
} from '../types';

const router = Router();
const gdprService = new GDPRService();

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
          name: 'ServiceText Pro',
          address: 'Sofia, Bulgaria',
          email: config.gdpr.dpo.email,
          phone: config.gdpr.dpo.phone
        },
        dataController: {
          name: 'ServiceText Pro Ltd.',
          contact: config.gdpr.dpo.email,
          dpoContact: config.gdpr.dpo
        },
        dataProcessing: {
          purposes: [
            'Providing business communication services',
            'AI-powered conversation analysis',
            'Business analytics and reporting',
            'Customer support and service improvement',
            'Legal compliance and audit trails'
          ],
          legalBases: [
            'Legitimate interest for service provision',
            'Consent for marketing and analytics',
            'Contract performance for paid services',
            'Legal obligation for tax and business records'
          ],
          dataCategories: {
            workers: [
              'Personal data (name, email, phone)',
              'Business information (ЕИК, ДДС, certifications)',
              'Usage data and app interactions',
              'Communication data with customers'
            ],
            customers: [
              'Contact information (phone number, name if provided)',
              'Communication content and history',
              'Service interaction patterns',
              'Technical data (IP address, device info)'
            ]
          }
        },
        dataRetention: {
          conversationData: `${config.gdpr.dataRetention.conversationMonths} months`,
          businessData: `${config.gdpr.dataRetention.businessDataMonths} months`,
          analyticsData: `${config.gdpr.dataRetention.analyticsMonths} months`,
          auditLogs: `${config.gdpr.dataRetention.auditLogMonths} months`,
          automaticDeletion: config.gdpr.compliance.autoDeleteExpiredData
        },
        userRights: {
          access: 'Request a copy of your personal data',
          rectification: 'Correct inaccurate personal data',
          erasure: 'Request deletion of your personal data',
          restriction: 'Limit how we process your data',
          portability: 'Receive your data in a machine-readable format',
          objection: 'Object to certain types of processing',
          withdrawConsent: 'Withdraw previously given consent'
        },
        thirdPartySharing: [
          'WhatsApp/Meta - for message delivery (with DPA)',
          'Viber/Rakuten - for message delivery (with DPA)',
          'Telegram - for message delivery (with DPA)',
          'Cloud providers - for data hosting (with DPA)',
          'Analytics providers - anonymized data only'
        ],
        internationalTransfers: {
          adequacyDecisions: ['Countries with EU adequacy decisions'],
          safeguards: ['Standard Contractual Clauses', 'Binding Corporate Rules'],
          yourRights: 'You can request information about transfers affecting your data'
        },
        cookies: {
          essential: 'Required for app functionality',
          analytics: 'Optional - used for service improvement',
          marketing: 'Optional - used for targeted content'
        },
        contact: {
          dpo: config.gdpr.dpo,
          complaints: 'Commission for Personal Data Protection (Bulgaria)',
          responseTime: '72 hours maximum'
        },
        updates: {
          lastUpdated: new Date().toISOString(),
          notificationMethod: 'Email and in-app notification',
          previousVersions: 'Available upon request'
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
  // TODO: Add authentication middleware
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
  validateDataExportRequest,
  handleValidationErrors,
  // TODO: Add authentication middleware
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
  validateDataErasureRequest,
  handleValidationErrors,
  // TODO: Add authentication middleware
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
  validateDataRectificationRequest,
  handleValidationErrors,
  // TODO: Add authentication middleware
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
  // TODO: Add authentication middleware
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
 * POST /api/v1/gdpr/update-consents
 * Update consent preferences
 */
router.post('/update-consents',
  gdprLimiter,
  body('consents').isArray({ min: 1 }).withMessage('Consents array is required'),
  body('consents.*.consentType').isIn(Object.values(ConsentType)).withMessage('Invalid consent type'),
  body('consents.*.granted').isBoolean().withMessage('Consent granted must be boolean'),
  handleValidationErrors,
  // TODO: Add authentication middleware
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new ServiceTextProError('Authentication required', 'AUTHENTICATION_REQUIRED', 401);
      }

      const { consents } = req.body;

      await gdprService.updateUserConsents({
        userId,
        consents,
        requestedBy: userId,
        ipAddress: req.ip
      });

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
  // TODO: Add authentication middleware
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new ServiceTextProError('Authentication required', 'AUTHENTICATION_REQUIRED', 401);
      }

      // Check user's GDPR compliance status
      const user = req.user;
      if (!user) {
        throw new ServiceTextProError('User data not found', 'USER_NOT_FOUND', 404);
      }
      
      const now = new Date();
      const isDataRetentionValid = user.dataRetentionUntil > now;
      const hasEssentialConsent = user.gdprConsents.some(
        (c: any) => c.consentType === ConsentType.ESSENTIAL_SERVICE && c.granted && !c.withdrawnAt
      );

      const response: APIResponse = {
        success: true,
        data: {
          complianceStatus: user.isGdprCompliant && isDataRetentionValid && hasEssentialConsent 
            ? 'COMPLIANT' 
            : 'REQUIRES_ATTENTION',
          checks: {
            gdprConsentsValid: hasEssentialConsent,
            dataRetentionValid: isDataRetentionValid,
            privacyNoticeAcknowledged: true, // Assumed if user is registered
            dataProcessingTransparent: true
          },
          dataRetention: {
            validUntil: user.dataRetentionUntil,
            daysRemaining: Math.ceil((user.dataRetentionUntil.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
          },
          consents: user.gdprConsents.map((consent: any) => ({
            type: consent.consentType,
            granted: consent.granted,
            grantedAt: consent.timestamp,
            withdrawnAt: consent.withdrawnAt,
            legalBasis: consent.legalBasis
          })),
          recommendations: [
            ...(isDataRetentionValid ? [] : ['Contact support to extend data retention']),
            ...(hasEssentialConsent ? [] : ['Essential service consent is required']),
            'Review your privacy settings regularly',
            'Keep your contact information up to date'
          ]
        },
        metadata: {
          timestamp: new Date(),
          requestId: (req as any).requestId,
          version: config.app.version
        },
        gdpr: {
          dataProcessingBasis: DataProcessingBasis.LEGITIMATE_INTEREST,
          retentionPeriod: 'Compliance status logs kept for 7 years',
          rightsInformation: 'This helps ensure your GDPR rights are protected'
        }
      };

      res.json(response);

    } catch (error) {
      next(error);
    }
  }
);

export default router;
