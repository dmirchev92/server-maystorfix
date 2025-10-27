// GDPR Compliance Service
// Handles all GDPR-related operations including data rights, retention, and audit

import { v4 as uuidv4 } from 'uuid';
import config from '../utils/config';
import logger, { gdprLogger } from '../utils/logger';
import {
  User,
  GDPRConsent,
  ConsentType,
  DataProcessingBasis,
  DataProcessingRecord,
  DataRetentionPolicy,
  AuditLog,
  ServiceTextProError,
  GDPRComplianceError,
  DataRetentionError,
  APIResponse
} from '../types';

export interface DataExportRequest {
  userId: string;
  format: 'json' | 'pdf' | 'csv';
  includeConversations: boolean;
  includeAnalytics: boolean;
  requestedBy: string;
  ipAddress?: string;
}

export interface DataErasureRequest {
  userId: string;
  reason: string;
  requestedBy: string;
  ipAddress?: string;
  retainForLegalReasons?: boolean;
}

export interface DataRectificationRequest {
  userId: string;
  dataType: string;
  corrections: Record<string, any>;
  requestedBy: string;
  ipAddress?: string;
}

export interface ConsentUpdateRequest {
  userId: string;
  consents: Array<{
    consentType: ConsentType;
    granted: boolean;
    reason?: string;
  }>;
  requestedBy: string;
  ipAddress?: string;
}

export class GDPRService {
  private readonly retentionPolicies: Map<string, DataRetentionPolicy>;

  constructor() {
    this.retentionPolicies = new Map();
    this.initializeRetentionPolicies();
  }

  /**
   * Initialize data retention policies based on configuration
   */
  private initializeRetentionPolicies(): void {
    const policies: DataRetentionPolicy[] = [
      {
        dataType: 'user_profile',
        retentionPeriodMonths: config.gdpr.dataRetention.businessDataMonths,
        autoDeleteEnabled: config.gdpr.compliance.autoDeleteExpiredData,
        legalBasis: DataProcessingBasis.CONTRACT
      },
      {
        dataType: 'conversation_data',
        retentionPeriodMonths: config.gdpr.dataRetention.conversationMonths,
        autoDeleteEnabled: config.gdpr.compliance.autoDeleteExpiredData,
        legalBasis: DataProcessingBasis.LEGITIMATE_INTEREST
      },
      {
        dataType: 'analytics_data',
        retentionPeriodMonths: config.gdpr.dataRetention.analyticsMonths,
        autoDeleteEnabled: true,
        legalBasis: DataProcessingBasis.CONSENT
      },
      {
        dataType: 'audit_logs',
        retentionPeriodMonths: config.gdpr.dataRetention.auditLogMonths,
        autoDeleteEnabled: false, // Keep for legal compliance
        legalBasis: DataProcessingBasis.LEGAL_OBLIGATION
      }
    ];

    policies.forEach(policy => {
      this.retentionPolicies.set(policy.dataType, policy);
    });
  }

  /**
   * Handle data access request (Article 15 - Right of Access)
   */
  async handleDataAccessRequest(userId: string, requestedBy: string, ipAddress?: string): Promise<any> {
    try {
      // Validate request
      await this.validateDataSubjectRequest(userId, requestedBy);

      // Collect all data for the user
      const userData = await this.collectUserData(userId);

      // Log the access request
      gdprLogger.logPrivacyRightRequest(userId, 'DATA_ACCESS', 'COMPLETED');
      
      this.createAuditLog({
        userId: requestedBy,
        action: 'DATA_ACCESS_REQUEST',
        resource: 'user_data',
        resourceId: userId,
        details: { dataTypes: Object.keys(userData) },
        ipAddress: ipAddress || '0.0.0.0',
        userAgent: 'backend-service',
        timestamp: new Date(),
        gdprRelevant: true
      });

      logger.info('Data access request completed', { 
        userId, 
        requestedBy, 
        dataTypesCount: Object.keys(userData).length 
      });

      return {
        subject: userData.user,
        data: userData,
        exportedAt: new Date().toISOString(),
        retentionInformation: this.getRetentionInformation(userId),
        rightsInformation: this.getRightsInformation(),
        contactInformation: {
          dpo: config.gdpr.dpo,
          privacyPolicy: config.gdpr.urls.privacyPolicy
        }
      };

    } catch (error) {
      logger.error('Data access request failed', { error: error instanceof Error ? error.message : 'Unknown error', userId });
      throw error;
    }
  }

