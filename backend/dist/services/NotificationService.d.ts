interface Notification {
    id: string;
    user_id: string;
    type: 'case_assigned' | 'case_accepted' | 'case_completed' | 'case_declined' | 'new_case_available' | 'review_request';
    title: string;
    message: string;
    data?: any;
    read: boolean;
    created_at: string;
}
export declare class NotificationService {
    private db;
    private wsConnections;
    constructor();
    private initializeNotificationTables;
    registerConnection(userId: string, ws: any): void;
    unregisterConnection(userId: string): void;
    createNotification(userId: string, type: string, title: string, message: string, data?: any): Promise<string>;
    private sendUnreadCount;
    getUnreadCount(userId: string): Promise<number>;
    getUserNotifications(userId: string, page?: number, limit?: number): Promise<{
        notifications: Notification[];
        total: number;
    }>;
    markAsRead(notificationId: string, userId: string): Promise<void>;
    markAllAsRead(userId: string): Promise<void>;
    notifyCaseAssigned(caseId: string, customerId: string, providerId: string, providerName: string): Promise<void>;
    notifyCaseAccepted(caseId: string, providerId: string, customerName: string): Promise<void>;
    notifyCaseCompleted(caseId: string, customerId: string, providerId: string): Promise<void>;
    private sendSurveyToChat;
    notifyNewCaseAvailable(caseId: string, category: string, location: string, providerIds: string[]): Promise<void>;
    notifyReviewRequest(caseId: string, customerId: string, providerName: string): Promise<void>;
}
export default NotificationService;
//# sourceMappingURL=NotificationService.d.ts.map