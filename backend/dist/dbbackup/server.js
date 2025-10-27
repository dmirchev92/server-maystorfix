"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const config_1 = __importStar(require("../utils/config"));
const logger_1 = __importStar(require("../utils/logger"));
const types_1 = require("../types");
const authController_1 = __importDefault(require("../controllers/authController"));
const gdprController_1 = __importDefault(require("../controllers/gdprController"));
const messagingController_1 = __importDefault(require("../controllers/messagingController"));
const adminController_1 = __importDefault(require("../controllers/adminController"));
const marketplaceController = __importStar(require("../controllers/marketplaceController"));
const referralController = __importStar(require("../controllers/referralController"));
const chatController = __importStar(require("../controllers/chatController"));
const caseController = __importStar(require("../controllers/caseController"));
const notificationController = __importStar(require("../controllers/notificationController"));
const reviewController = __importStar(require("../controllers/reviewController"));
const auth_1 = require("../middleware/auth");
function generateShortSecureToken() {
    const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let token = '';
    for (let i = 0; i < 6; i++) {
        token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const timeComponent = (Date.now() % 100).toString().padStart(2, '0');
    return token + timeComponent;
}
class ServiceTextProServer {
    constructor() {
        this.app = (0, express_1.default)();
        this.httpServer = (0, http_1.createServer)(this.app);
        this.io = new socket_io_1.Server(this.httpServer, {
            cors: {
                origin: config_1.default.security.cors.origin,
                credentials: config_1.default.security.cors.credentials
            }
        });
        this.initializeMiddleware();
        this.initializeRoutes();
        this.initializeErrorHandling();
        this.initializeGracefulShutdown();
    }
    initializeMiddleware() {
        this.app.set('trust proxy', 1);
        this.app.use((0, helmet_1.default)({
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    styleSrc: ["'self'", "'unsafe-inline'"],
                    scriptSrc: ["'self'"],
                    imgSrc: ["'self'", "data:", "https:"],
                    connectSrc: ["'self'"],
                    fontSrc: ["'self'"],
                    objectSrc: ["'none'"],
                    mediaSrc: ["'self'"],
                    frameSrc: ["'none'"],
                },
                reportOnly: false
            },
            hsts: {
                maxAge: config_1.default.security.https.hstsMaxAge,
                includeSubDomains: true,
                preload: true
            }
        }));
        this.app.use((0, cors_1.default)({
            origin: config_1.default.security.cors.enabled ? config_1.default.security.cors.origin : ['http://localhost:3000', 'http://192.168.0.129:3002'],
            credentials: config_1.default.security.cors.enabled ? config_1.default.security.cors.credentials : true,
            methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
            allowedHeaders: [
                'Origin',
                'X-Requested-With',
                'Content-Type',
                'Accept',
                'Authorization',
                'X-Request-ID',
                'X-GDPR-Consent',
                'X-Data-Processing-Basis'
            ]
        }));
        const limiter = (0, express_rate_limit_1.default)({
            windowMs: config_1.default.security.rateLimit.windowMs,
            max: process.env.NODE_ENV === 'production' ? config_1.default.security.rateLimit.maxRequests : 10000,
            message: {
                error: 'Too many requests from this IP, please try again later.',
                code: 'RATE_LIMIT_EXCEEDED'
            },
            standardHeaders: true,
            legacyHeaders: false,
            handler: (req, res) => {
                logger_1.default.warn('Rate limit exceeded', {
                    ip: req.ip,
                    userAgent: req.get('User-Agent'),
                    url: req.url,
                    method: req.method
                });
                res.status(429).json({
                    success: false,
                    error: {
                        code: 'RATE_LIMIT_EXCEEDED',
                        message: 'Too many requests from this IP, please try again later.'
                    },
                    gdpr: {
                        dataProcessingBasis: 'legitimate_interest',
                        retentionPeriod: '24 hours for security monitoring',
                        rightsInformation: config_1.default.gdpr.urls.privacyPolicy
                    }
                });
            }
        });
        this.app.use(limiter);
        const uploadsDir = path_1.default.join(process.cwd(), 'uploads');
        if (!fs_1.default.existsSync(uploadsDir)) {
            fs_1.default.mkdirSync(uploadsDir, { recursive: true });
        }
        this.app.use('/uploads', (req, res, next) => {
            res.header('Access-Control-Allow-Origin', '*');
            res.header('Access-Control-Allow-Methods', 'GET');
            res.header('Access-Control-Allow-Headers', 'Content-Type');
            res.header('Cross-Origin-Resource-Policy', 'cross-origin');
            next();
        }, express_1.default.static(uploadsDir));
        this.app.use(express_1.default.json({
            limit: '10mb',
            verify: (req, res, buf) => {
                req.rawBody = buf;
            }
        }));
        this.app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
        this.app.use((0, morgan_1.default)('combined', {
            stream: {
                write: (message) => {
                    const sanitized = message
                        .replace(/(\d{3})\d{4}(\d{3})/g, '$1****$2')
                        .replace(/([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g, '$1****@$2');
                    logger_1.default.http(sanitized.trim());
                }
            }
        }));
        this.app.use((0, logger_1.createRequestLogger)());
        this.app.use((req, res, next) => {
            req.requestId = req.get('X-Request-ID') || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            res.setHeader('X-Request-ID', req.requestId);
            next();
        });
        this.app.use((req, res, next) => {
            const skipGDPRPaths = [
                '/health',
                '/api/v1/auth/login',
                '/api/v1/gdpr/privacy-notice',
                '/api/v1/chat/conversations',
                '/api/v1/chat/messages',
                '/api/v1/marketplace'
            ];
            if (skipGDPRPaths.some(path => req.path.startsWith(path))) {
                return next();
            }
            const gdprConsent = req.get('X-GDPR-Consent');
            const dataProcessingBasis = req.get('X-Data-Processing-Basis');
            req.gdpr = {
                consentProvided: !!gdprConsent,
                dataProcessingBasis: dataProcessingBasis || 'legitimate_interest',
                timestamp: new Date()
            };
            next();
        });
        this.app.use('/api/v1', (req, res, next) => {
            res.setHeader('API-Version', 'v1');
            next();
        });
    }
    initializeRoutes() {
        this.app.get('/health', (req, res) => {
            res.json({
                status: 'healthy',
                timestamp: new Date().toISOString(),
                version: config_1.default.app.version,
                environment: config_1.default.app.environment,
                gdpr: {
                    enabled: config_1.default.gdpr.enabled,
                    dpoContact: config_1.default.gdpr.dpo.email
                }
            });
        });
        this.app.get('/api/v1/health', (req, res) => {
            res.json({
                success: true,
                data: {
                    status: 'healthy',
                    timestamp: new Date().toISOString(),
                    version: config_1.default.app.version,
                    environment: config_1.default.app.environment,
                    gdpr: {
                        enabled: config_1.default.gdpr.enabled,
                        dpoContact: config_1.default.gdpr.dpo.email
                    }
                },
                gdpr: {
                    dataProcessingBasis: 'legitimate_interest',
                    retentionPeriod: 'Not applicable for health checks',
                    rightsInformation: config_1.default.gdpr.urls.privacyPolicy
                }
            });
        });
        this.app.get('/api/v1/dashboard/stats', (req, res) => {
            res.json({
                success: true,
                data: {
                    totalCalls: 0,
                    missedCalls: 0,
                    responseRate: 100,
                    avgResponseTime: '0m 0s',
                    activeConversations: 0
                },
                metadata: {
                    timestamp: new Date().toISOString(),
                    version: config_1.default.app.version
                }
            });
        });
        this.app.get('/api/v1/gdpr/privacy-notice', (req, res) => {
            res.json({
                success: true,
                data: {
                    privacyPolicy: config_1.default.gdpr.urls.privacyPolicy,
                    termsOfService: config_1.default.gdpr.urls.termsOfService,
                    cookiePolicy: config_1.default.gdpr.urls.cookiePolicy,
                    dpoContact: config_1.default.gdpr.dpo,
                    dataRetentionPolicies: {
                        conversationData: `${config_1.default.gdpr.dataRetention.conversationMonths} months`,
                        businessData: `${config_1.default.gdpr.dataRetention.businessDataMonths} months`,
                        analyticsData: `${config_1.default.gdpr.dataRetention.analyticsMonths} months`,
                        auditLogs: `${config_1.default.gdpr.dataRetention.auditLogMonths} months`
                    },
                    userRights: [
                        'Right to information',
                        'Right of access',
                        'Right to rectification',
                        'Right to erasure',
                        'Right to restrict processing',
                        'Right to data portability',
                        'Right to object'
                    ]
                },
                gdpr: {
                    dataProcessingBasis: 'legal_obligation',
                    retentionPeriod: 'indefinite (legal requirement)',
                    rightsInformation: 'This information is provided as required by GDPR Article 13-14'
                }
            });
        });
        if (config_1.default.features.swagger) {
            this.app.get('/api/v1/docs', (req, res) => {
                res.json({
                    message: 'ServiceText Pro API Documentation',
                    version: config_1.default.app.version,
                    endpoints: {
                        authentication: '/api/v1/auth/*',
                        gdpr: '/api/v1/gdpr/*',
                        business: '/api/v1/business/*',
                        messaging: '/api/v1/messaging/*',
                        analytics: '/api/v1/analytics/*'
                    },
                    gdprCompliance: true
                });
            });
        }
        this.app.use((req, res, next) => {
            req.io = this.io;
            next();
        });
        this.app.use('/api/v1/auth', authController_1.default);
        this.app.use('/api/v1/gdpr', gdprController_1.default);
        this.app.use('/api/v1/messaging', messagingController_1.default);
        this.app.use('/api/v1/admin', adminController_1.default);
        this.app.get('/api/v1/marketplace/providers/search', marketplaceController.searchProviders);
        this.app.get('/api/v1/marketplace/providers/:id', marketplaceController.getProvider);
        this.app.post('/api/v1/marketplace/providers/profile', marketplaceController.createOrUpdateProfile);
        this.app.put('/api/v1/auth/profile', auth_1.authenticateToken, marketplaceController.updateUserProfile);
        this.app.get('/api/v1/marketplace/categories', marketplaceController.getServiceCategories);
        this.app.get('/api/v1/marketplace/locations/cities', marketplaceController.getCities);
        this.app.get('/api/v1/marketplace/locations/neighborhoods', marketplaceController.getNeighborhoods);
        this.app.post('/api/v1/marketplace/inquiries', marketplaceController.createInquiry);
        this.app.get('/api/v1/marketplace/inquiries', marketplaceController.getInquiries);
        this.app.post('/api/v1/marketplace/reviews', marketplaceController.addReview);
        this.app.post('/api/v1/marketplace/conversations/:conversationId/messages', marketplaceController.sendMessage);
        this.app.put('/api/v1/marketplace/conversations/:conversationId', marketplaceController.updateConversation);
        this.app.post('/api/v1/chat/conversations', chatController.startConversation);
        this.app.post('/api/v1/chat/messages', chatController.sendMessage);
        this.app.get('/api/v1/chat/messages', chatController.getAllMessages);
        this.app.get('/api/v1/chat/provider/:providerId/conversations', chatController.getProviderConversations);
        this.app.put('/api/v1/chat/conversations/:conversationId/read', chatController.markAsRead);
        this.app.get('/api/v1/referrals/code', auth_1.authenticateToken, referralController.getReferralCode);
        this.app.get('/api/v1/referrals/dashboard', auth_1.authenticateToken, referralController.getReferralDashboard);
        this.app.post('/api/v1/referrals/track/:profileId', referralController.trackProfileClick);
        this.app.post('/api/v1/referrals/create', referralController.createReferral);
        this.app.post('/api/v1/referrals/activate', referralController.activateReferral);
        this.app.get('/api/v1/referrals/rewards', auth_1.authenticateToken, referralController.getAvailableRewards);
        this.app.post('/api/v1/referrals/rewards/:rewardId/apply', auth_1.authenticateToken, referralController.applyReward);
        this.app.get('/api/v1/referrals/validate/:code', referralController.validateReferralCode);
        this.app.post('/api/v1/cases', caseController.createCase);
        this.app.get('/api/v1/cases', caseController.getCasesWithFilters);
        this.app.get('/api/v1/cases/stats', caseController.getCaseStats);
        this.app.get('/api/v1/cases/provider/:providerId', caseController.getProviderCases);
        this.app.get('/api/v1/cases/queue/:providerId', caseController.getAvailableCases);
        this.app.get('/api/v1/cases/:caseId', caseController.getCase);
        this.app.get('/api/v1/cases/:caseId/smart-matches', caseController.getSmartMatches);
        this.app.post('/api/v1/cases/:caseId/decline', caseController.declineCase);
        this.app.post('/api/v1/cases/:caseId/accept', caseController.acceptCase);
        this.app.post('/api/v1/cases/:caseId/complete', caseController.completeCase);
        this.app.put('/api/v1/cases/:caseId/status', caseController.updateCaseStatus);
        this.app.post('/api/v1/cases/:caseId/auto-assign', caseController.autoAssignCase);
        this.app.get('/api/v1/cases/declined/:providerId', auth_1.authenticateToken, caseController.getDeclinedCases);
        this.app.post('/api/v1/cases/:caseId/undecline', auth_1.authenticateToken, caseController.undeclineCase);
        this.app.get('/api/v1/income/provider/:providerId', auth_1.authenticateToken, caseController.getIncomeStats);
        this.app.get('/api/v1/income/provider/:providerId/years', auth_1.authenticateToken, caseController.getIncomeYears);
        this.app.get('/api/v1/income/provider/:providerId/method/:paymentMethod', auth_1.authenticateToken, caseController.getIncomeTransactionsByMethod);
        this.app.get('/api/v1/income/provider/:providerId/month/:month', auth_1.authenticateToken, caseController.getIncomeTransactionsByMonth);
        this.app.put('/api/v1/income/:incomeId', auth_1.authenticateToken, caseController.updateIncomeTransaction);
        this.app.get('/api/v1/notifications', auth_1.authenticateToken, notificationController.getUserNotifications);
        this.app.get('/api/v1/notifications/unread-count', auth_1.authenticateToken, notificationController.getUnreadCount);
        this.app.post('/api/v1/notifications/:notificationId/read', auth_1.authenticateToken, notificationController.markAsRead);
        this.app.post('/api/v1/notifications/mark-all-read', auth_1.authenticateToken, notificationController.markAllAsRead);
        this.app.post('/api/v1/notifications/test', auth_1.authenticateToken, notificationController.createTestNotification);
        this.app.post('/api/v1/reviews', auth_1.authenticateToken, reviewController.createReview);
        this.app.get('/api/v1/reviews/provider/:providerId', reviewController.getProviderReviews);
        this.app.get('/api/v1/reviews/provider/:providerId/stats', reviewController.getProviderReviewStats);
        this.app.post('/api/v1/reviews/provider/:providerId/update-rating', reviewController.updateProviderRating);
        this.app.get('/api/v1/reviews/case/:caseId/can-review', auth_1.authenticateToken, reviewController.canReviewCase);
        this.app.get('/api/v1/reviews/pending', auth_1.authenticateToken, reviewController.getPendingReviews);
        this.app.post('/api/v1/reviews/request', reviewController.sendReviewRequest);
        this.app.get('/api/v1/dashboard/stats', (req, res) => {
            res.json({
                success: true,
                data: {
                    totalCalls: 0,
                    missedCalls: 0,
                    responseRate: 100,
                    avgResponseTime: '0m 0s',
                    activeConversations: 0
                },
                metadata: {
                    timestamp: new Date().toISOString(),
                    version: config_1.default.app.version
                }
            });
        });
        this.app.get('/api/v1/gdpr/privacy-notice', (req, res) => {
            res.json({
                success: true,
                data: {
                    privacyPolicy: config_1.default.gdpr.urls.privacyPolicy,
                    termsOfService: config_1.default.gdpr.urls.termsOfService,
                    cookiePolicy: config_1.default.gdpr.urls.cookiePolicy,
                    dpoContact: config_1.default.gdpr.dpo,
                    dataRetentionPolicies: {
                        conversationData: `${config_1.default.gdpr.dataRetention.conversationMonths} months`,
                        businessData: `${config_1.default.gdpr.dataRetention.businessDataMonths} months`,
                        analyticsData: `${config_1.default.gdpr.dataRetention.analyticsMonths} months`,
                        auditLogs: `${config_1.default.gdpr.dataRetention.auditLogMonths} months`
                    },
                    userRights: [
                        'Right to information',
                        'Right of access',
                        'Right to rectification',
                        'Right to erasure',
                        'Right to restrict processing',
                        'Right to data portability',
                        'Right to object'
                    ]
                },
                gdpr: {
                    dataProcessingBasis: 'legal_obligation',
                    retentionPeriod: 'indefinite (legal requirement)',
                    rightsInformation: 'This information is provided as required by GDPR Article 13-14'
                }
            });
        });
        if (config_1.default.features.swagger) {
            this.app.get('/api/v1/docs', (req, res) => {
                res.json({
                    message: 'ServiceText Pro API Documentation',
                    version: config_1.default.app.version,
                    endpoints: {
                        authentication: '/api/v1/auth/*',
                        gdpr: '/api/v1/gdpr/*',
                        business: '/api/v1/business/*',
                        messaging: '/api/v1/messaging/*',
                        analytics: '/api/v1/analytics/*'
                    },
                    gdprCompliance: true
                });
            });
        }
        this.app.use((req, res, next) => {
            req.io = this.io;
            next();
        });
        this.app.use('/api/v1/auth', authController_1.default);
        this.app.use('/api/v1/gdpr', gdprController_1.default);
        this.app.use('/api/v1/messaging', messagingController_1.default);
        this.app.get('/api/v1/marketplace/providers/search', marketplaceController.searchProviders);
        this.app.get('/api/v1/marketplace/providers/:id', marketplaceController.getProvider);
        this.app.post('/api/v1/marketplace/providers/profile', marketplaceController.createOrUpdateProfile);
        this.app.get('/api/v1/marketplace/categories', marketplaceController.getServiceCategories);
        this.app.get('/api/v1/marketplace/locations/cities', marketplaceController.getCities);
        this.app.get('/api/v1/marketplace/locations/neighborhoods', marketplaceController.getNeighborhoods);
        this.app.post('/api/v1/marketplace/inquiries', marketplaceController.createInquiry);
        this.app.get('/api/v1/marketplace/inquiries', marketplaceController.getInquiries);
        this.app.post('/api/v1/marketplace/reviews', marketplaceController.addReview);
        this.app.post('/api/v1/marketplace/conversations/:conversationId/messages', marketplaceController.sendMessage);
        this.app.post('/api/v1/chat/conversations', chatController.startConversation);
        this.app.post('/api/v1/chat/messages', chatController.sendMessage);
        this.app.get('/api/v1/chat/messages', chatController.getAllMessages);
        this.app.get('/api/v1/chat/conversations/:conversationId/messages', chatController.getMessages);
        this.app.get('/api/v1/chat/conversations/:conversationId', chatController.getConversation);
        this.app.get('/api/v1/chat/provider/:providerId/conversations', chatController.getProviderConversations);
        this.app.put('/api/v1/chat/conversations/:conversationId/read', chatController.markAsRead);
        const chatTokenRoutes = require('./controllers/chatTokenController').default;
        this.app.use('/api/v1/chat', chatTokenRoutes);
        const smsController = require('./controllers/smsController').default;
        this.app.use('/api/v1/sms', smsController);
        this.app.post('/api/v1/uploads/image', async (req, res) => {
            try {
                const { userId, filename, data } = req.body;
                if (!data) {
                    return res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'data (base64) required' } });
                }
                const baseName = (filename || `image_${Date.now()}.jpg`).replace(/[^a-zA-Z0-9_.-]/g, '_');
                const userDir = path_1.default.join(process.cwd(), 'uploads', userId || 'public');
                if (!fs_1.default.existsSync(userDir))
                    fs_1.default.mkdirSync(userDir, { recursive: true });
                const filePath = path_1.default.join(userDir, `${Date.now()}_${baseName}`);
                const base64 = data.replace(/^data:\w+\/[-+\.\w]+;base64,/, '');
                fs_1.default.writeFileSync(filePath, Buffer.from(base64, 'base64'));
                const publicUrl = `/uploads/${userId || 'public'}/${path_1.default.basename(filePath)}`;
                return res.json({ success: true, data: { url: publicUrl } });
            }
            catch (e) {
                return res.status(500).json({ success: false, error: { code: 'UPLOAD_FAILED', message: 'Failed to upload image' } });
            }
        });
        this.app.get('/api/v1/users/:userId/public-id', chatController.getUserPublicId);
        this.app.get('/api/v1/chat/user/:userId/conversations', chatController.getUserConversations);
        this.app.get('/api/v1/chat/unified/:conversationId/messages', chatController.getUnifiedMessages);
        this.app.get('/api/v1/dashboard/stats', (req, res) => {
            res.json({
                success: true,
                data: {
                    totalCalls: 0,
                    missedCalls: 0,
                    responseRate: 0,
                    avgResponseTime: 0,
                    activeConversations: 0
                },
                gdpr: {
                    dataProcessingBasis: 'legitimate_interest',
                    retentionPeriod: '24 hours',
                    rightsInformation: config_1.default.gdpr.urls.privacyPolicy
                }
            });
        });
        this.app.post('/api/v1/sync/missed-calls', (req, res) => {
            const { missedCalls } = req.body;
            logger_1.default.info('Missed calls sync request', {
                count: missedCalls?.length || 0,
                ip: req.ip,
                userAgent: req.get('User-Agent')
            });
            res.json({
                success: true,
                data: {
                    synced: missedCalls?.length || 0,
                    timestamp: new Date().toISOString()
                },
                gdpr: {
                    dataProcessingBasis: 'legitimate_interest',
                    retentionPeriod: '24 hours',
                    rightsInformation: config_1.default.gdpr.urls.privacyPolicy
                }
            });
        });
        this.app.post('/api/v1/sync/sms-sent', (req, res) => {
            const { smsData } = req.body;
            logger_1.default.info('SMS sent sync request', {
                count: smsData?.length || 0,
                ip: req.ip,
                userAgent: req.get('User-Agent')
            });
            res.json({
                success: true,
                data: {
                    synced: smsData?.length || 0,
                    timestamp: new Date().toISOString()
                },
                gdpr: {
                    dataProcessingBasis: 'legitimate_interest',
                    retentionPeriod: '24 hours',
                    rightsInformation: config_1.default.gdpr.urls.privacyPolicy
                }
            });
        });
        this.app.get('/api/v1/status', (req, res) => {
            res.json({
                success: true,
                data: {
                    server: 'ServiceText Pro Backend',
                    status: 'operational',
                    features: {
                        gdprCompliance: config_1.default.gdpr.enabled,
                        bulgarianSupport: true,
                        aiConversations: config_1.default.features.aiConversations,
                        multiPlatformMessaging: true
                    }
                },
                gdpr: {
                    dataProcessingBasis: 'legitimate_interest',
                    retentionPeriod: 'Not applicable for status information',
                    rightsInformation: config_1.default.gdpr.urls.privacyPolicy
                }
            });
        });
        this.app.use('/api', (req, res, next) => {
            if (!res.headersSent) {
                res.status(404).json({
                    success: false,
                    error: {
                        code: 'ENDPOINT_NOT_FOUND',
                        message: `API endpoint ${req.method} ${req.path} not found`
                    },
                    gdpr: {
                        dataProcessingBasis: 'legitimate_interest',
                        retentionPeriod: '24 hours for security monitoring',
                        rightsInformation: config_1.default.gdpr.urls.privacyPolicy
                    }
                });
            }
        });
    }
    initializeErrorHandling() {
        this.app.use((error, req, res, next) => {
            logger_1.default.error('Unhandled application error', {
                error: {
                    name: error.name,
                    message: error.message,
                    code: error.code || 'INTERNAL_ERROR'
                },
                request: {
                    method: req.method,
                    url: req.url,
                    ip: req.ip,
                    userAgent: req.get('User-Agent')
                }
            });
            let statusCode = 500;
            if (error instanceof types_1.ServiceTextProError) {
                statusCode = error.statusCode;
            }
            else if (error.status) {
                statusCode = error.status;
            }
            const message = config_1.default.app.environment === 'production' && statusCode === 500
                ? 'Internal server error'
                : error.message;
            res.status(statusCode).json({
                success: false,
                error: {
                    code: error.code || 'INTERNAL_ERROR',
                    message,
                    ...(config_1.default.app.environment === 'development' && { stack: error.stack })
                },
                metadata: {
                    timestamp: new Date().toISOString(),
                    requestId: req.requestId,
                    version: config_1.default.app.version
                },
                gdpr: {
                    dataProcessingBasis: 'legitimate_interest',
                    retentionPeriod: '24 hours for error monitoring',
                    rightsInformation: config_1.default.gdpr.urls.privacyPolicy
                }
            });
        });
        process.on('uncaughtException', (error) => {
            logger_1.default.error('Uncaught exception', { error: error.message, stack: error.stack });
            process.exit(1);
        });
        process.on('unhandledRejection', (reason, promise) => {
            logger_1.default.error('Unhandled promise rejection', {
                reason: reason?.message || reason?.toString() || 'Unknown reason',
                stack: reason?.stack,
                promiseString: promise?.toString()
            });
            if (process.env.NODE_ENV === 'production') {
                process.exit(1);
            }
        });
    }
    initializeGracefulShutdown() {
        const gracefulShutdown = (signal) => {
            logger_1.default.info(`Received ${signal}, starting graceful shutdown...`);
            this.httpServer.close(() => {
                logger_1.default.info('HTTP server closed');
                logger_1.default.info('Graceful shutdown completed');
                process.exit(0);
            });
            setTimeout(() => {
                logger_1.default.error('Forced shutdown after timeout');
                process.exit(1);
            }, 30000);
        };
        process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
        process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    }
    start() {
        try {
            (0, config_1.initializeConfig)();
            this.httpServer.listen(config_1.default.app.port, config_1.default.app.host, () => {
                logger_1.default.info(`ServiceText Pro Backend started`, {
                    host: config_1.default.app.host,
                    port: config_1.default.app.port,
                    environment: config_1.default.app.environment,
                    version: config_1.default.app.version,
                    gdprEnabled: config_1.default.gdpr.enabled,
                    features: {
                        aiConversations: config_1.default.features.aiConversations,
                        sofiaTraffic: config_1.default.features.sofiaTrafficIntegration,
                        certification: config_1.default.features.certificationValidation,
                        marketIntelligence: config_1.default.features.marketIntelligence,
                        analytics: config_1.default.features.advancedAnalytics
                    }
                });
                logger_1.gdprLogger.logDataAccess('system', 'server_startup', 'system_operation');
            });
            this.initializeWebSocket();
            this.initializeTokenCleanup();
        }
        catch (error) {
            logger_1.default.error('Failed to start server', { error: error instanceof Error ? error.message : 'Unknown error' });
            process.exit(1);
        }
    }
    initializeWebSocket() {
        this.io.on('connection', (socket) => {
            logger_1.default.info('WebSocket client connected', { socketId: socket.id });
            socket.on('disconnect', (reason) => {
                logger_1.default.info('WebSocket client disconnected', {
                    socketId: socket.id,
                    reason
                });
            });
            socket.on('authenticate', async (data) => {
                try {
                    const { token, userId } = data;
                    if (token && userId) {
                        socket.join(`user-${userId}`);
                        socket.userId = userId;
                        socket.emit('authenticated', { success: true, userId });
                        logger_1.default.info('WebSocket client authenticated', {
                            socketId: socket.id,
                            userId
                        });
                    }
                    else {
                        socket.emit('authentication_error', { error: 'Invalid credentials' });
                    }
                }
                catch (error) {
                    logger_1.default.error('WebSocket authentication error:', error);
                    socket.emit('authentication_error', { error: 'Authentication failed' });
                }
            });
            socket.on('join-conversation', (conversationId) => {
                socket.join(`conversation-${conversationId}`);
                logger_1.default.info('Client joined conversation', {
                    socketId: socket.id,
                    conversationId
                });
            });
            socket.on('join-user', (userId) => {
                socket.join(`user-${userId}`);
                logger_1.default.info('Client joined user room', {
                    socketId: socket.id,
                    userId
                });
            });
            socket.on('join_location_room', (locationName) => {
                socket.join(`location-${locationName}`);
                logger_1.default.info('Client joined location room', {
                    socketId: socket.id,
                    locationName
                });
            });
            socket.on('leave_location_room', (locationName) => {
                socket.leave(`location-${locationName}`);
                logger_1.default.info('Client left location room', {
                    socketId: socket.id,
                    locationName
                });
            });
            socket.on('join_category_room', (category) => {
                socket.join(`category-${category}`);
                logger_1.default.info('Client joined category room', {
                    socketId: socket.id,
                    category
                });
            });
            socket.on('leave_category_room', (category) => {
                socket.leave(`category-${category}`);
                logger_1.default.info('Client left category room', {
                    socketId: socket.id,
                    category
                });
            });
        });
    }
    initializeTokenCleanup() {
        logger_1.default.info('🧹 Token cleanup will be handled by new ChatTokenService');
    }
}
const server = new ServiceTextProServer();
server.start();
exports.default = server;
//# sourceMappingURL=server.js.map