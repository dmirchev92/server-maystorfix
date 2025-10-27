"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GDPRService = void 0;
const uuid_1 = require("uuid");
const config_1 = __importDefault(require("../utils/config"));
const logger_1 = __importStar(require("../utils/logger"));
const types_1 = require("../types");
class GDPRService {
    constructor() {
        this.retentionPolicies = new Map();
        this.initializeRetentionPolicies();
    }
    initializeRetentionPolicies() {
        const policies = [
            {
                dataType: 'user_profile',
                retentionPeriodMonths: config_1.default.gdpr.dataRetention.businessDataMonths,
                autoDeleteEnabled: config_1.default.gdpr.compliance.autoDeleteExpiredData,
                legalBasis: types_1.DataProcessingBasis.CONTRACT
            },
            {
                dataType: 'conversation_data',
                retentionPeriodMonths: config_1.default.gdpr.dataRetention.conversationMonths,
                autoDeleteEnabled: config_1.default.gdpr.compliance.autoDeleteExpiredData,
                legalBasis: types_1.DataProcessingBasis.LEGITIMATE_INTEREST
            },
            {
                dataType: 'analytics_data',
                retentionPeriodMonths: config_1.default.gdpr.dataRetention.analyticsMonths,
                autoDeleteEnabled: true,
                legalBasis: types_1.DataProcessingBasis.CONSENT
            },
            {
                dataType: 'audit_logs',
                retentionPeriodMonths: config_1.default.gdpr.dataRetention.auditLogMonths,
                autoDeleteEnabled: false,
                legalBasis: types_1.DataProcessingBasis.LEGAL_OBLIGATION
            }
        ];
        policies.forEach(policy => {
            this.retentionPolicies.set(policy.dataType, policy);
        });
    }
    async handleDataAccessRequest(userId, requestedBy, ipAddress) {
        try {
            await this.validateDataSubjectRequest(userId, requestedBy);
            const userData = await this.collectUserData(userId);
            logger_1.gdprLogger.logPrivacyRightRequest(userId, 'DATA_ACCESS', 'COMPLETED');
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
            logger_1.default.info('Data access request completed', {
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
                    dpo: config_1.default.gdpr.dpo,
                    privacyPolicy: config_1.default.gdpr.urls.privacyPolicy
                }
            };
        }
        catch (error) {
            logger_1.default.error('Data access request failed', { error: error instanceof Error ? error.message : 'Unknown error', userId });
            throw error;
        }
    }
    async handleDataExportRequest(request) {
        try {
            await this.validateDataSubjectRequest(request.userId, request.requestedBy);
            const exportData = await this.collectExportableData(request.userId, request.includeConversations, request.includeAnalytics);
            const exportId = (0, uuid_1.v4)();
            const exportUrl = await this.generateDataExport(exportData, request.format, exportId);
            logger_1.gdprLogger.logPrivacyRightRequest(request.userId, 'DATA_PORTABILITY', 'COMPLETED');
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
            logger_1.default.info('Data export request completed', {
                userId: request.userId,
                exportId,
                format: request.format
            });
            return exportUrl;
        }
        catch (error) {
            logger_1.default.error('Data export request failed', { error: error instanceof Error ? error.message : 'Unknown error', userId: request.userId });
            throw error;
        }
    }
    async handleDataErasureRequest(request) {
        try {
            await this.validateDataSubjectRequest(request.userId, request.requestedBy);
            const erasureValidation = await this.validateDataErasure(request.userId);
            if (!erasureValidation.canErase) {
                throw new types_1.GDPRComplianceError(`Data cannot be erased: ${erasureValidation.reason}`);
            }
            const erasureResult = await this.performDataErasure(request.userId, request.retainForLegalReasons || false);
            logger_1.gdprLogger.logPrivacyRightRequest(request.userId, 'DATA_ERASURE', 'COMPLETED');
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
            logger_1.default.info('Data erasure request completed', {
                userId: request.userId,
                erasedTypes: erasureResult.erasedDataTypes.length
            });
        }
        catch (error) {
            logger_1.default.error('Data erasure request failed', { error: error instanceof Error ? error.message : 'Unknown error', userId: request.userId });
            throw error;
        }
    }
    async handleDataRectificationRequest(request) {
        try {
            await this.validateDataSubjectRequest(request.userId, request.requestedBy);
            const validationResult = await this.validateDataCorrections(request.dataType, request.corrections);
            if (!validationResult.isValid) {
                throw new types_1.ServiceTextProError(`Invalid data corrections: ${validationResult.errors.join(', ')}`, 'INVALID_DATA_CORRECTIONS', 400);
            }
            await this.applyDataCorrections(request.userId, request.dataType, request.corrections);
            logger_1.gdprLogger.logPrivacyRightRequest(request.userId, 'DATA_RECTIFICATION', 'COMPLETED');
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
            logger_1.default.info('Data rectification request completed', {
                userId: request.userId,
                dataType: request.dataType
            });
        }
        catch (error) {
            logger_1.default.error('Data rectification request failed', {
                error: error instanceof Error ? error.message : 'Unknown error',
                userId: request.userId
            });
            throw error;
        }
    }
    async updateUserConsents(request) {
        try {
            await this.validateDataSubjectRequest(request.userId, request.requestedBy);
            for (const consentUpdate of request.consents) {
                await this.updateSingleConsent(request.userId, consentUpdate.consentType, consentUpdate.granted, consentUpdate.reason, request.ipAddress);
                logger_1.gdprLogger.logConsentChange(request.userId, consentUpdate.consentType, consentUpdate.granted, request.ipAddress);
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
            logger_1.default.info('User consents updated', {
                userId: request.userId,
                consentsCount: request.consents.length
            });
        }
        catch (error) {
            logger_1.default.error('Consent update failed', { error: error instanceof Error ? error.message : 'Unknown error', userId: request.userId });
            throw error;
        }
    }
    async runDataRetentionCleanup() {
        try {
            let deletedRecords = 0;
            let anonymizedRecords = 0;
            for (const [dataType, policy] of this.retentionPolicies) {
                if (!policy.autoDeleteEnabled)
                    continue;
                const cutoffDate = new Date();
                cutoffDate.setMonth(cutoffDate.getMonth() - policy.retentionPeriodMonths);
                const expiredData = await this.findExpiredData(dataType, cutoffDate);
                for (const record of expiredData) {
                    if (config_1.default.gdpr.compliance.anonymizeExpiredData && dataType !== 'audit_logs') {
                        await this.anonymizeData(dataType, record.id);
                        anonymizedRecords++;
                    }
                    else {
                        await this.deleteData(dataType, record.id);
                        deletedRecords++;
                    }
                }
                logger_1.gdprLogger.logDataRetention(dataType, 'DELETED', expiredData.length);
            }
            logger_1.default.info('Data retention cleanup completed', {
                deletedRecords,
                anonymizedRecords
            });
            return { deletedRecords, anonymizedRecords };
        }
        catch (error) {
            logger_1.default.error('Data retention cleanup failed', { error: error instanceof Error ? error.message : 'Unknown error' });
            throw error;
        }
    }
    async getDataProcessingInformation(userId) {
        try {
            const records = await this.findDataProcessingRecords(userId);
            logger_1.default.info('Data processing information retrieved', {
                userId,
                recordsCount: records.length
            });
            return records;
        }
        catch (error) {
            logger_1.default.error('Failed to retrieve data processing information', {
                error: error instanceof Error ? error.message : 'Unknown error',
                userId
            });
            throw error;
        }
    }
    async validateDataSubjectRequest(userId, requestedBy) {
        if (userId !== requestedBy) {
            const requester = await this.findUserById(requestedBy);
            if (!requester || !this.hasDataAccessPermission(requester, userId)) {
                throw new types_1.GDPRComplianceError('Unauthorized data access request');
            }
        }
        const user = await this.findUserById(userId);
        if (!user) {
            throw new types_1.ServiceTextProError('User not found', 'USER_NOT_FOUND', 404);
        }
        if (user.dataRetentionUntil < new Date()) {
            throw new types_1.DataRetentionError('User data has expired and may have been deleted');
        }
    }
    async collectUserData(userId) {
        return {
            user: await this.getUserProfile(userId),
            conversations: await this.getUserConversations(userId),
            consents: await this.getUserConsents(userId),
            analytics: await this.getUserAnalytics(userId),
            auditLogs: await this.getUserAuditLogs(userId)
        };
    }
    getRetentionInformation(userId) {
        const policies = Array.from(this.retentionPolicies.entries()).map(([dataType, policy]) => ({
            dataType,
            retentionPeriod: `${policy.retentionPeriodMonths} months`,
            legalBasis: policy.legalBasis,
            autoDelete: policy.autoDeleteEnabled
        }));
        return {
            policies,
            generalInformation: 'Data is retained according to Bulgarian and EU legal requirements',
            contactForQuestions: config_1.default.gdpr.dpo.email
        };
    }
    getRightsInformation() {
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
            contact: config_1.default.gdpr.dpo
        };
    }
    async createAuditLog(logData) {
        const auditLog = {
            id: (0, uuid_1.v4)(),
            ...logData
        };
        await this.saveAuditLog(auditLog);
    }
    async findUserById(userId) {
        throw new Error('Database implementation required');
    }
    async getUserProfile(userId) {
        throw new Error('Database implementation required');
    }
    async getUserConversations(userId) {
        throw new Error('Database implementation required');
    }
    async getUserConsents(userId) {
        throw new Error('Database implementation required');
    }
    async getUserAnalytics(userId) {
        throw new Error('Database implementation required');
    }
    async getUserAuditLogs(userId) {
        throw new Error('Database implementation required');
    }
    async collectExportableData(userId, includeConversations, includeAnalytics) {
        throw new Error('Database implementation required');
    }
    async generateDataExport(data, format, exportId) {
        throw new Error('Export generation implementation required');
    }
    async validateDataErasure(userId) {
        throw new Error('Database implementation required');
    }
    async performDataErasure(userId, retainForLegal) {
        throw new Error('Database implementation required');
    }
    async validateDataCorrections(dataType, corrections) {
        throw new Error('Validation implementation required');
    }
    async applyDataCorrections(userId, dataType, corrections) {
        throw new Error('Database implementation required');
    }
    async updateSingleConsent(userId, consentType, granted, reason, ipAddress) {
        throw new Error('Database implementation required');
    }
    async findExpiredData(dataType, cutoffDate) {
        throw new Error('Database implementation required');
    }
    async anonymizeData(dataType, recordId) {
        throw new Error('Database implementation required');
    }
    async deleteData(dataType, recordId) {
        throw new Error('Database implementation required');
    }
    async findDataProcessingRecords(userId) {
        throw new Error('Database implementation required');
    }
    async saveAuditLog(auditLog) {
        throw new Error('Database implementation required');
    }
    hasDataAccessPermission(requester, targetUserId) {
        return false;
    }
}
exports.GDPRService = GDPRService;
//# sourceMappingURL=GDPRService.js.map