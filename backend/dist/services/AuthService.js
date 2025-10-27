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
exports.AuthService = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const uuid_1 = require("uuid");
const config_1 = __importDefault(require("../utils/config"));
const logger_1 = __importStar(require("../utils/logger"));
const DatabaseFactory_1 = require("../models/DatabaseFactory");
const SecurityEnhancementServiceSimple_1 = __importDefault(require("./SecurityEnhancementServiceSimple"));
const types_1 = require("../types");
class AuthService {
    constructor() {
        this.jwtSecret = config_1.default.security.jwt.secret;
        this.jwtRefreshSecret = config_1.default.security.jwt.refreshSecret;
        this.jwtExpiresIn = config_1.default.security.jwt.expiresIn;
        this.jwtRefreshExpiresIn = config_1.default.security.jwt.refreshExpiresIn;
        this.bcryptRounds = config_1.default.security.bcrypt.rounds;
        this.database = DatabaseFactory_1.DatabaseFactory.getDatabase();
        this.securityService = SecurityEnhancementServiceSimple_1.default.getInstance();
    }
    async register(userData) {
        try {
            this.validateGDPRConsents(userData.gdprConsents);
            const existingUser = await this.findUserByEmail(userData.email);
            if (existingUser) {
                throw new types_1.ServiceTextProError('User already exists', 'USER_ALREADY_EXISTS', 409);
            }
            const passwordHash = await bcryptjs_1.default.hash(userData.password, this.bcryptRounds);
            const gdprConsents = userData.gdprConsents.map(consentType => ({
                id: (0, uuid_1.v4)(),
                userId: '',
                consentType,
                granted: true,
                timestamp: new Date(),
                ipAddress: userData.ipAddress,
                userAgent: userData.userAgent,
                legalBasis: consentType === types_1.ConsentType.ESSENTIAL_SERVICE
                    ? types_1.DataProcessingBasis.LEGITIMATE_INTEREST
                    : types_1.DataProcessingBasis.CONSENT
            }));
            const dataRetentionUntil = this.calculateDataRetentionDate(userData.role);
            const user = {
                id: (0, uuid_1.v4)(),
                email: userData.email.toLowerCase(),
                passwordHash,
                role: userData.role,
                status: types_1.UserStatus.PENDING_VERIFICATION,
                firstName: userData.firstName,
                lastName: userData.lastName,
                phoneNumber: userData.phoneNumber,
                businessId: userData.businessId,
                createdAt: new Date(),
                updatedAt: new Date(),
                gdprConsents: gdprConsents.map(consent => ({ ...consent, userId: '' })),
                dataRetentionUntil,
                isGdprCompliant: true
            };
            user.gdprConsents = user.gdprConsents.map(consent => ({ ...consent, userId: user.id }));
            const userId = await this.database.createUser(user);
            const savedUser = { ...user, id: userId };
            if (savedUser.role === types_1.UserRole.TRADESPERSON) {
                try {
                    logger_1.default.info('🔍 Registration data received', {
                        companyName: userData.companyName,
                        serviceCategory: userData.serviceCategory,
                        neighborhood: userData.neighborhood,
                        hasNeighborhood: !!userData.neighborhood
                    });
                    const defaultProfileData = {
                        businessName: userData.companyName || `${savedUser.firstName} ${savedUser.lastName}`,
                        serviceCategory: userData.serviceCategory || 'handyman',
                        description: 'Professional service provider. Profile completion pending.',
                        experienceYears: 0,
                        hourlyRate: 0,
                        city: 'София',
                        neighborhood: userData.neighborhood || '',
                        address: '',
                        latitude: null,
                        longitude: null,
                        phoneNumber: savedUser.phoneNumber,
                        email: savedUser.email,
                        websiteUrl: '',
                        profileImageUrl: '',
                        isVerified: false,
                        isActive: true
                    };
                    logger_1.default.info('🔍 Profile data to be saved', {
                        businessName: defaultProfileData.businessName,
                        serviceCategory: defaultProfileData.serviceCategory,
                        neighborhood: defaultProfileData.neighborhood
                    });
                    await this.database.createOrUpdateProviderProfile(savedUser.id, defaultProfileData);
                    logger_1.default.info('Auto-created service provider profile', {
                        userId: savedUser.id,
                        businessName: defaultProfileData.businessName
                    });
                }
                catch (profileError) {
                    logger_1.default.error('Failed to auto-create service provider profile', {
                        userId: savedUser.id,
                        error: profileError instanceof Error ? profileError.message : 'Unknown error'
                    });
                }
            }
            const tokens = await this.generateTokens(savedUser);
            logger_1.gdprLogger.logDataAccess(savedUser.id, 'user_registration', 'account_creation', userData.ipAddress);
            for (const consentType of userData.gdprConsents) {
                logger_1.gdprLogger.logConsentChange(savedUser.id, consentType, true, userData.ipAddress);
            }
            logger_1.default.info('User registered successfully', {
                userId: savedUser.id,
                email: savedUser.email,
                role: savedUser.role,
                gdprCompliant: savedUser.isGdprCompliant
            });
            return { user: this.sanitizeUser(savedUser), tokens };
        }
        catch (error) {
            logger_1.default.error('User registration failed', { error: error instanceof Error ? error instanceof Error ? error.message : 'Unknown error' : 'Unknown error', email: userData.email });
            throw error;
        }
    }
    async login(credentials) {
        try {
            const ipAddress = credentials.ipAddress || 'unknown';
            const bruteForceCheck = await this.securityService.checkBruteForceProtection(credentials.email, ipAddress);
            if (!bruteForceCheck.allowed) {
                logger_1.default.warn('🚨 Login blocked by brute force protection', {
                    email: this.maskEmail(credentials.email),
                    ipAddress: this.maskIP(ipAddress),
                    reason: bruteForceCheck.reason
                });
                throw new types_1.ServiceTextProError(bruteForceCheck.reason || 'Too many failed attempts', 'BRUTE_FORCE_PROTECTION', 429);
            }
            const user = await this.findUserByEmail(credentials.email);
            if (!user) {
                this.securityService.recordFailedLogin(credentials.email, ipAddress);
                const securityCheck = await this.securityService.checkBruteForceProtection(credentials.email, ipAddress);
                const emailRemaining = securityCheck.emailRemaining || 0;
                let dynamicMessage = 'Invalid credentials.';
                if (emailRemaining > 0) {
                    if (emailRemaining === 1) {
                        dynamicMessage += ` ⚠️ WARNING: This account will be locked after 1 more failed attempt.`;
                    }
                    else {
                        dynamicMessage += ` You have ${emailRemaining} attempts remaining before this account is locked for 15 minutes.`;
                    }
                    if (emailRemaining <= 3) {
                        dynamicMessage += ` 💡 Tip: If you forgot your password, consider using the "Forgot Password" option to reset it instead of risking account lockout.`;
                    }
                }
                const error = new types_1.ServiceTextProError(dynamicMessage, 'INVALID_CREDENTIALS', 401);
                error.debugInfo = securityCheck.debugInfo;
                error.securityInfo = {
                    emailAttempts: securityCheck.emailAttempts,
                    ipAttempts: securityCheck.ipAttempts,
                    emailRemaining: securityCheck.emailRemaining,
                    ipRemaining: securityCheck.ipRemaining
                };
                throw error;
            }
            if (user.status === types_1.UserStatus.SUSPENDED) {
                throw new types_1.ServiceTextProError('Account suspended', 'ACCOUNT_SUSPENDED', 403);
            }
            if (user.status === types_1.UserStatus.DELETED) {
                throw new types_1.ServiceTextProError('Account not found', 'ACCOUNT_NOT_FOUND', 404);
            }
            const isPasswordValid = await bcryptjs_1.default.compare(credentials.password, user.passwordHash);
            if (!isPasswordValid) {
                this.securityService.recordFailedLogin(credentials.email, ipAddress);
                const securityCheck = await this.securityService.checkBruteForceProtection(credentials.email, ipAddress);
                logger_1.default.warn('🚨 Failed login attempt', {
                    email: this.maskEmail(credentials.email),
                    ipAddress: this.maskIP(ipAddress),
                    userId: user.id,
                    emailAttempts: securityCheck.emailAttempts,
                    ipAttempts: securityCheck.ipAttempts,
                    emailRemaining: securityCheck.emailRemaining,
                    ipRemaining: securityCheck.ipRemaining
                });
                const emailRemaining = securityCheck.emailRemaining || 0;
                const ipRemaining = securityCheck.ipRemaining || 0;
                let dynamicMessage = 'Invalid credentials.';
                if (emailRemaining > 0) {
                    if (emailRemaining === 1) {
                        dynamicMessage += ` ⚠️ WARNING: This account will be locked after 1 more failed attempt.`;
                    }
                    else {
                        dynamicMessage += ` You have ${emailRemaining} attempts remaining before this account is locked for 15 minutes.`;
                    }
                    if (emailRemaining <= 3) {
                        dynamicMessage += ` 💡 Tip: If you forgot your password, consider using the "Forgot Password" option to reset it instead of risking account lockout.`;
                    }
                }
                if (ipRemaining <= 5 && ipRemaining > 0) {
                    dynamicMessage += ` Your location has ${ipRemaining} attempts remaining before being restricted for 1 hour.`;
                }
                const error = new types_1.ServiceTextProError(dynamicMessage, 'INVALID_CREDENTIALS', 401);
                error.debugInfo = securityCheck.debugInfo;
                error.securityInfo = {
                    emailAttempts: securityCheck.emailAttempts,
                    ipAttempts: securityCheck.ipAttempts,
                    emailRemaining: securityCheck.emailRemaining,
                    ipRemaining: securityCheck.ipRemaining
                };
                throw error;
            }
            this.securityService.clearFailedAttempts(credentials.email, ipAddress);
            if (!user.isGdprCompliant) {
                throw new types_1.GDPRComplianceError('Account requires GDPR compliance update');
            }
            if (user.dataRetentionUntil < new Date()) {
                throw new types_1.ServiceTextProError('Account data expired', 'DATA_EXPIRED', 410);
            }
            user.lastLoginAt = new Date();
            user.updatedAt = new Date();
            await this.updateUser(user);
            const tokens = await this.generateTokens(user);
            logger_1.gdprLogger.logDataAccess(user.id, 'user_authentication', 'login', credentials.ipAddress);
            logger_1.default.info('User logged in successfully', {
                userId: user.id,
                email: user.email,
                role: user.role
            });
            return { user: this.sanitizeUser(user), tokens };
        }
        catch (error) {
            logger_1.default.error('User login failed', { error: error instanceof Error ? error.message : 'Unknown error', email: credentials.email });
            throw error;
        }
    }
    async refreshTokens(refreshToken) {
        try {
            const payload = jsonwebtoken_1.default.verify(refreshToken, this.jwtRefreshSecret);
            const user = await this.findUserById(payload.userId);
            if (!user || user.status !== types_1.UserStatus.ACTIVE) {
                throw new types_1.ServiceTextProError('Invalid refresh token', 'INVALID_REFRESH_TOKEN', 401);
            }
            const tokens = await this.generateTokens(user);
            logger_1.default.info('Tokens refreshed successfully', { userId: user.id });
            return tokens;
        }
        catch (error) {
            logger_1.default.error('Token refresh failed', { error: error instanceof Error ? error.message : 'Unknown error' });
            throw new types_1.ServiceTextProError('Invalid refresh token', 'INVALID_REFRESH_TOKEN', 401);
        }
    }
    async requestPasswordReset(request) {
        try {
            const user = await this.findUserByEmail(request.email);
            if (!user) {
                logger_1.default.info('Password reset requested for non-existent email', { email: request.email });
                return;
            }
            const resetToken = (0, uuid_1.v4)();
            const resetExpires = new Date(Date.now() + 60 * 60 * 1000);
            await this.savePasswordResetToken(user.id, resetToken, resetExpires);
            await this.sendPasswordResetEmail(user.email, resetToken);
            logger_1.gdprLogger.logDataAccess(user.id, 'password_reset_request', 'security_operation', request.ipAddress);
            logger_1.default.info('Password reset requested', { userId: user.id });
        }
        catch (error) {
            logger_1.default.error('Password reset request failed', { error: error instanceof Error ? error.message : 'Unknown error' });
            throw error;
        }
    }
    async resetPassword(resetData) {
        try {
            const tokenData = await this.validatePasswordResetToken(resetData.token);
            if (!tokenData) {
                throw new types_1.ServiceTextProError('Invalid or expired reset token', 'INVALID_RESET_TOKEN', 400);
            }
            const user = await this.findUserById(tokenData.userId);
            if (!user) {
                throw new types_1.ServiceTextProError('User not found', 'USER_NOT_FOUND', 404);
            }
            const passwordHash = await bcryptjs_1.default.hash(resetData.newPassword, this.bcryptRounds);
            user.passwordHash = passwordHash;
            user.updatedAt = new Date();
            await this.updateUser(user);
            await this.invalidatePasswordResetToken(resetData.token);
            logger_1.gdprLogger.logDataAccess(user.id, 'password_reset', 'security_operation', resetData.ipAddress);
            logger_1.default.info('Password reset successfully', { userId: user.id });
        }
        catch (error) {
            logger_1.default.error('Password reset failed', { error: error instanceof Error ? error.message : 'Unknown error' });
            throw error;
        }
    }
    async updateGDPRConsents(userId, consents, ipAddress) {
        try {
            const user = await this.findUserById(userId);
            if (!user) {
                throw new types_1.ServiceTextProError('User not found', 'USER_NOT_FOUND', 404);
            }
            for (const consentUpdate of consents) {
                const existingConsent = user.gdprConsents.find(c => c.consentType === consentUpdate.consentType);
                if (existingConsent) {
                    existingConsent.granted = consentUpdate.granted;
                    existingConsent.timestamp = new Date();
                    existingConsent.ipAddress = ipAddress;
                    if (!consentUpdate.granted) {
                        existingConsent.withdrawnAt = new Date();
                    }
                }
                else {
                    const newConsent = {
                        id: (0, uuid_1.v4)(),
                        userId,
                        consentType: consentUpdate.consentType,
                        granted: consentUpdate.granted,
                        timestamp: new Date(),
                        ipAddress,
                        legalBasis: consentUpdate.consentType === types_1.ConsentType.ESSENTIAL_SERVICE
                            ? types_1.DataProcessingBasis.LEGITIMATE_INTEREST
                            : types_1.DataProcessingBasis.CONSENT,
                        withdrawnAt: consentUpdate.granted ? undefined : new Date()
                    };
                    user.gdprConsents.push(newConsent);
                }
                logger_1.gdprLogger.logConsentChange(userId, consentUpdate.consentType, consentUpdate.granted, ipAddress);
            }
            user.updatedAt = new Date();
            await this.updateUser(user);
            logger_1.default.info('GDPR consents updated', { userId, consentsCount: consents.length });
        }
        catch (error) {
            logger_1.default.error('GDPR consent update failed', { error: error instanceof Error ? error.message : 'Unknown error', userId });
            throw error;
        }
    }
    async generateTokens(user) {
        const payload = {
            userId: user.id,
            email: user.email,
            role: user.role,
            businessId: user.businessId
        };
        const accessToken = jsonwebtoken_1.default.sign(payload, this.jwtSecret, {
            expiresIn: this.jwtExpiresIn
        });
        const refreshToken = jsonwebtoken_1.default.sign(payload, this.jwtRefreshSecret, {
            expiresIn: this.jwtRefreshExpiresIn
        });
        return {
            accessToken,
            refreshToken,
            expiresIn: this.parseExpirationTime(this.jwtExpiresIn),
            tokenType: 'Bearer'
        };
    }
    validateGDPRConsents(consents) {
        if (!config_1.default.gdpr.enabled)
            return;
        const requiredConsents = [types_1.ConsentType.ESSENTIAL_SERVICE];
        const missingConsents = requiredConsents.filter(required => !consents.includes(required));
        if (missingConsents.length > 0) {
            throw new types_1.GDPRComplianceError(`Missing required GDPR consents: ${missingConsents.join(', ')}`);
        }
    }
    calculateDataRetentionDate(role) {
        const retentionMonths = role === types_1.UserRole.TRADESPERSON
            ? config_1.default.gdpr.dataRetention.businessDataMonths
            : config_1.default.gdpr.dataRetention.conversationMonths;
        return new Date(Date.now() + retentionMonths * 30 * 24 * 60 * 60 * 1000);
    }
    sanitizeUser(user) {
        const { passwordHash, ...sanitizedUser } = user;
        return sanitizedUser;
    }
    parseExpirationTime(expiresIn) {
        const match = expiresIn.match(/^(\d+)([smhd])$/);
        if (!match) {
            throw new Error(`Invalid expiration format: ${expiresIn}`);
        }
        const value = parseInt(match[1]);
        const unit = match[2];
        switch (unit) {
            case 's': return value;
            case 'm': return value * 60;
            case 'h': return value * 60 * 60;
            case 'd': return value * 60 * 60 * 24;
            default: throw new Error(`Invalid time unit: ${unit}`);
        }
    }
    maskEmail(email) {
        const [local, domain] = email.split('@');
        if (!domain)
            return '***@***';
        return `${local.substring(0, 2)}***@${domain}`;
    }
    maskIP(ipAddress) {
        const parts = ipAddress.split('.');
        if (parts.length === 4) {
            return `${parts[0]}.${parts[1]}.${parts[2]}.***`;
        }
        return ipAddress.substring(0, Math.max(0, ipAddress.length - 3)) + '***';
    }
    async findUserByEmail(email) {
        return await this.database.findUserByEmail(email);
    }
    async findUserById(id) {
        return await this.database.findUserById(id);
    }
    async saveUser(user) {
        const userId = await this.database.createUser(user);
        return { ...user, id: userId };
    }
    async updateUser(user) {
        await this.database.updateUser(user);
    }
    async savePasswordResetToken(userId, token, expires) {
        throw new Error('Database implementation required');
    }
    async validatePasswordResetToken(token) {
        throw new Error('Database implementation required');
    }
    async invalidatePasswordResetToken(token) {
        throw new Error('Database implementation required');
    }
    async sendPasswordResetEmail(email, token) {
        throw new Error('Email service implementation required');
    }
}
exports.AuthService = AuthService;
//# sourceMappingURL=AuthService.js.map