  /**
   * Handle data export request (Article 20 - Right to Data Portability)
   */
  async handleDataExportRequest(request: DataExportRequest): Promise<string> {
    try {
      // Validate request
      await this.validateDataSubjectRequest(request.userId, request.requestedBy);

      // Collect exportable data
      const exportData = await this.collectExportableData(
        request.userId,
        request.includeConversations,
        request.includeAnalytics
      );

      // Generate export file
      const exportId = uuidv4();
      const exportUrl = await this.generateDataExport(exportData, request.format, exportId);

      // Log the export request
      gdprLogger.logPrivacyRightRequest(request.userId, 'DATA_PORTABILITY', 'COMPLETED');
      
      this.createAuditLog({
        userId: request.requestedBy,
        action: 'DATA_EXPORT_REQUEST',
        resource: 'user_data',
        resourceId: request.userId,
        details: { 
          format: request.format, 
          exportId,
          includeConversations: request.includeConversations,
          includeAnalytics: request.includeAnalytics
        },
        ipAddress: request.ipAddress || '0.0.0.0',
        userAgent: 'backend-service',
        timestamp: new Date(),
        gdprRelevant: true
      });

      logger.info('Data export request completed', { 
        userId: request.userId, 
        exportId, 
        format: request.format 
      });

      return exportUrl;

    } catch (error) {
      logger.error('Data export request failed', { error: error instanceof Error ? error.message : 'Unknown error', userId: request.userId });
      throw error;
    }
  }

  /**
   * Handle data erasure request (Article 17 - Right to Erasure)
   */
  async handleDataErasureRequest(request: DataErasureRequest): Promise<void> {
    try {
      // Validate request
      await this.validateDataSubjectRequest(request.userId, request.requestedBy);

      // Check if data can be erased (legal obligations, etc.)
      const erasureValidation = await this.validateDataErasure(request.userId);
      if (!erasureValidation.canErase) {
        throw new GDPRComplianceError(
          `Data cannot be erased: ${erasureValidation.reason}`
        );
      }

      // Perform data erasure
      const erasureResult = await this.performDataErasure(
        request.userId,
        request.retainForLegalReasons || false
      );

      // Log the erasure request
      gdprLogger.logPrivacyRightRequest(request.userId, 'DATA_ERASURE', 'COMPLETED');
      
      this.createAuditLog({
        userId: request.requestedBy,
        action: 'DATA_ERASURE_REQUEST',
        resource: 'user_data',
        resourceId: request.userId,
        details: { 
          reason: request.reason,
          retainForLegalReasons: request.retainForLegalReasons,
          erasedDataTypes: erasureResult.erasedDataTypes
        },
        ipAddress: request.ipAddress || '0.0.0.0',
        userAgent: 'backend-service',
        timestamp: new Date(),
        gdprRelevant: true
      });

      logger.info('Data erasure request completed', { 
        userId: request.userId, 
        erasedTypes: erasureResult.erasedDataTypes.length 
      });

    } catch (error) {
      logger.error('Data erasure request failed', { error: error instanceof Error ? error.message : 'Unknown error', userId: request.userId });
      throw error;
    }
  }

  /**
   * Handle data rectification request (Article 16 - Right to Rectification)
   */
  async handleDataRectificationRequest(request: DataRectificationRequest): Promise<void> {
    try {
      // Validate request
      await this.validateDataSubjectRequest(request.userId, request.requestedBy);

      // Validate corrections
      const validationResult = await this.validateDataCorrections(
        request.dataType,
        request.corrections
      );

      if (!validationResult.isValid) {
        throw new ServiceTextProError(
          `Invalid data corrections: ${validationResult.errors.join(', ')}`,
          'INVALID_DATA_CORRECTIONS',
          400
        );
      }

      // Apply corrections
      await this.applyDataCorrections(request.userId, request.dataType, request.corrections);

      // Log the rectification request
      gdprLogger.logPrivacyRightRequest(request.userId, 'DATA_RECTIFICATION', 'COMPLETED');
      
      this.createAuditLog({
        userId: request.requestedBy,
        action: 'DATA_RECTIFICATION_REQUEST',
        resource: request.dataType,
        resourceId: request.userId,
        details: { 
          correctedFields: Object.keys(request.corrections)
        },
        ipAddress: request.ipAddress || '0.0.0.0',
        userAgent: 'backend-service',
        timestamp: new Date(),
        gdprRelevant: true
      });

      logger.info('Data rectification request completed', { 
        userId: request.userId, 
        dataType: request.dataType 
      });

    } catch (error) {
      logger.error('Data rectification request failed', { 
        error: error instanceof Error ? error.message : 'Unknown error', 
        userId: request.userId 
      });
      throw error;
    }
  }

