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
exports.MongoDBDatabase = void 0;
const mongodb_1 = require("mongodb");
const config_1 = __importDefault(require("../utils/config"));
const logger_1 = __importStar(require("../utils/logger"));
const types_1 = require("../types");
class MongoDBDatabase {
    constructor() {
        this.isConnected = false;
        this.client = new mongodb_1.MongoClient(config_1.default.database.mongodb.uri, {
            maxPoolSize: config_1.default.database.mongodb.maxPoolSize,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
        });
    }
    async connect() {
        try {
            await this.client.connect();
            this.db = this.client.db(config_1.default.database.mongodb.database);
            this.conversations = this.db.collection('conversations');
            this.analyticsEvents = this.db.collection('analytics_events');
            this.messageTemplates = this.db.collection('message_templates');
            this.systemLogs = this.db.collection('system_logs');
            await this.createIndexes();
            await this.seedInitialData();
            this.isConnected = true;
            logger_1.default.info('MongoDB connected successfully');
            this.client.on('serverHeartbeatSucceeded', () => {
                this.isConnected = true;
            });
            this.client.on('serverHeartbeatFailed', () => {
                this.isConnected = false;
                logger_1.default.error('MongoDB heartbeat failed');
            });
        }
        catch (error) {
            logger_1.default.error('Failed to connect to MongoDB', { error: error.message });
            throw error;
        }
    }
    async createIndexes() {
        try {
            await this.conversations.createIndexes([
                { key: { businessId: 1 } },
                { key: { customerPhoneNumber: 1 } },
                { key: { state: 1 } },
                { key: { priority: 1 } },
                { key: { startedAt: -1 } },
                { key: { lastMessageAt: -1 } },
                { key: { gdprRetentionUntil: 1 } },
                { key: { platform: 1 } },
                { key: { businessId: 1, state: 1 } },
                { key: { businessId: 1, startedAt: -1 } }
            ]);
            await this.analyticsEvents.createIndexes([
                { key: { eventType: 1 } },
                { key: { userId: 1 } },
                { key: { businessId: 1 } },
                { key: { timestamp: -1 } },
                { key: { gdprRetentionUntil: 1 } },
                { key: { anonymized: 1 } },
                { key: { businessId: 1, eventType: 1 } },
                { key: { businessId: 1, timestamp: -1 } }
            ]);
            await this.messageTemplates.createIndexes([
                { key: { businessId: 1 } },
                { key: { category: 1 } },
                { key: { isActive: 1 } },
                { key: { language: 1 } },
                { key: { businessId: 1, category: 1 } },
                { key: { businessId: 1, isActive: 1 } }
            ]);
            await this.systemLogs.createIndexes([
                { key: { level: 1 } },
                { key: { timestamp: -1 } },
                { key: { service: 1 } },
                { key: { gdprRelevant: 1 } }
            ]);
            logger_1.default.info('MongoDB indexes created successfully');
        }
        catch (error) {
            logger_1.default.error('Failed to create MongoDB indexes', { error: error.message });
            throw error;
        }
    }
    async seedInitialData() {
        try {
            const templateCount = await this.messageTemplates.countDocuments();
            if (templateCount > 0) {
                logger_1.default.info('MongoDB already has data, skipping seed');
                return;
            }
            const defaultTemplates = [
                {
                    id: 'default-emergency-bg',
                    businessId: 'system',
                    name: 'Спешен отговор',
                    category: 'emergency',
                    title: 'Спешна ситуация - незабавен отговор',
                    content: 'Здравейте! Получих Вашето спешно съобщение. Ще се свържа с Вас в рамките на 15 минути. За критични аварии: {emergency_phone}',
                    variables: ['emergency_phone', 'technician_name'],
                    triggers: ['спешно', 'авария', 'парене', 'искри'],
                    conditions: { priority: 'emergency' },
                    isActive: true,
                    language: 'bg',
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    usageCount: 0
                },
                {
                    id: 'default-business-hours-bg',
                    businessId: 'system',
                    name: 'Работно време',
                    category: 'business_hours',
                    title: 'Отговор в работно време',
                    content: 'Здравейте! Благодаря за съобщението. Ще прегледам заявката Ви и ще се върна при Вас до {response_time} минути.',
                    variables: ['response_time', 'technician_name'],
                    triggers: [],
                    conditions: { business_hours: true },
                    isActive: true,
                    language: 'bg',
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    usageCount: 0
                },
                {
                    id: 'default-after-hours-bg',
                    businessId: 'system',
                    name: 'Извън работно време',
                    category: 'after_hours',
                    title: 'Отговор извън работно време',
                    content: 'Здравейте! Получих съобщението Ви извън работното ми време. Ще се свържа с Вас утре сутрин след {start_time}ч. За спешни случаи: {emergency_contact}',
                    variables: ['start_time', 'emergency_contact'],
                    triggers: [],
                    conditions: { business_hours: false },
                    isActive: true,
                    language: 'bg',
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    usageCount: 0
                }
            ];
            await this.messageTemplates.insertMany(defaultTemplates);
            logger_1.default.info('Default message templates created');
        }
        catch (error) {
            logger_1.default.error('Failed to seed MongoDB initial data', { error: error.message });
            throw error;
        }
    }
    async createConversation(conversation) {
        try {
            const result = await this.conversations.insertOne({
                ...conversation,
                createdAt: new Date(),
                updatedAt: new Date()
            });
            logger_1.gdprLogger.logDataAccess(conversation.businessId, 'conversation_creation', 'customer_communication');
            logger_1.default.info('Conversation created', {
                conversationId: conversation.id,
                businessId: conversation.businessId,
                platform: conversation.platform
            });
            return result.insertedId.toString();
        }
        catch (error) {
            logger_1.default.error('Failed to create conversation', { error: error.message });
            throw error;
        }
    }
    async findConversationById(id) {
        try {
            return await this.conversations.findOne({ id });
        }
        catch (error) {
            logger_1.default.error('Failed to find conversation', { error: error.message, conversationId: id });
            throw error;
        }
    }
    async findConversationsByBusiness(businessId, limit = 50, offset = 0) {
        try {
            return await this.conversations
                .find({ businessId })
                .sort({ lastMessageAt: -1 })
                .skip(offset)
                .limit(limit)
                .toArray();
        }
        catch (error) {
            logger_1.default.error('Failed to find conversations by business', {
                error: error.message,
                businessId
            });
            throw error;
        }
    }
    async updateConversation(id, update) {
        try {
            await this.conversations.updateOne({ id }, {
                $set: {
                    ...update,
                    updatedAt: new Date()
                }
            });
            logger_1.default.info('Conversation updated', { conversationId: id });
        }
        catch (error) {
            logger_1.default.error('Failed to update conversation', { error: error.message, conversationId: id });
            throw error;
        }
    }
    async addMessageToConversation(conversationId, message) {
        try {
            await this.conversations.updateOne({ id: conversationId }, {
                $push: { messages: message },
                $set: {
                    lastMessageAt: message.timestamp,
                    updatedAt: new Date()
                }
            });
            logger_1.default.info('Message added to conversation', {
                conversationId,
                messageId: message.id,
                direction: message.direction
            });
        }
        catch (error) {
            logger_1.default.error('Failed to add message to conversation', {
                error: error.message,
                conversationId,
                messageId: message.id
            });
            throw error;
        }
    }
    async createAnalyticsEvent(event) {
        try {
            await this.analyticsEvents.insertOne({
                ...event,
                createdAt: new Date()
            });
        }
        catch (error) {
            logger_1.default.error('Failed to create analytics event', { error: error.message });
            throw error;
        }
    }
    async getBusinessMetrics(businessId, startDate, endDate) {
        try {
            const pipeline = [
                {
                    $match: {
                        businessId,
                        timestamp: { $gte: startDate, $lte: endDate }
                    }
                },
                {
                    $group: {
                        _id: '$eventType',
                        count: { $sum: 1 },
                        data: { $push: '$data' }
                    }
                }
            ];
            const results = await this.analyticsEvents.aggregate(pipeline).toArray();
            const metrics = {
                businessId,
                period: { start: startDate, end: endDate },
                missedCalls: this.getEventCount(results, 'missed_call'),
                responsesSent: this.getEventCount(results, 'response_sent'),
                conversationsStarted: this.getEventCount(results, 'conversation_started'),
                conversationsCompleted: this.getEventCount(results, 'conversation_completed'),
                conversionRate: this.calculateConversionRate(results),
                averageResponseTime: this.calculateAverageResponseTime(results),
                platformBreakdown: this.calculatePlatformBreakdown(results),
            };
            return metrics;
        }
        catch (error) {
            logger_1.default.error('Failed to get business metrics', { error: error.message, businessId });
            throw error;
        }
    }
    async findMessageTemplates(businessId, category, language = 'bg') {
        try {
            const query = {
                $or: [
                    { businessId },
                    { businessId: 'system' }
                ],
                isActive: true,
                language
            };
            if (category) {
                query.category = category;
            }
            return await this.messageTemplates
                .find(query)
                .sort({ businessId: -1, usageCount: -1 })
                .toArray();
        }
        catch (error) {
            logger_1.default.error('Failed to find message templates', { error: error.message });
            throw error;
        }
    }
    async updateTemplateUsage(templateId) {
        try {
            await this.messageTemplates.updateOne({ id: templateId }, {
                $inc: { usageCount: 1 },
                $set: { updatedAt: new Date() }
            });
        }
        catch (error) {
            logger_1.default.error('Failed to update template usage', { error: error.message, templateId });
        }
    }
    async cleanupExpiredData() {
        try {
            let deletedRecords = 0;
            let anonymizedRecords = 0;
            const now = new Date();
            const conversationResult = await this.conversations.deleteMany({
                gdprRetentionUntil: { $lt: now }
            });
            deletedRecords += conversationResult.deletedCount || 0;
            const analyticsResult = await this.analyticsEvents.updateMany({
                gdprRetentionUntil: { $lt: now },
                anonymized: false
            }, {
                $set: {
                    anonymized: true,
                    userId: null,
                    ipAddress: null,
                    userAgent: null,
                    'data.phoneNumber': null,
                    'data.email': null,
                    updatedAt: new Date()
                }
            });
            anonymizedRecords += analyticsResult.modifiedCount || 0;
            logger_1.gdprLogger.logDataRetention('mongodb_cleanup', 'DELETED', deletedRecords);
            logger_1.gdprLogger.logDataRetention('mongodb_anonymization', 'UPDATED', anonymizedRecords);
            logger_1.default.info('MongoDB data cleanup completed', {
                deletedRecords,
                anonymizedRecords
            });
            return { deletedRecords, anonymizedRecords };
        }
        catch (error) {
            logger_1.default.error('Failed to cleanup MongoDB data', { error: error.message });
            throw error;
        }
    }
    async searchConversations(businessId, query, limit = 50, offset = 0) {
        try {
            const searchFilter = { businessId };
            if (query.customerPhone) {
                searchFilter.customerPhoneNumber = new RegExp(query.customerPhone, 'i');
            }
            if (query.dateRange) {
                searchFilter.startedAt = {
                    $gte: query.dateRange.start,
                    $lte: query.dateRange.end
                };
            }
            if (query.platform) {
                searchFilter.platform = query.platform;
            }
            if (query.state) {
                searchFilter.state = query.state;
            }
            if (query.priority) {
                searchFilter.priority = query.priority;
            }
            const [conversations, total] = await Promise.all([
                this.conversations
                    .find(searchFilter)
                    .sort({ lastMessageAt: -1 })
                    .skip(offset)
                    .limit(limit)
                    .toArray(),
                this.conversations.countDocuments(searchFilter)
            ]);
            return { conversations, total };
        }
        catch (error) {
            logger_1.default.error('Failed to search conversations', { error: error.message });
            throw error;
        }
    }
    getEventCount(results, eventType) {
        const event = results.find(r => r._id === eventType);
        return event ? event.count : 0;
    }
    calculateConversionRate(results) {
        const started = this.getEventCount(results, 'conversation_started');
        const completed = this.getEventCount(results, 'conversation_completed');
        return started > 0 ? (completed / started) * 100 : 0;
    }
    calculateAverageResponseTime(results) {
        const responseEvents = results.find(r => r._id === 'response_sent');
        if (!responseEvents || !responseEvents.data.length)
            return 0;
        const responseTimes = responseEvents.data
            .map((d) => d.responseTime)
            .filter((t) => typeof t === 'number');
        return responseTimes.length > 0
            ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
            : 0;
    }
    calculatePlatformBreakdown(results) {
        const breakdown = {
            [types_1.MessagePlatform.WHATSAPP]: 0,
            [types_1.MessagePlatform.VIBER]: 0,
            [types_1.MessagePlatform.TELEGRAM]: 0,
            [types_1.MessagePlatform.SMS]: 0,
            [types_1.MessagePlatform.EMAIL]: 0
        };
        results.forEach(result => {
            result.data.forEach((d) => {
                if (d.platform && breakdown.hasOwnProperty(d.platform)) {
                    breakdown[d.platform]++;
                }
            });
        });
        return breakdown;
    }
    async healthCheck() {
        try {
            const adminDb = this.db.admin();
            await adminDb.ping();
            const collections = await this.db.listCollections().toArray();
            return {
                status: 'healthy',
                collections: collections.length
            };
        }
        catch (error) {
            return {
                status: 'unhealthy',
                collections: 0
            };
        }
    }
    async close() {
        await this.client.close();
        this.isConnected = false;
        logger_1.default.info('MongoDB connection closed');
    }
    get connected() {
        return this.isConnected;
    }
}
exports.MongoDBDatabase = MongoDBDatabase;
//# sourceMappingURL=MongoDBModels.js.map