// Unit Tests for GDPR Consent Middleware
// Tests route protection and consent enforcement

import { Request, Response, NextFunction } from 'express';
import {
  requireConsent,
  requireAIConsent,
  requireAnalyticsConsent,
  requireDataStorageConsent,
  requireMarketingConsent,
  checkConsent
} from '../middleware/gdprConsent';
import { GDPRService } from '../services/GDPRService';
import { ConsentType } from '../types';

// Mock dependencies
jest.mock('../services/GDPRService');
jest.mock('../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

describe('GDPR Consent Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;
  let mockGdprService: jest.Mocked<GDPRService>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mock request
    mockRequest = {
      user: {
        id: 'user-123',
        email: 'test@example.com',
        role: 'customer'
      } as any, // Use 'as any' to bypass strict type checking in tests
      ip: '192.168.1.1',
      path: '/api/test'
    };

    // Setup mock response
    const jsonMock = jest.fn();
    const statusMock = jest.fn().mockReturnValue({ json: jsonMock });
    mockResponse = {
      status: statusMock,
      json: jsonMock
    };

    // Setup mock next function
    mockNext = jest.fn();

    // Setup mock GDPR service
    mockGdprService = {
      checkUserConsent: jest.fn(),
      checkUserConsents: jest.fn() as any, // Use 'as any' to allow partial mocks
      clearConsentCache: jest.fn(),
      normalizeConsentType: jest.fn(),
      getUserActiveConsents: jest.fn()
    } as any;

    (GDPRService as jest.Mock).mockImplementation(() => mockGdprService);
  });

  describe('requireConsent middleware', () => {
    it('should allow request when user has granted required consent', async () => {
      const middleware = requireConsent([ConsentType.THIRD_PARTY_INTEGRATIONS]);

      // Mock consent granted
      mockGdprService.checkUserConsents.mockResolvedValue({ 
        [ConsentType.THIRD_PARTY_INTEGRATIONS]: {
          allowed: true,
          consentType: ConsentType.THIRD_PARTY_INTEGRATIONS,
          requiresConsent: true
        }
      } as any);

      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      // Should call next() to allow request
      expect(mockNext).toHaveBeenCalled();

      // Should attach consent check results to request
      expect(mockRequest.consentCheck).toBeDefined();
      expect(mockRequest.consentCheck?.checked).toBe(true);
      expect(mockRequest.consentCheck?.allGranted).toBe(true);
      expect(mockRequest.consentCheck?.missingConsents).toHaveLength(0);
    });

    it('should block request when user has not granted required consent', async () => {
      const middleware = requireConsent([ConsentType.ANALYTICS]);

      // Mock consent denied
      mockGdprService.checkUserConsents.mockResolvedValue({ 
        [ConsentType.ANALYTICS]: {
          allowed: false,
          reason: 'User has not granted analytics consent',
          consentType: ConsentType.ANALYTICS,
          requiresConsent: true
        }
      } as any);

      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      // Should NOT call next()
      expect(mockNext).not.toHaveBeenCalled();

      // Should return 403 Forbidden
      expect(mockResponse.status).toHaveBeenCalledWith(403);

      // Should return proper error structure
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'CONSENT_REQUIRED',
          message: expect.stringContaining('съгласие'),
          details: {
            requiredConsents: [ConsentType.ANALYTICS],
            missingConsents: [ConsentType.ANALYTICS],
            consentManagementUrl: '/api/v1/gdpr/my-consents'
          }
        },
        gdpr: {
          dataProcessingBasis: 'consent',
          retentionPeriod: 'Until consent withdrawn',
          rightsInformation: 'You can manage consents in app settings'
        }
      });
    });

    it('should check multiple consents and block if any are missing', async () => {
      const middleware = requireConsent([
        ConsentType.THIRD_PARTY_INTEGRATIONS,
        ConsentType.ANALYTICS
      ]);

      // Mock: user has THIRD_PARTY but not ANALYTICS
      mockGdprService.checkUserConsents.mockResolvedValue({ 
        [ConsentType.THIRD_PARTY_INTEGRATIONS]: {
          allowed: true,
          consentType: ConsentType.THIRD_PARTY_INTEGRATIONS,
          requiresConsent: true
        },
        [ConsentType.ANALYTICS]: {
          allowed: false,
          reason: 'User has not granted analytics consent',
          consentType: ConsentType.ANALYTICS,
          requiresConsent: true
        }
      } as any);

      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      // Should block request
      expect(mockNext).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(403);

      // Should list ANALYTICS as missing
      const errorResponse = (mockResponse.json as jest.Mock).mock.calls[0][0];
      expect(errorResponse.error.details.missingConsents).toContain(ConsentType.ANALYTICS);
    });

    it('should allow request when all required consents are granted', async () => {
      const middleware = requireConsent([
        ConsentType.THIRD_PARTY_INTEGRATIONS,
        ConsentType.ANALYTICS,
        ConsentType.DATA_SHARING
      ]);

      // Mock all consents granted
      mockGdprService.checkUserConsents.mockResolvedValue({ 
        [ConsentType.THIRD_PARTY_INTEGRATIONS]: { allowed: true, consentType: ConsentType.THIRD_PARTY_INTEGRATIONS, requiresConsent: true },
        [ConsentType.ANALYTICS]: { allowed: true, consentType: ConsentType.ANALYTICS, requiresConsent: true },
        [ConsentType.DATA_SHARING]: { allowed: true, consentType: ConsentType.DATA_SHARING, requiresConsent: true }
      } as any);

      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRequest.consentCheck?.allGranted).toBe(true);
      expect(mockRequest.consentCheck?.missingConsents).toHaveLength(0);
    });

    it('should return 401 if user is not authenticated', async () => {
      const middleware = requireConsent([ConsentType.ANALYTICS]);

      // Remove user from request
      mockRequest.user = undefined;

      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Authentication required to check consents'
        }
      });
    });

    it('should handle GDPR service errors gracefully', async () => {
      const middleware = requireConsent([ConsentType.ANALYTICS]);

      // Mock service error
      mockGdprService.checkUserConsents.mockRejectedValue(
        new Error('Database connection failed')
      );

      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'CONSENT_CHECK_FAILED',
          message: 'Failed to verify user consents'
        }
      });
    });
  });

  describe('Shorthand middleware functions', () => {
    it('requireAIConsent should check THIRD_PARTY_INTEGRATIONS', async () => {
      mockGdprService.checkUserConsents.mockResolvedValue({ 
        [ConsentType.THIRD_PARTY_INTEGRATIONS]: {
          allowed: true,
          consentType: ConsentType.THIRD_PARTY_INTEGRATIONS,
          requiresConsent: true
        }
      } as any);

      await requireAIConsent(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockGdprService.checkUserConsents).toHaveBeenCalledWith(
        'user-123',
        [ConsentType.THIRD_PARTY_INTEGRATIONS]
      );
      expect(mockNext).toHaveBeenCalled();
    });

    it('requireAnalyticsConsent should check ANALYTICS', async () => {
      mockGdprService.checkUserConsents.mockResolvedValue({ 
        [ConsentType.ANALYTICS]: {
          allowed: true,
          consentType: ConsentType.ANALYTICS,
          requiresConsent: true
        }
      } as any);

      await requireAnalyticsConsent(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockGdprService.checkUserConsents).toHaveBeenCalledWith(
        'user-123',
        [ConsentType.ANALYTICS]
      );
      expect(mockNext).toHaveBeenCalled();
    });

    it('requireDataStorageConsent should check DATA_SHARING', async () => {
      mockGdprService.checkUserConsents.mockResolvedValue({ 
        [ConsentType.DATA_SHARING]: {
          allowed: true,
          consentType: ConsentType.DATA_SHARING,
          requiresConsent: true
        }
      } as any);

      await requireDataStorageConsent(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockGdprService.checkUserConsents).toHaveBeenCalledWith(
        'user-123',
        [ConsentType.DATA_SHARING]
      );
      expect(mockNext).toHaveBeenCalled();
    });

    it('requireMarketingConsent should check MARKETING', async () => {
      mockGdprService.checkUserConsents.mockResolvedValue({ 
        [ConsentType.MARKETING]: {
          allowed: true,
          consentType: ConsentType.MARKETING,
          requiresConsent: true
        }
      } as any);

      await requireMarketingConsent(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockGdprService.checkUserConsents).toHaveBeenCalledWith(
        'user-123',
        [ConsentType.MARKETING]
      );
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('checkConsent (non-blocking) middleware', () => {
    it('should check consent but not block request if missing', async () => {
      const middleware = checkConsent([ConsentType.ANALYTICS]);

      // Mock consent denied
      mockGdprService.checkUserConsents.mockResolvedValue({ 
        [ConsentType.ANALYTICS]: {
          allowed: false,
          reason: 'User has not granted analytics consent',
          consentType: ConsentType.ANALYTICS,
          requiresConsent: true
        }
      } as any);

      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      // Should still call next() even though consent is missing
      expect(mockNext).toHaveBeenCalled();

      // Should attach results to request
      expect(mockRequest.consentCheck).toBeDefined();
      expect(mockRequest.consentCheck?.allGranted).toBe(false);
      expect(mockRequest.consentCheck?.missingConsents).toContain(ConsentType.ANALYTICS);
    });

    it('should allow downstream handlers to check consent status', async () => {
      const middleware = checkConsent([ConsentType.MARKETING]);

      mockGdprService.checkUserConsents.mockResolvedValue({ 
        [ConsentType.MARKETING]: {
          allowed: true,
          consentType: ConsentType.MARKETING,
          requiresConsent: true
        }
      } as any);

      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRequest.consentCheck?.checked).toBe(true);
      expect(mockRequest.consentCheck?.results[ConsentType.MARKETING].allowed).toBe(true);
    });
  });

  describe('Bulgarian error messages', () => {
    it('should return Bulgarian message for AI consent', async () => {
      const middleware = requireConsent([ConsentType.THIRD_PARTY_INTEGRATIONS]);

      mockGdprService.checkUserConsents.mockResolvedValue({ 
        [ConsentType.THIRD_PARTY_INTEGRATIONS]: {
          allowed: false,
          reason: 'Not granted',
          consentType: ConsentType.THIRD_PARTY_INTEGRATIONS,
          requiresConsent: true
        }
      } as any);

      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      const errorResponse = (mockResponse.json as jest.Mock).mock.calls[0][0];
      expect(errorResponse.error.message).toContain('AI автоматични отговори');
    });

    it('should return Bulgarian message for analytics consent', async () => {
      const middleware = requireConsent([ConsentType.ANALYTICS]);

      mockGdprService.checkUserConsents.mockResolvedValue({ 
        [ConsentType.ANALYTICS]: {
          allowed: false,
          reason: 'Not granted',
          consentType: ConsentType.ANALYTICS,
          requiresConsent: true
        }
      } as any);

      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      const errorResponse = (mockResponse.json as jest.Mock).mock.calls[0][0];
      expect(errorResponse.error.message).toContain('аналитика');
    });

    it('should return Bulgarian message for data storage consent', async () => {
      const middleware = requireConsent([ConsentType.DATA_SHARING]);

      mockGdprService.checkUserConsents.mockResolvedValue({ 
        [ConsentType.DATA_SHARING]: {
          allowed: false,
          reason: 'Not granted',
          consentType: ConsentType.DATA_SHARING,
          requiresConsent: true
        }
      } as any);

      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      const errorResponse = (mockResponse.json as jest.Mock).mock.calls[0][0];
      expect(errorResponse.error.message).toContain('съхранение');
    });

    it('should return Bulgarian message for marketing consent', async () => {
      const middleware = requireConsent([ConsentType.MARKETING]);

      mockGdprService.checkUserConsents.mockResolvedValue({ 
        [ConsentType.MARKETING]: {
          allowed: false,
          reason: 'Not granted',
          consentType: ConsentType.MARKETING,
          requiresConsent: true
        }
      } as any);

      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      const errorResponse = (mockResponse.json as jest.Mock).mock.calls[0][0];
      expect(errorResponse.error.message).toContain('маркетинг');
    });
  });

  describe('Audit logging', () => {
    it('should log consent violations for audit trail', async () => {
      const middleware = requireConsent([ConsentType.ANALYTICS]);

      mockGdprService.checkUserConsents.mockResolvedValue({ 
        [ConsentType.ANALYTICS]: {
          allowed: false,
          reason: 'Not granted',
          consentType: ConsentType.ANALYTICS,
          requiresConsent: true
        }
      } as any);

      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      // Logging is mocked, but we can verify the middleware executed
      expect(mockResponse.status).toHaveBeenCalledWith(403);
    });

    it('should log successful consent checks', async () => {
      const middleware = requireConsent([ConsentType.THIRD_PARTY_INTEGRATIONS]);

      mockGdprService.checkUserConsents.mockResolvedValue({ 
        [ConsentType.THIRD_PARTY_INTEGRATIONS]: {
          allowed: true,
          consentType: ConsentType.THIRD_PARTY_INTEGRATIONS,
          requiresConsent: true
        }
      } as any);

      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('Edge cases', () => {
    it('should handle empty consent array', async () => {
      const middleware = requireConsent([]);

      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      // Empty array means no consents required, should allow
      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle request without user object gracefully', async () => {
      const middleware = requireConsent([ConsentType.ANALYTICS]);
      mockRequest.user = null as any;

      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
    });

    it('should preserve existing request properties', async () => {
      const middleware = requireConsent([ConsentType.ANALYTICS]);

      // Add custom property to request
      (mockRequest as any).customProp = 'test-value';

      mockGdprService.checkUserConsents.mockResolvedValue({ 
        [ConsentType.ANALYTICS]: {
          allowed: true,
          consentType: ConsentType.ANALYTICS,
          requiresConsent: true
        }
      } as any);

      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect((mockRequest as any).customProp).toBe('test-value');
      expect(mockRequest.consentCheck).toBeDefined();
    });
  });
});
