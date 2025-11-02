// Configuration management with GDPR compliance validation
import dotenv from 'dotenv';
import path from 'path';
import { DatabaseConfig, WhatsAppConfig, ViberConfig, TelegramConfig } from '../types';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../config/.env') });

// Development defaults - override with environment variables for production
const isDevelopment = process.env.NODE_ENV !== 'production';

// Only validate critical environment variables in production
if (!isDevelopment) {
  const requiredEnvVars = [
    'NODE_ENV',
    'PORT',
    'JWT_SECRET',
    'JWT_REFRESH_SECRET',
    'POSTGRES_HOST',
    'POSTGRES_DB',
    'POSTGRES_USER',
    'POSTGRES_PASSWORD'
  ];

  const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
  if (missingEnvVars.length > 0) {
    throw new Error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
  }
}

// Application configuration
export const config = {
  // Application settings
  app: {
    name: 'ServiceText Pro Backend',
    version: process.env.APP_VERSION || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    host: process.env.HOST || '0.0.0.0',
    port: parseInt(process.env.PORT || '3000', 10),
    apiVersion: process.env.API_VERSION || 'v1',
    baseUrl: process.env.BASE_URL || `http://localhost:3000`
  },

  // Security configuration
  security: {
    jwt: {
      secret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production',
      refreshSecret: process.env.JWT_REFRESH_SECRET || 'your-super-secret-refresh-key-change-in-production',
      expiresIn: process.env.JWT_EXPIRES_IN || '24h',
      refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d'
    },
    bcrypt: {
      rounds: parseInt(process.env.BCRYPT_ROUNDS || '12')
    },
    rateLimit: {
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
      maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100')
    },
    cors: {
      enabled: process.env.CORS_ENABLED !== 'false', // Enable by default, disable only if explicitly set to false
      origin: (process.env.CORS_ORIGIN || 'http://localhost:3000,http://192.168.0.129:3002').split(','),
      credentials: process.env.CORS_CREDENTIALS !== 'false' // Enable credentials by default
    },
    https: {
      enabled: process.env.HTTPS_ENABLED === 'true',
      keyPath: process.env.HTTPS_KEY_PATH || '',
      certPath: process.env.HTTPS_CERT_PATH || '',
      hstsMaxAge: parseInt(process.env.HTTPS_HSTS_MAX_AGE || '31536000') // 1 year default
    },
    sms: {
      dailyLimit: parseInt(process.env.SMS_DAILY_LIMIT || '50'),
      rateLimitWindow: parseInt(process.env.SMS_RATE_LIMIT_WINDOW || '900000'), // 15 minutes
      rateLimitMax: parseInt(process.env.SMS_RATE_LIMIT_MAX || '10'),
      enableMonitoring: process.env.SMS_ENABLE_MONITORING !== 'false',
      suspiciousThreshold: parseInt(process.env.SMS_SUSPICIOUS_THRESHOLD || '20')
    }
  },

  // Database configuration
  database: {
    postgresql: {
      host: process.env.POSTGRES_HOST || 'localhost',
      port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
      database: process.env.POSTGRES_DB || 'servicetextpro',
      username: process.env.POSTGRES_USER || 'postgres',
      password: process.env.POSTGRES_PASSWORD || 'password',
      ssl: process.env.POSTGRES_SSL === 'true',
      maxConnections: parseInt(process.env.POSTGRES_MAX_CONNECTIONS || '20', 10)
    },
    mongodb: {
      uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/servicetextpro',
      database: process.env.MONGODB_DB || 'servicetext_pro',
      maxPoolSize: parseInt(process.env.MONGODB_MAX_POOL_SIZE || '10', 10)
    },
    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB || '0', 10),
      maxClients: parseInt(process.env.REDIS_MAX_CLIENTS || '10', 10)
    }
  } as DatabaseConfig,

  // External API integrations
  integrations: {
    whatsapp: {
      accessToken: process.env.WHATSAPP_ACCESS_TOKEN || '',
      phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
      webhookVerifyToken: process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || '',
      businessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || ''
    } as WhatsAppConfig,
    
    viber: {
      authToken: process.env.VIBER_AUTH_TOKEN || '',
      botName: process.env.VIBER_BOT_NAME || 'ServiceTextPro',
      webhookUrl: process.env.VIBER_WEBHOOK_URL || ''
    } as ViberConfig,
    
    telegram: {
      botToken: process.env.TELEGRAM_BOT_TOKEN || '',
      webhookUrl: process.env.TELEGRAM_WEBHOOK_URL || ''
    } as TelegramConfig,

    // AI/NLP services
    googleCloud: {
      projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
      keyFile: process.env.GOOGLE_CLOUD_KEY_FILE
    },
    
    azure: {
      textAnalyticsKey: process.env.AZURE_TEXT_ANALYTICS_KEY,
      textAnalyticsEndpoint: process.env.AZURE_TEXT_ANALYTICS_ENDPOINT
    }
  },

  // GDPR compliance configuration
  gdpr: {
    enabled: process.env.GDPR_ENABLED === 'true',
    dpo: {
      email: process.env.DPO_EMAIL || 'dpo@servicetextpro.bg',
      phone: process.env.DPO_PHONE || '+359-2-xxx-xxxx',
      address: process.env.DPO_ADDRESS || 'Sofia, Bulgaria'
    },
    dataRetention: {
      conversationMonths: parseInt(process.env.CONVERSATION_RETENTION_MONTHS || '24', 10),
      businessDataMonths: parseInt(process.env.BUSINESS_DATA_RETENTION_MONTHS || '60', 10),
      analyticsMonths: parseInt(process.env.ANALYTICS_RETENTION_MONTHS || '12', 10),
      auditLogMonths: parseInt(process.env.AUDIT_LOG_RETENTION_MONTHS || '84', 10)
    },
    compliance: {
      autoDeleteExpiredData: process.env.AUTO_DELETE_EXPIRED_DATA === 'true',
      consentRequiredForAnalytics: process.env.CONSENT_REQUIRED_FOR_ANALYTICS === 'true',
      anonymizeExpiredData: process.env.ANONYMIZE_EXPIRED_DATA === 'true'
    },
    urls: {
      privacyPolicy: process.env.PRIVACY_POLICY_URL || 'https://servicetextpro.bg/privacy',
      termsOfService: process.env.TERMS_OF_SERVICE_URL || 'https://servicetextpro.bg/terms',
      cookiePolicy: process.env.COOKIE_POLICY_URL || 'https://servicetextpro.bg/cookies',
      gdprContact: process.env.GDPR_CONTACT_URL || 'https://servicetextpro.bg/gdpr-contact'
    }
  },

  // Bulgarian market specific configuration
  bulgarian: {
    businessRegistry: {
      apiUrl: process.env.BG_BUSINESS_REGISTRY_API_URL || 'https://public.brra.bg/CheckUps/Verifications/',
      apiKey: process.env.BG_BUSINESS_REGISTRY_API_KEY
    },
    sofiaTraffic: {
      apiUrl: process.env.SOFIA_TRAFFIC_API_URL || 'https://api.sofia.bg/traffic/',
      apiKey: process.env.SOFIA_TRAFFIC_API_KEY
    },
    holidays: {
      apiUrl: process.env.BG_HOLIDAYS_API_URL || 'https://api.bg-holidays.com/v1/',
      apiKey: process.env.BG_HOLIDAYS_API_KEY
    },
    localization: {
      currency: process.env.DEFAULT_CURRENCY || 'BGN',
      locale: process.env.DEFAULT_LOCALE || 'bg-BG',
      timezone: process.env.DEFAULT_TIMEZONE || 'Europe/Sofia'
    }
  },

  // Communication services
  communication: {
    email: {
      sendgrid: {
        apiKey: process.env.SENDGRID_API_KEY,
        fromEmail: process.env.SENDGRID_FROM_EMAIL || 'noreply@servicetextpro.bg',
        fromName: process.env.SENDGRID_FROM_NAME || 'ServiceText Pro'
      }
    },
    sms: {
      mobica: {
        username: process.env.MOBICA_USERNAME,
        password: process.env.MOBICA_PASSWORD,
        senderId: process.env.MOBICA_SENDER_ID || 'MaystorFix'
      }
    },
    push: {
      fcm: {
        serverKey: process.env.FCM_SERVER_KEY
      },
      apns: {
        keyId: process.env.APNS_KEY_ID,
        teamId: process.env.APNS_TEAM_ID
      }
    }
  },

  // Feature flags
  features: {
    aiConversations: process.env.ENABLE_AI_CONVERSATIONS === 'true',
    sofiaTrafficIntegration: process.env.ENABLE_SOFIA_TRAFFIC_INTEGRATION === 'true',
    certificationValidation: process.env.ENABLE_CERTIFICATION_VALIDATION === 'true',
    marketIntelligence: process.env.ENABLE_MARKET_INTELLIGENCE === 'true',
    advancedAnalytics: process.env.ENABLE_ADVANCED_ANALYTICS === 'true',
    swagger: process.env.ENABLE_SWAGGER === 'true'
  },

  // Logging configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    fileMaxSize: parseInt(process.env.LOG_FILE_MAX_SIZE || '5242880', 10), // 5MB
    fileMaxFiles: parseInt(process.env.LOG_FILE_MAX_FILES || '20', 10),
    gdprAuditRetentionYears: parseInt(process.env.GDPR_AUDIT_LOG_RETENTION_YEARS || '7', 10)
  },

  // File upload configuration
  upload: {
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '5242880', 10), // 5MB
    allowedTypes: process.env.ALLOWED_FILE_TYPES?.split(',') || ['image/jpeg', 'image/png', 'application/pdf'],
    uploadPath: process.env.UPLOAD_PATH || 'uploads/'
  },

  // Caching configuration
  cache: {
    ttlSeconds: parseInt(process.env.CACHE_TTL_SECONDS || '300', 10), // 5 minutes
    maxKeys: parseInt(process.env.CACHE_MAX_KEYS || '1000', 10)
  },

  // Monitoring and analytics
  monitoring: {
    sentry: {
      dsn: process.env.SENTRY_DSN,
      environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV
    },
    analytics: {
      enabled: process.env.ANALYTICS_ENABLED === 'true',
      anonymizeIp: process.env.ANALYTICS_ANONYMIZE_IP === 'true',
      respectDnt: process.env.ANALYTICS_RESPECT_DNT === 'true'
    }
  }
};

