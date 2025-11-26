// GDPR-compliant Authentication Service
// Handles user authentication, authorization, and privacy rights

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import config from '../utils/config';
import logger, { gdprLogger } from '../utils/logger';
import { DatabaseFactory } from '../models/DatabaseFactory';
import SecurityEnhancementService from './SecurityEnhancementServiceSimple';
import EmailService from './EmailService';
import {
  User,
  UserRole,
  UserStatus,
  AuthTokens,
  JWTPayload,
  GDPRConsent,
  ConsentType,
  DataProcessingBasis,
  ServiceTextProError,
  GDPRComplianceError
} from '../types';

export interface LoginCredentials {
  email: string;
  password: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  serviceCategory?: string;
  companyName?: string;
  neighborhood?: string;
  role: UserRole;
  businessId?: string;
  subscription_tier_id?: string;
  gdprConsents: ConsentType[];
  ipAddress?: string;
  userAgent?: string;
}

export interface PasswordResetRequest {
  email: string;
  ipAddress?: string;
}

export interface PasswordReset {
  token: string;
  newPassword: string;
  ipAddress?: string;
}

export class AuthService {
  private readonly jwtSecret: string;
  private readonly jwtRefreshSecret: string;
  private readonly jwtExpiresIn: string;
  private readonly jwtRefreshExpiresIn: string;
  private readonly bcryptRounds: number;
  private readonly database: any; // DatabaseFactory returns SQLiteDatabase | PostgreSQLDatabase
  private readonly securityService: SecurityEnhancementService;

  constructor() {
    this.jwtSecret = config.security.jwt.secret;
    this.jwtRefreshSecret = config.security.jwt.refreshSecret;
    this.jwtExpiresIn = config.security.jwt.expiresIn;
    this.jwtRefreshExpiresIn = config.security.jwt.refreshExpiresIn;
    this.bcryptRounds = config.security.bcrypt.rounds;
    this.database = DatabaseFactory.getDatabase();
    this.securityService = SecurityEnhancementService.getInstance();
  }

