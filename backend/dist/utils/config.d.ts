import { DatabaseConfig, WhatsAppConfig, ViberConfig, TelegramConfig } from '../types';
export declare const config: {
    app: {
        name: string;
        version: string;
        environment: string;
        host: string;
        port: number;
        apiVersion: string;
        baseUrl: string;
    };
    security: {
        jwt: {
            secret: string;
            refreshSecret: string;
            expiresIn: string;
            refreshExpiresIn: string;
        };
        bcrypt: {
            rounds: number;
        };
        rateLimit: {
            windowMs: number;
            maxRequests: number;
        };
        cors: {
            enabled: boolean;
            origin: string[];
            credentials: boolean;
        };
        https: {
            enabled: boolean;
            keyPath: string;
            certPath: string;
            hstsMaxAge: number;
        };
        sms: {
            dailyLimit: number;
            rateLimitWindow: number;
            rateLimitMax: number;
            enableMonitoring: boolean;
            suspiciousThreshold: number;
        };
    };
    database: DatabaseConfig;
    integrations: {
        whatsapp: WhatsAppConfig;
        viber: ViberConfig;
        telegram: TelegramConfig;
        googleCloud: {
            projectId: string;
            keyFile: string;
        };
        azure: {
            textAnalyticsKey: string;
            textAnalyticsEndpoint: string;
        };
    };
    gdpr: {
        enabled: boolean;
        dpo: {
            email: string;
            phone: string;
            address: string;
        };
        dataRetention: {
            conversationMonths: number;
            businessDataMonths: number;
            analyticsMonths: number;
            auditLogMonths: number;
        };
        compliance: {
            autoDeleteExpiredData: boolean;
            consentRequiredForAnalytics: boolean;
            anonymizeExpiredData: boolean;
        };
        urls: {
            privacyPolicy: string;
            termsOfService: string;
            cookiePolicy: string;
            gdprContact: string;
        };
    };
    bulgarian: {
        businessRegistry: {
            apiUrl: string;
            apiKey: string;
        };
        sofiaTraffic: {
            apiUrl: string;
            apiKey: string;
        };
        holidays: {
            apiUrl: string;
            apiKey: string;
        };
        localization: {
            currency: string;
            locale: string;
            timezone: string;
        };
    };
    communication: {
        email: {
            sendgrid: {
                apiKey: string;
                fromEmail: string;
                fromName: string;
            };
        };
        sms: {
            twilio: {
                accountSid: string;
                authToken: string;
                phoneNumber: string;
            };
        };
        push: {
            fcm: {
                serverKey: string;
            };
            apns: {
                keyId: string;
                teamId: string;
            };
        };
    };
    features: {
        aiConversations: boolean;
        sofiaTrafficIntegration: boolean;
        certificationValidation: boolean;
        marketIntelligence: boolean;
        advancedAnalytics: boolean;
        swagger: boolean;
    };
    logging: {
        level: string;
        fileMaxSize: number;
        fileMaxFiles: number;
        gdprAuditRetentionYears: number;
    };
    upload: {
        maxFileSize: number;
        allowedTypes: string[];
        uploadPath: string;
    };
    cache: {
        ttlSeconds: number;
        maxKeys: number;
    };
    monitoring: {
        sentry: {
            dsn: string;
            environment: string;
        };
        analytics: {
            enabled: boolean;
            anonymizeIp: boolean;
            respectDnt: boolean;
        };
    };
};
export declare const validateGDPRConfig: () => boolean;
export declare const validateDatabaseConfig: () => boolean;
export declare const initializeConfig: () => void;
export default config;
//# sourceMappingURL=config.d.ts.map