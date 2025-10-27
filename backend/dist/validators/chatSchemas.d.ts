import { z } from 'zod';
export declare const createConversationSchema: z.ZodObject<{
    providerId: z.ZodString;
    customerName: z.ZodString;
    customerEmail: z.ZodString;
    customerPhone: z.ZodOptional<z.ZodString>;
    initialMessage: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const getConversationsQuerySchema: z.ZodObject<{
    cursor: z.ZodOptional<z.ZodString>;
    limit: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    status: z.ZodOptional<z.ZodEnum<{
        active: "active";
        archived: "archived";
    }>>;
}, z.core.$strip>;
export declare const conversationIdParamSchema: z.ZodObject<{
    id: z.ZodString;
}, z.core.$strip>;
export declare const sendMessageSchema: z.ZodObject<{
    conversationId: z.ZodString;
    type: z.ZodEnum<{
        service_request: "service_request";
        text: "text";
        file: "file";
        image: "image";
        system: "system";
        case_template: "case_template";
        case_created: "case_created";
        case_filled: "case_filled";
        survey: "survey";
    }>;
    body: z.ZodString;
    attachments: z.ZodOptional<z.ZodArray<z.ZodString>>;
}, z.core.$strip>;
export declare const getMessagesQuerySchema: z.ZodObject<{
    before: z.ZodOptional<z.ZodString>;
    limit: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
}, z.core.$strip>;
export declare const messageIdParamSchema: z.ZodObject<{
    id: z.ZodString;
}, z.core.$strip>;
export declare const editMessageSchema: z.ZodObject<{
    body: z.ZodString;
}, z.core.$strip>;
export declare const updateReceiptSchema: z.ZodObject<{
    status: z.ZodEnum<{
        delivered: "delivered";
        read: "read";
    }>;
}, z.core.$strip>;
export declare const typingEventSchema: z.ZodObject<{
    conversationId: z.ZodString;
    isTyping: z.ZodBoolean;
}, z.core.$strip>;
export declare const presenceEventSchema: z.ZodObject<{
    status: z.ZodEnum<{
        online: "online";
        offline: "offline";
        away: "away";
    }>;
}, z.core.$strip>;
export declare const uploadFileSchema: z.ZodObject<{
    filename: z.ZodString;
    mimeType: z.ZodString;
    size: z.ZodNumber;
}, z.core.$strip>;
export type CreateConversationInput = z.infer<typeof createConversationSchema>;
export type GetConversationsQuery = z.infer<typeof getConversationsQuerySchema>;
export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type GetMessagesQuery = z.infer<typeof getMessagesQuerySchema>;
export type EditMessageInput = z.infer<typeof editMessageSchema>;
export type UpdateReceiptInput = z.infer<typeof updateReceiptSchema>;
export type TypingEventInput = z.infer<typeof typingEventSchema>;
export type PresenceEventInput = z.infer<typeof presenceEventSchema>;
export type UploadFileInput = z.infer<typeof uploadFileSchema>;
//# sourceMappingURL=chatSchemas.d.ts.map