"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationService = void 0;
const DatabaseFactory_1 = require("../models/DatabaseFactory");
const logger_1 = __importDefault(require("../utils/logger"));
const uuid_1 = require("uuid");
class NotificationService {
    constructor() {
        this.wsConnections = new Map();
        this.db = DatabaseFactory_1.DatabaseFactory.getDatabase();
        this.initializeNotificationTables();
    }
    async initializeNotificationTables() {
        try {
            await new Promise((resolve, reject) => {
                this.db.db.run(`
          CREATE TABLE IF NOT EXISTS notifications (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            type TEXT NOT NULL,
            title TEXT NOT NULL,
            message TEXT NOT NULL,
            data TEXT,
            read INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
          )
        `, (err) => {
                    if (err)
                        reject(err);
                    else
                        resolve();
                });
            });
            await new Promise((resolve, reject) => {
                this.db.db.run(`
          CREATE INDEX IF NOT EXISTS idx_notifications_user_read 
          ON notifications(user_id, read, created_at)
        `, (err) => {
                    if (err)
                        reject(err);
                    else
                        resolve();
                });
            });
            logger_1.default.info('✅ Notification tables initialized');
        }
        catch (error) {
            logger_1.default.error('❌ Error initializing notification tables:', error);
        }
    }
    registerConnection(userId, ws) {
        this.wsConnections.set(userId, ws);
        logger_1.default.info('🔌 WebSocket connection registered', { userId });
        this.sendUnreadCount(userId);
    }
    unregisterConnection(userId) {
        this.wsConnections.delete(userId);
        logger_1.default.info('🔌 WebSocket connection unregistered', { userId });
    }
    async createNotification(userId, type, title, message, data) {
        try {
            const notificationId = (0, uuid_1.v4)();
            const now = new Date().toISOString();
            await new Promise((resolve, reject) => {
                this.db.db.run(`INSERT INTO notifications (id, user_id, type, title, message, data, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`, [notificationId, userId, type, title, message, JSON.stringify(data), now], function (err) {
                    if (err)
                        reject(err);
                    else
                        resolve();
                });
            });
            const ws = this.wsConnections.get(userId);
            if (ws && ws.readyState === 1) {
                ws.send(JSON.stringify({
                    type: 'notification',
                    data: {
                        id: notificationId,
                        type,
                        title,
                        message,
                        data,
                        created_at: now
                    }
                }));
            }
            this.sendUnreadCount(userId);
            logger_1.default.info('✅ Notification created and sent', {
                notificationId,
                userId,
                type,
                realTime: !!ws
            });
            return notificationId;
        }
        catch (error) {
            logger_1.default.error('❌ Error creating notification:', error);
            throw error;
        }
    }
    async sendUnreadCount(userId) {
        try {
            const count = await this.getUnreadCount(userId);
            const ws = this.wsConnections.get(userId);
            if (ws && ws.readyState === 1) {
                ws.send(JSON.stringify({
                    type: 'unread_count',
                    data: { count }
                }));
            }
        }
        catch (error) {
            logger_1.default.error('❌ Error sending unread count:', error);
        }
    }
    async getUnreadCount(userId) {
        return new Promise((resolve, reject) => {
            this.db.db.get('SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND read = FALSE', [userId], (err, row) => {
                if (err)
                    reject(err);
                else
                    resolve(row?.count || 0);
            });
        });
    }
    async getUserNotifications(userId, page = 1, limit = 20) {
        try {
            const offset = (page - 1) * limit;
            const total = await new Promise((resolve, reject) => {
                this.db.db.get('SELECT COUNT(*) as count FROM notifications WHERE user_id = ?', [userId], (err, row) => {
                    if (err)
                        reject(err);
                    else
                        resolve(row?.count || 0);
                });
            });
            const notifications = await new Promise((resolve, reject) => {
                this.db.db.all(`SELECT * FROM notifications 
           WHERE user_id = ? 
           ORDER BY created_at DESC 
           LIMIT ? OFFSET ?`, [userId, limit, offset], (err, rows) => {
                    if (err)
                        reject(err);
                    else {
                        const parsed = rows.map(row => ({
                            ...row,
                            data: row.data ? (typeof row.data === 'string' ? JSON.parse(row.data) : row.data) : null,
                            read: !!row.read
                        }));
                        resolve(parsed);
                    }
                });
            });
            return { notifications, total };
        }
        catch (error) {
            logger_1.default.error('❌ Error getting user notifications:', error);
            throw error;
        }
    }
    async markAsRead(notificationId, userId) {
        try {
            await new Promise((resolve, reject) => {
                this.db.db.run('UPDATE notifications SET read = TRUE WHERE id = ? AND user_id = ?', [notificationId, userId], function (err) {
                    if (err)
                        reject(err);
                    else
                        resolve();
                });
            });
            this.sendUnreadCount(userId);
            logger_1.default.info('✅ Notification marked as read', { notificationId, userId });
        }
        catch (error) {
            logger_1.default.error('❌ Error marking notification as read:', error);
            throw error;
        }
    }
    async markAllAsRead(userId) {
        try {
            await new Promise((resolve, reject) => {
                this.db.db.run('UPDATE notifications SET read = TRUE WHERE user_id = ? AND read = FALSE', [userId], function (err) {
                    if (err)
                        reject(err);
                    else
                        resolve();
                });
            });
            this.sendUnreadCount(userId);
            logger_1.default.info('✅ All notifications marked as read', { userId });
        }
        catch (error) {
            logger_1.default.error('❌ Error marking all notifications as read:', error);
            throw error;
        }
    }
    async notifyCaseAssigned(caseId, customerId, providerId, providerName) {
        console.log('🔔 NotificationService - notifyCaseAssigned called:', { caseId, customerId, providerId, providerName });
        await this.createNotification(customerId, 'case_assigned', 'Заявката ви е приета', `${providerName} прие вашата заявка и ще се свърже с вас скоро.`, { caseId, providerId });
        console.log('✅ NotificationService - Case assigned notification created');
    }
    async notifyCaseAccepted(caseId, providerId, customerName) {
        await this.createNotification(providerId, 'case_accepted', 'Нова заявка за работа', `Имате нова заявка от ${customerName}. Моля свържете се с клиента.`, { caseId });
    }
    async notifyCaseCompleted(caseId, customerId, providerId) {
        try {
            console.log('🔔 NotificationService - Case completed notification triggered:', { caseId, customerId, providerId });
            const caseDetails = await new Promise((resolve, reject) => {
                this.db.db.get(`SELECT c.*, p.first_name, p.last_name
           FROM marketplace_service_cases c
           LEFT JOIN users p ON c.provider_id = p.id
           WHERE c.id = ?`, [caseId], (err, row) => {
                    if (err)
                        reject(err);
                    else
                        resolve(row);
                });
            });
            if (!caseDetails) {
                console.log('🔔 NotificationService - Case not found, using generic notification');
                await this.createNotification(customerId, 'case_completed', 'Заявката е завършена - Оценете услугата', 'Вашата заявка е отбелязана като завършена. Моля споделете вашето мнение за получената услуга.', { caseId, providerId, action: 'review_service' });
                return;
            }
            const providerName = caseDetails.provider_name || `${caseDetails.first_name || ''} ${caseDetails.last_name || ''}`.trim() || 'Изпълнителя';
            const caseDescription = caseDetails.description || caseDetails.service_type || 'услугата';
            console.log('🔔 NotificationService - Creating notification...');
            await this.createNotification(customerId, 'case_completed', `Завършена: ${caseDescription}`, `Заявката "${caseDescription}" от ${providerName} е завършена. Моля оценете получената услуга.`, { caseId, providerId, action: 'review_service' });
            console.log('🔔 NotificationService - Notification created successfully');
            console.log('🔔 NotificationService - Sending survey to chat...');
            await this.sendSurveyToChat(caseId, customerId, providerId);
            console.log('🔔 NotificationService - Survey chat message sent successfully');
        }
        catch (error) {
            console.error('🔔 NotificationService - Error in notifyCaseCompleted:', error);
            throw error;
        }
    }
    async sendSurveyToChat(caseId, customerId, providerId) {
        try {
            console.log('💬 sendSurveyToChat - Getting case details for:', caseId);
            const caseDetails = await new Promise((resolve, reject) => {
                this.db.db.get(`SELECT c.*, u.first_name, u.last_name, sp.business_name
           FROM marketplace_service_cases c
           LEFT JOIN users u ON c.provider_id = u.id
           LEFT JOIN service_provider_profiles sp ON u.id = sp.user_id
           WHERE c.id = ?`, [caseId], (err, row) => {
                    if (err)
                        reject(err);
                    else
                        resolve(row);
                });
            });
            console.log('💬 sendSurveyToChat - Case details:', caseDetails);
            if (!caseDetails) {
                console.log('💬 sendSurveyToChat - No case details found, returning');
                return;
            }
            console.log('💬 sendSurveyToChat - Looking for conversation between:', customerId, 'and', providerId);
            const conversation = await new Promise((resolve, reject) => {
                this.db.db.get(`SELECT id FROM marketplace_conversations 
           WHERE customer_id = ? AND provider_id = ?
           ORDER BY created_at DESC LIMIT 1`, [customerId, providerId], (err, row) => {
                    if (err)
                        reject(err);
                    else
                        resolve(row);
                });
            });
            console.log('💬 sendSurveyToChat - Found conversation:', conversation);
            if (conversation) {
                const surveyMessage = `🌟 Заявката "${caseDetails.description}" е завършена успешно!

Моля споделете вашето мнение за получената услуга от ${caseDetails.business_name || `${caseDetails.first_name} ${caseDetails.last_name}`}.

Вашата оценка помага на други клиенти да направят правилния избор.

👆 Натиснете тук за да оцените услугата`;
                console.log('💬 sendSurveyToChat - Inserting survey message into conversation:', conversation.id);
                const messageId = require('uuid').v4();
                await new Promise((resolve, reject) => {
                    this.db.db.run(`INSERT INTO marketplace_chat_messages (id, conversation_id, sender_id, message, message_type, data, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`, [
                        messageId,
                        conversation.id,
                        'system',
                        surveyMessage,
                        'survey_request',
                        JSON.stringify({ caseId }),
                        new Date().toISOString()
                    ], (err) => {
                        if (err) {
                            console.error('💬 sendSurveyToChat - Error inserting message:', err);
                            reject(err);
                        }
                        else {
                            console.log('💬 sendSurveyToChat - Survey message inserted successfully with ID:', messageId);
                            resolve();
                        }
                    });
                });
            }
            else {
                console.log('💬 sendSurveyToChat - No conversation found between customer and provider');
            }
        }
        catch (error) {
            console.error('💬 sendSurveyToChat - Error sending survey to chat:', error);
            throw error;
        }
    }
    async notifyNewCaseAvailable(caseId, category, location, providerIds) {
        const title = 'Нова заявка в района ви';
        const message = `Нова заявка за ${category} в ${location}. Проверете дали можете да я приемете.`;
        for (const providerId of providerIds) {
            await this.createNotification(providerId, 'new_case_available', title, message, { caseId, category, location });
        }
    }
    async notifyReviewRequest(caseId, customerId, providerName) {
        await this.createNotification(customerId, 'review_request', 'Оценете услугата', `Моля оценете работата на ${providerName}. Вашето мнение е важно за нас.`, { caseId });
    }
}
exports.NotificationService = NotificationService;
exports.default = NotificationService;
//# sourceMappingURL=NotificationService.js.map