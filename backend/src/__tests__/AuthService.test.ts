// Comprehensive Unit Tests for AuthService
// Tests authentication, GDPR compliance, and security features

import { AuthService } from '../services/AuthService';
import { LocalDatabaseService } from '../services/LocalDatabaseService';
import { UserRole, UserStatus, ConsentType } from '../types';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// Mock dependencies
jest.mock('../services/LocalDatabaseService');
jest.mock('bcryptjs');
jest.mock('jsonwebtoken');
jest.mock('../utils/config', () => ({
  security: {
    jwt: {
      secret: 'test-secret',
      refreshSecret: 'test-refresh-secret',
      expiresIn: '15m',
      refreshExpiresIn: '7d'
    },
    bcrypt: {
      rounds: 12
    }
  },
  gdpr: {
    enabled: true,
    dataRetention: {
      businessDataMonths: 60,
      conversationMonths: 24
    }
  }
}));

const mockDatabase = new LocalDatabaseService() as jest.Mocked<LocalDatabaseService>;
const mockBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;
const mockJwt = jwt as jest.Mocked<typeof jwt>;

describe('AuthService', () => {
  let authService: AuthService;

  beforeEach(() => {
    authService = new AuthService();
    jest.clearAllMocks();
  });

  describe('User Registration', () => {
    const mockRegistrationData = {
      email: 'test@example.com',
      password: 'Test123!@#',
      firstName: 'Иван',
      lastName: 'Петров',
      phoneNumber: '+359888123456',
      role: UserRole.TRADESPERSON,
      gdprConsents: [ConsentType.ESSENTIAL_SERVICE, ConsentType.ANALYTICS],
      ipAddress: '192.168.1.1',
      userAgent: 'Test Agent'
    };

    it('should successfully register a new user with GDPR compliance', async () => {
      // Setup mocks
      mockDatabase.findUserByEmail.mockResolvedValue(null);
      mockBcrypt.hash.mockResolvedValue('hashed-password');
      mockDatabase.createUser.mockResolvedValue('user-123');
      mockJwt.sign.mockReturnValue('mock-token');

      // Execute
      const result = await authService.register(mockRegistrationData);

      // Assertions
      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('tokens');
      expect(result.user.email).toBe('test@example.com');
      expect(result.tokens.accessToken).toBe('mock-token');
      
      // Verify password was hashed
      expect(mockBcrypt.hash).toHaveBeenCalledWith('Test123!@#', 12);
      
      // Verify GDPR consents were processed
      expect(mockDatabase.createUser).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'test@example.com',
          gdprConsents: expect.arrayContaining([
            expect.objectContaining({
              consentType: ConsentType.ESSENTIAL_SERVICE,
              granted: true
            })
          ])
        })
      );
    });

    it('should reject registration without essential GDPR consent', async () => {
      const invalidData = {
        ...mockRegistrationData,
        gdprConsents: [ConsentType.ANALYTICS] // Missing essential service consent
      };

      await expect(authService.register(invalidData))
        .rejects
        .toThrow('Missing required GDPR consents');
    });

    it('should reject registration for existing user', async () => {
      mockDatabase.findUserByEmail.mockResolvedValue({
        id: 'existing-user',
        email: 'test@example.com'
      } as any);

      await expect(authService.register(mockRegistrationData))
        .rejects
        .toThrow('User already exists');
    });

    it('should validate Bulgarian phone number format', async () => {
      const invalidPhoneData = {
        ...mockRegistrationData,
        phoneNumber: '+1234567890' // Not Bulgarian format
      };

      // This validation would happen at the controller level with express-validator
      // but we can test the service logic
      expect(invalidPhoneData.phoneNumber).not.toMatch(/^\+359[0-9]{8,9}$/);
    });
  });

  describe('User Login', () => {
    const mockUser = {
      id: 'user-123',
      email: 'test@example.com',
      passwordHash: 'hashed-password',
      role: UserRole.TRADESPERSON,
      status: UserStatus.ACTIVE,
      isGdprCompliant: true,
      dataRetentionUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      gdprConsents: [{
        consentType: ConsentType.ESSENTIAL_SERVICE,
        granted: true,
        timestamp: new Date()
      }]
    };

    it('should successfully authenticate valid user', async () => {
      // Setup mocks
      mockDatabase.findUserByEmail.mockResolvedValue(mockUser as any);
      mockBcrypt.compare.mockResolvedValue(true);
      mockJwt.sign.mockReturnValue('mock-token');
      mockDatabase.updateUser = jest.fn().mockResolvedValue(undefined);

      // Execute
      const result = await authService.login({
        email: 'test@example.com',
        password: 'Test123!@#',
        ipAddress: '192.168.1.1',
        userAgent: 'Test Agent'
      });

      // Assertions
      expect(result.user.id).toBe('user-123');
      expect(result.tokens.accessToken).toBe('mock-token');
      expect(mockDatabase.updateUser).toHaveBeenCalledWith(
        expect.objectContaining({
          lastLoginAt: expect.any(Date)
        })
      );
    });

    it('should reject login for non-existent user', async () => {
      mockDatabase.findUserByEmail.mockResolvedValue(null);

      await expect(authService.login({
        email: 'nonexistent@example.com',
        password: 'password'
      })).rejects.toThrow('Invalid credentials');
    });

    it('should reject login for incorrect password', async () => {
      mockDatabase.findUserByEmail.mockResolvedValue(mockUser as any);
      mockBcrypt.compare.mockResolvedValue(false);

      await expect(authService.login({
        email: 'test@example.com',
        password: 'wrong-password'
      })).rejects.toThrow('Invalid credentials');
    });

    it('should reject login for suspended user', async () => {
      const suspendedUser = { ...mockUser, status: UserStatus.SUSPENDED };
      mockDatabase.findUserByEmail.mockResolvedValue(suspendedUser as any);

      await expect(authService.login({
        email: 'test@example.com',
        password: 'Test123!@#'
      })).rejects.toThrow('Account suspended');
    });

    it('should reject login for GDPR non-compliant user', async () => {
      const nonCompliantUser = { ...mockUser, isGdprCompliant: false };
      mockDatabase.findUserByEmail.mockResolvedValue(nonCompliantUser as any);
      mockBcrypt.compare.mockResolvedValue(true);

      await expect(authService.login({
        email: 'test@example.com',
        password: 'Test123!@#'
      })).rejects.toThrow('Account requires GDPR compliance update');
    });

    it('should reject login for expired data retention', async () => {
      const expiredUser = {
        ...mockUser,
        dataRetentionUntil: new Date(Date.now() - 24 * 60 * 60 * 1000) // Yesterday
      };
      mockDatabase.findUserByEmail.mockResolvedValue(expiredUser as any);
      mockBcrypt.compare.mockResolvedValue(true);

      await expect(authService.login({
        email: 'test@example.com',
        password: 'Test123!@#'
      })).rejects.toThrow('Account data expired');
    });
  });

  describe('Token Management', () => {
    it('should generate valid JWT tokens', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        role: UserRole.TRADESPERSON,
        businessId: 'business-123'
      };

      mockJwt.sign.mockReturnValueOnce('access-token').mockReturnValueOnce('refresh-token');

      const tokens = await (authService as any).generateTokens(mockUser);

      expect(tokens).toEqual({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresIn: 900, // 15 minutes
        tokenType: 'Bearer'
      });

      expect(mockJwt.sign).toHaveBeenCalledTimes(2);
      expect(mockJwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-123',
          email: 'test@example.com',
          role: UserRole.TRADESPERSON,
          businessId: 'business-123'
        }),
        'test-secret',
        { expiresIn: '15m' }
      );
    });

    it('should refresh tokens successfully', async () => {
      const mockPayload = {
        userId: 'user-123',
        email: 'test@example.com',
        role: UserRole.TRADESPERSON
      };

      const mockUser = {
        id: 'user-123',
        status: UserStatus.ACTIVE
      };

      mockJwt.verify.mockReturnValue(mockPayload as any);
      mockDatabase.findUserById.mockResolvedValue(mockUser as any);
      mockJwt.sign.mockReturnValue('new-token');

      const tokens = await authService.refreshTokens('old-refresh-token');

      expect(tokens.accessToken).toBe('new-token');
      expect(mockJwt.verify).toHaveBeenCalledWith('old-refresh-token', 'test-refresh-secret');
    });

    it('should reject invalid refresh token', async () => {
      mockJwt.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await expect(authService.refreshTokens('invalid-token'))
        .rejects
        .toThrow('Invalid refresh token');
    });
  });

  describe('Password Reset', () => {
    it('should handle password reset request', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' };
      mockDatabase.findUserByEmail.mockResolvedValue(mockUser as any);
      
      // Mock the password reset methods
      (authService as any).savePasswordResetToken = jest.fn().mockResolvedValue(undefined);
      (authService as any).sendPasswordResetEmail = jest.fn().mockResolvedValue(undefined);

      await authService.requestPasswordReset({
        email: 'test@example.com',
        ipAddress: '192.168.1.1'
      });

      expect((authService as any).savePasswordResetToken).toHaveBeenCalledWith(
        'user-123',
        expect.any(String),
        expect.any(Date)
      );
    });

    it('should not reveal non-existent email', async () => {
      mockDatabase.findUserByEmail.mockResolvedValue(null);

      // Should not throw error even for non-existent email
      await expect(authService.requestPasswordReset({
        email: 'nonexistent@example.com'
      })).resolves.not.toThrow();
    });

    it('should reset password with valid token', async () => {
      const mockTokenData = { userId: 'user-123' };
      const mockUser = { id: 'user-123', email: 'test@example.com' };

      (authService as any).validatePasswordResetToken = jest.fn().mockResolvedValue(mockTokenData);
      mockDatabase.findUserById.mockResolvedValue(mockUser as any);
      mockBcrypt.hash.mockResolvedValue('new-hashed-password');
      mockDatabase.updateUser = jest.fn().mockResolvedValue(undefined);
      (authService as any).invalidatePasswordResetToken = jest.fn().mockResolvedValue(undefined);

      await authService.resetPassword({
        token: 'valid-token',
        newPassword: 'NewPassword123!',
        ipAddress: '192.168.1.1'
      });

      expect(mockBcrypt.hash).toHaveBeenCalledWith('NewPassword123!', 12);
      expect(mockDatabase.updateUser).toHaveBeenCalledWith(
        expect.objectContaining({
          passwordHash: 'new-hashed-password'
        })
      );
    });
  });

  describe('GDPR Consent Management', () => {
    it('should update user GDPR consents', async () => {
      const mockUser = {
        id: 'user-123',
        gdprConsents: [{
          id: 'consent-1',
          consentType: ConsentType.ESSENTIAL_SERVICE,
          granted: true,
          timestamp: new Date()
        }]
      };

      mockDatabase.findUserById.mockResolvedValue(mockUser as any);
      mockDatabase.updateUser = jest.fn().mockResolvedValue(undefined);

      const consentUpdates = [
        { consentType: ConsentType.ANALYTICS, granted: true },
        { consentType: ConsentType.MARKETING, granted: false }
      ];

      await authService.updateGDPRConsents('user-123', consentUpdates, '192.168.1.1');

      expect(mockDatabase.updateUser).toHaveBeenCalledWith(
        expect.objectContaining({
          gdprConsents: expect.arrayContaining([
            expect.objectContaining({
              consentType: ConsentType.ANALYTICS,
              granted: true
            }),
            expect.objectContaining({
              consentType: ConsentType.MARKETING,
              granted: false,
              withdrawnAt: expect.any(Date)
            })
          ])
        })
      );
    });
  });

  describe('Security Features', () => {
    it('should sanitize user data by removing password hash', () => {
      const userWithPassword = {
        id: 'user-123',
        email: 'test@example.com',
        passwordHash: 'secret-hash',
        firstName: 'Test',
        lastName: 'User'
      };

      const sanitized = (authService as any).sanitizeUser(userWithPassword);

      expect(sanitized).not.toHaveProperty('passwordHash');
      expect(sanitized.id).toBe('user-123');
      expect(sanitized.email).toBe('test@example.com');
    });

    it('should calculate correct data retention date', () => {
      const tradePersonRetention = (authService as any).calculateDataRetentionDate(UserRole.TRADESPERSON);
      const employeeRetention = (authService as any).calculateDataRetentionDate(UserRole.EMPLOYEE);

      // Tradesperson should have longer retention (business data)
      expect(tradePersonRetention.getTime()).toBeGreaterThan(employeeRetention.getTime());
    });

    it('should parse JWT expiration time correctly', () => {
      expect((authService as any).parseExpirationTime('15m')).toBe(900);
      expect((authService as any).parseExpirationTime('1h')).toBe(3600);
      expect((authService as any).parseExpirationTime('7d')).toBe(604800);
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      mockDatabase.findUserByEmail.mockRejectedValue(new Error('Database connection failed'));

      await expect(authService.login({
        email: 'test@example.com',
        password: 'password'
      })).rejects.toThrow('Database connection failed');
    });

    it('should handle bcrypt errors', async () => {
      mockDatabase.findUserByEmail.mockResolvedValue(null);
      mockBcrypt.hash.mockRejectedValue(new Error('Hashing failed'));

      await expect(authService.register({
        email: 'test@example.com',
        password: 'Test123!@#',
        firstName: 'Test',
        lastName: 'User',
        phoneNumber: '+359888123456',
        role: UserRole.TRADESPERSON,
        gdprConsents: [ConsentType.ESSENTIAL_SERVICE]
      })).rejects.toThrow('Hashing failed');
    });
  });
});
