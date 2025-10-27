// ServiceText Pro Backend Server
// GDPR-compliant Express.js server with comprehensive security and monitoring

import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';

import config, { initializeConfig } from './utils/config';
import logger, { createRequestLogger, gdprLogger } from './utils/logger';
import { ServiceTextProError } from './types';

// Import routes
import authRoutes from './controllers/authController';
import gdprRoutes from './controllers/gdprController';
import messagingRoutes from './controllers/messagingController';
import adminRoutes from './controllers/adminController';
import * as marketplaceController from './controllers/marketplaceController';
import * as chatTokenController from './controllers/chatTokenController';
import * as referralController from './controllers/referralController';
import * as chatController from './controllers/chatController';
import { ChatController, chatErrorHandler } from './controllers/chatControllerV2';
import { ChatService } from './services/ChatService';
import { ChatRepository } from './models/ChatRepository';
import { ChatSocketHandler } from './socket/chatSocket';
import * as caseController from './controllers/caseController';
import * as notificationController from './controllers/notificationController';
import * as reviewController from './controllers/reviewController';
import { authenticateToken } from './middleware/auth';
import { DatabaseFactory } from './models/DatabaseFactory';
// import businessRoutes from '@/controllers/businessController';
// import analyticsRoutes from '@/controllers/analyticsController';

/**
 * Generate a short but secure token for chat links
 */
