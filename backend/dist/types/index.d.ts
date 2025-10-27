import { Request } from 'express';
export declare enum DataProcessingBasis {
    LEGITIMATE_INTEREST = "legitimate_interest",
    CONSENT = "consent",
    CONTRACT = "contract",
    LEGAL_OBLIGATION = "legal_obligation"
}
export declare enum ConsentType {
    ESSENTIAL_SERVICE = "essential_service",
    ANALYTICS = "analytics",
    MARKETING = "marketing",
    THIRD_PARTY_INTEGRATIONS = "third_party_integrations",
    DATA_SHARING = "data_sharing"
}
export interface GDPRConsent {
    id: string;
    userId: string;
    consentType: ConsentType;
    granted: boolean;
    timestamp: Date;
    ipAddress?: string;
    userAgent?: string;
    withdrawnAt?: Date;
    legalBasis: DataProcessingBasis;
}
export interface DataRetentionPolicy {
    dataType: string;
    retentionPeriodMonths: number;
    autoDeleteEnabled: boolean;
    legalBasis: DataProcessingBasis;
}
export declare enum UserRole {
    TRADESPERSON = "tradesperson",
    CUSTOMER = "customer",
    EMPLOYEE = "employee",
    ADMIN = "admin"
}
export declare enum UserStatus {
    ACTIVE = "active",
    SUSPENDED = "suspended",
    DELETED = "deleted",
    PENDING_VERIFICATION = "pending_verification"
}
export interface User {
    id: string;
    email: string;
    passwordHash: string;
    role: UserRole;
    status: UserStatus;
    firstName: string;
    lastName: string;
    phoneNumber: string;
    profilePictureUrl?: string;
    businessId?: string;
    createdAt: Date;
    updatedAt: Date;
    lastLoginAt?: Date;
    gdprConsents: GDPRConsent[];
    dataRetentionUntil: Date;
    isGdprCompliant: boolean;
}
export interface AuthTokens {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
    tokenType: 'Bearer';
}
export interface AuthRequest extends Request {
    user?: User;
    tokenPayload?: JWTPayload;
}
export interface JWTPayload {
    userId: string;
    email: string;
    role: UserRole;
    businessId?: string;
    iat: number;
    exp: number;
}
export declare enum BusinessType {
    ELECTRICAL = "electrical",
    PLUMBING = "plumbing",
    HVAC = "hvac",
    GENERAL_CONTRACTOR = "general_contractor",
    OTHER = "other"
}
export interface BulgarianBusinessInfo {
    eik: string;
    ddsNumber?: string;
    companyName: string;
    companyNameBg: string;
    legalAddress: string;
    businessType: BusinessType;
    certifications: BulgarianCertification[];
    serviceAreas: string[];
    workingHours: BusinessHours;
    emergencyContact?: string;
}
export interface BulgarianCertification {
    id: string;
    type: 'electrical' | 'plumbing' | 'hvac' | 'safety' | 'other';
    certificationNumber: string;
    issuedBy: string;
    issuedAt: Date;
    expiresAt?: Date;
    isActive: boolean;
    documentUrl?: string;
}
export interface BusinessHours {
    monday: DaySchedule;
    tuesday: DaySchedule;
    wednesday: DaySchedule;
    thursday: DaySchedule;
    friday: DaySchedule;
    saturday: DaySchedule;
    sunday: DaySchedule;
    holidays: HolidaySchedule[];
}
export interface DaySchedule {
    isOpen: boolean;
    openTime?: string;
    closeTime?: string;
    breakStart?: string;
    breakEnd?: string;
}
export interface HolidaySchedule {
    date: Date;
    name: string;
    isOpen: boolean;
    specialHours?: DaySchedule;
}
export declare enum MessagePlatform {
    WHATSAPP = "whatsapp",
    VIBER = "viber",
    TELEGRAM = "telegram",
    SMS = "sms",
    EMAIL = "email"
}
export declare enum MessageStatus {
    PENDING = "pending",
    SENT = "sent",
    DELIVERED = "delivered",
    READ = "read",
    FAILED = "failed"
}
export declare enum ConversationState {
    INITIAL_RESPONSE = "initial_response",
    AWAITING_DESCRIPTION = "awaiting_description",
    ANALYZING = "analyzing",
    FOLLOW_UP_QUESTIONS = "follow_up_questions",
    COMPLETED = "completed",
    CLOSED = "closed"
}
export interface Message {
    id: string;
    conversationId: string;
    platform: MessagePlatform;
    direction: 'inbound' | 'outbound';
    content: string;
    status: MessageStatus;
    timestamp: Date;
    deliveredAt?: Date;
    readAt?: Date;
    metadata?: Record<string, any>;
    gdprRetentionUntil: Date;
}
export interface Conversation {
    id: string;
    businessId: string;
    customerPhoneNumber: string;
    customerName?: string;
    platform: MessagePlatform;
    state: ConversationState;
    priority: 'low' | 'medium' | 'high' | 'emergency';
    startedAt: Date;
    lastMessageAt: Date;
    closedAt?: Date;
    messages: Message[];
    aiAnalysis?: AIAnalysisResult;
    gdprRetentionUntil: Date;
    customerConsent?: GDPRConsent;
}
export declare enum ProblemType {
    ELECTRICAL_EMERGENCY = "electrical_emergency",
    ELECTRICAL_ROUTINE = "electrical_routine",
    PLUMBING_EMERGENCY = "plumbing_emergency",
    PLUMBING_ROUTINE = "plumbing_routine",
    HVAC_EMERGENCY = "hvac_emergency",
    HVAC_ROUTINE = "hvac_routine",
    GENERAL = "general",
    UNKNOWN = "unknown"
}
export declare enum UrgencyLevel {
    LOW = "low",
    MEDIUM = "medium",
    HIGH = "high",
    EMERGENCY = "emergency"
}
export interface AIAnalysisResult {
    id: string;
    conversationId: string;
    problemType: ProblemType;
    urgencyLevel: UrgencyLevel;
    extractedKeywords: string[];
    customerDescription: string;
    recommendedActions: string[];
    estimatedCost?: {
        min: number;
        max: number;
        currency: 'BGN';
    };
    requiredTools?: string[];
    safetyWarnings?: string[];
    analysisConfidence: number;
    processingTime: number;
    createdAt: Date;
}
export interface BulgarianKeywordDictionary {
    emergencyKeywords: string[];
    problemTypeKeywords: Record<ProblemType, string[]>;
    urgencyIndicators: string[];
    locationKeywords: string[];
    timeIndicators: string[];
}
export interface BusinessMetrics {
    businessId: string;
    period: {
        start: Date;
        end: Date;
    };
    missedCalls: number;
    responsesSent: number;
    conversationsStarted: number;
    conversationsCompleted: number;
    conversionRate: number;
    averageResponseTime: number;
    customerSatisfactionScore?: number;
    platformBreakdown: Record<MessagePlatform, number>;
    revenueImpact?: {
        estimatedJobsBooked: number;
        estimatedRevenue: number;
        currency: 'BGN';
    };
}
export interface SystemMetrics {
    totalUsers: number;
    activeUsers: number;
    totalBusinesses: number;
    totalConversations: number;
    totalMessages: number;
    averageResponseTime: number;
    systemUptime: number;
    gdprComplianceScore: number;
    dataRetentionCompliance: number;
}
export interface APIResponse<T = any> {
    success: boolean;
    data?: T;
    error?: {
        code: string;
        message: string;
        details?: any;
    };
    metadata?: {
        timestamp: Date;
        requestId: string;
        version: string;
    };
    gdpr?: {
        dataProcessingBasis: DataProcessingBasis;
        retentionPeriod: string;
        rightsInformation: string;
    };
}
export interface PaginatedResponse<T> extends APIResponse<T[]> {
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
        hasNext: boolean;
        hasPrev: boolean;
    };
}
export interface DatabaseConfig {
    postgresql: {
        host: string;
        port: number;
        database: string;
        username: string;
        password: string;
        ssl: boolean;
        maxConnections: number;
    };
    mongodb: {
        uri: string;
        database: string;
    };
    redis: {
        host: string;
        port: number;
        password?: string;
        db: number;
    };
}
export interface WhatsAppConfig {
    accessToken: string;
    phoneNumberId: string;
    webhookVerifyToken: string;
    businessAccountId: string;
}
export interface ViberConfig {
    authToken: string;
    botName: string;
    webhookUrl: string;
}
export interface TelegramConfig {
    botToken: string;
    webhookUrl: string;
}
export interface AuditLog {
    id: string;
    userId?: string;
    action: string;
    resource: string;
    resourceId: string;
    details: Record<string, any>;
    ipAddress: string;
    userAgent: string;
    timestamp: Date;
    gdprRelevant: boolean;
}
export interface DataProcessingRecord {
    id: string;
    dataSubjectId: string;
    dataType: string;
    processingPurpose: string;
    legalBasis: DataProcessingBasis;
    dataSource: string;
    processingStarted: Date;
    processingEnded?: Date;
    retentionUntil: Date;
    thirdPartyProcessors: string[];
    gdprRights: {
        accessRequested: boolean;
        rectificationRequested: boolean;
        erasureRequested: boolean;
        portabilityRequested: boolean;
        objectingToProcessing: boolean;
    };
}
export declare class ServiceTextProError extends Error {
    readonly code: string;
    readonly statusCode: number;
    readonly isOperational: boolean;
    readonly timestamp: Date;
    constructor(message: string, code?: string, statusCode?: number, isOperational?: boolean);
}
export declare class GDPRComplianceError extends ServiceTextProError {
    constructor(message: string, details?: any);
}
export declare class DataRetentionError extends ServiceTextProError {
    constructor(message: string, details?: any);
}
//# sourceMappingURL=index.d.ts.map