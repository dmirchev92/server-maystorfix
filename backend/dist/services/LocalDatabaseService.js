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
Object.defineProperty(exports, "__esModule", { value: true });
exports.LocalDatabaseService = void 0;
const LocalModels_1 = require("../models/LocalModels");
const logger_1 = __importStar(require("../utils/logger"));
const types_1 = require("../types");
class LocalDatabaseService {
    constructor() {
        this.isInitialized = false;
        this.database = new LocalModels_1.LocalDatabase();
    }
    async initialize() {
        try {
            logger_1.default.info('Initializing local PostgreSQL database...');
            await this.database.initialize();
            this.isInitialized = true;
            logger_1.default.info('Local database initialized successfully');
            logger_1.gdprLogger.logDataAccess('system', 'database_initialization', 'system_startup');
        }
        catch (error) {
            logger_1.default.error('Failed to initialize local database', { error: error.message });
            throw new types_1.ServiceTextProError('Local database initialization failed', 'DATABASE_INIT_ERROR', 503);
        }
    }
    async createUser(user) {
        try {
            const userId = await this.database.createUser(user);
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
            return await this.database.findUserByEmail(email);
        }
        catch (error) {
            logger_1.default.error('Failed to find user by email', { error: error.message });
            throw error;
        }
    }
    async findUserById(id) {
        try {
            return null;
        }
        catch (error) {
            logger_1.default.error('Failed to find user by ID', { error: error.message });
            throw error;
        }
    }
    async createConversation(conversation) {
        try {
            const conversationId = await this.database.createConversation(conversation);
            logger_1.default.info('Conversation created', { conversationId: conversation.id });
            return conversationId;
        }
        catch (error) {
            logger_1.default.error('Failed to create conversation', { error: error.message });
            throw error;
        }
    }
    async getBusinessMetrics(businessId, startDate, endDate) {
        try {
            return await this.database.getBusinessMetrics(businessId, startDate, endDate);
        }
        catch (error) {
            logger_1.default.error('Failed to get business metrics', { error: error.message });
            throw error;
        }
    }
    async createSession(sessionData) {
        try {
            await this.database.createSession(sessionData);
        }
        catch (error) {
            logger_1.default.error('Failed to create session', { error: error.message });
            throw error;
        }
    }
    async checkRateLimit(identifier, windowMs, maxRequests) {
        try {
            return {
                allowed: true,
                remaining: maxRequests,
                resetTime: Date.now() + windowMs
            };
        }
        catch (error) {
            logger_1.default.error('Rate limit check failed', { error: error.message });
            return { allowed: true, remaining: maxRequests, resetTime: Date.now() + windowMs };
        }
    }
    async healthCheck() {
        try {
            const dbHealth = await this.database.healthCheck();
            return {
                postgresql: {
                    status: dbHealth.status,
                    tables: dbHealth.tables
                },
                overall: dbHealth.status
            };
        }
        catch (error) {
            logger_1.default.error('Database health check failed', { error: error.message });
            return {
                postgresql: { status: 'unhealthy', error: error.message },
                overall: 'unhealthy'
            };
        }
    }
    async shutdown() {
        try {
            logger_1.default.info('Shutting down local database connection...');
            await this.database.close();
            this.isInitialized = false;
            logger_1.default.info('Local database connection closed');
        }
        catch (error) {
            logger_1.default.error('Error during database shutdown', { error: error.message });
            throw error;
        }
    }
    get initialized() {
        return this.isInitialized;
    }
    get db() {
        return this.database;
    }
}
exports.LocalDatabaseService = LocalDatabaseService;
//# sourceMappingURL=LocalDatabaseService.js.map