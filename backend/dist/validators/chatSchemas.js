"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadFileSchema = exports.presenceEventSchema = exports.typingEventSchema = exports.updateReceiptSchema = exports.editMessageSchema = exports.messageIdParamSchema = exports.getMessagesQuerySchema = exports.sendMessageSchema = exports.conversationIdParamSchema = exports.getConversationsQuerySchema = exports.createConversationSchema = void 0;
const zod_1 = require("zod");
exports.createConversationSchema = zod_1.z.object({
    providerId: zod_1.z.string().min(1, 'Provider ID is required'),
    customerName: zod_1.z.string().min(1, 'Customer name is required').max(255),
    customerEmail: zod_1.z.string().email('Invalid email address'),
    customerPhone: zod_1.z.string().optional(),
    initialMessage: zod_1.z.string().max(10000, 'Message too long').optional()
});
exports.getConversationsQuerySchema = zod_1.z.object({
    cursor: zod_1.z.string().optional(),
    limit: zod_1.z.coerce.number().int().min(1).max(100).default(20),
    status: zod_1.z.enum(['active', 'archived']).optional()
});
exports.conversationIdParamSchema = zod_1.z.object({
    id: zod_1.z.string().min(1, 'Conversation ID is required')
});
exports.sendMessageSchema = zod_1.z.object({
    conversationId: zod_1.z.string().min(1, 'Conversation ID is required'),
    type: zod_1.z.enum(['text', 'image', 'file', 'system', 'case_template', 'service_request', 'case_created', 'case_filled', 'survey']),
    body: zod_1.z.string().min(1, 'Message body is required').max(10000, 'Message too long'),
    attachments: zod_1.z.array(zod_1.z.string().url()).max(10, 'Too many attachments').optional()
});
exports.getMessagesQuerySchema = zod_1.z.object({
    before: zod_1.z.string().optional(),
    limit: zod_1.z.coerce.number().int().min(1).max(100).default(50)
});
exports.messageIdParamSchema = zod_1.z.object({
    id: zod_1.z.string().min(1, 'Message ID is required')
});
exports.editMessageSchema = zod_1.z.object({
    body: zod_1.z.string().min(1, 'Message body is required').max(10000, 'Message too long')
});
exports.updateReceiptSchema = zod_1.z.object({
    status: zod_1.z.enum(['delivered', 'read'])
});
exports.typingEventSchema = zod_1.z.object({
    conversationId: zod_1.z.string().min(1),
    isTyping: zod_1.z.boolean()
});
exports.presenceEventSchema = zod_1.z.object({
    status: zod_1.z.enum(['online', 'offline', 'away'])
});
exports.uploadFileSchema = zod_1.z.object({
    filename: zod_1.z.string().min(1, 'Filename is required'),
    mimeType: zod_1.z.string().min(1, 'MIME type is required'),
    size: zod_1.z.number().int().min(1).max(10 * 1024 * 1024, 'File too large (max 10MB)')
});
//# sourceMappingURL=chatSchemas.js.map