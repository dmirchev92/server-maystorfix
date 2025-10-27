import { Request, Response } from 'express';
import NotificationService from '../services/NotificationService';
declare const notificationService: NotificationService;
export declare const getUserNotifications: (req: Request, res: Response) => Promise<void>;
export declare const getUnreadCount: (req: Request, res: Response) => Promise<void>;
export declare const markAsRead: (req: Request, res: Response) => Promise<void>;
export declare const markAllAsRead: (req: Request, res: Response) => Promise<void>;
export declare const createTestNotification: (req: Request, res: Response) => Promise<void>;
export { notificationService };
//# sourceMappingURL=notificationController.d.ts.map