// SMS Template Service - Manages SMS templates with dynamic chat tokens
// Integrates with ChatTokenService for automatic token embedding

import { ChatTokenService } from './ChatTokenService';
import logger from '../utils/logger';
import config from '../utils/config';

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

export class SMSTemplateService {
  private readonly chatTokenService: ChatTokenService;
  private readonly baseUrl: string;

  constructor(baseUrl?: string) {
    this.chatTokenService = new ChatTokenService();
    this.baseUrl = baseUrl || process.env.FRONTEND_URL || 'https://maystorfix.com';
  }

  /**
   * Default SMS templates with chat URL integration
   */
  private getDefaultTemplates(): SMSTemplate[] {
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

  /**
   * Get SMS template by ID with dynamic token
   */
  async getTemplate(templateId: string, userId: string): Promise<SMSTemplate | null> {
    const templates = this.getDefaultTemplates();
    const template = templates.find(t => t.id === templateId && t.isActive);
    
    if (!template) {
      logger.warn('Template not found', { templateId, userId });
      return null;
    }

    return template;
  }

  /**
   * Generate SMS content with variables and fresh chat token
   */
  async generateSMSContent(
    templateId: string, 
    userId: string, 
    variables: SMSVariables = {}
  ): Promise<string> {
    try {
      const template = await this.getTemplate(templateId, userId);
      if (!template) {
        throw new Error(`Template not found: ${templateId}`);
      }

      // Get fresh chat URL with current token
      const chatUrl = await this.chatTokenService.getChatUrlForUser(userId, this.baseUrl);
      
      // Merge provided variables with chat URL
      const allVariables: SMSVariables = {
        ...variables,
        chatUrl
      };

      // Replace variables in template content
      let content = template.content;
      
      for (const [key, value] of Object.entries(allVariables)) {
        if (value) {
          const placeholder = `{${key}}`;
          content = content.replace(new RegExp(placeholder, 'g'), value);
        }
      }

      // Log SMS generation for debugging
      logger.info('Generated SMS content', {
        userId,
        templateId,
        chatUrl: chatUrl.substring(0, 50) + '...',
        contentLength: content.length
      });

      return content;

    } catch (error) {
      logger.error('Failed to generate SMS content', { templateId, userId, error });
      throw error;
    }
  }

  /**
   * Get all available templates
   */
  getAvailableTemplates(): SMSTemplate[] {
    return this.getDefaultTemplates().filter(t => t.isActive);
  }

  /**
   * Generate SMS for missed call scenario
   */
  async generateMissedCallSMS(
    userId: string,
    isEmergency: boolean = false,
    isAfterHours: boolean = false,
    variables: SMSVariables = {}
  ): Promise<string> {
    let templateId: string;

    if (isEmergency) {
      templateId = 'emergency_response';
    } else if (isAfterHours) {
      templateId = 'missed_call_after_hours';
    } else {
      templateId = 'missed_call_business_hours';
    }

    return await this.generateSMSContent(templateId, userId, variables);
  }

  /**
   * Get current chat URL for user (for external integrations)
   */
  async getCurrentChatUrl(userId: string): Promise<string> {
    return await this.chatTokenService.getChatUrlForUser(userId, this.baseUrl);
  }

  /**
   * Validate template variables
   */
  validateTemplateVariables(templateId: string, variables: SMSVariables): {
    isValid: boolean;
    missingVariables: string[];
  } {
    const template = this.getDefaultTemplates().find(t => t.id === templateId);
    if (!template) {
      return { isValid: false, missingVariables: [] };
    }

    const requiredVariables = template.variables.filter(v => v !== 'chatUrl'); // chatUrl is auto-generated
    const providedVariables = Object.keys(variables);
    const missingVariables = requiredVariables.filter(v => !providedVariables.includes(v));

    return {
      isValid: missingVariables.length === 0,
      missingVariables
    };
  }
}