  /**
   * Register a new user with GDPR compliance
   */
  async register(userData: RegisterData): Promise<{ user: User; tokens: AuthTokens }> {
    try {
      // Validate GDPR consents
      this.validateGDPRConsents(userData.gdprConsents);

      // Check if user already exists
      const existingUser = await this.findUserByEmail(userData.email);
      if (existingUser) {
        throw new ServiceTextProError('User already exists', 'USER_ALREADY_EXISTS', 409);
      }

      // Hash password
      const passwordHash = await bcrypt.hash(userData.password, this.bcryptRounds);

      // Create GDPR consents
      const gdprConsents: GDPRConsent[] = userData.gdprConsents.map(consentType => ({
        id: uuidv4(),
        userId: '', // Will be set after user creation
        consentType,
        granted: true,
        timestamp: new Date(),
        ipAddress: userData.ipAddress,
        userAgent: userData.userAgent,
        legalBasis: consentType === ConsentType.ESSENTIAL_SERVICE 
          ? DataProcessingBasis.LEGITIMATE_INTEREST 
          : DataProcessingBasis.CONSENT
      }));

      // Calculate data retention period
      const dataRetentionUntil = this.calculateDataRetentionDate(userData.role);

      // Determine subscription tier
      const subscriptionTier = userData.role === UserRole.TRADESPERSON ? (userData.subscription_tier_id || 'free') : undefined;
      const isFreeTrialUser = userData.role === UserRole.TRADESPERSON && subscriptionTier === 'free';

      // Check phone verification for tradespeople
      // TEMPORARILY DISABLED - Mobica API credentials need to be configured
      /*
      if (userData.role === UserRole.TRADESPERSON && userData.phoneNumber) {
        const smsVerificationService = require('./SMSVerificationService').default;
        const isVerified = await smsVerificationService.isPhoneVerified(userData.phoneNumber);
        
        if (!isVerified) {
          logger.warn('🚫 Phone number not verified', {
            phone: userData.phoneNumber?.substring(0, 4) + '***'
          });
          throw new ServiceTextProError(
            'Моля, потвърдете телефонния си номер преди регистрация.',
            'PHONE_NOT_VERIFIED',
            403
          );
        }
      }
      */

      // Check IP and Phone-based abuse prevention for FREE tier
      // TEMPORARILY DISABLED FOR TESTING
      /*
      if (isFreeTrialUser) {
        // Check by IP address
        if (userData.ipAddress) {
          const existingByIP = await this.database.query(
            `SELECT id, email, phone_number FROM users 
             WHERE registration_ip = $1 
             AND subscription_tier_id = 'free' 
             AND role = 'tradesperson'
             LIMIT 1`,
            [userData.ipAddress]
          );

          if (existingByIP && existingByIP.length > 0) {
            logger.warn('🚫 FREE account already exists from this IP', {
              ip: userData.ipAddress?.substring(0, 8) + '***',
              existingEmail: existingByIP[0].email?.substring(0, 3) + '***'
            });
            throw new ServiceTextProError(
              'Вече има безплатен акаунт регистриран от този IP адрес. Моля, надстройте съществуващия си акаунт или изберете платен план.',
              'FREE_ACCOUNT_IP_LIMIT',
              403
            );
          }
        }

        // Check by phone number
        if (userData.phoneNumber) {
          const existingByPhone = await this.database.query(
            `SELECT id, email, registration_ip FROM users 
             WHERE phone_number = $1 
             AND subscription_tier_id = 'free' 
             AND role = 'tradesperson'
             LIMIT 1`,
            [userData.phoneNumber]
          );

          if (existingByPhone && existingByPhone.length > 0) {
            logger.warn('🚫 FREE account already exists with this phone number', {
              phone: userData.phoneNumber?.substring(0, 4) + '***',
              existingEmail: existingByPhone[0].email?.substring(0, 3) + '***'
            });
            throw new ServiceTextProError(
              'Този телефонен номер вече е използван за безплатен акаунт. Моля, надстройте съществуващия си акаунт или изберете платен план.',
              'FREE_ACCOUNT_PHONE_LIMIT',
              403
            );
          }
        }
      }
      */

      // Create user object
      const user: User = {
        id: uuidv4(),
        email: userData.email.toLowerCase(),
        passwordHash,
        role: userData.role,
        status: UserStatus.PENDING_VERIFICATION,
        firstName: userData.firstName,
        lastName: userData.lastName,
        phoneNumber: userData.phoneNumber,
        businessId: userData.businessId,
        subscription_tier_id: subscriptionTier,
        subscription_status: userData.role === UserRole.TRADESPERSON ? 'active' : undefined,
        trial_started_at: isFreeTrialUser ? new Date() : undefined,
        trial_cases_used: isFreeTrialUser ? 0 : undefined,
        trial_expired: isFreeTrialUser ? false : undefined,
        registration_ip: userData.ipAddress,
        createdAt: new Date(),
        updatedAt: new Date(),
        gdprConsents: gdprConsents.map(consent => ({ ...consent, userId: '' })), // Will be updated
        dataRetentionUntil,
        isGdprCompliant: true
      };

      // Update consent user IDs
      user.gdprConsents = user.gdprConsents.map(consent => ({ ...consent, userId: user.id }));

      // Save user to database
      const userId = await this.database.createUser(user);
      const savedUser = { ...user, id: userId };

      // Automatically create a basic service provider profile for tradespeople
      if (savedUser.role === UserRole.TRADESPERSON) {
        try {
          // Debug logging for registration data
          logger.info('🔍 Registration data received', {
            companyName: userData.companyName,
            serviceCategory: userData.serviceCategory,
            neighborhood: userData.neighborhood,
            hasNeighborhood: !!userData.neighborhood
          });

          const defaultProfileData = {
            businessName: userData.companyName || `${savedUser.firstName} ${savedUser.lastName}`,
            serviceCategory: userData.serviceCategory || 'handyman', // Use selected category or default
            description: 'Professional service provider. Profile completion pending.',
            experienceYears: 0,
            hourlyRate: 0,
            city: 'София', // Default to Sofia, user can update
            neighborhood: userData.neighborhood || '',
            address: '',
            latitude: null,
            longitude: null,
            phoneNumber: savedUser.phoneNumber,
            email: savedUser.email,
            websiteUrl: '',
            profileImageUrl: '',
            isVerified: false,
            isActive: true // Active by default so they appear in marketplace
          };

          logger.info('🔍 Profile data to be saved', {
            businessName: defaultProfileData.businessName,
            serviceCategory: defaultProfileData.serviceCategory,
            neighborhood: defaultProfileData.neighborhood
          });

          await this.database.createOrUpdateProviderProfile(savedUser.id, defaultProfileData);
          
          logger.info('Auto-created service provider profile', {
            userId: savedUser.id,
            businessName: defaultProfileData.businessName
          });
        } catch (profileError) {
          // Don't fail registration if profile creation fails, just log it
          logger.error('Failed to auto-create service provider profile', {
            userId: savedUser.id,
            error: profileError instanceof Error ? profileError.message : 'Unknown error'
          });
        }
      }

      // Generate tokens
      const tokens = await this.generateTokens(savedUser);

      // Log GDPR events
      gdprLogger.logDataAccess(
        savedUser.id, 
        'user_registration', 
        'account_creation',
        userData.ipAddress
      );

      for (const consentType of userData.gdprConsents) {
        gdprLogger.logConsentChange(
          savedUser.id,
          consentType,
          true,
          userData.ipAddress
        );
      }

      logger.info('User registered successfully', {
        userId: savedUser.id,
        email: savedUser.email,
        role: savedUser.role,
        gdprCompliant: savedUser.isGdprCompliant
      });

      // Send verification email (non-blocking)
      this.sendVerificationEmailAsync(savedUser.id, savedUser.email, savedUser.firstName, userData.ipAddress);

      // Send welcome email (non-blocking)
      EmailService.sendWelcomeEmail(savedUser.email, savedUser.firstName, savedUser.role, savedUser.id)
        .catch(err => logger.error('Failed to send welcome email', { error: err, userId: savedUser.id }));

      return { user: this.sanitizeUser(savedUser), tokens };

    } catch (error) {
      logger.error('User registration failed', { error: error instanceof Error ? error instanceof Error ? error.message : 'Unknown error' : 'Unknown error', email: userData.email });
      throw error;
    }
  }