  /**
   * Update user consents (Article 7 - Consent)
   */
  async updateUserConsents(request: ConsentUpdateRequest): Promise<void> {
    try {
      // Validate request
      await this.validateDataSubjectRequest(request.userId, request.requestedBy);

      // Process each consent update
      for (const consentUpdate of request.consents) {
        await this.updateSingleConsent(
          request.userId,
          consentUpdate.consentType,
          consentUpdate.granted,
          consentUpdate.reason,
          request.ipAddress
        );

        // Log consent change
        gdprLogger.logConsentChange(
          request.userId,
          consentUpdate.consentType,
          consentUpdate.granted,
          request.ipAddress
        );
      }

      this.createAuditLog({
        userId: request.requestedBy,
        action: 'CONSENT_UPDATE',
        resource: 'user_consents',
        resourceId: request.userId,
        details: { 
          consentUpdates: request.consents.map(c => ({
            type: c.consentType,
            granted: c.granted
          }))
        },
        ipAddress: request.ipAddress || '0.0.0.0',
        userAgent: 'backend-service',
        timestamp: new Date(),
        gdprRelevant: true
      });

      logger.info('User consents updated', { 
        userId: request.userId, 
        consentsCount: request.consents.length 
      });

    } catch (error) {
      logger.error('Consent update failed', { error: error instanceof Error ? error.message : 'Unknown error', userId: request.userId });
      throw error;
    }
  }

  /**
   * Run automated data retention cleanup
   */
  async runDataRetentionCleanup(): Promise<{ deletedRecords: number; anonymizedRecords: number }> {
    try {
      let deletedRecords = 0;
      let anonymizedRecords = 0;

      for (const [dataType, policy] of this.retentionPolicies) {
        if (!policy.autoDeleteEnabled) continue;

        const cutoffDate = new Date();
        cutoffDate.setMonth(cutoffDate.getMonth() - policy.retentionPeriodMonths);

        // Find expired data
        const expiredData = await this.findExpiredData(dataType, cutoffDate);

        for (const record of expiredData) {
          if (config.gdpr.compliance.anonymizeExpiredData && dataType !== 'audit_logs') {
            // Anonymize instead of delete
            await this.anonymizeData(dataType, record.id);
            anonymizedRecords++;
          } else {
            // Delete the data
            await this.deleteData(dataType, record.id);
            deletedRecords++;
          }
        }

        // Log retention activity
        gdprLogger.logDataRetention(
          dataType,
          'DELETED',
          expiredData.length
        );
      }

      logger.info('Data retention cleanup completed', { 
        deletedRecords, 
        anonymizedRecords 
      });

      return { deletedRecords, anonymizedRecords };

    } catch (error) {
      logger.error('Data retention cleanup failed', { error: error instanceof Error ? error.message : 'Unknown error' });
      throw error;
    }
  }

  /**
   * Get user's data processing information
   */
  async getDataProcessingInformation(userId: string): Promise<DataProcessingRecord[]> {
    try {
      // This would query the database for all data processing records for the user
      const records = await this.findDataProcessingRecords(userId);

      logger.info('Data processing information retrieved', { 
        userId, 
        recordsCount: records.length 
      });

      return records;

    } catch (error) {
      logger.error('Failed to retrieve data processing information', { 
        error: error instanceof Error ? error.message : 'Unknown error', 
        userId 
      });
      throw error;
    }
  }

  /**
   * Validate if a data subject request is legitimate
   */
  private async validateDataSubjectRequest(userId: string, requestedBy: string): Promise<void> {
    // Check if the requester has permission to access this user's data
    if (userId !== requestedBy) {
      // Additional validation for admin/employee access
      const requester = await this.findUserById(requestedBy);
      if (!requester || !this.hasDataAccessPermission(requester, userId)) {
        throw new GDPRComplianceError('Unauthorized data access request');
      }
    }

    // Check if user exists
    const user = await this.findUserById(userId);
    if (!user) {
      throw new ServiceTextProError('User not found', 'USER_NOT_FOUND', 404);
    }

    // Check if data has expired
    if (user.dataRetentionUntil < new Date()) {
      throw new DataRetentionError('User data has expired and may have been deleted');
    }
  }

