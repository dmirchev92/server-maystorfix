interface ViberWebhookEvent {
    event: 'delivered' | 'seen' | 'failed' | 'subscribed' | 'unsubscribed' | 'conversation_started';
    timestamp: number;
    message_token: number;
    user: {
        id: string;
        name: string;
        avatar?: string;
        country?: string;
        language?: string;
        api_version?: number;
    };
    message?: {
        type: string;
        text?: string;
        media?: string;
        location?: {
            lat: number;
            lon: number;
        };
        contact?: {
            name: string;
            phone_number: string;
        };
    };
    subscribed?: boolean;
    chat_hostname?: string;
}
export declare class ViberBusinessService {
    private api;
    private authToken;
    private webhookUrl;
    constructor();
    private setupInterceptors;
    sendTextMessage(receiver: string, text: string, trackingData?: string): Promise<boolean>;
    sendPictureMessage(receiver: string, media: string, text?: string, thumbnail?: string): Promise<boolean>;
    sendContactMessage(receiver: string, contactName: string, contactPhone: string): Promise<boolean>;
    setWebhook(webhookUrl: string): Promise<boolean>;
    getAccountInfo(): Promise<any>;
    processWebhookEvent(event: ViberWebhookEvent): void;
    private handleMessageDelivered;
    private handleMessageSeen;
    private handleMessageFailed;
    private handleUserSubscribed;
    private handleUserUnsubscribed;
    private handleConversationStarted;
    isConfigured(): boolean;
}
export default ViberBusinessService;
//# sourceMappingURL=ViberBusinessService.d.ts.map