"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DataRetentionError = exports.GDPRComplianceError = exports.ServiceTextProError = exports.UrgencyLevel = exports.ProblemType = exports.ConversationState = exports.MessageStatus = exports.MessagePlatform = exports.BusinessType = exports.UserStatus = exports.UserRole = exports.ConsentType = exports.DataProcessingBasis = void 0;
var DataProcessingBasis;
(function (DataProcessingBasis) {
    DataProcessingBasis["LEGITIMATE_INTEREST"] = "legitimate_interest";
    DataProcessingBasis["CONSENT"] = "consent";
    DataProcessingBasis["CONTRACT"] = "contract";
    DataProcessingBasis["LEGAL_OBLIGATION"] = "legal_obligation";
})(DataProcessingBasis || (exports.DataProcessingBasis = DataProcessingBasis = {}));
var ConsentType;
(function (ConsentType) {
    ConsentType["ESSENTIAL_SERVICE"] = "essential_service";
    ConsentType["ANALYTICS"] = "analytics";
    ConsentType["MARKETING"] = "marketing";
    ConsentType["THIRD_PARTY_INTEGRATIONS"] = "third_party_integrations";
    ConsentType["DATA_SHARING"] = "data_sharing";
})(ConsentType || (exports.ConsentType = ConsentType = {}));
var UserRole;
(function (UserRole) {
    UserRole["TRADESPERSON"] = "tradesperson";
    UserRole["CUSTOMER"] = "customer";
    UserRole["EMPLOYEE"] = "employee";
    UserRole["ADMIN"] = "admin";
})(UserRole || (exports.UserRole = UserRole = {}));
var UserStatus;
(function (UserStatus) {
    UserStatus["ACTIVE"] = "active";
    UserStatus["SUSPENDED"] = "suspended";
    UserStatus["DELETED"] = "deleted";
    UserStatus["PENDING_VERIFICATION"] = "pending_verification";
})(UserStatus || (exports.UserStatus = UserStatus = {}));
var BusinessType;
(function (BusinessType) {
    BusinessType["ELECTRICAL"] = "electrical";
    BusinessType["PLUMBING"] = "plumbing";
    BusinessType["HVAC"] = "hvac";
    BusinessType["GENERAL_CONTRACTOR"] = "general_contractor";
    BusinessType["OTHER"] = "other";
})(BusinessType || (exports.BusinessType = BusinessType = {}));
var MessagePlatform;
(function (MessagePlatform) {
    MessagePlatform["WHATSAPP"] = "whatsapp";
    MessagePlatform["VIBER"] = "viber";
    MessagePlatform["TELEGRAM"] = "telegram";
    MessagePlatform["SMS"] = "sms";
    MessagePlatform["EMAIL"] = "email";
})(MessagePlatform || (exports.MessagePlatform = MessagePlatform = {}));
var MessageStatus;
(function (MessageStatus) {
    MessageStatus["PENDING"] = "pending";
    MessageStatus["SENT"] = "sent";
    MessageStatus["DELIVERED"] = "delivered";
    MessageStatus["READ"] = "read";
    MessageStatus["FAILED"] = "failed";
})(MessageStatus || (exports.MessageStatus = MessageStatus = {}));
var ConversationState;
(function (ConversationState) {
    ConversationState["INITIAL_RESPONSE"] = "initial_response";
    ConversationState["AWAITING_DESCRIPTION"] = "awaiting_description";
    ConversationState["ANALYZING"] = "analyzing";
    ConversationState["FOLLOW_UP_QUESTIONS"] = "follow_up_questions";
    ConversationState["COMPLETED"] = "completed";
    ConversationState["CLOSED"] = "closed";
})(ConversationState || (exports.ConversationState = ConversationState = {}));
var ProblemType;
(function (ProblemType) {
    ProblemType["ELECTRICAL_EMERGENCY"] = "electrical_emergency";
    ProblemType["ELECTRICAL_ROUTINE"] = "electrical_routine";
    ProblemType["PLUMBING_EMERGENCY"] = "plumbing_emergency";
    ProblemType["PLUMBING_ROUTINE"] = "plumbing_routine";
    ProblemType["HVAC_EMERGENCY"] = "hvac_emergency";
    ProblemType["HVAC_ROUTINE"] = "hvac_routine";
    ProblemType["GENERAL"] = "general";
    ProblemType["UNKNOWN"] = "unknown";
})(ProblemType || (exports.ProblemType = ProblemType = {}));
var UrgencyLevel;
(function (UrgencyLevel) {
    UrgencyLevel["LOW"] = "low";
    UrgencyLevel["MEDIUM"] = "medium";
    UrgencyLevel["HIGH"] = "high";
    UrgencyLevel["EMERGENCY"] = "emergency";
})(UrgencyLevel || (exports.UrgencyLevel = UrgencyLevel = {}));
class ServiceTextProError extends Error {
    constructor(message, code = 'INTERNAL_ERROR', statusCode = 500, isOperational = true) {
        super(message);
        this.code = code;
        this.statusCode = statusCode;
        this.isOperational = isOperational;
        this.timestamp = new Date();
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.ServiceTextProError = ServiceTextProError;
class GDPRComplianceError extends ServiceTextProError {
    constructor(message, details) {
        super(message, 'GDPR_COMPLIANCE_ERROR', 403, true);
        this.name = 'GDPRComplianceError';
    }
}
exports.GDPRComplianceError = GDPRComplianceError;
class DataRetentionError extends ServiceTextProError {
    constructor(message, details) {
        super(message, 'DATA_RETENTION_ERROR', 410, true);
        this.name = 'DataRetentionError';
    }
}
exports.DataRetentionError = DataRetentionError;
//# sourceMappingURL=index.js.map