"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const GDPRService_1 = require("../services/GDPRService");
const config_1 = __importDefault(require("../utils/config"));
const types_1 = require("../types");
const router = (0, express_1.Router)();
const gdprService = new GDPRService_1.GDPRService();
const gdprLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 60 * 1000,
    max: 10,
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
const exportLimiter = (0, express_rate_limit_1.default)({
    windowMs: 24 * 60 * 60 * 1000,
    max: 3,
    message: {
        success: false,
        error: {
            code: 'EXPORT_RATE_LIMIT_EXCEEDED',
            message: 'Maximum daily data exports exceeded. Contact DPO for assistance.'
        }
    }
});
const validateDataExportRequest = [
    (0, express_validator_1.body)('format')
        .isIn(['json', 'pdf', 'csv'])
        .withMessage('Export format must be json, pdf, or csv'),
    (0, express_validator_1.body)('includeConversations')
        .isBoolean()
        .withMessage('includeConversations must be boolean'),
    (0, express_validator_1.body)('includeAnalytics')
        .isBoolean()
        .withMessage('includeAnalytics must be boolean')
];
const validateDataErasureRequest = [
    (0, express_validator_1.body)('reason')
        .isLength({ min: 10, max: 500 })
        .withMessage('Reason must be between 10 and 500 characters'),
    (0, express_validator_1.body)('confirmEmail')
        .isEmail()
        .withMessage('Email confirmation is required'),
    (0, express_validator_1.body)('retainForLegalReasons')
        .optional()
        .isBoolean()
        .withMessage('retainForLegalReasons must be boolean')
];
const validateDataRectificationRequest = [
    (0, express_validator_1.body)('dataType')
        .isIn(['user_profile', 'business_info', 'contact_info'])
        .withMessage('Invalid data type for rectification'),
    (0, express_validator_1.body)('corrections')
        .isObject()
        .withMessage('Corrections must be an object'),
    (0, express_validator_1.body)('reason')
        .isLength({ min: 5, max: 200 })
        .withMessage('Reason must be between 5 and 200 characters')
];
const handleValidationErrors = (req, res, next) => {
    const errors = (0, express_validator_1.validationResult)(req);
    if (!errors.isEmpty()) {
        const response = {
            success: false,
            error: {
                code: 'VALIDATION_ERROR',
                message: 'Invalid input data',
                details: errors.array()
            },
            gdpr: {
                dataProcessingBasis: types_1.DataProcessingBasis.LEGITIMATE_INTEREST,
                retentionPeriod: '24 hours for request processing',
                rightsInformation: config_1.default.gdpr.urls.privacyPolicy
            }
        };
        return res.status(400).json(response);
    }
    return next();
};
router.get('/privacy-notice', async (req, res, next) => {
    try {
        const response = {
            success: true,
            data: {
                companyInfo: {
                    name: 'ServiceText Pro',
                    address: 'Sofia, Bulgaria',
                    email: config_1.default.gdpr.dpo.email,
                    phone: config_1.default.gdpr.dpo.phone
                },
                dataController: {
                    name: 'ServiceText Pro Ltd.',
                    contact: config_1.default.gdpr.dpo.email,
                    dpoContact: config_1.default.gdpr.dpo
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
                    conversationData: `${config_1.default.gdpr.dataRetention.conversationMonths} months`,
                    businessData: `${config_1.default.gdpr.dataRetention.businessDataMonths} months`,
                    analyticsData: `${config_1.default.gdpr.dataRetention.analyticsMonths} months`,
                    auditLogs: `${config_1.default.gdpr.dataRetention.auditLogMonths} months`,
                    automaticDeletion: config_1.default.gdpr.compliance.autoDeleteExpiredData
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
                    dpo: config_1.default.gdpr.dpo,
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
                requestId: req.requestId,
                version: config_1.default.app.version
            },
            gdpr: {
                dataProcessingBasis: types_1.DataProcessingBasis.LEGAL_OBLIGATION,
                retentionPeriod: 'Indefinite (legal requirement)',
                rightsInformation: 'This notice fulfills GDPR Articles 13-14 requirements'
            }
        };
        res.json(response);
    }
    catch (error) {
        next(error);
    }
});
router.get('/my-data', gdprLimiter, async (req, res, next) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            throw new types_1.ServiceTextProError('Authentication required', 'AUTHENTICATION_REQUIRED', 401);
        }
        const userData = await gdprService.handleDataAccessRequest(userId, userId, req.ip);
        const response = {
            success: true,
            data: userData,
            metadata: {
                timestamp: new Date(),
                requestId: req.requestId,
                version: config_1.default.app.version
            },
            gdpr: {
                dataProcessingBasis: types_1.DataProcessingBasis.LEGITIMATE_INTEREST,
                retentionPeriod: 'Data access logs kept for 7 years',
                rightsInformation: 'This fulfills your right of access under GDPR Article 15'
            }
        };
        res.json(response);
    }
    catch (error) {
        next(error);
    }
});
router.post('/export-data', exportLimiter, gdprLimiter, validateDataExportRequest, handleValidationErrors, async (req, res, next) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            throw new types_1.ServiceTextProError('Authentication required', 'AUTHENTICATION_REQUIRED', 401);
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
        const response = {
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
                requestId: req.requestId,
                version: config_1.default.app.version
            },
            gdpr: {
                dataProcessingBasis: types_1.DataProcessingBasis.LEGITIMATE_INTEREST,
                retentionPeriod: 'Export files deleted after 7 days',
                rightsInformation: 'This fulfills your right to data portability under GDPR Article 20'
            }
        };
        res.json(response);
    }
    catch (error) {
        next(error);
    }
});
router.post('/delete-my-data', gdprLimiter, validateDataErasureRequest, handleValidationErrors, async (req, res, next) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            throw new types_1.ServiceTextProError('Authentication required', 'AUTHENTICATION_REQUIRED', 401);
        }
        const { reason, confirmEmail, retainForLegalReasons } = req.body;
        if (!req.user || confirmEmail.toLowerCase() !== req.user.email.toLowerCase()) {
            throw new types_1.ServiceTextProError('Email confirmation does not match', 'EMAIL_MISMATCH', 400);
        }
        await gdprService.handleDataErasureRequest({
            userId,
            reason,
            requestedBy: userId,
            ipAddress: req.ip,
            retainForLegalReasons
        });
        const response = {
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
                requestId: req.requestId,
                version: config_1.default.app.version
            },
            gdpr: {
                dataProcessingBasis: types_1.DataProcessingBasis.LEGITIMATE_INTEREST,
                retentionPeriod: 'Deletion request logs kept for 7 years',
                rightsInformation: 'This fulfills your right to erasure under GDPR Article 17'
            }
        };
        res.json(response);
    }
    catch (error) {
        next(error);
    }
});
router.post('/correct-my-data', gdprLimiter, validateDataRectificationRequest, handleValidationErrors, async (req, res, next) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            throw new types_1.ServiceTextProError('Authentication required', 'AUTHENTICATION_REQUIRED', 401);
        }
        const { dataType, corrections, reason } = req.body;
        await gdprService.handleDataRectificationRequest({
            userId,
            dataType,
            corrections,
            requestedBy: userId,
            ipAddress: req.ip
        });
        const response = {
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
                requestId: req.requestId,
                version: config_1.default.app.version
            },
            gdpr: {
                dataProcessingBasis: types_1.DataProcessingBasis.LEGITIMATE_INTEREST,
                retentionPeriod: 'Rectification logs kept for 7 years',
                rightsInformation: 'This fulfills your right to rectification under GDPR Article 16'
            }
        };
        res.json(response);
    }
    catch (error) {
        next(error);
    }
});
router.get('/data-processing-info', gdprLimiter, async (req, res, next) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            throw new types_1.ServiceTextProError('Authentication required', 'AUTHENTICATION_REQUIRED', 401);
        }
        const processingRecords = await gdprService.getDataProcessingInformation(userId);
        const response = {
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
                contact: config_1.default.gdpr.dpo
            },
            metadata: {
                timestamp: new Date(),
                requestId: req.requestId,
                version: config_1.default.app.version
            },
            gdpr: {
                dataProcessingBasis: types_1.DataProcessingBasis.LEGITIMATE_INTEREST,
                retentionPeriod: 'Information access logs kept for 7 years',
                rightsInformation: 'This information is provided under GDPR Article 30'
            }
        };
        res.json(response);
    }
    catch (error) {
        next(error);
    }
});
router.post('/update-consents', gdprLimiter, (0, express_validator_1.body)('consents').isArray({ min: 1 }).withMessage('Consents array is required'), (0, express_validator_1.body)('consents.*.consentType').isIn(Object.values(types_1.ConsentType)).withMessage('Invalid consent type'), (0, express_validator_1.body)('consents.*.granted').isBoolean().withMessage('Consent granted must be boolean'), handleValidationErrors, async (req, res, next) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            throw new types_1.ServiceTextProError('Authentication required', 'AUTHENTICATION_REQUIRED', 401);
        }
        const { consents } = req.body;
        await gdprService.updateUserConsents({
            userId,
            consents,
            requestedBy: userId,
            ipAddress: req.ip
        });
        const response = {
            success: true,
            data: {
                message: 'Consent preferences updated successfully',
                updatedConsents: consents.map((c) => ({
                    type: c.consentType,
                    granted: c.granted,
                    updatedAt: new Date().toISOString()
                })),
                effectiveDate: 'Changes are effective immediately'
            },
            metadata: {
                timestamp: new Date(),
                requestId: req.requestId,
                version: config_1.default.app.version
            },
            gdpr: {
                dataProcessingBasis: types_1.DataProcessingBasis.CONSENT,
                retentionPeriod: 'Until consent is withdrawn',
                rightsInformation: 'You can withdraw consent at any time'
            }
        };
        res.json(response);
    }
    catch (error) {
        next(error);
    }
});
router.get('/compliance-status', async (req, res, next) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            throw new types_1.ServiceTextProError('Authentication required', 'AUTHENTICATION_REQUIRED', 401);
        }
        const user = req.user;
        if (!user) {
            throw new types_1.ServiceTextProError('User data not found', 'USER_NOT_FOUND', 404);
        }
        const now = new Date();
        const isDataRetentionValid = user.dataRetentionUntil > now;
        const hasEssentialConsent = user.gdprConsents.some((c) => c.consentType === types_1.ConsentType.ESSENTIAL_SERVICE && c.granted && !c.withdrawnAt);
        const response = {
            success: true,
            data: {
                complianceStatus: user.isGdprCompliant && isDataRetentionValid && hasEssentialConsent
                    ? 'COMPLIANT'
                    : 'REQUIRES_ATTENTION',
                checks: {
                    gdprConsentsValid: hasEssentialConsent,
                    dataRetentionValid: isDataRetentionValid,
                    privacyNoticeAcknowledged: true,
                    dataProcessingTransparent: true
                },
                dataRetention: {
                    validUntil: user.dataRetentionUntil,
                    daysRemaining: Math.ceil((user.dataRetentionUntil.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
                },
                consents: user.gdprConsents.map((consent) => ({
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
                requestId: req.requestId,
                version: config_1.default.app.version
            },
            gdpr: {
                dataProcessingBasis: types_1.DataProcessingBasis.LEGITIMATE_INTEREST,
                retentionPeriod: 'Compliance status logs kept for 7 years',
                rightsInformation: 'This helps ensure your GDPR rights are protected'
            }
        };
        res.json(response);
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=gdprController.js.map