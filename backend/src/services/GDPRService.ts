// GDPR Compliance Service
// Handles all GDPR-related operations including data rights, retention, and audit

import { v4 as uuidv4 } from 'uuid';
import config from '../utils/config';
import logger, { gdprLogger } from '../utils/logger';
import {
  User,
  GDPRConsent,
  ConsentType,
  ConsentCheckResult,
  CONSENT_TYPE_MAPPING,
  DataProcessingBasis,
  DataProcessingRecord,
  DataRetentionPolicy,
  AuditLog,
  ServiceTextProError,
  GDPRComplianceError,
  DataRetentionError,
  APIResponse
} from '../types';
import { DatabaseFactory } from '../models/DatabaseFactory';

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
  private static instance: GDPRService;
  private readonly retentionPolicies: Map<string, DataRetentionPolicy>;
  private readonly consentCache: Map<string, { consents: ConsentType[]; timestamp: number }>;
  private readonly CACHE_TTL = 15 * 60 * 1000; // 15 minutes

  constructor() {
    this.retentionPolicies = new Map();
    this.consentCache = new Map();
    this.initializeRetentionPolicies();
  }

  /**
   * Get singleton instance of GDPRService
   * Ensures all services share the same consent cache
   */
  static getInstance(): GDPRService {
    if (!GDPRService.instance) {
      GDPRService.instance = new GDPRService();
    }
    return GDPRService.instance;
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
   * Normalize consent type from mobile format to backend format
   */
  normalizeConsentType(consentType: string): ConsentType {
    const normalized = CONSENT_TYPE_MAPPING[consentType.toLowerCase()];
    if (!normalized) {
      logger.warn('Unknown consent type, defaulting to ESSENTIAL_SERVICE', { consentType });
      return ConsentType.ESSENTIAL_SERVICE;
    }
    return normalized;
  }

  /**
   * Check if user has granted a specific consent
   */
  async checkUserConsent(userId: string, consentType: ConsentType): Promise<ConsentCheckResult> {
    try {
      // Validate inputs
      if (!userId || !consentType) {
        return {
          allowed: false,
          reason: 'Invalid userId or consentType',
          consentType: consentType || ConsentType.ESSENTIAL_SERVICE,
          requiresConsent: true
        };
      }

      // Check cache first - use getUserActiveConsents which has caching
      const cached = this.consentCache.get(userId);
      if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
        logger.debug('📦 Consent cache hit for checkUserConsent', { userId, consentType });
        const hasConsent = cached.consents.includes(consentType);
        return {
          allowed: hasConsent,
          consentType,
          requiresConsent: true,
          reason: hasConsent ? undefined : `User has not granted ${consentType} consent`
        };
      }

      const db = DatabaseFactory.getDatabase();
      const isPostgreSQL = DatabaseFactory.isPostgreSQL();

      // Query database for active consent
      let rows: any[];
      if (isPostgreSQL) {
        // PostgreSQL: query() returns rows directly
        rows = await (db as any).query(
          `SELECT * FROM gdpr_consents
           WHERE user_id = $1
           AND consent_type = $2
           AND granted = true
           AND withdrawn_at IS NULL
           ORDER BY timestamp DESC
           LIMIT 1`,
          [userId, consentType]
        );
      } else {
        // SQLite: Use different query interface
        rows = await new Promise<any[]>((resolve, reject) => {
          (db as any)._db.all(
            `SELECT * FROM gdpr_consents
             WHERE user_id = ?
             AND consent_type = ?
             AND granted = 1
             AND withdrawn_at IS NULL
             ORDER BY timestamp DESC
             LIMIT 1`,
            [userId, consentType],
            (err: any, rows: any[]) => {
              if (err) reject(err);
              else resolve(rows || []);
            }
          );
        });
      }

      if (rows && rows.length > 0) {
        const consent = rows[0];

        // Update cache with this consent
        const existingCache = this.consentCache.get(userId);
        if (existingCache) {
          if (!existingCache.consents.includes(consentType)) {
            existingCache.consents.push(consentType);
          }
        } else {
          this.consentCache.set(userId, {
            consents: [consentType],
            timestamp: Date.now()
          });
        }

        logger.debug('✅ Consent check: granted', { userId, consentType });

        return {
          allowed: true,
          consentType,
          grantedAt: new Date(consent.timestamp),
          requiresConsent: true
        };
      }

      // Update cache to remember denial as well
      const existingCache = this.consentCache.get(userId);
      if (!existingCache) {
        this.consentCache.set(userId, {
          consents: [],
          timestamp: Date.now()
        });
      }

      logger.debug('❌ Consent check: not granted', { userId, consentType });

      return {
        allowed: false,
        reason: `User has not granted ${consentType} consent`,
        consentType,
        requiresConsent: true
      };
    } catch (error) {
      logger.error('❌ Consent check failed', { error, userId, consentType });

      // Fail-safe: deny if we can't verify
      return {
        allowed: false,
        reason: 'Error checking consent',
        consentType,
        requiresConsent: true
      };
    }
  }

  /**
   * Check multiple consents at once (batch operation)
   */
  async checkUserConsents(
    userId: string,
    consentTypes: ConsentType[]
  ): Promise<Record<ConsentType, ConsentCheckResult>> {
    const results: Record<ConsentType, ConsentCheckResult> = {} as any;

    // Check all consents in parallel
    await Promise.all(
      consentTypes.map(async (consentType) => {
        results[consentType] = await this.checkUserConsent(userId, consentType);
      })
    );

    return results;
  }

  /**
   * Get user's active consents (with caching)
   */
  async getUserActiveConsents(userId: string): Promise<ConsentType[]> {
    try {
      // Check cache first
      const cached = this.consentCache.get(userId);
      if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
        logger.debug('📦 Consent cache hit', { userId });
        return cached.consents;
      }

      // Query database
      const db = DatabaseFactory.getDatabase();
      const isPostgreSQL = DatabaseFactory.isPostgreSQL();

      let rows: any[];
      if (isPostgreSQL) {
        // PostgreSQL: query() returns rows directly
        rows = await (db as any).query(
          `SELECT DISTINCT consent_type FROM gdpr_consents
           WHERE user_id = $1
           AND granted = true
           AND withdrawn_at IS NULL`,
          [userId]
        );
      } else {
        // SQLite: Use different query interface
        rows = await new Promise<any[]>((resolve, reject) => {
          (db as any)._db.all(
            `SELECT DISTINCT consent_type FROM gdpr_consents
             WHERE user_id = ?
             AND granted = 1
             AND withdrawn_at IS NULL`,
            [userId],
            (err: any, rows: any[]) => {
              if (err) reject(err);
              else resolve(rows || []);
            }
          );
        });
      }

      const consents = rows.map((row: any) => row.consent_type as ConsentType);

      // Update cache
      this.consentCache.set(userId, {
        consents,
        timestamp: Date.now()
      });

      logger.debug('📝 Consent cache updated', { userId, consentsCount: consents.length });

      return consents;
    } catch (error) {
      logger.error('❌ Failed to get active consents', { error, userId });
      return [];
    }
  }

  /**
   * Clear consent cache for a user (call after consent updates)
   */
  clearConsentCache(userId: string): void {
    this.consentCache.delete(userId);
    logger.debug('Consent cache cleared', { userId });
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

  // ==================== Database Operations ====================

  private getPool(): any {
    const db = DatabaseFactory.getDatabase();
    return (db as any).getPool();
  }

  private async findUserById(userId: string): Promise<User | null> {
    try {
      const pool = this.getPool();
      const result = await pool.query(
        `SELECT id, email, first_name, last_name, role, phone_number, 
                status, created_at, updated_at, data_retention_until
         FROM users WHERE id = $1`,
        [userId]
      );
      if (result.rows.length === 0) return null;
      const row = result.rows[0];
      return {
        id: row.id,
        email: row.email,
        firstName: row.first_name,
        lastName: row.last_name,
        role: row.role,
        phoneNumber: row.phone_number,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        dataRetentionUntil: row.data_retention_until || new Date(Date.now() + 7 * 365 * 24 * 60 * 60 * 1000),
        isActive: row.status === 'active'
      } as any;
    } catch (error) {
      logger.error('findUserById failed', { error: error instanceof Error ? error.message : error, userId });
      return null;
    }
  }

  private async getUserProfile(userId: string): Promise<any> {
    const pool = this.getPool();
    const userResult = await pool.query(
      `SELECT id, email, first_name, last_name, role, phone_number, 
              city, created_at, updated_at
       FROM users WHERE id = $1`,
      [userId]
    );
    if (userResult.rows.length === 0) return null;


    const spResult = await pool.query(
      `SELECT business_name, description, service_category, city, 
              rating, total_reviews
       FROM service_provider_profiles WHERE user_id = $1`,
      [userId]
    );

    return {
      user: userResult.rows[0],
      providerProfile: spResult.rows[0] || null
    };
  }

  private async getUserConversations(userId: string): Promise<any> {
    const pool = this.getPool();
    const convos = await pool.query(
      `SELECT id, provider_id, customer_id, customer_name, status, chat_source, 
              created_at, last_message_at
       FROM marketplace_conversations 
       WHERE provider_id = $1 OR customer_id = $1
       ORDER BY created_at DESC LIMIT 100`,
      [userId]
    );

    const messageCount = await pool.query(
      `SELECT COUNT(*) as count FROM marketplace_chat_messages 
       WHERE sender_user_id = $1`,
      [userId]
    );

    return {
      conversations: convos.rows,
      totalConversations: convos.rows.length,
      totalMessagesSent: parseInt(messageCount.rows[0]?.count || '0')
    };
  }

  private async getUserConsents(userId: string): Promise<GDPRConsent[]> {
    const pool = this.getPool();
    const result = await pool.query(
      `SELECT id, consent_type, granted, timestamp, withdrawn_at, legal_basis, ip_address
       FROM gdpr_consents WHERE user_id = $1 ORDER BY timestamp DESC`,
      [userId]
    );
    return result.rows.map((row: any) => ({
      id: row.id,
      consentType: row.consent_type,
      granted: row.granted,
      timestamp: row.timestamp,
      withdrawnAt: row.withdrawn_at,
      legalBasis: row.legal_basis,
      ipAddress: row.ip_address
    }));
  }

  private async getUserAnalytics(userId: string): Promise<any> {
    const pool = this.getPool();
    const userPoints = await pool.query(
      `SELECT points_balance, points_total_earned, points_total_spent FROM users WHERE id = $1`,
      [userId]
    );
    const transactions = await pool.query(
      `SELECT COUNT(*) as count FROM sp_points_transactions WHERE user_id = $1`,
      [userId]
    );
    const smsPackages = await pool.query(
      `SELECT COALESCE(SUM(sms_count), 0) as total_sms FROM sp_sms_packages WHERE user_id = $1`,
      [userId]
    );
    return {
      pointsBalance: userPoints.rows[0]?.points_balance || 0,
      pointsTotalEarned: userPoints.rows[0]?.points_total_earned || 0,
      pointsTotalSpent: userPoints.rows[0]?.points_total_spent || 0,
      totalPointTransactions: parseInt(transactions.rows[0]?.count || '0'),
      totalSmsPurchased: parseInt(smsPackages.rows[0]?.total_sms || '0')
    };
  }

  private async getUserAuditLogs(userId: string): Promise<AuditLog[]> {
    // Audit logs are currently logged to file, not stored in DB
    // Return empty array - logs can be retrieved from server logs by DPO
    return [];
  }

  private async collectExportableData(userId: string, includeConversations: boolean, includeAnalytics: boolean): Promise<any> {
    const data: any = {
      profile: await this.getUserProfile(userId),
      consents: await this.getUserConsents(userId)
    };
    if (includeConversations) {
      data.conversations = await this.getUserConversations(userId);
    }
    if (includeAnalytics) {
      data.analytics = await this.getUserAnalytics(userId);
    }
    return data;
  }

  private async generateDataExport(data: any, format: string, exportId: string): Promise<string> {
    // For now, return a JSON download URL - actual file generation can be added later
    const fs = require('fs');
    const path = require('path');
    const exportDir = path.join(process.cwd(), 'uploads', 'gdpr-exports');
    if (!fs.existsSync(exportDir)) fs.mkdirSync(exportDir, { recursive: true });
    
    const filename = `gdpr_export_${exportId}.json`;
    const filePath = path.join(exportDir, filename);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    
    return `/uploads/gdpr-exports/${filename}`;
  }

  private async validateDataErasure(userId: string): Promise<{ canErase: boolean; reason?: string }> {
    // Check if there are any legal obligations preventing erasure
    const pool = this.getPool();
    const activeSubscription = await pool.query(
      `SELECT id FROM sp_subscription_history 
       WHERE user_id = $1 AND status = 'active' AND end_date > NOW()`,
      [userId]
    );
    
    if (activeSubscription.rows.length > 0) {
      return { canErase: false, reason: 'Имате активен абонамент. Моля, отменете го първо.' };
    }
    
    return { canErase: true };
  }

  private async performDataErasure(userId: string, retainForLegal: boolean): Promise<{ erasedDataTypes: string[] }> {
    const pool = this.getPool();
    const erasedTypes: string[] = [];

    // Delete chat messages
    await pool.query('DELETE FROM marketplace_chat_messages WHERE sender_user_id = $1', [userId]);
    erasedTypes.push('chat_messages');

    // Delete conversations where user is customer
    await pool.query('DELETE FROM marketplace_conversations WHERE customer_id = $1', [userId]);
    erasedTypes.push('conversations');

    // Delete notifications
    await pool.query('DELETE FROM notifications WHERE user_id = $1', [userId]);
    erasedTypes.push('notifications');

    // Delete device tokens
    await pool.query('DELETE FROM device_tokens WHERE user_id = $1', [userId]);
    erasedTypes.push('device_tokens');

    if (!retainForLegal) {
      // Anonymize user data instead of full delete (retain for audit)
      await pool.query(
        `UPDATE users SET 
          email = CONCAT('deleted_', id, '@erased.local'),
          first_name = 'Изтрит',
          last_name = 'Потребител',
          phone_number = NULL,
          status = 'deleted',
          updated_at = NOW()
         WHERE id = $1`,
        [userId]
      );
      erasedTypes.push('user_profile');
    }

    return { erasedDataTypes: erasedTypes };
  }

  private async validateDataCorrections(dataType: string, corrections: Record<string, any>): Promise<{ isValid: boolean; errors: string[] }> {
    const errors: string[] = [];
    const allowedFields: Record<string, string[]> = {
      user_profile: ['firstName', 'lastName', 'phoneNumber', 'city'],
      business_info: ['businessName', 'description', 'serviceCategory'],
      contact_info: ['email', 'phoneNumber']
    };

    const allowed = allowedFields[dataType];
    if (!allowed) {
      errors.push(`Невалиден тип данни: ${dataType}`);
      return { isValid: false, errors };
    }

    for (const field of Object.keys(corrections)) {
      if (!allowed.includes(field)) {
        errors.push(`Полето '${field}' не може да бъде коригирано за тип '${dataType}'`);
      }
    }

    return { isValid: errors.length === 0, errors };
  }

  private async applyDataCorrections(userId: string, dataType: string, corrections: Record<string, any>): Promise<void> {
    const pool = this.getPool();

    if (dataType === 'user_profile' || dataType === 'contact_info') {
      const fieldMap: Record<string, string> = {
        firstName: 'first_name', lastName: 'last_name',
        phoneNumber: 'phone_number', city: 'city', email: 'email'
      };
      for (const [key, value] of Object.entries(corrections)) {
        const dbField = fieldMap[key];
        if (dbField) {
          await pool.query(`UPDATE users SET ${dbField} = $1, updated_at = NOW() WHERE id = $2`, [value, userId]);
        }
      }
    } else if (dataType === 'business_info') {
      const fieldMap: Record<string, string> = {
        businessName: 'business_name', description: 'description',
        serviceCategory: 'service_category'
      };
      for (const [key, value] of Object.entries(corrections)) {
        const dbField = fieldMap[key];
        if (dbField) {
          await pool.query(`UPDATE service_provider_profiles SET ${dbField} = $1 WHERE user_id = $2`, [value, userId]);
        }
      }
    }
  }

  private async updateSingleConsent(userId: string, consentType: ConsentType, granted: boolean, reason?: string, ipAddress?: string): Promise<void> {
    const pool = this.getPool();
    const consentId = `consent_${userId}_${consentType}_${Date.now()}`;

    if (!granted) {
      await pool.query(
        `UPDATE gdpr_consents SET withdrawn_at = NOW() 
         WHERE user_id = $1 AND consent_type = $2 AND withdrawn_at IS NULL`,
        [userId, consentType]
      );
    }

    await pool.query(
      `INSERT INTO gdpr_consents (id, user_id, consent_type, granted, timestamp, ip_address, legal_basis)
       VALUES ($1, $2, $3, $4, NOW(), $5, 'consent')`,
      [consentId, userId, consentType, granted, ipAddress || 'unknown']
    );

    this.clearConsentCache(userId);
  }

  private async findExpiredData(dataType: string, cutoffDate: Date): Promise<Array<{ id: string }>> {
    const pool = this.getPool();
    const tableMap: Record<string, { table: string; dateField: string }> = {
      conversation_data: { table: 'marketplace_conversations', dateField: 'created_at' },
      analytics_data: { table: 'sp_sms_packages', dateField: 'created_at' }
    };

    const mapping = tableMap[dataType];
    if (!mapping) return [];

    const result = await pool.query(
      `SELECT id FROM ${mapping.table} WHERE ${mapping.dateField} < $1 LIMIT 1000`,
      [cutoffDate]
    );
    return result.rows;
  }

  private async anonymizeData(dataType: string, recordId: string): Promise<void> {
    const pool = this.getPool();
    if (dataType === 'conversation_data') {
      await pool.query(
        `UPDATE marketplace_conversations SET customer_name = 'Анонимен', customer_email = '', customer_phone = '' WHERE id = $1`,
        [recordId]
      );
    }
  }

  private async deleteData(dataType: string, recordId: string): Promise<void> {
    const pool = this.getPool();
    const tableMap: Record<string, string> = {
      conversation_data: 'marketplace_conversations',
      analytics_data: 'sms_logs'
    };
    const table = tableMap[dataType];
    if (table) {
      await pool.query(`DELETE FROM ${table} WHERE id = $1`, [recordId]);
    }
  }

  private async findDataProcessingRecords(userId: string): Promise<DataProcessingRecord[]> {
    // Return actual processing records based on user's data in the system
    const pool = this.getPool();
    const records: DataProcessingRecord[] = [];

    // Check what data exists for this user
    const user = await pool.query('SELECT role, created_at FROM users WHERE id = $1', [userId]);
    if (user.rows.length === 0) return records;

    const role = user.rows[0].role;

    records.push({
      dataType: 'user_profile',
      purpose: 'Регистрация и автентикация в платформата',
      legalBasis: DataProcessingBasis.CONTRACT,
      retentionPeriod: `${config.gdpr.dataRetention.businessDataMonths} месеца`,
      thirdPartyProcessors: [],
      dataSubjectCategory: role === 'tradesperson' ? 'Майстор' : 'Клиент'
    } as any);

    // Check for chat data
    const chatCount = await pool.query(
      'SELECT COUNT(*) as c FROM marketplace_chat_messages WHERE sender_user_id = $1', [userId]
    );
    if (parseInt(chatCount.rows[0].c) > 0) {
      records.push({
        dataType: 'chat_messages',
        purpose: 'Чат комуникация между майстори и клиенти',
        legalBasis: DataProcessingBasis.CONSENT,
        retentionPeriod: `${config.gdpr.dataRetention.conversationMonths} месеца`,
        thirdPartyProcessors: [],
        dataSubjectCategory: 'Участник в чат'
      } as any);
    }

    // Check for SMS data
    const smsCount = await pool.query(
      'SELECT COUNT(*) as c FROM sp_sms_packages WHERE user_id = $1', [userId]
    );
    if (parseInt(smsCount.rows[0].c) > 0) {
      records.push({
        dataType: 'sms_logs',
        purpose: 'Изпращане на SMS при пропуснати обаждания',
        legalBasis: DataProcessingBasis.LEGITIMATE_INTEREST,
        retentionPeriod: `${config.gdpr.dataRetention.analyticsMonths} месеца`,
        thirdPartyProcessors: ['Mobica SMS API'],
        dataSubjectCategory: 'Майстор'
      } as any);
    }

    // Push notifications
    const deviceTokens = await pool.query(
      'SELECT COUNT(*) as c FROM device_tokens WHERE user_id = $1', [userId]
    );
    if (parseInt(deviceTokens.rows[0].c) > 0) {
      records.push({
        dataType: 'device_tokens',
        purpose: 'Push известия за нови заявки и съобщения',
        legalBasis: DataProcessingBasis.CONSENT,
        retentionPeriod: 'До деактивиране на устройството',
        thirdPartyProcessors: ['Firebase Cloud Messaging (Google)'],
        dataSubjectCategory: role === 'tradesperson' ? 'Майстор' : 'Клиент'
      } as any);
    }

    return records;
  }

  private async saveAuditLog(auditLog: AuditLog): Promise<void> {
    // Log to GDPR audit logger (file-based for now)
    gdprLogger.logPrivacyRightRequest(
      auditLog.userId,
      auditLog.action,
      'LOGGED'
    );
    logger.info('GDPR Audit', {
      auditId: auditLog.id,
      userId: auditLog.userId,
      action: auditLog.action,
      resource: auditLog.resource,
      resourceId: auditLog.resourceId,
      ipAddress: auditLog.ipAddress,
      gdprRelevant: auditLog.gdprRelevant
    });
  }

  private hasDataAccessPermission(requester: User, targetUserId: string): boolean {
    // Admin users can access other users' data
    return (requester as any).role === 'admin';
  }
}
