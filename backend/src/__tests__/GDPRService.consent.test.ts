// Unit Tests for GDPR Consent Enforcement
// Tests consent checking, caching, and type normalization

import { GDPRService } from '../services/GDPRService';
import { ConsentType } from '../types';
import { DatabaseFactory } from '../models/DatabaseFactory';

// Mock dependencies
jest.mock('../models/DatabaseFactory');
jest.mock('../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

describe('GDPRService - Consent Enforcement', () => {
  let gdprService: GDPRService;
  let mockDb: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mock database
    mockDb = {
      query: jest.fn(),
      isPostgreSQL: true
    };

    (DatabaseFactory.getDatabase as jest.Mock).mockReturnValue(mockDb);
    (DatabaseFactory.isPostgreSQL as jest.Mock).mockReturnValue(true);

    gdprService = new GDPRService();
  });

  describe('checkUserConsent', () => {
    const userId = 'user-123';
    const consentType = ConsentType.THIRD_PARTY_INTEGRATIONS;

    it('should return allowed=true when user has granted consent', async () => {
      // Mock granted consent in database
      mockDb.query.mockResolvedValue([{
        id: 'consent-1',
        user_id: userId,
        consent_type: consentType,
        granted: true,
        timestamp: new Date('2024-01-01'),
        withdrawn_at: null
      }]);

      const result = await gdprService.checkUserConsent(userId, consentType);

      expect(result.allowed).toBe(true);
      expect(result.consentType).toBe(consentType);
      expect(result.requiresConsent).toBe(true);
      expect(result.grantedAt).toBeInstanceOf(Date);
      expect(result.reason).toBeUndefined();

      // Verify correct SQL query
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM gdpr_consents'),
        [userId, consentType]
      );
    });

    it('should return allowed=false when user has not granted consent', async () => {
      // Mock no consent found
      mockDb.query.mockResolvedValue([]);

      const result = await gdprService.checkUserConsent(userId, consentType);

      expect(result.allowed).toBe(false);
      expect(result.consentType).toBe(consentType);
      expect(result.requiresConsent).toBe(true);
      expect(result.reason).toContain('has not granted');
      expect(result.grantedAt).toBeUndefined();
    });

    it('should return allowed=false when consent has been withdrawn', async () => {
      // Mock withdrawn consent
      mockDb.query.mockResolvedValue([{
        id: 'consent-1',
        user_id: userId,
        consent_type: consentType,
        granted: true,
        timestamp: new Date('2024-01-01'),
        withdrawn_at: new Date('2024-01-15') // Withdrawn!
      }]);

      // Since query filters by withdrawn_at IS NULL, it should return empty
      mockDb.query.mockResolvedValue([]);

      const result = await gdprService.checkUserConsent(userId, consentType);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('has not granted');
    });

    it('should use cache for repeated consent checks (15-minute TTL)', async () => {
      // First call - hits database
      mockDb.query.mockResolvedValue([{
        id: 'consent-1',
        user_id: userId,
        consent_type: consentType,
        granted: true,
        timestamp: new Date(),
        withdrawn_at: null
      }]);

      const result1 = await gdprService.checkUserConsent(userId, consentType);
      expect(result1.allowed).toBe(true);
      expect(mockDb.query).toHaveBeenCalledTimes(1);

      // Second call - should use cache
      const result2 = await gdprService.checkUserConsent(userId, consentType);
      expect(result2.allowed).toBe(true);
      expect(mockDb.query).toHaveBeenCalledTimes(1); // Still 1, not 2!
    });

    it('should handle database errors gracefully', async () => {
      // Mock database error
      mockDb.query.mockRejectedValue(new Error('Database connection failed'));

      const result = await gdprService.checkUserConsent(userId, consentType);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Error checking consent');
    });

    it('should check essential service consent', async () => {
      mockDb.query.mockResolvedValue([{
        id: 'consent-1',
        user_id: userId,
        consent_type: ConsentType.ESSENTIAL_SERVICE,
        granted: true,
        timestamp: new Date(),
        withdrawn_at: null
      }]);

      const result = await gdprService.checkUserConsent(userId, ConsentType.ESSENTIAL_SERVICE);

      expect(result.allowed).toBe(true);
      expect(result.consentType).toBe(ConsentType.ESSENTIAL_SERVICE);
    });

    it('should check analytics consent', async () => {
      mockDb.query.mockResolvedValue([]);

      const result = await gdprService.checkUserConsent(userId, ConsentType.ANALYTICS);

      expect(result.allowed).toBe(false);
      expect(result.consentType).toBe(ConsentType.ANALYTICS);
    });

    it('should check marketing consent', async () => {
      mockDb.query.mockResolvedValue([{
        id: 'consent-1',
        user_id: userId,
        consent_type: ConsentType.MARKETING,
        granted: true,
        timestamp: new Date(),
        withdrawn_at: null
      }]);

      const result = await gdprService.checkUserConsent(userId, ConsentType.MARKETING);

      expect(result.allowed).toBe(true);
      expect(result.consentType).toBe(ConsentType.MARKETING);
    });

    it('should check data sharing consent', async () => {
      mockDb.query.mockResolvedValue([]);

      const result = await gdprService.checkUserConsent(userId, ConsentType.DATA_SHARING);

      expect(result.allowed).toBe(false);
      expect(result.consentType).toBe(ConsentType.DATA_SHARING);
    });
  });

  describe('checkUserConsents (batch check)', () => {
    const userId = 'user-123';
    const consentTypes = [
      ConsentType.THIRD_PARTY_INTEGRATIONS,
      ConsentType.ANALYTICS,
      ConsentType.DATA_SHARING
    ];

    it('should check multiple consents at once', async () => {
      // Mock: user has granted THIRD_PARTY and ANALYTICS, but not DATA_SHARING
      mockDb.query
        .mockResolvedValueOnce([{ granted: true }]) // THIRD_PARTY
        .mockResolvedValueOnce([{ granted: true }]) // ANALYTICS
        .mockResolvedValueOnce([]); // DATA_SHARING (not granted)

      const results = await gdprService.checkUserConsents(userId, consentTypes);

      expect(results[ConsentType.THIRD_PARTY_INTEGRATIONS].allowed).toBe(true);
      expect(results[ConsentType.ANALYTICS].allowed).toBe(true);
      expect(results[ConsentType.DATA_SHARING].allowed).toBe(false);
    });

    it('should return results for all requested consent types', async () => {
      mockDb.query.mockResolvedValue([]);

      const results = await gdprService.checkUserConsents(userId, consentTypes);

      expect(Object.keys(results)).toHaveLength(3);
      expect(results[ConsentType.THIRD_PARTY_INTEGRATIONS]).toBeDefined();
      expect(results[ConsentType.ANALYTICS]).toBeDefined();
      expect(results[ConsentType.DATA_SHARING]).toBeDefined();
    });
  });

  describe('getUserActiveConsents', () => {
    const userId = 'user-123';

    it('should return list of all active consents for user', async () => {
      mockDb.query.mockResolvedValue([
        { consent_type: ConsentType.ESSENTIAL_SERVICE },
        { consent_type: ConsentType.ANALYTICS },
        { consent_type: ConsentType.THIRD_PARTY_INTEGRATIONS }
      ]);

      const activeConsents = await gdprService.getUserActiveConsents(userId);

      expect(activeConsents).toHaveLength(3);
      expect(activeConsents).toContain(ConsentType.ESSENTIAL_SERVICE);
      expect(activeConsents).toContain(ConsentType.ANALYTICS);
      expect(activeConsents).toContain(ConsentType.THIRD_PARTY_INTEGRATIONS);
    });

    it('should return empty array if user has no active consents', async () => {
      mockDb.query.mockResolvedValue([]);

      const activeConsents = await gdprService.getUserActiveConsents(userId);

      expect(activeConsents).toHaveLength(0);
      expect(activeConsents).toEqual([]);
    });

    it('should only return consents where withdrawn_at IS NULL', async () => {
      // Database query should filter by withdrawn_at IS NULL
      mockDb.query.mockResolvedValue([
        { consent_type: ConsentType.ESSENTIAL_SERVICE }
      ]);

      await gdprService.getUserActiveConsents(userId);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('withdrawn_at IS NULL'),
        [userId]
      );
    });
  });

  describe('clearConsentCache', () => {
    const userId = 'user-123';

    it('should clear consent cache for user', async () => {
      // First, populate cache
      mockDb.query.mockResolvedValue([{
        id: 'consent-1',
        user_id: userId,
        consent_type: ConsentType.ANALYTICS,
        granted: true,
        timestamp: new Date(),
        withdrawn_at: null
      }]);

      await gdprService.checkUserConsent(userId, ConsentType.ANALYTICS);
      expect(mockDb.query).toHaveBeenCalledTimes(1);

      // Check again - should use cache
      await gdprService.checkUserConsent(userId, ConsentType.ANALYTICS);
      expect(mockDb.query).toHaveBeenCalledTimes(1); // Still 1!

      // Clear cache
      gdprService.clearConsentCache(userId);

      // Check again - should hit database
      await gdprService.checkUserConsent(userId, ConsentType.ANALYTICS);
      expect(mockDb.query).toHaveBeenCalledTimes(2); // Now 2!
    });

    it('should not affect other users caches', async () => {
      const user1 = 'user-1';
      const user2 = 'user-2';

      mockDb.query.mockResolvedValue([{ granted: true }]);

      // Populate cache for both users
      await gdprService.checkUserConsent(user1, ConsentType.ANALYTICS);
      await gdprService.checkUserConsent(user2, ConsentType.ANALYTICS);
      expect(mockDb.query).toHaveBeenCalledTimes(2);

      // Clear cache for user1 only
      gdprService.clearConsentCache(user1);

      // Check both users again
      await gdprService.checkUserConsent(user1, ConsentType.ANALYTICS); // DB hit
      await gdprService.checkUserConsent(user2, ConsentType.ANALYTICS); // Cache hit

      // Should have 3 total calls (2 initial + 1 for user1 after cache clear)
      expect(mockDb.query).toHaveBeenCalledTimes(3);
    });
  });

  describe('normalizeConsentType', () => {
    it('should normalize mobile data_processing to backend essential_service', () => {
      const result = gdprService.normalizeConsentType('data_processing');
      expect(result).toBe(ConsentType.ESSENTIAL_SERVICE);
    });

    it('should normalize mobile ai_communication to backend third_party_integrations', () => {
      const result = gdprService.normalizeConsentType('ai_communication');
      expect(result).toBe(ConsentType.THIRD_PARTY_INTEGRATIONS);
    });

    it('should normalize mobile data_storage to backend data_sharing', () => {
      const result = gdprService.normalizeConsentType('data_storage');
      expect(result).toBe(ConsentType.DATA_SHARING);
    });

    it('should pass through analytics unchanged', () => {
      const result = gdprService.normalizeConsentType('analytics');
      expect(result).toBe(ConsentType.ANALYTICS);
    });

    it('should normalize mobile third_party to backend marketing', () => {
      const result = gdprService.normalizeConsentType('third_party');
      expect(result).toBe(ConsentType.THIRD_PARTY_INTEGRATIONS);
    });

    it('should pass through backend types unchanged', () => {
      expect(gdprService.normalizeConsentType('essential_service')).toBe(ConsentType.ESSENTIAL_SERVICE);
      expect(gdprService.normalizeConsentType('marketing')).toBe(ConsentType.MARKETING);
      expect(gdprService.normalizeConsentType('third_party_integrations')).toBe(ConsentType.THIRD_PARTY_INTEGRATIONS);
      expect(gdprService.normalizeConsentType('data_sharing')).toBe(ConsentType.DATA_SHARING);
    });

    it('should handle case-insensitive input', () => {
      expect(gdprService.normalizeConsentType('DATA_PROCESSING')).toBe(ConsentType.ESSENTIAL_SERVICE);
      expect(gdprService.normalizeConsentType('Ai_Communication')).toBe(ConsentType.THIRD_PARTY_INTEGRATIONS);
    });

    it('should default to ESSENTIAL_SERVICE for unknown types', () => {
      const result = gdprService.normalizeConsentType('unknown_type');
      expect(result).toBe(ConsentType.ESSENTIAL_SERVICE);
    });
  });

  describe('Cache TTL (15 minutes)', () => {
    const userId = 'user-123';

    it('should expire cache after 15 minutes', async () => {
      jest.useFakeTimers();

      mockDb.query.mockResolvedValue([{
        id: 'consent-1',
        user_id: userId,
        consent_type: ConsentType.ANALYTICS,
        granted: true,
        timestamp: new Date(),
        withdrawn_at: null
      }]);

      // First call - populates cache
      await gdprService.checkUserConsent(userId, ConsentType.ANALYTICS);
      expect(mockDb.query).toHaveBeenCalledTimes(1);

      // Advance time by 10 minutes - still within TTL
      jest.advanceTimersByTime(10 * 60 * 1000);
      await gdprService.checkUserConsent(userId, ConsentType.ANALYTICS);
      expect(mockDb.query).toHaveBeenCalledTimes(1); // Still cached

      // Advance time by another 6 minutes (total 16 minutes) - expired
      jest.advanceTimersByTime(6 * 60 * 1000);
      await gdprService.checkUserConsent(userId, ConsentType.ANALYTICS);
      expect(mockDb.query).toHaveBeenCalledTimes(2); // Cache expired, new DB call

      jest.useRealTimers();
    });
  });

  describe('Edge Cases', () => {
    it('should handle null userId gracefully', async () => {
      const result = await gdprService.checkUserConsent(null as any, ConsentType.ANALYTICS);
      expect(result.allowed).toBe(false);
    });

    it('should handle undefined consentType gracefully', async () => {
      const result = await gdprService.checkUserConsent('user-123', undefined as any);
      expect(result.allowed).toBe(false);
    });

    it('should handle empty string userId', async () => {
      const result = await gdprService.checkUserConsent('', ConsentType.ANALYTICS);
      expect(result.allowed).toBe(false);
    });

    it('should handle database returning multiple consent records (uses latest)', async () => {
      mockDb.query.mockResolvedValue([
        {
          id: 'consent-1',
          timestamp: new Date('2024-01-01'),
          granted: true,
          withdrawn_at: null
        },
        {
          id: 'consent-2',
          timestamp: new Date('2024-01-15'), // Latest
          granted: true,
          withdrawn_at: null
        }
      ]);

      const result = await gdprService.checkUserConsent('user-123', ConsentType.ANALYTICS);

      expect(result.allowed).toBe(true);
      // Query should ORDER BY timestamp DESC LIMIT 1
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY timestamp DESC'),
        expect.any(Array)
      );
    });
  });
});
