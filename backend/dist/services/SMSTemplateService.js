"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SMSTemplateService = void 0;
const ChatTokenService_1 = require("./ChatTokenService");
const logger_1 = __importDefault(require("../utils/logger"));
class SMSTemplateService {
    constructor(baseUrl) {
        this.chatTokenService = new ChatTokenService_1.ChatTokenService();
        this.baseUrl = baseUrl || process.env.FRONTEND_URL || 'https://maystorfix.com';
    }
    getDefaultTemplates() {
        return [
            {
                id: 'missed_call_business_hours',
                name: 'Missed Call - Business Hours',
                content: `Здравейте! Видях пропуснатото Ви обаждане. Моля, опишете проблема тук: {chatUrl}

С уважение,
{businessName}
Електротехник с лиценз`,
                variables: ['businessName', 'chatUrl'],
                isActive: true
            },
            {
                id: 'missed_call_after_hours',
                name: 'Missed Call - After Hours',
                content: `Здравейте! Видях пропуснатото Ви обаждане извън работно време. 

За спешни случаи: {chatUrl}

Ще Ви отговоря утре в работно време.

{businessName}`,
                variables: ['businessName', 'chatUrl'],
                isActive: true
            },
            {
                id: 'emergency_response',
                name: 'Emergency Response',
                content: `🚨 СПЕШЕН ОТГОВОР 🚨

Видях спешното Ви обаждане! Моля, опишете проблема незабавно: {chatUrl}

Ще отговоря в рамките на 15 минути!

{businessName} - 24/7 спешни услуги`,
                variables: ['businessName', 'chatUrl'],
                isActive: true
            },
            {
                id: 'follow_up',
                name: 'Follow-up Message',
                content: `Здравейте {customerName}!

Как протича работата? Ако имате въпроси: {chatUrl}

Благодаря за доверието!
{businessName}`,
                variables: ['customerName', 'businessName', 'chatUrl'],
                isActive: true
            }
        ];
    }
    async getTemplate(templateId, userId) {
        const templates = this.getDefaultTemplates();
        const template = templates.find(t => t.id === templateId && t.isActive);
        if (!template) {
            logger_1.default.warn('Template not found', { templateId, userId });
            return null;
        }
        return template;
    }
    async generateSMSContent(templateId, userId, variables = {}) {
        try {
            const template = await this.getTemplate(templateId, userId);
            if (!template) {
                throw new Error(`Template not found: ${templateId}`);
            }
            const chatUrl = await this.chatTokenService.getChatUrlForUser(userId, this.baseUrl);
            const allVariables = {
                ...variables,
                chatUrl
            };
            let content = template.content;
            for (const [key, value] of Object.entries(allVariables)) {
                if (value) {
                    const placeholder = `{${key}}`;
                    content = content.replace(new RegExp(placeholder, 'g'), value);
                }
            }
            logger_1.default.info('Generated SMS content', {
                userId,
                templateId,
                chatUrl: chatUrl.substring(0, 50) + '...',
                contentLength: content.length
            });
            return content;
        }
        catch (error) {
            logger_1.default.error('Failed to generate SMS content', { templateId, userId, error });
            throw error;
        }
    }
    getAvailableTemplates() {
        return this.getDefaultTemplates().filter(t => t.isActive);
    }
    async generateMissedCallSMS(userId, isEmergency = false, isAfterHours = false, variables = {}) {
        let templateId;
        if (isEmergency) {
            templateId = 'emergency_response';
        }
        else if (isAfterHours) {
            templateId = 'missed_call_after_hours';
        }
        else {
            templateId = 'missed_call_business_hours';
        }
        return await this.generateSMSContent(templateId, userId, variables);
    }
    async getCurrentChatUrl(userId) {
        return await this.chatTokenService.getChatUrlForUser(userId, this.baseUrl);
    }
    validateTemplateVariables(templateId, variables) {
        const template = this.getDefaultTemplates().find(t => t.id === templateId);
        if (!template) {
            return { isValid: false, missingVariables: [] };
        }
        const requiredVariables = template.variables.filter(v => v !== 'chatUrl');
        const providedVariables = Object.keys(variables);
        const missingVariables = requiredVariables.filter(v => !providedVariables.includes(v));
        return {
            isValid: missingVariables.length === 0,
            missingVariables
        };
    }
}
exports.SMSTemplateService = SMSTemplateService;
//# sourceMappingURL=SMSTemplateService.js.map