"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationService = exports.createTestNotification = exports.markAllAsRead = exports.markAsRead = exports.getUnreadCount = exports.getUserNotifications = void 0;
const NotificationService_1 = __importDefault(require("../services/NotificationService"));
const logger_1 = __importDefault(require("../utils/logger"));
const notificationService = new NotificationService_1.default();
exports.notificationService = notificationService;
const getUserNotifications = async (req, res) => {
    try {
        const userId = req.user?.id;
        const { page = 1, limit = 20 } = req.query;
        if (!userId) {
            res.status(401).json({
                success: false,
                error: {
                    code: 'UNAUTHORIZED',
                    message: 'User not authenticated'
                }
            });
            return;
        }
        const result = await notificationService.getUserNotifications(userId, Number(page), Number(limit));
        res.json({
            success: true,
            data: {
                notifications: result.notifications,
                pagination: {
                    page: Number(page),
                    limit: Number(limit),
                    total: result.total,
                    totalPages: Math.ceil(result.total / Number(limit))
                }
            }
        });
    }
    catch (error) {
        logger_1.default.error('❌ Error getting user notifications:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to get notifications'
            }
        });
    }
};
exports.getUserNotifications = getUserNotifications;
const getUnreadCount = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({
                success: false,
                error: {
                    code: 'UNAUTHORIZED',
                    message: 'User not authenticated'
                }
            });
            return;
        }
        const count = await notificationService.getUnreadCount(userId);
        res.json({
            success: true,
            data: { count }
        });
    }
    catch (error) {
        logger_1.default.error('❌ Error getting unread count:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to get unread count'
            }
        });
    }
};
exports.getUnreadCount = getUnreadCount;
const markAsRead = async (req, res) => {
    try {
        const userId = req.user?.id;
        const { notificationId } = req.params;
        if (!userId) {
            res.status(401).json({
                success: false,
                error: {
                    code: 'UNAUTHORIZED',
                    message: 'User not authenticated'
                }
            });
            return;
        }
        if (!notificationId) {
            res.status(400).json({
                success: false,
                error: {
                    code: 'BAD_REQUEST',
                    message: 'Notification ID is required'
                }
            });
            return;
        }
        await notificationService.markAsRead(notificationId, userId);
        res.json({
            success: true,
            data: {
                message: 'Notification marked as read'
            }
        });
    }
    catch (error) {
        logger_1.default.error('❌ Error marking notification as read:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to mark notification as read'
            }
        });
    }
};
exports.markAsRead = markAsRead;
const markAllAsRead = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({
                success: false,
                error: {
                    code: 'UNAUTHORIZED',
                    message: 'User not authenticated'
                }
            });
            return;
        }
        await notificationService.markAllAsRead(userId);
        res.json({
            success: true,
            data: {
                message: 'All notifications marked as read'
            }
        });
    }
    catch (error) {
        logger_1.default.error('❌ Error marking all notifications as read:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to mark all notifications as read'
            }
        });
    }
};
exports.markAllAsRead = markAllAsRead;
const createTestNotification = async (req, res) => {
    try {
        const userId = req.user?.id;
        const { type = 'test', title = 'Test Notification', message = 'This is a test notification' } = req.body;
        if (!userId) {
            res.status(401).json({
                success: false,
                error: {
                    code: 'UNAUTHORIZED',
                    message: 'User not authenticated'
                }
            });
            return;
        }
        const notificationId = await notificationService.createNotification(userId, type, title, message, { test: true });
        res.json({
            success: true,
            data: {
                notificationId,
                message: 'Test notification created'
            }
        });
    }
    catch (error) {
        logger_1.default.error('❌ Error creating test notification:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to create test notification'
            }
        });
    }
};
exports.createTestNotification = createTestNotification;
//# sourceMappingURL=notificationController.js.map