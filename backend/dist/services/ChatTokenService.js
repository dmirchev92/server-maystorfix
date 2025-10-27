"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatTokenService = void 0;
const uuid_1 = require("uuid");
const DatabaseFactory_1 = require("../models/DatabaseFactory");
const logger_1 = __importDefault(require("../utils/logger"));
const types_1 = require("../types");
class ChatTokenService {
    generateId() {
        return (0, uuid_1.v4)();
    }
    constructor() {
        this.expirationDays = 7;
        this.database = DatabaseFactory_1.DatabaseFactory.getDatabase();
    }
    async initializeForUser(userId) {
        try {
            let spIdentifier = await this.getOrCreateServiceProviderIdentifier(userId);
            if (!spIdentifier) {
                throw new types_1.ServiceTextProError('Failed to get or create SP identifier', 'SP_IDENTIFIER_FAILED', 500);
            }
            let currentToken = await this.getCurrentUnusedToken(userId, spIdentifier);
            if (!currentToken) {
                currentToken = await this.generateNewToken(userId, spIdentifier);
            }
            logger_1.default.info('Chat token system initialized', {
                userId,
                spIdentifier,
                currentToken: currentToken.substring(0, 4) + '****'
            });
            return { spIdentifier, currentToken };
        }
        catch (error) {
            logger_1.default.error('Failed to initialize chat token system', { userId, error });
            throw error;
        }
    }
    async getOrCreateServiceProviderIdentifier(userId) {
        try {
            const result = await new Promise((resolve, reject) => {
                this.database.db.all('SELECT identifier FROM service_provider_identifiers WHERE user_id = ?', [userId], (err, rows) => {
                    if (err)
                        reject(err);
                    else
                        resolve(rows || []);
                });
            });
            if (result.length > 0) {
                return result[0].identifier;
            }
            else {
                return await this.createServiceProviderIdentifier(userId);
            }
        }
        catch (error) {
            logger_1.default.error('Failed to get or create SP identifier', { userId, error });
            throw new types_1.ServiceTextProError('Failed to get or create SP identifier', 'SP_IDENTIFIER_FAILED', 500);
        }
    }
    async createServiceProviderIdentifier(userId) {
        let identifier;
        let attempts = 0;
        const maxAttempts = 10;
        do {
            identifier = this.generateServiceProviderIdentifier();
            attempts++;
            const existing = await new Promise((resolve, reject) => {
                this.database.db.all('SELECT id FROM service_provider_identifiers WHERE identifier = ?', [identifier], (err, rows) => {
                    if (err)
                        reject(err);
                    else
                        resolve(rows || []);
                });
            });
            if (existing.length === 0) {
                await new Promise((resolve, reject) => {
                    this.database.db.run('INSERT INTO service_provider_identifiers (id, user_id, identifier) VALUES (?, ?, ?)', [this.generateId(), userId, identifier], (err) => {
                        if (err)
                            reject(err);
                        else
                            resolve();
                    });
                });
                logger_1.default.info('Created SP identifier', { userId, identifier });
                return identifier;
            }
        } while (attempts < maxAttempts);
        throw new types_1.ServiceTextProError('Failed to generate unique SP identifier', 'IDENTIFIER_GENERATION_FAILED', 500);
    }
    generateServiceProviderIdentifier() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let identifier = '';
        for (let i = 0; i < 3; i++) {
            identifier += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return identifier + '_';
    }
    async getCurrentUnusedToken(userId, spIdentifier) {
        try {
            const result = await new Promise((resolve, reject) => {
                this.database.db.all('SELECT token FROM chat_tokens WHERE sp_identifier = ? AND is_used = FALSE AND expires_at > CURRENT_TIMESTAMP ORDER BY created_at DESC LIMIT 1', [spIdentifier], (err, rows) => {
                    if (err)
                        reject(err);
                    else
                        resolve(rows || []);
                });
            });
            return result.length > 0 ? result[0].token : null;
        }
        catch (error) {
            logger_1.default.error('Failed to get current unused token', { userId, error });
            return null;
        }
    }
    async generateNewToken(userId, spIdentifier) {
        const token = this.generateSecureToken();
        const expiresAt = new Date(Date.now() + this.expirationDays * 24 * 60 * 60 * 1000);
        try {
            await new Promise((resolve, reject) => {
                this.database.db.run('INSERT INTO chat_tokens (id, user_id, sp_identifier, token, is_used, expires_at) VALUES (?, ?, ?, ?, FALSE, CURRENT_TIMESTAMP + INTERVAL \'7 days\')', [this.generateId(), userId, spIdentifier, token], (err) => {
                    if (err)
                        reject(err);
                    else
                        resolve();
                });
            });
            logger_1.default.info('Generated new chat token', {
                userId,
                spIdentifier,
                token: token.substring(0, 4) + '****',
                expiresAt
            });
            return token;
        }
        catch (error) {
            logger_1.default.error('Failed to generate new token', { userId, error });
            throw new types_1.ServiceTextProError('Failed to generate chat token', 'TOKEN_GENERATION_FAILED', 500);
        }
    }
    generateSecureToken() {
        const crypto = require('crypto');
        const randomBytes = crypto.randomBytes(12);
        let token = '';
        const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        for (let i = 0; i < randomBytes.length; i++) {
            token += chars[randomBytes[i] % chars.length];
        }
        return token.substring(0, 12);
    }
    async validateAndUseToken(spIdentifier, token) {
        try {
            const result = await new Promise((resolve, reject) => {
                this.database.db.all(`SELECT * FROM chat_tokens 
           WHERE sp_identifier = ? AND token = ?`, [spIdentifier, token], (err, rows) => {
                    if (err) {
                        logger_1.default.error('SQL error in validateAndUseToken', {
                            error: err,
                            spIdentifier,
                            token: token.substring(0, 4) + '****',
                            query: 'SELECT * FROM chat_tokens WHERE sp_identifier = ? AND token = ?',
                            params: [spIdentifier, token.substring(0, 4) + '****']
                        });
                        reject(err);
                    }
                    else {
                        logger_1.default.info('Query result', { foundRows: rows.length, firstRow: rows[0] });
                        resolve(rows || []);
                    }
                });
            });
            if (result.length === 0) {
                return { isValid: false, error: 'Token not found' };
            }
            const tokenData = result[0];
            if (tokenData.is_used) {
                return { isValid: false, error: 'Token already used' };
            }
            if (new Date(tokenData.expires_at) < new Date()) {
                return { isValid: false, error: 'Token expired' };
            }
            const conversationId = (0, uuid_1.v4)();
            const sessionId = (0, uuid_1.v4)();
            await new Promise((resolve, reject) => {
                this.database.db.run('UPDATE chat_tokens SET is_used = TRUE, used_at = CURRENT_TIMESTAMP, conversation_id = ? WHERE sp_identifier = ? AND token = ?', [conversationId, spIdentifier, token], (err) => {
                    if (err)
                        reject(err);
                    else
                        resolve();
                });
            });
            await new Promise((resolve, reject) => {
                this.database.db.run('INSERT INTO marketplace_conversations (id, provider_id, customer_name, customer_email, customer_phone, status, created_at, last_message_at) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)', [conversationId, tokenData.user_id, 'Chat Customer', '', '', 'active'], (err) => {
                    if (err)
                        reject(err);
                    else
                        resolve();
                });
            });
            await new Promise((resolve, reject) => {
                this.database.db.run('INSERT INTO chat_sessions (session_id, conversation_id, user_id, sp_identifier) VALUES (?, ?, ?, ?)', [sessionId, conversationId, tokenData.user_id, spIdentifier], (err) => {
                    if (err)
                        reject(err);
                    else
                        resolve();
                });
            });
            await this.generateNewToken(tokenData.user_id, spIdentifier);
            logger_1.default.info('Token validated and used', {
                userId: tokenData.user_id,
                spIdentifier,
                token: token.substring(0, 4) + '****',
                conversationId,
                sessionId
            });
            return {
                isValid: true,
                userId: tokenData.user_id,
                conversationId,
                sessionId
            };
        }
        catch (error) {
            logger_1.default.error('Failed to validate token', { spIdentifier, token: token.substring(0, 4) + '****', error });
            return { isValid: false, error: 'Internal server error' };
        }
    }
    async validateSession(sessionId) {
        try {
            const result = await new Promise((resolve, reject) => {
                this.database.db.all('SELECT * FROM chat_sessions WHERE session_id = ?', [sessionId], (err, rows) => {
                    if (err) {
                        logger_1.default.error('SQL error in validateSession', { error: err, sessionId });
                        reject(err);
                    }
                    else {
                        resolve(rows || []);
                    }
                });
            });
            if (result.length === 0) {
                return { isValid: false, error: 'Session not found' };
            }
            const sessionData = result[0];
            await new Promise((resolve, reject) => {
                this.database.db.run('UPDATE chat_sessions SET last_accessed_at = CURRENT_TIMESTAMP WHERE session_id = ?', [sessionId], (err) => {
                    if (err)
                        reject(err);
                    else
                        resolve();
                });
            });
            logger_1.default.info('Session validated', {
                sessionId,
                userId: sessionData.user_id,
                conversationId: sessionData.conversation_id,
                spIdentifier: sessionData.sp_identifier
            });
            return {
                isValid: true,
                userId: sessionData.user_id,
                conversationId: sessionData.conversation_id,
                spIdentifier: sessionData.sp_identifier
            };
        }
        catch (error) {
            logger_1.default.error('Failed to validate session', { sessionId, error });
            return { isValid: false, error: 'Internal server error' };
        }
    }
    async getChatUrlForUser(userId, baseUrl) {
        const { spIdentifier, currentToken } = await this.initializeForUser(userId);
        const url = baseUrl || process.env.FRONTEND_URL || 'https://maystorfix.com';
        return `${url}/u/${spIdentifier}/c/${currentToken}`;
    }
    async getCurrentTokenForSMS(userId) {
        const spIdentifier = await this.getOrCreateServiceProviderIdentifier(userId);
        if (!spIdentifier) {
            throw new types_1.ServiceTextProError('Service provider not initialized', 'SP_NOT_INITIALIZED', 400);
        }
        const currentToken = await this.getCurrentUnusedToken(userId, spIdentifier);
        if (!currentToken) {
            return await this.generateNewToken(userId, spIdentifier);
        }
        return currentToken;
    }
    async forceRegenerateToken(userId) {
        try {
            const spIdentifier = await this.getOrCreateServiceProviderIdentifier(userId);
            if (!spIdentifier) {
                throw new types_1.ServiceTextProError('Service provider not initialized', 'SP_NOT_INITIALIZED', 400);
            }
            await new Promise((resolve, reject) => {
                this.database.db.run('UPDATE chat_tokens SET is_used = TRUE, used_at = CURRENT_TIMESTAMP WHERE user_id = ? AND sp_identifier = ? AND is_used = FALSE', [userId, spIdentifier], (err) => {
                    if (err)
                        reject(err);
                    else
                        resolve();
                });
            });
            const newToken = await this.generateNewToken(userId, spIdentifier);
            const chatUrl = await this.getChatUrlForUser(userId);
            logger_1.default.info('Token force regenerated', {
                userId,
                spIdentifier,
                newToken: newToken.substring(0, 4) + '****'
            });
            return { newToken, chatUrl };
        }
        catch (error) {
            logger_1.default.error('Failed to force regenerate token', { userId, error });
            throw error;
        }
    }
    async cleanupExpiredTokens() {
        try {
            const result = await new Promise((resolve, reject) => {
                this.database.db.run(`DELETE FROM chat_tokens 
           WHERE expires_at < CURRENT_TIMESTAMP OR 
                 (is_used = TRUE AND used_at < CURRENT_TIMESTAMP - INTERVAL '1 day')`, (err) => {
                    if (err)
                        reject(err);
                    else
                        resolve({ changes: this.database.db.changes || 0 });
                });
            });
            const deletedCount = result.changes || 0;
            if (deletedCount > 0) {
                logger_1.default.info('Cleaned up expired tokens', { deletedCount });
            }
            return deletedCount;
        }
        catch (error) {
            logger_1.default.error('Failed to cleanup expired tokens', { error });
            return 0;
        }
    }
    async getTokenStats(userId) {
        try {
            const stats = await new Promise((resolve, reject) => {
                this.database.db.all(`SELECT 
             COUNT(*) as total_tokens,
             COUNT(CASE WHEN is_used = TRUE THEN 1 END) as used_tokens,
             COUNT(CASE WHEN is_used = FALSE AND expires_at > CURRENT_TIMESTAMP THEN 1 END) as active_tokens,
             COUNT(CASE WHEN expires_at < CURRENT_TIMESTAMP THEN 1 END) as expired_tokens
           FROM chat_tokens ct
           JOIN service_provider_identifiers spi ON ct.sp_identifier = spi.identifier
           WHERE spi.user_id = ?`, [userId], (err, rows) => {
                    if (err)
                        reject(err);
                    else
                        resolve(rows || []);
                });
            });
            return {
                totalGenerated: stats[0]?.total_tokens || 0,
                currentUnused: stats[0]?.active_tokens || 0,
                totalUsed: stats[0]?.used_tokens || 0,
                totalExpired: stats[0]?.expired_tokens || 0
            };
        }
        catch (error) {
            logger_1.default.error('Failed to get token stats', { userId, error });
            return { totalGenerated: 0, currentUnused: 0, totalUsed: 0, totalExpired: 0 };
        }
    }
}
exports.ChatTokenService = ChatTokenService;
//# sourceMappingURL=ChatTokenService.js.map