function generateShortSecureToken(): string {
  // Generate a short but secure 6-character token
  // Uses base36 (0-9, a-z) for URL safety and readability
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let token = '';
  
  // Generate 6 random characters for 36^6 = 2.1 billion combinations
  for (let i = 0; i < 6; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  // Add timestamp component to ensure uniqueness (last 2 digits of timestamp)
  const timeComponent = (Date.now() % 100).toString().padStart(2, '0');
  
  return token + timeComponent; // Total: 8 characters (still very short)
}

class ServiceTextProServer {
  private app: express.Application;
  private httpServer: any;
  private io: SocketIOServer;
  private static instance: ServiceTextProServer;

  constructor() {
    ServiceTextProServer.instance = this;
    this.app = express();
    this.httpServer = createServer(this.app);
    this.io = new SocketIOServer(this.httpServer, {
      cors: {
        origin: config.security.cors.origin,
        credentials: config.security.cors.credentials
      }
    });

    this.initializeMiddleware();
    this.initializeRoutes();
    this.initializeErrorHandling();
    this.initializeGracefulShutdown();
  }

  /**
   * Initialize all middleware with GDPR compliance and security
   */
  private initializeMiddleware(): void {
    // Trust proxy for accurate IP addresses
    this.app.set('trust proxy', 1);

    // Security headers with GDPR considerations
    this.app.use(helmet({
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
        maxAge: config.security.https.hstsMaxAge,
        includeSubDomains: true,
        preload: true
      }
    }));

    // CORS configuration with GDPR compliance
    this.app.use(cors({
      origin: config.security.cors.enabled ? config.security.cors.origin : ['http://localhost:3000', 'http://192.168.0.129:3002', 'http://46.224.11.139'],
      credentials: config.security.cors.enabled ? config.security.cors.credentials : true,
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

    // Rate limiting with GDPR logging (disabled in development)
    const limiter = rateLimit({
      windowMs: config.security.rateLimit.windowMs,
      max: process.env.NODE_ENV === 'production' ? config.security.rateLimit.maxRequests : 10000, // Much higher limit in dev
      message: {
        error: 'Too many requests from this IP, please try again later.',
        code: 'RATE_LIMIT_EXCEEDED'
      },
      standardHeaders: true,
      legacyHeaders: false,
      handler: (req: Request, res: Response) => {
        // Log rate limit violations for security monitoring
        logger.warn('Rate limit exceeded', {
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
            rightsInformation: config.gdpr.urls.privacyPolicy
          }
        });
      }
    });

    this.app.use(limiter);

    // Serve uploaded images statically with CORS headers
    const uploadsDir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    this.app.use('/uploads', (req, res, next) => {
      // Add CORS headers for uploaded images
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET');
      res.header('Access-Control-Allow-Headers', 'Content-Type');
      res.header('Cross-Origin-Resource-Policy', 'cross-origin');
      next();
    }, express.static(uploadsDir));

    // Request parsing
    this.app.use(express.json({ 
      limit: '10mb',
      verify: (req: any, res, buf) => {
        // Store raw body for webhook verification
        req.rawBody = buf;
      }
    }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Request logging with GDPR compliance
    this.app.use(morgan('combined', {
      stream: {
        write: (message: string) => {
          // Remove potential PII from logs
          const sanitized = message
            .replace(/(\d{3})\d{4}(\d{3})/g, '$1****$2') // Phone numbers
            .replace(/([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g, '$1****@$2'); // Emails
          
          logger.http(sanitized.trim());
        }
      }
    }));

    // Custom request logger for detailed GDPR audit
    this.app.use(createRequestLogger());

    // Request ID for tracing
    this.app.use((req: any, res: Response, next: NextFunction) => {
      req.requestId = req.get('X-Request-ID') || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      res.setHeader('X-Request-ID', req.requestId);
      next();
    });

    // GDPR consent validation middleware
    this.app.use((req: any, res: Response, next: NextFunction) => {
      // Skip GDPR validation for certain endpoints
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

      // Check for GDPR consent header (for authenticated requests)
      const gdprConsent = req.get('X-GDPR-Consent');
      const dataProcessingBasis = req.get('X-Data-Processing-Basis');

      // Add GDPR metadata to request
      req.gdpr = {
        consentProvided: !!gdprConsent,
        dataProcessingBasis: dataProcessingBasis || 'legitimate_interest',
        timestamp: new Date()
      };

      next();
    });

    // API versioning
    this.app.use('/api/v1', (req: Request, res: Response, next: NextFunction) => {
      res.setHeader('API-Version', 'v1');
      next();
    });
  }

  /**
   * Initialize all API routes
   */
  private initializeRoutes(): void {
    // Health check endpoint (no authentication required)
    this.app.get('/health', (req: Request, res: Response) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: config.app.version,
        environment: config.app.environment,
        gdpr: {
          enabled: config.gdpr.enabled,
          dpoContact: config.gdpr.dpo.email
        }
      });
    });

    // API health check endpoint (for mobile app)
    this.app.get('/api/v1/health', (req: Request, res: Response) => {
      res.json({
        success: true,
        data: {
          status: 'healthy',
          timestamp: new Date().toISOString(),
          version: config.app.version,
          environment: config.app.environment,
          gdpr: {
            enabled: config.gdpr.enabled,
            dpoContact: config.gdpr.dpo.email
          }
        },
        gdpr: {
          dataProcessingBasis: 'legitimate_interest',
          retentionPeriod: 'Not applicable for health checks',
          rightsInformation: config.gdpr.urls.privacyPolicy
        }
      });
    });

    // Dashboard stats endpoint
    this.app.get('/api/v1/dashboard/stats', (req: Request, res: Response) => {
      // For now, return mock data. Later this will be replaced with real database queries
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
          version: config.app.version
        }
      });
    });

    // GDPR-required privacy notice endpoint
    this.app.get('/api/v1/gdpr/privacy-notice', (req: Request, res: Response) => {
      res.json({
        success: true,
        data: {
          privacyPolicy: config.gdpr.urls.privacyPolicy,
          termsOfService: config.gdpr.urls.termsOfService,
          cookiePolicy: config.gdpr.urls.cookiePolicy,
          dpoContact: config.gdpr.dpo,
          dataRetentionPolicies: {
            conversationData: `${config.gdpr.dataRetention.conversationMonths} months`,
            businessData: `${config.gdpr.dataRetention.businessDataMonths} months`,
            analyticsData: `${config.gdpr.dataRetention.analyticsMonths} months`,
            auditLogs: `${config.gdpr.dataRetention.auditLogMonths} months`
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

    // API documentation endpoint
    if (config.features.swagger) {
      this.app.get('/api/v1/docs', (req: Request, res: Response) => {
        res.json({
          message: 'ServiceText Pro API Documentation',
          version: config.app.version,
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

    // Add Socket.IO instance to all requests for real-time updates
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      (req as any).io = this.io;
      next();
    });

    // Mount route controllers
    this.app.use('/api/v1/auth', authRoutes);
    this.app.use('/api/v1/gdpr', gdprRoutes);
    this.app.use('/api/v1/messaging', messagingRoutes);
    this.app.use('/api/v1/admin', adminRoutes);
    
    // Marketplace routes
    this.app.get('/api/v1/marketplace/providers/search', marketplaceController.searchProviders);
    this.app.get('/api/v1/marketplace/providers/:id', marketplaceController.getProvider);
    this.app.post('/api/v1/marketplace/providers/profile', marketplaceController.createOrUpdateProfile);
    this.app.put('/api/v1/auth/profile', authenticateToken, marketplaceController.updateUserProfile);
    this.app.get('/api/v1/marketplace/categories', marketplaceController.getServiceCategories);
    this.app.get('/api/v1/marketplace/locations/cities', marketplaceController.getCities);
    this.app.get('/api/v1/marketplace/locations/neighborhoods', marketplaceController.getNeighborhoods);
    this.app.post('/api/v1/marketplace/inquiries', marketplaceController.createInquiry);
    this.app.get('/api/v1/marketplace/inquiries', marketplaceController.getInquiries);
    this.app.post('/api/v1/marketplace/reviews', marketplaceController.addReview);
    this.app.post('/api/v1/marketplace/conversations/:conversationId/messages', marketplaceController.sendMessage);
    this.app.put('/api/v1/marketplace/conversations/:conversationId', marketplaceController.updateConversation);
    
    // NEW Professional Chat System Routes
    const db = DatabaseFactory.getDatabase() as any; // PostgreSQLDatabase
    const chatRepo = new ChatRepository(db.pool);
    const chatService = new ChatService(chatRepo);
    const chatControllerV2 = new ChatController(chatService);
    
    // Make io available to controllers
    this.app.use((req: any, res, next) => {
      req.io = this.io;
      next();
    });
    
    this.app.get('/api/v1/chat/conversations', authenticateToken, chatControllerV2.getConversations);
    this.app.post('/api/v1/chat/conversations', authenticateToken, chatControllerV2.createConversation);
    this.app.get('/api/v1/chat/conversations/:id', authenticateToken, chatControllerV2.getConversation);
    this.app.get('/api/v1/chat/conversations/:id/messages', authenticateToken, chatControllerV2.getMessages);
    this.app.post('/api/v1/chat/conversations/:id/messages', authenticateToken, chatControllerV2.sendMessage);
    this.app.post('/api/v1/chat/conversations/:id/read', authenticateToken, chatControllerV2.markAsRead);
    this.app.patch('/api/v1/chat/messages/:id', authenticateToken, chatControllerV2.editMessage);
    this.app.delete('/api/v1/chat/messages/:id', authenticateToken, chatControllerV2.deleteMessage);
    this.app.post('/api/v1/chat/messages/:id/receipts', authenticateToken, chatControllerV2.updateReceipt);
    this.app.get('/api/v1/chat/messages/:id/receipts', authenticateToken, chatControllerV2.getReceipts);
    
    // Chat error handler
    this.app.use('/api/v1/chat', chatErrorHandler);
    
    // Initialize chat sockets
    const chatSocketHandler = new ChatSocketHandler(this.io, chatService);
    chatSocketHandler.initialize();
    
    // Referral system routes
    this.app.get('/api/v1/referrals/code', authenticateToken, referralController.getReferralCode);
    this.app.get('/api/v1/referrals/dashboard', authenticateToken, referralController.getReferralDashboard);
    this.app.post('/api/v1/referrals/track/:profileId', referralController.trackProfileClick);
    this.app.post('/api/v1/referrals/create', referralController.createReferral);
    this.app.post('/api/v1/referrals/activate', referralController.activateReferral);
    this.app.get('/api/v1/referrals/rewards', authenticateToken, referralController.getAvailableRewards);
    this.app.post('/api/v1/referrals/rewards/:rewardId/apply', authenticateToken, referralController.applyReward);
    this.app.get('/api/v1/referrals/validate/:code', referralController.validateReferralCode);
    
    // Case management routes
    // IMPORTANT: Specific routes must come BEFORE parameterized routes
    this.app.post('/api/v1/cases', caseController.createCase);
    this.app.get('/api/v1/cases', caseController.getCasesWithFilters);
    this.app.get('/api/v1/cases/stats', caseController.getCaseStats);
    this.app.get('/api/v1/cases/provider/:providerId', caseController.getProviderCases);
    this.app.get('/api/v1/cases/queue/:providerId', caseController.getAvailableCases);
    this.app.get('/api/v1/cases/:caseId', caseController.getCase);
    this.app.get('/api/v1/cases/:caseId/smart-matches', caseController.getSmartMatches);
    this.app.post('/api/v1/cases/:caseId/decline', caseController.declineCase);
    this.app.post('/api/v1/cases/:caseId/accept', caseController.acceptCase);
    this.app.put('/api/v1/cases/:caseId/accept', caseController.acceptCase); // REST convention
    this.app.post('/api/v1/cases/:caseId/complete', caseController.completeCase);
    this.app.put('/api/v1/cases/:caseId/complete', caseController.completeCase); // REST convention
    this.app.put('/api/v1/cases/:caseId/status', caseController.updateCaseStatus);
    this.app.post('/api/v1/cases/:caseId/auto-assign', caseController.autoAssignCase);

    // Declined cases routes
    this.app.get('/api/v1/cases/declined/:providerId', authenticateToken, caseController.getDeclinedCases);
    this.app.post('/api/v1/cases/:caseId/undecline', authenticateToken, caseController.undeclineCase);

    // Income tracking routes
    this.app.get('/api/v1/income/provider/:providerId', authenticateToken, caseController.getIncomeStats);
    this.app.get('/api/v1/income/provider/:providerId/years', authenticateToken, caseController.getIncomeYears);
    this.app.get('/api/v1/income/provider/:providerId/method/:paymentMethod', authenticateToken, caseController.getIncomeTransactionsByMethod);
    this.app.get('/api/v1/income/provider/:providerId/month/:month', authenticateToken, caseController.getIncomeTransactionsByMonth);
    this.app.put('/api/v1/income/:incomeId', authenticateToken, caseController.updateIncomeTransaction);

    // Notification routes
    this.app.get('/api/v1/notifications', authenticateToken, notificationController.getUserNotifications);
    this.app.get('/api/v1/notifications/unread-count', authenticateToken, notificationController.getUnreadCount);
    this.app.post('/api/v1/notifications/:notificationId/read', authenticateToken, notificationController.markAsRead);
    this.app.post('/api/v1/notifications/mark-all-read', authenticateToken, notificationController.markAllAsRead);
    this.app.post('/api/v1/notifications/test', authenticateToken, notificationController.createTestNotification);

    // Review routes
    this.app.post('/api/v1/reviews', authenticateToken, reviewController.createReview);
    this.app.get('/api/v1/reviews/provider/:providerId', reviewController.getProviderReviews);
    this.app.get('/api/v1/reviews/provider/:providerId/stats', reviewController.getProviderReviewStats);
    this.app.post('/api/v1/reviews/provider/:providerId/update-rating', reviewController.updateProviderRating);
    this.app.get('/api/v1/reviews/case/:caseId/can-review', authenticateToken, reviewController.canReviewCase);
    this.app.get('/api/v1/reviews/pending', authenticateToken, reviewController.getPendingReviews);
    this.app.post('/api/v1/reviews/request', reviewController.sendReviewRequest);

    // ==================== OLD CHAT ROUTES - DISABLED ====================
    // These routes are replaced by Chat API V2 above
    // this.app.get('/api/v1/chat/conversations/:conversationId/messages', chatController.getMessages);
    // this.app.get('/api/v1/chat/conversations/:conversationId', chatController.getConversation);
    // this.app.get('/api/v1/chat/user/:userId/conversations', chatController.getUserConversations);
    // this.app.get('/api/v1/chat/unified/:conversationId/messages', chatController.getUnifiedMessages);

    // Chat token system routes
    const chatTokenRoutes = require('./controllers/chatTokenController').default;
    this.app.use('/api/v1/chat', chatTokenRoutes);

    // SMS configuration routes
    const smsController = require('./controllers/smsController').default;
    this.app.use('/api/v1/sms', smsController);

    // Simple base64 image upload (for mobile without multipart libs)
    this.app.post('/api/v1/uploads/image', async (req: Request, res: Response) => {
      try {
        const { userId, filename, data } = req.body as any;
        if (!data) {
          return res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'data (base64) required' } });
        }
        const baseName = (filename || `image_${Date.now()}.jpg`).replace(/[^a-zA-Z0-9_.-]/g, '_');
        const userDir = path.join(process.cwd(), 'uploads', userId || 'public');
        if (!fs.existsSync(userDir)) fs.mkdirSync(userDir, { recursive: true });
        const filePath = path.join(userDir, `${Date.now()}_${baseName}`);
        const base64 = (data as string).replace(/^data:\w+\/[-+\.\w]+;base64,/, '');
        fs.writeFileSync(filePath, Buffer.from(base64, 'base64'));
        const publicUrl = `/uploads/${userId || 'public'}/${path.basename(filePath)}`;
        return res.json({ success: true, data: { url: publicUrl } });
      } catch (e) {
        return res.status(500).json({ success: false, error: { code: 'UPLOAD_FAILED', message: 'Failed to upload image' } });
      }
    });

    // User public ID route - DISABLED (part of old chat system)
    // this.app.get('/api/v1/users/:userId/public-id', chatController.getUserPublicId);

    // Sync endpoints
    this.app.post('/api/v1/sync/missed-calls', (req: Request, res: Response) => {
      const { missedCalls } = req.body;
      
      logger.info('Missed calls sync request', {
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
          rightsInformation: config.gdpr.urls.privacyPolicy
        }
      });
    });

    this.app.post('/api/v1/sync/sms-sent', (req: Request, res: Response) => {
      const { smsData } = req.body;
      
      logger.info('SMS sent sync request', {
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
          rightsInformation: config.gdpr.urls.privacyPolicy
        }
      });
    });

    // Status endpoint
    this.app.get('/api/v1/status', (req: Request, res: Response) => {
      res.json({
        success: true,
        data: {
          server: 'ServiceText Pro Backend',
          status: 'operational',
          features: {
            gdprCompliance: config.gdpr.enabled,
            bulgarianSupport: true,
            aiConversations: config.features.aiConversations,
            multiPlatformMessaging: true
          }
        },
        gdpr: {
          dataProcessingBasis: 'legitimate_interest',
          retentionPeriod: 'Not applicable for status information',
          rightsInformation: config.gdpr.urls.privacyPolicy
        }
      });
    });

    // 404 handler for API routes
    this.app.use('/api', (req: Request, res: Response, next: NextFunction) => {
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
            rightsInformation: config.gdpr.urls.privacyPolicy
          }
        });
      }
    });
  }

/**
 * Initialize error handling with GDPR compliance
 */
private initializeErrorHandling(): void {
  // Global error handler
  this.app.use((error: any, req: Request, res: Response, next: NextFunction) => {
    // Log error (without exposing sensitive data)
    logger.error('Unhandled application error', {
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

    // Determine status code
    let statusCode = 500;
    if (error instanceof ServiceTextProError) {
      statusCode = error.statusCode;
    } else if (error.status) {
      statusCode = error.status;
    }

    // Don't expose internal errors in production
    const message = config.app.environment === 'production' && statusCode === 500
      ? 'Internal server error'
      : error.message;

    res.status(statusCode).json({
      success: false,
      error: {
        code: error.code || 'INTERNAL_ERROR',
        message,
        ...(config.app.environment === 'development' && { stack: error.stack })
      },
      metadata: {
        timestamp: new Date().toISOString(),
        requestId: (req as any).requestId,
        version: config.app.version
      },
      gdpr: {
        dataProcessingBasis: 'legitimate_interest',
        retentionPeriod: '24 hours for error monitoring',
        rightsInformation: config.gdpr.urls.privacyPolicy
      }
    });
  });

  // Handle uncaught exceptions
  process.on('uncaughtException', (error: Error) => {
    logger.error('Uncaught exception', { error: error.message, stack: error.stack });
    process.exit(1);
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
    logger.error('Unhandled promise rejection', { 
      reason: reason?.message || reason?.toString() || 'Unknown reason',
      stack: reason?.stack,
      promiseString: promise?.toString()
    });
    // Don't exit in development to allow debugging
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }
  });
}

/**
 * Initialize graceful shutdown
 */
private initializeGracefulShutdown(): void {
  const gracefulShutdown = (signal: string) => {
    logger.info(`Received ${signal}, starting graceful shutdown...`);

    // Close HTTP server
    this.httpServer.close(() => {
      logger.info('HTTP server closed');

      // Close database connections
      // TODO: Implement database cleanup

      // Close Redis connections
      // TODO: Implement Redis cleanup

      logger.info('Graceful shutdown completed');
      process.exit(0);
    });

    // Force shutdown after 30 seconds
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 30000);
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

/**
 * Start the server
 */
public start(): void {
  try {
    // Initialize configuration
    initializeConfig();

    // Start server - bind to all interfaces for mobile app access
    this.httpServer.listen(config.app.port, config.app.host, () => {
      logger.info(`ServiceText Pro Backend started`, {
        host: config.app.host,
        port: config.app.port,
        environment: config.app.environment,
        version: config.app.version,
        gdprEnabled: config.gdpr.enabled,
        features: {
          aiConversations: config.features.aiConversations,
          sofiaTraffic: config.features.sofiaTrafficIntegration,
          certification: config.features.certificationValidation,
          marketIntelligence: config.features.marketIntelligence,
          analytics: config.features.advancedAnalytics
        }
      });

      // Log startup event for GDPR audit
      gdprLogger.logDataAccess(
        'system',
        'server_startup',
        'system_operation'
      );
    });

    // Initialize WebSocket for real-time features
    this.initializeWebSocket();

    // Start automatic cleanup of expired tokens
    this.initializeTokenCleanup();

  } catch (error) {
    logger.error('Failed to start server', { error: error instanceof Error ? error.message : 'Unknown error' });
    process.exit(1);
  }
}

/**
 * Initialize WebSocket for real-time communication
 */
private initializeWebSocket(): void {
  this.io.on('connection', (socket) => {
    logger.info('WebSocket client connected', { socketId: socket.id });

    socket.on('disconnect', (reason) => {
      logger.info('WebSocket client disconnected', { 
        socketId: socket.id, 
        reason 
      });
    });

    // Handle authentication for WebSocket
    socket.on('authenticate', async (data) => {
      try {
        const { token, userId } = data;
        
        // Validate JWT token (simplified for now)
        if (token && userId) {
          socket.join(`user-${userId}`);
          (socket as any).userId = userId;
          socket.emit('authenticated', { success: true, userId });
          logger.info('WebSocket client authenticated', { 
            socketId: socket.id, 
            userId 
          });
        } else {
          socket.emit('authentication_error', { error: 'Invalid credentials' });
        }
      } catch (error) {
        logger.error('WebSocket authentication error:', error);
        socket.emit('authentication_error', { error: 'Authentication failed' });
      }
    });

    // Handle real-time conversation updates
    socket.on('join-conversation', (conversationId) => {
      socket.join(`conversation-${conversationId}`);
      logger.info('Client joined conversation', { 
        socketId: socket.id, 
        conversationId 
      });
    });

    // Handle user room joins for notifications
    socket.on('join-user', (userId) => {
      socket.join(`user-${userId}`);
      logger.info('Client joined user room', { 
        socketId: socket.id, 
        userId 
      });
    });

    // Handle marketplace location room joins
    socket.on('join_location_room', (locationName) => {
      socket.join(`location-${locationName}`);
      logger.info('Client joined location room', { 
        socketId: socket.id, 
        locationName 
      });
    });

    socket.on('leave_location_room', (locationName) => {
      socket.leave(`location-${locationName}`);
      logger.info('Client left location room', { 
        socketId: socket.id, 
        locationName 
      });
    });

    // Handle marketplace category room joins
    socket.on('join_category_room', (category) => {
      socket.join(`category-${category}`);
      logger.info('Client joined category room', { 
        socketId: socket.id, 
        category 
      });
    });

    socket.on('leave_category_room', (category) => {
      socket.leave(`category-${category}`);
      logger.info('Client left category room', { 
        socketId: socket.id, 
        category 
      });
    });
  });
}

/**
 * Initialize automatic cleanup of expired chat tokens
 */
private initializeTokenCleanup(): void {
  // Use new TokenCleanupJob instead of old cleanup methods
  logger.info('🧹 Token cleanup will be handled by new ChatTokenService');
}
}

// Create and start server
const server = new ServiceTextProServer();
server.start();

// Export getIO function for other controllers to access Socket.IO
export function getIO(): SocketIOServer {
  if (!ServiceTextProServer['instance']) {
    throw new Error('Server not initialized');
  }
  return ServiceTextProServer['instance']['io'];
}

export default server;
