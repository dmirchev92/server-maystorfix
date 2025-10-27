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
exports.DatabaseManager = void 0;
const PostgreSQLModels_1 = require("../models/PostgreSQLModels");
const MongoDBModels_1 = require("../models/MongoDBModels");
const RedisModels_1 = require("../models/RedisModels");
const config_1 = __importDefault(require("../utils/config"));
const logger_1 = __importStar(require("../utils/logger"));
const types_1 = require("../types");
class DatabaseManager {
    constructor() {
        this.isInitialized = false;
        this.postgresql = new PostgreSQLModels_1.PostgreSQLDatabase();
        this.mongodb = new MongoDBModels_1.MongoDBDatabase();
        this.redis = new RedisModels_1.RedisDatabase();
    }
    async initialize() {
        try {
            logger_1.default.info('Initializing database connections...');
            await Promise.all([
                this.postgresql.initialize(),
                this.mongodb.connect(),
                this.redis.connect()
            ]);
            if (config_1.default.gdpr.compliance.autoDeleteExpiredData) {
                this.setupAutomatedCleanup();
            }
            this.isInitialized = true;
            logger_1.default.info('All database connections initialized successfully');
            logger_1.gdprLogger.logDataAccess('system', 'database_initialization', 'system_startup');
        }
        catch (error) {
            logger_1.default.error('Failed to initialize databases', { error: error.message });
            throw new types_1.ServiceTextProError('Database initialization failed', 'DATABASE_INIT_ERROR', 503);
        }
    }
    setupAutomatedCleanup() {
        this.cleanupInterval = setInterval(async () => {
            try {
                await this.runDataCleanup();
            }
            catch (error) {
                logger_1.default.error('Automated data cleanup failed', { error: error.message });
            }
        }, 24 * 60 * 60 * 1000);
        logger_1.default.info('Automated GDPR data cleanup scheduled');
    }
    async createUser(user) {
        try {
            const userId = await this.postgresql.createUser(null, user);
            await this.redis.cacheUser({ ...user, id: userId });
            logger_1.gdprLogger.logDataAccess(userId, 'user_creation', 'account_registration');
            logger_1.default.info('User created successfully', { userId });
            return userId;
        }
        catch (error) {
            logger_1.default.error('Failed to create user', { error: error.message });
            throw error;
        }
    }
    async findUserByEmail(email) {
        try {
            const cachedUserId = await this.redis.getCachedUserByEmail(email);
            if (cachedUserId) {
                const cachedUser = await this.redis.getCachedUser(cachedUserId);
                if (cachedUser) {
                    const fullUser = await this.postgresql.findUserById(cachedUserId);
                    if (fullUser) {
                        return fullUser;
                    }
                }
            }
            const user = await this.postgresql.findUserByEmail(email);
            if (user) {
                await this.redis.cacheUser(user);
            }
            return user;
        }
        catch (error) {
            logger_1.default.error('Failed to find user by email', { error: error.message });
            throw error;
        }
    }
    async findUserById(id) {
        try {
            const cachedUser = await this.redis.getCachedUser(id);
            if (cachedUser) {
                const fullUser = await this.postgresql.findUserById(id);
                if (fullUser) {
                    return fullUser;
                }
            }
            const user = await this.postgresql.findUserById(id);
            if (user) {
                await this.redis.cacheUser(user);
            }
            return user;
        }
        catch (error) {
            logger_1.default.error('Failed to find user by ID', { error: error.message });
            throw error;
        }
    }
    async updateUser(user) {
        try {
            await this.postgresql.updateUser(user);
            await this.redis.cacheUser(user);
            logger_1.gdprLogger.logDataAccess(user.id, 'user_update', 'profile_modification');
            logger_1.default.info('User updated successfully', { userId: user.id });
        }
        catch (error) {
            logger_1.default.error('Failed to update user', { error: error.message });
            throw error;
        }
    }
    async deleteUser(userId) {
        try {
            const user = await this.postgresql.findUserById(userId);
            if (user) {
                user.status = 'deleted';
                user.updatedAt = new Date();
                await this.postgresql.updateUser(user);
            }
            await this.redis.invalidateUserCache(userId, user?.email);
            await this.redis.invalidateAllUserSessions(userId);
            logger_1.gdprLogger.logPrivacyRightRequest(userId, 'DATA_ERASURE', 'COMPLETED');
            logger_1.default.info('User deleted (GDPR erasure)', { userId });
        }
        catch (error) {
            logger_1.default.error('Failed to delete user', { error: error.message });
            throw error;
        }
    }
    async createConversation(conversation) {
        try {
            const conversationId = await this.mongodb.createConversation(conversation);
            await this.redis.setConversationState(conversation.id, {
                conversationId: conversation.id,
                businessId: conversation.businessId,
                customerPhone: conversation.customerPhoneNumber,
                platform: conversation.platform,
                state: conversation.state,
                lastActivity: Date.now(),
                contextData: {},
                aiAnalysisInProgress: false
            });
            await this.redis.publishRealtimeUpdate('conversation:updates', {
                type: 'conversation_created',
                conversationId: conversation.id,
                businessId: conversation.businessId
            });
            logger_1.default.info('Conversation created', { conversationId: conversation.id });
            return conversationId;
        }
        catch (error) {
            logger_1.default.error('Failed to create conversation', { error: error.message });
            throw error;
        }
    }
    async findConversationById(id) {
        try {
            const conversation = await this.mongodb.findConversationById(id);
            if (!conversation)
                return null;
            const state = await this.redis.getConversationState(id);
            if (state) {
                return {
                    ...conversation,
                    state: state.state || conversation.state
                };
            }
            return conversation;
        }
        catch (error) {
            logger_1.default.error('Failed to find conversation', { error: error.message });
            throw error;
        }
    }
    async getBusinessMetrics(businessId, startDate, endDate) {
        try {
            const cacheKey = `business:${businessId}:${startDate.getTime()}:${endDate.getTime()}`;
            const cached = await this.redis.getCachedAnalytics(cacheKey);
            if (cached) {
                return cached;
            }
            const metrics = await this.mongodb.getBusinessMetrics(businessId, startDate, endDate);
            await this.redis.cacheAnalytics(cacheKey, metrics, 300);
            return metrics;
        }
        catch (error) {
            logger_1.default.error('Failed to get business metrics', { error: error.message });
            throw error;
        }
    }
    async createSession(sessionData) {
        try {
            await this.redis.createSession(sessionData);
        }
        catch (error) {
            logger_1.default.error('Failed to create session', { error: error.message });
            throw error;
        }
    }
    async getSession(sessionId) {
        try {
            return await this.redis.getSession(sessionId);
        }
        catch (error) {
            logger_1.default.error('Failed to get session', { error: error.message });
            throw error;
        }
    }
    async invalidateSession(sessionId) {
        try {
            await this.redis.invalidateSession(sessionId);
        }
        catch (error) {
            logger_1.default.error('Failed to invalidate session', { error: error.message });
        }
    }
    async setPasswordResetToken(userId, token) {
        try {
            await Promise.all([
                this.postgresql.savePasswordResetToken(userId, token, new Date(Date.now() + 3600000)),
                this.redis.setPasswordResetToken(userId, token, 3600)
            ]);
        }
        catch (error) {
            logger_1.default.error('Failed to set password reset token', { error: error.message });
            throw error;
        }
    }
    async validatePasswordResetToken(token) {
        try {
            const redisResult = await this.redis.getPasswordResetToken(token);
            if (redisResult) {
                return redisResult;
            }
            return await this.postgresql.validatePasswordResetToken(token);
        }
        catch (error) {
            logger_1.default.error('Failed to validate password reset token', { error: error.message });
            return null;
        }
    }
    async checkRateLimit(identifier, windowMs, maxRequests) {
        try {
            return await this.redis.checkRateLimit(identifier, windowMs, maxRequests);
        }
        catch (error) {
            logger_1.default.error('Rate limit check failed', { error: error.message });
            return { allowed: true, remaining: maxRequests, resetTime: Date.now() + windowMs };
        }
    }
    async runDataCleanup() {
        const startTime = Date.now();
        try {
            logger_1.default.info('Starting GDPR data cleanup...');
            const [postgresqlResult, mongodbResult, redisResult] = await Promise.all([
                this.postgresql.cleanupExpiredData(),
                this.mongodb.cleanupExpiredData(),
                this.redis.cleanupExpiredData()
            ]);
            const totalCleaned = postgresqlResult.deletedRecords +
                mongodbResult.deletedRecords +
                mongodbResult.anonymizedRecords +
                redisResult.deletedKeys;
            const cleanupTime = Date.now() - startTime;
            const result = {
                postgresql: postgresqlResult,
                mongodb: mongodbResult,
                redis: redisResult,
                totalCleaned,
                cleanupTime
            };
            logger_1.gdprLogger.logDataRetention('automated_cleanup', 'COMPLETED', totalCleaned);
            logger_1.default.info('GDPR data cleanup completed', {
                totalCleaned,
                cleanupTime,
                details: result
            });
            return result;
        }
        catch (error) {
            logger_1.default.error('GDPR data cleanup failed', { error: error.message });
            throw error;
        }
    }
    async healthCheck() {
        try {
            const [postgresqlHealth, mongodbHealth, redisHealth] = await Promise.all([
                this.postgresql.healthCheck().catch(error => ({ status: 'unhealthy', error: error.message })),
                this.mongodb.healthCheck().catch(error => ({ status: 'unhealthy', error: error.message })),
                this.redis.healthCheck().catch(error => ({ status: 'unhealthy', error: error.message }))
            ]);
            const healthStatuses = [postgresqlHealth.status, mongodbHealth.status, redisHealth.status];
            const healthyCount = healthStatuses.filter(status => status === 'healthy').length;
            let overall;
            if (healthyCount === 3) {
                overall = 'healthy';
            }
            else if (healthyCount >= 2) {
                overall = 'degraded';
            }
            else {
                overall = 'unhealthy';
            }
            return {
                postgresql: postgresqlHealth,
                mongodb: mongodbHealth,
                redis: redisHealth,
                overall
            };
        }
        catch (error) {
            logger_1.default.error('Database health check failed', { error: error.message });
            return {
                postgresql: { status: 'unhealthy', error: error.message },
                mongodb: { status: 'unhealthy', error: error.message },
                redis: { status: 'unhealthy', error: error.message },
                overall: 'unhealthy'
            };
        }
    }
    async shutdown() {
        try {
            logger_1.default.info('Shutting down database connections...');
            if (this.cleanupInterval) {
                clearInterval(this.cleanupInterval);
            }
            await Promise.all([
                this.postgresql.close(),
                this.mongodb.close(),
                this.redis.close()
            ]);
            this.isInitialized = false;
            logger_1.default.info('All database connections closed');
        }
        catch (error) {
            logger_1.default.error('Error during database shutdown', { error: error.message });
            throw error;
        }
    }
    get initialized() {
        return this.isInitialized;
    }
    get databases() {
        return {
            postgresql: this.postgresql,
            mongodb: this.mongodb,
            redis: this.redis
        };
    }
}
exports.DatabaseManager = DatabaseManager;
//# sourceMappingURL=DatabaseManager.js.map