  /**
   * Authenticate user with GDPR audit logging
   */
  async login(credentials: LoginCredentials): Promise<{ user: User; tokens: AuthTokens }> {
    try {
      const ipAddress = credentials.ipAddress || 'unknown';
      
      // 🔒 SECURITY: Check brute force protection
      const bruteForceCheck = await this.securityService.checkBruteForceProtection(
        credentials.email, 
        ipAddress
      );
      
      if (!bruteForceCheck.allowed) {
        logger.warn('🚨 Login blocked by brute force protection', {
          email: this.maskEmail(credentials.email),
          ipAddress: this.maskIP(ipAddress),
          reason: bruteForceCheck.reason
        });
        throw new ServiceTextProError(
          bruteForceCheck.reason || 'Too many failed attempts', 
          'BRUTE_FORCE_PROTECTION', 
          429
        );
      }

      // Find user by email
      const user = await this.findUserByEmail(credentials.email);
      if (!user) {
        // 🔒 SECURITY: Record failed attempt and get updated counts
        this.securityService.recordFailedLogin(credentials.email, ipAddress);
        const securityCheck = await this.securityService.checkBruteForceProtection(credentials.email, ipAddress);
        
        // Create dynamic error message for non-existent user
        const emailRemaining = securityCheck.emailRemaining || 0;
        let dynamicMessage = 'Invalid credentials.';
        
        if (emailRemaining > 0) {
          if (emailRemaining === 1) {
            dynamicMessage += ` ⚠️ WARNING: This account will be locked after 1 more failed attempt.`;
          } else {
            dynamicMessage += ` You have ${emailRemaining} attempts remaining before this account is locked for 15 minutes.`;
          }
          
          // Suggest password reset for last 3 attempts
          if (emailRemaining <= 3) {
            dynamicMessage += ` 💡 Tip: If you forgot your password, consider using the "Forgot Password" option to reset it instead of risking account lockout.`;
          }
        }

        // Create error with debug info
        const error = new ServiceTextProError(dynamicMessage, 'INVALID_CREDENTIALS', 401);
        (error as any).debugInfo = securityCheck.debugInfo;
        (error as any).securityInfo = {
          emailAttempts: securityCheck.emailAttempts,
          ipAttempts: securityCheck.ipAttempts,
          emailRemaining: securityCheck.emailRemaining,
          ipRemaining: securityCheck.ipRemaining
        };
        
        throw error;
      }

      // Check user status
      if (user.status === UserStatus.SUSPENDED) {
        throw new ServiceTextProError('Account suspended', 'ACCOUNT_SUSPENDED', 403);
      }

      if (user.status === UserStatus.DELETED) {
        throw new ServiceTextProError('Account not found', 'ACCOUNT_NOT_FOUND', 404);
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(credentials.password, user.passwordHash);
      if (!isPasswordValid) {
        // 🔒 SECURITY: Record failed attempt
        this.securityService.recordFailedLogin(credentials.email, ipAddress);
        
        // Get updated attempt counts for dynamic message
        const securityCheck = await this.securityService.checkBruteForceProtection(credentials.email, ipAddress);
        
        logger.warn('🚨 Failed login attempt', {
          email: this.maskEmail(credentials.email),
          ipAddress: this.maskIP(ipAddress),
          userId: user.id,
          emailAttempts: securityCheck.emailAttempts,
          ipAttempts: securityCheck.ipAttempts,
          emailRemaining: securityCheck.emailRemaining,
          ipRemaining: securityCheck.ipRemaining
        });

        // Create dynamic error message
        const emailRemaining = securityCheck.emailRemaining || 0;
        const ipRemaining = securityCheck.ipRemaining || 0;
        
        let dynamicMessage = 'Invalid credentials.';
        
        if (emailRemaining > 0) {
          if (emailRemaining === 1) {
            dynamicMessage += ` ⚠️ WARNING: This account will be locked after 1 more failed attempt.`;
          } else {
            dynamicMessage += ` You have ${emailRemaining} attempts remaining before this account is locked for 15 minutes.`;
          }
          
          // Suggest password reset for last 3 attempts
          if (emailRemaining <= 3) {
            dynamicMessage += ` 💡 Tip: If you forgot your password, consider using the "Forgot Password" option to reset it instead of risking account lockout.`;
          }
        }
        
        if (ipRemaining <= 5 && ipRemaining > 0) {
          dynamicMessage += ` Your location has ${ipRemaining} attempts remaining before being restricted for 1 hour.`;
        }

        // Create error with debug info for development
        const error = new ServiceTextProError(dynamicMessage, 'INVALID_CREDENTIALS', 401);
        (error as any).debugInfo = securityCheck.debugInfo;
        (error as any).securityInfo = {
          emailAttempts: securityCheck.emailAttempts,
          ipAttempts: securityCheck.ipAttempts,
          emailRemaining: securityCheck.emailRemaining,
          ipRemaining: securityCheck.ipRemaining
        };
        
        throw error;
      }

      // 🔒 SECURITY: Clear failed attempts on successful login
      this.securityService.clearFailedAttempts(credentials.email, ipAddress);

      // Check GDPR compliance
      if (!user.isGdprCompliant) {
        throw new GDPRComplianceError('Account requires GDPR compliance update');
      }

      // Check data retention
      if (user.dataRetentionUntil < new Date()) {
        throw new ServiceTextProError('Account data expired', 'DATA_EXPIRED', 410);
      }

      // Check trial status for FREE tier users and auto-disable SMS if expired
      if (user.role === UserRole.TRADESPERSON && user.subscription_tier_id === 'free') {
        try {
          const trialService = require('./TrialService').default;
          const trialStatus = await trialService.checkTrialStatus(user.id);
          
          if (trialStatus.isExpired) {
            logger.info('📵 Trial expired on login - auto-disabling SMS', { 
              userId: user.id, 
              reason: trialStatus.reason 
            });
            
            // Auto-disable SMS
            const db = require('../models/DatabaseFactory').DatabaseFactory.getDatabase();
            await db.query(
              `UPDATE sms_settings SET is_enabled = FALSE, updated_at = NOW() WHERE user_id = $1`,
              [user.id]
            );
            
            logger.info('✅ SMS auto-disabled on login due to trial expiration', { 
              userId: user.id 
            });
          }
        } catch (trialError) {
          logger.error('❌ Error checking trial on login:', trialError);
        }
      }

      // Update last login
      user.lastLoginAt = new Date();
      user.updatedAt = new Date();
      await this.updateUser(user);

      // Generate tokens
      const tokens = await this.generateTokens(user);

      // Log authentication event
      gdprLogger.logDataAccess(
        user.id,
        'user_authentication',
        'login',
        credentials.ipAddress
      );

      logger.info('User logged in successfully', {
        userId: user.id,
        email: user.email,
        role: user.role
      });

      return { user: this.sanitizeUser(user), tokens };

    } catch (error) {
      logger.error('User login failed', { error: error instanceof Error ? error.message : 'Unknown error', email: credentials.email });
      throw error;
    }
  }

  /**
   * Refresh authentication tokens
   */
  async refreshTokens(refreshToken: string): Promise<AuthTokens> {
    try {
      // Verify refresh token
      const payload = jwt.verify(refreshToken, this.jwtRefreshSecret) as JWTPayload;
      
      // Find user
      const user = await this.findUserById(payload.userId);
      if (!user || user.status !== UserStatus.ACTIVE) {
        throw new ServiceTextProError('Invalid refresh token', 'INVALID_REFRESH_TOKEN', 401);
      }

      // Generate new tokens
      const tokens = await this.generateTokens(user);

      logger.info('Tokens refreshed successfully', { userId: user.id });

      return tokens;

    } catch (error) {
      logger.error('Token refresh failed', { error: error instanceof Error ? error.message : 'Unknown error' });
      throw new ServiceTextProError('Invalid refresh token', 'INVALID_REFRESH_TOKEN', 401);
    }
  }

  /**
   * Request password reset with GDPR compliance
   */
  async requestPasswordReset(request: PasswordResetRequest): Promise<void> {
    try {
      const user = await this.findUserByEmail(request.email);
      if (!user) {
        // Don't reveal if email exists for security
        logger.info('Password reset requested for non-existent email', { email: request.email });
        return;
      }

      // Create password reset token using EmailService
      const { token: resetToken } = await EmailService.createPasswordResetToken(user.id, request.ipAddress);

      // Send reset email
      await EmailService.sendPasswordResetEmail(user.email, user.firstName, resetToken, user.id);

      // Log GDPR event
      gdprLogger.logDataAccess(
        user.id,
        'password_reset_request',
        'security_operation',
        request.ipAddress
      );

      logger.info('Password reset requested', { userId: user.id });

    } catch (error) {
      logger.error('Password reset request failed', { error: error instanceof Error ? error.message : 'Unknown error' });
      throw error;
    }
  }

  /**
   * Reset password using token
   */
  async resetPassword(resetData: PasswordReset): Promise<void> {
    try {
      // Validate reset token
      const tokenData = await this.validatePasswordResetToken(resetData.token);
      if (!tokenData) {
        throw new ServiceTextProError('Invalid or expired reset token', 'INVALID_RESET_TOKEN', 400);
      }

      // Find user
      const user = await this.findUserById(tokenData.userId);
      if (!user) {
        throw new ServiceTextProError('User not found', 'USER_NOT_FOUND', 404);
      }

      // Hash new password
      const passwordHash = await bcrypt.hash(resetData.newPassword, this.bcryptRounds);

      // Update user password
      user.passwordHash = passwordHash;
      user.updatedAt = new Date();
      await this.updateUser(user);

      // Invalidate reset token
      await this.invalidatePasswordResetToken(resetData.token);

      // Log GDPR event
      gdprLogger.logDataAccess(
        user.id,
        'password_reset',
        'security_operation',
        resetData.ipAddress
      );

      logger.info('Password reset successfully', { userId: user.id });

    } catch (error) {
      logger.error('Password reset failed', { error: error instanceof Error ? error.message : 'Unknown error' });
      throw error;
    }
  }

  /**
   * Update user GDPR consents
   */
  async updateGDPRConsents(
    userId: string, 
    consents: Array<{ consentType: ConsentType; granted: boolean }>,
    ipAddress?: string
  ): Promise<void> {
    try {
      const user = await this.findUserById(userId);
      if (!user) {
        throw new ServiceTextProError('User not found', 'USER_NOT_FOUND', 404);
      }

      // Update consents
      for (const consentUpdate of consents) {
        const existingConsent = user.gdprConsents.find(
          c => c.consentType === consentUpdate.consentType
        );

        if (existingConsent) {
          // Update existing consent
          existingConsent.granted = consentUpdate.granted;
          existingConsent.timestamp = new Date();
          existingConsent.ipAddress = ipAddress;
          if (!consentUpdate.granted) {
            existingConsent.withdrawnAt = new Date();
          }
        } else {
          // Add new consent
          const newConsent: GDPRConsent = {
            id: uuidv4(),
            userId,
            consentType: consentUpdate.consentType,
            granted: consentUpdate.granted,
            timestamp: new Date(),
            ipAddress,
            legalBasis: consentUpdate.consentType === ConsentType.ESSENTIAL_SERVICE
              ? DataProcessingBasis.LEGITIMATE_INTEREST
              : DataProcessingBasis.CONSENT,
            withdrawnAt: consentUpdate.granted ? undefined : new Date()
          };
          user.gdprConsents.push(newConsent);
        }

        // Log consent change
        gdprLogger.logConsentChange(
          userId,
          consentUpdate.consentType,
          consentUpdate.granted,
          ipAddress
        );
      }

      user.updatedAt = new Date();
      await this.updateUser(user);

      logger.info('GDPR consents updated', { userId, consentsCount: consents.length });

    } catch (error) {
      logger.error('GDPR consent update failed', { error: error instanceof Error ? error.message : 'Unknown error', userId });
      throw error;
    }
  }

  /**
   * Generate JWT tokens
   */
  private async generateTokens(user: User): Promise<AuthTokens> {
    const payload: Omit<JWTPayload, 'iat' | 'exp'> = {
      userId: user.id,
      email: user.email,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
      businessId: user.businessId
    };

    const accessToken = jwt.sign(payload, this.jwtSecret, { 
      expiresIn: this.jwtExpiresIn 
    } as jwt.SignOptions);

    const refreshToken = jwt.sign(payload, this.jwtRefreshSecret, { 
      expiresIn: this.jwtRefreshExpiresIn 
    } as jwt.SignOptions);

    return {
      accessToken,
      refreshToken,
      expiresIn: this.parseExpirationTime(this.jwtExpiresIn),
      tokenType: 'Bearer'
    };
  }

  /**
   * Validate required GDPR consents
   */
  private validateGDPRConsents(consents: ConsentType[]): void {
    if (!config.gdpr.enabled) return;

    const requiredConsents = [ConsentType.ESSENTIAL_SERVICE];
    const missingConsents = requiredConsents.filter(required => !consents.includes(required));

    if (missingConsents.length > 0) {
      throw new GDPRComplianceError(
        `Missing required GDPR consents: ${missingConsents.join(', ')}`
      );
    }
  }

  /**
   * Calculate data retention date based on user role
   */
  private calculateDataRetentionDate(role: UserRole): Date {
    const retentionMonths = role === UserRole.TRADESPERSON 
      ? config.gdpr.dataRetention.businessDataMonths
      : config.gdpr.dataRetention.conversationMonths;

    return new Date(Date.now() + retentionMonths * 30 * 24 * 60 * 60 * 1000);
  }

  /**
   * Remove sensitive data from user object
   */
  public sanitizeUser(user: User): User {
    const { passwordHash, ...sanitizedUser } = user;
    return sanitizedUser as User;
  }

  /**
   * Parse JWT expiration time to seconds
   */
  private parseExpirationTime(expiresIn: string): number {
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

  /**
   * Mask email for logging (privacy protection)
   */
  private maskEmail(email: string): string {
    const [local, domain] = email.split('@');
    if (!domain) return '***@***';
    return `${local.substring(0, 2)}***@${domain}`;
  }

  /**
   * Mask IP address for logging (privacy protection)
   */
  private maskIP(ipAddress: string): string {
    const parts = ipAddress.split('.');
    if (parts.length === 4) {
      return `${parts[0]}.${parts[1]}.${parts[2]}.***`;
    }
    return ipAddress.substring(0, Math.max(0, ipAddress.length - 3)) + '***';
  }

  private async findUserByEmail(email: string): Promise<User | null> {
    return await this.database.findUserByEmail(email);
  }

  public async findUserById(id: string): Promise<User | null> {
    return await this.database.findUserById(id);
  }

  private async saveUser(user: User): Promise<User> {
    const userId = await this.database.createUser(user);
    return { ...user, id: userId };
  }

  private async updateUser(user: User): Promise<void> {
    await this.database.updateUser(user);
  }

  private async savePasswordResetToken(userId: string, token: string, expires: Date): Promise<void> {
    // Use EmailService to create password reset token
    // Note: The token is already created in requestPasswordReset, this is a compatibility wrapper
    logger.info('Password reset token saved', { userId });
  }

  private async validatePasswordResetToken(token: string): Promise<{ userId: string } | null> {
    return await EmailService.validatePasswordResetToken(token);
  }

  private async invalidatePasswordResetToken(token: string): Promise<void> {
    await EmailService.markPasswordResetTokenUsed(token);
  }

  private async sendPasswordResetEmail(email: string, token: string): Promise<void> {
    const user = await this.findUserByEmail(email);
    if (user) {
      await EmailService.sendPasswordResetEmail(email, user.firstName, token, user.id);
    }
  }

  /**
   * Send verification email asynchronously (non-blocking)
   */
  private sendVerificationEmailAsync(userId: string, email: string, firstName: string, ipAddress?: string): void {
    (async () => {
      try {
        const { token } = await EmailService.createVerificationToken(userId, ipAddress);
        await EmailService.sendVerificationEmail(email, firstName, token, userId);
        logger.info('Verification email sent asynchronously', { userId, email });
      } catch (error) {
        logger.error('Failed to send verification email', { 
          error: error instanceof Error ? error.message : 'Unknown error', 
          userId 
        });
      }
    })();
  }

  /**
   * Send verification email to user
   */
  public async sendVerificationEmail(userId: string, ipAddress?: string): Promise<void> {
    const user = await this.findUserById(userId);
    if (!user) {
      throw new ServiceTextProError('User not found', 'USER_NOT_FOUND', 404);
    }

    const { token } = await EmailService.createVerificationToken(userId, ipAddress);
    await EmailService.sendVerificationEmail(user.email, user.firstName, token, userId);

    logger.info('Verification email sent', { userId, email: user.email });
  }

  /**
   * Verify email with token
   */
  public async verifyEmail(token: string): Promise<{ user: User }> {
    const tokenData = await EmailService.validateVerificationToken(token);
    if (!tokenData) {
      throw new ServiceTextProError('Invalid or expired verification token', 'INVALID_TOKEN', 400);
    }

    const user = await this.findUserById(tokenData.userId);
    if (!user) {
      throw new ServiceTextProError('User not found', 'USER_NOT_FOUND', 404);
    }

    // Mark token as used
    await EmailService.markVerificationTokenUsed(token);

    // Mark email as verified
    await EmailService.markEmailVerified(tokenData.userId);

    // Update user status to active if pending verification
    if (user.status === UserStatus.PENDING_VERIFICATION) {
      user.status = UserStatus.ACTIVE;
      user.updatedAt = new Date();
      await this.updateUser(user);
    }

    logger.info('Email verified successfully', { userId: tokenData.userId });

    return { user: this.sanitizeUser(user) };
  }

  /**
   * Resend verification email
   */
  public async resendVerificationEmail(email: string, ipAddress?: string): Promise<void> {
    const user = await this.findUserByEmail(email);
    if (!user) {
      // Don't reveal if email exists
      logger.info('Resend verification requested for non-existent email', { email });
      return;
    }

    // Check if already verified
    const userDetails = await this.database.query(
      `SELECT email_verified FROM users WHERE id = $1`,
      [user.id]
    );

    if (userDetails && userDetails.length > 0 && userDetails[0].email_verified) {
      throw new ServiceTextProError('Email already verified', 'EMAIL_ALREADY_VERIFIED', 400);
    }

    await this.sendVerificationEmail(user.id, ipAddress);
  }
}
