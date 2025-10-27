export interface SMSTemplate {
    id: string;
    name: string;
    content: string;
    variables: string[];
    isActive: boolean;
}
export interface SMSVariables {
    customerName?: string;
    businessName?: string;
    serviceType?: string;
    estimatedTime?: string;
    chatUrl?: string;
    [key: string]: string | undefined;
}
export declare class SMSTemplateService {
    private readonly chatTokenService;
    private readonly baseUrl;
    constructor(baseUrl?: string);
    private getDefaultTemplates;
    getTemplate(templateId: string, userId: string): Promise<SMSTemplate | null>;
    generateSMSContent(templateId: string, userId: string, variables?: SMSVariables): Promise<string>;
    getAvailableTemplates(): SMSTemplate[];
    generateMissedCallSMS(userId: string, isEmergency?: boolean, isAfterHours?: boolean, variables?: SMSVariables): Promise<string>;
    getCurrentChatUrl(userId: string): Promise<string>;
    validateTemplateVariables(templateId: string, variables: SMSVariables): {
        isValid: boolean;
        missingVariables: string[];
    };
}
//# sourceMappingURL=SMSTemplateService.d.ts.map