  /**
   * Collect all user data for access/export requests
   */
  private async collectUserData(userId: string): Promise<any> {
    // This would collect data from all relevant tables/collections
    return {
      user: await this.getUserProfile(userId),
      conversations: await this.getUserConversations(userId),
      consents: await this.getUserConsents(userId),
      analytics: await this.getUserAnalytics(userId),
      auditLogs: await this.getUserAuditLogs(userId)
    };
  }

  /**
   * Generate retention information for user
   */
  private getRetentionInformation(userId: string): any {
    const policies = Array.from(this.retentionPolicies.entries()).map(([dataType, policy]) => ({
      dataType,
      retentionPeriod: `${policy.retentionPeriodMonths} months`,
      legalBasis: policy.legalBasis,
      autoDelete: policy.autoDeleteEnabled
    }));

    return {
      policies,
      generalInformation: 'Data is retained according to Bulgarian and EU legal requirements',
      contactForQuestions: config.gdpr.dpo.email
    };
  }

  /**
   * Generate rights information for users
   */
  private getRightsInformation(): any {
    return {
      rights: [
        'Right to information (Article 13-14)',
        'Right of access (Article 15)',
        'Right to rectification (Article 16)',
        'Right to erasure (Article 17)',
        'Right to restrict processing (Article 18)',
        'Right to data portability (Article 20)',
        'Right to object (Article 21)'
      ],
      howToExercise: 'Contact our DPO or use the app settings',
      responseTime: '72 hours maximum',
      contact: config.gdpr.dpo
    };
  }

  /**
   * Create audit log entry
   */
  private async createAuditLog(logData: Omit<AuditLog, 'id'>): Promise<void> {
    const auditLog: AuditLog = {
      id: uuidv4(),
      ...logData
    };

    // Save to database (implementation required)
    await this.saveAuditLog(auditLog);
  }

  // Database operations (to be implemented)
  private async findUserById(userId: string): Promise<User | null> {
    throw new Error('Database implementation required');
  }

  private async getUserProfile(userId: string): Promise<any> {
    throw new Error('Database implementation required');
  }

  private async getUserConversations(userId: string): Promise<any> {
    throw new Error('Database implementation required');
  }

  private async getUserConsents(userId: string): Promise<GDPRConsent[]> {
    throw new Error('Database implementation required');
  }

  private async getUserAnalytics(userId: string): Promise<any> {
    throw new Error('Database implementation required');
  }

  private async getUserAuditLogs(userId: string): Promise<AuditLog[]> {
    throw new Error('Database implementation required');
  }

  private async collectExportableData(userId: string, includeConversations: boolean, includeAnalytics: boolean): Promise<any> {
    throw new Error('Database implementation required');
  }

  private async generateDataExport(data: any, format: string, exportId: string): Promise<string> {
    throw new Error('Export generation implementation required');
  }

  private async validateDataErasure(userId: string): Promise<{ canErase: boolean; reason?: string }> {
    throw new Error('Database implementation required');
  }

  private async performDataErasure(userId: string, retainForLegal: boolean): Promise<{ erasedDataTypes: string[] }> {
    throw new Error('Database implementation required');
  }

  private async validateDataCorrections(dataType: string, corrections: Record<string, any>): Promise<{ isValid: boolean; errors: string[] }> {
    throw new Error('Validation implementation required');
  }

  private async applyDataCorrections(userId: string, dataType: string, corrections: Record<string, any>): Promise<void> {
    throw new Error('Database implementation required');
  }

  private async updateSingleConsent(userId: string, consentType: ConsentType, granted: boolean, reason?: string, ipAddress?: string): Promise<void> {
    throw new Error('Database implementation required');
  }

  private async findExpiredData(dataType: string, cutoffDate: Date): Promise<Array<{ id: string }>> {
    throw new Error('Database implementation required');
  }

  private async anonymizeData(dataType: string, recordId: string): Promise<void> {
    throw new Error('Database implementation required');
  }

  private async deleteData(dataType: string, recordId: string): Promise<void> {
    throw new Error('Database implementation required');
  }

  private async findDataProcessingRecords(userId: string): Promise<DataProcessingRecord[]> {
    throw new Error('Database implementation required');
  }

  private async saveAuditLog(auditLog: AuditLog): Promise<void> {
    throw new Error('Database implementation required');
  }

  private hasDataAccessPermission(requester: User, targetUserId: string): boolean {
    // Implementation would check business relationships, admin rights, etc.
    return false;
  }
}
