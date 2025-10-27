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
exports.RedisDatabase = void 0;
const ioredis_1 = __importDefault(require("ioredis"));
const config_1 = __importDefault(require("../utils/config"));
const logger_1 = __importStar(require("../utils/logger"));
class RedisDatabase {
    constructor() {
        this.isConnected = false;
        this.prefixes = {
            USER_CACHE: 'user:cache:',
            USER_SESSION: 'session:',
            CONVERSATION_STATE: 'conv:state:',
            RATE_LIMIT: 'rate:',
            PASSWORD_RESET: 'pwd:reset:',
            EMAIL_VERIFICATION: 'email:verify:',
            ANALYTICS_CACHE: 'analytics:cache:',
            TEMPLATE_CACHE: 'template:cache:',
            BUSINESS_CACHE: 'business:cache:',
            REAL_TIME_DATA: 'realtime:',
            GDPR_PROCESSING: 'gdpr:process:',
            AI_ANALYSIS: 'ai:analysis:',
            NOTIFICATION_QUEUE: 'notify:queue:',
            WEBHOOK_CACHE: 'webhook:cache:'
        };
        const redisConfig = {
            host: config_1.default.database.redis.host,
            port: config_1.default.database.redis.port,
            password: config_1.default.database.redis.password,
            db: config_1.default.database.redis.db,
            maxRetriesPerRequest: 3,
            lazyConnect: true,
            keepAlive: 30000,
            family: 4
        };
        this.client = new ioredis_1.default(redisConfig);
        this.subscriber = new ioredis_1.default(redisConfig);
        this.publisher = new ioredis_1.default(redisConfig);
        this.setupEventHandlers();
    }
    setupEventHandlers() {
        this.client.on('connect', () => {
            this.isConnected = true;
            logger_1.default.info('Redis client connected');
        });
        this.client.on('error', (error) => {
            logger_1.default.error('Redis client error', { error: error.message });
            this.isConnected = false;
        });
        this.client.on('close', () => {
            this.isConnected = false;
            logger_1.default.info('Redis client connection closed');
        });
        this.subscriber.on('message', (channel, message) => {
            this.handleRealtimeMessage(channel, message);
        });
    }
    async connect() {
        try {
            await Promise.all([
                this.client.connect(),
                this.subscriber.connect(),
                this.publisher.connect()
            ]);
            await this.subscriber.subscribe('conversation:updates', 'user:notifications', 'system:alerts', 'analytics:realtime');
            this.isConnected = true;
            logger_1.default.info('Redis connected successfully');
        }
        catch (error) {
            logger_1.default.error('Failed to connect to Redis', { error: error.message });
            throw error;
        }
    }
    async cacheUser(user, ttlSeconds = 3600) {
        try {
            const cachedUser = {
                id: user.id,
                email: user.email,
                role: user.role,
                businessId: user.businessId,
                isGdprCompliant: user.isGdprCompliant,
                cachedAt: Date.now(),
                expiresAt: Date.now() + (ttlSeconds * 1000)
            };
            await this.client.setex(`${this.prefixes.USER_CACHE}${user.id}`, ttlSeconds, JSON.stringify(cachedUser));
            await this.client.setex(`${this.prefixes.USER_CACHE}email:${user.email}`, ttlSeconds, user.id);
            logger_1.default.debug('User cached successfully', { userId: user.id });
        }
        catch (error) {
            logger_1.default.error('Failed to cache user', { error: error.message, userId: user.id });
        }
    }
    async getCachedUser(userId) {
        try {
            const cached = await this.client.get(`${this.prefixes.USER_CACHE}${userId}`);
            if (!cached)
                return null;
            const user = JSON.parse(cached);
            if (user.expiresAt < Date.now()) {
                await this.client.del(`${this.prefixes.USER_CACHE}${userId}`);
                return null;
            }
            return user;
        }
        catch (error) {
            logger_1.default.error('Failed to get cached user', { error: error.message, userId });
            return null;
        }
    }
    async getCachedUserByEmail(email) {
        try {
            return await this.client.get(`${this.prefixes.USER_CACHE}email:${email}`);
        }
        catch (error) {
            logger_1.default.error('Failed to get cached user by email', { error: error.message, email });
            return null;
        }
    }
    async invalidateUserCache(userId, email) {
        try {
            const keys = [`${this.prefixes.USER_CACHE}${userId}`];
            if (email) {
                keys.push(`${this.prefixes.USER_CACHE}email:${email}`);
            }
            await this.client.del(...keys);
            logger_1.default.debug('User cache invalidated', { userId });
        }
        catch (error) {
            logger_1.default.error('Failed to invalidate user cache', { error: error.message, userId });
        }
    }
    async createSession(session) {
        try {
            const sessionKey = `${this.prefixes.USER_SESSION}${session.id}`;
            const ttl = Math.floor((session.expiresAt - Date.now()) / 1000);
            await this.client.setex(sessionKey, ttl, JSON.stringify(session));
            await this.client.sadd(`${this.prefixes.USER_SESSION}user:${session.userId}`, session.id);
            await this.client.expire(`${this.prefixes.USER_SESSION}user:${session.userId}`, ttl);
            logger_1.gdprLogger.logDataAccess(session.userId, 'session_creation', 'user_authentication', session.ipAddress);
            logger_1.default.debug('Session created', { sessionId: session.id, userId: session.userId });
        }
        catch (error) {
            logger_1.default.error('Failed to create session', { error: error.message, sessionId: session.id });
            throw error;
        }
    }
    async getSession(sessionId) {
        try {
            const session = await this.client.get(`${this.prefixes.USER_SESSION}${sessionId}`);
            if (!session)
                return null;
            const sessionData = JSON.parse(session);
            if (sessionData.expiresAt < Date.now()) {
                await this.invalidateSession(sessionId);
                return null;
            }
            sessionData.lastUsedAt = Date.now();
            await this.client.setex(`${this.prefixes.USER_SESSION}${sessionId}`, Math.floor((sessionData.expiresAt - Date.now()) / 1000), JSON.stringify(sessionData));
            return sessionData;
        }
        catch (error) {
            logger_1.default.error('Failed to get session', { error: error.message, sessionId });
            return null;
        }
    }
    async invalidateSession(sessionId) {
        try {
            const session = await this.client.get(`${this.prefixes.USER_SESSION}${sessionId}`);
            if (session) {
                const sessionData = JSON.parse(session);
                await this.client.srem(`${this.prefixes.USER_SESSION}user:${sessionData.userId}`, sessionId);
                logger_1.gdprLogger.logDataAccess(sessionData.userId, 'session_invalidation', 'user_logout');
            }
            await this.client.del(`${this.prefixes.USER_SESSION}${sessionId}`);
            logger_1.default.debug('Session invalidated', { sessionId });
        }
        catch (error) {
            logger_1.default.error('Failed to invalidate session', { error: error.message, sessionId });
        }
    }
    async invalidateAllUserSessions(userId) {
        try {
            const sessionIds = await this.client.smembers(`${this.prefixes.USER_SESSION}user:${userId}`);
            if (sessionIds.length > 0) {
                const sessionKeys = sessionIds.map(id => `${this.prefixes.USER_SESSION}${id}`);
                await this.client.del(...sessionKeys, `${this.prefixes.USER_SESSION}user:${userId}`);
                logger_1.gdprLogger.logDataAccess(userId, 'all_sessions_invalidation', 'security_action');
            }
            logger_1.default.debug('All user sessions invalidated', { userId, count: sessionIds.length });
        }
        catch (error) {
            logger_1.default.error('Failed to invalidate all user sessions', { error: error.message, userId });
        }
    }
    async checkRateLimit(identifier, windowMs, maxRequests) {
        try {
            const key = `${this.prefixes.RATE_LIMIT}${identifier}`;
            const now = Date.now();
            const windowStart = Math.floor(now / windowMs) * windowMs;
            const windowEnd = windowStart + windowMs;
            const current = await this.client.get(key);
            let rateLimitData;
            if (current) {
                rateLimitData = JSON.parse(current);
                if (rateLimitData.windowStart !== windowStart) {
                    rateLimitData = {
                        requests: 0,
                        windowStart,
                        windowEnd,
                        blocked: false
                    };
                }
            }
            else {
                rateLimitData = {
                    requests: 0,
                    windowStart,
                    windowEnd,
                    blocked: false
                };
            }
            const allowed = rateLimitData.requests < maxRequests;
            if (allowed) {
                rateLimitData.requests++;
            }
            else {
                rateLimitData.blocked = true;
            }
            const ttl = Math.ceil((windowEnd - now) / 1000);
            await this.client.setex(key, ttl, JSON.stringify(rateLimitData));
            return {
                allowed,
                remaining: Math.max(0, maxRequests - rateLimitData.requests),
                resetTime: windowEnd
            };
        }
        catch (error) {
            logger_1.default.error('Rate limit check failed', { error: error.message, identifier });
            return { allowed: true, remaining: maxRequests, resetTime: Date.now() + windowMs };
        }
    }
    async setConversationState(conversationId, state, ttlSeconds = 3600) {
        try {
            await this.client.setex(`${this.prefixes.CONVERSATION_STATE}${conversationId}`, ttlSeconds, JSON.stringify({
                ...state,
                lastActivity: Date.now()
            }));
            await this.publisher.publish('conversation:updates', JSON.stringify({
                type: 'state_updated',
                conversationId,
                state: state.state,
                timestamp: Date.now()
            }));
            logger_1.default.debug('Conversation state updated', { conversationId });
        }
        catch (error) {
            logger_1.default.error('Failed to set conversation state', { error: error.message, conversationId });
        }
    }
    async getConversationState(conversationId) {
        try {
            const state = await this.client.get(`${this.prefixes.CONVERSATION_STATE}${conversationId}`);
            return state ? JSON.parse(state) : null;
        }
        catch (error) {
            logger_1.default.error('Failed to get conversation state', { error: error.message, conversationId });
            return null;
        }
    }
    async setPasswordResetToken(userId, token, ttlSeconds = 3600) {
        try {
            await this.client.setex(`${this.prefixes.PASSWORD_RESET}${token}`, ttlSeconds, JSON.stringify({
                userId,
                token,
                createdAt: Date.now(),
                expiresAt: Date.now() + (ttlSeconds * 1000)
            }));
            logger_1.default.debug('Password reset token created', { userId, token: token.substring(0, 8) + '...' });
        }
        catch (error) {
            logger_1.default.error('Failed to set password reset token', { error: error.message, userId });
        }
    }
    async getPasswordResetToken(token) {
        try {
            const data = await this.client.get(`${this.prefixes.PASSWORD_RESET}${token}`);
            if (!data)
                return null;
            const tokenData = JSON.parse(data);
            if (tokenData.expiresAt < Date.now()) {
                await this.client.del(`${this.prefixes.PASSWORD_RESET}${token}`);
                return null;
            }
            return { userId: tokenData.userId };
        }
        catch (error) {
            logger_1.default.error('Failed to get password reset token', { error: error.message });
            return null;
        }
    }
    async invalidatePasswordResetToken(token) {
        try {
            await this.client.del(`${this.prefixes.PASSWORD_RESET}${token}`);
            logger_1.default.debug('Password reset token invalidated');
        }
        catch (error) {
            logger_1.default.error('Failed to invalidate password reset token', { error: error.message });
        }
    }
    async cacheAnalytics(key, data, ttlSeconds = 300) {
        try {
            await this.client.setex(`${this.prefixes.ANALYTICS_CACHE}${key}`, ttlSeconds, JSON.stringify({
                data,
                cachedAt: Date.now(),
                expiresAt: Date.now() + (ttlSeconds * 1000)
            }));
        }
        catch (error) {
            logger_1.default.error('Failed to cache analytics', { error: error.message, key });
        }
    }
    async getCachedAnalytics(key) {
        try {
            const cached = await this.client.get(`${this.prefixes.ANALYTICS_CACHE}${key}`);
            if (!cached)
                return null;
            const cacheData = JSON.parse(cached);
            if (cacheData.expiresAt < Date.now()) {
                await this.client.del(`${this.prefixes.ANALYTICS_CACHE}${key}`);
                return null;
            }
            return cacheData.data;
        }
        catch (error) {
            logger_1.default.error('Failed to get cached analytics', { error: error.message, key });
            return null;
        }
    }
    async publishRealtimeUpdate(channel, data) {
        try {
            await this.publisher.publish(channel, JSON.stringify({
                ...data,
                timestamp: Date.now()
            }));
        }
        catch (error) {
            logger_1.default.error('Failed to publish real-time update', { error: error.message, channel });
        }
    }
    handleRealtimeMessage(channel, message) {
        try {
            const data = JSON.parse(message);
            switch (channel) {
                case 'conversation:updates':
                    this.handleConversationUpdate(data);
                    break;
                case 'user:notifications':
                    this.handleUserNotification(data);
                    break;
                case 'system:alerts':
                    this.handleSystemAlert(data);
                    break;
                case 'analytics:realtime':
                    this.handleAnalyticsUpdate(data);
                    break;
            }
        }
        catch (error) {
            logger_1.default.error('Failed to handle real-time message', { error: error.message, channel });
        }
    }
    handleConversationUpdate(data) {
        logger_1.default.debug('Conversation update received', { conversationId: data.conversationId });
    }
    handleUserNotification(data) {
        logger_1.default.debug('User notification received', { userId: data.userId });
    }
    handleSystemAlert(data) {
        logger_1.default.info('System alert received', { type: data.type, severity: data.severity });
    }
    handleAnalyticsUpdate(data) {
        logger_1.default.debug('Analytics update received', { type: data.type });
    }
    async cleanupExpiredData() {
        try {
            let deletedKeys = 0;
            const patterns = [
                `${this.prefixes.USER_CACHE}*`,
                `${this.prefixes.USER_SESSION}*`,
                `${this.prefixes.PASSWORD_RESET}*`,
                `${this.prefixes.EMAIL_VERIFICATION}*`,
                `${this.prefixes.ANALYTICS_CACHE}*`
            ];
            for (const pattern of patterns) {
                const keys = await this.client.keys(pattern);
                for (const key of keys) {
                    const ttl = await this.client.ttl(key);
                    if (ttl === -1) {
                        const data = await this.client.get(key);
                        if (data) {
                            try {
                                const parsed = JSON.parse(data);
                                if (parsed.expiresAt && parsed.expiresAt < Date.now()) {
                                    await this.client.del(key);
                                    deletedKeys++;
                                }
                            }
                            catch {
                            }
                        }
                    }
                }
            }
            logger_1.default.info('Redis data cleanup completed', { deletedKeys });
            return { deletedKeys };
        }
        catch (error) {
            logger_1.default.error('Failed to cleanup Redis data', { error: error.message });
            return { deletedKeys: 0 };
        }
    }
    async healthCheck() {
        try {
            const info = await this.client.info('memory');
            const connections = await this.client.info('clients');
            const memoryMatch = info.match(/used_memory_human:(.+)/);
            const connectionsMatch = connections.match(/connected_clients:(\d+)/);
            return {
                status: 'healthy',
                memory: memoryMatch ? memoryMatch[1].trim() : 'unknown',
                connections: connectionsMatch ? parseInt(connectionsMatch[1]) : 0
            };
        }
        catch (error) {
            return {
                status: 'unhealthy',
                memory: 'unknown',
                connections: 0
            };
        }
    }
    async close() {
        await Promise.all([
            this.client.disconnect(),
            this.subscriber.disconnect(),
            this.publisher.disconnect()
        ]);
        this.isConnected = false;
        logger_1.default.info('Redis connections closed');
    }
    get connected() {
        return this.isConnected;
    }
}
exports.RedisDatabase = RedisDatabase;
//# sourceMappingURL=RedisModels.js.map