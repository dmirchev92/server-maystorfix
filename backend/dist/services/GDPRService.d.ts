import { ConsentType, DataProcessingRecord } from '../types';
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
export declare class GDPRService {
    private readonly retentionPolicies;
    constructor();
    private initializeRetentionPolicies;
    handleDataAccessRequest(userId: string, requestedBy: string, ipAddress?: string): Promise<any>;
    handleDataExportRequest(request: DataExportRequest): Promise<string>;
    handleDataErasureRequest(request: DataErasureRequest): Promise<void>;
    handleDataRectificationRequest(request: DataRectificationRequest): Promise<void>;
    updateUserConsents(request: ConsentUpdateRequest): Promise<void>;
    runDataRetentionCleanup(): Promise<{
        deletedRecords: number;
        anonymizedRecords: number;
    }>;
    getDataProcessingInformation(userId: string): Promise<DataProcessingRecord[]>;
    private validateDataSubjectRequest;
    private collectUserData;
    private getRetentionInformation;
    private getRightsInformation;
    private createAuditLog;
    private findUserById;
    private getUserProfile;
    private getUserConversations;
    private getUserConsents;
    private getUserAnalytics;
    private getUserAuditLogs;
    private collectExportableData;
    private generateDataExport;
    private validateDataErasure;
    private performDataErasure;
    private validateDataCorrections;
    private applyDataCorrections;
    private updateSingleConsent;
    private findExpiredData;
    private anonymizeData;
    private deleteData;
    private findDataProcessingRecords;
    private saveAuditLog;
    private hasDataAccessPermission;
}
//# sourceMappingURL=GDPRService.d.ts.map