// Validate GDPR configuration
export const validateGDPRConfig = (): boolean => {
  if (!config.gdpr.enabled) {
    return true; // GDPR validation skipped
  }

  const errors: string[] = [];

  // Validate DPO contact information
  if (!config.gdpr.dpo.email || !config.gdpr.dpo.email.includes('@')) {
    errors.push('Invalid DPO email address');
  }

  // Validate data retention periods
  if (config.gdpr.dataRetention.conversationMonths < 1 || config.gdpr.dataRetention.conversationMonths > 120) {
    errors.push('Conversation retention period must be between 1 and 120 months');
  }

  // Validate compliance URLs
  const urls = [
    config.gdpr.urls.privacyPolicy,
    config.gdpr.urls.termsOfService,
    config.gdpr.urls.cookiePolicy
  ];

  for (const url of urls) {
    try {
      new URL(url);
    } catch {
      errors.push(`Invalid GDPR compliance URL: ${url}`);
    }
  }

  if (errors.length > 0) {
    throw new Error(`GDPR configuration validation failed: ${errors.join(', ')}`);
  }

  return true;
};

// Validate database configuration
export const validateDatabaseConfig = (): boolean => {
  const errors: string[] = [];

  // PostgreSQL validation
  if (!config.database.postgresql.host || !config.database.postgresql.database) {
    errors.push('PostgreSQL configuration incomplete');
  }

  // MongoDB validation
  try {
    new URL(config.database.mongodb.uri);
  } catch {
    errors.push('Invalid MongoDB URI');
  }

  // Redis validation
  if (!config.database.redis.host || config.database.redis.port < 1 || config.database.redis.port > 65535) {
    errors.push('Invalid Redis configuration');
  }

  if (errors.length > 0) {
    throw new Error(`Database configuration validation failed: ${errors.join(', ')}`);
  }

  return true;
};

// Initialize and validate configuration
export const initializeConfig = (): void => {
  try {
    validateDatabaseConfig();
    validateGDPRConfig();
    console.log('✅ Configuration validated successfully');
  } catch (error) {
    console.error('❌ Configuration validation failed:', error);
    process.exit(1);
  }
};

export default config;
